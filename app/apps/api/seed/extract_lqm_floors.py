"""
Equipment-list rows of the LQM#2 model, split by FLOOR, with ROS / ETA taken from the LQM#2 Procurement Plan (Construction -> Facility Layout).

    PYTHONIOENCODING=utf-8 python app/apps/api/seed/extract_lqm_floors.py

Reads
  app/apps/web/public/models/lqm/model.json                      the floors (decks) and the units on each (build_lqm_floors.py)
  data/EPCIC/Procurement/Procurement Plan/*LQM#2*Procurement Plan*.xlsx   newest: sheet PP-WP4-New LQ, per package PLANNED / FORECAST / ACTUAL ETA and ROS
  data/EPCIC/Procurement/Expediting/*Expediting Report*.xlsx     newest: the free-issue packages (HVAC equipment, steel piping, telecom, steel) are not in the
                                                                plan's dates; their items carry the ROS and the plan / forecast / actual arrival on site

One row per unit of the model (tag = LQ-<floor>-<discipline>, or an equipment tag such as ZCU-6810A), model = 'lqm', deck = the floor.
A discipline's packages are in the DISCIPLINE table. The row shows the CRITICAL package: the one with the smallest margin (ROS - ETA), and lists all of
them in the remarks. ETA = the actual arrival, else the forecast, else the plan. Rows of the other models are left alone.
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
MODEL = os.path.join(ROOT, 'app', 'apps', 'web', 'public', 'models', 'lqm', 'model.json')
MONTHS = {m: i + 1 for i, m in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split())}
# discipline of the model -> package codes of the LQM#2 plan that supply it (regex on the code)
DISCIPLINE = {
    'structural': r'LQBF-STR-00[123]$',
    'piping': r'LQ(BF)?-PIP-00[1-6][A-Z]?$',  # steel piping bulk (004A-C), gaskets, bolts, insulation, supports
    'piping_frp': r'LQ(BF)?-PIP-007[A-Z]?$',
    'hvac': r'LQ(BF)?-HVA-00\d$',
    'e_i': r'LQ(BF)?-(ELE-(?!002$)|INS-(?!001$|003$))\d{3}(-\d)?$',  # Lighting fixtures (ELE-002) and the fire & gas packages (INS-001, INS-003) have their own system
    'lighting': r'LQ(BF)?-ELE-002$',
    'fg': r'LQ(BF)?-INS-(001|003)$',
    'safety': r'LQ(BF)?-SAF-00\d$',
    'telecom': r'GFLQBF-TEL-001$',
    'architectural': r'LQ(BF)?-AR-00\d$',
    'equipment': r'LQ(BF)?-AR-001$',
    'lifting': r'(?!)',  # slings and laydown: no package in the plan
}
LABEL = {'structural': 'Structural', 'piping': 'Steel piping', 'piping_frp': 'FRP piping', 'hvac': 'HVAC', 'e_i': 'Electrical & instrument', 'telecom': 'Telecom', 'architectural': 'Architectural', 'equipment': 'Equipment (laundry washers and dryers)', 'lifting': 'Lifting rigging & sling', 'lighting': 'Lighting', 'fg': 'Fire & gas', 'safety': 'Safety (fire-fighting, life-saving)'}
# tagged equipment the model names -> (name, package code)
EQUIPMENT = {
    'ZCU-6810A': ('ACCU chiller and freezer (with ZCU-6810B)', 'STTP2B-LQ-HVA-001'),
    'ZCU-6810B': ('ACCU chiller and freezer (with ZCU-6810A)', 'STTP2B-LQ-HVA-001'),
    'ZEC-8546': ('HVAC control panel (including MCC)', 'STTP2B-LQ-HVA-001'),
    'ZEC-8556': ('Refrigerator control panel', 'STTP2B-LQ-HVA-001'),
    'ZEL-7311': ('Main board', 'STTP2B-LQ-ELE-001-1'),
    'ZET-7311': ('Transformer', 'STTP2B-LQ-ELE-001-2'),
}


def day(v):
    return v.date() if isinstance(v, dt.datetime) else None


def newest(pattern):
    files = glob.glob(pattern)

    def stamp(p):
        b = os.path.basename(p)
        m = re.search(r'(\d{1,2})-([A-Za-z]{3})-(\d{4})', b)
        if m:
            return (int(m.group(3)), MONTHS[m.group(2).title()], int(m.group(1)))
        m = re.search(r'_(\d{2})(\d{2})(\d{2})\.xlsx$', b)
        return (2000 + int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else (0, 0, 0)
    return max(files, key=stamp)


def plan_packages(path):
    """code -> {name, eta, ros, how}: from the plan, ETA = actual, else forecast, else planned."""
    warnings.simplefilter('ignore')
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True)['PP-WP4-New LQ']
    got = {}
    for r in ws.iter_rows(min_row=7, values_only=True):
        if not r[1] or r[3] not in ('PLANNED', 'FORECAST', 'ACTUAL'):
            continue
        code = str(r[1]).strip()
        p = got.setdefault(code, {'name': None})
        if r[3] == 'PLANNED':
            p['name'] = re.sub(r'\s+', ' ', str(r[5] or '')).strip()
            p['ros'] = day(r[20])
        p[r[3]] = day(r[18])
    out = {}
    for code, p in got.items():
        eta, how = (p.get('ACTUAL'), 'actual') if p.get('ACTUAL') else (p.get('FORECAST'), 'forecast') if p.get('FORECAST') else (p.get('PLANNED'), 'plan')
        out[code] = {'name': p['name'], 'eta': eta, 'ros': p.get('ros'), 'how': how, 'src': 'plan'}
    return out


def expediting_items(path):
    """Items of R1 (equipment) and R3 (piping) for LQ module packages: (sheet, code, name, tag, ROS, ETA)."""
    warnings.simplefilter('ignore')
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out = []
    for sheet in ('R1-Equipment', 'R3-Pipe-Fitting', 'R2-Structural Steel'):
        head = None
        for i, r in enumerate(wb[sheet].iter_rows(values_only=True)):
            if i == 2:
                head = {str(c).strip(): j for j, c in enumerate(r) if c}
                continue
            if i < 3 or head is None or not r[0] or not re.search(r'LQ', str(r[0])):
                continue
            tag = next((c for k, c in ((k, r[j]) for k, j in head.items() if k.startswith('MTO Item No')) if c), None)
            eta = day(r[head['Actual on site']]) or day(r[head['Forecast on site']]) or day(r[head['Plan on site']])
            out.append((sheet, str(r[0]).strip(), str(r[head.get('Package description', 3)] or '').replace('\n', ' ').strip(), str(tag or '').strip(), day(r[head['ROS']]), eta))
    return out


def margin(p):
    return (p['ros'] - p['eta']).days if p['ros'] and p['eta'] else None


def main():
    plan_path = newest(os.path.join(ROOT, 'data', 'EPCIC', 'Procurement', 'Procurement Plan', '*LQM#2*Procurement Plan*.xlsx'))
    exp_path = newest(os.path.join(ROOT, 'data', 'EPCIC', 'Procurement', 'Expediting', '*Expediting Report*.xlsx'))
    plan_cut = re.search(r'_(\d{2})(\d{2})(\d{2})\.xlsx$', os.path.basename(plan_path))
    plan_date = dt.date(2000 + int(plan_cut.group(1)), int(plan_cut.group(2)), int(plan_cut.group(3))).strftime('%d-%b-%Y')
    exp_date = re.search(r'(\d{1,2}-[A-Za-z]{3}-\d{4})', os.path.basename(exp_path)).group(1)
    packages = plan_packages(plan_path)
    items = expediting_items(exp_path)
    # packages the plan has no dates for (free issue): the latest ROS / ETA of their items in the expediting report
    for code in sorted({i[1] for i in items}):
        if code in packages and packages[code]['eta']:
            continue
        its = [i for i in items if i[1] == code]
        ros = max((i[4] for i in its if i[4]), default=None)
        eta = max((i[5] for i in its if i[5]), default=None)
        if ros or eta:
            packages[code] = {'name': its[0][2], 'eta': eta, 'ros': ros, 'how': 'last item', 'src': 'expediting'}
    model = json.load(open(MODEL, encoding='utf-8'))
    decks = {d['id']: d['name'] for d in model['decks']}
    seed = json.load(open(OUT, encoding='utf-8'))
    rows = [r for r in seed['facilityEquipment'] if r.get('model') != 'lqm']

    def row(tag, deck, name, codes, extra_note=None):
        pk = [(c, packages[c]) for c in codes if c in packages and (packages[c]['eta'] or packages[c]['ros'])]
        dated = [(margin(p), c, p) for c, p in pk if margin(p) is not None]
        crit = min(dated, key=lambda x: x[0]) if dated else None
        lines = [f"{c}  {p['name'] or ''}: ETA {p['eta'] or '-'} ({p['how']}), ROS {p['ros'] or '-'}" + (f", margin {margin(p)} days" if margin(p) is not None else '') for c, p in pk]
        return {'tag': tag, 'name': name, 'deck': deck, 'packageCode': ', '.join(codes)[:60] or None, 'vendor': None,
                'rosDate': crit[2]['ros'].isoformat() if crit else None, 'etaDate': crit[2]['eta'].isoformat() if crit else None,
                'status': None, 'packageStatus': ('Delay' if crit and crit[0] < 0 else 'Normal') if crit else None, 'method': None,
                'remarks': ((extra_note + '\n' if extra_note else '') + (f"Critical: {crit[1]}\n" if crit else '') + '\n'.join(lines))[:1900] or None, 'comments': None,
                'source': f'LQM#2 Procurement Plan {plan_date}' + (f'; free-issue packages: Expediting report {exp_date}' if any(packages[c]['src'] == 'expediting' for c, _ in pk) else '') if pk else 'No package of the LQM#2 plan covers it: add dates with Edit',
                'model': 'lqm'}
    for u in model['units']:
        tag, deck = u['tag'], decks[u['deck']]
        if u['system'] in DISCIPLINE and tag.startswith('LQ-'):
            codes = sorted(c for c in packages if re.search(DISCIPLINE[u['system']], c))
            rows.append(row(tag, deck, LABEL[u['system']], codes))
        elif tag in EQUIPMENT:
            name, code = EQUIPMENT[tag]
            r = row(tag, deck, name, [code], f'Tag in the LQM#2 model: {name}.')
            rows.append(r)
        else:
            rows.append({'tag': tag, 'name': u.get('name'), 'deck': deck, 'packageCode': None, 'vendor': None, 'rosDate': None, 'etaDate': None, 'status': None, 'packageStatus': None,
                         'method': None, 'remarks': 'Tag in the LQM#2 model; no package of the plan is known for it.', 'comments': None, 'source': 'Not in the plan: add dates with Edit', 'model': 'lqm'})
    # the ACCU pair is one model: the second tag has a row too, without a part of its own
    for tag in ('ZCU-6810B',):
        if not any(r['tag'] == tag for r in rows):
            name, code = EQUIPMENT[tag]
            r = row(tag, decks['deck'], name, [code], f'Modelled together with ZCU-6810A.')
            rows.append(r)
    seed['facilityEquipment'] = rows
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(seed, f, ensure_ascii=False, separators=(',', ':'))
    print(os.path.basename(plan_path), '|', os.path.basename(exp_path), '| packages with dates', sum(1 for p in packages.values() if p['eta'] or p['ros']))
    for r in rows:
        if r['model'] == 'lqm':
            print(f"{r['deck'][:11]:11s} {r['tag']:18s} ROS {r['rosDate'] or '-':10s} ETA {r['etaDate'] or '-':10s} {r['packageStatus'] or '':7s} {(r['name'] or '')[:36]}")


if __name__ == '__main__':
    main()
