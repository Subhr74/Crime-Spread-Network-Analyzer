/*
 * ============================================================
 * Crime Spread Network Analyzer - Core Algorithm Engine
 * DAA Project: Graph-Based Crime Analysis System
 * ============================================================
 * 
 * DAA Concepts Implemented:
 *   - Graph Representation (Adjacency Matrix + List)
 *   - BFS  : O(V+E) - Breadth-First crime spread simulation
 *   - DFS  : O(V+E) - Depth-First reachability check
 *   - Dijkstra : O((V+E) log V) - Police shortest path
 *   - Floyd-Warshall : O(V^3) - All-pairs shortest distances
 *   - Kruskal's MST : O(E log E) - Patrol network optimization
 * ============================================================
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include <stdbool.h>

/* ─── Constants ─────────────────────────────────────────── */
#define MAX_NODES    50
#define INF          INT_MAX
#define MAX_EDGES    (MAX_NODES * MAX_NODES)

/* ─── Data Structures ────────────────────────────────────── */

/* Adjacency List Node */
typedef struct AdjNode {
    int dest;
    int weight;
    struct AdjNode *next;
} AdjNode;

/* Edge for Kruskal's */
typedef struct {
    int src, dest, weight;
} Edge;

/* Main Graph */
typedef struct {
    int n;                            /* number of nodes  */
    int m;                            /* number of edges  */
    int matrix[MAX_NODES][MAX_NODES]; /* adjacency matrix */
    AdjNode *list[MAX_NODES];         /* adjacency list   */
    char names[MAX_NODES][64];        /* location names   */
    int crimeLevel[MAX_NODES];        /* 0-10 risk level  */
    Edge edges[MAX_EDGES];
} Graph;

/* ─── Graph Initialization ───────────────────────────────── */
void initGraph(Graph *g, int n) {
    g->n = n;
    g->m = 0;
    for (int i = 0; i < n; i++) {
        g->list[i] = NULL;
        g->crimeLevel[i] = 0;
        snprintf(g->names[i], 64, "Zone-%d", i);
        for (int j = 0; j < n; j++)
            g->matrix[i][j] = (i == j) ? 0 : INF;
    }
}

/* Add directed weighted edge */
void addEdge(Graph *g, int u, int v, int w) {
    /* Adjacency Matrix */
    g->matrix[u][v] = w;
    g->matrix[v][u] = w; /* undirected */

    /* Adjacency List */
    AdjNode *node1 = (AdjNode*)malloc(sizeof(AdjNode));
    node1->dest = v; node1->weight = w;
    node1->next = g->list[u];
    g->list[u] = node1;

    AdjNode *node2 = (AdjNode*)malloc(sizeof(AdjNode));
    node2->dest = u; node2->weight = w;
    node2->next = g->list[v];
    g->list[v] = node2;

    /* Edge list for Kruskal */
    g->edges[g->m].src = u;
    g->edges[g->m].dest = v;
    g->edges[g->m].weight = w;
    g->m++;
}

/* ─── BFS: Crime Spread Simulation ──────────────────────────
 * Time: O(V+E)  Space: O(V)
 * Models how crime propagates from a source zone outward
 * through connected regions, level by level.
 */
void bfs(Graph *g, int src, int *visited, int *order, int *orderLen, int *dist) {
    int queue[MAX_NODES];
    int front = 0, rear = 0;
    for (int i = 0; i < g->n; i++) { visited[i] = 0; dist[i] = -1; }
    *orderLen = 0;

    visited[src] = 1;
    dist[src] = 0;
    queue[rear++] = src;

    while (front < rear) {
        int u = queue[front++];
        order[(*orderLen)++] = u;

        AdjNode *tmp = g->list[u];
        while (tmp) {
            int v = tmp->dest;
            if (!visited[v]) {
                visited[v] = 1;
                dist[v] = dist[u] + 1;
                queue[rear++] = v;
            }
            tmp = tmp->next;
        }
    }
}

/* ─── DFS: Reachability Check ────────────────────────────────
 * Time: O(V+E)  Space: O(V) stack
 * Explores as deep as possible - used to check if a crime
 * network can reach a specific zone (reachability analysis).
 */
void dfsHelper(Graph *g, int u, int *visited, int *order, int *orderLen) {
    visited[u] = 1;
    order[(*orderLen)++] = u;
    AdjNode *tmp = g->list[u];
    while (tmp) {
        if (!visited[tmp->dest])
            dfsHelper(g, tmp->dest, visited, order, orderLen);
        tmp = tmp->next;
    }
}

void dfs(Graph *g, int src, int *visited, int *order, int *orderLen) {
    for (int i = 0; i < g->n; i++) visited[i] = 0;
    *orderLen = 0;
    dfsHelper(g, src, visited, order, orderLen);
}

/* ─── Dijkstra: Police Shortest Path ────────────────────────
 * Time: O(V^2) with matrix (simple version for C portability)
 * Finds the fastest police route from HQ to any crime scene.
 * Edge weights = travel time / crime resistance.
 */
void dijkstra(Graph *g, int src, int *dist, int *prev) {
    bool visited[MAX_NODES] = {false};
    for (int i = 0; i < g->n; i++) { dist[i] = INF; prev[i] = -1; }
    dist[src] = 0;

    for (int count = 0; count < g->n - 1; count++) {
        /* Pick minimum distance unvisited vertex */
        int u = -1;
        for (int v = 0; v < g->n; v++)
            if (!visited[v] && (u == -1 || dist[v] < dist[u]))
                u = v;
        if (u == -1 || dist[u] == INF) break;
        visited[u] = true;

        /* Relax neighbors */
        for (int v = 0; v < g->n; v++) {
            if (!visited[v] && g->matrix[u][v] != INF) {
                long long nd = (long long)dist[u] + g->matrix[u][v];
                if (nd < dist[v]) {
                    dist[v] = (int)nd;
                    prev[v] = u;
                }
            }
        }
    }
}

/* ─── Floyd-Warshall: All-Pairs Shortest Paths ───────────────
 * Time: O(V^3)  Space: O(V^2)
 * Builds complete distance table between every pair of zones.
 * Used for command center strategic overview.
 */
void floydWarshall(Graph *g, int dist[MAX_NODES][MAX_NODES]) {
    /* Init from adjacency matrix */
    for (int i = 0; i < g->n; i++)
        for (int j = 0; j < g->n; j++)
            dist[i][j] = g->matrix[i][j];

    /* DP relaxation through intermediate vertices */
    for (int k = 0; k < g->n; k++)
        for (int i = 0; i < g->n; i++)
            for (int j = 0; j < g->n; j++)
                if (dist[i][k] != INF && dist[k][j] != INF)
                    if (dist[i][k] + dist[k][j] < dist[i][j])
                        dist[i][j] = dist[i][k] + dist[k][j];
}

/* ─── Union-Find for Kruskal's ───────────────────────────── */
int parent[MAX_NODES], rank_[MAX_NODES];

int find(int x) {
    if (parent[x] != x) parent[x] = find(parent[x]); /* path compression */
    return parent[x];
}

void unite(int a, int b) {
    int ra = find(a), rb = find(b);
    if (ra == rb) return;
    if (rank_[ra] < rank_[rb]) { int t=ra; ra=rb; rb=t; }
    parent[rb] = ra;
    if (rank_[ra] == rank_[rb]) rank_[ra]++;
}

int cmpEdge(const void *a, const void *b) {
    return ((Edge*)a)->weight - ((Edge*)b)->weight;
}

/* ─── Kruskal's MST: Minimum Patrol Network ─────────────────
 * Time: O(E log E)
 * Finds minimum spanning tree = optimal patrol network that
 * covers all zones with minimum total travel distance.
 */
int kruskalMST(Graph *g, Edge *mstEdges) {
    for (int i = 0; i < g->n; i++) { parent[i] = i; rank_[i] = 0; }

    Edge sorted[MAX_EDGES];
    memcpy(sorted, g->edges, g->m * sizeof(Edge));
    qsort(sorted, g->m, sizeof(Edge), cmpEdge);

    int totalWeight = 0, count = 0;
    for (int i = 0; i < g->m && count < g->n - 1; i++) {
        int u = sorted[i].src, v = sorted[i].dest;
        if (find(u) != find(v)) {
            unite(u, v);
            mstEdges[count++] = sorted[i];
            totalWeight += sorted[i].weight;
        }
    }
    return totalWeight;
}

/* ─── Utility: Reconstruct Dijkstra Path ──────────────────── */
void getPath(int *prev, int dest, int *path, int *pathLen) {
    *pathLen = 0;
    for (int v = dest; v != -1; v = prev[v])
        path[(*pathLen)++] = v;
    /* Reverse */
    for (int i = 0, j = *pathLen-1; i < j; i++, j--) {
        int t = path[i]; path[i] = path[j]; path[j] = t;
    }
}

/* ─── Detect High-Risk Zones ──────────────────────────────── */
/* A node is high-risk if it has high degree AND high crimeLevel */
void detectHighRisk(Graph *g, int *degree, int *highRisk, int *hrCount) {
    *hrCount = 0;
    int maxDeg = 0;
    for (int i = 0; i < g->n; i++) {
        degree[i] = 0;
        AdjNode *tmp = g->list[i];
        while (tmp) { degree[i]++; tmp = tmp->next; }
        if (degree[i] > maxDeg) maxDeg = degree[i];
    }
    int threshold = maxDeg / 2;
    for (int i = 0; i < g->n; i++)
        if (degree[i] >= threshold || g->crimeLevel[i] >= 7)
            highRisk[(*hrCount)++] = i;
}

/* ─── JSON Escape Helper ──────────────────────────────────── */
void jsonStr(const char *s) {
    putchar('"');
    for (; *s; s++) {
        if (*s == '"' || *s == '\\') putchar('\\');
        putchar(*s);
    }
    putchar('"');
}

/* ─── Main JSON Output ────────────────────────────────────── */
void outputJSON(Graph *g, int bfsOrder[], int bfsLen, int bfsDist[],
                int dfsOrder[], int dfsLen,
                int dijkDist[], int dijkPrev[], int dijkSrc,
                int fwDist[MAX_NODES][MAX_NODES],
                Edge mstEdges[], int mstTotal,
                int degree[], int highRisk[], int hrCount) {

    printf("{\n");

    /* Nodes */
    printf("  \"nodes\": [\n");
    for (int i = 0; i < g->n; i++) {
        printf("    {\"id\":%d,\"name\":", i);
        jsonStr(g->names[i]);
        printf(",\"crimeLevel\":%d,\"degree\":%d}", g->crimeLevel[i], degree[i]);
        if (i < g->n-1) printf(",");
        printf("\n");
    }
    printf("  ],\n");

    /* Edges */
    printf("  \"edges\": [\n");
    bool first = true;
    for (int i = 0; i < g->n; i++)
        for (int j = i+1; j < g->n; j++)
            if (g->matrix[i][j] != INF) {
                if (!first) printf(",\n");
                printf("    {\"source\":%d,\"target\":%d,\"weight\":%d}", i, j, g->matrix[i][j]);
                first = false;
            }
    printf("\n  ],\n");

    /* BFS */
    printf("  \"bfs\": {\"source\":%d,\"order\":[", dijkSrc);
    for (int i = 0; i < bfsLen; i++) { if(i) printf(","); printf("%d", bfsOrder[i]); }
    printf("],\"distances\":[");
    for (int i = 0; i < g->n; i++) { if(i) printf(","); printf("%d", bfsDist[i]); }
    printf("]},\n");

    /* DFS */
    printf("  \"dfs\": {\"source\":%d,\"order\":[", dijkSrc);
    for (int i = 0; i < dfsLen; i++) { if(i) printf(","); printf("%d", dfsOrder[i]); }
    printf("]},\n");

    /* Dijkstra */
    printf("  \"dijkstra\": {\"source\":%d,\"distances\":[", dijkSrc);
    for (int i = 0; i < g->n; i++) {
        if(i) printf(",");
        if (dijkDist[i] == INF) printf("-1"); else printf("%d", dijkDist[i]);
    }
    printf("],\"prev\":[");
    for (int i = 0; i < g->n; i++) { if(i) printf(","); printf("%d", dijkPrev[i]); }
    printf("]},\n");

    /* Floyd-Warshall (first 5 rows for brevity) */
    int rows = g->n < 8 ? g->n : 8;
    printf("  \"floydWarshall\": [\n");
    for (int i = 0; i < rows; i++) {
        printf("    [");
        for (int j = 0; j < g->n; j++) {
            if(j) printf(",");
            if (fwDist[i][j] == INF) printf("-1"); else printf("%d", fwDist[i][j]);
        }
        printf("]");
        if (i < rows-1) printf(",");
        printf("\n");
    }
    printf("  ],\n");

    /* MST */
    printf("  \"mst\": {\"totalWeight\":%d,\"edges\":[\n", mstTotal);
    for (int i = 0; i < g->n-1; i++) {
        printf("    {\"source\":%d,\"target\":%d,\"weight\":%d}", mstEdges[i].src, mstEdges[i].dest, mstEdges[i].weight);
        if (i < g->n-2) printf(",");
        printf("\n");
    }
    printf("  ]},\n");

    /* High Risk */
    printf("  \"highRisk\": [");
    for (int i = 0; i < hrCount; i++) { if(i) printf(","); printf("%d", highRisk[i]); }
    printf("]\n}\n");
}

/* ═══════════════════════════════════════════════════════════
 * MAIN ENTRY POINT
 * Reads JSON input from stdin, runs all algorithms, outputs JSON
 * ═══════════════════════════════════════════════════════════ */
int main() {
    Graph g;
    int n, m, src = 0;

    /* Read: n m src */
    scanf("%d %d %d", &n, &m, &src);
    initGraph(&g, n);

    /* Read node names and crime levels */
    for (int i = 0; i < n; i++) {
        int cl;
        char name[64];
        scanf("%s %d", name, &cl);
        strncpy(g.names[i], name, 63);
        g.crimeLevel[i] = cl;
    }

    /* Read edges: u v w */
    for (int i = 0; i < m; i++) {
        int u, v, w;
        scanf("%d %d %d", &u, &v, &w);
        addEdge(&g, u, v, w);
    }

    /* Run all algorithms */
    int bfsOrder[MAX_NODES], bfsLen=0, bfsDist[MAX_NODES], bfsVis[MAX_NODES];
    bfs(&g, src, bfsVis, bfsOrder, &bfsLen, bfsDist);

    int dfsOrder[MAX_NODES], dfsLen=0, dfsVis[MAX_NODES];
    dfs(&g, src, dfsVis, dfsOrder, &dfsLen);

    int dijkDist[MAX_NODES], dijkPrev[MAX_NODES];
    dijkstra(&g, src, dijkDist, dijkPrev);

    int fwDist[MAX_NODES][MAX_NODES];
    floydWarshall(&g, fwDist);

    Edge mstEdges[MAX_NODES];
    int mstTotal = kruskalMST(&g, mstEdges);

    int degree[MAX_NODES], highRisk[MAX_NODES], hrCount=0;
    detectHighRisk(&g, degree, highRisk, &hrCount);

    outputJSON(&g, bfsOrder, bfsLen, bfsDist,
               dfsOrder, dfsLen,
               dijkDist, dijkPrev, src,
               fwDist, mstEdges, mstTotal,
               degree, highRisk, hrCount);

    /* Free adjacency list memory */
    for (int i = 0; i < n; i++) {
        AdjNode *cur = g.list[i];
        while (cur) { AdjNode *nx = cur->next; free(cur); cur = nx; }
    }
    return 0;
}