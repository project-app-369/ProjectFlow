"""
Loads the construction manhour budget, with the manhours spent so far, into sttp2b.json from the MPI tracking workbook
(Construction/Production, "<yyyymmdd>_MPI TRACKING.xlsx", sheet "PROGRESS TRACKING").

    PYTHONIOENCODING=utf-8 python app/apps/api/seed/extract_budget.py

Key written (the other keys are left alone):
  budget        the WBS of the workbook as rows {wbs, name, parentWbs, discipline, manhours, actualHours, earnedHours, planStart,
                planFinish, notes}. Level 1 is the area (CGF TOPSIDE, PRELIMINARY), level 2 the discipline, level 3 the work package
                and level 4 the activity. Only rows that carry no rows below them hold hours: budget at completion (BAC) in
                `manhours`, the actual manhours in `actualHours` and the earned value (EV) in `earnedHours`; the parents are rolled up
                by the app. Rows with neither a budget nor hours are left out.
  budgetCutoff  the date in the workbook's file name

Level-4 lines that are not linked to a level-2 and level-3 id ("Direct Manpower", 20,852 h under several packages) are not part of the
workbook's own totals and are left out, so the loaded budget adds up to the workbook's level totals.

The workbook has no dates per activity. So that the histogram has something to draw, the activities of the disciplines of CGF
Topside that the baseline schedule also lists (Structure, Piping, Mechanical, Electrical, Painting) take that discipline's baseline
span from the working schedule already in sttp2b.json, and the discipline row says so in its notes. Other areas stay unscheduled.
"""
import datetime as dt
import glob
import json
import os
import re

import openpyxl
from openpyxl.reader import excel

excel.ExcelReader.read_custom = lambda self: None  # this workbook carries a custom property openpyxl cannot read

HERE = os.path.dirname(os.path.abspath(__file__))
FOLDER = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'data', 'EPCIC', 'Construction', 'Production'))
OUT = os.path.join(HERE, 'sttp2b.json')

# MPI discipline (level 2 of CGF TOPSIDE) -> top-level section of the baseline schedule of CGF Topsides
SCHEDULE_SECTION = {'Structural': 'Structure', 'Piping': 'Piping', 'Mechanical': 'Mechanical', 'Electrical': 'Electrical', 'Painting': 'Painting'}
# columns of "PROGRESS TRACKING"
C = {'level': 1, 'l1': 2, 'l2': 3, 'l3': 4, 'discipline': 5, 'l2id': 7, 'cid': 8, 'desc': 9, 'bac': 10, 'actual': 11, 'progress': 18, 'ev': 20}


def newest():
    best = None
    for path in glob.glob(os.path.join(FOLDER, '*MPI TRACKING*.xlsx')):
        m = re.match(r'^(\d{8})', os.path.basename(path))
        if m and (best is None or m.group(1) > best[0]):
            best = (m.group(1), path)
    if not best:
        raise SystemExit('No "<yyyymmdd>_MPI TRACKING.xlsx" in ' + FOLDER)
    return dt.datetime.strptime(best[0], '%Y%m%d').date().isoformat(), best[1]


def num(v):
    return round(float(v), 2) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def slug(s):
    return re.sub(r'[^A-Za-z0-9]+', '-', str(s)).strip('-').upper() or 'AREA'


def tracking(path):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb['PROGRESS TRACKING']
    rows, stack, used = [], {}, set()

    def code(raw):
        base = re.sub(r'[^A-Za-z0-9._-]+', '-', str(raw).strip()).strip('-') or 'ROW'
        c, n = base, 1
        while c in used:
            n += 1
            c = f'{base}.{n}'
        used.add(c)
        return c

    for r in ws.iter_rows(min_row=5, values_only=True):
        lvl = str(r[C['level']]) if r[C['level']] is not None else ''
        if lvl not in {'1', '2', '3', '4'}:
            continue
        n = int(lvl)
        name = {1: r[C['l1']], 2: r[C['l2']], 3: r[C['l3']], 4: r[C['desc']]}[n]
        raw = {1: slug(r[C['l1']]) if r[C['l1']] else None, 2: r[C['l2id']], 3: r[C['cid']], 4: r[C['cid']]}[n]
        bac, actual, ev = num(r[C['bac']]), num(r[C['actual']]), num(r[C['ev']])
        if not raw or not name:
            continue
        # "Direct Manpower" pool lines (20,852 h under each package) are not linked to a level-2/level-3 id and are not in the workbook's totals
        if n == 4 and not (r[6] and r[7]):
            continue
        node = {'level': n, 'raw': str(raw), 'name': str(name).strip(), 'discipline': (r[C['discipline']] or (r[C['l2']] if n == 2 else None)),
                'bac': bac, 'actual': actual, 'ev': ev, 'parent': stack.get(n - 1)}
        stack[n] = None  # filled once the code is known
        node['code'] = code(raw)
        stack[n] = node['code']
        for deeper in range(n + 1, 5):
            stack.pop(deeper, None)
        rows.append(node)
    return rows


def build(cutoff, path):
    nodes = tracking(path)
    has_child = {n['parent'] for n in nodes if n['parent']}
    seed = json.load(open(OUT, encoding='utf-8'))
    ws = [r for r in seed.get('workingSchedule', []) if r.get('facilityId') == 'cgf-topsides' and r.get('level') == 1]
    span = {r['name']: (r['baseStart'], r['baseFinish']) for r in ws if r.get('baseStart') and r.get('baseFinish')}
    area_of, discipline_of, out = {}, {}, []
    for n in nodes:
        if n['level'] == 1:
            area_of[n['code']] = n['name']
        elif n['level'] == 2:
            discipline_of[n['code']] = n['name']
    for n in nodes:
        leaf = n['code'] not in has_child
        if leaf and not (n['bac'] or n['actual']):
            continue
        # a parent whose children were all dropped is a leaf now: it keeps its own totals
        top = n['code'] if n['level'] == 1 else None
        row = {'wbs': n['code'], 'name': n['name'], 'parentWbs': n['parent'], 'discipline': n['discipline'] if n['level'] >= 2 else None,
               'manhours': n['bac'] if leaf else None, 'actualHours': n['actual'] if leaf else None, 'earnedHours': n['ev'] if leaf else None,
               'planStart': None, 'planFinish': None, 'notes': None}
        out.append(row)
    kept = {r['wbs'] for r in out}
    parents = {r['parentWbs'] for r in out if r['parentWbs']}
    out = [r for r in out if r['wbs'] in parents or r['manhours'] or r['actualHours']]  # drop empty parents too
    kept = {r['wbs'] for r in out}
    for r in out:
        if r['parentWbs'] not in kept:
            r['parentWbs'] = None
    # dates: the discipline span of the baseline schedule, for the topsides disciplines it lists
    by_code = {r['wbs']: r for r in out}
    level_of = {n['code']: n for n in nodes}
    def area(code):
        c = code
        while c and level_of[c]['level'] > 1:
            c = level_of[c]['parent']
        return level_of[c]['name'] if c else None
    def discipline(code):
        c = code
        while c and level_of[c]['level'] > 2:
            c = level_of[c]['parent']
        return level_of[c]['name'] if c and level_of[c]['level'] == 2 else None
    def top_of(code):
        c = code
        while c and level_of[c]['level'] > 1:
            c = level_of[c]['parent']
        return c
    dated = set()
    for r in out:
        if r['manhours'] is None and r['actualHours'] is None:
            continue
        if area(r['wbs']) != 'CGF TOPSIDE':
            continue
        sec = SCHEDULE_SECTION.get(discipline(r['wbs']) or '')
        if sec and sec in span:
            r['planStart'], r['planFinish'] = span[sec]
            dated.add(discipline(r['wbs']))
    for r in out:
        if level_of[r['wbs']]['level'] == 2 and r['name'] in dated and area(r['wbs']) == 'CGF TOPSIDE':
            sec = SCHEDULE_SECTION[r['name']]
            r['notes'] = f'Dates: the baseline span of "{sec}" in the working schedule, {span[sec][0]} to {span[sec][1]}; the tracking workbook has none per activity.'
        if level_of[r['wbs']]['level'] == 1:
            r['notes'] = f'Actual manhours and earned value to {cutoff}, from the MPI tracking workbook.'
            mine = sum(x['manhours'] or 0 for x in out if x['manhours'] is not None and top_of(x['wbs']) == r['wbs'])
            stated = level_of[r['wbs']]['bac']
            if stated and abs(mine - stated) > 1:
                r['notes'] += f' The workbook states {stated:,.0f} h for the area but its disciplines add up to {mine:,.0f} h; the total here is the sum of the activities.'
    return out


if __name__ == '__main__':
    cutoff, path = newest()
    rows = build(cutoff, path)
    seed = json.load(open(OUT, encoding='utf-8'))
    seed['budget'] = rows
    seed['budgetCutoff'] = cutoff
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(seed, f, ensure_ascii=False, separators=(',', ':'))
    leaves = [r for r in rows if r['manhours'] is not None or r['actualHours'] is not None]
    bac = sum(r['manhours'] or 0 for r in leaves)
    act = sum(r['actualHours'] or 0 for r in leaves)
    ev = sum(r['earnedHours'] or 0 for r in leaves)
    print(os.path.basename(path), cutoff, 'rows', len(rows), 'leaves', len(leaves), 'dated', sum(1 for r in leaves if r['planStart']))
    print('BAC %.0f  actual %.0f  EV %.0f  CPI %.3f  progress %.1f%%' % (bac, act, ev, ev / act if act else 0, 100 * ev / bac if bac else 0))
