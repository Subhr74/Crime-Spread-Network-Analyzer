'use strict';
/**
 * CrimeNet India — Node.js Backend
 * Full NCRB 2023 data for all 36 States & UTs
 */
const express = require('express');
const cors    = require('cors');
const { exec, spawn } = require('child_process');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;
const BIN  = path.join(__dirname, process.platform === 'win32' ? 'analyzer.exe' : 'analyzer');
const SRC  = path.join(__dirname, 'analyzer.c');

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

/* ── Compile ── */
function compileC() {
  return new Promise((res, rej) => {
    exec(`gcc -O2 -o "${BIN}" "${SRC}" -lm`, (err, _, stderr) => {
      if (err) { console.error('❌ Compile error:\n', stderr); rej(new Error(stderr)); }
      else { console.log('✅ analyzer.c compiled'); res(); }
    });
  });
}

/* ══════════════════════════════════════════════════════════
   NCRB 2023 — All 36 States & Union Territories
   Fields: id, name, capital, short, lat, lng,
           crimeRate, violent, murder, rape, kidnap,
           robbery, cyber(0-10), corruption(cases), population
══════════════════════════════════════════════════════════ */
const INDIA_STATES = [
  { id:0,  name:'Andhra Pradesh',       capital:'Amaravati',        short:'AP',  lat:15.9129, lng:79.7400, crimeRate:346.3, violent:12.1, murder:1.7, rape:1.6,  kidnap:1.4,  robbery:0.5, cyber:4, corruption:160, population:53903393  },
  { id:1,  name:'Arunachal Pradesh',    capital:'Itanagar',         short:'AR',  lat:28.2180, lng:94.7278, crimeRate:187.9, violent:29.0, murder:3.6, rape:9.3,  kidnap:4.1,  robbery:2.3, cyber:1, corruption:9,   population:1570458   },
  { id:2,  name:'Assam',                capital:'Dispur',           short:'AS',  lat:26.2006, lng:92.9376, crimeRate:181.3, violent:32.2, murder:2.9, rape:5.6,  kidnap:9.9,  robbery:2.1, cyber:3, corruption:110, population:35628379  },
  { id:3,  name:'Bihar',                capital:'Patna',            short:'BR',  lat:25.0961, lng:85.3131, crimeRate:277.5, violent:41.0, murder:2.2, rape:1.5,  kidnap:11.3, robbery:2.0, cyber:6, corruption:40,  population:128500364 },
  { id:4,  name:'Chhattisgarh',         capital:'Raipur',           short:'CG',  lat:21.2787, lng:81.8661, crimeRate:381.2, violent:28.4, murder:3.2, rape:7.8,  kidnap:9.9,  robbery:1.4, cyber:3, corruption:0,   population:32199722  },
  { id:5,  name:'Goa',                  capital:'Panaji',           short:'GA',  lat:15.2993, lng:74.1240, crimeRate:195.4, violent:23.0, murder:1.6, rape:12.4, kidnap:4.9,  robbery:0.7, cyber:3, corruption:0,   population:1586250   },
  { id:6,  name:'Gujarat',              capital:'Gandhinagar',      short:'GJ',  lat:22.2587, lng:71.1924, crimeRate:806.3, violent:12.5, murder:1.3, rape:1.9,  kidnap:2.5,  robbery:1.0, cyber:5, corruption:205, population:63872399  },
  { id:7,  name:'Haryana',              capital:'Chandigarh',       short:'HR',  lat:29.0588, lng:76.0856, crimeRate:739.2, violent:48.6, murder:3.4, rape:12.4, kidnap:13.7, robbery:2.5, cyber:7, corruption:205, population:28204692  },
  { id:8,  name:'Himachal Pradesh',     capital:'Shimla',           short:'HP',  lat:31.1048, lng:77.1734, crimeRate:267.2, violent:25.0, murder:1.2, rape:9.3,  kidnap:5.9,  robbery:0.1, cyber:2, corruption:73,  population:7451955   },
  { id:9,  name:'Jharkhand',            capital:'Ranchi',           short:'JH',  lat:23.6102, lng:85.2799, crimeRate:161.1, violent:31.2, murder:3.7, rape:6.3,  kidnap:4.2,  robbery:1.5, cyber:3, corruption:55,  population:38593948  },
  { id:10, name:'Karnataka',            capital:'Bengaluru',        short:'KA',  lat:15.3173, lng:75.7139, crimeRate:315.8, violent:26.4, murder:1.9, rape:2.0,  kidnap:5.5,  robbery:3.0, cyber:8, corruption:362, population:67562686  },
  { id:11, name:'Kerala',               capital:'Thiruvananthapuram',short:'KL', lat:10.8505, lng:76.2711, crimeRate:1631.2,violent:28.6, murder:1.0, rape:4.5,  kidnap:0.9,  robbery:0.7, cyber:5, corruption:131, population:35699443  },
  { id:12, name:'Madhya Pradesh',       capital:'Bhopal',           short:'MP',  lat:22.9734, lng:78.6569, crimeRate:332.3, violent:37.5, murder:2.6, rape:9.1,  kidnap:8.6,  robbery:1.3, cyber:4, corruption:0,   population:85358965  },
  { id:13, name:'Maharashtra',          capital:'Mumbai',           short:'MH',  lat:19.7515, lng:75.7139, crimeRate:325.2, violent:33.4, murder:1.5, rape:3.2,  kidnap:3.4,  robbery:1.4, cyber:7, corruption:264, population:123144223 },
  { id:14, name:'Manipur',              capital:'Imphal',           short:'MN',  lat:24.6637, lng:93.9063, crimeRate:185.7, violent:34.8, murder:4.4, rape:3.8,  kidnap:5.1,  robbery:1.8, cyber:1, corruption:0,   population:3091545   },
  { id:15, name:'Meghalaya',            capital:'Shillong',         short:'ML',  lat:25.4670, lng:91.3662, crimeRate:199.8, violent:26.0, murder:2.4, rape:5.5,  kidnap:3.2,  robbery:1.2, cyber:1, corruption:8,   population:3366710   },
  { id:16, name:'Mizoram',              capital:'Aizawl',           short:'MZ',  lat:23.1645, lng:92.9376, crimeRate:423.3, violent:22.0, murder:3.7, rape:5.3,  kidnap:1.5,  robbery:0.4, cyber:2, corruption:1,   population:1239244   },
  { id:17, name:'Nagaland',             capital:'Kohima',           short:'NL',  lat:26.1584, lng:94.5624, crimeRate:77.2,  violent:18.5, murder:3.1, rape:1.8,  kidnap:2.2,  robbery:0.6, cyber:1, corruption:7,   population:2249695   },
  { id:18, name:'Odisha',               capital:'Bhubaneswar',      short:'OD',  lat:20.9517, lng:85.0985, crimeRate:325.8, violent:35.0, murder:2.9, rape:7.5,  kidnap:5.5,  robbery:1.2, cyber:3, corruption:73,  population:46356334  },
  { id:19, name:'Punjab',               capital:'Chandigarh',       short:'PB',  lat:31.1471, lng:75.3412, crimeRate:513.3, violent:23.3, murder:2.4, rape:5.1,  kidnap:3.1,  robbery:1.1, cyber:4, corruption:125, population:30141373  },
  { id:20, name:'Rajasthan',            capital:'Jaipur',           short:'RJ',  lat:27.0238, lng:74.2179, crimeRate:442.4, violent:24.8, murder:2.4, rape:9.4,  kidnap:7.8,  robbery:0.7, cyber:5, corruption:311, population:81032689  },
  { id:21, name:'Sikkim',               capital:'Gangtok',          short:'SK',  lat:27.5330, lng:88.5122, crimeRate:274.5, violent:18.2, murder:2.5, rape:6.8,  kidnap:2.1,  robbery:0.3, cyber:1, corruption:0,   population:690251    },
  { id:22, name:'Tamil Nadu',           capital:'Chennai',          short:'TN',  lat:11.1271, lng:78.6569, crimeRate:270.5, violent:22.5, murder:1.7, rape:2.1,  kidnap:2.3,  robbery:1.7, cyber:6, corruption:73,  population:77841267  },
  { id:23, name:'Telangana',            capital:'Hyderabad',        short:'TS',  lat:17.1231, lng:79.2088, crimeRate:374.8, violent:21.3, murder:2.2, rape:2.8,  kidnap:2.6,  robbery:1.5, cyber:9, corruption:133, population:38525450  },
  { id:24, name:'Tripura',              capital:'Agartala',         short:'TR',  lat:23.9408, lng:91.9882, crimeRate:584.1, violent:38.5, murder:3.4, rape:9.4,  kidnap:5.7,  robbery:0.8, cyber:2, corruption:0,   population:4169794   },
  { id:25, name:'Uttar Pradesh',        capital:'Lucknow',          short:'UP',  lat:26.8467, lng:80.9462, crimeRate:367.2, violent:28.0, murder:2.0, rape:3.2,  kidnap:12.4, robbery:1.4, cyber:7, corruption:123, population:237882725 },
  { id:26, name:'Uttarakhand',          capital:'Dehradun',         short:'UK',  lat:30.0668, lng:79.0193, crimeRate:412.6, violent:26.8, murder:1.8, rape:9.5,  kidnap:6.4,  robbery:0.6, cyber:3, corruption:32,  population:11250858  },
  { id:27, name:'West Bengal',          capital:'Kolkata',          short:'WB',  lat:22.9868, lng:87.8550, crimeRate:245.8, violent:34.2, murder:1.8, rape:2.5,  kidnap:4.6,  robbery:0.9, cyber:5, corruption:62,  population:99609303  },
  { id:28, name:'Andaman and Nicobar',  capital:'Port Blair',       short:'AN',  lat:11.7401, lng:92.6586, crimeRate:274.4, violent:18.0, murder:1.5, rape:6.2,  kidnap:1.8,  robbery:0.2, cyber:1, corruption:2,   population:417071    },
  { id:29, name:'Chandigarh',           capital:'Chandigarh',       short:'CH',  lat:30.7333, lng:76.7794, crimeRate:548.9, violent:32.0, murder:2.1, rape:8.4,  kidnap:7.2,  robbery:1.8, cyber:4, corruption:6,   population:1158473   },
  { id:30, name:'Dadra and NH',         capital:'Daman',            short:'DN',  lat:20.1809, lng:73.0169, crimeRate:386.2, violent:12.4, murder:0.8, rape:1.9,  kidnap:1.4,  robbery:0.3, cyber:2, corruption:0,   population:615724    },
  { id:31, name:'Delhi',                capital:'New Delhi',        short:'DL',  lat:28.7041, lng:77.1025, crimeRate:1588.3,violent:45.2, murder:2.0, rape:14.3, kidnap:18.5, robbery:4.2, cyber:8, corruption:0,   population:32941000  },
  { id:32, name:'Jammu and Kashmir',    capital:'Srinagar',         short:'JK',  lat:34.0837, lng:74.7973, crimeRate:167.4, violent:16.2, murder:2.0, rape:4.2,  kidnap:3.5,  robbery:0.5, cyber:3, corruption:39,  population:13617050  },
  { id:33, name:'Ladakh',               capital:'Leh',              short:'LA',  lat:34.1526, lng:77.5770, crimeRate:110.3, violent:12.0, murder:1.2, rape:2.1,  kidnap:1.1,  robbery:0.1, cyber:1, corruption:0,   population:274289    },
  { id:34, name:'Lakshadweep',          capital:'Kavaratti',        short:'LK',  lat:10.5667, lng:72.6417, crimeRate:42.1,  violent:5.0,  murder:0.0, rape:1.2,  kidnap:0.3,  robbery:0.0, cyber:0, corruption:0,   population:73183     },
  { id:35, name:'Puducherry',           capital:'Puducherry',       short:'PY',  lat:11.9416, lng:79.8083, crimeRate:384.3, violent:20.5, murder:2.1, rape:4.8,  kidnap:3.1,  robbery:1.1, cyber:3, corruption:5,   population:1413542   },
];

/* Geographic adjacency edges (border-sharing states, weighted by crime corridor strength) */
const INDIA_EDGES = [
  {u:0,v:12,w:4},{u:0,v:13,w:5},{u:0,v:23,w:3},{u:0,v:18,w:6},
  {u:1,v:2,w:6},{u:1,v:14,w:7},{u:1,v:17,w:5},
  {u:2,v:3,w:8},{u:2,v:9,w:7},{u:2,v:14,w:5},{u:2,v:15,w:4},{u:2,v:27,w:6},{u:2,v:16,w:5},
  {u:3,v:9,w:5},{u:3,v:12,w:6},{u:3,v:25,w:4},{u:3,v:27,w:5},{u:3,v:21,w:7},
  {u:4,v:12,w:3},{u:4,v:13,w:5},{u:4,v:9,w:6},{u:4,v:25,w:7},{u:4,v:18,w:5},
  {u:5,v:13,w:4},
  {u:6,v:12,w:5},{u:6,v:19,w:4},{u:6,v:20,w:3},{u:6,v:13,w:4},{u:6,v:30,w:6},
  {u:7,v:19,w:3},{u:7,v:25,w:4},{u:7,v:8,w:6},{u:7,v:31,w:2},{u:7,v:20,w:5},{u:7,v:29,w:3},
  {u:8,v:19,w:4},{u:8,v:32,w:5},{u:8,v:26,w:3},{u:8,v:33,w:6},
  {u:9,v:12,w:4},{u:9,v:25,w:6},{u:9,v:27,w:7},{u:9,v:18,w:5},
  {u:10,v:13,w:4},{u:10,v:22,w:3},{u:10,v:23,w:2},{u:10,v:18,w:7},
  {u:11,v:13,w:5},{u:11,v:22,w:4},
  {u:12,v:13,w:4},{u:12,v:25,w:5},{u:12,v:20,w:4},{u:12,v:18,w:5},
  {u:13,v:22,w:5},{u:13,v:18,w:6},{u:13,v:20,w:7},
  {u:14,v:15,w:4},{u:14,v:16,w:5},{u:14,v:17,w:4},
  {u:15,v:16,w:3},{u:15,v:17,w:4},{u:15,v:24,w:5},
  {u:16,v:24,w:4},
  {u:18,v:27,w:4},
  {u:19,v:20,w:5},{u:19,v:29,w:3},
  {u:20,v:25,w:4},{u:20,v:26,w:6},
  {u:21,v:27,w:4},
  {u:22,v:35,w:3},{u:22,v:11,w:4},
  {u:24,v:27,w:3},
  {u:25,v:26,w:4},{u:25,v:27,w:6},{u:25,v:31,w:3},
  {u:26,v:8,w:4},{u:26,v:32,w:6},
  {u:27,v:9,w:6},
  {u:31,v:29,w:3},{u:32,v:33,w:4},
];

/* ── Build stdin for C engine ── */
function buildStdin(states, edges, source) {
  const lines = [`${states.length} ${edges.length} ${source}`];
  states.forEach(s => {
    const n = s.name.replace(/\s+/g,'_');
    const c = s.capital.replace(/\s+/g,'_');
    lines.push(`${n} ${c} ${s.short} ${s.lat.toFixed(6)} ${s.lng.toFixed(6)} ${s.crimeRate.toFixed(1)} ${s.violent.toFixed(1)} ${s.murder.toFixed(1)} ${s.rape.toFixed(1)} ${s.kidnap.toFixed(1)} ${s.robbery.toFixed(1)} ${s.cyber} ${s.corruption} ${s.population}`);
  });
  edges.forEach(e => lines.push(`${e.u} ${e.v} ${e.w}`));
  return lines.join('\n') + '\n';
}

/* ── Run analyzer ── */
function runAnalyzer(stdin) {
  return new Promise((res, rej) => {
    const proc = spawn(BIN, [], { timeout: 30000 });
    let out = '', err = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    proc.on('close', code => {
      if (code !== 0) return rej(new Error(`exit ${code}: ${err}`));
      try { res(JSON.parse(out)); }
      catch (e) { rej(new Error('JSON parse failed: ' + out.slice(0, 300))); }
    });
    proc.on('error', rej);
    proc.stdin.write(stdin); proc.stdin.end();
  });
}

let cache = null;

/* ══ API ═══════════════════════════════════════════════════ */
app.post('/analyze', async (req, res) => {
  try {
    const { source = 31 } = req.body; // default Delhi
    const stdin = buildStdin(INDIA_STATES, INDIA_EDGES, source);
    const result = await runAnalyzer(stdin);
    cache = result;
    res.json({ ok: true, result });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/result', (_, res) => {
  if (!cache) return res.status(404).json({ error: 'No analysis yet' });
  res.json({ ok: true, result: cache });
});

app.get('/states', (_, res) => res.json(INDIA_STATES));
app.get('/edges',  (_, res) => res.json(INDIA_EDGES));

app.get('/analyze/:source', async (req, res) => {
  try {
    const source = parseInt(req.params.source) || 31;
    const stdin = buildStdin(INDIA_STATES, INDIA_EDGES, source);
    const result = await runAnalyzer(stdin);
    cache = result;
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true, states: INDIA_STATES.length, edges: INDIA_EDGES.length }));

compileC().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🛡  CrimeNet India — NCRB 2023`);
    console.log(`   ${INDIA_STATES.length} States & UTs · ${INDIA_EDGES.length} Edges`);
    console.log(`   http://localhost:${PORT}\n`);
  });
}).catch(e => { console.error(e.message); process.exit(1); });