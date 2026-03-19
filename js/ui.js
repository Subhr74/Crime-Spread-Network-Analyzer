function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('mode-' + m + '-btn').classList.add('active');
  var labels = { add:'MODE: ADD NODE', edge:'MODE: DRAW EDGE', select:'MODE: SELECT / DRAG', delete:'MODE: DELETE NODE' };
  var hints  = { add:'Click empty canvas to place a node', edge:'Click source → then target node', select:'Click to select; drag to move', delete:'Click a node to remove it' };
  var colors = { add:'var(--teal)', edge:'var(--amber)', select:'var(--blue)', delete:'var(--accent)' };
  var badge  = document.getElementById('mode-badge');
  badge.textContent = labels[m] || m;
  badge.style.borderColor = colors[m]; badge.style.color = colors[m];
  document.getElementById('canvas-hint').textContent = hints[m] || '';
  document.getElementById('node-form').classList.toggle('hidden', m !== 'add');
  document.getElementById('edge-form').classList.toggle('hidden', m !== 'edge');
  if (m !== 'edge') edgeSrc = null;
  draw();
}

canvas.addEventListener('click', function(e) {
  var pos = getMousePos(e);
  var hit = getNodeAt(pos.mx, pos.my);
  if (mode === 'add') {
    if (hit !== -1) return;
    addNode('Node-' + (nodes.length + 1), 'hotspot', pos.mx, pos.my, 1, '');
    refreshEdgeSelects();
  } else if (mode === 'edge') {
    if (hit === -1) return;
    if (edgeSrc === null) { edgeSrc = hit; logMsg('Edge source: ' + nodes[hit].name, 'info'); draw(); }
    else { if (edgeSrc !== hit) addEdge(edgeSrc, hit, 1 + Math.floor(Math.random() * 9)); edgeSrc = null; draw(); }
  } else if (mode === 'select') {
    selectedNode = hit !== -1 ? hit : null;
    if (hit !== -1) { logMsg('Selected: ' + nodes[hit].name, 'info'); showTooltip(e.clientX, e.clientY, hit); }
    else hideTooltip();
    draw();
  } else if (mode === 'delete') {
    if (hit !== -1) removeNode(hit);
  }
});

var dragging = null, dragOx = 0, dragOy = 0;
canvas.addEventListener('mousedown', function(e) {
  if (mode !== 'select') return;
  var pos = getMousePos(e), hit = getNodeAt(pos.mx, pos.my);
  if (hit !== -1) { dragging = hit; dragOx = pos.mx - nodes[hit].x; dragOy = pos.my - nodes[hit].y; }
});
canvas.addEventListener('mousemove', function(e) {
  if (dragging !== null) {
    var pos = getMousePos(e);
    nodes[dragging].x = pos.mx - dragOx; nodes[dragging].y = pos.my - dragOy; draw();
  }
  if (mode === 'select' && dragging === null) {
    var pos = getMousePos(e), hit = getNodeAt(pos.mx, pos.my);
    if (hit !== -1) showTooltip(e.clientX, e.clientY, hit); else hideTooltip();
  }
});
canvas.addEventListener('mouseup',    function() { dragging = null; });
canvas.addEventListener('mouseleave', function() { dragging = null; hideTooltip(); });

var tooltip = document.getElementById('tooltip');
function showTooltip(cx, cy, idx) {
  var n = nodes[idx]; if (!n) return;
  var deg = edges.filter(function(e) { return e.from === idx || e.to === idx; }).length;
  tooltip.innerHTML = '<div style="font-weight:700;color:var(--text);margin-bottom:4px">' + n.name + '</div>' +
    '<div style="color:var(--muted2)">Type: ' + n.type + '</div>' +
    '<div style="color:var(--muted2)">Severity: ' + '★'.repeat(n.severity) + '☆'.repeat(3-n.severity) + '</div>' +
    '<div style="color:var(--muted2)">Officer: ' + (n.officer||'Unassigned') + '</div>' +
    '<div style="color:var(--muted2)">Degree: ' + deg + ' links</div>' +
    '<div style="color:var(--amber)">PageRank: ' + (n.pagerank*100).toFixed(2) + '%</div>' +
    '<div style="color:var(--accent)">Crimes reported: ' + (n.crimeCount||0) + '</div>';
  tooltip.style.left = (cx + 14) + 'px'; tooltip.style.top = (cy - 10) + 'px';
  tooltip.classList.remove('hidden');
}
function hideTooltip() { tooltip.classList.add('hidden'); }

function getMousePos(e) {
  var rect = canvas.getBoundingClientRect();
  return { mx: e.clientX - rect.left, my: e.clientY - rect.top };
}
function getNodeAt(mx, my) {
  for (var i = nodes.length - 1; i >= 0; i--) {
    var r = 18 + (prSizes[i] || 0);
    if (Math.hypot(mx - nodes[i].x, my - nodes[i].y) < r) return i;
  }
  return -1;
}

function refreshNodeList(filter) {
  filter = filter || '';
  var list = document.getElementById('node-list');
  var filtered = nodes.filter(function(n) { return n.name.toLowerCase().indexOf(filter.toLowerCase()) !== -1; });
  if (!filtered.length) { list.innerHTML = '<div style="padding:10px 14px;color:var(--muted);font-size:11px">No nodes found.</div>'; return; }
  list.innerHTML = filtered.map(function(n) {
    var i = nodes.indexOf(n);
    var pr = (n.pagerank || 0).toFixed(3);
    var rc = n.pagerank > 0.15 ? 'risk-high' : n.pagerank > 0.07 ? 'risk-med' : 'risk-low';
    var rl = n.pagerank > 0.15 ? 'HIGH' : n.pagerank > 0.07 ? 'MED' : 'LOW';
    var deg = edges.filter(function(e) { return e.from===i||e.to===i; }).length;
    return '<div class="node-item ' + (selectedNode===i?'selected':'') + '" onclick="selectFromList(' + i + ')">' +
      '<div class="node-dot" style="background:' + TYPE_COLOR[n.type] + '"></div>' +
      '<div><div class="node-name">' + n.name + '</div><div class="node-info">' + n.type + ' · deg=' + deg + ' · PR:' + pr + '</div></div>' +
      '<div class="node-risk ' + rc + '">' + rl + '</div></div>';
  }).join('');
}

function selectFromList(i) { selectedNode = i; setMode('select'); logMsg('Selected: ' + nodes[i].name, 'info'); draw(); }
function filterNodes(val) { refreshNodeList(val); }

function refreshEdgeSelects() {
  ['edge-from','edge-to'].forEach(function(id) {
    var s = document.getElementById(id), old = s.value;
    s.innerHTML = '<option value="">— Select Node —</option>' + nodes.map(function(n,i) { return '<option value="'+i+'">'+n.name+'</option>'; }).join('');
    s.value = old;
  });
}

function updateUI() {
  document.getElementById('node-count').textContent = nodes.length;
  document.getElementById('h-nodes').textContent    = nodes.length;
  document.getElementById('h-edges').textContent    = edges.length;
  refreshNodeList(); refreshEdgeSelects();
}

function clearViz() {
  animNodes.clear(); highlightEdges.clear(); bridgeEdges.clear(); mstEdges.clear();
  sccColors = {}; prSizes = {}; dijkstraPath = [];
  document.getElementById('results-area').innerHTML = '<div class="empty-state">Run an algorithm<br>to see results here.</div>';
  document.querySelectorAll('.algo-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('h-algo').textContent = 'IDLE';
  draw();
}

function showResult(html) { document.getElementById('results-area').innerHTML = html; }

function logMsg(msg, type) {
  type = type || 'info';
  var area = document.getElementById('log-area');
  var now  = new Date().toLocaleTimeString('en', { hour12: false });
  var div  = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = '<span class="log-time">[' + now + ']</span><span class="log-' + type + '">' + msg + '</span>';
  area.appendChild(div); area.scrollTop = area.scrollHeight;
  if (area.children.length > 80) area.removeChild(area.children[0]);
}

function addTimeline(event, severity) {
  severity = severity || 1;
  var now = new Date().toLocaleTimeString('en', { hour12: false });
  crimeTimeline.unshift({ time: now, event: event, severity: severity });
  if (crimeTimeline.length > 20) crimeTimeline.pop();
  renderTimeline();
}

function renderTimeline() {
  var area = document.getElementById('timeline-area');
  if (!crimeTimeline.length) { area.innerHTML = ''; return; }
  area.innerHTML = crimeTimeline.slice(0, 8).map(function(t) {
    var cls = t.severity >= 3 ? 'tl-high' : t.severity === 2 ? 'tl-med' : 'tl-low';
    var lbl = t.severity >= 3 ? 'HIGH'    : t.severity === 2 ? 'MED'    : 'LOW';
    return '<div class="tl-item"><div class="tl-time">' + t.time + '</div><div class="tl-event">' + t.event + '</div><div class="tl-badge ' + cls + '">' + lbl + '</div></div>';
  }).join('');
}

function updateTicker(msg) {
  var el = document.getElementById('ticker-text');
  el.textContent = msg;
  el.style.animation = 'none'; el.offsetHeight; el.style.animation = '';
}

var uptimeSeconds = 0;
setInterval(function() {
  uptimeSeconds++;
  var m = String(Math.floor(uptimeSeconds / 60)).padStart(2, '0');
  var s = String(uptimeSeconds % 60).padStart(2, '0');
  document.getElementById('h-time').textContent = m + ':' + s;
}, 1000);