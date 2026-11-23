import sys,re,collections; sys.path.insert(0,'.')
import numpy as np
from leaves import load
rows=load('out/m/jacket_leaves.tsv'); bb=np.array([r['bb'] for r in rows]); dim=bb[:,3:]-bb[:,:3]; c=(bb[:,:3]+bb[:,3:])/2
ph=np.array([(re.search(r'PHASE[-_]?(\d+(?:-\d+)?)',r['path']) or [None,'ifc'])[1] for r in rows])
def ring_clusters():
    out=[]
    def big(a,b): return (dim[:,a]>1.5)&(dim[:,b]>1.5)&(dim[:,a]<4.6)&(dim[:,b]<4.6)&(np.abs(dim[:,a]-dim[:,b])<0.3)&(ph=='7')
    for axis,(a,b,cc),thin in ((2,(0,1,2),big(0,1)&(dim[:,2]<1.0)),(0,(1,2,0),big(1,2)&(dim[:,0]<1.0)),(1,(0,2,1),big(0,2)&(dim[:,1]<1.0))):
        g=collections.defaultdict(list)
        for i in np.where(thin)[0]: g[(round(c[i,a]/1.5),round(c[i,b]/1.5))].append(i)
        for k,v in g.items():
            if len(v)>=8:
                v=np.array(v); out.append(dict(axis=axis,a=float(np.median(c[v][:,a])),b=float(np.median(c[v][:,b])),lo=float(bb[v][:,cc].min()),hi=float(bb[v][:,3+cc].max()),r=float(np.median(dim[v][:,[a,b]]))/2,n=len(v)))
    return out
if __name__=='__main__':
    for t in ring_clusters(): print(t)
