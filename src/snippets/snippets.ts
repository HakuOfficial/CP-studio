export interface CodeSnippet { id:string; name:string; trigger:string; language:string; category:string; description:string; body:string; enabled:boolean }
const sid=(x:string)=>`builtin-${x}`
export const BUILTIN_SNIPPETS:CodeSnippet[]=[
['main','Main template','Template','#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    ${1:// code}\n    return 0;\n}$0'],
['fastio','Fast I/O','Template','ios::sync_with_stdio(false);\ncin.tie(nullptr);$0'],
['for','For loop','Template','for (int ${1:i} = ${2:0}; ${1:i} < ${3:n}; ++${1:i}) {\n    ${0}\n}'],
['dij','Dijkstra','Graph','vector<long long> dijkstra(int ${1:s}, const vector<vector<pair<int,long long>>>& ${2:g}) {\n    const long long INF = (1LL<<62);\n    vector<long long> d(${2:g}.size(), INF);\n    priority_queue<pair<long long,int>, vector<pair<long long,int>>, greater<pair<long long,int>>> pq;\n    d[${1:s}] = 0; pq.push({0, ${1:s}});\n    while (!pq.empty()) {\n        auto [du,u] = pq.top(); pq.pop();\n        if (du != d[u]) continue;\n        for (auto [v,w] : ${2:g}[u]) if (d[v] > du + w) {\n            d[v] = du + w; pq.push({d[v], v});\n        }\n    }\n    return d;\n}$0'],
['bfs','BFS','Graph','queue<int> q;\nvector<int> dist(${1:n}+1, -1);\ndist[${2:s}] = 0; q.push(${2:s});\nwhile (!q.empty()) {\n    int u=q.front(); q.pop();\n    for (int v: ${3:g}[u]) if (dist[v]==-1) { dist[v]=dist[u]+1; q.push(v); }\n}$0'],
['dfs','DFS','Graph','function<void(int,int)> dfs = [&](int u, int p) {\n    ${1:// process}\n    for (int v : ${2:g}[u]) if (v != p) dfs(v, u);\n};\ndfs(${3:1}, 0);$0'],
['dsu','DSU','Data Structure','struct DSU {\n    vector<int> p, sz;\n    DSU(int n): p(n+1), sz(n+1,1) { iota(p.begin(),p.end(),0); }\n    int find(int x){ return p[x]==x?x:p[x]=find(p[x]); }\n    bool unite(int a,int b){ a=find(a);b=find(b); if(a==b)return false; if(sz[a]<sz[b])swap(a,b); p[b]=a;sz[a]+=sz[b];return true; }\n};$0'],
['bit','Fenwick Tree','Data Structure','struct BIT {\n    int n; vector<long long> bit;\n    BIT(int n):n(n),bit(n+1){}\n    void add(int i,long long v){ for(;i<=n;i+=i&-i) bit[i]+=v; }\n    long long sum(int i){ long long s=0; for(;i;i-=i&-i)s+=bit[i]; return s; }\n};$0'],
['binpow','Binary exponentiation','Math','long long binpow(long long a,long long e,long long mod){\n    long long r=1%mod;\n    while(e){ if(e&1) r=r*a%mod; a=a*a%mod; e>>=1; }\n    return r;\n}$0'],
['sieve','Sieve','Math','vector<int> primes;\nvector<bool> isPrime(${1:n}+1,true);\nisPrime[0]=isPrime[1]=false;\nfor(int i=2;i<=${1:n};++i) if(isPrime[i]){ primes.push_back(i); if(1LL*i*i<=${1:n}) for(long long j=1LL*i*i;j<=${1:n};j+=i)isPrime[j]=false; }$0'],
['forr','Reverse for loop','Template','for (int ${1:i} = ${2:n}; ${1:i} >= ${3:1}; --${1:i}) {\n    ${0}\n}'],
['foreach','Range for loop','Template','for (auto &${1:x} : ${2:a}) {\n    ${0}\n}'],
['floyd','Floyd-Warshall','Graph','for (int k = 1; k <= ${1:n}; ++k)\n    for (int i = 1; i <= ${1:n}; ++i)\n        for (int j = 1; j <= ${1:n}; ++j)\n            if (${2:d}[i][k] < ${3:INF} && ${2:d}[k][j] < ${3:INF})\n                ${2:d}[i][j] = min(${2:d}[i][j], ${2:d}[i][k] + ${2:d}[k][j]);$0'],
['bellman','Bellman-Ford','Graph','vector<long long> d(${1:n}+1, ${2:INF});\nd[${3:s}] = 0;\nfor (int it = 1; it < ${1:n}; ++it) {\n    bool changed = false;\n    for (auto [u,v,w] : ${4:edges}) if (d[u] != ${2:INF} && d[v] > d[u] + w) { d[v] = d[u] + w; changed = true; }\n    if (!changed) break;\n}$0'],
['seg','Segment Tree','Data Structure','struct SegTree {\n    int n; vector<long long> st;\n    SegTree(int n): n(n), st(4*n+4) {}\n    void build(int id,int l,int r,const vector<long long>& a){ if(l==r){st[id]=a[l];return;} int m=(l+r)/2; build(id*2,l,m,a); build(id*2+1,m+1,r,a); st[id]=st[id*2]+st[id*2+1]; }\n    void update(int id,int l,int r,int p,long long v){ if(l==r){st[id]=v;return;} int m=(l+r)/2; if(p<=m) update(id*2,l,m,p,v); else update(id*2+1,m+1,r,p,v); st[id]=st[id*2]+st[id*2+1]; }\n    long long query(int id,int l,int r,int ql,int qr){ if(qr<l||r<ql)return 0; if(ql<=l&&r<=qr)return st[id]; int m=(l+r)/2; return query(id*2,l,m,ql,qr)+query(id*2+1,m+1,r,ql,qr); }\n};$0'],
['lazy','Lazy Segment Tree','Data Structure','struct LazySeg {\n    int n; vector<long long> st,lazy;\n    LazySeg(int n):n(n),st(4*n+4),lazy(4*n+4){}\n    void apply(int id,int l,int r,long long v){ st[id]+=v*(r-l+1); lazy[id]+=v; }\n    void push(int id,int l,int r){ if(!lazy[id]||l==r)return; int m=(l+r)/2; apply(id*2,l,m,lazy[id]); apply(id*2+1,m+1,r,lazy[id]); lazy[id]=0; }\n    void update(int id,int l,int r,int ql,int qr,long long v){ if(qr<l||r<ql)return; if(ql<=l&&r<=qr){apply(id,l,r,v);return;} push(id,l,r); int m=(l+r)/2; update(id*2,l,m,ql,qr,v); update(id*2+1,m+1,r,ql,qr,v); st[id]=st[id*2]+st[id*2+1]; }\n    long long query(int id,int l,int r,int ql,int qr){ if(qr<l||r<ql)return 0; if(ql<=l&&r<=qr)return st[id]; push(id,l,r); int m=(l+r)/2; return query(id*2,l,m,ql,qr)+query(id*2+1,m+1,r,ql,qr); }\n};$0'],
['sparse','Sparse Table','Data Structure','int K = 1 + __lg(${1:n});\nvector<vector<long long>> st(K, vector<long long>(${1:n}+1));\nfor(int i=1;i<=${1:n};++i) st[0][i]=${2:a}[i];\nfor(int k=1;k<K;++k) for(int i=1;i+(1<<k)-1<=${1:n};++i) st[k][i]=min(st[k-1][i],st[k-1][i+(1<<(k-1))]);\nauto query = [&](int l,int r){ int k=__lg(r-l+1); return min(st[k][l],st[k][r-(1<<k)+1]); };$0'],
['kadane','Kadane','DP','long long best = ${1:a}[0], cur = ${1:a}[0];\nfor (int i = 1; i < (int)${1:a}.size(); ++i) { cur = max(${1:a}[i], cur + ${1:a}[i]); best = max(best, cur); }$0'],
['lis','Longest Increasing Subsequence','DP','vector<long long> lis;\nfor (auto x : ${1:a}) { auto it = lower_bound(lis.begin(), lis.end(), x); if (it == lis.end()) lis.push_back(x); else *it = x; }\nint answer = (int)lis.size();$0'],
['knap','0/1 Knapsack','DP','vector<long long> dp(${1:W}+1, 0);\nfor (int i=0;i<${2:n};++i) for (int w=${1:W};w>=${3:weight}[i];--w) dp[w]=max(dp[w],dp[w-${3:weight}[i]]+${4:value}[i]);$0'],
['gcd','GCD','Math','long long ${1:g} = std::gcd(${2:a}, ${3:b});$0'],
['lb','lower_bound','Template','auto ${1:it} = lower_bound(${2:a}.begin(), ${2:a}.end(), ${3:x});$0'],
['ub','upper_bound','Template','auto ${1:it} = upper_bound(${2:a}.begin(), ${2:a}.end(), ${3:x});$0'],
].map(([trigger,name,category,body])=>({id:sid(trigger),trigger,name,category,body,language:'cpp',description:name,enabled:true}))

const KEY='codefightide.snippets.v1'
export function loadSnippets():CodeSnippet[]{
  try {
    const stored=JSON.parse(localStorage.getItem(KEY)||'null')
    if(!Array.isArray(stored)) return BUILTIN_SNIPPETS
    const byId=new Map<string,CodeSnippet>(stored.map((s:CodeSnippet)=>[s.id,s] as [string,CodeSnippet]))
    const builtins=BUILTIN_SNIPPETS.map(b=>({ ...b, enabled: byId.get(b.id)?.enabled ?? true }))
    const custom=stored.filter((s:CodeSnippet)=>!s.id?.startsWith('builtin-'))
    return [...builtins,...custom]
  } catch { return BUILTIN_SNIPPETS }
}
export function saveSnippets(v:CodeSnippet[]){localStorage.setItem(KEY,JSON.stringify(v))}
export function findSnippet(snips:CodeSnippet[], trigger:string,language='cpp'){return snips.find(s=>s.enabled&&s.language===language&&s.trigger===trigger)}


/** Render a Monaco-style snippet as plain text for the emergency fallback path.
 * Supports ${1:default}, ${1}, $1 and $0. The native Monaco snippet command is
 * still preferred because it provides full placeholder/tabstop behavior. */
export function renderSnippetFallback(body:string):{text:string;cursorOffset:number}{
  const defaults=new Map<number,string>()
  let out=''
  let cursorOffset=-1
  let firstPlaceholder=-1
  const re=/\$\{(\d+)(?::([^}]*))?\}|\$(\d+)/g
  let last=0
  for(const m of body.matchAll(re)){
    const idx=m.index ?? 0
    out += body.slice(last,idx)
    const n=Number(m[1] ?? m[3])
    let value=m[2] ?? defaults.get(n) ?? ''
    if(m[2] !== undefined) defaults.set(n,value)
    if(n===0) cursorOffset=out.length
    else if(firstPlaceholder<0) firstPlaceholder=out.length
    out += value
    last=idx+m[0].length
  }
  out += body.slice(last)
  if(cursorOffset<0) cursorOffset=firstPlaceholder>=0?firstPlaceholder:out.length
  return {text:out,cursorOffset}
}
