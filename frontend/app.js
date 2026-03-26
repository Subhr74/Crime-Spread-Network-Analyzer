/**
 * CrimeNet India — app.js
 * Frontend Engine: Map · Charts · UI · API bridge
 */
'use strict';

const API = 'http://localhost:3001';

/* ── State ─ */
let R = null, curFilter = 'total', selState = null;
let map, lyrEdge, lyrNode, lyrAlgo, lyrHeat;
let charts = {}, simIv = null, simMax = 0;

/* ══ CRIME SCORING ══════════════════════════════════════════ */
function crimeScore(s, cat) {
  const map = {
    total:      () => Math.min(10, s.crimeRate / 200),
    violent:    () => Math.min(10, s.violent / 5),
    murder:     () => Math.min(10, s.murder / 0.5),
    rape:       () => Math.min(10, s.rape / 1.5),
    kidnap:     () => Math.min(10, s.kidnap / 1.5),
    robbery:    () => Math.min(10, s.robbery / 0.5),
    cyber:      () => s.cyber,
    corruption: () => Math.min(10, s.corruption / 40),
  };
  return Math.round(Math.min(10, Math.max(0, (map[cat] || map.total)())));
}

function crimeColor(sc) {
  if (sc >= 9) return '#ff1f3d';
  if (sc >= 7) return '#ff6d1c';
  if (sc >= 5) return '#f0b928';
  if (sc >= 3) return '#00df78';
  return '#00b0f5';
}

function riskBadge(sc) {
  if (sc >= 9) return '<span class="rb rb-crit">CRITICAL</span>';
  if (sc >= 7) return '<span class="rb rb-high">HIGH</span>';
  if (sc >= 5) return '<span class="rb rb-med">MEDIUM</span>';
  return '<span class="rb rb-low">LOW</span>';
}

/* ══ SERVER ═════════════════════════════════════════════════ */
async function ping() {
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      setDot(true);
      return true;
    }
  } catch {}
  setDot(false); return false;
}
function setDot(ok) {
  const d = document.getElementById('srv-dot');
  const l = document.getElementById('srv-lbl');
  d.className = 'srv-dot' + (ok ? '' : ' off');
  l.textContent = ok ? 'Engine Online' : 'JS Mode';
}

/* ══ MAP ════════════════════════════════════════════════════ */
function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
  lyrEdge = L.layerGroup().addTo(map);
  lyrNode = L.layerGroup().addTo(map);
  lyrAlgo = L.layerGroup().addTo(map);
  lyrHeat = L.layerGroup().addTo(map);
  map.setView([22.5, 82], 5);
}

function drawBaseMap() {
  lyrEdge.clearLayers(); lyrNode.clearLayers();
  lyrAlgo.clearLayers(); lyrHeat.clearLayers();
  hideAlgoInfo(); hideAlgoLegend();

  /* Edges */
  EDGES.forEach(e => {
    const a = STATES[e.u], b = STATES[e.v];
    L.polyline([[a.lat, a.lng],[b.lat, b.lng]], { color:'#162e48', weight:1.5, opacity:0.75 }).addTo(lyrEdge);
  });

  /* Nodes */
  const srcId = getSrc();
  STATES.forEach(s => {
    const sc = crimeScore(s, curFilter);
    const col = crimeColor(sc);
    const r = 9 + sc * 1.8;
    const isHQ = s.id === srcId;
    const html = `
      <div style="width:${r*2}px;height:${r*2}px;border-radius:50%;
        background:${col}1a;border:${isHQ?2.5:1.5}px solid ${col};
        box-shadow:0 0 ${4+sc*3}px ${col}55;
        display:flex;align-items:center;justify-content:center;
        font-family:'IBM Plex Mono',monospace;font-size:${7+sc*0.4}px;
        font-weight:600;color:${col};cursor:pointer;transition:.2s"
      >${isHQ ? '🏛' : sc}</div>
      ${sc >= 8 ? `<div style="position:absolute;inset:-5px;border-radius:50%;border:1px solid ${col}33;animation:ring 2s ease-out infinite"></div>` : ''}`;

    const icon = L.divIcon({ html: `<div style="position:relative">${html}</div>`, className: '', iconAnchor: [r, r] });
    const mk = L.marker([s.lat, s.lng], { icon }).addTo(lyrNode);
    mk.bindPopup(makePopup(s, srcId));
    mk.on('click', () => selectState(s));
  });
}

function makePopup(s, srcId) {
  const sc = crimeScore(s, curFilter), col = crimeColor(sc);
  const rsk = sc>=9?'CRITICAL':sc>=7?'HIGH':sc>=5?'MEDIUM':'LOW';
  return `
    <div style="min-width:210px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;letter-spacing:.05em;color:${col};margin-bottom:7px">${s.name}${s.id===srcId?' 🏛':''}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-family:'IBM Plex Mono',monospace;font-size:9px;margin-bottom:8px">
        <span style="color:#304f70">Capital</span>   <span style="color:#c5ddf5">${s.capital}</span>
        <span style="color:#304f70">Crime Rate</span><span style="color:${col};font-weight:600">${s.crimeRate.toFixed(1)}/L</span>
        <span style="color:#304f70">Violent</span>   <span style="color:#c5ddf5">${s.violent.toFixed(1)}/L</span>
        <span style="color:#304f70">Murder</span>    <span style="color:#c5ddf5">${s.murder.toFixed(1)}/L</span>
        <span style="color:#304f70">Rape</span>      <span style="color:#c5ddf5">${s.rape.toFixed(1)}/L</span>
        <span style="color:#304f70">Kidnap</span>    <span style="color:#c5ddf5">${s.kidnap.toFixed(1)}/L</span>
        <span style="color:#304f70">Cyber Index</span><span style="color:#c5ddf5">${s.cyber}/10</span>
        <span style="color:#304f70">Population</span><span style="color:#c5ddf5">${(s.population/1e6).toFixed(1)}M</span>
        <span style="color:#304f70">Risk</span>      <span style="color:${col};font-weight:700">${rsk}</span>
      </div>
      <div style="height:4px;border-radius:2px;background:#162e48">
        <div style="height:100%;width:${sc*10}%;background:${col};border-radius:2px"></div>
      </div>
    </div>`;
}

/* ══ STATE SELECTION ════════════════════════════════════════ */
function selectState(s) {
  selState = s;
  document.querySelectorAll('.state-row').forEach(r => r.classList.toggle('sel', +r.dataset.id === s.id));
  map.panTo([s.lat, s.lng]);
  showStateDetail(s);
}

function showStateDetail(s) {
  const sc = crimeScore(s, curFilter), col = crimeColor(sc);
  document.getElementById('det-placeholder').style.display = 'none';
  document.getElementById('state-detail').style.display = 'block';

  document.getElementById('det-card').innerHTML = `
    <div class="det-name" style="color:${col}">${s.name}</div>
    <div class="det-meta">${s.capital} · ${(s.population/1e6).toFixed(1)}M pop · ${s.short}</div>
    ${riskBadge(sc)}
    <div style="margin-top:10px">
      <div class="det-bar"><div class="det-fill" style="width:${sc*10}%;background:${col}"></div></div>
      <div class="det-lbl">Intensity: ${sc}/10 · Rate: ${s.crimeRate.toFixed(1)} per lakh</div>
    </div>
    <div class="det-grid">
      <div class="det-stat"><div class="dsv" style="color:#ff1f3d">${s.murder.toFixed(1)}</div>   <div class="dsl">Murder /L</div></div>
      <div class="det-stat"><div class="dsv" style="color:#ff3d99">${s.rape.toFixed(1)}</div>     <div class="dsl">Rape /L</div></div>
      <div class="det-stat"><div class="dsv" style="color:#f0b928">${s.kidnap.toFixed(1)}</div>   <div class="dsl">Kidnap /L</div></div>
      <div class="det-stat"><div class="dsv" style="color:#ff6d1c">${s.violent.toFixed(1)}</div>  <div class="dsl">Violent /L</div></div>
      <div class="det-stat"><div class="dsv" style="color:#00ccd0">${s.cyber}/10</div>            <div class="dsl">Cyber Idx</div></div>
      <div class="det-stat"><div class="dsv" style="color:#2b7aff">${s.corruption}</div>          <div class="dsl">Corruption</div></div>
    </div>`;

  buildRadarChart(s);
  if (R?.dijkstra) buildDistChart();
}

function buildRadarChart(s) {
  if (charts.radar) charts.radar.destroy();
  const maxes = { murder:5, rape:15, kidnap:15, violent:50, robbery:5, cyber:10 };
  charts.radar = new Chart(document.getElementById('ch-radar'), {
    type: 'radar',
    data: {
      labels: ['Murder','Rape','Kidnap','Violent','Robbery','Cyber'],
      datasets: [{
        label: s.name,
        data: [
          Math.min(1, s.murder / maxes.murder),
          Math.min(1, s.rape   / maxes.rape),
          Math.min(1, s.kidnap / maxes.kidnap),
          Math.min(1, s.violent/ maxes.violent),
          Math.min(1, s.robbery/ maxes.robbery),
          Math.min(1, s.cyber  / maxes.cyber),
        ].map(v => v * 10),
        backgroundColor: 'rgba(255,31,61,.15)', borderColor: '#ff1f3d',
        pointBackgroundColor: '#ff1f3d', pointRadius: 3, borderWidth: 1.5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          suggestedMin: 0, suggestedMax: 10,
          ticks: { color: '#182b42', font: { size: 7 }, backdropColor: 'transparent' },
          grid: { color: '#162e48' },
          pointLabels: { color: '#6298c0', font: { size: 8, family: 'IBM Plex Mono' } },
        }
      }
    }
  });
}

function buildDistChart() {
  if (!R?.dijkstra) return;
  if (charts.dist) charts.dist.destroy();
  const top = STATES.slice(0, 18);
  charts.dist = new Chart(document.getElementById('ch-dist-r'), {
    type: 'bar',
    data: {
      labels: top.map(s => s.short),
      datasets: [{
        data: top.map(s => { const d = R.dijkstra.dist[s.id]; return d < 0 ? 0 : d; }),
        backgroundColor: 'rgba(0,176,245,.3)', borderColor: '#00b0f5', borderWidth: 1, borderRadius: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#162e48' }, ticks: { color: '#304f70', font: { size: 7, family: 'IBM Plex Mono' } } },
        y: { grid: { color: '#162e48' }, ticks: { color: '#304f70', font: { size: 7 } } },
      }
    }
  });
}

/* ══ FILTERS ════════════════════════════════════════════════ */
function setFilter(btn) {
  curFilter = btn.dataset.cat;
  document.querySelectorAll('.f-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  drawBaseMap();
  updateKPIs();
  renderStateList();
  if (selState) showStateDetail(selState);
  if (R) renderAllResults();
}

/* ══ STATE LIST ═════════════════════════════════════════════ */
function renderStateList(query = '') {
  const c = document.getElementById('state-list');
  c.innerHTML = '';
  const sorted = [...STATES].sort((a, b) => crimeScore(b, curFilter) - crimeScore(a, curFilter));
  sorted.forEach((s, i) => {
    if (query && !s.name.toLowerCase().includes(query.toLowerCase())) return;
    const sc = crimeScore(s, curFilter), col = crimeColor(sc);
    const row = document.createElement('div');
    row.className = 'state-row' + (selState?.id === s.id ? ' sel' : '');
    row.dataset.id = s.id;
    row.innerHTML = `
      <div class="sdot" style="background:${col}"></div>
      <div class="sname">${s.name}</div>
      <div class="srate" style="color:${col}">${s.crimeRate.toFixed(0)}</div>
      <div class="srank">#${i+1}</div>`;
    row.onclick = () => selectState(s);
    c.appendChild(row);
  });
}
function filterStates(q) { renderStateList(q); }

function updateKPIs() {
  document.getElementById('kpi-n').textContent = STATES.length;
  document.getElementById('kpi-e').textContent = EDGES.length;
  document.getElementById('kpi-c').textContent = STATES.filter(s => crimeScore(s, curFilter) >= 8).length;
}

/* ══ SELECTS ════════════════════════════════════════════════ */
function populateSelects() {
  const opts = STATES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  ['src-sel', 'dest-sel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
  document.getElementById('src-sel').value = 31; // Delhi default
}

function getSrc() { return parseInt(document.getElementById('src-sel')?.value ?? 31); }

/* ══ RUN ANALYSIS ═══════════════════════════════════════════ */
async function runAll() {
  if (STATES.length < 2) { toast('No state data loaded', 'err'); return; }
  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Analyzing 36 States…';
  document.querySelectorAll('.acard').forEach(c => c.classList.remove('on'));

  const src = getSrc();

  try {
    const online = await ping();
    if (online) {
      const resp = await fetch(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: src }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);
      R = json.result;
    } else {
      throw new Error('offline');
    }
  } catch {
    /* JS fallback */
    R = runAllAlgos(STATES, EDGES, src);
    toast('Running in offline JS mode', 'info');
  }

  document.querySelectorAll('.acard').forEach(c => c.classList.add('on'));
  btn.disabled = false;
  btn.innerHTML = '<span>⚡</span> Run Full Analysis';

  renderAllResults();
  toast(`Analysis complete — ${STATES.length} states, ${EDGES.length} edges`, 'ok');
}

function runSingle(name) { runAll(); }

/* ══ RENDER ALL ═════════════════════════════════════════════ */
function renderAllResults() {
  if (!R) return;
  renderBFS(); renderDijkstra(); renderFloyd(); renderMST();
  renderHotspots(); renderCharts(); initSim();
  if (selState) buildDistChart();
}

/* ── BFS ─ */
function renderBFS() {
  if (!R.bfs) return;
  const { dist, parent, order } = R.bfs;

  /* Sidebar chips */
  const chips = document.getElementById('bfs-chips');
  chips.innerHTML = '';
  order.slice(0, 20).forEach((id, i) => {
    const s = STATES[id]; const col = crimeColor(crimeScore(s, curFilter));
    const ch = document.createElement('span');
    ch.className = 'chip'; ch.style.animationDelay = i * 0.04 + 's';
    ch.style.cssText += `color:${col};border-color:${col}55;background:${col}0d`;
    ch.textContent = s.short;
    chips.appendChild(ch);
  });
  document.getElementById('bfs-out').style.display = 'block';

  /* Wave display */
  const wv = document.getElementById('bfs-wave');
  wv.innerHTML = '';
  const maxD = Math.max(...dist.filter(d => d >= 0));
  const cols = ['#00df78','#00ccd0','#00b0f5','#f0b928','#ff6d1c','#ff1f3d'];
  for (let d = 0; d <= Math.min(maxD, 5); d++) {
    const nodes = STATES.filter(s => dist[s.id] === d);
    if (!nodes.length) continue;
    const col = cols[Math.min(d, cols.length-1)];
    const lv = document.createElement('div');
    lv.className = 'wlv';
    lv.innerHTML = `<span class="wlbl">HOP ${d}</span><div class="wnodes">
      ${nodes.map(s => `<div class="wnode" style="color:${col};border-color:${col}55;background:${col}0d;animation-delay:${d*.08}s">${s.short}</div>`).join('')}
    </div>`;
    wv.appendChild(lv);
  }

  /* Table */
  document.getElementById('bfs-tbl').innerHTML = STATES.map(s => `
    <tr>
      <td>${s.name}</td>
      <td class="tc">${s.short}</td>
      <td class="${dist[s.id]===0?'tc':''}">${dist[s.id]>=0?dist[s.id]:'∞'}</td>
      <td style="color:${crimeColor(crimeScore(s,curFilter))}">${s.crimeRate.toFixed(0)}</td>
      <td>${riskBadge(crimeScore(s,curFilter))}</td>
    </tr>`).join('');
}

/* ── Dijkstra ─ */
function renderDijkstra() {
  if (!R.dijkstra) return;
  const { dist, prev } = R.dijkstra;
  document.getElementById('dijk-tbl').innerHTML = STATES.map((s, i) => {
    const d = dist[s.id] ?? dist[i];
    const p = prev[s.id] ?? prev[i];
    const via = p >= 0 ? (STATES[p]?.short || p) : '—';
    return `<tr>
      <td>${s.name}</td>
      <td class="${d<0?'td':d===0?'tc':''}">${d<0?'∞':d}</td>
      <td style="color:var(--t3)">${via}</td>
      <td style="color:${crimeColor(crimeScore(s,curFilter))}">${s.crimeRate.toFixed(0)}</td>
    </tr>`;
  }).join('');

  /* Populate dest select */
  document.getElementById('dest-sel').innerHTML = STATES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function showPath() {
  if (!R?.dijkstra) { runAll().then(showPath); return; }
  const dest = parseInt(document.getElementById('dest-sel').value);
  const { dist, prev } = R.dijkstra;
  const di = STATES.findIndex(s => s.id === dest);
  const d = dist[di] ?? dist[dest];
  const el = document.getElementById('path-out');

  if (d < 0) { el.innerHTML = '<div style="color:var(--red);font-family:var(--mono);font-size:10px">⚠ Unreachable from HQ</div>'; return; }

  const path = buildPath(prev, STATES, dest);
  el.innerHTML = `<div class="path-line">
    ${path.map((id, i) => (i>0?'<span class="parr">→</span>':'')+`<span class="pnode">${STATES[id]?.short||id}</span>`).join('')}
    <span class="pcost">Cost: ${d}</span>
  </div>`;

  /* Highlight on map */
  lyrAlgo.clearLayers();
  for (let j = 0; j < path.length - 1; j++) {
    const a = STATES[path[j]], b = STATES[path[j+1]];
    if (!a || !b) continue;
    L.polyline([[a.lat,a.lng],[b.lat,b.lng]], { color:'#00b0f5', weight:4.5, opacity:.9 }).addTo(lyrAlgo);
    L.circleMarker([b.lat,b.lng], { radius:8, color:'#00b0f5', fillColor:'#00b0f5', fillOpacity:.4, weight:2 }).addTo(lyrAlgo);
  }
  toast(`Route to ${STATES[dest]?.name}: cost ${d}`, 'info');
}

/* ── Floyd ─ */
function renderFloyd() {
  if (!R.floyd) return;
  const fw = R.floyd, n = STATES.length;
  const rows = fw.length;
  const maxV = Math.max(...fw.flat().filter(v => v >= 0));

  let html = '<tr><th style="position:sticky;top:0;left:0;z-index:3;background:var(--bg3)">↓\\→</th>';
  STATES.forEach(s => html += `<th title="${s.name}">${s.short}</th>`);
  html += '</tr>';

  for (let i = 0; i < rows; i++) {
    html += `<tr><th style="position:sticky;left:0;background:var(--bg3)">${STATES[i]?.short||i}</th>`;
    for (let j = 0; j < n; j++) {
      const v = fw[i]?.[j] ?? -1;
      const ratio = v >= 0 ? v / maxV : -1;
      const col = v < 0 ? 'var(--t4)' : v === 0 ? 'var(--cyn)' :
        ratio > 0.75 ? '#ff1f3d' : ratio > 0.5 ? '#ff6d1c' : ratio > 0.25 ? '#f0b928' : '#00df78';
      html += `<td style="color:${col}">${v < 0 ? '∞' : v}</td>`;
    }
    html += '</tr>';
  }
  document.getElementById('fw-tbl').innerHTML = html;
}

/* ── MST ─ */
function renderMST() {
  if (!R.mst) return;
  document.getElementById('mst-w').textContent = R.mst.totalW;
  document.getElementById('mst-e').textContent = R.mst.mstEdges?.length || R.mst.edges?.length;
  document.getElementById('mst-s').textContent = R.mst.totalAll - R.mst.totalW;

  const mstEdges = R.mst.mstEdges || R.mst.edges || [];
  const mstSet = new Set(mstEdges.map(e => `${Math.min(e.u,e.v)}-${Math.max(e.u,e.v)}`));
  document.getElementById('mst-tbl').innerHTML = EDGES.map(e => {
    const inM = mstSet.has(`${Math.min(e.u,e.v)}-${Math.max(e.u,e.v)}`);
    return `<tr style="${inM?'background:rgba(240,185,40,.04)':''}">
      <td>${STATES[e.u]?.short}</td>
      <td>${STATES[e.v]?.short}</td>
      <td class="tc">${e.w}</td>
      <td>${inM?'<span style="color:var(--amb)">★ MST</span>':'<span style="color:var(--t4)">—</span>'}</td>
    </tr>`;
  }).join('');
}

/* ── Hotspots ─ */
function renderHotspots() {
  const nodes = R.nodes || STATES.map(s => ({...s, betweenness:0, degree:0}));
  const scored = nodes.map(n => ({ ...n, sc: crimeScore(n, curFilter) })).sort((a,b) => b.sc - a.sc);
  const maxSc = scored[0]?.sc || 10;

  document.getElementById('hs-grid').innerHTML = scored.slice(0, 12).map((s, i) => {
    const col = crimeColor(s.sc);
    return `<div class="hs-card" style="--hc:${col}">
      <div class="hs-rank">#${i+1}</div>
      <div class="hs-name" style="color:${col}">${s.name}</div>
      <div class="hs-meta">${s.crimeRate.toFixed(0)}/L · ${s.capital}</div>
      <div class="hs-bar"><div class="hs-fill" style="width:${(s.sc/maxSc)*100}%;background:${col}"></div></div>
      <div style="margin-bottom:4px">${riskBadge(s.sc)}</div>
      <div class="hs-score">Betweenness: ${(s.betweenness||0).toFixed(2)} · Degree: ${s.degree||0}</div>
    </div>`;
  }).join('');
}

/* ── Charts ─ */
function renderCharts() {
  const top20r = [...STATES].sort((a,b) => b.crimeRate - a.crimeRate).slice(0,20);
  const top20v = [...STATES].sort((a,b) => b.violent   - a.violent  ).slice(0,20);
  const cOpts = {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid:{color:'#162e48'}, ticks:{color:'#304f70',font:{size:7,family:'IBM Plex Mono'}} },
      y: { grid:{color:'#162e48'}, ticks:{color:'#304f70',font:{size:7}} },
    }
  };
  if (charts.rate) charts.rate.destroy();
  charts.rate = new Chart(document.getElementById('ch-rate'), {
    type: 'bar',
    data: { labels: top20r.map(s=>s.short),
      datasets: [{ data: top20r.map(s=>s.crimeRate),
        backgroundColor: top20r.map(s=>crimeColor(crimeScore(s,curFilter))+'88'),
        borderColor: top20r.map(s=>crimeColor(crimeScore(s,curFilter))),
        borderWidth:1, borderRadius:2 }]
    }, options: cOpts
  });
  if (charts.viol) charts.viol.destroy();
  charts.viol = new Chart(document.getElementById('ch-viol'), {
    type: 'bar',
    data: { labels: top20v.map(s=>s.short),
      datasets: [{ data: top20v.map(s=>s.violent),
        backgroundColor:'rgba(255,109,28,.35)', borderColor:'#ff6d1c', borderWidth:1, borderRadius:2 }]
    }, options: cOpts
  });
}

/* ══ MAP MODES ══════════════════════════════════════════════ */
function mapMode(mode, btn) {
  document.querySelectorAll('.mc').forEach(b => b.classList.remove('on'));
  btn?.classList.add('on');
  lyrAlgo.clearLayers(); lyrHeat.clearLayers();
  hideAlgoInfo(); hideAlgoLegend();

  if (mode === 'base')     drawBaseMap();
  else if (mode === 'bfs')      drawBFSMap();
  else if (mode === 'dijkstra') drawDijkMap();
  else if (mode === 'mst')      drawMSTMap();
  else if (mode === 'heat')     drawHeatMap();
}

function clearAlgoLayers() {
  lyrAlgo.clearLayers(); lyrHeat.clearLayers();
  hideAlgoInfo(); hideAlgoLegend();
  document.querySelectorAll('.mc').forEach(b => b.classList.remove('on'));
  document.getElementById('mc-base').classList.add('on');
}

function drawBFSMap() {
  if (!R?.bfs) { toast('Run analysis first','err'); return; }
  const { dist, parent } = R.bfs;
  const reached = dist.filter(d => d >= 0).length;
  showAlgoInfo('BFS CRIME SPREAD',
    `Source: <b>${STATES[R.bfs.src]?.name}</b>`,
    `Reached: <b>${reached}</b> states`,
    `Max depth: <b>${Math.max(...dist.filter(d=>d>=0))}</b> hops`);
  showAlgoLegend('BFS Wave Layers', `
    <div class="leg-row"><div class="leg-sw" style="background:#00df78"></div>Hop 0 (source)</div>
    <div class="leg-row"><div class="leg-sw" style="background:#00ccd0"></div>Hop 1–2</div>
    <div class="leg-row"><div class="leg-sw" style="background:#f0b928"></div>Hop 3–4</div>
    <div class="leg-row"><div class="leg-sw" style="background:#ff1f3d"></div>Hop 5+</div>`);

  STATES.forEach(s => {
    const d = dist[s.id]; if (d < 0) return;
    const col = d===0?'#00df78':d<=2?'#00ccd0':d<=4?'#f0b928':'#ff6d1c';
    L.circle([s.lat,s.lng], { radius:(14+d*14)*14000, color:col, fillColor:col, fillOpacity:.13, weight:1.5, opacity:.65 }).addTo(lyrAlgo);
    const par = parent[s.id];
    if (par >= 0 && STATES[par]) {
      L.polyline([[STATES[par].lat,STATES[par].lng],[s.lat,s.lng]],
        { color:col, weight:2, opacity:.65, dashArray:'5 4' }).addTo(lyrAlgo);
    }
  });
}

function drawDijkMap() {
  if (!R?.dijkstra) { toast('Run analysis first','err'); return; }
  const { dist, prev } = R.dijkstra;
  const reach = dist.filter(d => d >= 0 && d < 999999).length;
  showAlgoInfo('DIJKSTRA ROUTES',
    `From: <b>${STATES[R.dijkstra.src]?.name}</b>`,
    `Reachable: <b>${reach}</b> states`,
    `Avg cost: <b>${(dist.filter(d=>d>0&&d<999999).reduce((a,b)=>a+b,0)/Math.max(reach-1,1)).toFixed(1)}</b>`);
  showAlgoLegend('Shortest Paths', `<div class="leg-row"><div class="leg-sw" style="background:var(--cyn)"></div>Police route</div>`);
  STATES.forEach(s => {
    const d = dist[s.id]; if (!d || d <= 0 || d >= 999999) return;
    const path = buildPath(prev, STATES, s.id);
    for (let j = 0; j < path.length - 1; j++) {
      const a = STATES[path[j]], b = STATES[path[j+1]];
      if (!a||!b) continue;
      L.polyline([[a.lat,a.lng],[b.lat,b.lng]], { color:'#00b0f5', weight:2.5, opacity:.75 }).addTo(lyrAlgo);
    }
  });
}

function drawMSTMap() {
  if (!R?.mst) { toast('Run analysis first','err'); return; }
  const mstEdges = R.mst.mstEdges || R.mst.edges || [];
  showAlgoInfo('KRUSKAL MST',
    `Total weight: <b>${R.mst.totalW}</b>`,
    `Edges: <b>${mstEdges.length}</b>`,
    `Cost saved: <b>${R.mst.totalAll - R.mst.totalW}</b>`);
  showAlgoLegend('MST Patrol Network', `<div class="leg-row"><div class="leg-sw" style="background:var(--amb)"></div>MST edge</div>`);
  mstEdges.forEach(e => {
    const a = STATES[e.u], b = STATES[e.v];
    if (!a||!b) return;
    L.polyline([[a.lat,a.lng],[b.lat,b.lng]], { color:'#f0b928', weight:4, opacity:.9 }).addTo(lyrAlgo);
    const mid = [(a.lat+b.lat)/2, (a.lng+b.lng)/2];
    L.marker(mid, { icon: L.divIcon({
      html:`<div style="background:rgba(3,6,9,.9);border:1px solid #f0b928;border-radius:2px;padding:1px 5px;font-family:'IBM Plex Mono',monospace;font-size:8px;color:#f0b928;white-space:nowrap">${e.w}</div>`,
      className:'', iconAnchor:[12,7] }) }).addTo(lyrAlgo);
  });
}

function drawHeatMap() {
  showAlgoLegend('Crime Heatmap', `
    <div class="leg-row"><div class="leg-sw" style="background:var(--red)"></div>Critical crime</div>
    <div class="leg-row"><div class="leg-sw" style="background:var(--org)"></div>High crime</div>`);
  STATES.forEach(s => {
    const sc = crimeScore(s, curFilter), col = crimeColor(sc);
    for (let i = 3; i >= 1; i--)
      L.circle([s.lat,s.lng], { radius:sc*28000*i, color:col, fillColor:col, fillOpacity:.05/i, weight:0 }).addTo(lyrHeat);
    L.circle([s.lat,s.lng], { radius:sc*20000, color:col, fillColor:col, fillOpacity:.22, weight:1, opacity:.65 }).addTo(lyrHeat);
  });
}

function showAlgoInfo(name, l1, l2, l3) {
  const el = document.getElementById('ainfo');
  el.style.display = 'block';
  document.getElementById('ai-name').textContent = name;
  document.getElementById('ai-l1').innerHTML = l1;
  document.getElementById('ai-l2').innerHTML = l2;
  document.getElementById('ai-l3').innerHTML = l3;
}
function hideAlgoInfo() { document.getElementById('ainfo').style.display = 'none'; }

function showAlgoLegend(title, html) {
  document.getElementById('algo-legend').style.display = 'block';
  document.getElementById('al-title').textContent = title;
  document.getElementById('al-body').innerHTML = html;
}
function hideAlgoLegend() { document.getElementById('algo-legend').style.display = 'none'; }

/* ══ SIMULATOR ══════════════════════════════════════════════ */
function initSim() {
  if (!R?.bfs) return;
  const maxD = Math.max(...R.bfs.dist.filter(d => d >= 0));
  simMax = maxD;
  const sl = document.getElementById('sim-sl');
  sl.max = maxD; sl.value = 0;
  simStep(0);
}

function simStep(step) {
  step = +step;
  document.getElementById('sim-lbl').textContent = step;
  document.getElementById('sim-sl').value = step;
  if (!R?.bfs) return;

  const { dist } = R.bfs;
  const reached  = STATES.filter(s => dist[s.id] >= 0 && dist[s.id] <= step);
  const frontier = STATES.filter(s => dist[s.id] === step);
  const safe     = STATES.filter(s => dist[s.id] < 0 || dist[s.id] > step);

  document.getElementById('sim-out').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
      <div class="ms"><div class="msv" style="color:var(--red)">${reached.length}</div><div class="msl">Infected</div></div>
      <div class="ms"><div class="msv" style="color:var(--amb)">${frontier.length}</div><div class="msl">Spreading</div></div>
      <div class="ms"><div class="msv td">${safe.length}</div><div class="msl">Safe</div></div>
    </div>
    <div style="font-family:var(--mono);font-size:8px;color:var(--t4);letter-spacing:.1em;margin-bottom:5px">FRONTIER (step ${step}):</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
      ${frontier.map(s => { const c=crimeColor(crimeScore(s,curFilter)); return `<div style="padding:2px 8px;border:1px solid ${c};color:${c};background:${c}10;border-radius:2px;font-family:var(--mono);font-size:8px;animation:chipin .2s ease forwards">${s.name}</div>`; }).join('')}
    </div>
    <div style="font-family:var(--mono);font-size:8px;color:var(--t4);letter-spacing:.1em;margin-bottom:5px">ALL INFECTED:</div>
    <div style="display:flex;flex-wrap:wrap;gap:3px">
      ${reached.map(s => { const c=crimeColor(crimeScore(s,curFilter)); return `<div style="padding:1px 6px;border:1px solid ${c}55;color:${c};background:${c}0d;border-radius:2px;font-family:var(--mono);font-size:8px">${s.short}</div>`; }).join('')}
    </div>`;

  /* Map overlay */
  lyrAlgo.clearLayers();
  reached.forEach(s => {
    const isFront = dist[s.id] === step;
    const col = isFront ? '#f0b928' : '#00df78';
    L.circle([s.lat,s.lng], { radius:isFront?220000:130000, color:col, fillColor:col, fillOpacity:isFront?.22:.1, weight:isFront?2:1, opacity:.8 }).addTo(lyrAlgo);
  });
}

function simPlay() {
  if (simIv) { clearInterval(simIv); simIv = null; return; }
  let s = +document.getElementById('sim-sl').value;
  const spd = +document.getElementById('sim-spd').value;
  simIv = setInterval(() => {
    if (s > simMax) { clearInterval(simIv); simIv = null; return; }
    simStep(s++);
  }, spd);
}
function simReset() {
  if (simIv) { clearInterval(simIv); simIv = null; }
  simStep(0); lyrAlgo.clearLayers();
}

/* ══ UI HELPERS ═════════════════════════════════════════════ */
function switchPane(id, btn) {
  document.querySelectorAll('.vp').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.vtab').forEach(b => b.classList.remove('on'));
  document.getElementById('vp-' + id).classList.add('on');
  btn?.classList.add('on');
}

function togglePanel(hd) { hd.closest('.panel').classList.toggle('closed'); }

function toast(msg, type = 'info') {
  const ex = document.getElementById('_toast'); if (ex) ex.remove();
  const el = document.createElement('div');
  el.id = '_toast'; el.className = `toast ${type}`;
  const ico = type==='ok'?'✓':type==='err'?'⚠':'ℹ';
  el.innerHTML = `<span style="color:${type==='ok'?'var(--grn)':type==='err'?'var(--red)':'var(--cyn)'}">${ico}</span><span>${msg}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent =
    n.toLocaleTimeString('en-IN', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' IST';
}

/* ══ INIT ════════════════════════════════════════════════════ */
window.addEventListener('load', () => {
  initMap();
  populateSelects();
  renderStateList();
  updateKPIs();
  ping(); setInterval(ping, 15000);
  updateClock(); setInterval(updateClock, 1000);

  /* Ring animation for high-crime markers */
  const style = document.createElement('style');
  style.textContent = '@keyframes ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.4);opacity:0}}';
  document.head.appendChild(style);

  drawBaseMap();
  setTimeout(() => {
    selectState(STATES[31]); // Delhi default
    runAll();
  }, 500);
});