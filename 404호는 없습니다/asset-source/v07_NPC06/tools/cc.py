# Connected components (8- or 4-connectivity) from row runs and union-find, numpy only (no scipy in this environment).
import numpy as np
def label(mask,conn=8):
    H,W=mask.shape;runs=[];rowruns=[]
    for y in range(H):
        r=mask[y].astype(np.int8);d=np.diff(np.concatenate([[0],r,[0]]));s=np.where(d==1)[0];e=np.where(d==-1)[0]
        rowruns.append(list(range(len(runs),len(runs)+len(s))));runs+= [(y,a,b) for a,b in zip(s,e)]
    par=list(range(len(runs)))
    def f(i):
        while par[i]!=i: par[i]=par[par[i]];i=par[i]
        return i
    for y in range(1,H):
        prev=rowruns[y-1];j=0
        for i in rowruns[y]:
            _,a,b=runs[i]
            for k in prev:
                _,c,d=runs[k]
                if (c<=b and d>=a) if conn==8 else (c<b and d>a): # 8-conn: [a,b) touches [c-1,d+1); 4-conn: overlap
                    ri,rk=f(i),f(k)
                    if ri!=rk: par[ri]=rk
    comps={}
    for i,(y,a,b) in enumerate(runs):
        r=f(i);c=comps.setdefault(r,[10**9,10**9,-1,-1,0,[]])
        c[0]=min(c[0],a);c[1]=min(c[1],y);c[2]=max(c[2],b);c[3]=max(c[3],y+1);c[4]+=b-a;c[5].append((y,a,b))
    return [dict(bbox_xywh=[int(c[0]),int(c[1]),int(c[2]-c[0]),int(c[3]-c[1])],px=int(c[4]),runs=c[5]) for c in comps.values()]
def mask_of(comp,shape):
    m=np.zeros(shape,bool)
    for y,a,b in comp['runs']: m[y,a:b]=True
    return m
