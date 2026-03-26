/**
 * CrimeNet India — algorithms.js
 * Pure JavaScript DAA engine (mirrors C logic exactly)
 * Used as offline fallback when Node.js backend unavailable
 */
'use strict';

const INF = 1e9;

/* ── Build adjacency list ─ */
function buildAdj(states, edges) {
  const adj = {};
  states.forEach(s => adj[s.id] = []);
  edges.forEach(e => {
    if (adj[e.u] !== undefined) adj[e.u].push({ to: e.v, w: e.w });
    if (adj[e.v] !== undefined) adj[e.v].push({ to: e.u, w: e.w });
  });
  return adj;
}

/* ── BFS — O(V+E) — Crime wave propagation ─ */
function bfsAlgo(states, edges, src) {
  const adj = buildAdj(states, edges);
  const dist = {}, parent = {}, order = [], vis = {};
  states.forEach(s => { dist[s.id] = -1; parent[s.id] = -1; vis[s.id] = false; });
  dist[src] = 0; vis[src] = true;
  const q = [src];
  while (q.length) {
    const u = q.shift();
    order.push(u);
    (adj[u] || []).forEach(({ to }) => {
      if (!vis[to]) { vis[to] = true; dist[to] = dist[u] + 1; parent[to] = u; q.push(to); }
    });
  }
  return { src, order, dist, parent };
}

/* ── DFS — O(V+E) — Deep reachability ─ */
function dfsAlgo(states, edges, src) {
  const adj = buildAdj(states, edges);
  const order = [], depth = {}, vis = {};
  states.forEach(s => { depth[s.id] = -1; vis[s.id] = false; });
  function rec(u, d) {
    vis[u] = true; order.push(u); depth[u] = d;
    (adj[u] || []).forEach(({ to }) => { if (!vis[to]) rec(to, d + 1); });
  }
  rec(src, 0);
  return { src, order, depth };
}

/* ── Dijkstra — O(V²) — Police shortest path ─ */
function dijkstraAlgo(states, edges, src) {
  const dist = {}, prev = {}, vis = {};
  states.forEach(s => { dist[s.id] = INF; prev[s.id] = -1; vis[s.id] = false; });
  dist[src] = 0;
  for (let c = 0; c < states.length - 1; c++) {
    let u = -1;
    states.forEach(s => { if (!vis[s.id] && (u < 0 || dist[s.id] < dist[u])) u = s.id; });
    if (u < 0 || dist[u] === INF) break;
    vis[u] = true;
    edges.forEach(e => {
      const relax = (a, b) => {
        if (!vis[b] && dist[a] + e.w < dist[b]) { dist[b] = dist[a] + e.w; prev[b] = a; }
      };
      if (e.u === u) relax(u, e.v);
      if (e.v === u) relax(u, e.u);
    });
  }
  const distArr = states.map(s => dist[s.id] >= INF ? -1 : dist[s.id]);
  const prevArr = states.map(s => prev[s.id]);
  return { src, dist: distArr, prev: prevArr };
}

/* ── Floyd-Warshall — O(V³) — All-pairs ─ */
function floydAlgo(states, edges) {
  const n = states.length;
  const idx = {}; states.forEach((s, i) => idx[s.id] = i);
  const D = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 0 : INF));
  edges.forEach(e => {
    const a = idx[e.u], b = idx[e.v];
    if (a !== undefined && b !== undefined) {
      D[a][b] = Math.min(D[a][b], e.w);
      D[b][a] = Math.min(D[b][a], e.w);
    }
  });
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (D[i][k] < INF && D[k][j] < INF && D[i][k] + D[k][j] < D[i][j])
          D[i][j] = D[i][k] + D[k][j];
  return D.slice(0, Math.min(n, 12)).map(row => row.map(v => v >= INF ? -1 : v));
}

/* ── Kruskal MST — O(E log E) ─ */
function kruskalAlgo(states, edges) {
  const par = {}, rnk = {};
  states.forEach(s => { par[s.id] = s.id; rnk[s.id] = 0; });
  function find(x) { if (par[x] !== x) par[x] = find(par[x]); return par[x]; }
  function unite(a, b) {
    const ra = find(a), rb = find(b); if (ra === rb) return false;
    if (rnk[ra] < rnk[rb]) par[ra] = rb;
    else if (rnk[ra] > rnk[rb]) par[rb] = ra;
    else { par[rb] = ra; rnk[ra]++; }
    return true;
  }
  const sorted = [...edges].sort((a, b) => a.w - b.w);
  const mstEdges = [];
  let totalW = 0, totalAll = edges.reduce((s, e) => s + e.w, 0);
  sorted.forEach(e => { if (unite(e.u, e.v)) { mstEdges.push(e); totalW += e.w; } });
  return { mstEdges, totalW, totalAll };
}

/* ── Betweenness Centrality ─ */
function betweennessAlgo(states, edges) {
  const adj = buildAdj(states, edges);
  const score = {}; states.forEach(s => score[s.id] = 0);
  states.forEach(src => {
    const cnt = {}, dist2 = {}, stk = [], pred = {};
    states.forEach(s => { cnt[s.id] = 0; dist2[s.id] = -1; pred[s.id] = []; });
    cnt[src.id] = 1; dist2[src.id] = 0;
    const q = [src.id];
    while (q.length) {
      const u = q.shift(); stk.push(u);
      (adj[u] || []).forEach(({ to: v }) => {
        if (dist2[v] < 0) { dist2[v] = dist2[u] + 1; q.push(v); }
        if (dist2[v] === dist2[u] + 1) { cnt[v] += cnt[u]; pred[v].push(u); }
      });
    }
    const dep = {}; states.forEach(s => dep[s.id] = 0);
    while (stk.length) {
      const v = stk.pop();
      pred[v].forEach(u => { dep[u] += (cnt[u] / cnt[v]) * (1 + dep[v]); });
      if (v !== src.id) score[v] += dep[v];
    }
  });
  return score;
}

/* ── Build path from Dijkstra prev array ─ */
function buildPath(prev, states, dest) {
  const path = [];
  let v = dest;
  while (v !== -1) { path.unshift(v); v = prev[states.findIndex(s => s.id === v)]; }
  return path;
}

/* ── Run all algorithms ─ */
function runAllAlgos(states, edges, src) {
  const bfs   = bfsAlgo(states, edges, src);
  const dfs   = dfsAlgo(states, edges, src);
  const dijk  = dijkstraAlgo(states, edges, src);
  const floyd = floydAlgo(states, edges);
  const mst   = kruskalAlgo(states, edges);
  const btwn  = betweennessAlgo(states, edges);

  const adj = buildAdj(states, edges);
  const nodes = states.map(s => ({
    ...s,
    degree: (adj[s.id] || []).length,
    betweenness: parseFloat((btwn[s.id] || 0).toFixed(4))
  }));

  return { nodes, edges, bfs, dfs, dijkstra: dijk, floyd, mst };
}