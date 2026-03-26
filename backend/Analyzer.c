/*
 * ================================================================
 *  CrimeNet India — Core Algorithm Engine (C)
 *  DAA Project: National Crime Spread Analysis
 *  Data: NCRB 2023 — All 36 States & Union Territories
 * ================================================================
 *  Algorithms:
 *   BFS            O(V+E)   — crime wave propagation
 *   DFS            O(V+E)   — deep reachability
 *   Dijkstra       O(V²)    — police shortest path
 *   Floyd-Warshall O(V³)    — all-pairs distances
 *   Kruskal MST    O(E logE)— optimal patrol network
 *   Betweenness    O(V·E)   — hotspot centrality
 * ================================================================
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include <math.h>
#include <stdbool.h>

#define MAX_N    70
#define MAX_E    (MAX_N * MAX_N)
#define INF      INT_MAX

typedef struct AdjNode { int dest, w; struct AdjNode *next; } AdjNode;
typedef struct { int u, v, w; } Edge;

typedef struct {
    int  n, m, src;
    AdjNode *adj[MAX_N];
    char  name[MAX_N][64];
    char  capital[MAX_N][64];
    char  shortCode[MAX_N][8];
    double lat[MAX_N], lng[MAX_N];
    double crimeRate[MAX_N];
    double violent[MAX_N];
    double murder[MAX_N];
    double rape[MAX_N];
    double kidnap[MAX_N];
    double robbery[MAX_N];
    int   cyber[MAX_N];
    int   corruption[MAX_N];
    long  population[MAX_N];
    int   mat[MAX_N][MAX_N];
    Edge  edges[MAX_E];
} Graph;

void gInit(Graph *g, int n) {
    g->n=n; g->m=0;
    for(int i=0;i<n;i++){
        g->adj[i]=NULL;
        for(int j=0;j<n;j++) g->mat[i][j]=(i==j)?0:INF;
    }
}

void gAddEdge(Graph *g, int u, int v, int w){
    g->mat[u][v]=w; g->mat[v][u]=w;
    AdjNode *a=malloc(sizeof(AdjNode)); a->dest=v; a->w=w; a->next=g->adj[u]; g->adj[u]=a;
    AdjNode *b=malloc(sizeof(AdjNode)); b->dest=u; b->w=w; b->next=g->adj[v]; g->adj[v]=b;
    g->edges[g->m++]=(Edge){u,v,w};
}

/* ── BFS ── O(V+E) ── */
typedef struct { int order[MAX_N],len,dist[MAX_N],parent[MAX_N]; } BFSResult;
void bfs(Graph *g, int src, BFSResult *r){
    int q[MAX_N],front=0,rear=0; bool vis[MAX_N]={false};
    for(int i=0;i<g->n;i++){r->dist[i]=-1;r->parent[i]=-1;}
    r->len=0; vis[src]=true; r->dist[src]=0; q[rear++]=src;
    while(front<rear){
        int u=q[front++]; r->order[r->len++]=u;
        AdjNode *t=g->adj[u];
        while(t){int v=t->dest; if(!vis[v]){vis[v]=true;r->dist[v]=r->dist[u]+1;r->parent[v]=u;q[rear++]=v;} t=t->next;}
    }
}

/* ── DFS ── O(V+E) ── */
typedef struct { int order[MAX_N],len,depth[MAX_N]; } DFSResult;
void dfsRec(Graph *g,int u,int d,bool*vis,DFSResult*r){
    vis[u]=true; r->order[r->len++]=u; r->depth[u]=d;
    AdjNode*t=g->adj[u]; while(t){if(!vis[t->dest])dfsRec(g,t->dest,d+1,vis,r);t=t->next;}
}
void dfs(Graph *g,int src,DFSResult*r){
    bool vis[MAX_N]={false}; for(int i=0;i<g->n;i++)r->depth[i]=-1; r->len=0; dfsRec(g,src,0,vis,r);
}

/* ── Dijkstra ── O(V²) ── */
typedef struct { int dist[MAX_N],prev[MAX_N]; } DijkResult;
void dijkstra(Graph *g,int src,DijkResult*r){
    bool vis[MAX_N]={false};
    for(int i=0;i<g->n;i++){r->dist[i]=INF;r->prev[i]=-1;} r->dist[src]=0;
    for(int c=0;c<g->n-1;c++){
        int u=-1; for(int v=0;v<g->n;v++) if(!vis[v]&&(u<0||r->dist[v]<r->dist[u]))u=v;
        if(u<0||r->dist[u]==INF)break; vis[u]=true;
        for(int v=0;v<g->n;v++) if(!vis[v]&&g->mat[u][v]!=INF){
            long long nd=(long long)r->dist[u]+g->mat[u][v];
            if(nd<r->dist[v]){r->dist[v]=(int)nd;r->prev[v]=u;}
        }
    }
}

/* ── Floyd-Warshall ── O(V³) ── */
void floyd(Graph *g,int D[MAX_N][MAX_N]){
    for(int i=0;i<g->n;i++) for(int j=0;j<g->n;j++) D[i][j]=g->mat[i][j];
    for(int k=0;k<g->n;k++) for(int i=0;i<g->n;i++) for(int j=0;j<g->n;j++)
        if(D[i][k]!=INF&&D[k][j]!=INF&&D[i][k]+D[k][j]<D[i][j]) D[i][j]=D[i][k]+D[k][j];
}

/* ── Kruskal MST ── O(E logE) ── */
int par[MAX_N],rnk[MAX_N];
int find_(int x){if(par[x]!=x)par[x]=find_(par[x]);return par[x];}
bool unite(int a,int b){int ra=find_(a),rb=find_(b);if(ra==rb)return false;
    if(rnk[ra]<rnk[rb]){int t=ra;ra=rb;rb=t;} par[rb]=ra; if(rnk[ra]==rnk[rb])rnk[ra]++; return true;}
int cmpE(const void*a,const void*b){return((Edge*)a)->w-((Edge*)b)->w;}
typedef struct{Edge mst[MAX_N];int cnt,totalW,totalAll;} MSTResult;
void kruskal(Graph *g,MSTResult*r){
    for(int i=0;i<g->n;i++){par[i]=i;rnk[i]=0;}
    Edge sorted[MAX_E]; memcpy(sorted,g->edges,g->m*sizeof(Edge));
    qsort(sorted,g->m,sizeof(Edge),cmpE);
    r->cnt=0;r->totalW=0;r->totalAll=0;
    for(int i=0;i<g->m;i++)r->totalAll+=g->edges[i].w;
    for(int i=0;i<g->m&&r->cnt<g->n-1;i++)
        if(unite(sorted[i].u,sorted[i].v)){r->mst[r->cnt++]=sorted[i];r->totalW+=sorted[i].w;}
}

/* ── Betweenness Centrality ── */
void betweenness(Graph *g,double*score){
    for(int i=0;i<g->n;i++)score[i]=0.0;
    for(int s=0;s<g->n;s++){
        int cnt[MAX_N]={0},dist2[MAX_N],stk[MAX_N],stop=0;
        bool vis[MAX_N]={false};
        int q[MAX_N],front=0,rear=0;
        int pred[MAX_N][MAX_N],predCnt[MAX_N]={0};
        for(int i=0;i<g->n;i++){dist2[i]=-1;cnt[i]=0;}
        dist2[s]=0;cnt[s]=1;vis[s]=true;q[rear++]=s;
        while(front<rear){
            int u=q[front++];stk[stop++]=u;
            AdjNode*t=g->adj[u];
            while(t){int v=t->dest;
                if(!vis[v]){vis[v]=true;dist2[v]=dist2[u]+1;q[rear++]=v;}
                if(dist2[v]==dist2[u]+1){cnt[v]+=cnt[u];if(predCnt[v]<MAX_N)pred[v][predCnt[v]++]=u;}
                t=t->next;
            }
        }
        double dep[MAX_N]={0};
        while(stop>0){int v=stk[--stop];
            for(int k=0;k<predCnt[v];k++){int u=pred[v][k];dep[u]+=(double)cnt[u]/cnt[v]*(1.0+dep[v]);}
            if(v!=s)score[v]+=dep[v];
        }
    }
}

void computeDegree(Graph *g,int*deg){
    for(int i=0;i<g->n;i++){deg[i]=0;AdjNode*t=g->adj[i];while(t){deg[i]++;t=t->next;}}
}

void jStr(const char*s){putchar('"');for(;*s;s++){if(*s=='"'||*s=='\\')putchar('\\');putchar(*s);}putchar('"');}

int main(){
    Graph g; int n,m,src;
    scanf("%d %d %d",&n,&m,&src);
    gInit(&g,n); g.src=src;

    for(int i=0;i<n;i++){
        char nm[64],cap[64],code[8]; double lat,lng,cr,viol,mur,rp,kid,rob; int cyb,corr; long pop;
        scanf("%s %s %s %lf %lf %lf %lf %lf %lf %lf %lf %d %d %ld",
              nm,cap,code,&lat,&lng,&cr,&viol,&mur,&rp,&kid,&rob,&cyb,&corr,&pop);
        strncpy(g.name[i],nm,63); strncpy(g.capital[i],cap,63); strncpy(g.shortCode[i],code,7);
        g.lat[i]=lat; g.lng[i]=lng; g.crimeRate[i]=cr; g.violent[i]=viol;
        g.murder[i]=mur; g.rape[i]=rp; g.kidnap[i]=kid; g.robbery[i]=rob;
        g.cyber[i]=cyb; g.corruption[i]=corr; g.population[i]=pop;
    }
    for(int i=0;i<m;i++){int u,v,w;scanf("%d %d %d",&u,&v,&w);gAddEdge(&g,u,v,w);}

    BFSResult bfsR; bfs(&g,src,&bfsR);
    DFSResult dfsR; dfs(&g,src,&dfsR);
    DijkResult dkR; dijkstra(&g,src,&dkR);
    int FW[MAX_N][MAX_N]; floyd(&g,FW);
    MSTResult mstR; kruskal(&g,&mstR);
    double btwn[MAX_N]; betweenness(&g,btwn);
    int deg[MAX_N]; computeDegree(&g,deg);

    printf("{\n\"nodes\":[\n");
    for(int i=0;i<n;i++){
        printf("{\"id\":%d,\"name\":",i); jStr(g.name[i]);
        printf(",\"capital\":"); jStr(g.capital[i]);
        printf(",\"short\":"); jStr(g.shortCode[i]);
        printf(",\"lat\":%.6f,\"lng\":%.6f",g.lat[i],g.lng[i]);
        printf(",\"crimeRate\":%.1f,\"violent\":%.1f",g.crimeRate[i],g.violent[i]);
        printf(",\"murder\":%.1f,\"rape\":%.1f,\"kidnap\":%.1f,\"robbery\":%.1f",g.murder[i],g.rape[i],g.kidnap[i],g.robbery[i]);
        printf(",\"cyber\":%d,\"corruption\":%d,\"population\":%ld",g.cyber[i],g.corruption[i],g.population[i]);
        printf(",\"degree\":%d,\"betweenness\":%.4f}",deg[i],btwn[i]);
        if(i<n-1)printf(","); printf("\n");
    }
    printf("],\n\"edges\":[\n");
    bool first=true;
    for(int i=0;i<n;i++) for(int j=i+1;j<n;j++) if(g.mat[i][j]!=INF){
        if(!first)printf(",\n"); first=false;
        printf("{\"u\":%d,\"v\":%d,\"w\":%d}",i,j,g.mat[i][j]);
    }
    printf("],\n\"bfs\":{\"src\":%d,\"order\":[",src);
    for(int i=0;i<bfsR.len;i++){if(i)printf(",");printf("%d",bfsR.order[i]);}
    printf("],\"dist\":[");
    for(int i=0;i<n;i++){if(i)printf(",");printf("%d",bfsR.dist[i]);}
    printf("],\"parent\":[");
    for(int i=0;i<n;i++){if(i)printf(",");printf("%d",bfsR.parent[i]);}
    printf("]},\n\"dfs\":{\"src\":%d,\"order\":[",src);
    for(int i=0;i<dfsR.len;i++){if(i)printf(",");printf("%d",dfsR.order[i]);}
    printf("],\"depth\":[");
    for(int i=0;i<n;i++){if(i)printf(",");printf("%d",dfsR.depth[i]);}
    printf("]},\n\"dijkstra\":{\"src\":%d,\"dist\":[",src);
    for(int i=0;i<n;i++){if(i)printf(",");if(dkR.dist[i]==INF)printf("-1");else printf("%d",dkR.dist[i]);}
    printf("],\"prev\":[");
    for(int i=0;i<n;i++){if(i)printf(",");printf("%d",dkR.prev[i]);}
    printf("]},\n\"floyd\":[\n");
    int rows=n<12?n:12;
    for(int i=0;i<rows;i++){
        printf("[");
        for(int j=0;j<n;j++){if(j)printf(",");if(FW[i][j]==INF)printf("-1");else printf("%d",FW[i][j]);}
        printf("]"); if(i<rows-1)printf(","); printf("\n");
    }
    printf("],\n\"mst\":{\"totalW\":%d,\"totalAll\":%d,\"edges\":[\n",mstR.totalW,mstR.totalAll);
    for(int i=0;i<mstR.cnt;i++){
        printf("{\"u\":%d,\"v\":%d,\"w\":%d}",mstR.mst[i].u,mstR.mst[i].v,mstR.mst[i].w);
        if(i<mstR.cnt-1)printf(","); printf("\n");
    }
    printf("]}\n}\n");
    for(int i=0;i<n;i++){AdjNode*c=g.adj[i];while(c){AdjNode*nx=c->next;free(c);c=nx;}}
    return 0;
}