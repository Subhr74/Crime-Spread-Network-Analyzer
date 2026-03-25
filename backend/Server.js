'use strict';
/**
 * CrimeNet Advanced — Node.js Backend
 * =====================================
 * Express server that bridges frontend ↔ C algorithm engine
 */
const express   = require('express');
const cors      = require('cors');
const { exec, spawn } = require('child_process');
const path      = require('path');
const fs        = require('fs');

const app  = express();
const PORT = process.env.PORT || 3001;
const DIR  = __dirname;
const BIN  = path.join(DIR, process.platform === 'win32' ? 'analyzer.exe' : 'analyzer');
const SRC  = path.join(DIR, 'analyzer.c');

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(DIR, '..', 'frontend')));

/* ── Compile C on startup ─────────────────────────────── */
function compileC() {
  return new Promise((res, rej) => {
    exec(`gcc -O2 -o "${BIN}" "${SRC}" -lm`, (err, _, stderr) => {
      if (err) { console.error('❌ Compile error:\n', stderr); rej(new Error(stderr)); }
      else { console.log('✅ analyzer.c compiled'); res(); }
    });
  });
}

/* ── Build stdin string ───────────────────────────────── */
function buildStdin({ nodes, edges, source = 0 }) {
  const lines = [`${nodes.length} ${edges.length} ${source}`];
  nodes.forEach(n => {
    const name = (n.name || `Zone-${n.id}`).replace(/\s+/g, '_');
    const lat  = (n.lat  || 0).toFixed(6);
    const lng  = (n.lng  || 0).toFixed(6);
    const cr   = Math.max(0, Math.min(10, parseInt(n.crime) || 0));
    lines.push(`${name} ${lat} ${lng} ${cr}`);
  });
  edges.forEach(e => lines.push(`${e.u} ${e.v} ${e.w}`));
  return lines.join('\n') + '\n';
}

/* ── Run analyzer binary ──────────────────────────────── */
function runAnalyzer(stdin) {
  return new Promise((res, rej) => {
    const proc = spawn(BIN, [], { timeout: 20000 });
    let out = '', err = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    proc.on('close', code => {
      if (code !== 0) return rej(new Error(`exit ${code}: ${err}`));
      try { res(JSON.parse(out)); }
      catch (e) { rej(new Error('JSON parse failed: ' + out.slice(0, 200))); }
    });
    proc.on('error', rej);
    proc.stdin.write(stdin);
    proc.stdin.end();
  });
}

let cache = null;

/* ══ API ══════════════════════════════════════════════════ */

/* POST /analyze */
app.post('/analyze', async (req, res) => {
  try {
    const data = req.body;
    if (!data.nodes?.length || data.nodes.length < 2)
      return res.status(400).json({ error: 'Need ≥ 2 nodes' });
    if (data.nodes.length > 60)
      return res.status(400).json({ error: 'Max 60 nodes' });

    const result = await runAnalyzer(buildStdin(data));
    cache = result;
    res.json({ ok: true, result });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  }
});

/* GET /result */
app.get('/result', (_, res) => {
  if (!cache) return res.status(404).json({ error: 'No analysis yet' });
  res.json({ ok: true, result: cache });
});

/* GET /sample/:name */
const SAMPLES = {
  delhi: {
    source: 0,
    nodes: [
      {id:0,name:'Police-HQ',      lat:28.6139,lng:77.2090,crime:0},
      {id:1,name:'Old-Delhi',       lat:28.6469,lng:77.2160,crime:9},
      {id:2,name:'Chandni-Chowk',   lat:28.6506,lng:77.2317,crime:7},
      {id:3,name:'Sadar-Bazar',     lat:28.6575,lng:77.2112,crime:6},
      {id:4,name:'Paharganj',       lat:28.6422,lng:77.2160,crime:8},
      {id:5,name:'Karol-Bagh',      lat:28.6450,lng:77.1896,crime:5},
      {id:6,name:'Lajpat-Nagar',    lat:28.5659,lng:77.2430,crime:4},
      {id:7,name:'Saket',           lat:28.5245,lng:77.2066,crime:3},
      {id:8,name:'Dwarka',          lat:28.5893,lng:77.0500,crime:2},
      {id:9,name:'Rohini',          lat:28.7495,lng:77.0916,crime:6},
    ],
    edges:[
      {u:0,v:1,w:4},{u:0,v:5,w:3},{u:1,v:2,w:2},{u:1,v:4,w:3},
      {u:2,v:3,w:2},{u:3,v:4,w:5},{u:4,v:5,w:4},{u:5,v:6,w:7},
      {u:6,v:7,w:3},{u:0,v:6,w:9},{u:7,v:8,w:5},{u:0,v:9,w:8},
      {u:5,v:9,w:6}
    ]
  },
  mumbai: {
    source: 0,
    nodes: [
      {id:0,name:'Central-PD',  lat:19.0760,lng:72.8777,crime:0},
      {id:1,name:'Dharavi',     lat:19.0406,lng:72.8549,crime:9},
      {id:2,name:'Kurla',       lat:19.0669,lng:72.8799,crime:7},
      {id:3,name:'Bandra',      lat:19.0596,lng:72.8295,crime:5},
      {id:4,name:'Andheri',     lat:19.1136,lng:72.8697,crime:6},
      {id:5,name:'Malad',       lat:19.1866,lng:72.8485,crime:4},
      {id:6,name:'Borivali',    lat:19.2307,lng:72.8567,crime:3},
      {id:7,name:'Colaba',      lat:18.9067,lng:72.8147,crime:8},
      {id:8,name:'Chembur',     lat:19.0626,lng:72.9011,crime:7},
      {id:9,name:'Thane',       lat:19.2183,lng:72.9781,crime:5},
      {id:10,name:'Ghatkopar',  lat:19.0824,lng:72.9075,crime:6},
      {id:11,name:'Vikhroli',   lat:19.1025,lng:72.9242,crime:4},
    ],
    edges:[
      {u:0,v:1,w:3},{u:0,v:7,w:5},{u:1,v:2,w:2},{u:1,v:3,w:4},
      {u:2,v:8,w:2},{u:2,v:10,w:3},{u:3,v:4,w:4},{u:4,v:5,w:3},
      {u:5,v:6,w:2},{u:6,v:9,w:6},{u:8,v:11,w:3},{u:9,v:11,w:4},
      {u:10,v:11,w:2},{u:0,v:4,w:7},{u:3,v:7,w:6}
    ]
  },
  mini: {
    source:0,
    nodes:[
      {id:0,name:'HQ',lat:13.0827,lng:80.2707,crime:0},
      {id:1,name:'Zone-A',lat:13.1000,lng:80.2900,crime:8},
      {id:2,name:'Zone-B',lat:13.0600,lng:80.2500,crime:5},
      {id:3,name:'Zone-C',lat:13.0900,lng:80.2400,crime:3},
    ],
    edges:[{u:0,v:1,w:4},{u:1,v:2,w:2},{u:0,v:3,w:6},{u:2,v:3,w:1}]
  }
};

app.get('/sample/:name', (req, res) => {
  const s = SAMPLES[req.params.name];
  if (!s) return res.status(404).json({ error: 'Unknown sample' });
  res.json(s);
});

app.get('/samples', (_, res) => res.json(Object.keys(SAMPLES)));
app.get('/health',  (_, res) => res.json({ ok: true, bin: BIN }));

/* ── Boot ─────────────────────────────────────────────── */
compileC().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚔 CrimeNet Advanced — http://localhost:${PORT}\n`);
  });
}).catch(e => { console.error(e.message); process.exit(1); });