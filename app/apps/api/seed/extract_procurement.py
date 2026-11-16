"""
Adds the procurement-side reference data to sttp2b.json from the workbooks in data/EPCIC/Procurement.

    python extract_procurement.py

Keys written (existing keys are left alone; running again replaces these five):
  procurementPlan   one row per package of the Procurement Plan workbook (work package, LS/PS, weight in overall progress)
  logistics         shipments: PTSC weekly report ("PTSC items") and the client shipments ("CLJOC Items")
  materialBalance   stock still on hand ("Balance" sheet of the Material Stock Report)
  materialSummary   weights per facility: needed for purchase, arrived, on yard ("Summary Weight" sheet)
  procCurves        weekly cumulative S-curves (planned, forecast, actual) per facility and LS / PS / overall ("S-curve data" sheet)

Not loaded: the stock ledger (Sheet1, 6,288 rows), the PTSC-MSV / No MSV / HHI sheets and the received-shipment
lists of the Material Summary List. They repeat what the logistics and balance data already say, or are too large
for a spreadsheet-backed pre-build.
"""
import datetime as dt
import glob
import json
import os
import re

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'data', 'EPCIC', 'Procurement'))
OUT = os.path.join(HERE, 'sttp2b.json')


MONTHS = {m: i for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], 1)}


def name_date(name):
    """The cut-off written in a file name: 13-Nov-26, 06-Nov-2026, 13-Nov-2026, 07.11.2026 ..."""
    m = re.search(r'(\d{1,2})[-. ]([A-Za-z]{3})[a-z]*[-. ](\d{2,4})', name)
    if m:
        d, mon, y = int(m.group(1)), MONTHS[m.group(2).lower()], int(m.group(3))
    else:
        m = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})', name)
        if not m:
            return None
        d, mon, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return dt.date(y + 2000 if y < 100 else y, mon, d)


def latest(folder, pattern='*.xls*'):
    """The workbook of `folder` with the newest cut-off in its file name, as (date, relative path)."""
    found = []
    for path in glob.glob(os.path.join(DATA, folder, pattern)):
        base = os.path.basename(path)
        when = None if base.startswith('~$') else name_date(base)
        if when:
            found.append((when, os.path.join(folder, base)))
    if not found:
        raise SystemExit(f'No workbook with a cut-off date in its name under {os.path.join(DATA, folder)}')
    return max(found)


def open_book(rel):
    return openpyxl.load_workbook(os.path.join(DATA, rel), read_only=True, data_only=True, keep_vba=False)


def clean(v, limit=None):
    if v is None:
        return None
    s = re.sub(r'\s+', ' ', str(v)).strip()
    if not s or s in ('-', 'NA', 'N/A', '#N/A'):
        return None
    return s[:limit] if limit else s


def iso(v):
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    return None


def num(v):
    if v is None or v == '':
        return None
    try:
        return round(float(str(v).replace(',', '')), 3)
    except ValueError:
        return None


def _fraction(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def plan():
    rows = list(open_book(latest('Procurement Plan')[1])['Package Summary'].iter_rows(values_only=True))
    head = next(i for i, r in enumerate(rows) if r and r[0] == 'Facility')
    out = []
    for r in rows[head + 1:]:
        if not r or not r[1] or not str(r[1]).startswith('STTP2B'):
            continue
        weight = _fraction(r[5])
        out.append({
            'code': str(r[1]).strip(), 'workPackage': clean(r[0]), 'name': clean(r[2]), 'packageType': clean(r[3]), 'remark': clean(r[4], 200),
            'weightPct': round(weight * 100, 4) if weight is not None else None,
        })
    return out


def _columns(rows, first):
    """Header row (first cell starts with `first`) and {header text: column}."""
    i = next(i for i, r in enumerate(rows) if r and r[0] and str(r[0]).strip().lower().startswith(first.lower()))
    index = {}
    for j, c in enumerate(rows[i]):
        if isinstance(c, str) and c.strip() and c.strip().lower() not in index:
            index[c.strip().lower()] = j
    return index, rows[i + 1:]


def _pick(index, row, *names):
    for n in names:
        for h, j in index.items():
            if h == n.lower() or h.startswith(n.lower()):
                return row[j] if j < len(row) else None
    return None


def logistics():
    book = open_book(latest('Logistics')[1])
    sheets = book.sheetnames
    ptsc = next(n for n in sheets if n in ('PTSC items', 'PTSC-supplied materials'))
    client = next(n for n in sheets if n in ('CLJOC Items', 'Client-supplied materials'))
    out = []
    index, rows = _columns(list(book[ptsc].iter_rows(values_only=True)), 'Item')
    for r in rows:
        if not r or not r[1]:
            continue
        g = lambda *n: _pick(index, r, *n)  # noqa: E731
        out.append({
            'source': 'PTSC', 'packageNo': clean(g('Package no')), 'packageDescription': clean(g('Package description'), 160), 'poNo': clean(g('PO no')), 'shipmentNo': clean(g('Actual shipment no')),
            'shipmentDescription': clean(g('Shipment description'), 160), 'etdPol': iso(g('ETD POL')), 'etaPod': iso(g('ETA POD')), 'forecastOnSite': iso(g('Forecast on site')), 'actualOnSite': iso(g('Actual on site')),
            'status': clean(g('Status at present')) or 'Planned', 'grossWeightKg': num(g('Gross weight')), 'qty': clean(g('Qty cont'), 80), 'packingList': clean(g('Packing List'), 80),
            'vessel': clean(g('Vessel'), 80), 'blNo': clean(g('BL/'), 80), 'portLoading': clean(g('Port of loading'), 80), 'portDischarge': clean(g('Port of discharge'), 80),
            'transport': clean(g('Transport Method'), 60), 'deliveryYard': clean(g('Delivery Yard'), 60), 'issue': clean(g('Pending'), 300),
        })
    index, rows = _columns(list(book[client].iter_rows(values_only=True)), 'No.')
    for r in rows:
        if not r or not isinstance(r[0], (int, float)):
            continue
        g = lambda *n: _pick(index, r, *n)  # noqa: E731
        actual = iso(g('ATA Site'))
        out.append({
            'source': 'Client', 'packageNo': clean(g('ITB No')), 'packageDescription': clean(g('Package description'), 160), 'poNo': None, 'shipmentNo': clean(g('Shipment No')),
            'shipmentDescription': clean(g('Shipment description'), 160), 'etdPol': None, 'etaPod': iso(g('ETA Port')), 'forecastOnSite': iso(g('Forecast on site')), 'actualOnSite': actual,
            'status': 'Received' if actual else 'Planned', 'grossWeightKg': num(g('GW')), 'qty': clean(g('No of pkg'), 80), 'packingList': None,
            'vessel': None, 'blNo': None, 'portLoading': None, 'portDischarge': None, 'transport': clean(g('Transport Method'), 60), 'deliveryYard': clean(g('Delivery Yard'), 60), 'issue': None,
        })
    return out


def balance():
    rows = list(open_book(latest('Materials', '*Stock Report*')[1])['Balance'].iter_rows(values_only=True))
    out = []
    for r in rows[1:]:
        if not r or not r[0]:
            continue
        place = ' / '.join(x for x in (clean(r[46]), clean(r[47])) if x)
        out.append({
            'facility': clean(r[0], 60), 'supply': clean(r[1], 40), 'discipline': clean(r[2], 40), 'serialNo': clean(r[3], 40), 'category': clean(r[4], 40),
            'materialCode': clean(r[10], 60), 'description': clean(r[11], 170), 'grade': clean(r[12], 60), 'poNo': clean(r[20], 80), 'shipmentNo': clean(r[21], 40),
            'supplier': clean(r[22], 100), 'mrirNo': clean(r[23], 60), 'heatNo': clean(r[24], 60), 'unit': clean(r[42], 20), 'balance': num(r[45]),
            'yard': clean(r[48], 40), 'location': place[:80] or None, 'status': clean(r[52], 40), 'remark': clean(r[49], 200),
        })
    return out


def summary():
    rows = list(open_book(latest('Materials', '*SUMMARY LIST*')[1])['Summary Weight'].iter_rows(values_only=True))
    out = []
    for r in rows[2:9]:
        if r[6] and any(v is not None for v in r[7:11]):  # PTSC MC supply: facility, MTO, arrived, transferred to VSP, on MC yard
            out.append({'supply': 'PTSC MC', 'facility': clean(r[6], 60), 'mtoKg': num(r[7]), 'arrivedKg': num(r[8]), 'vspYardKg': num(r[9]), 'mcYardKg': num(r[10])})
        if r[11] and r[12] is not None and not str(r[11]).startswith('Portion'):  # client supply: facility, MTO, arrived, on VSP yard, on MC yard
            out.append({'supply': 'Client', 'facility': clean(r[11], 60), 'mtoKg': num(r[12]), 'arrivedKg': num(r[13]), 'vspYardKg': num(r[14]), 'mcYardKg': num(r[15])})
    return out


def curves(cutoff):
    """One row per facility and scope; each series is a comma-separated list of cumulative percent, one value a week from `start`."""
    rows = list(open_book(latest('Procurement Plan')[1])['S-curve data'].iter_rows(values_only=True))
    dates = []
    for v in rows[0][9:]:
        if not isinstance(v, dt.datetime):
            break
        dates.append(v.date())
    assert all((b - a).days == 7 for a, b in zip(dates, dates[1:])), 'weeks are not evenly spaced'
    n_actual = sum(1 for d in dates if d.isoformat() <= cutoff)
    found = {}
    for r in rows[2:]:
        label = str(r[8] or '').strip().upper()
        scope, facility = r[2], clean(r[3])
        if scope not in ('LS', 'PS', 'OVR') or not facility or label not in ('PLANNED', 'FORECAST', 'ACTUAL'):
            continue
        vals = [_fraction(v) for v in r[9:9 + len(dates)]]
        vals = [None if v is None else round(v * 100, 2) for v in vals]
        if label == 'ACTUAL':
            vals = vals[:n_actual]
        found.setdefault((facility, scope), {})[label.lower() if label != 'PLANNED' else 'plan'] = ','.join('' if v is None else f'{v:g}' for v in vals)
    out = []
    for (facility, scope), s in found.items():
        if len(s) == 3:
            out.append({'facility': facility, 'scope': scope, 'start': dates[0].isoformat(), 'plan': s['plan'], 'forecast': s['forecast'], 'actual': s['actual']})
    return out


if __name__ == '__main__':
    seed = json.load(open(OUT, encoding='utf8'))
    seed['procurementPlan'] = plan()
    seed['logistics'] = logistics()
    seed['materialBalance'] = balance()
    seed['materialSummary'] = summary()
    cutoff = latest('Procurement Plan')[0].isoformat()
    seed['procCurves'] = curves(cutoff)
    with open(OUT, 'w', encoding='utf8') as f:
        json.dump(seed, f, ensure_ascii=False, separators=(',', ':'))
    print('procurement plan', latest('Procurement Plan')[1], '| logistics', latest('Logistics')[1], '| materials', latest('Materials', '*Stock Report*')[1])
    print({k: len(seed[k]) for k in ('procurementPlan', 'logistics', 'materialBalance', 'materialSummary', 'procCurves')}, os.path.getsize(OUT), 'bytes')
