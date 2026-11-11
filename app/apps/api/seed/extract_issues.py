"""
Adds the issue register to sttp2b.json from the task monitor in data/Governance/Issue Management.

    PYTHONIOENCODING=utf-8 python extract_issues.py

Key written (existing keys are left alone):
  issues   one row per task or issue of the "Master Task List" sheet

Cleaning: the status "In Progess" (sic) becomes "In progress", an empty status "Not started", "Done" "Completed"; an empty
priority becomes "Medium"; the "Discipline" column holds the responsible team (for example "T/I , CE") and is kept as written.
A "PIC" that is a name, not an email, goes into the remarks so it can be assigned by email in the app. The "MOM Review Log"
sheet records which items the meeting minutes closed; it is not loaded.
"""
import datetime as dt
import glob
import json
import os
import re

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'data', 'Governance', 'Issue Management'))
OUT = os.path.join(HERE, 'sttp2b.json')

STATUS = {'in progess': 'In progress', 'in progress': 'In progress', 'done': 'Completed', 'completed': 'Completed', 'pending': 'Pending', 'not started': 'Not started'}
PRIORITY = {'high': 'High', 'medium': 'Medium', 'low': 'Low', 'critical': 'Critical'}


def clean(v, limit=None):
    if v is None:
        return None
    s = re.sub(r'[ \t]+', ' ', str(v).replace('\r', '')).strip()
    s = re.sub(r'\n{3,}', '\n\n', s)
    if not s or s in ('-', 'NA', 'N/A'):
        return None
    return s[:limit] if limit else s


def iso(v):
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    return None


def issues():
    path = glob.glob(os.path.join(DATA, 'TASK_MONITOR_*.xlsx'))
    path = [p for p in path if not os.path.basename(p).startswith('~$')][0]
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = list(wb['Master Task List'].iter_rows(values_only=True))
    head = next(i for i, r in enumerate(rows) if r and r[0] == 'No.')
    out = []
    for r in rows[head + 1:]:
        if not r or not clean(r[1]):
            continue
        pic = clean(r[4])
        remarks = clean(r[11])
        if pic and '@' not in pic:
            remarks = (f'{remarks}\n' if remarks else '') + f'PIC named in the monitor, to be assigned by email: {pic}'
        out.append({
            'ref': clean(r[0], 20), 'title': clean(r[1], 200), 'description': clean(r[2], 2000),
            'priority': PRIORITY.get(str(r[5] or '').strip().lower(), 'Medium'), 'discipline': clean(r[6], 60),
            'status': STATUS.get(str(r[9] or '').strip().lower(), 'Not started'),
            'startDate': iso(r[7]), 'dueDate': iso(r[8]), 'nextAction': clean(r[10], 1500), 'remarks': clean(remarks, 1500),
            'raisedDate': iso(r[12]),
        })
    return out


if __name__ == '__main__':
    seed = json.load(open(OUT, encoding='utf8'))
    seed['issues'] = issues()
    with open(OUT, 'w', encoding='utf8') as f:
        json.dump(seed, f, ensure_ascii=False, separators=(',', ':'))
    from collections import Counter
    print(len(seed['issues']), Counter(i['status'] for i in seed['issues']), Counter(i['priority'] for i in seed['issues']))
