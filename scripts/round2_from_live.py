#!/usr/bin/env python3
"""Rebuild sheets/Round2.xlsx from the live qualifying scores.

Reads the live dashboard (read-only), seeds Round 2 by qualifying score exactly like the app
(seed 1 v 15, 2 v 16 ... 14 v 28), and writes an editable sheet whose start times chain
from the row above.

    python3 scripts/round2_from_live.py                     # refuses to overwrite an existing sheet
    python3 scripts/round2_from_live.py --force --redo 1 --start "2:00 PM"

--redo N   add a "Redo QN" row: the winner of qualifying match N is replaced by W-QN in
           Round 2, and the redo row goes just before that match.
--start    first match's start time (default: keep the one in the current sheet, if any).
Match length and gap are kept from the current sheet.
Needs: python3 with openpyxl (pip install openpyxl), and node.
"""
import argparse, datetime as dt, json, os, subprocess, sys, urllib.request

import openpyxl
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'sheets', 'Round2.xlsx')
HR = 6  # header row; data starts on the next row

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('--url', default='https://speed-comp.vercel.app', help='live dashboard address')
ap.add_argument('--redo', action='append', default=[], help='qualifying match number being replayed (repeatable)')
ap.add_argument('--start', help='first start time, e.g. "2:00 PM"')
ap.add_argument('--force', action='store_true', help='overwrite sheets/Round2.xlsx (hand edits there are lost)')
ap.add_argument('--out', default=OUT)
a = ap.parse_args()

if os.path.exists(a.out) and not a.force:
    sys.exit(f'{os.path.relpath(a.out, ROOT)} already exists and may have hand edits. Run again with --force to replace it.')

get = lambda p: json.load(urllib.request.urlopen(a.url.rstrip('/') + p, timeout=20))
state, sheets = get('/api/obstacle'), get('/api/sheets')

# Seed with the app's own logic (views/tournament.js), ignoring any existing Round 2 sheet.
js = """
const T = require(process.argv[1]); let s = ''; process.stdin.on('data', c => s += c).on('end', () => {
  const { sheets, data } = JSON.parse(s);
  const b = T.compute(Object.assign({}, sheets, { round2: [] }), data || {});
  console.log(JSON.stringify({ status: b.S.Q.status, ties: (b.S.Q.ties || []).length + (b.S.Q.wildcardTie ? 1 : 0),
    r28: b.S.R28.matches.map(m => ({ no: m.no, a: m.a, b: m.b, sa: m.seedA, sb: m.seedB })),
    q: b.S.Q.matches.map(m => ({ no: m.no, a: m.a, b: m.b, arenaA: m.arenaA, arenaB: m.arenaB, winner: m.winner })) }));
});"""
res = subprocess.run(['node', '-e', js, os.path.join(ROOT, 'views', 'tournament.js')],
                     input=json.dumps({'sheets': sheets, 'data': state.get('data')}), capture_output=True, text=True)
if res.returncode:
    sys.exit(res.stderr)
B = json.loads(res.stdout)
if B['status'] != 'done' or not B['r28']:
    sys.exit(f"Qualifying isn't finished on the live dashboard ({B['ties']} tie(s) to decide), so Round 2 can't be seeded yet.")

# Keep settings (and the first start time) from the current sheet.
length, gap, first = 3, 1, None
if os.path.exists(a.out):
    old = openpyxl.load_workbook(a.out).worksheets[0]
    length = old['C2'].value or length
    gap = old['C3'].value if old['C3'].value is not None else gap
    v = old.cell(HR + 1, 10).value
    first = v if isinstance(v, (dt.time, dt.datetime)) else None
if a.start:
    try:
        first = dt.datetime.strptime(a.start.strip().upper().replace('.', ''), '%I:%M %p').time()
    except ValueError:
        first = dt.datetime.strptime(a.start.strip(), '%H:%M').time()

rows = [{'kind': 'm', **m} for m in B['r28']]
for n in a.redo:
    qm = next((m for m in B['q'] if m['no'] == str(n)), None)
    if not qm:
        sys.exit(f'Qualifying match {n} does not exist.')
    slot = 'W-Q' + str(n)
    i = next((i for i, r in enumerate(rows) if r['kind'] == 'm' and qm['winner'] in (r['a'], r['b'])), None)
    if i is None:
        sys.exit(f"The winner of qualifying match {n} isn't in Round 2 (they may be the team that didn't advance).")
    r = rows[i]
    if r['a'] == qm['winner']: r['a'] = slot
    else: r['b'] = slot
    rows.insert(i, {'kind': 'redo', 'no': 'Redo Q' + str(n), 'a': qm['a'], 'b': qm['b'],
                    'arenaA': (qm['arenaA'] or 'red').capitalize(), 'arenaB': (qm['arenaB'] or 'blue').capitalize()})

# ---------- write the workbook ----------
wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Round 2'
navy, bold = '1B2142', Font(bold=True)
yellow = PatternFill('solid', fgColor='FFF2CC')
ws['A1'] = 'IM Project – Round 2 (Best of 28) schedule'; ws['A1'].font = Font(bold=True, size=14)
ws['A2'] = 'Match length (min)'; ws['C2'] = length
ws['A3'] = 'Gap between matches (min)'; ws['C3'] = gap
for c in ('C2', 'C3'): ws[c].fill = yellow; ws[c].font = bold
notes = ['HOW TO USE: type a time (e.g. 2:00 PM) in the yellow Start Time of match 1. Every row below starts after the one above it.',
         'To move one match (a break, a delay): type a time over its Start Time — every match below follows. Delete it to go back to automatic.',
         'Team No: a team number, or W-Q1 = winner of the qualifying match 1 redo. A row with Match No "Redo Q1" is that redo, played at that point.']
for r, t in zip((2, 3, 4), notes):
    ws.cell(r, 5, t).font = Font(italic=True, color='4A5280')
H = ['Match No', 'A Seed', 'A Team No', 'A Team Name', 'A Arena', 'B Seed', 'B Team No', 'B Team Name', 'B Arena', 'Start Time', 'End Time']
for i, h in enumerate(H, 1):
    c = ws.cell(HR, i, h); c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor=navy)
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
team = lambda t: int(t) if str(t).isdigit() else t
r0, line = HR + 1, Side(style='thin', color='CBD2E6')
for k, m in enumerate(rows):
    row = r0 + k
    if m['kind'] == 'redo':
        vals = [m['no'], None, team(m['a']), None, m['arenaA'], None, team(m['b']), None, m['arenaB']]
    else:
        vals = [int(m['no']), m['sa'], team(m['a']), None, 'Red', m['sb'], team(m['b']), None, 'Blue']
    for i, v in enumerate(vals, 1):
        if v is not None: ws.cell(row, i, v)
    for col, tc in (('D', 'C'), ('H', 'G')):
        ws[f'{col}{row}'] = f'=IF({tc}{row}="","",IFERROR(VLOOKUP({tc}{row},Teams!$A:$B,2,FALSE),"Winner of "&MID({tc}{row},3,9)&" redo"))'
    ws[f'J{row}'] = first if row == r0 else f'=IF(K{row - 1}="","",K{row - 1}+$C$3/1440)'
    ws[f'K{row}'] = f'=IF(J{row}="","",J{row}+$C$2/1440)'
    for c in ('J', 'K'): ws[f'{c}{row}'].number_format = 'h:mm AM/PM'
    ws[f'J{row}'].font = Font(bold=True, size=12)
    for i in range(1, 12):
        cell = ws.cell(row, i); cell.border = Border(bottom=line)
        cell.alignment = Alignment(horizontal='left' if i in (4, 8) else 'center')
        if m['kind'] == 'redo': cell.fill = PatternFill('solid', fgColor='FFE4E6')
last = r0 + len(rows) - 1
ws[f'J{r0}'].fill = yellow
# A start time typed over a formula turns yellow, so overrides are easy to spot.
ws.conditional_formatting.add(f'J{r0 + 1}:J{last + 20}', FormulaRule(formula=[f'AND(J{r0 + 1}<>"",NOT(ISFORMULA(J{r0 + 1})))'], fill=yellow))
dv = DataValidation(type='list', formula1='"Red,Blue"', allow_blank=True); ws.add_data_validation(dv)
dv.add(f'E{r0}:E{last + 20}'); dv.add(f'I{r0}:I{last + 20}')
for col, w in zip('ABCDEFGHIJK', [10, 8, 10, 24, 9, 8, 10, 24, 9, 13, 13]): ws.column_dimensions[col].width = w
ws.row_dimensions[HR].height = 30
ws.freeze_panes = f'A{r0}'
t = wb.create_sheet('Teams')
t.append(['Team No', 'Team Name']); t['A1'].font = bold; t['B1'].font = bold
for x in sheets['teams']: t.append([int(x['no']), x['name']])
t['D1'] = 'Lookup only, so names show next to numbers. The app reads names from Teams.xlsx.'
t.column_dimensions['B'].width = 26
wb.calculation.fullCalcOnLoad = True
wb.save(a.out)

names = {x['no']: x['name'] for x in sheets['teams']}
print(f'Wrote {os.path.relpath(a.out, ROOT)}: {len(B["r28"])} matches' + (f' + {len(a.redo)} redo' if a.redo else '')
      + (f', first start {first.strftime("%I:%M %p").lstrip("0")}' if first else ', no start time yet'))
for m in rows:
    lbl = m['no'] if m['kind'] == 'redo' else 'M' + m['no']
    print(f"  {lbl:>8}  {m['a']:>5} {names.get(m['a'], ''):<22} vs {m['b']:>5} {names.get(m['b'], '')}")
