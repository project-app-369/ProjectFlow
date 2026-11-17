"""
Updates the schedule reference data in sttp2b.json from the Schedule Progress workbooks.

    PYTHONIOENCODING=utf-8 python app/apps/api/seed/extract_schedule.py

Keys written (existing keys are left alone):
  milestones        the newest "Key Milestones Rev n" workbook (Milestones folder): the key dates, with the facility, the
                    subcontractor's working-schedule date (planSub) and the equipment installation dates (kind "Equipment")
  workingSchedule   the working schedule of CGF Topsides ("Final Wk SCH ..." in Schedules/Working Schedule): every activity with its
                    baseline, working-schedule, WK-planning and re-schedule dates, and its place in the WBS tree
  cpn               the critical-path-network progress of the newest progress report that carries CPN sheets (CPN folder):
                    the weekly overall curve and the work packages, with the baseline weight, plan and actual beside the CPN ones
"""
import datetime as dt
import glob
import json
import os
import re

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'data', 'EPCIC', 'Schedule Progress'))
OUT = os.path.join(HERE, 'sttp2b.json')

MONTHS = {m: i for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], 1)}
NAMES = {'WP2': 'CGF Topsides', 'WP3': 'CGF Jacket & Bridge', 'WP4': 'New LQ Module #2', 'WP5': 'Brownfield modifications', 'WP6': 'Gas export riser / SSIV'}
FACILITY = {'CGF - Topside': 'CGF Topsides', 'CGF - Jacket': 'CGF Jacket', 'LQM2': 'LQ Module #2', 'Pile': 'Pile', 'Conductor': 'Conductor', 'Bridge': 'Bridge', 'Pileline': 'Pipeline'}


def day(v):
    """A date cell as ISO text: real dates, ISO text, and Primavera text such as '22-Jun-26 A' (an actual date)."""
    if isinstance(v, (dt.datetime, dt.date)):
        return v.date().isoformat() if isinstance(v, dt.datetime) else v.isoformat()
    if isinstance(v, str):
        s = v.strip()
        if re.match(r'^\d{4}-\d{2}-\d{2}', s):
            return s[:10]
        m = re.match(r'^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})', s)
        if m:
            y = int(m.group(3))
            return dt.date(y + 2000 if y < 100 else y, MONTHS[m.group(2).lower()], int(m.group(1))).isoformat()
    return None


def num(v, digits=2):
    return round(float(v), digits) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def clean(v, limit=300):
    s = ' '.join(str(v).split()) if v not in (None, '') else ''
    return s[:limit] or None


def newest(folder, pattern):
    """The workbook of a folder whose name sorts last (Rev numbers and cut-off dates are written in the name)."""
    found = [p for p in glob.glob(os.path.join(BASE, folder, pattern)) if not os.path.basename(p).startswith('~$')]
    if not found:
        raise SystemExit(f'No workbook {pattern} under {os.path.join(BASE, folder)}')
    return max(found, key=lambda p: [int(x) for x in re.findall(r'\d+', os.path.basename(p))] + [os.path.getmtime(p)])


# ------------------------------------------------------------------------------------------------ milestones
def milestones():
    path = newest('Milestones', '*Key Milestones*.xlsx')
    rows = list(openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0].iter_rows(values_only=True))
    head = next(i for i, r in enumerate(rows) if r and any(str(c).strip() == 'ID' for c in r if c))
    cols = {str(c).strip().lower(): j for j, c in enumerate(rows[head]) if c}
    col = lambda r, *names: next((r[cols[n]] for n in names if n in cols and cols[n] < len(r)), None)  # noqa: E731
    out, equipment, keydates = [], 0, 0
    for r in rows[head + 1:]:
        desc = clean(col(r, 'key date description'), 200)
        if not desc:
            continue
        ident = clean(col(r, 'id'), 40)
        facility = FACILITY.get(str(col(r, 'facility') or '').strip(), clean(col(r, 'facility'), 60))
        item = {
            'id': ident, 'description': desc, 'planBaseline': day(col(r, 'plan (baseline)')), 'planSub': day(col(r, 'plan (wk-subcontractor)')),
            'subName': clean(col(r, 'sub name'), 40), 'forecast': day(col(r, 'forecast')), 'actual': day(col(r, 'actual')),
            'variance': num(col(r, 'variance'), 0), 'comment': clean(col(r, 'comment'), 120), 'facility': facility,
        }
        tag = clean(col(r, 'tag no.'), 60)
        eta = day(col(r, 'eta (for equiment)', 'eta (for equipment)'))
        if tag or eta or (r and r[0]):  # an equipment installation row: package in the first column, deck in the ID column
            equipment += 1
            item.update({'id': f'EQ-{equipment:03d}', 'kind': 'Equipment', 'package': clean(r[0], 60), 'eta': eta, 'tagNo': tag, 'location': clean(col(r, 'location'), 60), 'deck': ident})
        else:
            keydates += 1
            item['id'] = item['id'] or f'KD-{keydates:03d}'
            item.update({'kind': 'Key date', 'package': None, 'eta': None, 'tagNo': None, 'location': None, 'deck': None})
        out.append(item)
    return os.path.basename(path), out


# ------------------------------------------------------------------------------------------------ working schedule
def working_schedule():
    path = newest(os.path.join('Schedules', 'Working Schedule'), '*.xlsx')
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    out, stack = [], []
    for r in rows[2:]:
        label = r[1]
        if not isinstance(label, str) or not label.strip():
            continue
        indent = len(label) - len(label.lstrip())
        text = label.strip()
        name = clean(r[2], 200)
        leaf = bool(name)
        # a summary row carries its name in the ID column; an activity carries its P6 id there and the name beside it
        title = name or text
        while stack and stack[-1][0] >= indent:
            stack.pop()
        parent = stack[-1][1] if stack else None
        code = f'WS-{len(out) + 1:04d}'
        if not leaf:
            stack.append((indent, code))
        out.append({
            'id': code, 'facilityId': 'cgf-topsides', 'activityId': text if leaf else None, 'name': title, 'parent': parent, 'level': len(stack) + (1 if leaf else 0),
            'leaf': 'Yes' if leaf else 'No', 'duration': num(r[3], 0), 'discipline': clean(r[6], 20),
            'baseStart': day(r[4]), 'baseFinish': day(r[5]), 'workStart': day(r[7]), 'workFinish': day(r[8]),
            'wkpStart': day(r[9]), 'wkpFinish': day(r[10]), 'reStart': day(r[12]) if len(r) > 12 else None, 'reFinish': day(r[13]) if len(r) > 13 else None,
        })
    return os.path.basename(path), out


# ------------------------------------------------------------------------------------------------ CGF Jacket schedule (PDF)
def jacket_schedule():
    """
    The CGF Jacket schedule of the fabrication subcontractor ("STT2B - CGF-Jacket Schedule_Rev 0.pdf", Primavera print-out): the key milestones
    M1000 to M1080 with their dates, and the span of each group (engineering, procurement, fabrication, load-out and sea-fastening).
    """
    import pypdf
    path = next(p for p in glob.glob(os.path.join(BASE, 'Schedules', '*Jacket*Schedule*.pdf')))
    text = '\n'.join((pg.extract_text() or '') for pg in pypdf.PdfReader(path).pages)
    dmy = lambda t: day(t.replace('*', ''))  # noqa: E731
    key = {}
    for m in re.finditer(r'^(M1\d{3})\s+(.+?)\s+0\.00d\s+[\d.]+\s+(\d{2}-[A-Za-z]{3}-\d{2})\*?', text, re.M):
        key[m.group(1)] = {'name': ' '.join(m.group(2).split()), 'date': dmy(m.group(3))}
    groups = {}
    for m in re.finditer(r'^(.*?)\s+\d+\.\d\dd\s+[\d.]+\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+[\d.]+$', text, re.M):
        name = m.group(1)
        half = len(name) // 2
        name = ' '.join((name[:half] if name[:half] == name[half:] else name).split())
        groups.setdefault(name, (dmy(m.group(2)), dmy(m.group(3))))
    return os.path.basename(path), key, groups


def apply_jacket(seed):
    """Puts the jacket schedule into the milestones (the subcontractor's dates, the two missing key dates) and into the working schedule."""
    src, key, groups = jacket_schedule()
    by_id = {m['id']: m for m in seed['milestones']}
    # the workbook's own ids for the jacket key dates; M1070 and M1080 are its load-out and sail-away dates
    alias = {'M1020': '03-M-1020', 'M1070': '03-M-1100', 'M1080': '03-M-1110'}
    for k, v in key.items():
        m = by_id.get(alias.get(k, k))
        if m:
            m['planSub'] = v['date']
        elif k in ('M1000', 'M1010'):
            # fixed dates (marked * in the schedule) that have passed: the effective date and the kick-off
            seed['milestones'].append({'id': k, 'description': v['name'], 'planBaseline': v['date'], 'planSub': v['date'], 'subName': 'VSP', 'forecast': None, 'actual': v['date'],
                                       'variance': 0, 'comment': 'Done', 'facility': 'CGF Jacket', 'kind': 'Key date', 'package': None, 'eta': None, 'tagNo': None, 'location': None, 'deck': None})
    spans = [('CGF Jacket fabrication and load-out', 'ST-CGF JACKET FAB. AND LOSF'), ('Engineering', 'CONSTRUCTION ENGINEERING'), ('Procurement', 'CONSTRUCTION PROCUREMENT'),
             ('Fabrication', 'Fabrication'), ('Load-out and sea-fastening', 'Loadout and Seafastening')]
    rows, top = [], None
    for i, (label, name) in enumerate(spans):
        if name not in groups:
            continue
        start, finish = groups[name]
        ident = f'WJ-{i + 1:04d}'
        top = top or ident
        rows.append({'id': ident, 'facilityId': 'cgf-jacket', 'activityId': None, 'name': label, 'parent': None if i == 0 else top, 'level': 1 if i == 0 else 2, 'leaf': 'No', 'duration': None, 'discipline': None,
                     'baseStart': None, 'baseFinish': None, 'workStart': start, 'workFinish': finish, 'wkpStart': None, 'wkpFinish': None, 'reStart': None, 'reFinish': None})
    seed['workingSchedule'] = [r for r in seed['workingSchedule'] if r.get('facilityId') != 'cgf-jacket'] + rows
    return src, len(key), rows


# ------------------------------------------------------------------------------------------------ critical path network progress
def cpn():
    path = newest('CPN', '1 - *Progress Report*CPN*.xlsx')
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    standard = newest('Progress', '1 - *Progress Report*.xlsx')
    base_wb = openpyxl.load_workbook(standard, read_only=True, data_only=True)

    def level1(sheet, base_sheet):
        def rows_of(name):
            return list((base_wb if name == base_sheet else wb)[name].iter_rows(min_row=1, max_row=120, max_col=24, values_only=True))
        base = {}
        for r in rows_of(base_sheet):
            if r[0] == 1 and r[3]:
                base[re.sub(r'\W+', '', str(r[3]).upper())] = r
        items, total = [], None
        for r in rows_of(sheet):
            label = str(r[3] or '')
            if label.upper().startswith('CPN OVERALL'):
                b = base.get('OVERALL')
                total = {'weight': num(r[5]), 'plan': num(r[17]), 'actual': num(r[18]), 'lastPlan': num(r[11]), 'lastActual': num(r[12]), 'basePlan': num(b[17]) if b else None, 'baseActual': num(b[18]) if b else None}
            elif r[0] == 1 and label:
                b = base.get(re.sub(r'\W+', '', label.upper()))
                code = re.match(r'(WP\d)', label)
                items.append({
                    'code': code.group(1) if code else None, 'name': NAMES.get(code.group(1) if code else '', re.sub(r'^WP\d - ', '', label).title()),
                    'weight': num(r[5]), 'plan': num(r[17]), 'actual': num(r[18]), 'lastPlan': num(r[11]), 'lastActual': num(r[12]),
                    'basePlan': num(b[17]) if b else None, 'baseActual': num(b[18]) if b else None, 'baseWeight': num(b[5]) if b else None,
                })
        return items, total

    wps, overall = level1('Overall WP (W) CPN', 'Overall WP (W)')
    grid = list(wb['Overall WP (W) CPN'].iter_rows(min_row=1, max_row=120, max_col=190, values_only=True))
    dates = [day(v) for v in grid[6][26:183]]
    plan = actual = None
    for r in grid:
        tag = str(r[22] or '')
        if tag == 'CPN OVERALLPLANNED':
            plan = r[26:183]
        elif tag == 'CPN OVERALLACTUAL':
            actual = r[26:183]
    cutoff = day(grid[3][20])
    curve = []
    for i, d in enumerate(dates):
        if not d or plan is None:
            continue
        a = actual[i] if actual is not None else None
        curve.append({'date': d, 'plan': num(plan[i]), 'actual': num(a) if cutoff and d <= cutoff and a is not None else None})
    return os.path.basename(path), {'cutoff': cutoff, 'overall': overall, 'workPackages': wps, 'curve': curve}


if __name__ == '__main__':
    with open(OUT, encoding='utf-8') as f:
        seed = json.load(f)
    src, seed['milestones'] = milestones()
    print('milestones', src, len(seed['milestones']), 'equipment', sum(1 for m in seed['milestones'] if m['kind'] == 'Equipment'))
    src, seed['workingSchedule'] = working_schedule()
    print('working schedule', src, len(seed['workingSchedule']))
    src, found, rows = apply_jacket(seed)
    print('jacket schedule', src, found, 'key dates', [(r['name'], r['workStart'], r['workFinish']) for r in rows])
    src, seed['cpn'] = cpn()
    print('cpn', src, seed['cpn']['cutoff'], len(seed['cpn']['workPackages']), len(seed['cpn']['curve']), seed['cpn']['overall'])
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(seed, f, ensure_ascii=False, separators=(',', ':'))
