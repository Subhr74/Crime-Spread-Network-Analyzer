/**
 * Crime Spread Network Analyzer — Node.js Backend
 * ================================================
 * Express server that:
 *  1. Compiles analyzer.c on startup
 *  2. Accepts graph data from frontend via POST /analyze
 *  3. Pipes data into the C executable
 *  4. Returns structured JSON results
 */

const express    = require('express');
const cors       = require('cors');
const { exec, spawn } = require('child_process');
const path       = require('path');
const fs         = require('fs');
const readline   = require('readline');

const app  = express();
const PORT = 3001;

/* ── Paths ─────────────────────────────────────────────── */
const C_SRC   = path.join(__dirname, 'analyzer.c');
const C_BIN   = path.join(__dirname, process.platform === 'win32' ? 'analyzer.exe' : 'analyzer');
const UPLOADS = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

/* ── Middleware ─────────────────────────────────────────── */
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

/* ── Compile C on startup ───────────────────────────────── */
function compileC() {
  return new Promise((resolve, reject) => {
    const cmd = `gcc -O2 -o "${C_BIN}" "${C_SRC}" -lm`;
    console.log('🔨 Compiling analyzer.c …');
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Compile error:\n', stderr);
        reject(new Error(stderr));
      } else {
        console.log('✅ Compiled successfully →', C_BIN);
        resolve();
      }
    });
  });
}

/* ── Build stdin string for C program ──────────────────── */
/**
 * Input format expected by analyzer.c:
 *   n m src
 *   name0 crimeLevel0
 *   name1 crimeLevel1
 *   ...
 *   u0 v0 w0
 *   u1 v1 w1
 *   ...
 */
function buildInput(data) {
  const { nodes, edges, source = 0 } = data;
  const n = nodes.length;
  const m = edges.length;
  let lines = [`${n} ${m} ${source}`];

  nodes.forEach(nd => {
    const name = (nd.name || `Zone-${nd.id}`).replace(/\s+/g, '_');
    const cl   = Math.max(0, Math.min(10, parseInt(nd.crimeLevel) || 0));
    lines.push(`${name} ${cl}`);
  });

  edges.forEach(e => {
    lines.push(`${e.source} ${e.target} ${e.weight}`);
  });

  return lines.join('\n') + '\n';
}

/* ── Run C analyzer ─────────────────────────────────────── */
function runAnalyzer(inputStr) {
  return new Promise((resolve, reject) => {
    const proc = spawn(C_BIN, [], { timeout: 15000 });
    let stdout = '', stderr = '';

    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Analyzer exited ${code}: ${stderr}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error('Failed to parse C output as JSON: ' + stdout.slice(0, 200)));
        }
      }
    });

    proc.on('error', reject);
    proc.stdin.write(inputStr);
    proc.stdin.end();
  });
}

/* ── In-memory result cache ─────────────────────────────── */
let latestResult = null;

/* ══════════════════════════════════════════════════════════
 * API Endpoints
 * ══════════════════════════════════════════════════════════ */

/**
 * POST /analyze
 * Body: { nodes: [...], edges: [...], source: 0 }
 * Returns full analysis JSON from C engine
 */
app.post('/analyze', async (req, res) => {
  try {
    const data = req.body;

    /* Basic validation */
    if (!data.nodes || !Array.isArray(data.nodes) || data.nodes.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 nodes' });
    }
    if (!data.edges || !Array.isArray(data.edges)) {
      return res.status(400).json({ error: 'edges array required' });
    }
    if (data.nodes.length > 50) {
      return res.status(400).json({ error: 'Max 50 nodes supported' });
    }

    const input  = buildInput(data);
    console.log('📤 Running analysis for', data.nodes.length, 'nodes,', data.edges.length, 'edges');

    const result = await runAnalyzer(input);
    latestResult = result;

    res.json({ success: true, result });
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /result
 * Returns the most recent analysis result (for polling)
 */
app.get('/result', (req, res) => {
  if (!latestResult) return res.status(404).json({ error: 'No analysis run yet' });
  res.json({ success: true, result: latestResult });
});

/**
 * GET /sample
 * Returns a pre-built sample dataset (8-node city crime network)
 */
app.get('/sample', (req, res) => {
  const sample = {
    source: 0,
    nodes: [
      { id: 0, name: "Police-HQ",     crimeLevel: 1 },
      { id: 1, name: "Downtown",      crimeLevel: 8 },
      { id: 2, name: "Harbor-Dist",   crimeLevel: 6 },
      { id: 3, name: "Northside",     crimeLevel: 4 },
      { id: 4, name: "Industrial",    crimeLevel: 7 },
      { id: 5, name: "Suburb-East",   crimeLevel: 3 },
      { id: 6, name: "Chinatown",     crimeLevel: 5 },
      { id: 7, name: "Airport-Zone",  crimeLevel: 2 }
    ],
    edges: [
      { source: 0, target: 1, weight: 4 },
      { source: 0, target: 3, weight: 2 },
      { source: 1, target: 2, weight: 3 },
      { source: 1, target: 4, weight: 6 },
      { source: 2, target: 4, weight: 2 },
      { source: 2, target: 6, weight: 5 },
      { source: 3, target: 5, weight: 7 },
      { source: 4, target: 5, weight: 1 },
      { source: 4, target: 7, weight: 4 },
      { source: 5, target: 7, weight: 3 },
      { source: 6, target: 7, weight: 2 }
    ]
  };
  res.json(sample);
});

/**
 * POST /parse-csv
 * Parses a CSV into graph data
 * CSV format: source,target,weight,sourceName,targetName,sourceCrime,targetCrime
 */
app.post('/parse-csv', (req, res) => {
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'csv field required' });

  try {
    const lines  = csv.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const nodeMap = new Map();
    const edges  = [];
    let nextId   = 0;

    const getNode = (name, crime) => {
      if (!nodeMap.has(name)) {
        nodeMap.set(name, { id: nextId++, name, crimeLevel: parseInt(crime) || 0 });
      }
      return nodeMap.get(name);
    };

    /* Skip header row if present */
    const startLine = isNaN(parseInt(lines[0].split(',')[0])) ? 1 : 0;

    for (let i = startLine; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length < 3) continue;
      const [src, tgt, w, sName='', tName='', sCrime='0', tCrime='0'] = parts;
      const sNode = getNode(sName || `Zone-${src}`, sCrime);
      const tNode = getNode(tName || `Zone-${tgt}`, tCrime);
      edges.push({ source: sNode.id, target: tNode.id, weight: parseInt(w) || 1 });
    }

    const nodes = Array.from(nodeMap.values());
    res.json({ nodes, edges, source: 0 });
  } catch (e) {
    res.status(400).json({ error: 'CSV parse error: ' + e.message });
  }
});

/**
 * GET /health
 */
app.get('/health', (req, res) => res.json({ status: 'ok', binary: C_BIN }));

/* ── Start Server ───────────────────────────────────────── */
compileC()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚔 Crime Spread Network Analyzer`);
      console.log(`   Server: http://localhost:${PORT}`);
      console.log(`   API:    http://localhost:${PORT}/analyze\n`);
    });
  })
  .catch(err => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });