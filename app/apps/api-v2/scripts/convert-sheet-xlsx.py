"""Convert a read-only Google Sheet XLSX export to API v2's private JSON import archive.

Usage: python convert-sheet-xlsx.py source.xlsx gids.json archive.json
The gids file is the Sheet API's {tab title: sheetId} metadata at export time.
"""
import json
import sys
from datetime import date, datetime, time
from pathlib import Path

from openpyxl import load_workbook


def value(cell):
    if cell is None:
        return None
    if isinstance(cell, datetime):
        return cell.isoformat(timespec="seconds") + ("Z" if cell.tzinfo is None else "")
    if isinstance(cell, (date, time)):
        return cell.isoformat()
    if isinstance(cell, bool):
        return "true" if cell else "false"
    if isinstance(cell, (str, int, float)):
        return cell
    return str(cell)


def convert(source: Path, gids_path: Path, destination: Path):
    gids = json.loads(gids_path.read_text(encoding="utf-8"))
    workbook = load_workbook(source, read_only=True, data_only=True)
    sheets = []
    for sheet in workbook.worksheets:
        matches = [name for name in gids if name == sheet.title or (len(sheet.title) == 31 and name.startswith(sheet.title))]
        if len(matches) != 1:
            raise ValueError(f"Cannot identify Google sheetId for {sheet.title}: {matches}")
        name = matches[0]
        iterator = sheet.iter_rows(values_only=True)
        first = next(iterator, ())
        header = [str(cell).strip() for cell in first if cell is not None and str(cell).strip()]
        if not header or len(header) != len(set(header)):
            raise ValueError(f"Missing or duplicate column names in {name}")
        rows = []
        for cells in iterator:
            if not any(cell is not None and cell != "" for cell in cells):
                continue
            if any(cell is not None and cell != "" for cell in cells[len(header):]):
                raise ValueError(f"Values beyond the known header in {name}")
            rows.append({key: value(cells[i] if i < len(cells) else None) for i, key in enumerate(header)})
        sheets.append({"name": name, "gid": gids[name], "header": header, "rows": rows})
        print(f"{name}: {len(rows)} rows")
    if len(sheets) != len(gids):
        raise ValueError(f"Export has {len(sheets)} tabs but metadata has {len(gids)}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({"sheets": sheets}, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {sum(len(s['rows']) for s in sheets)} rows across {len(sheets)} sheets")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Usage: convert-sheet-xlsx.py source.xlsx gids.json archive.json")
    convert(*(Path(arg) for arg in sys.argv[1:]))
