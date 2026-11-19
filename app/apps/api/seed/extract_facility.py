"""
Loads the seed rows of the 3D facility model's equipment, with their delivery dates, into sttp2b.json (Construction -> Facility Layout).

    PYTHONIOENCODING=utf-8 python app/apps/api/seed/extract_facility.py

Reads
  app/apps/web/public/models/facility/facility-model.json   the equipment (tag, deck) that data/3d-model/pipeline built into the GLB files
  data/EPCIC/Procurement/Expediting/*Expediting Report*.xlsx  newest cut-off: sheet R1-Equipment (tag, shipments, ROS, on-site dates)
                                                             and Equipment-Summary (highlight and short-term action plan per package)
  data/3d-model/*INTRODUCTION UPDATE*.pptx                    ETA / ROS the project introduction deck gives for tags the report does not list

Key written (the other keys are left alone):
  facilityEquipment  rows {tag, name, deck, packageCode, vendor, rosDate, etaDate, status, packageStatus, method, remarks, comments, source}
                     one per equipment unit of the model. `method` (Lift by Crane / Skidding) is not in any report: it is left empty for the
                     team to fill in the app. A tag with no row in the expediting report keeps empty dates and says so in `source`.
                     The rows only seed the database once; people then add, edit and delete equipment in Construction -> Facility Layout.
"""
import datetime as dt
import glob
import json
import os
import re
import zipfile

import openpyxl
from openpyxl.reader import excel

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUT = os.path.join(HERE, 'sttp2b.json')
MANIFEST = os.path.join(ROOT, 'app', 'apps', 'web', 'public', 'models', 'facility', 'facility-model.json')
TAG = re.compile(r'[A-Z]{1,4}\d?-\d{3,5}[A-Z]{0,2}')
MONTHS = {m: i + 1 for i, m in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split())}
SPARE = re.compile(r'bolts|nuts|gasket|lifting equipment|spare|accessor|document|tools?\b|commissioning', re.I)


def iso(v):
    if isinstance(v, dt.datetime):
        return v.strftime('%Y-%m-%d')
    if isinstance(v, str):
        m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', v.strip())
        if m:
            return '-'.join(m.groups())
    return None


def clean(v, cap=1500):
    if v is None:
        return None
    s = re.sub(r'[ \t]+', ' ', str(v)).strip()
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s[:cap] or None


def one_line(v, cap=200):
    s = clean(v, cap * 2)
    return re.sub(r'\s+', ' ', s.splitlines()[0]).strip()[:cap] if s else None


def newest_report():
    files = glob.glob(os.path.join(ROOT, 'data', 'EPCIC', 'Procurement', 'Expediting', '*Expediting Report*.xlsx'))

    def stamp(p):
        m = re.search(r'(\d{1,2})-([A-Za-z]{3})-(\d{4})', os.path.basename(p))
        return (int(m.group(3)), MONTHS[m.group(2).title()], int(m.group(1))) if m else (0, 0, 0)
    return max(files, key=stamp)


def report_rows(path):
    excel.warnings.simplefilter('ignore')
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    by_tag = {}
    for r in wb['R1-Equipment'].iter_rows(min_row=4, values_only=True):
        if not r[0] or not r[6]:
            continue
        for tag in TAG.findall(str(r[6]).replace('_', '')):
            by_tag.setdefault(tag, []).append(r)
    summary = {}
    for r in wb['Equipment-Summary'].iter_rows(min_row=3, values_only=True):
        if r[0] and str(r[0]).startswith('STT'):
            summary[str(r[0]).strip()] = r
    return by_tag, summary


def pick(rows):
    main = [r for r in rows if not SPARE.search(str(r[10] or '')) and not SPARE.search(str(r[15] or ''))]
    return (main or rows)[0]


def intro_deck(path):
    """ETA / ROS per tag from the project introduction deck: each block reads name, (tags), ETA: d-Mon-yy, ROS: d-Mon-yy."""
    out = {}
    if not path:
        return out
    z = zipfile.ZipFile(path)
    slides = sorted((n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)), key=lambda s: int(re.findall(r'\d+', s)[0]))

    def day(s):
        m = re.search(r'(\d{1,2})-\s*([A-Za-z]{3})-(\d{2})', s)
        return f'20{m.group(3)}-{MONTHS[m.group(2).title()]:02d}-{int(m.group(1)):02d}' if m else None
    for n in slides:
        xml = z.read(n).decode('utf8')
        paras = [''.join(re.findall(r'<a:t>([^<]*)</a:t>', p)).strip() for p in re.findall(r'<a:p>.*?</a:p>', xml, re.S)]
        buf, eta = [], None
        for p in (x for x in paras if x):
            if p.startswith(('ETA:', 'Remaining ETA:')):
                eta = day(p)
            elif p.startswith('ROS:'):
                text = ' '.join(buf)
                tags = []
                for m in re.finditer(r'([A-Z]{1,4}\d?-\d{3,5})([A-Z])(?:/([A-Z]))?', text):
                    tags += [m.group(1) + m.group(2)] + ([m.group(1) + m.group(3)] if m.group(3) else [])
                tags += [t for t in TAG.findall(text) if not any(x.startswith(t) for x in tags)]
                name = re.split(r'\(|\bDV-|\b[A-Z]{1,4}-\d', text)[0].strip(' /') or None
                for t in tags:
                    out[t] = {'name': name, 'eta': eta, 'ros': day(p)}
                buf, eta = [], None
            elif not p.endswith('Deck Equipment') and 'Lifting' not in p and not re.match(r'(ID|MD|E-House|E-HOUSE|Internmediate|Equipment$|\(Hold)', p):
                buf.append(p)
    return out


def main():
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    decks = {d['id']: d for d in manifest['decks']}
    report_path = newest_report()
    by_tag, summary = report_rows(report_path)
    intro_path = (glob.glob(os.path.join(ROOT, 'data', '3d-model', '*INTRODUCTION UPDATE*.pptx')) or [None])[0]
    intro = intro_deck(intro_path)
    cutoff = re.search(r'(\d{1,2}-[A-Za-z]{3}-\d{4})', os.path.basename(report_path)).group(1)
    order = {d['id']: i for i, d in enumerate(manifest['decks'])}
    rows = []
    for u in sorted(manifest['units'], key=lambda u: (order[u['deck']], u['tag'])):
        tag = u['tag']
        hit = by_tag.get(tag)
        row = {'tag': tag, 'name': None, 'deck': decks[u['deck']]['name'], 'packageCode': None, 'vendor': None, 'rosDate': None, 'etaDate': None,
               'status': None, 'packageStatus': None, 'method': None, 'remarks': None, 'comments': None, 'source': None}
        if hit:
            r = pick(hit)
            sm = summary.get(str(r[0]).strip())
            # ETA: the actual arrival on site; else the package's ETA at site (the maintained figure, several cells of R1 are #REF! or a year old);
            # else the forecast, then the plan, on site. ROS: R1, else the package's.
            eta = iso(r[25]) or (iso(sm[4]) if sm else None) or iso(r[24]) or iso(r[23])
            row.update(name=one_line(r[10] if r[10] and not SPARE.search(str(r[10])) else r[3]), packageCode=str(r[0]).strip(), vendor=clean(r[4], 120), rosDate=iso(r[26]) or (iso(sm[3]) if sm else None), etaDate=eta,
                       status=clean(r[28], 60), packageStatus=clean(sm[6], 40) if sm else None,
                       remarks=clean(sm[26]) if sm and clean(sm[26]) and clean(sm[26]).lower() not in ('no', 'none', 'n/a') else None, comments=clean(sm[27]) if sm else None,
                       source=f'Expediting report {cutoff}')
        i = intro.get(tag)
        if i:
            if not row['name']:
                row['name'] = one_line(i['name'])
            if not row['rosDate'] and not row['etaDate']:
                row.update(rosDate=i['ros'], etaDate=i['eta'], source='Project introduction deck 30-Oct-2026 (not in the expediting report)')
        if not row['source']:
            row['source'] = 'Not in the expediting report: add dates with Edit'
        rows.append(row)
    seed = json.load(open(OUT, encoding='utf-8'))
    seed['facilityEquipment'] = rows
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(seed, f, ensure_ascii=False, separators=(',', ':'))
    dated = sum(1 for r in rows if r['rosDate'] or r['etaDate'])
    print(os.path.basename(report_path), 'units', len(rows), 'with dates', dated, 'named', sum(1 for r in rows if r['name']))
    for r in rows:
        print(f"{r['deck'][:12]:12s} {r['tag']:11s} {(r['name'] or '-')[:34]:34s} ROS {r['rosDate'] or '-':10s} ETA {r['etaDate'] or '-':10s} {r['packageStatus'] or '':8s} {(r['source'] or '')[:22]}")


if __name__ == '__main__':
    main()
