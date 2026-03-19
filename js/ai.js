// ═══════════════════════════════════════════════════
//  js/ai.js  —  AI Risk Prediction Engine
// ═══════════════════════════════════════════════════

// ── MAIN PREDICTION FUNCTION ─────────────────────
function computeRiskScores() {
  if (!nodes.length) return [];

  var n = nodes.length;

  // ── FACTOR 1: PageRank (already computed or compute fresh) ──
  var prScores = nodes.map(function(nd) { return nd.pagerank || 0; });
  var maxPR = Math.max.apply(null, prScores) || 1;
  var normPR = prScores.map(function(v) { return v / maxPR; });

  // ── FACTOR 2: Crime History ──
  var crimeScores = nodes.map(function(nd) { return nd.crimeCount || 0; });
  var maxCrime = Math.max.apply(null, crimeScores) || 1;
  var normCrime = crimeScores.map(function(v) { return v / maxCrime; });

  // ── FACTOR 3: Network Degree (in + out edges) ──
  var degScores = nodes.map(function(nd, i) {
    return edges.filter(function(e) { return e.from === i || e.to === i; }).length;
  });
  var maxDeg = Math.max.apply(null, degScores) || 1;
  var normDeg = degScores.map(function(v) { return v / maxDeg; });

  // ── FACTOR 4: Severity ──
  var sevScores = nodes.map(function(nd) { return (nd.severity || 1) / 3; });

  // ── WEIGHTED COMBINATION ──
  var W_PR       = 0.35;
  var W_CRIME    = 0.30;
  var W_DEGREE   = 0.20;
  var W_SEVERITY = 0.15;

  var rawScores = nodes.map(function(nd, i) {
    return (normPR[i]    * W_PR)    +
           (normCrime[i] * W_CRIME) +
           (normDeg[i]   * W_DEGREE)+
           (sevScores[i] * W_SEVERITY);
  });

  // ── NORMALIZE TO 0–100 ──
  var maxRaw = Math.max.apply(null, rawScores) || 1;
  var finalScores = rawScores.map(function(v) {
    return Math.round((v / maxRaw) * 100);
  });

  // ── STORE ON NODES ──
  nodes.forEach(function(nd, i) {
    nd.riskScore = finalScores[i];
  });

  return finalScores;
}

// ── PREDICT NEXT TARGET ──────────────────────────
function predictNextTarget() {
  var scores = computeRiskScores();
  if (!scores.length) return null;

  // Find top 3 highest risk nodes
  var ranked = scores
    .map(function(s, i) { return { i: i, score: s }; })
    .sort(function(a, b) { return b.score - a.score; });

  return {
    top:    ranked[0],
    second: ranked[1] || null,
    third:  ranked[2] || null,
    all:    ranked
  };
}

// ── GET RISK COLOR ───────────────────────────────
function getRiskColor(score) {
  if (score >= 75) return '#e84040';       // critical — red
  if (score >= 50) return '#f59e0b';       // high     — amber
  if (score >= 25) return '#3b82f6';       // medium   — blue
  return '#00c9a7';                         // low      — teal
}

function getRiskLabel(score) {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

// ── MAIN ENTRY: RUN PREDICTION ───────────────────
function runAIPrediction() {
  if (!nodes.length) { logMsg('No nodes to analyse.', 'warn'); return; }

  // Auto-run PageRank first so scores are fresh
  var pr = computePageRankInternal();
  nodes.forEach(function(nd, i) {
    nd.pagerank = pr[i];
    prSizes[i]  = pr[i] * 14;
  });

  var result = predictNextTarget();
  if (!result) return;

  // ── SET ACTIVE BUTTON ──
  setAlgoActive('btn-ai');
  document.getElementById('h-algo').textContent = 'AI RISK';

  // ── HIGHLIGHT NODES BY RISK ──
  clearViz();
  nodes.forEach(function(nd, i) {
    sccColors[i] = getRiskColor(nd.riskScore);
    animNodes.add(i);
  });
  draw();

  // ── UPDATE HEADER ──
  document.getElementById('h-top').textContent = nodes[result.top.i].name.slice(0, 7);

  // ── RENDER RESULTS ──
  var topNode    = nodes[result.top.i];
  var secondNode = result.second ? nodes[result.second.i] : null;
  var thirdNode  = result.third  ? nodes[result.third.i]  : null;

  var predictionHTML =
    '<div style="margin:10px 14px;padding:12px;background:rgba(232,64,64,0.08);' +
    'border:1px solid rgba(232,64,64,0.3);border-radius:8px;">' +
    '<div style="font-size:9px;font-weight:700;letter-spacing:.1em;color:#e84040;margin-bottom:8px">PREDICTED NEXT TARGET</div>' +
    '<div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:2px">' + topNode.name + '</div>' +
    '<div style="font-size:11px;color:#e84040;font-family:var(--mono);margin-bottom:8px">RISK SCORE: ' + result.top.score + '/100 — ' + getRiskLabel(result.top.score) + '</div>' +
    '<div style="font-size:10px;color:var(--muted2);font-family:var(--mono)">Officer assigned: ' + (topNode.officer || 'Unassigned') + '</div>' +
    '<div style="font-size:10px;color:var(--muted2);font-family:var(--mono)">Crimes reported: ' + (topNode.crimeCount || 0) + ' · Degree: ' + edges.filter(function(e){return e.from===result.top.i||e.to===result.top.i;}).length + ' links</div>' +
    '</div>';

  // Factor breakdown for top node
  var i = result.top.i;
  var pr0 = nodes[i].pagerank || 0;
  var maxPR2 = Math.max.apply(null, nodes.map(function(n){return n.pagerank||0;})) || 1;
  var maxC   = Math.max.apply(null, nodes.map(function(n){return n.crimeCount||0;})) || 1;
  var maxD   = Math.max.apply(null, nodes.map(function(nd,idx){return edges.filter(function(e){return e.from===idx||e.to===idx;}).length;})) || 1;
  var deg0   = edges.filter(function(e){return e.from===i||e.to===i;}).length;

  var f1 = Math.round((pr0/maxPR2)*0.35*100);
  var f2 = Math.round(((nodes[i].crimeCount||0)/maxC)*0.30*100);
  var f3 = Math.round((deg0/maxD)*0.20*100);
  var f4 = Math.round(((nodes[i].severity||1)/3)*0.15*100);

  var breakdownHTML =
    '<div class="result-card">' +
    '<div class="result-card-title">Score Breakdown — ' + topNode.name + '</div>' +
    makeFactorBar('PageRank (35%)',    f1, 35,  '#a855f7') +
    makeFactorBar('Crime history (30%)', f2, 30, '#e84040') +
    makeFactorBar('Network degree (20%)',f3, 20, '#3b82f6') +
    makeFactorBar('Base severity (15%)', f4, 15, '#f59e0b') +
    '</div>';

  // Full ranking table
  var rows = result.all.map(function(r) {
    var color = getRiskColor(r.score);
    var label = getRiskLabel(r.score);
    var pct   = r.score;
    return '<div class="result-row">' +
      '<span class="result-key">' + nodes[r.i].name + '</span>' +
      '<div style="display:flex;align-items:center;gap:6px;flex:1;justify-content:flex-end">' +
      '<div style="width:60px;height:5px;background:var(--border2);border-radius:3px;overflow:hidden">' +
      '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px"></div></div>' +
      '<span class="result-val" style="color:' + color + ';min-width:28px">' + pct + '</span>' +
      '<span style="font-size:9px;font-family:var(--mono);color:' + color + ';min-width:52px">' + label + '</span>' +
      '</div></div>';
  }).join('');

  var rankHTML = '<div class="result-card"><div class="result-card-title">All Zones — Risk Ranking</div>' + rows + '</div>';

  showResult(predictionHTML + breakdownHTML + rankHTML);

  // ── LOG + TICKER ──
  logMsg('AI Prediction: Top target = ' + topNode.name + ' (' + result.top.score + '/100)', 'danger');
  if (secondNode) logMsg('2nd: ' + secondNode.name + ' (' + result.second.score + '/100)', 'warn');
  updateTicker('AI ALERT: Predicted next target — ' + topNode.name + ' | Risk ' + result.top.score + '/100 | Deploy patrol immediately');
  updateUI();
}

// ── FACTOR BAR HELPER ────────────────────────────
function makeFactorBar(label, score, maxScore, color) {
  var pct = Math.round((score / maxScore) * 100);
  return '<div style="margin-bottom:8px">' +
    '<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px">' +
    '<span style="color:var(--muted2);font-family:var(--mono)">' + label + '</span>' +
    '<span style="color:' + color + ';font-family:var(--mono);font-weight:700">+' + score + 'pts</span>' +
    '</div>' +
    '<div style="height:5px;background:var(--border2);border-radius:3px;overflow:hidden">' +
    '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px;transition:width .4s"></div>' +
    '</div></div>';
}

// ── INTERNAL PAGERANK (no UI side effects) ────────
function computePageRankInternal() {
  var n      = nodes.length;
  var d      = 0.85;
  var iters  = 60;
  var pr     = new Array(n).fill(1 / n);
  var outDeg = new Array(n).fill(0);
  edges.forEach(function(e) { outDeg[e.from]++; });
  for (var it = 0; it < iters; it++) {
    var newPr = new Array(n).fill((1 - d) / n);
    edges.forEach(function(e) {
      if (outDeg[e.from] > 0) newPr[e.to] += d * pr[e.from] / outDeg[e.from];
    });
    pr = newPr;
  }
  return pr;
}