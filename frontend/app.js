/**
 * CrimeNet Advanced — Frontend Engine
 * =====================================
 * • Communicates with Node.js/C backend for real DAA results
 * • Falls back to built-in JS algorithms when offline
 * • Leaflet geo map with advanced overlays
 * • Chart.js analytics dashboard
 * • Step-by-step BFS spread simulation
 */
'use strict';

const API = 'http://localhost:3001';
const INF = 999999999;

/* ══ State ═════════════════════════════════════════════════ */
let G   = { nodes:[], edges:[], source:0 };
let R   = null;   // analysis result
let nc  = 0, ec = 0;
let map, layerEdges, layerNodes, layerAlgo, layerHeat;
let charts = {};
let simInterval = null, simMaxStep = 0;

/* ══ Server health ════════════════════════════════════════ */
async function ping() {
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) { dot(true); return true; }
  } catch {}
  dot(false); return false;
}
function dot(ok) {
  const d = document.getElementById('srv-dot');
  const l = document.getElementById('srv-lbl');
  d.className = 'server-dot' + (ok ? '' : ' offline');
  l.textContent = ok ? 'Engine Online' : 'Offline (JS mode)';
}

/* ══ Graph Management ══════════════════════════════════════ */
function addZone(name='', lat=0, lng=0, crime=0) {
  const id = nc++;
  G.nodes.push({ id, name: name || 'Zone-'+id, lat: +lat||0, lng: +lng||0, crime: +crime||0 });
  renderZones(); updateSelects(); updateKPIs(); refreshMap();
}
function removeZone(id) {
  G.nodes = G.nodes.filter(n => n.id !== id);
  G.edges = G.edges.filter(e => e.u !== id && e.v !== id);
  renderZones(); renderEdges(); updateSelects(); updateKPIs(); refreshMap();
}
function addEdge(u='', v='', w=1) {
  G.edges.push({ id: ec++, u: +u||0, v: +v||0, w: +w||1 });
  renderEdges(); updateKPIs(); refreshMap();
}
function removeEdge(id) {
  G.edges = G.edges.filter(e => e.id !== id);
  renderEdges(); updateKPIs(); refreshMap();
}

function loadSample(name) {
  fetch(`${API}/sample/${name}`)
    .then(r => r.json())
    .then(applyData)
    .catch(() => {
      const s = FALLBACK[name];
      if (s) applyData(s); else toast('Unknown sample','err');
    });
}

function applyData(data) {
  G.nodes = data.nodes.map(n => ({...n}));
  G.edges = data.edges.map((e,i) => ({...e, id:i}));
  G.source = data.source || 0;
  nc = G.nodes.length; ec = G.edges.length;
  renderZones(); renderEdges(); updateSelects();
  document.getElementById('src-sel').value = G.source;
  updateKPIs(); refreshMap();
  toast('Dataset loaded — ' + G.nodes.length + ' zones, ' + G.edges.length + ' edges', 'ok');
}

/* ── Render sidebar lists ─ */
function renderZones() {
  const c = document.getElementById('zones-list');
  c.innerHTML = '';
  G.nodes.forEach(n => {
    const d = document.createElement('div');
    d.className = 'input-item';
    d.style.gridTemplateColumns = '1fr 60px 55px 55px 24px';
    d.innerHTML = `
      <input value="${n.name}" placeholder="Name" oninput="nodeField(${n.id},'name',this.value)">
      <input type="number" value="${n.lat||''}" step="0.001" placeholder="Lat" oninput="nodeField(${n.id},'lat',+this.value)">
      <input type="number" value="${n.lng||''}" step="0.001" placeholder="Lng" oninput="nodeField(${n.id},'lng',+this.value)">
      <input type="number" value="${n.crime}" min="0" max="10" placeholder="0-10" oninput="nodeField(${n.id},'crime',+this.value)">
      <button class="del-btn" onclick="removeZone(${n.id})">✕</button>`;
    c.appendChild(d);
  });
}
function nodeField(id, key, val) {
  const n = G.nodes.find(x => x.id === id);
  if (n) { n[key] = val; if (key === 'name') updateSelects(); if (key !== 'name') refreshMap(); updateKPIs(); }
}

function renderEdges() {
  const c = document.getElementById('edges-list');
  c.innerHTML = '';
  G.edges.forEach(e => {
    const d = document.createElement('div');
    d.className = 'input-item';
    d.style.gridTemplateColumns = '1fr 1fr 50px 24px';
    d.innerHTML = `
      <input type="number" value="${e.u}" min="0" placeholder="From" oninput="edgeField(${e.id},'u',+this.value)">
      <input type="number" value="${e.v}" min="0" placeholder="To"   oninput="edgeField(${e.id},'v',+this.value)">
      <input type="number" value="${e.w}" min="1" placeholder="Wt"   oninput="edgeField(${e.id},'w',+this.value)">
      <button class="del-btn" onclick="removeEdge(${e.id})">✕</button>`;
    c.appendChild(d);
  });
}
function edgeField(id, key, val) {
  const e = G.edges.find(x => x.id === id);
  if (e) { e[key] = val; refreshMap(); }
}

function updateSelects() {
  const opts = G.nodes.map(n => `<option value="${n.id}">${n.id}: ${n.name}</option>`).join('');
  ['src-sel','dest-sel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { const v = el.value; el.innerHTML = opts; el.value = v; }
  });
}
function updateKPIs() {
  document.getElementById('kpi-n').textContent = G.nodes.length;
  document.getElementById('kpi-e').textContent = G.edges.length;
  document.getElementById('kpi-r').textContent = G.nodes.filter(n => n.crime >= 8).length;
}

/* ══ MAP ════════════════════════════════════════════════════ */
function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  layerEdges = L.layerGroup().addTo(map);
  layerNodes = L.layerGroup().addTo(map);
  layerAlgo  = L.layerGroup().addTo(map);
  layerHeat  = L.layerGroup().addTo(map);
  map.setView([20.5937, 78.9629], 5);
}

function crimeColor(c) {
  if (c >= 9) return '#ff2442';
  if (c >= 7) return '#ff7e2e';
  if (c >= 4) return '#f0b429';
  return '#1edb8a';
}

function refreshMap() {
  layerEdges.clearLayers();
  layerNodes.clearLayers();
  layerAlgo.clearLayers();
  layerHeat.clearLayers();
  const valid = G.nodes.filter(n => n.lat && n.lng);
  if (!valid.length) return;

  /* Edges */
  G.edges.forEach(e => {
    const a = G.nodes.find(n => n.id === e.u), b = G.nodes.find(n => n.id === e.v);
    if (!a || !b || !a.lat || !b.lat) return;
    L.polyline([[a.lat, a.lng],[b.lat, b.lng]], {
      color:'#1e3d5e', weight:2, opacity:0.9
    }).addTo(layerEdges);
    /* Weight label */
    L.marker([(a.lat+b.lat)/2, (a.lng+b.lng)/2], {
      icon: L.divIcon({ html:`<div style="background:rgba(6,13,21,.9);border:1px solid #162c45;border-radius:2px;padding:1px 5px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#3a6a96;white-space:nowrap">${e.w}</div>`, className:'', iconAnchor:[14,8] })
    }).addTo(layerEdges);
  });

  /* Nodes */
  const src = +document.getElementById('src-sel').value;
  valid.forEach(n => {
    const col = crimeColor(n.crime);
    const isHQ = n.id === src;
    const r = 12 + n.crime * 1.4;
    const icon = L.divIcon({
      html: `
        <div style="position:relative;width:${r*2}px;height:${r*2}px">
          <div style="position:absolute;inset:0;border-radius:50%;background:${col}18;border:1.5px solid ${col};box-shadow:0 0 ${8+n.crime*2}px ${col}55;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:${isHQ?11:9+n.crime*0.3}px;font-weight:600;color:${col}">${isHQ?'HQ':n.crime}</span>
          </div>
          ${n.crime >= 8 ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:1px solid ${col}44;animation:pulse-ring 1.8s ease-out infinite"></div>` : ''}
        </div>`,
      className: '', iconAnchor: [r, r]
    });
    const mk = L.marker([n.lat, n.lng], { icon }).addTo(layerNodes);
    mk.bindPopup(popupHTML(n, src));
  });

  /* Fit */
  if (valid.length > 1) {
    try { map.fitBounds(valid.map(n => [n.lat, n.lng]), { padding: [40, 60] }); }
    catch {}
  } else if (valid.length === 1) {
    map.setView([valid[0].lat, valid[0].lng], 13);
  }
}

function popupHTML(n, src) {
  const c = crimeColor(n.crime);
  const risk = n.crime>=9?'CRITICAL':n.crime>=7?'HIGH':n.crime>=4?'MEDIUM':'LOW';
  const riskC = n.crime>=9?'#ff2442':n.crime>=7?'#ff7e2e':n.crime>=4?'#f0b429':'#1edb8a';
  return `<div style="min-width:190px">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;letter-spacing:.06em;color:${c};margin-bottom:8px">${n.name}</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
      <span style="color:#3a6a96">Zone ID</span><span style="color:#cce0f5">${n.id}${n.id===src?' 🏛 HQ':''}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
      <span style="color:#3a6a96">Crime Level</span><span style="color:${c};font-weight:600">${n.crime}/10</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px">
      <span style="color:#3a6a96">Risk Status</span><span style="color:${riskC};font-weight:600">${risk}</span>
    </div>
    <div style="height:4px;border-radius:2px;background:#162c45;margin-bottom:6px">
      <div style="height:100%;width:${n.crime*10}%;background:${c};border-radius:2px;transition:width .3s"></div>
    </div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#1e3d5e">${n.lat.toFixed(4)}, ${n.lng.toFixed(4)}</div>
  </div>`;
}

/* ── Map overlay modes ─ */
function mapMode(mode, btn) {
  document.querySelectorAll('.mc-btn').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  if (!R) { toast('Run analysis first','err'); return; }

  layerAlgo.clearLayers(); layerHeat.clearLayers();
  hideAlgoLegend();

  if (mode === 'bfs')      drawBFSOverlay();
  else if (mode === 'dijkstra') drawDijkOverlay();
  else if (mode === 'mst')     drawMSTOverlay();
  else if (mode === 'heat')    drawHeatOverlay();
}

function clearAlgoLayers() {
  layerAlgo.clearLayers(); layerHeat.clearLayers();
  document.querySelectorAll('.mc-btn').forEach(b => b.classList.remove('active'));
  hideAlgoLegend();
  document.getElementById('algo-info').style.display = 'none';
}

function drawBFSOverlay() {
  if (!R?.bfs) return;
  const { dist, parent } = R.bfs;
  showAlgoInfo('BFS SPREAD', `Source: ${G.nodes[R.bfs.src]?.name||R.bfs.src}`, `Zones reached: ${dist.filter(d=>d>=0).length}`, `Max depth: ${Math.max(...dist.filter(d=>d>=0))}`);
  showAlgoLegend('BFS Wave Layers', `
    <div class="legend-row"><div class="legend-swatch" style="background:#1edb8a;opacity:.8"></div>Hop 0 (source)</div>
    <div class="legend-row"><div class="legend-swatch" style="background:#00c9d4;opacity:.8"></div>Hop 1</div>
    <div class="legend-row"><div class="legend-swatch" style="background:#f0b429;opacity:.8"></div>Hop 2</div>
    <div class="legend-row"><div class="legend-swatch" style="background:#ff2442;opacity:.8"></div>Hop 3+</div>
    <div class="legend-row" style="margin-top:4px;border-top:1px solid #162c45;padding-top:4px"><span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#3a6a96">Dashed = BFS tree edges</span></div>`);

  G.nodes.forEach((n, i) => {
    if (!n.lat || dist[i] < 0) return;
    const d = dist[i];
    const col = d===0?'#1edb8a':d===1?'#00c9d4':d===2?'#f0b429':'#ff2442';
    L.circle([n.lat,n.lng], { radius:(16+d*14)*150, color:col, fillColor:col, fillOpacity:.12, weight:1.5, opacity:.6 }).addTo(layerAlgo);
    /* BFS tree edges */
    const par = parent[i];
    if (par >= 0) {
      const p = G.nodes[par];
      if (p?.lat) L.polyline([[p.lat,p.lng],[n.lat,n.lng]], { color:col, weight:2.5, opacity:.7, dashArray:'5 4' }).addTo(layerAlgo);
    }
  });
}

function drawDijkOverlay() {
  if (!R?.dijkstra) return;
  const { dist, prev } = R.dijkstra;
  const reachable = dist.filter(d => d >= 0 && d < INF).length;
  showAlgoInfo('DIJKSTRA', `From: ${G.nodes[R.dijkstra.src]?.name}`, `Reachable: ${reachable} zones`, `Avg dist: ${(dist.filter(d=>d>=0&&d<INF).reduce((a,b)=>a+b,0)/reachable).toFixed(1)}`);
  showAlgoLegend('Shortest Paths',`<div class="legend-row"><div class="legend-swatch" style="background:var(--cyan)"></div>Police route</div><div class="legend-row"><div class="legend-swatch" style="background:var(--green)"></div>Source HQ</div>`);

  G.nodes.forEach((n, i) => {
    if (!n.lat || dist[i] <= 0 || dist[i] >= INF) return;
    const path = buildPath(prev, i);
    for (let j = 0; j < path.length - 1; j++) {
      const a = G.nodes[path[j]], b = G.nodes[path[j+1]];
      if (!a?.lat || !b?.lat) continue;
      L.polyline([[a.lat,a.lng],[b.lat,b.lng]], { color:'#00b8f5', weight:3, opacity:.8 }).addTo(layerAlgo);
    }
    L.circleMarker([n.lat,n.lng], { radius:7, color:'#00b8f5', fillColor:'#00b8f5', fillOpacity:.35, weight:2 }).addTo(layerAlgo);
  });
}

function drawMSTOverlay() {
  if (!R?.mst) return;
  showAlgoInfo('KRUSKAL MST', `Total weight: ${R.mst.totalW}`, `Edges: ${R.mst.edges.length}`, `Cost saved: ${R.mst.totalAll - R.mst.totalW}`);
  showAlgoLegend('MST Patrol Network',`<div class="legend-row"><div class="legend-swatch" style="background:var(--amber)"></div>MST edge</div><div class="legend-row" style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--t4);margin-top:3px">Minimum cost patrol coverage</div>`);

  R.mst.edges.forEach(e => {
    const a = G.nodes.find(n=>n.id===e.u), b = G.nodes.find(n=>n.id===e.v);
    if (!a?.lat || !b?.lat) return;
    L.polyline([[a.lat,a.lng],[b.lat,b.lng]], { color:'#f0b429', weight:4, opacity:.9 }).addTo(layerAlgo);
    const mid = [(a.lat+b.lat)/2, (a.lng+b.lng)/2];
    L.marker(mid, { icon: L.divIcon({ html:`<div style="background:rgba(6,13,21,.92);border:1px solid #f0b429;border-radius:2px;padding:1px 6px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#f0b429;white-space:nowrap">${e.w}</div>`, className:'', iconAnchor:[16,8] }) }).addTo(layerAlgo);
  });
}

function drawHeatOverlay() {
  showAlgoLegend('Crime Heatmap',`<div class="legend-row"><div class="legend-swatch" style="background:var(--red);opacity:.7"></div>Very high crime</div><div class="legend-row"><div class="legend-swatch" style="background:var(--amber);opacity:.7"></div>Medium crime</div>`);
  G.nodes.filter(n=>n.lat).forEach(n => {
    const col = crimeColor(n.crime);
    const r = (n.crime + 1) * 0.006;
    for (let i = 3; i >= 1; i--) {
      L.circle([n.lat,n.lng], { radius:r*i*90000, color:col, fillColor:col, fillOpacity:.06/i, weight:0 }).addTo(layerHeat);
    }
    L.circle([n.lat,n.lng], { radius:r*40000, color:col, fillColor:col, fillOpacity:.25, weight:1, opacity:.6 }).addTo(layerHeat);
  });
}

function showAlgoInfo(name, l1, l2, l3) {
  document.getElementById('algo-info').style.display = 'block';
  document.getElementById('ai-name').textContent = name;
  document.getElementById('ai-line1').innerHTML = l1;
  document.getElementById('ai-line2').innerHTML = l2;
  document.getElementById('ai-line3').innerHTML = l3;
}
function showAlgoLegend(title, html) {
  document.getElementById('algo-map-legend').style.display = 'block';
  document.getElementById('aml-title').textContent = title;
  document.getElementById('aml-body').innerHTML = html;
}
function hideAlgoLegend() { document.getElementById('algo-map-legend').style.display = 'none'; }

/* ══ Run Algorithms ═════════════════════════════════════════ */
async function runAll() {
  if (G.nodes.length < 2) { toast('Add at least 2 zones','err'); return; }
  if (!G.edges.length)    { toast('Add at least 1 edge','err'); return; }

  const btn = document.getElementById('run-all-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analyzing…';
  document.querySelectorAll('.algo-card').forEach(c => { c.classList.remove('done'); c.classList.add('running'); });

  const payload = { nodes: G.nodes, edges: G.edges.map(e=>({u:e.u,v:e.v,w:e.w})), source: +document.getElementById('src-sel').value };

  try {
    const resp = await fetch(`${API}/analyze`, {
      method: 'POST', headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error);
    R = json.result;
  } catch {
    /* Fallback: run JS algorithms */
    R = runJSAlgos(payload);
  }

  document.querySelectorAll('.algo-card').forEach(c => { c.classList.remove('running'); c.classList.add('done'); });
  btn.disabled = false; btn.innerHTML = '<span>⚡</span> Run Full Analysis';

  renderAllResults();
  toast('Analysis complete — ' + G.nodes.length + ' zones analyzed','ok');
}

async function runSingle(algo) {
  if (G.nodes.length < 2) { toast('Add at least 2 zones','err'); return; }
  const card = document.getElementById(`ac-${algo==='dijkstra'?'dijk':algo==='floyd'?'fw':algo}`);
  if (card) { card.classList.add('running'); }

  await runAll(); // simplest: always run all
  if (card) { card.classList.remove('running'); }

  const paneMap = { bfs:'spread', dfs:'spread', dijkstra:'paths', floyd:'matrix', mst:'mst' };
  const tab = document.querySelector(`[onclick="switchPane('${paneMap[algo]||algo}',this)"]`);
  if (tab) switchPane(paneMap[algo]||algo, tab);
}

/* ── Pure JS fallback algorithms ─ */
function runJSAlgos(data) {
  const { nodes, edges, source } = data;
  const n = nodes.length;
  const idMap = {}; nodes.forEach((nd, i) => idMap[nd.id] = i);

  /* Build adjacency */
  const adj = nodes.map(() => []);
  const mat = Array.from({length:n}, (_,i) => Array.from({length:n}, (_,j) => i===j?0:INF));
  edges.forEach(e => {
    const a = idMap[e.u], b = idMap[e.v];
    if (a===undefined || b===undefined) return;
    adj[a].push({to:b, w:e.w}); adj[b].push({to:a, w:e.w});
    mat[a][b] = Math.min(mat[a][b], e.w);
    mat[b][a] = Math.min(mat[b][a], e.w);
  });
  const si = idMap[source] ?? 0;

  /* BFS */
  const bfsDist = new Array(n).fill(-1), bfsPar = new Array(n).fill(-1);
  const bfsOrder = [];
  bfsDist[si] = 0;
  const q = [si];
  while (q.length) {
    const u = q.shift(); bfsOrder.push(nodes[u].id);
    adj[u].forEach(({to}) => { if (bfsDist[to] < 0) { bfsDist[to] = bfsDist[u]+1; bfsPar[to] = nodes[u].id; q.push(to); } });
  }

  /* DFS */
  const dfsOrder = [], dfsDepth = new Array(n).fill(-1), dfsVis = new Array(n).fill(false);
  function dfsRec(u, d) { dfsVis[u]=true; dfsOrder.push(nodes[u].id); dfsDepth[u]=d; adj[u].forEach(({to})=>{ if(!dfsVis[to]) dfsRec(to,d+1); }); }
  dfsRec(si, 0);

  /* Dijkstra */
  const dkDist = new Array(n).fill(INF), dkPrev = new Array(n).fill(-1), dkVis = new Array(n).fill(false);
  dkDist[si] = 0;
  for (let c = 0; c < n-1; c++) {
    let u = -1;
    for (let v = 0; v < n; v++) if (!dkVis[v] && (u<0 || dkDist[v] < dkDist[u])) u = v;
    if (u < 0 || dkDist[u] === INF) break;
    dkVis[u] = true;
    for (let v = 0; v < n; v++) {
      if (!dkVis[v] && mat[u][v] < INF && dkDist[u]+mat[u][v] < dkDist[v]) {
        dkDist[v] = dkDist[u]+mat[u][v]; dkPrev[v] = nodes[u].id;
      }
    }
  }

  /* Floyd */
  const FW = mat.map(r => [...r]);
  for (let k=0;k<n;k++) for (let i=0;i<n;i++) for (let j=0;j<n;j++)
    if (FW[i][k]<INF && FW[k][j]<INF && FW[i][k]+FW[k][j]<FW[i][j]) FW[i][j]=FW[i][k]+FW[k][j];

  /* Kruskal */
  const par2 = nodes.map((_,i)=>i), rnk2 = new Array(n).fill(0);
  function find2(x){if(par2[x]!==x)par2[x]=find2(par2[x]);return par2[x];}
  function unite2(a,b){const ra=find2(a),rb=find2(b);if(ra===rb)return false;if(rnk2[ra]<rnk2[rb])par2[ra]=rb;else if(rnk2[ra]>rnk2[rb])par2[rb]=ra;else{par2[rb]=ra;rnk2[ra]++;}return true;}
  const sortedE = [...edges].sort((a,b)=>a.w-b.w);
  const mstEdges = [], totalAll = edges.reduce((s,e)=>s+e.w,0);
  let totalW = 0;
  sortedE.forEach(e => {
    const a=idMap[e.u],b=idMap[e.v];
    if (a!==undefined&&b!==undefined&&unite2(a,b)) { mstEdges.push(e); totalW+=e.w; }
  });

  /* Betweenness (simplified) */
  const btw = new Array(n).fill(0);
  nodes.forEach((_, s) => {
    const cnt = new Array(n).fill(0), d2 = new Array(n).fill(-1), stk = [];
    const pred = nodes.map(()=>[]);
    cnt[s]=1; d2[s]=0; const q2=[s];
    while (q2.length) {
      const u=q2.shift(); stk.push(u);
      adj[u].forEach(({to:v})=>{
        if (d2[v]<0){d2[v]=d2[u]+1;q2.push(v);}
        if (d2[v]===d2[u]+1){cnt[v]+=cnt[u];pred[v].push(u);}
      });
    }
    const dep = new Array(n).fill(0);
    while (stk.length) {
      const v=stk.pop();
      pred[v].forEach(u=>{dep[u]+=(cnt[u]/cnt[v])*(1+dep[v]);});
      if (v!==s) btw[v]+=dep[v];
    }
  });

  /* Degree */
  const deg = adj.map(a=>a.length);

  return {
    nodes: nodes.map((nd,i)=>({...nd, degree:deg[i], betweenness:+(btw[i].toFixed(4))})),
    edges: edges.map(e=>({u:e.u,v:e.v,w:e.w})),
    bfs: { src:source, order:bfsOrder, dist:bfsDist.map((d,i)=>d), parent:bfsPar },
    dfs: { src:source, order:dfsOrder, depth:dfsDepth },
    dijkstra: { src:source, dist:dkDist.map(d=>d>=INF?-1:d), prev:dkPrev },
    floyd: FW.slice(0,Math.min(n,10)).map(r=>r.map(v=>v>=INF?-1:v)),
    mst: { totalW, totalAll, edges:mstEdges }
  };
}

function buildPath(prev, dest) {
  const path = [];
  for (let v = dest; v !== -1; v = prev[v]) path.unshift(v);
  return path;
}

/* ══ Render Results ═════════════════════════════════════════ */
function renderAllResults() {
  if (!R) return;
  renderBFS(); renderDFS(); renderDijkstra();
  renderFloyd(); renderMST(); renderHotspots(); renderCharts();
  initSimulator();
}

function riskBadge(c) {
  if (c>=9) return '<span class="rbadge rb-crit">CRITICAL</span>';
  if (c>=7) return '<span class="rbadge rb-high">HIGH</span>';
  if (c>=4) return '<span class="rbadge rb-med">MEDIUM</span>';
  return '<span class="rbadge rb-low">LOW</span>';
}

/* ── BFS ─ */
function renderBFS() {
  if (!R.bfs) return;
  const { dist, parent, order } = R.bfs;

  /* Sidebar chips */
  const chips = document.getElementById('bfs-chips');
  chips.innerHTML = '';
  order.forEach((id, i) => {
    const n = R.nodes.find(x=>x.id===id); const c = crimeColor(n?.crime||0);
    const chip = document.createElement('span');
    chip.className = 'chip'; chip.style.animationDelay = i*0.05+'s';
    chip.style.cssText += `color:${c};border-color:${c}55;background:${c}0f`;
    chip.textContent = n?.name||id;
    chips.appendChild(chip);
  });
  document.getElementById('bfs-quick').style.display = 'block';

  /* Wave view */
  const waveEl = document.getElementById('bfs-wave');
  waveEl.innerHTML = '';
  const maxD = Math.max(...dist.filter(d=>d>=0));
  for (let d = 0; d <= maxD; d++) {
    const nodes = R.nodes.filter((_, i) => dist[i] === d);
    if (!nodes.length) continue;
    const lv = document.createElement('div');
    lv.className = 'wave-level';
    const cols = ['#1edb8a','#00c9d4','#f0b429','#ff7e2e','#ff2442'];
    const col = cols[Math.min(d, cols.length-1)];
    lv.innerHTML = `<span class="wave-label">HOP ${d}</span><div class="wave-nodes">${nodes.map(n=>`<div class="wave-node" style="color:${col};border-color:${col}66;background:${col}10;animation-delay:${d*0.1}s">${n.name}</div>`).join('')}</div>`;
    waveEl.appendChild(lv);
  }

  /* BFS table */
  document.getElementById('bfs-tbl').innerHTML = R.nodes.map((n,i)=>`<tr>
    <td>${n.id}</td><td style="color:var(--t1)">${n.name}</td>
    <td class="${dist[i]===0?'td-hi':''}">${dist[i]>=0?dist[i]:'∞'}</td>
    <td style="color:${crimeColor(n.crime)}">${n.crime}/10</td>
    <td>${riskBadge(n.crime)}</td>
    <td class="${dist[i]>=0?'td-green':'td-inf'}">${dist[i]>=0?'✓ Yes':'✗ No'}</td>
  </tr>`).join('');
}

/* ── DFS ─ */
function renderDFS() {
  if (!R.dfs) return;
  const { order, depth } = R.dfs;
  const chips = document.getElementById('dfs-chips');
  chips.innerHTML = '';
  order.forEach((id,i) => {
    const n = R.nodes.find(x=>x.id===id);
    const chip = document.createElement('span');
    chip.className='chip'; chip.style.animationDelay=i*0.04+'s';
    chip.style.cssText+=`color:#8b5cf6;border-color:#8b5cf655;background:#8b5cf60f`;
    chip.textContent=(n?.name||id)+' @'+depth[i];
    chips.appendChild(chip);
  });
  document.getElementById('dfs-quick').style.display='block';

  /* DFS tree */
  const tree = document.getElementById('dfs-tree');
  tree.innerHTML = order.map((id, i) => {
    const n = R.nodes.find(x=>x.id===id);
    const d = depth[i];
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;padding-left:${d*18}px">
      <div style="width:1px;height:100%;background:rgba(139,92,246,.2)"></div>
      <div style="padding:3px 10px;border:1px solid rgba(139,92,246,.45);border-radius:2px;background:rgba(139,92,246,.07);font-family:'IBM Plex Mono',monospace;font-size:10px;color:#8b5cf6;animation:chipanim .25s ${i*0.04}s ease forwards;opacity:0">${n?.name||id}</div>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--t4)">depth ${d}</span>
    </div>`;
  }).join('');
}

/* ── Dijkstra ─ */
function renderDijkstra() {
  if (!R.dijkstra) return;
  const { dist, prev } = R.dijkstra;
  const tbody = document.getElementById('dijk-tbl');
  tbody.innerHTML = R.nodes.map((n,i) => {
    const d = dist[i], p = prev[i];
    const via = p >= 0 ? (R.nodes.find(x=>x.id===p)?.name||p) : '—';
    const pathLen = d >= 0 ? buildPath(prev, n.id).length-1 : 0;
    return `<tr>
      <td>${n.id}</td><td style="color:var(--t1)">${n.name}</td>
      <td class="${d<0?'td-inf':d===0?'td-hi':''}">${d<0?'∞':d}</td>
      <td style="color:var(--t3)">${via}</td>
      <td style="color:var(--t3)">${d>0?pathLen+' hops':'—'}</td>
      <td style="color:${crimeColor(n.crime)}">${n.crime}</td>
    </tr>`;
  }).join('');
}

function showPath() {
  if (!R?.dijkstra) { runAll().then(showPath); return; }
  const dest = parseInt(document.getElementById('dest-sel').value);
  const { dist, prev } = R.dijkstra;
  const di = R.nodes.findIndex(n=>n.id===dest);
  const d = dist[di];
  const el = document.getElementById('path-display');

  if (d < 0) { el.innerHTML='<div style="color:var(--red);font-family:\'IBM Plex Mono\',monospace;font-size:12px;padding:10px">⚠ Zone unreachable from HQ</div>'; return; }

  const path = buildPath(prev, dest);
  el.innerHTML = `<div class="path-display">
    ${path.map((id,i) => {
      const n = R.nodes.find(x=>x.id===id)||{name:id};
      return (i>0?'<span class="path-arrow">→</span>':'')+`<span class="path-node">${n.name}</span>`;
    }).join('')}
    <span class="path-cost">Distance: ${d}</span>
  </div>`;

  /* Highlight on map */
  layerAlgo.clearLayers();
  for (let j = 0; j < path.length-1; j++) {
    const a = G.nodes.find(x=>x.id===path[j]), b = G.nodes.find(x=>x.id===path[j+1]);
    if (!a?.lat||!b?.lat) continue;
    L.polyline([[a.lat,a.lng],[b.lat,b.lng]],{color:'#00b8f5',weight:5,opacity:.9}).addTo(layerAlgo);
    L.circleMarker([b.lat,b.lng],{radius:8,color:'#00b8f5',fillColor:'#00b8f5',fillOpacity:.5,weight:2}).addTo(layerAlgo);
  }
  toast(`Route to ${G.nodes.find(x=>x.id===dest)?.name}: distance ${d}`,'info');
}

/* ── Floyd ─ */
function renderFloyd() {
  if (!R.floyd) return;
  const fw = R.floyd; const n = R.nodes.length;
  const rows = Math.min(fw.length, 10);
  const maxV = Math.max(...fw.flat().filter(v=>v>=0));

  let html = '<tr><th style="position:sticky;top:0;left:0;z-index:2">↓\\→</th>';
  R.nodes.forEach(n => html += `<th style="position:sticky;top:0">${n.id}</th>`);
  html += '</tr>';

  for (let i=0;i<rows;i++) {
    html += `<tr><th style="position:sticky;left:0">${R.nodes[i]?.id}</th>`;
    for (let j=0;j<n;j++) {
      const v = fw[i]?.[j] ?? -1;
      const ratio = v >= 0 ? v/maxV : -1;
      const cls = v<0?'td-inf':v===0?'td-hi':ratio>0.75?'td-red':ratio>0.5?'td-amber':ratio>0.25?'':'td-green';
      html += `<td class="${cls}" style="${v<0?'':'color:'+(v===0?'var(--cyan)':ratio>0.75?'var(--red)':ratio>0.5?'var(--orange)':ratio>0.25?'var(--amber)':'var(--green)')}">${v<0?'∞':v}</td>`;
    }
    html += '</tr>';
  }
  document.getElementById('fw-tbl').innerHTML = html;
}

/* ── MST ─ */
function renderMST() {
  if (!R.mst) return;
  document.getElementById('mst-total').textContent = R.mst.totalW;
  document.getElementById('mst-ecnt').textContent  = R.mst.edges.length;
  document.getElementById('mst-save').textContent  = R.mst.totalAll - R.mst.totalW;

  const mstSet = new Set(R.mst.edges.map(e=>`${Math.min(e.u,e.v)}-${Math.max(e.u,e.v)}`));
  const tbody = document.getElementById('mst-tbl');
  tbody.innerHTML = G.edges.map(e => {
    const inMST = mstSet.has(`${Math.min(e.u,e.v)}-${Math.max(e.u,e.v)}`);
    const a = G.nodes.find(n=>n.id===e.u)||{name:e.u}, b = G.nodes.find(n=>n.id===e.v)||{name:e.v};
    return `<tr style="${inMST?'background:rgba(240,180,41,.05)':''}">
      <td>${e.u}</td><td style="color:var(--t1)">${a.name}</td>
      <td>${e.v}</td><td style="color:var(--t1)">${b.name}</td>
      <td class="td-hi">${e.w}</td>
      <td>${inMST?'<span style="color:var(--amber);font-family:\'IBM Plex Mono\',monospace">★ MST</span>':'<span style="color:var(--t4)">—</span>'}</td>
    </tr>`;
  }).join('');
}

/* ── Hotspots ─ */
function renderHotspots() {
  if (!R.nodes) return;
  const maxBtw = Math.max(...R.nodes.map(n=>n.betweenness||0));
  const maxCr  = 10;

  const scored = R.nodes.map(n => {
    const score = (n.crime/maxCr)*0.5 + ((n.betweenness||0)/Math.max(maxBtw,1))*0.3 + (n.degree/Math.max(...R.nodes.map(x=>x.degree)))*0.2;
    return { ...n, score };
  }).sort((a,b)=>b.score-a.score);

  const grid = document.getElementById('hotspot-grid');
  grid.innerHTML = scored.slice(0,12).map((n,i) => {
    const col = n.crime>=9?'var(--red)':n.crime>=7?'var(--orange)':n.crime>=4?'var(--amber)':'var(--green)';
    return `<div class="hotspot-card" style="--hc:${col}">
      <div class="hotspot-rank">#${i+1}</div>
      <div class="hotspot-name" style="color:${col}">${n.name}</div>
      <div class="hotspot-meta">ID ${n.id} · Crime ${n.crime}/10 · Degree ${n.degree}</div>
      <div class="hotspot-bar"><div class="hotspot-fill" style="width:${n.score*100}%"></div></div>
      <div class="hotspot-score">Threat score: ${(n.score*100).toFixed(1)}% · Betweenness: ${(n.betweenness||0).toFixed(2)}</div>
      ${riskBadge(n.crime)}
    </div>`;
  }).join('');
}

/* ── Charts ─ */
function renderCharts() {
  if (!R.nodes) return;
  const labs  = R.nodes.map(n => n.name.length>8 ? n.name.slice(0,8)+'…' : n.name);
  const cols  = R.nodes.map(n => crimeColor(n.crime));
  const opts  = { responsive:true, maintainAspectRatio:true, plugins:{legend:{display:false}},
    scales:{ x:{grid:{color:'#162c45'},ticks:{color:'#3a6a96',font:{family:'IBM Plex Mono',size:9}}},
             y:{grid:{color:'#162c45'},ticks:{color:'#3a6a96',font:{family:'IBM Plex Mono',size:9}}} } };

  const mkChart = (id, type, data, extra={}) => {
    if (charts[id]) { charts[id].destroy(); }
    charts[id] = new Chart(document.getElementById(id), {
      type, data, options: {...opts, ...extra}
    });
  };

  mkChart('ch-crime','bar',{ labels:labs, datasets:[{data:R.nodes.map(n=>n.crime),backgroundColor:cols.map(c=>c+'99'),borderColor:cols,borderWidth:1,borderRadius:2}] });
  mkChart('ch-degree','bar',{ labels:labs, datasets:[{data:R.nodes.map(n=>n.degree),backgroundColor:'#00b8f555',borderColor:'#00b8f5',borderWidth:1,borderRadius:2}] });
  mkChart('ch-btw','bar',{ labels:labs, datasets:[{data:R.nodes.map(n=>+(n.betweenness||0).toFixed(2)),backgroundColor:'#8b5cf655',borderColor:'#8b5cf6',borderWidth:1,borderRadius:2}] });
  mkChart('ch-dist','bar',{ labels:labs, datasets:[{data:R.dijkstra?.dist.map(d=>d<0?0:d)||[],backgroundColor:'#f0b42955',borderColor:'#f0b429',borderWidth:1,borderRadius:2}] });
}

/* ══ Simulator ══════════════════════════════════════════════ */
function initSimulator() {
  if (!R?.bfs) return;
  const maxHop = Math.max(...R.bfs.dist.filter(d=>d>=0));
  simMaxStep = maxHop;
  const slider = document.getElementById('sim-slider');
  slider.max = maxHop; slider.value = 0;
  simStep(0);
}

function simStep(step) {
  step = +step;
  document.getElementById('sim-step-lbl').textContent = step;
  document.getElementById('sim-slider').value = step;
  if (!R?.bfs) return;

  const { dist } = R.bfs;
  const reached = R.nodes.filter((_,i) => dist[i]>=0 && dist[i]<=step);
  const frontier = R.nodes.filter((_,i) => dist[i]===step);
  const unreached = R.nodes.filter((_,i) => dist[i]<0 || dist[i]>step);

  document.getElementById('sim-display').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div class="mst-stat"><div class="mst-stat-val td-green">${reached.length}</div><div class="mst-stat-lbl">Infected</div></div>
      <div class="mst-stat"><div class="mst-stat-val" style="color:var(--amber)">${frontier.length}</div><div class="mst-stat-lbl">Spreading Now</div></div>
      <div class="mst-stat"><div class="mst-stat-val td-inf">${unreached.length}</div><div class="mst-stat-lbl">Not Yet Reached</div></div>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--t4);margin-bottom:6px;letter-spacing:.1em">FRONTIER (spreading at step ${step}):</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${frontier.map(n=>`<div style="padding:4px 10px;border:1px solid var(--amber);color:var(--amber);background:rgba(240,180,41,.08);border-radius:2px;font-family:'IBM Plex Mono',monospace;font-size:10px;animation:chipanim .2s ease forwards">${n.name}</div>`).join('')}
      </div>
    </div>
    <div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--t4);margin-bottom:6px;letter-spacing:.1em">ALL INFECTED ZONES:</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${reached.map(n=>{const c=crimeColor(n.crime);return`<div style="padding:3px 8px;border:1px solid ${c}55;color:${c};background:${c}10;border-radius:2px;font-family:'IBM Plex Mono',monospace;font-size:9px">${n.name}</div>`;}).join('')}
      </div>
    </div>`;

  /* Update map to show current spread state */
  layerAlgo.clearLayers();
  G.nodes.forEach((n,i) => {
    if (!n.lat) return;
    const nd = R.nodes[i];
    if (!nd) return;
    const d = R.bfs.dist[i];
    if (d < 0 || d > step) return;
    const isFront = d === step;
    const col = isFront ? '#f0b429' : '#1edb8a';
    L.circle([n.lat,n.lng],{radius:isFront?60000:35000,color:col,fillColor:col,fillOpacity:isFront?.25:.12,weight:isFront?2:1,opacity:.8}).addTo(layerAlgo);
  });
}

function simPlay() {
  if (simInterval) { clearInterval(simInterval); simInterval=null; return; }
  let s = +document.getElementById('sim-slider').value;
  const speed = +document.getElementById('sim-speed').value;
  simInterval = setInterval(() => {
    if (s > simMaxStep) { clearInterval(simInterval); simInterval=null; return; }
    simStep(s++);
  }, speed);
}
function simReset() {
  if (simInterval) { clearInterval(simInterval); simInterval=null; }
  simStep(0); layerAlgo.clearLayers();
}

/* ══ UI Helpers ═════════════════════════════════════════════ */
function switchPane(id, btn) {
  document.querySelectorAll('.view-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.view-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('pane-'+id).classList.add('active');
  btn?.classList.add('active');
}

function togglePanel(head) {
  head.closest('.panel').classList.toggle('collapsed');
}

function toast(msg, type='info') {
  const ex = document.getElementById('_toast');
  if (ex) ex.remove();
  const el = document.createElement('div');
  el.id='_toast'; el.className=`toast ${type}`;
  const icon = type==='ok'?'✓':type==='err'?'⚠':'ℹ';
  el.innerHTML = `<span style="color:${type==='ok'?'var(--green)':type==='err'?'var(--red)':'var(--cyan)'}">${icon}</span><span>${msg}</span>`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),3500);
}

/* ══ Fallback sample data ═══════════════════════════════════ */
const FALLBACK = {
  delhi: {
    source:0, nodes:[
      {id:0,name:'Police-HQ',lat:28.6139,lng:77.2090,crime:0},{id:1,name:'Old-Delhi',lat:28.6469,lng:77.2160,crime:9},
      {id:2,name:'Chandni-Chowk',lat:28.6506,lng:77.2317,crime:7},{id:3,name:'Sadar-Bazar',lat:28.6575,lng:77.2112,crime:6},
      {id:4,name:'Paharganj',lat:28.6422,lng:77.2160,crime:8},{id:5,name:'Karol-Bagh',lat:28.6450,lng:77.1896,crime:5},
      {id:6,name:'Lajpat-Nagar',lat:28.5659,lng:77.2430,crime:4},{id:7,name:'Saket',lat:28.5245,lng:77.2066,crime:3},
      {id:8,name:'Dwarka',lat:28.5893,lng:77.0500,crime:2},{id:9,name:'Rohini',lat:28.7495,lng:77.0916,crime:6},
    ],
    edges:[{u:0,v:1,w:4},{u:0,v:5,w:3},{u:1,v:2,w:2},{u:1,v:4,w:3},{u:2,v:3,w:2},{u:3,v:4,w:5},
           {u:4,v:5,w:4},{u:5,v:6,w:7},{u:6,v:7,w:3},{u:0,v:6,w:9},{u:7,v:8,w:5},{u:0,v:9,w:8},{u:5,v:9,w:6}]
  },
  mumbai: {
    source:0, nodes:[
      {id:0,name:'Central-PD',lat:19.0760,lng:72.8777,crime:0},{id:1,name:'Dharavi',lat:19.0406,lng:72.8549,crime:9},
      {id:2,name:'Kurla',lat:19.0669,lng:72.8799,crime:7},{id:3,name:'Bandra',lat:19.0596,lng:72.8295,crime:5},
      {id:4,name:'Andheri',lat:19.1136,lng:72.8697,crime:6},{id:5,name:'Malad',lat:19.1866,lng:72.8485,crime:4},
      {id:6,name:'Borivali',lat:19.2307,lng:72.8567,crime:3},{id:7,name:'Colaba',lat:18.9067,lng:72.8147,crime:8},
      {id:8,name:'Chembur',lat:19.0626,lng:72.9011,crime:7},{id:9,name:'Thane',lat:19.2183,lng:72.9781,crime:5},
      {id:10,name:'Ghatkopar',lat:19.0824,lng:72.9075,crime:6},{id:11,name:'Vikhroli',lat:19.1025,lng:72.9242,crime:4},
    ],
    edges:[{u:0,v:1,w:3},{u:0,v:7,w:5},{u:1,v:2,w:2},{u:1,v:3,w:4},{u:2,v:8,w:2},{u:2,v:10,w:3},
           {u:3,v:4,w:4},{u:4,v:5,w:3},{u:5,v:6,w:2},{u:6,v:9,w:6},{u:8,v:11,w:3},{u:9,v:11,w:4},
           {u:10,v:11,w:2},{u:0,v:4,w:7},{u:3,v:7,w:6}]
  },
  mini: {
    source:0, nodes:[
      {id:0,name:'HQ',lat:13.0827,lng:80.2707,crime:0},{id:1,name:'Zone-A',lat:13.1000,lng:80.2900,crime:8},
      {id:2,name:'Zone-B',lat:13.0600,lng:80.2500,crime:5},{id:3,name:'Zone-C',lat:13.0900,lng:80.2400,crime:3},
    ],
    edges:[{u:0,v:1,w:4},{u:1,v:2,w:2},{u:0,v:3,w:6},{u:2,v:3,w:1}]
  }
};

/* ══ Init ═══════════════════════════════════════════════════ */
window.addEventListener('load', () => {
  initMap();
  ping();
  setInterval(ping, 15000);
  loadSample('delhi');
  setTimeout(() => runAll(), 600);

  /* Pulse ring animation for markers */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse-ring {
      0%   { transform:scale(1); opacity:.6; }
      100% { transform:scale(2.2); opacity:0; }
    }`;
  document.head.appendChild(style);
});