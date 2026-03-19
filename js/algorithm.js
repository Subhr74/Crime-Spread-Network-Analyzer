function setAlgoActive(id) {
  document.querySelectorAll('.algo-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
}

function animateSequence(sequence, delay, onTick, onDone) {
  var step = 0;
  var iv = setInterval(function() {
    if (step >= sequence.length) { clearInterval(iv); if (onDone) onDone(); return; }
    onTick(sequence[step], step);
    draw(); step++;
  }, delay);
}

function runBFS() {
  if (!nodes.length) { logMsg('No nodes.', 'warn'); return; }
  var src = selectedNode !== null ? selectedNode : 0;
  clearViz(); setAlgoActive('btn-bfs');
  document.getElementById('h-algo').textContent = 'BFS';
  logMsg('BFS from: ' + nodes[src].name, 'info');

  var adj     = buildAdj(false);
  var visited = new Array(nodes.length).fill(false);
  var dist    = new Array(nodes.length).fill(-1);
  var parent  = new Array(nodes.length).fill(-1);
  var order   = [];
  var queue   = [src];
  visited[src] = true; dist[src] = 0;

  while (queue.length) {
    var cur = queue.shift(); order.push(cur);
    adj[cur].forEach(function(nb) {
      if (!visited[nb.to]) {
        visited[nb.to] = true; dist[nb.to] = dist[cur] + 1;
        parent[nb.to] = cur; queue.push(nb.to);
      }
    });
  }

  animateSequence(order, 220, function(ni) {
    animNodes.add(ni);
    if (parent[ni] !== -1) highlightEdges.add(parent[ni] + '-' + ni);
  }, function() { logMsg('BFS complete — ' + order.length + ' nodes visited.', 'ok'); });

  var rows = order.map(function(i) {
    return '<div class="result-row"><span class="result-key">' + nodes[i].name + '</span><span class="result-val">' + (dist[i]===0?'SOURCE':'hops='+dist[i]) + '</span></div>';
  }).join('');
  showResult('<div class="result-card"><div class="result-card-title">BFS from ' + nodes[src].name + '</div>' + rows + '</div><div class="path-display">Hop count = crime spread distance from source.</div>');
}

function runDFS() {
  if (!nodes.length) { logMsg('No nodes.', 'warn'); return; }
  var src = selectedNode !== null ? selectedNode : 0;
  clearViz(); setAlgoActive('btn-dfs');
  document.getElementById('h-algo').textContent = 'DFS';
  logMsg('DFS from: ' + nodes[src].name, 'info');

  var adj     = buildAdj(false);
  var visited = new Array(nodes.length).fill(false);
  var disc    = new Array(nodes.length).fill(-1);
  var finish  = new Array(nodes.length).fill(-1);
  var parent  = new Array(nodes.length).fill(-1);
  var order   = []; var timer = 0;

  function dfs(u) {
    visited[u] = true; disc[u] = timer++; order.push(u);
    adj[u].forEach(function(nb) { if (!visited[nb.to]) { parent[nb.to] = u; dfs(nb.to); } });
    finish[u] = timer++;
  }
  dfs(src);
  for (var i = 0; i < nodes.length; i++) if (!visited[i]) dfs(i);

  animateSequence(order, 160, function(ni) {
    animNodes.add(ni);
    if (parent[ni] !== -1) highlightEdges.add(parent[ni] + '-' + ni);
  }, function() { logMsg('DFS complete.', 'ok'); });

  var rows = order.map(function(i) {
    return '<div class="result-row"><span class="result-key">' + nodes[i].name + '</span><span class="result-val">d=' + disc[i] + ' f=' + finish[i] + '</span></div>';
  }).join('');
  showResult('<div class="result-card"><div class="result-card-title">DFS from ' + nodes[src].name + '</div>' + rows + '</div><div class="path-display">d=discovery time, f=finish time. Back edges reveal crime cycles.</div>');
}

function runDijkstra() {
  if (!nodes.length) { logMsg('No nodes.', 'warn'); return; }
  var src = selectedNode !== null ? selectedNode : 0;
  clearViz(); setAlgoActive('btn-dijkstra');
  document.getElementById('h-algo').textContent = 'DIJKSTRA';
  logMsg('Dijkstra from: ' + nodes[src].name, 'info');

  var adj  = buildAdj(false);
  var INF  = 1e9;
  var dist = new Array(nodes.length).fill(INF);
  var prev = new Array(nodes.length).fill(-1);
  var vis  = new Array(nodes.length).fill(false);
  dist[src] = 0;

  for (var iter = 0; iter < nodes.length; iter++) {
    var u = -1;
    for (var v = 0; v < nodes.length; v++)
      if (!vis[v] && (u === -1 || dist[v] < dist[u])) u = v;
    if (u === -1 || dist[u] === INF) break;
    vis[u] = true;
    adj[u].forEach(function(nb) {
      if (dist[u] + nb.w < dist[nb.to]) { dist[nb.to] = dist[u] + nb.w; prev[nb.to] = u; }
    });
  }

  var farthest = -1, farthestDist = 0;
  dist.forEach(function(d, i) { if (d < INF && d > farthestDist && i !== src) { farthest = i; farthestDist = d; } });

  if (farthest !== -1) {
    var path = []; var cur = farthest;
    while (cur !== -1) { path.unshift(cur); cur = prev[cur]; }
    dijkstraPath = path;
    path.forEach(function(n) { animNodes.add(n); }); draw();
    logMsg('Spread path: ' + path.map(function(i){return nodes[i].name;}).join('→') + ' cost=' + farthestDist, 'danger');

    var rows = dist.map(function(d, i) {
      return '<div class="result-row"><span class="result-key">' + nodes[i].name + '</span><span class="result-val ' + (d===INF?'danger':d>5?'amber':'') + '">' + (d===INF?'isolated':d===0?'SOURCE':'cost='+d) + '</span></div>';
    }).join('');
    showResult('<div class="result-card"><div class="result-card-title">Dijkstra from ' + nodes[src].name + '</div>' + rows + '</div><div class="path-display" style="border-left-color:var(--accent)">Worst spread path cost=' + farthestDist + '<br>' + path.map(function(i){return nodes[i].name;}).join(' → ') + '</div>');
  } else {
    logMsg('No reachable nodes.', 'warn');
  }
}

function runBridges() {
  if (nodes.length < 2) { logMsg('Need at least 2 nodes.', 'warn'); return; }
  clearViz(); setAlgoActive('btn-bridges');
  document.getElementById('h-algo').textContent = 'BRIDGES';
  logMsg('Running Tarjan bridge detection…', 'info');

  var adj  = buildAdj(false);
  var disc = new Array(nodes.length).fill(-1);
  var low  = new Array(nodes.length).fill(-1);
  var timer = 0; var bridges = [];

  function dfs(u, par) {
    disc[u] = low[u] = timer++;
    adj[u].forEach(function(nb) {
      if (disc[nb.to] === -1) {
        dfs(nb.to, u);
        low[u] = Math.min(low[u], low[nb.to]);
        if (low[nb.to] > disc[u]) bridges.push([u, nb.to]);
      } else if (nb.to !== par) {
        low[u] = Math.min(low[u], disc[nb.to]);
      }
    });
  }
  for (var i = 0; i < nodes.length; i++) if (disc[i] === -1) dfs(i, -1);

  bridges.forEach(function(b) {
    bridgeEdges.add(b[0]+'-'+b[1]); bridgeEdges.add(b[1]+'-'+b[0]);
    animNodes.add(b[0]); animNodes.add(b[1]);
  }); draw();

  if (bridges.length) {
    var rows = bridges.map(function(b) {
      return '<div class="result-row"><span class="result-key">' + nodes[b[0]].name + '</span><span class="result-val danger">↔ ' + nodes[b[1]].name + '</span></div>';
    }).join('');
    showResult('<div class="result-card"><div class="result-card-title">Bridges (' + bridges.length + ') — Critical Links</div>' + rows + '</div><div class="path-display" style="border-left-color:var(--accent2)">Shown in orange. Remove these to fragment the network.</div>');
    logMsg('Found ' + bridges.length + ' bridge(s).', 'danger');
  } else {
    showResult('<div class="result-card"><div class="result-card-title">No Bridges Found</div><div class="empty-state" style="padding:10px 0">Network is well-connected.</div></div>');
    logMsg('No bridges found.', 'ok');
  }
}

function runSCC() {
  if (!nodes.length) { logMsg('No nodes.', 'warn'); return; }
  clearViz(); setAlgoActive('btn-scc');
  document.getElementById('h-algo').textContent = 'SCC';
  logMsg('Running Kosaraju SCC…', 'info');

  var n    = nodes.length;
  var adj  = buildAdj(true);
  var radj = Array.from({ length: n }, function() { return []; });
  edges.forEach(function(e) { radj[e.to].push(e.from); });

  var visited = new Array(n).fill(false);
  var order   = [];
  function dfs1(u) {
    visited[u] = true;
    adj[u].forEach(function(nb) { if (!visited[nb.to]) dfs1(nb.to); });
    order.push(u);
  }
  for (var i = 0; i < n; i++) if (!visited[i]) dfs1(i);

  var comp = new Array(n).fill(-1); var c = 0;
  function dfs2(u, c) {
    comp[u] = c;
    radj[u].forEach(function(v) { if (comp[v] === -1) dfs2(v, c); });
  }
  for (var j = n - 1; j >= 0; j--) { if (comp[order[j]] === -1) { dfs2(order[j], c); c++; } }

  comp.forEach(function(ci, i) { sccColors[i] = SCC_PALETTE[ci % SCC_PALETTE.length]; animNodes.add(i); });
  draw();

  var groups = {};
  comp.forEach(function(ci, i) { if (!groups[ci]) groups[ci] = []; groups[ci].push(i); });
  var rows = Object.entries(groups).sort(function(a,b){return b[1].length-a[1].length;}).map(function(entry) {
    var ci = entry[0], members = entry[1];
    return '<div class="result-row"><span class="result-key" style="color:' + SCC_PALETTE[ci%SCC_PALETTE.length] + '">Cluster-' + (parseInt(ci)+1) + ' (' + members.length + ')</span><span class="result-val" style="color:' + SCC_PALETTE[ci%SCC_PALETTE.length] + ';font-size:10px">' + members.map(function(i){return nodes[i].name;}).join(', ') + '</span></div>';
  }).join('');
  showResult('<div class="result-card"><div class="result-card-title">SCC — ' + c + ' Clusters</div>' + rows + '</div><div class="path-display" style="border-left-color:var(--amber)">Each color = one criminal cluster. Same cluster = can reach each other.</div>');
  logMsg('SCC: ' + c + ' component(s) found.', 'ok');
}

function runPageRank() {
  if (!nodes.length) { logMsg('No nodes.', 'warn'); return; }
  clearViz(); setAlgoActive('btn-pagerank');
  document.getElementById('h-algo').textContent = 'PAGERANK';
  logMsg('Computing PageRank…', 'info');

  var n = nodes.length, d = 0.85, iters = 60;
  var pr = new Array(n).fill(1 / n);
  var outDeg = new Array(n).fill(0);
  edges.forEach(function(e) { outDeg[e.from]++; });

  for (var it = 0; it < iters; it++) {
    var newPr = new Array(n).fill((1 - d) / n);
    edges.forEach(function(e) { if (outDeg[e.from] > 0) newPr[e.to] += d * pr[e.from] / outDeg[e.from]; });
    pr = newPr;
  }

  nodes.forEach(function(nd, i) { nd.pagerank = pr[i]; prSizes[i] = pr[i] * 14; animNodes.add(i); });
  draw(); updateUI();

  var sorted = pr.map(function(v,i){return{i:i,v:v};}).sort(function(a,b){return b.v-a.v;});
  var top = nodes[sorted[0].i];
  document.getElementById('h-top').textContent = top.name.slice(0, 7);

  var rows = sorted.map(function(s) {
    return '<div class="result-row"><span class="result-key">' + nodes[s.i].name + '</span><span class="result-val ' + (s.v>0.15?'danger':s.v>0.07?'amber':'') + '">' + (s.v*100).toFixed(2) + '%</span></div>';
  }).join('');
  showResult('<div class="result-card"><div class="result-card-title">PageRank — Influence Scores</div>' + rows + '</div><div class="path-display" style="border-left-color:var(--amber)">Top suspect: <span style="color:var(--accent)">' + top.name + ' (' + (top.pagerank*100).toFixed(2) + '%)</span><br>Larger node = higher rank.</div>');
  logMsg('Top node: ' + top.name + ' (' + (top.pagerank*100).toFixed(2) + '%)', 'danger');
}

function runMST() {
  if (nodes.length < 2) { logMsg('Need at least 2 nodes.', 'warn'); return; }
  clearViz(); setAlgoActive('btn-mst');
  document.getElementById('h-algo').textContent = 'MST';
  logMsg("Running Prim's MST…", 'info');

  var adj = buildAdj(false);
  var INF = 1e9;
  var inMST   = new Array(nodes.length).fill(false);
  var minEdge = new Array(nodes.length).fill(INF);
  var parent  = new Array(nodes.length).fill(-1);
  minEdge[0]  = 0;
  var result = [], totalCost = 0;

  for (var iter = 0; iter < nodes.length; iter++) {
    var u = -1;
    for (var v = 0; v < nodes.length; v++)
      if (!inMST[v] && (u === -1 || minEdge[v] < minEdge[u])) u = v;
    if (minEdge[u] === INF) break;
    inMST[u] = true; totalCost += minEdge[u];
    if (parent[u] !== -1) result.push([parent[u], u, minEdge[u]]);
    adj[u].forEach(function(nb) {
      if (!inMST[nb.to] && nb.w < minEdge[nb.to]) { minEdge[nb.to] = nb.w; parent[nb.to] = u; }
    });
  }

  result.forEach(function(r) {
    bridgeEdges.add(r[0]+'-'+r[1]); bridgeEdges.add(r[1]+'-'+r[0]);
    animNodes.add(r[0]); animNodes.add(r[1]);
  }); draw();

  var rows = result.map(function(r) {
    return '<div class="result-row"><span class="result-key">' + nodes[r[0]].name + ' → ' + nodes[r[1]].name + '</span><span class="result-val amber">w=' + r[2] + '</span></div>';
  }).join('');
  showResult('<div class="result-card"><div class="result-card-title">MST Patrol Route — Total Cost: ' + totalCost + '</div>' + rows + '</div><div class="path-display" style="border-left-color:var(--amber)">Optimal patrol covering all zones with minimum distance.</div>');
  logMsg("Prim's MST done. Total cost = " + totalCost, 'ok');
}