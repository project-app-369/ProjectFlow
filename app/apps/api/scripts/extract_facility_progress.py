"""
Extracts the per-facility progress curves and the WBS schedule from the planning workbooks into
the `facilityProgress` key of app/apps/api/seed/sttp2b.json, which the sheets backend loads into the Facility curves,
Facility scopes and Facility WBS worksheets.

Run from the repository root (repeatable, reads only):
    PYTHONIOENCODING=utf-8 python app/apps/api/scripts/extract_facility_progress.py

Sources, all under data/EPCIC/Schedule Progress/Progress (cut-off 30 Oct 2026):
  6 - Construction Progress Monitoring ... .xlsx   S-Curve Data      construction curves per WBS node: early plan, forecast, actual
                                                   R-WBS             WBS start and finish (Primavera)
                                                   Level 3 (WBS)     weight and cumulative plan and actual per WBS node at the cut-off
  1 - STT2B - Jacket ... .xlsx                     Project S-Curve   CGF Jacket weekly progress by phase
  1 - STTP2B - ... Bridge ... .xlsx                Project S-Curve   Bridge weekly progress by phase
  1. STTP2B-LQM#2 ... .xlsx                        Project S-curve   LQM#2 weekly progress by phase
CGF Topsides has no usable all-phase workbook yet (the DATA (CGF TS) weekly table is incomplete), so it carries the construction curves only.
Percentages in the workbooks are fractions or percent depending on the sheet; everything is stored as percent (0-100).
"""
import datetime
import glob
import json
import os
import re
import sys

import openpyxl

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
BASE = os.path.join(ROOT, 'data', 'EPCIC', 'Schedule Progress', 'Progress')
SEED = os.path.join(ROOT, 'app', 'apps', 'api', 'seed', 'sttp2b.json')


def book(prefix):
    path = next(p for p in sorted(glob.glob(os.path.join(BASE, '*.xlsx'))) if os.path.basename(p).startswith(prefix) and not os.path.basename(p).startswith('~$'))
    return openpyxl.load_workbook(path, read_only=True, data_only=True)


def day(v):
    return v.date().isoformat() if isinstance(v, (datetime.datetime, datetime.date)) else None


def num(v, scale=1.0):
    return round(float(v) * scale, 3) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


curves = []  # facilityId, scope, date, plan, forecast, actual
scopes = []  # facilityId, scope, label, weight (share of the facility, percent)
LABEL = {'overall': 'Overall', 'construction': 'Construction', 'engineering': 'Engineering', 'procurement': 'Procurement', 'precom': 'Pre-commissioning', 'documents': 'Final documents',
         'topsides-fabrication': 'Topsides fabrication', 'ehouse-fabrication': 'E-house fabrication', 'pile': 'Pile', 'conductor': 'Conductor', 'fabrication': 'LQ module fabrication'}


def scope(facility, key, weight=None):
    scopes.append({'facilityId': facility, 'scope': key, 'label': LABEL[key], 'weight': weight})


def add(facility, scope, dates, plan, forecast=None, actual=None, actual_until=None):
    """Appends one weekly series. Actual stops at the last reported date (the workbook carries zeros after the cut-off)."""
    n = 0
    # keep the curve from just before it starts to just after the plan reaches 100%
    plan_ix = [i for i, v in enumerate(plan or []) if v is not None]
    first = next((i for i in plan_ix if plan[i] and plan[i] > 0), plan_ix[0] if plan_ix else 0)
    last = next((i for i in plan_ix if plan[i] is not None and plan[i] >= 99.95), plan_ix[-1] if plan_ix else len(dates) - 1)
    lo, hi = max(0, first - 2), min(len(dates) - 1, last + 1)
    for i, d in enumerate(dates):
        if not d or i < lo or i > hi:
            continue
        p = plan[i] if plan and i < len(plan) else None
        f = forecast[i] if forecast and i < len(forecast) else None
        a = actual[i] if actual and i < len(actual) else None
        if actual_until is not None and d > actual_until:
            a = None
        if p is None and f is None and a is None:
            continue
        curves.append({'facilityId': facility, 'scope': scope, 'date': d, 'plan': p, 'forecast': f, 'actual': a})
        n += 1
    return n


# ---------------------------------------------------------------- construction curves per WBS node (all facilities)
wb6 = book('6 - STTP2B')
ws = wb6['S-Curve Data']
grid = list(ws.iter_rows(min_row=1, max_row=130, max_col=224, values_only=True))
dates6 = [day(v) for v in grid[2][11:222]]
CUTOFF = '2026-10-30'


def row6(r, scale=100.0):
    return [num(v, scale) for v in grid[r - 1][11:222]]


def curve6(facility, scope, plan_row):
    # rows come in blocks: early plan, late plan, forecast, actual
    plan, forecast, actual = row6(plan_row), row6(plan_row + 2), row6(plan_row + 3)
    return add(facility, scope, dates6, plan, forecast, actual, actual_until=CUTOFF)


CONSTRUCTION = [
    ('cgf-topsides', 'construction', 5), ('cgf-topsides', 'topsides-fabrication', 32), ('cgf-topsides', 'ehouse-fabrication', 36),
    ('cgf-jacket', 'construction', 108),
    ('pile-conductor', 'pile', 112), ('pile-conductor', 'conductor', 116),
    ('bridge', 'construction', 120),
    ('lqm2', 'construction', 13), ('lqm2', 'fabrication', 59),
]
for facility, scope_key, r in CONSTRUCTION:
    n = curve6(facility, scope_key, r)
    scope(facility, scope_key)
    print(f'  {facility:15s} {scope_key:22s} {n} weeks')

# ---------------------------------------------------------------- overall and phase curves from each facility workbook
def weekly(ws, date_row, c0, rows, scale=1.0, max_col=300):
    dates = [day(v) for v in next(ws.iter_rows(min_row=date_row, max_row=date_row, min_col=c0, max_col=max_col, values_only=True))]
    series = {}
    for key, r in rows.items():
        series[key] = [num(v, scale) for v in next(ws.iter_rows(min_row=r, max_row=r, min_col=c0, max_col=max_col, values_only=True))]
    return dates, series


def trim(dates, series):
    ok = [i for i, d in enumerate(dates) if d]
    return [dates[i] for i in ok], {k: [v[i] for i in ok if i < len(v)] for k, v in series.items()}


def phases(facility, dates, series, mapping, weights, cut=CUTOFF):
    for key, (plan_key, actual_key) in mapping.items():
        add(facility, key, dates, series[plan_key], None, series.get(actual_key), actual_until=cut)
        w = weights.get(plan_key)
        scope(facility, key, round(w * 100, 2) if isinstance(w, (int, float)) and w <= 1 else w)


def weights_of(ws, rows):
    return {k: next(ws.iter_rows(min_row=r, max_row=r, min_col=3, max_col=3, values_only=True))[0] for k, r in rows.items()}


# CGF Jacket: Project S-Curve, dates on row 20 from column D
ws = book('1 - STT2B -Jacket')['Project S-Curve']
JK = {'op': 31, 'oa': 32, 'cp': 23, 'ca': 24, 'ep': 25, 'ea': 26, 'pp': 27, 'pa': 28, 'dp': 29, 'da': 30}
d, sr = trim(*weekly(ws, 20, 4, JK))
phases('cgf-jacket', d, sr, {'overall': ('op', 'oa'), 'engineering': ('ep', 'ea'), 'procurement': ('pp', 'pa'), 'documents': ('dp', 'da')}, weights_of(ws, JK))

# Bridge: Project S-Curve, dates on row 22 from column D
ws = book('1 - STTP2B - Project Progress Mornitoring - Bridge')['Project S-Curve']
BR = {'op': 33, 'oa': 34, 'cp': 25, 'ca': 26, 'ep': 27, 'ea': 28, 'pp': 29, 'pa': 30, 'rp': 31, 'ra': 32}
d, sr = trim(*weekly(ws, 22, 4, BR))
phases('bridge', d, sr, {'overall': ('op', 'oa'), 'engineering': ('ep', 'ea'), 'procurement': ('pp', 'pa'), 'precom': ('rp', 'ra')}, weights_of(ws, BR))

# LQM#2: Project S-curve, dates on row 39 from column D
ws = book('1. STTP2B-LQM#2')['Project S-curve']
LQ = {'op': 52, 'oa': 53, 'ep': 40, 'ea': 41, 'pp': 42, 'pa': 43, 'cp': 44, 'ca': 45, 'rp': 46, 'ra': 47, 'dp': 48, 'da': 49}
d, sr = trim(*weekly(ws, 39, 4, LQ))
phases('lqm2', d, sr, {'overall': ('op', 'oa'), 'engineering': ('ep', 'ea'), 'procurement': ('pp', 'pa'), 'precom': ('rp', 'ra'), 'documents': ('dp', 'da')}, weights_of(ws, LQ))

# ---------------------------------------------------------------- WBS: schedule (R-WBS) and progress at the cut-off (Level 3 (WBS))
ws = wb6['R-WBS']
schedule = {}
for r in ws.iter_rows(min_row=3, max_row=2400, max_col=7, values_only=True):
    wbs_id, name, code, start, finish, level, father = r
    if isinstance(level, (int, float)) and isinstance(wbs_id, str) and code and re.match(r'^STTP2B-31\.', str(code)):
        schedule[str(code).strip()] = {'code': str(code).strip(), 'name': str(name or '').strip(), 'level': int(level), 'father': str(father or '').strip() or None, 'start': day(start), 'finish': day(finish)}

ws = wb6['Level 3 (WBS)']
progress = {}
for r in ws.iter_rows(min_row=8, max_row=2100, max_col=20, values_only=True):
    level, wbs = r[1], r[2]
    if not isinstance(wbs, str) or not wbs.startswith('STTP2B-31'):
        continue
    code = wbs.split(' ')[0].strip()
    weight, last_plan, last_act, this_plan, this_act = r[6], r[7], r[9], r[14], r[16]
    if isinstance(this_plan, (int, float)) and isinstance(this_act, (int, float)):
        progress[code] = {'weight': num(weight, 100), 'plan': num(this_plan), 'actual': num(this_act), 'lastPlan': num(last_plan), 'lastActual': num(last_act), 'manHours': num(r[5], 1)}

FACILITY_PREFIXES = {
    'cgf-topsides': ['STTP2B-31.2'],
    'cgf-jacket': ['STTP2B-31.3.1', 'STTP2B-31.3.2', 'STTP2B-31.3.3.1', 'STTP2B-31.3.3.2', 'STTP2B-31.3.3.3.1', 'STTP2B-31.3.3.5', 'STTP2B-31.3.4', 'STTP2B-31.3.6', 'STTP2B-31.3.7'],
    'pile-conductor': ['STTP2B-31.3.3.3.2', 'STTP2B-31.3.3.3.3'],
    'bridge': ['STTP2B-31.3.3.3.4'],
    'lqm2': ['STTP2B-31.4'],
}
SHARED = {'STTP2B-31.3.1', 'STTP2B-31.3.2', 'STTP2B-31.3.3.1', 'STTP2B-31.3.3.2', 'STTP2B-31.3.3.5', 'STTP2B-31.3.4', 'STTP2B-31.3.6', 'STTP2B-31.3.7'}
MAX_LEVEL = 5

wbs_rows = []
for facility, prefixes in FACILITY_PREFIXES.items():
    for code, n in sorted(schedule.items(), key=lambda kv: [(0, int(x), '') if x.isdigit() else (1, 0, x) for x in re.split(r'[.\-]', kv[0])]):
        if n['level'] > MAX_LEVEL or not n['start'] or not n['finish']:
            continue
        if not any(code == p or code.startswith(p + '.') for p in prefixes):
            continue
        pr = progress.get(code, {})
        wbs_rows.append({
            'facilityId': facility, 'code': code, 'name': n['name'], 'level': n['level'], 'father': n['father'], 'start': n['start'], 'finish': n['finish'],
            'weight': pr.get('weight'), 'plan': pr.get('plan'), 'actual': pr.get('actual'), 'shared': 'Yes' if any(code == p or code.startswith(p + '.') for p in SHARED) else 'No',
        })

out = {'cutoff': CUTOFF, 'source': 'STTP2B progress monitoring workbooks, cut-off 30 Oct 2026', 'scopes': scopes, 'curves': curves, 'wbs': wbs_rows}
# merged into the shared seed file as `facilityProgress`; every other key is left exactly as it was
with open(SEED, encoding='utf-8') as f:
    seed = json.load(f)
seed['facilityProgress'] = out
with open(SEED, 'w', encoding='utf-8') as f:
    json.dump(seed, f, ensure_ascii=False, separators=(',', ':'))

by = {}
for c in curves:
    by.setdefault((c['facilityId'], c['scope']), []).append(c)
print(f'{len(curves)} curve points, {len(wbs_rows)} WBS rows -> facilityProgress in {os.path.relpath(SEED, ROOT)}')
for (fac, scope), pts in sorted(by.items()):
    last = [p for p in pts if p['actual'] is not None]
    print(f'  {fac:15s} {scope:22s} {pts[0]["date"]} -> {pts[-1]["date"]}  plan end {pts[-1]["plan"]}  actual {last[-1]["actual"] if last else None} at {last[-1]["date"] if last else None}')
sys.stdout.flush()
