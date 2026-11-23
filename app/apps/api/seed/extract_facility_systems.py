"""
Adds one equipment-list row per SYSTEM of the Jacket and Link Bridge 3D models to sttp2b.json (Construction -> Facility Layout),
with the ROS and ETA of the material packages that supply that system.

    PYTHONIOENCODING=utf-8 python app/apps/api/seed/extract_facility_systems.py

Reads
  app/apps/web/public/models/{jacket,lqm,linkbridge}/model.json   the systems (groups) the 3D pipeline built
  data/EPCIC/Procurement/Expediting/*Expediting Report*.xlsx     newest cut-off, item sheets R1, R2, R3, R5 (facility, ROS, plan / forecast / actual on site)

Rules (RULES below) say which items of the report feed which system: a package-code pattern and a facility pattern.
  ROS = the latest ROS of those items, ETA = the latest arrival on site (actual, else forecast, else plan), i.e. when the last item is there.
A system no package in the report covers (piles, conductors, risers, J-tubes, most of the LQM...) keeps empty dates and says so in `source`.

Key written: facilityEquipment (rows of the topside are kept, rows of the other models are rebuilt). Same row shape as extract_facility.py,
plus `model` (topside / jacket / lqm / linkbridge). `tag` = <prefix>-<group id>, e.g. JKT-piles.
"""
import datetime as dt
import glob
import json
import os
import re
import warnings

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUT = os.path.join(HERE, 'sttp2b.json')
MODELS = os.path.join(ROOT, 'app', 'apps', 'web', 'public', 'models')
PREFIX = {'jacket': 'JKT', 'linkbridge': 'LB'}  # the LQM#2 is split by floor: extract_lqm_floors.py
LABEL = {'jacket': 'ST-CGF Jacket', 'linkbridge': 'Link Bridge'}
SHEETS = {'R1': 'R1-Equipment', 'R2': 'R2-Structural Steel', 'R3': 'R3-Pipe-Fitting', 'R5': 'R5-Misc'}

# (sheets, package code regex, facility regex)
JACKET_STEEL = [('R2', r'GF-STR-001', r'^CGF JACKET$')]
RULES = {
    'jacket': {
        'structure': [('R1', r'GF-STR-011', r'CGF JACKET')] + JACKET_STEEL,
        'anodes': [('R5', r'GF-STR-008', r'^CGF JACKET$')],
        'flooding': [('R5', r'GF-STR-009', r'^CGF JACKET$')],
        'valve_panel': [('R5', r'GF-STR-009', r'^CGF JACKET$')],
        'fenders': [('R5', r'GF-STR-012', r'^CGF JACKET$')],
        'grating': [('R5', r'GF-STR-003', r'^CGF JACKET$')],
        'launch_cradle': [('R5', r'GF-STR-006', r'^CGF JACKET$')],
        **{g: JACKET_STEEL for g in ('row_5_1', 'row_2_1', 'row_5', 'row_2', 'grating_support', 'mudmat', 'conductor_guide', 'conductor_guard', 'caisson_guard',
                                      'seawater_caisson', 'open_drain', 'overboard', 'bridge_support', 'bridge_tower', 'ti_platform', 'buoyancy_tanks')},
    },
    'lqm': {
        'hvac': [('R1', r'LQ-HVA', r'LQ MODULE')],
        'telecom': [('R1', r'LQBF-TEL', r'.')],
        'piping': [('R3', r'LQBF-PIP', r'^LQ MODULE$')],
    },
    'linkbridge': {
        'structure': [('R2', r'GF-STR-001', r'^BRIDGE CGF STPIP$')],
        'grating_railing': [('R5', r'GF-STR-003', r'^BRIDGE CGF STPIP$')],
        'piping': [('R3', r'GF-PIP-010', r'^BRIDGE CGF STPIP$')],
        'piping_frp': [('R3', r'GF-PIP-011', r'^BRIDGE CGF STPIP$')],
        'electrical': [('R5', r'GF-ELE', r'^BRIDGE')],
        'misc': [('R5', r'GF-STR-002', r'^BRIDGE CGF STPIP$')],
    },
}
MONTHS = {m: i + 1 for i, m in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split())}


def day(v):
    return v.date() if isinstance(v, dt.datetime) else None


def newest_report():
    files = glob.glob(os.path.join(ROOT, 'data', 'EPCIC', 'Procurement', 'Expediting', '*Expediting Report*.xlsx'))

    def stamp(p):
        m = re.search(r'(\d{1,2})-([A-Za-z]{3})-(\d{4})', os.path.basename(p))
        return (int(m.group(3)), MONTHS[m.group(2).title()], int(m.group(1))) if m else (0, 0, 0)
    return max(files, key=stamp)


def report_items(path):
    """Every item of the sheets: (sheet key, package code, package description, vendor, facility, ROS, ETA)."""
    warnings.simplefilter('ignore')
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out = []
    for key, name in SHEETS.items():
        head = None
        for i, r in enumerate(wb[name].iter_rows(values_only=True)):
            if i == 2:
                head = {str(c).strip(): j for j, c in enumerate(r) if c}
                continue
            if i < 3 or head is None or not r[0] or not str(r[0]).startswith('STT'):
                continue
            eta = day(r[head['Actual on site']]) or day(r[head['Forecast on site']]) or day(r[head['Plan on site']])
            out.append((key, str(r[0]).strip(), str(r[head.get('Package description', 2)] or '').replace('\n', ' ').strip(), str(r[head.get('Vendor', 3)] or '').strip(),
                        str(r[head['Facility']] or ''), day(r[head['ROS']]), eta))
    return out


def main():
    path = newest_report()
    cutoff = re.search(r'(\d{1,2}-[A-Za-z]{3}-\d{4})', os.path.basename(path)).group(1)
    items = report_items(path)
    seed = json.load(open(OUT, encoding='utf-8'))
    rows = [dict(r, model=r.get('model') or 'topside') for r in seed['facilityEquipment'] if (r.get('model') or 'topside') in ('topside', 'lqm')]
    for model, prefix in PREFIX.items():
        groups = json.load(open(os.path.join(MODELS, model, 'model.json'), encoding='utf-8'))['groups']
        for g in groups:
            hits = []
            for sheets, code, fac in RULES[model].get(g['id'], []):
                hits += [it for it in items if it[0] == sheets and re.search(code, it[1]) and re.search(fac, it[4])]
            ros = max((h[5] for h in hits if h[5]), default=None)
            eta = max((h[6] for h in hits if h[6]), default=None)
            codes = sorted({h[1] for h in hits})
            names = sorted({h[2] for h in hits if h[2]})
            vendors = sorted({h[3] for h in hits if h[3]})
            rows.append({
                'tag': f"{prefix}-{g['id']}", 'name': g['name'], 'deck': LABEL[model], 'packageCode': ', '.join(codes)[:60] or None,
                'vendor': ('; '.join(vendors))[:160] or None, 'rosDate': ros.isoformat() if ros else None, 'etaDate': eta.isoformat() if eta else None,
                'status': None, 'packageStatus': None, 'method': None,
                'remarks': (f"{len(hits)} items of: " + '; '.join(names))[:1500] if hits else None, 'comments': None,
                'source': f'Expediting report {cutoff}: last item on site' if hits else 'No package of the expediting report covers this system: add dates with Edit',
                'model': model,
            })
    seed['facilityEquipment'] = rows
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(seed, f, ensure_ascii=False, separators=(',', ':'))
    print(os.path.basename(path), 'rows', len(rows))
    for r in rows:
        if r['model'] != 'topside':
            print(f"{r['model']:10s} {r['tag']:28s} ROS {r['rosDate'] or '-':10s} ETA {r['etaDate'] or '-':10s} {r['packageCode'] or ''}")


if __name__ == '__main__':
    main()
