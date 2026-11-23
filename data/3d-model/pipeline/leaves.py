"""Reads the geometry-leaf listing written by ModelTool `leaves` (out/m/<model>_leaves.tsv)."""
import csv,collections,re,sys
def load(f):
    out=[]
    for l in open(f,encoding='utf-8').read().split('\n')[1:]:
        t=l.split('\t')
        if len(t)<9: continue
        try: float(t[-1]); 
        except: continue
        out.append(dict(path=t[0],name=t[1],cls=t[2],bb=[float(v) for v in t[-6:]]))
    return out
def bb(rows):
    return [round(min(x['bb'][i] for x in rows),1) if i<3 else round(max(x['bb'][i] for x in rows),1) for i in range(6)]
