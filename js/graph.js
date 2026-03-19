function addNode(name, type, x, y, severity, officer) {
  const id = nodes.length;
  nodes.push({ id, name, type,
    severity: parseInt(severity) || 1,
    x: x || 120 + Math.random() * 500,
    y: y || 80  + Math.random() * 340,
    officer: officer || '',
    pagerank: 0, crimeCount: 0,
  });
  updateUI(); draw();
  logMsg('Node added: "' + name + '" (' + type + ')', 'ok');
  addTimeline('New node detected: ' + name, parseInt(severity) || 1);
  return id;
}

function addEdge(from, to, weight, type) {
  if (from === to) return;
  if (edges.some(e => e.from === from && e.to === to)) {
    logMsg('Edge already exists.', 'warn'); return;
  }
  edges.push({ from, to, weight: parseInt(weight) || 1, type: type || 'supply', timestamp: new Date().toLocaleTimeString() });
  updateUI(); draw();
  logMsg('Link: ' + nodes[from].name + ' → ' + nodes[to].name + ' [w=' + weight + ']', 'info');
}

function removeNode(idx) {
  if (idx < 0 || idx >= nodes.length) return;
  const name = nodes[idx].name;
  nodes.splice(idx, 1);
  for (let i = edges.length - 1; i >= 0; i--) {
    if (edges[i].from === idx || edges[i].to === idx) edges.splice(i, 1);
    else {
      if (edges[i].from > idx) edges[i].from--;
      if (edges[i].to   > idx) edges[i].to--;
    }
  }
  if (selectedNode === idx) selectedNode = null;
  else if (selectedNode > idx) selectedNode--;
  clearViz(); updateUI(); draw();
  logMsg('Node removed: "' + name + '"', 'warn');
}

function clearAll() {
  nodes.length = 0; edges.length = 0; crimeTimeline.length = 0;
  selectedNode = null; edgeSrc = null;
  clearViz(); updateUI(); draw();
  document.getElementById('timeline-area').innerHTML = '';
  logMsg('Graph cleared.', 'warn');
}

function buildAdj(directed) {
  if (directed === undefined) directed = true;
  const adj = Array.from({ length: nodes.length }, function() { return []; });
  edges.forEach(function(e) {
    adj[e.from].push({ to: e.to, w: e.weight });
    if (!directed) adj[e.to].push({ to: e.from, w: e.weight });
  });
  return adj;
}

function loadSample() {
  clearAll();
  const w = canvas.width || 700, h = canvas.height || 500;
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.35;
  const outerAngles = [-Math.PI/2, -Math.PI/2+Math.PI/3, -Math.PI/2+2*Math.PI/3,
    -Math.PI/2+Math.PI, -Math.PI/2+4*Math.PI/3, -Math.PI/2+5*Math.PI/3];
  const innerPos = [
    [cx, cy], [cx+r*0.45, cy-r*0.2], [cx-r*0.35, cy+0.25*r],
    [cx-r*0.55, cy-0.5*r], [cx+r*0.3, cy+r*0.5], [cx-r*0.2, cy+r*0.65],
  ];
  SAMPLE_DATA.nodes.forEach(function(nd, i) {
    var x, y;
    if (i < 6) { x = cx + r * Math.cos(outerAngles[i]); y = cy + r * Math.sin(outerAngles[i]); }
    else { x = innerPos[i-6][0]; y = innerPos[i-6][1]; }
    addNode(nd.name, nd.type, x, y, nd.severity, nd.officer);
  });
  SAMPLE_DATA.edges.forEach(function(e) { addEdge(e[0], e[1], e[2], e[3]); });
  selectedNode = 6;
  logMsg('Sample city loaded: ' + nodes.length + ' nodes, ' + edges.length + ' edges', 'ok');
  logMsg('Select a node then run an algorithm', 'info');
  updateTicker('Sample city loaded. Select City Core and run Dijkstra.');
  draw();
}

function addRandomCrime() {
  if (!nodes.length) { logMsg('Add nodes first.', 'warn'); return; }
  const idx = Math.floor(Math.random() * nodes.length);
  nodes[idx].crimeCount = (nodes[idx].crimeCount || 0) + 1;
  const events = ['Robbery reported near','Suspicious activity at','Assault case at','Drug seizure near','Vandalism at'];
  const msg = events[Math.floor(Math.random() * events.length)] + ' ' + nodes[idx].name;
  addTimeline(msg, nodes[idx].severity);
  logMsg('CRIME EVENT: ' + msg, 'danger');
  updateTicker(msg + ' — alert dispatched');
  animNodes.add(idx); draw();
 // Auto-update risk scores after every crime
setTimeout(function() {
  computeRiskScores();
  draw();
}, 500);
}

function addNodeFromForm() {
  const name    = document.getElementById('node-name').value.trim() || 'Node-' + (nodes.length + 1);
  const type    = document.getElementById('node-type').value;
  const sev     = document.getElementById('node-severity').value;
  const officer = document.getElementById('node-officer').value.trim();
  const cx = 80 + Math.random() * (canvas.width  - 160);
  const cy = 80 + Math.random() * (canvas.height - 160);
  addNode(name, type, cx, cy, sev, officer);
  document.getElementById('node-name').value    = '';
  document.getElementById('node-officer').value = '';
  refreshEdgeSelects();
}

function addEdgeFromForm() {
  const f  = parseInt(document.getElementById('edge-from').value);
  const t  = parseInt(document.getElementById('edge-to').value);
  const w  = parseInt(document.getElementById('edge-weight').value) || 5;
  const et = document.getElementById('edge-type').value;
  if (isNaN(f) || isNaN(t)) { logMsg('Select both nodes first.', 'warn'); return; }
  addEdge(f, t, w, et);
}

function loadCSV() { document.getElementById('csv-input').click(); }

function handleCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const lines = e.target.result.trim().split('\n');
    lines.slice(1).forEach(function(line) {
      const p = line.split(',').map(function(s) { return s.trim(); });
      if (p.length >= 2) {
        const cx = 80 + Math.random() * (canvas.width  - 160);
        const cy = 80 + Math.random() * (canvas.height - 160);
        addNode(p[0], p[1] || 'junction', cx, cy, p[2] || 1, p[3] || '');
      }
    });
    logMsg('CSV imported: ' + (lines.length - 1) + ' nodes added', 'ok');
  };
  reader.readAsText(file);
}

function exportReport() {
  const lines = ['CRIMENET ANALYZER — REPORT', 'Generated: ' + new Date().toLocaleString(), '='.repeat(50)];
  lines.push('\nNODES (' + nodes.length + ')');
  nodes.forEach(function(n, i) {
    lines.push('  [' + i + '] ' + n.name + ' | ' + n.type + ' | Sev:' + n.severity + ' | Officer:' + (n.officer||'—') + ' | PR:' + (n.pagerank*100).toFixed(2) + '%');
  });
  lines.push('\nEDGES (' + edges.length + ')');
  edges.forEach(function(e) {
    lines.push('  ' + nodes[e.from].name + ' → ' + nodes[e.to].name + ' | w=' + e.weight + ' | ' + e.type);
  });
  lines.push('\nTIMELINE');
  crimeTimeline.forEach(function(t) { lines.push('  [' + t.time + '] ' + t.event); });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'crimenet-report.txt';
  a.click();
  logMsg('Report exported.', 'ok');
}