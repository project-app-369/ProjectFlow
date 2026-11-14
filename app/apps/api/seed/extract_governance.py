"""
Adds the risk and interface registers to sttp2b.json from data/Governance/Risk Management and Interface Management.

    python extract_governance.py

Keys written (other keys are left alone):
  risks              one row per risk of "Risk Register (Internal)"; ratings stored as scores 1-4
  riskMatrix         the 4 x 4 "Risk Level Matrix": one row per cell with its level, read from the cell colour
  riskBreakdown      the risk breakdown structure (RBS): category (level 1) and discipline (level 2) codes
  interfacePoints    one row per interface point of "Interface Points"
  interfaceParties   party codes and names ("Parties" sheet, plus the codes used in the matrices)
  responsibility     "RESPONSIBILITY MATRIX LVL 2": who performs each scope activity, per facility (one row per cell)
  rasci              the RASCI sheets: each party's role (R, A, S, C, I, R&A) per scope activity (one row per cell)

Cleaning: ratings are words in the workbook ("Possible", "Moderate") and become their score on the matrix; the header row
that the workbook repeats inside the table is skipped; statuses lose their number prefix ("5-Monitor" becomes "Monitor").
An interface point marked OPEN that already has a resolution becomes "Responded"; RESOLVED becomes "Resolved". Where the
remarks carry an IDR number (STTP2B-IDR-EXT-PMC-CLJOC-0005), the receiving party is read from it (PVEP-CL) and the text in
the "Target party" column, which in those rows is a subject such as "X-Mass Tree Data", becomes the point's subject.
"""
import datetime as dt
import glob
import json
import os
import re
import sys

import openpyxl

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
GOV = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'data', 'Governance'))
OUT = os.path.join(HERE, 'sttp2b.json')

PROBABILITY = {'rare': 1, 'unlikely': 2, 'possible': 3, 'probable': 4}
SEVERITY = {'negligible': 1, 'minor': 2, 'moderate': 3, 'major': 4}
STATUSES = ['New', 'Firmed', 'Under assessment', 'Under resolving', 'Monitor', 'Closed']
STRATEGIES = {'mitigate': 'Mitigate', 'avoid': 'Avoid', 'transfer': 'Transfer', 'accept': 'Accept', 'escalate': 'Escalate'}
# Fill colours of the workbook's matrix cells: green, yellow, red.
LEVEL_OF_FILL = {'92D14F': 'Low', '92D050': 'Low', 'FFFF00': 'Medium', 'FE504F': 'High', 'FF0000': 'High'}
KNOWN_PARTIES = {
    'CTR': 'Contractor', 'CPY': 'Company', 'TEN': 'Technip Energies', 'VSP': 'Vietsovpetro', 'DKE': 'DKE (WHP-C engineering)',
    'JK-SUB': 'Jacket subcontractor', 'LB-SUB': 'Link bridge subcontractor', 'P/C-SUB': 'Piles & conductor subcontractor',
    'LQ-SUB': 'LQ module subcontractor', 'BFM': 'Brownfield modification contractor', 'T&I': 'Transport & installation contractor',
    'HUC': 'Hook-up & commissioning contractor', 'P&C SCTR': 'Piles & conductor subcontractor', 'PVE': 'PV Engineering',
}


def file(*parts):
    hits = [p for p in glob.glob(os.path.join(GOV, *parts)) if not os.path.basename(p).startswith('~$')]
    return hits[0]


def clean(v, limit=None):
    if v is None:
        return None
    s = re.sub(r'[ \t]+', ' ', str(v).replace('\r', '')).strip()
    s = re.sub(r'\n{3,}', '\n\n', s)
    if not s or s in ('-', 'NA', 'N/A', 'None'):
        return None
    return s[:limit] if limit else s


def iso(v):
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    return None


def rating(table, v):
    return table.get((clean(v) or '').lower())


def risks():
    wb = openpyxl.load_workbook(file('Risk Management', '*Risk Register*.xlsx'), data_only=True)
    rows = list(wb['Risk Register (Internal)'].iter_rows(values_only=True))
    head = next(i for i, r in enumerate(rows) if r and r[0] == 'No' and r[12] == 'Pre-probability')
    col = {clean(h): i for i, h in enumerate(rows[head]) if clean(h)}
    g = lambda r, name: r[col[name]] if col.get(name) is not None and col[name] < len(r) else None
    out = []
    for r in rows[head + 1:]:
        rid, title = clean(g(r, 'Risk ID')), clean(g(r, 'Risk Title'))
        if not rid or not title or rid == 'Risk ID':
            continue
        status = re.sub(r'^\d+\s*-\s*', '', clean(g(r, 'Status')) or '')
        status = next((s for s in STATUSES if s.lower() == status.lower()), 'New')
        out.append({
            'no': g(r, 'No') if isinstance(g(r, 'No'), (int, float)) else None,
            'riskId': rid, 'status': status, 'rbs': clean(g(r, 'RBS')), 'category': clean(g(r, 'Discipline')), 'discipline': clean(g(r, 'Sub-Discipline')),
            'title': clean(title, 200), 'description': clean(g(r, 'Risk Description'), 2000), 'cause': clean(g(r, 'Possible Cause'), 2000),
            'effect': clean(g(r, 'Possible Effect'), 2000), 'owner': clean(g(r, 'Risk Owner'), 120), 'recordDate': iso(g(r, 'Record Date')),
            'preProbability': rating(PROBABILITY, g(r, 'Pre-probability')),
            'preSchedule': rating(SEVERITY, g(r, 'Pre-Schedule')), 'preCost': rating(SEVERITY, g(r, 'Pre-Cost')),
            'preScope': rating(SEVERITY, g(r, 'Pre-Scope')), 'preQuality': rating(SEVERITY, g(r, 'Pre-Quality')),
            'strategy': STRATEGIES.get((clean(g(r, 'Response Strategy')) or '').lower()),
            'mitigationCause': clean(g(r, 'Mitigation of Cause'), 2000), 'mitigationEffect': clean(g(r, 'Mitigation of Effect'), 2000),
            'planDate': iso(g(r, 'Plan Action Date')), 'actualActions': clean(g(r, 'Actual Actions'), 2000), 'actualDate': iso(g(r, 'Actual Action Date')),
            'postProbability': rating(PROBABILITY, g(r, 'Post-probability')),
            'postSchedule': rating(SEVERITY, g(r, 'Post-Schedule')), 'postCost': rating(SEVERITY, g(r, 'Post-Cost')),
            'postScope': rating(SEVERITY, g(r, 'Post-Scope')), 'postQuality': rating(SEVERITY, g(r, 'Post-Quality')),
            'remark': clean(g(r, 'Remark'), 1500), 'external': 'Yes' if (clean(g(r, 'isExternal')) or '').lower() in ('yes', 'y', 'true') else 'No',
        })
    return out


def risk_matrix():
    wb = openpyxl.load_workbook(file('Risk Management', '*Risk Register*.xlsx'))
    ws = wb['Risk Level Matrix']
    rows = list(ws.iter_rows(max_col=8))
    label_row = next(r for r in rows if any(clean(c.value) == 'Negligible' for c in r))
    score_row = next(r for r in rows if any(clean(c.value) == 'Scoring' for c in r))
    sev_labels = {c.column: clean(c.value) for c in label_row if clean(c.value) in ('Negligible', 'Minor', 'Moderate', 'Major')}
    sev_scores = {c.column: int(c.value) for c in score_row if c.column in sev_labels and isinstance(c.value, (int, float))}
    out = []
    for row in rows:
        p, label = row[1].value, clean(row[2].value)
        if not isinstance(p, (int, float)) or (label or '').lower() not in PROBABILITY:
            continue
        for c in row:
            if c.column not in sev_scores:
                continue
            fill = (c.fill.fgColor.rgb or '')[-6:] if c.fill and c.fill.fill_type else ''
            s = sev_scores[c.column]
            out.append({'probability': int(p), 'probabilityLabel': label, 'severity': s, 'severityLabel': sev_labels[c.column],
                        'score': int(p) * s, 'level': LEVEL_OF_FILL.get(fill.upper(), 'Medium')})
    return sorted(out, key=lambda c: (-c['probability'], c['severity']))


def risk_breakdown():
    wb = openpyxl.load_workbook(file('Risk Management', '*Risk Register*.xlsx'), data_only=True)
    out, cat, cat_name = [], None, None
    for r in wb['RBS'].iter_rows(min_row=3, values_only=True):
        if clean(r[0]):
            cat, cat_name = clean(r[0]), clean(r[1])
        if clean(r[2]) and cat:
            out.append({'code': f'{cat}-{clean(r[2])}', 'category': cat, 'categoryName': cat_name, 'discipline': clean(r[2]), 'disciplineName': clean(r[3])})
    return out


def interface_points():
    wb = openpyxl.load_workbook(file('Interface Management', 'Interface points', '*.xlsx'), data_only=True)
    rows = list(wb['Interface Points'].iter_rows(values_only=True))
    head = next(i for i, r in enumerate(rows) if r and r[1] == 'IP No')
    col = {clean(h): i for i, h in enumerate(rows[head]) if clean(h)}
    g = lambda r, name: r[col[name]] if name in col else None
    out = []
    for r in rows[head + 1:]:
        ip, desc = clean(g(r, 'IP No')), clean(g(r, 'Interface Description'))
        if not ip or not desc:
            continue
        raw = (clean(g(r, 'Status')) or '').upper()
        resolution = clean(g(r, 'Resolution'), 3000)
        status = 'Resolved' if raw in ('RESOLVED', 'CLOSED') else 'Responded' if resolution else 'Open'
        target, subject, remarks = clean(g(r, 'Target party'), 200), None, clean(g(r, 'Remarks'), 1500)
        # An IDR number (STTP2B-IDR-EXT-<from>-<to>-NNNN) names the receiving party; the target column then holds the subject.
        idr = re.search(r'IDR-EXT-[A-Z]+-(CLJOC|PVEP-?CL)-\d', remarks or '')
        if idr:
            target, subject = 'PVEP-CL', target
        out.append({
            'no': g(r, 'No') if isinstance(g(r, 'No'), (int, float)) else None, 'id': ip, 'owner': clean(g(r, 'IP Owner'), 120),
            'workPackage': clean(g(r, 'Workpack'), 60), 'discipline': clean(g(r, 'Discipline'), 40), 'status': status,
            'originator': clean(g(r, 'Originated party'), 80), 'target': target, 'subject': re.sub(r'\s+', ' ', subject) if subject else None,
            'description': clean(desc, 3000), 'action': clean(g(r, 'Recommended action'), 3000),
            'queryDate': iso(g(r, 'Query date')), 'targetDate': iso(g(r, 'Target date')), 'reference': clean(g(r, 'Reference Document'), 500),
            'resolution': resolution, 'resolvedDate': iso(g(r, 'Resolved date')), 'resolvedDocument': clean(g(r, 'Resolved Document'), 300),
            'remarks': remarks,
        })
    return out


def interface_parties(points, responsibility, rasci):
    wb = openpyxl.load_workbook(file('Interface Management', 'Interface points', '*.xlsx'), data_only=True)
    named = {}
    for r in wb['Parties'].iter_rows(min_row=2, values_only=True):
        if clean(r[1]):
            named[clean(r[1])] = clean(r[2]) or clean(r[1])
    used = {p for x in points for p in (x['originator'], x['target']) if p} | {x['party'] for x in responsibility} | {x['party'] for x in rasci}
    codes = list(named) + sorted(c for c in used if c not in named)
    return [{'code': c, 'name': named.get(c) or KNOWN_PARTIES.get(c) or c} for c in codes]


def responsibility():
    wb = openpyxl.load_workbook(file('Interface Management', 'Interface matrix', '*.xlsx'), data_only=True)
    ws = wb['RESPONSIBILITY MATRIX LVL 2']
    rows = list(ws.iter_rows(values_only=True))
    wp_row = next(i for i, r in enumerate(rows) if r and clean(r[1]) == 'SCOPE')
    wps, last = {}, None
    for i, v in enumerate(rows[wp_row]):
        if i >= 2 and clean(v) and clean(v) != 'Remarks':
            last = clean(v)
        if i >= 2:
            wps[i] = last
    facilities = {i: clean(v).replace('\n', ' ') for i, v in enumerate(rows[wp_row + 1]) if i >= 2 and clean(v)}
    remark_col = next(i for i, v in enumerate(rows[wp_row]) if clean(v) == 'Remarks')
    out, section, order = [], None, 0
    for r in rows[wp_row + 2:]:
        ref, activity = clean(r[0]), clean(r[1])
        if not activity:
            continue
        is_section = bool(ref and re.fullmatch(r'[IVX]+', ref))
        if is_section:
            section = activity
        order += 1
        for i, fac in facilities.items():
            party = clean(r[i])
            if not party:
                continue
            out.append({'order': order, 'section': section, 'ref': ref, 'activity': activity.strip(), 'level': 1 if is_section else 2,
                        'workPackage': wps.get(i), 'facility': fac, 'party': party, 'remark': clean(r[remark_col], 500)})
    return out


def rasci():
    wb = openpyxl.load_workbook(file('Interface Management', 'Interface matrix', '*.xlsx'), data_only=True)
    out = []
    for sheet, matrix in (('LQM 1&2 RASCI', 'LQ Module #1 & #2'), ('CGF-JK & LB RASCI', 'CGF Jacket & Link Bridge')):
        rows = list(wb[sheet].iter_rows(values_only=True))
        scope = next(i for i, r in enumerate(rows) if r and clean(r[1]) == 'SCOPE')
        phases, last = {}, None
        for i, v in enumerate(rows[scope]):
            if i >= 2 and clean(v) and clean(v) != 'Remarks':
                last = clean(v).title()
            phases[i] = last
        parties = {i: clean(v) for i, v in enumerate(rows[scope + 1]) if i >= 2 and clean(v)}
        remark_col = next(i for i, v in enumerate(rows[scope]) if clean(v) == 'Remarks')
        section, order = None, 0
        for r in rows[scope + 2:]:
            ref, activity = clean(r[0]), clean(r[1])
            if not activity:
                continue
            if ref and re.fullmatch(r'[IVX]+', ref):
                section = activity
                continue
            order += 1
            for i, party in parties.items():
                role = clean(r[i])
                if not role or i == remark_col:
                    continue
                out.append({'matrix': matrix, 'order': order, 'section': section, 'ref': ref, 'activity': activity.strip(),
                            'phase': phases.get(i), 'party': party, 'role': role.upper().replace(' ', ''), 'remark': clean(r[remark_col], 500)})
    return out


def main():
    data = json.load(open(OUT, encoding='utf-8'))
    data['risks'] = risks()
    data['riskMatrix'] = risk_matrix()
    data['riskBreakdown'] = risk_breakdown()
    data['interfacePoints'] = interface_points()
    data['responsibility'] = responsibility()
    data['rasci'] = rasci()
    data['interfaceParties'] = interface_parties(data['interfacePoints'], data['responsibility'], data['rasci'])
    json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for k in ('risks', 'riskMatrix', 'riskBreakdown', 'interfacePoints', 'responsibility', 'rasci', 'interfaceParties'):
        print(k, len(data[k]))


if __name__ == '__main__':
    main()
