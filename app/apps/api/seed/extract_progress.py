"""
Updates the EPCIC progress data in sttp2b.json from the Progress Report workbook in data/EPCIC/Schedule Progress/Progress.

    PYTHONIOENCODING=utf-8 python extract_progress.py

Keys written (existing keys are left alone):
  schedule.scurve         monthly cumulative plan and actual for the whole EPCIC scope ("S-CURVES_WP (M)", OVERALL rows)
  schedule.workPackages   WP2 to WP6: weight, cumulative last week, period progress, cumulative at cut-off ("Overall WP (W)", level 1)
  schedule.overall        the OVERALL row of the same sheet
  phaseProgress           progress by phase: engineering, procurement, construction, pre-com, T&I, HUC ("dashboard data")
  progressCutoff          the report date

These replace the earlier procurement-only figures: the main dashboard reports progress of the whole EPCIC scope.
"""
import datetime as dt
import glob
import json
import os
import re

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'data', 'EPCIC', 'Schedule Progress', 'Progress'))
OUT = os.path.join(HERE, 'sttp2b.json')

NAMES = {'WP2': 'CGF Topsides', 'WP3': 'CGF Jacket & Bridge', 'WP4': 'New LQ Module #2', 'WP5': 'Brownfield modifications', 'WP6': 'Gas export riser / SSIV'}
PHASES = [('ENGINEERING', 'Engineering'), ('PROCUREMENT', 'Procurement'), ('ONSHORE CONSTRUCTION', 'Onshore construction'), ('ONSHORE PRECOM', 'Onshore pre-com & commissioning'),
          ('TRANSPORTATION', 'Transportation & installation'), ('OFFSHORE HOOK-UP', 'Offshore hook-up & commissioning')]


def book():
    path = glob.glob(os.path.join(DATA, '1 - *Progress Report*.xlsx'))[0]
    return openpyxl.load_workbook(path, read_only=True, data_only=True)


def pct(v, digits=2):
    try:
        return round(float(v), digits)
    except (TypeError, ValueError):
        return None


def iso(v):
    return v.date().isoformat() if isinstance(v, dt.datetime) else None


def work_packages(wb):
    rows = list(wb['Overall WP (W)'].iter_rows(min_row=1, max_row=90, max_col=21, values_only=True))
    items, overall = [], None
    for r in rows:
        if str(r[0]) != '1':
            continue
        label = str(r[3] or '')
        m = re.match(r'(WP\d)\b', label)
        entry = dict(weight=pct(r[5]), lastWeekPlan=pct(r[11], 1), lastWeekActual=pct(r[12], 1), achievedPlan=pct(r[14], 2), achievedActual=pct(r[15], 2), thisWeekPlan=pct(r[17], 1), thisWeekActual=pct(r[18], 1))
        if m:
            items.append({'code': m.group(1), 'name': NAMES[m.group(1)], **entry})
        elif label.upper() == 'OVERALL':
            overall = {k: entry[k] for k in ('lastWeekPlan', 'lastWeekActual', 'thisWeekPlan', 'thisWeekActual')}
    assert len(items) == 5 and overall, 'work package rows not found'
    return items, overall


def scurve(wb, cutoff):
    rows = list(wb['S-CURVES_WP (M)'].iter_rows(values_only=True))
    dates = [iso(v) for v in rows[65][4:]]
    plan, actual = rows[70][4:], rows[73][4:]
    out = []
    for d, p, a in zip(dates, plan, actual):
        if not d:
            continue
        out.append({'date': d, 'plan': pct(p), 'forecast': None, 'actual': pct(a) if d <= cutoff else None})
    return out


def phases(wb):
    rows = list(wb['dashboard data'].iter_rows(min_row=29, max_row=40, max_col=4, values_only=True))
    out = []
    for key, label in PHASES:
        r = next(x for x in rows if x[0] and str(x[0]).upper().startswith(key))
        out.append({'phase': label, 'plan': round(float(r[1]) * 100, 2), 'actual': round(float(r[2]) * 100, 2)})
    return out


if __name__ == '__main__':
    wb = book()
    cutoff = iso(list(wb['dashboard data'].iter_rows(min_row=17, max_row=17, max_col=1, values_only=True))[0][0])
    items, overall = work_packages(wb)
    seed = json.load(open(OUT, encoding='utf8'))
    curve = scurve(wb, cutoff)
    # The monthly sheet was last refreshed for an earlier cut-off; the report's own OVERALL row is the figure at the report date.
    point = next((p for p in curve if p['date'] == cutoff), None)
    if point is None:
        point = {'date': cutoff, 'plan': None, 'forecast': None, 'actual': None}
        curve = sorted(curve + [point], key=lambda p: p['date'])
    point['plan'], point['actual'] = overall['thisWeekPlan'], overall['thisWeekActual']
    for p in curve:
        if p['date'] > cutoff:
            p['actual'] = None
        elif p['date'] < cutoff and p['actual'] is None:
            p['actual'] = None
    seed['schedule'] = {'scurve': curve, 'workPackages': items, 'overall': overall}
    seed['phaseProgress'] = phases(wb)
    seed['progressCutoff'] = cutoff
    with open(OUT, 'w', encoding='utf8') as f:
        json.dump(seed, f, ensure_ascii=False, separators=(',', ':'))
    print(cutoff, overall, [(w['code'], w['weight'], w['thisWeekPlan'], w['thisWeekActual']) for w in items], seed['phaseProgress'], len(seed['schedule']['scurve']))
