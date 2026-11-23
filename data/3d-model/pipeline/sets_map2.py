"""Maps the Selection Sets of CGF-Jacket.nwd (out/jacket_sets2.tsv) to the leaf order of out/m/jacket_leaves.tsv (what jacket.raw holds)."""
import collections, json, sys
import numpy as np
def key(l):
    t = l.split('\t'); return (t[0].split(' > ', 1)[1] if ' > ' in t[0] else t[0], t[1], tuple(t[-6:]))
rd = lambda f: [l for l in open(f, encoding='utf8').read().split('\n')[1:] if l.count('\t') >= 8]
old, new = rd('out/m/jacket_leaves.tsv'), rd('out/m/jacket_cgf_leaves2.tsv')
pos = collections.defaultdict(list)
for i, l in enumerate(old): pos[key(l)].append(i)
m = []
for l in new:
    k = key(l); m.append(pos[k].pop(0) if pos[k] else -1)
print(len(old), len(new), 'unmatched new', m.count(-1), 'unused old', sum(len(v) for v in pos.values()))
sets = {}
for l in open('out/jacket_sets2.tsv', encoding='utf8').read().split('\n')[1:]:
    t = l.split('\t')
    if len(t) >= 5 and t[0] == 'SET': sets[t[1]] = [m[int(x)] for x in t[4].split(',') if x and m[int(x)] >= 0]
json.dump(sets, open('out/m/jacket_sets2.json', 'w'))
S = {n: set(v) for n, v in sets.items()}
anyset = set().union(*S.values())
print('in no set', len(old) - len(anyset))
names = list(S)
for a in names:
    for b in names:
        if a < b and S[a] & S[b]: print('overlap', a, '|', b, len(S[a] & S[b]))
removed = sorted(i for v in pos.values() for i in v)  # leaves of the old export that the new file no longer has
json.dump(removed, open('out/m/jacket_removed.json', 'w'))
print('removed', len(removed))
