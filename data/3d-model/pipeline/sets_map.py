import sys, collections, numpy as np
sys.path.insert(0,'.')
import classify_models as cm
def key(l):
    t=l.split('\t'); return (t[0].split(' > ',1)[1] if ' > ' in t[0] else t[0], t[1], tuple(t[-6:]))
old=open('out/m/jacket_leaves.tsv',encoding='utf8').read().split('\n')[1:]
new=open('out/m/jacket_cgf_leaves.tsv',encoding='utf8').read().split('\n')[1:]
old=[l for l in old if l.count('\t')>=8]; new=[l for l in new if l.count('\t')>=8]
print(len(old),len(new))
pos=collections.defaultdict(list)
for i,l in enumerate(old): pos[key(l)].append(i)
m=[]; miss=0
for l in new:
    k=key(l); 
    if pos[k]: m.append(pos[k].pop(0))
    else: m.append(-1); miss+=1
print('unmatched new',miss,'unused old',sum(len(v) for v in pos.values()))
sets={}
for l in open('out/jacket_sets.tsv',encoding='utf8').read().split('\n')[1:]:
    t=l.split('\t')
    if len(t)>=5 and t[0]=='SET': sets[t[1]]=[m[int(x)] for x in t[4].split(',') if x and m[int(x)]>=0]
np.save('out/m/jacket_sets_old.npy',np.array([(n,i) for n,v in sets.items() for i in v],dtype=object),allow_pickle=True)
assign=open('out/m/jacket_assign.txt').read().split('\n')
ph=[cm.phase(l.split('\t')[0]) for l in old]
for n,v in sets.items():
    print(n,len(v),'assign:',collections.Counter(assign[i] for i in v).most_common(5),'phase:',collections.Counter(ph[i] for i in v).most_common(6))
names=list(sets)
for a in names:
    for b in names:
        if a<b:
            o=len(set(sets[a])&set(sets[b]))
            if o: print('overlap',a,b,o)
import json
json.dump(sets,open('out/m/jacket_sets.json','w'))
S={n:set(v) for n,v in sets.items()}
anyset=set().union(*S.values())
for g in ['piles_conductors','bridge_support','flooding','buoyancy_tanks']:
    idx=[i for i,a in enumerate(assign) if a==g]
    out=[i for i in idx if i not in anyset]
    print(g,len(idx),'not in any set',len(out),collections.Counter(ph[i] for i in out).most_common(6))
