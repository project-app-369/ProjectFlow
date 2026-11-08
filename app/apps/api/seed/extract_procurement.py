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
import json
import os
import re

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'data', 'EPCIC', 'Procurement'))
OUT = os.path.join(HERE, 'sttp2b.json')


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
    rows = list(open_book('Procurement Plan/STTP2B-Procurement Plan-updated 06-Nov-26.xlsm')['Package Summary'].iter_rows(values_only=True))
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


def logistics():
    book = open_book('Logistics/Weekly Report Cut off 06.11.2026.xlsx')
    out = []
    rows = list(book['PTSC items'].iter_rows(values_only=True))
    for r in rows[5:]:
        if not r or not r[1]:
            continue
        out.append({
            'source': 'PTSC', 'packageNo': clean(r[1]), 'packageDescription': clean(r[2], 160), 'poNo': clean(r[3]), 'shipmentNo': clean(r[4]),
            'shipmentDescription': clean(r[5], 160), 'etdPol': iso(r[6]), 'etaPod': iso(r[7]), 'forecastOnSite': iso(r[8]), 'actualOnSite': iso(r[9]),
            'status': clean(r[10]) or 'Planned', 'grossWeightKg': num(r[11]), 'qty': clean(r[12], 80), 'packingList': clean(r[13], 80),
            'vessel': clean(r[15], 80), 'blNo': clean(r[16], 80), 'portLoading': clean(r[17], 80), 'portDischarge': clean(r[18], 80),
            'transport': clean(r[19], 60), 'deliveryYard': clean(r[20], 60), 'issue': clean(r[21], 300),
        })
    rows = list(book['CLJOC Items'].iter_rows(values_only=True))
    head = next(i for i, r in enumerate(rows) if r and r[0] == 'No.')
    for r in rows[head + 1:]:
        if not r or not isinstance(r[0], (int, float)):
            continue
        actual = iso(r[9])
        out.append({
            'source': 'Client', 'packageNo': clean(r[1]), 'packageDescription': clean(r[2], 160), 'poNo': None, 'shipmentNo': clean(r[3]),
            'shipmentDescription': clean(r[4], 160), 'etdPol': None, 'etaPod': iso(r[7]), 'forecastOnSite': iso(r[8]), 'actualOnSite': actual,
            'status': 'Received' if actual else 'Planned', 'grossWeightKg': num(r[5]), 'qty': clean(r[6], 80), 'packingList': None,
            'vessel': None, 'blNo': None, 'portLoading': None, 'portDischarge': None, 'transport': clean(r[10], 60), 'deliveryYard': clean(r[11], 60), 'issue': None,
        })
    return out


def balance():
    rows = list(open_book('Materials/STT2B - Material Stock Report Cut off 07.11.2026.xlsx')['Balance'].iter_rows(values_only=True))
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
    rows = list(open_book('Materials/STTP2B - MATERIAL SUMMARY LIST Cut off 07.11.2026.xlsx')['Summary Weight'].iter_rows(values_only=True))
    out = []
    for r in rows[2:9]:
        if r[6] and any(v is not None for v in r[7:11]):  # PTSC MC supply: facility, MTO, arrived, transferred to VSP, on MC yard
            out.append({'supply': 'PTSC MC', 'facility': clean(r[6], 60), 'mtoKg': num(r[7]), 'arrivedKg': num(r[8]), 'vspYardKg': num(r[9]), 'mcYardKg': num(r[10])})
        if r[11] and r[12] is not None and not str(r[11]).startswith('Portion'):  # client supply: facility, MTO, arrived, on VSP yard, on MC yard
            out.append({'supply': 'Client', 'facility': clean(r[11], 60), 'mtoKg': num(r[12]), 'arrivedKg': num(r[13]), 'vspYardKg': num(r[14]), 'mcYardKg': num(r[15])})
    return out


def curves(cutoff='2026-11-06'):
    """One row per facility and scope; each series is a comma-separated list of cumulative percent, one value a week from `start`."""
    rows = list(open_book('Procurement Plan/STTP2B-Procurement Plan-updated 06-Nov-26.xlsm')['S-curve data'].iter_rows(values_only=True))
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
    seed['procCurves'] = curves()
    with open(OUT, 'w', encoding='utf8') as f:
        json.dump(seed, f, ensure_ascii=False, separators=(',', ':'))
    print({k: len(seed[k]) for k in ('procurementPlan', 'logistics', 'materialBalance', 'materialSummary', 'procCurves')}, os.path.getsize(OUT), 'bytes')
