"""
Refreshes the procurement register and the expediting packages in sttp2b.json from the latest Expediting Report in
data/EPCIC/Procurement/Expediting (the file with the newest cut-off date in its name).

    PYTHONIOENCODING=utf-8 python extract_expediting.py [--check]

Keys written (the rest of the seed is left alone):
  procurement    one row per package of `pgk_gen_info`: vendor, LOA, PO, buyer, expeditor, PE, VQC. Status is derived:
                 PO placed if a PO number exists, else LOA issued if an LOA exists, else In tendering.
  expediting     one row per package of the five summary sheets: Equipment, Structural Steel, Pipe-Fitting, Valves, Misc
  project.cutoff the cut-off date printed on `pgk_gen_info`

`--check` extracts without writing and prints how the result differs from what is in the seed now.
Columns are found by their header text, so a column added or moved in the workbook does not break the load.
"""
import datetime as dt
import glob
import json
import os
import re
import sys

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
FOLDER = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'data', 'EPCIC', 'Procurement', 'Expediting'))
OUT = os.path.join(HERE, 'sttp2b.json')
TEXT_LIMIT = 320


def latest_report():
    """The Expediting Report with the newest cut-off in its file name (06-Nov-2026, 13-Nov-2026 ...); `--report=06-Nov` picks another one."""
    best = None
    wanted = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--report=')), None)
    for path in glob.glob(os.path.join(FOLDER, '*.xlsx')):
        name = os.path.basename(path)
        if name.startswith('~$') or (wanted and wanted not in name):
            continue
        m = re.search(r'(\d{1,2})-([A-Za-z]{3})-(\d{4})', name)
        if m:
            when = dt.datetime.strptime(f'{m.group(1)} {m.group(2)} {m.group(3)}', '%d %b %Y').date()
            if best is None or when > best[0]:
                best = (when, path)
    if best is None:
        raise SystemExit(f'No Expediting Report with a cut-off date in its name under {FOLDER}')
    return best


def iso(v):
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    return None


def text(v, limit=None):
    """Free text keeps its line breaks; spaces are tidied. Blank and placeholder cells are None."""
    if v is None:
        return None
    s = '\n'.join(re.sub(r'[ \t]+', ' ', line).strip() for line in str(v).replace('\r', '').split('\n')).strip()
    if not s or s in ('-', 'NA', 'N/A', '#N/A', '(blank)'):
        return None
    return s[:limit] if limit else s


def one_line(v, limit=None):
    s = text(v)
    s = re.sub(r'\s+', ' ', s) if s else None
    return s[:limit] if s and limit else s


def pct(v, digits=1):
    try:
        return round(float(v) * 100, digits)
    except (TypeError, ValueError):
        return None


def table(ws, first_header, max_rows=60):
    """Finds the header row (the first row whose first filled cell starts with `first_header`) and returns {header: column index}, rows after it."""
    rows = list(ws.iter_rows(values_only=True))
    for i, r in enumerate(rows[:max_rows]):
        if any(isinstance(c, str) and c.strip().lower().startswith(first_header.lower()) for c in r[:2]):
            index = {}
            for j, c in enumerate(r):
                if isinstance(c, str) and c.strip() and c.strip() not in index:
                    index[c.strip()] = j
            return index, rows[i + 1:]
    raise SystemExit(f'Header "{first_header}" not found on sheet {ws.title}')


def col(index, *names):
    """Column of the first header that starts with any of the names (case-insensitive)."""
    for n in names:
        for h, j in index.items():  # an exact header wins over one that merely starts the same ("Vendor" over "Vendor Code")
            if h.lower() == n.lower():
                return j
    for n in names:
        for h, j in index.items():
            if h.lower().startswith(n.lower()):
                return j
    raise KeyError(f'column {names} not found in {list(index)[:12]}')


def get(r, j):
    return r[j] if j is not None and j < len(r) else None


def register(wb):
    ws = wb['pgk_gen_info']
    cutoff = next((iso(c) for r in ws.iter_rows(min_row=1, max_row=3, values_only=True) for c in r if isinstance(c, dt.datetime)), None)
    index, rows = table(ws, 'Package Code')
    c = {k: col(index, *v) for k, v in dict(code=('Package Code',), discipline=('Discipline',), description=('Package description',), vendorCode=('Vendor Code',), vendor=('Vendor',),
                                              origins=('Manufacturers',), loaNo=('LOA no',), loaDate=('LOA date',), poNo=('PO no',), poDate=('PO date',), buyer=('Buyer',),
                                              expeditor=('Expeditor',), pe=('PE',), vqc=('VQC',)).items()}
    out = []
    for r in rows:
        code = str(get(r, c['code']) or '').strip()
        if not code.startswith('STTP2B'):
            continue
        when = lambda v: iso(v) or text(v)  # noqa: E731  a date, or the text written in its place (TBA)
        rec = {
            'id': f'PR-{len(out) + 1:03d}', 'code': code, 'discipline': text(get(r, c['discipline'])), 'description': text(get(r, c['description'])),
            'vendorCode': text(get(r, c['vendorCode'])), 'vendor': text(get(r, c['vendor'])), 'origins': text(get(r, c['origins'])),
            'loaNo': text(get(r, c['loaNo'])), 'loaDate': when(get(r, c['loaDate'])), 'poNo': text(get(r, c['poNo'])), 'poDate': when(get(r, c['poDate'])),
            'buyer': text(get(r, c['buyer'])), 'expeditor': text(get(r, c['expeditor'])), 'pe': text(get(r, c['pe'])), 'vqc': text(get(r, c['vqc'])),
        }
        rec['status'] = 'PO placed' if rec['poNo'] else 'LOA issued' if rec['loaNo'] else 'In tendering'
        out.append(rec)
    return cutoff, out


def equipment(wb):
    index, rows = table(wb['Equipment-Summary'], 'Package Code')
    names = dict(code=('Package Code',), name=('Package Name',), vendor=('Vendor',), ros=('ROS Date',), eta=('ETA at Site',), diff=('DateDiff',), status=('Package Status',),
                 ep=('Plan Engineering',), ea=('Actual Engineering',), pp=('Plan Procurement',), pa=('Actual Procurement',), fp=('Plan Fabrication',), fa=('Actual Fabrication',),
                 tp=('Plan Testing',), ta=('Actual Testing',), dp=('Plan Delivery',), da=('Actual Delivery',), plan=('Plan Overall',), act=('Actual Overall',), var=('Variance',),
                 hi=('Highlight',), ap=('Short Term Action',), rem=('Remark',), lsps=('LS/PS',))
    c = {k: col(index, *v) for k, v in names.items()}
    # 'Variance' appears several times (per stage); the overall one follows 'Actual Overall'
    c['var'] = c['act'] + 1
    out = []
    for r in rows:
        code = str(get(r, c['code']) or '').strip()
        if not code.startswith('STTP2B'):
            continue
        eta, diff = get(r, c['eta']), get(r, c['diff'])
        out.append({
            'discipline': 'Equipment', 'code': code, 'name': text(get(r, c['name'])), 'vendor': text(get(r, c['vendor'])), 'rosDate': iso(get(r, c['ros'])),
            'etaSite': iso(eta) or text(eta), 'dateDiff': diff if isinstance(diff, (int, float)) else text(diff), 'status': one_line(get(r, c['status'])),
            'engPlan': pct(get(r, c['ep'])), 'engActual': pct(get(r, c['ea'])), 'procPlan': pct(get(r, c['pp'])), 'procActual': pct(get(r, c['pa'])),
            'fabPlan': pct(get(r, c['fp'])), 'fabActual': pct(get(r, c['fa'])), 'testPlan': pct(get(r, c['tp'])), 'testActual': pct(get(r, c['ta'])),
            'delPlan': pct(get(r, c['dp'])), 'delActual': pct(get(r, c['da'])), 'planPct': pct(get(r, c['plan'])), 'actualPct': pct(get(r, c['act'])), 'variance': pct(get(r, c['var'])),
            'highlight': text(get(r, c['hi']), TEXT_LIMIT), 'actionPlan': text(get(r, c['ap']), TEXT_LIMIT), 'remark': text(get(r, c['rem']), TEXT_LIMIT), 'lsps': one_line(get(r, c['lsps'])),
        })
    return out


def package_status(v):
    """The status column of some rows holds a number (a column shift in the workbook); those packages are treated as Normal."""
    s = one_line(v)
    return 'Normal' if not s or re.fullmatch(r'-?\d+(\.\d+)?', s) else s


def progress_sheet(wb, sheet, discipline, header, status_header, name_header=None):
    index, rows = table(wb[sheet], header)
    c = dict(code=col(index, header), status=col(index, status_header), pe=col(index, 'Plan EXW'), ae=col(index, 'Actual EXW'), pa=col(index, 'Plan Arrival'), aa=col(index, 'Actual Arrival'),
             plan=col(index, 'Planned Cumulation To'), act=col(index, 'Actual Cumulation To'), var=col(index, 'Variance'))
    name = col(index, name_header) if name_header else None
    out = []
    for r in rows:
        code = str(get(r, c['code']) or '').strip()
        if not code.startswith('STTP2B'):
            continue
        out.append({
            'discipline': discipline, 'code': code, 'name': text(get(r, name)) if name is not None else None, 'vendor': None, 'status': package_status(get(r, c['status'])),
            'planExw': pct(get(r, c['pe'])), 'actExw': pct(get(r, c['ae'])), 'planArrival': pct(get(r, c['pa'])), 'actArrival': pct(get(r, c['aa'])),
            'planPct': pct(get(r, c['plan'])), 'actualPct': pct(get(r, c['act'])), 'variance': pct(get(r, c['var'])),
        })
    return out


def valves(wb):
    # from the 13-Nov report the package-level table is on "Valves - Detail status"; "Valves - Summary" became a by-type plan
    sheet = 'Valves - Detail status' if 'Valves - Detail status' in wb.sheetnames else 'Valves - Summary'
    index, rows = table(wb[sheet], 'LS/PS')
    c = dict(code=col(index, 'Package Code'), name=col(index, 'Package desc'), po=col(index, 'PO no'), vendor=col(index, 'Vendor'), due=col(index, 'PO Delivery date'),
             status=col(index, 'Production status'), now=col(index, 'CURRENT STATUS'))
    out = []
    for r in rows:
        code = str(get(r, c['code']) or '').strip()
        if not code.startswith('STTP2B'):
            continue
        status = one_line(get(r, c['status']))
        if not status or re.fullmatch(r'-?\d+(\.\d+)?', status):
            continue  # the lower table of the sheet repeats each package with quantities per month; it is not a package row
        out.append({'discipline': 'Valves', 'code': code, 'name': text(get(r, c['name'])), 'vendor': text(get(r, c['vendor'])), 'poNo': one_line(get(r, c['po'])),
                    'deliveryDate': iso(get(r, c['due'])), 'status': status, 'currentStatusText': text(get(r, c['now']), TEXT_LIMIT)})
    return out


def expediting(wb):
    rows = (equipment(wb)
            + progress_sheet(wb, 'Structural Steel-Summary', 'Structural', 'Package Code', 'Package Status', 'Package Name')
            + progress_sheet(wb, 'Pipe-Fitting - Summary', 'Piping', 'Package', 'Status')
            + progress_sheet(wb, 'Misc-Summary', 'Misc', 'Package Code', 'Column 11', 'Package Desc')
            + valves(wb))
    return [{'id': f'EX-{i + 1:03d}', **r} for i, r in enumerate(rows)]


def diff(old, new, label):
    by_old = {(r['code'], r.get('discipline'), i): r for i, r in enumerate(old)}
    print(f'{label}: {len(old)} -> {len(new)} rows')
    changed = {}
    for a, b in zip(old, new):
        for k in set(a) | set(b):
            if a.get(k) != b.get(k):
                changed.setdefault(k, []).append((a.get('code'), a.get(k), b.get(k)))
    for k, v in sorted(changed.items(), key=lambda kv: -len(kv[1]))[:12]:
        print(f'   {k:18s} {len(v):3d} changed, e.g. {str(v[0])[:150]}')
    return by_old


if __name__ == '__main__':
    when, path = latest_report()
    print('report', os.path.basename(path), when)
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    cutoff, procurement = register(wb)
    packages = expediting(wb)
    seed = json.load(open(OUT, encoding='utf8'))
    diff(seed['procurement'], procurement, 'procurement')
    diff(seed['expediting'], packages, 'expediting')
    print('cut-off on the report:', cutoff, '(file name', when, ')')
    if '--check' not in sys.argv:
        seed['procurement'], seed['expediting'] = procurement, packages
        seed['project']['cutoff'] = cutoff or when.isoformat()
        with open(OUT, 'w', encoding='utf8') as f:
            json.dump(seed, f, ensure_ascii=False, separators=(',', ':'))
        print('written; project cut-off', seed['project']['cutoff'])
