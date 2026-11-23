"""Reads the out/m/<model>.raw written by ModelTool `rawleaves`: per leaf an int32 triangle count and 9 float32 per triangle."""
import numpy as np


def read_raw(path):
    raw = np.fromfile(path, dtype="<u1")
    pos, tris, leaf_of = 0, [], []
    n = 0
    buf = raw.tobytes()
    out_off, out_cnt = [], []
    while pos < len(buf):
        c = int(np.frombuffer(buf, dtype="<i4", count=1, offset=pos)[0])
        pos += 4
        out_off.append(pos)
        out_cnt.append(c)
        pos += c * 36
        n += 1
    return buf, np.array(out_off), np.array(out_cnt)


def leaf_tris(buf, off, cnt, i):
    return np.frombuffer(buf, dtype="<f4", count=cnt[i] * 9, offset=int(off[i])).reshape(-1, 3, 3)


def all_centroids(buf, off, cnt):
    """(centroids Nx3, leaf index per triangle)"""
    cs, idx = [], []
    for i in range(len(cnt)):
        if cnt[i]:
            t = leaf_tris(buf, off, cnt, i)
            cs.append(t.mean(axis=1))
            idx.append(np.full(len(t), i, dtype=np.int32))
    return np.concatenate(cs), np.concatenate(idx)
