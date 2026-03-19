const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
  var wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  draw();
}
window.addEventListener('resize', resizeCanvas);

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawEdges();
  drawNodes();
}

function drawBackground() {
  ctx.fillStyle = 'rgba(26,34,53,0.35)';
  for (var x = 16; x < canvas.width;  x += 28)
    for (var y = 16; y < canvas.height; y += 28)
      ctx.fillRect(x, y, 1.5, 1.5);
}

function drawEdges() {
  edges.forEach(function(e) {
    var a = nodes[e.from], b = nodes[e.to];
    if (!a || !b) return;
    var key      = e.from + '-' + e.to;
    var isBridge = bridgeEdges.has(key) || bridgeEdges.has(e.to + '-' + e.from);
    var isPath   = isOnPath(e.from, e.to);
    var isHilit  = highlightEdges.has(key);
    var strokeColor, lineWidth;

    ctx.setLineDash([]);
    if (isBridge)     { strokeColor = '#ff6b35'; lineWidth = 2.5; ctx.setLineDash([7,4]); }
    else if (isPath)  { strokeColor = '#00c9a7'; lineWidth = 2.5; }
    else if (isHilit) { strokeColor = '#a855f7'; lineWidth = 2; }
    else              { strokeColor = (EDGE_COLOR[e.type] || '#253040') + '66'; lineWidth = 1.2; }

    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = strokeColor; ctx.lineWidth = lineWidth; ctx.stroke();
    ctx.setLineDash([]);

    var angle = Math.atan2(b.y - a.y, b.x - a.x);
    var nodeR = getRadius(nodes.indexOf(b));
    var ax = b.x - (nodeR + 2) * Math.cos(angle);
    var ay = b.y - (nodeR + 2) * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - 8 * Math.cos(angle - 0.4), ay - 8 * Math.sin(angle - 0.4));
    ctx.lineTo(ax - 8 * Math.cos(angle + 0.4), ay - 8 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fillStyle = strokeColor.slice(0, 7); ctx.fill();

    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    ctx.fillStyle = 'rgba(8,9,15,0.82)'; ctx.fillRect(mx-9, my-7, 18, 13);
    ctx.fillStyle = '#4a5568'; ctx.font = '9px Share Tech Mono, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.weight, mx, my);
  });
}

function drawNodes() {
  nodes.forEach(function(n, i) {
    var col    = sccColors[i] || TYPE_COLOR[n.type] || '#888';
    var ring   = TYPE_RING[n.type] || '#aaa';
    var r      = getRadius(i);
    var isAnim = animNodes.has(i);
    var isSel  = selectedNode === i;
    var isSrc  = edgeSrc === i;
    var isPath = dijkstraPath.indexOf(i) !== -1;

    if (isAnim || isPath) {
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
      var rgb = hexToRgb(col);
      ctx.fillStyle = rgb ? 'rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.12)' : 'rgba(0,201,167,0.12)';
      ctx.fill();
    }
    if (isPath) {
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#00c9a7'; ctx.lineWidth = 1.5; ctx.setLineDash([4,3]); ctx.stroke(); ctx.setLineDash([]);
    }// ── RISK GLOW RING (new) ──
if (nd.riskScore && nd.riskScore > 0) {
  var riskR = r + 4 + Math.round(nd.riskScore / 20);
  ctx.beginPath();
  ctx.arc(n.x, n.y, riskR, 0, Math.PI * 2);
  var riskCol = nd.riskScore >= 75 ? '232,64,64' :
                nd.riskScore >= 50 ? '245,158,11' :
                nd.riskScore >= 25 ? '59,130,246' : '0,201,167';
  ctx.strokeStyle = 'rgba(' + riskCol + ',0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = (isSel || isSrc) ? '#a855f7' : col; ctx.fill();
    ctx.strokeStyle = isSel ? '#d8b4fe' : isSrc ? '#c084fc' : ring;
    ctx.lineWidth = (isSel || isSrc) ? 2.5 : 1.5; ctx.stroke();

    if (n.severity === 3) { ctx.beginPath(); ctx.arc(n.x, n.y, 3, 0, Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); }

    var short = n.name.length > 9 ? n.name.slice(0, 8) + '…' : n.name;
    var fontSize = Math.min(11, 9 + Math.floor(r / 5));
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 ' + fontSize + 'px Syne, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(short, n.x, n.y);

    ctx.fillStyle = '#4a5568'; ctx.font = '9px Share Tech Mono, monospace';
    ctx.fillText(n.type.slice(0,4).toUpperCase(), n.x, n.y + r + 10);
// Show risk score if available, otherwise pagerank
if (nd.riskScore > 0) {
  ctx.fillStyle = getRiskColor(nd.riskScore);
  ctx.font = '8px Share Tech Mono, monospace';
  ctx.fillText('RISK:' + nd.riskScore, n.x, n.y - r - 8);
} else if (n.pagerank > 0.05) {
  ctx.fillStyle = '#f59e0b'; ctx.font = '8px Share Tech Mono, monospace';
  ctx.fillText((n.pagerank * 100).toFixed(0) + '%', n.x, n.y - r - 8);
}
  });
}

function getRadius(i) {
  var n = nodes[i]; if (!n) return 14;
  return 12 + (n.severity || 1) * 2 + (prSizes[i] || 0);
}

function isOnPath(a, b) {
  for (var i = 0; i < dijkstraPath.length - 1; i++) {
    if ((dijkstraPath[i]===a && dijkstraPath[i+1]===b) ||
        (dijkstraPath[i]===b && dijkstraPath[i+1]===a)) return true;
  }
  return false;
}

function hexToRgb(hex) {
  var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : null;
}