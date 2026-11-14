"""Print every sheet of an .xlsx file as tab-separated text (cached values, not formulas).

Used by scripts/ci-fetch-sources.mjs inside the fetch-sources workflow.
Usage: python3 xlsx_to_text.py <file.xlsx>
"""
import sys

from openpyxl import load_workbook

wb = load_workbook(sys.argv[1], data_only=True, read_only=True)
for ws in wb.worksheets:
    print(f"\n---- sheet {ws.title} ----")
    for row in ws.iter_rows(values_only=True):
        cells = ["" if v is None else str(v) for v in row]
        while cells and cells[-1] == "":
            cells.pop()
        if cells:
            print("\t".join(cells))
