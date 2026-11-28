#!/usr/bin/env python3
"""Write the schedule sheet for a later round: Round3.xlsx, QuarterFinals.xlsx, SemiFinals.xlsx or Finals.xlsx.

Same layout as Round2.xlsx. By default the Team No columns are left blank: the app pairs the teams
by score and the sheet only sets the start/end times of match 1, 2, ... Type team numbers into a
sheet only if you want to fix the match-ups by hand (then every row needs them).

    python3 scripts/round_sheet.py 3 --start "3:00 PM"          # Round 3 (Best of 14), times only
    python3 scripts/round_sheet.py qf --start "3:40 PM"
    python3 scripts/round_sheet.py sf --start "4:00 PM"
    python3 scripts/round_sheet.py final --start "4:15 PM"      # 3rd place play-off, then the final
    python3 scripts/round_sheet.py 3 --teams --force             # fill in the match-ups from the live scores

--teams    fill Team No from the live dashboard (the previous round must be finished). This fixes the
           match-ups: later score corrections in the previous round will no longer re-pair them.
--start    first match's start time (default: keep the one in the current sheet, if any).
--force    replace an existing sheet (hand edits there are lost).
Match length and gap are kept from the current sheet (default 3 and 1 minutes).
Needs: python3 with openpyxl (pip install openpyxl); node for --teams.
"""
import argparse, datetime as dt, json, os, subprocess, sys, urllib.request

import openpyxl
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HR = 6  # header row; data starts on the next row
ROUNDS = {
    '3': ('R14', 'Round3.xlsx', 'Round 3 (Best of 14)', 7),
    'qf': ('QF', 'QuarterFinals.xlsx', 'Quarter-Finals', 3),
    'sf': ('SF', 'SemiFinals.xlsx', 'Semi-Finals', 2),
    'final': ('F', 'Finals.xlsx', 'Finals', 2),
}
ALIASES = {'r3': '3', 'round3': '3', 'r14': '3', 'quarter': 'qf', 'quarterfinals': 'qf', 'semi': 'sf', 'semifinals': 'sf',
           'f': 'final', 'finals': 'final'}

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('round', help='3, qf, sf or final')
ap.add_argument('--url', default='https://speed-comp.vercel.app', help='live dashboard address')
ap.add_argument('--start', help='first start time, e.g. "3:00 PM"')
ap.add_argument('--teams', action='store_true', help='fill in team numbers from the live scores')
ap.add_argument('--force', action='store_true', help='overwrite an existing sheet')
a = ap.parse_args()
key = ALIASES.get(a.round.lower(), a.round.lower())
if key not in ROUNDS:
    sys.exit('Round must be one of: 3, qf, sf, final.')
sid, fname, title, count = ROUNDS[key]
out = os.path.join(ROOT, 'sheets', fname)
if os.path.exists(out) and not a.force:
    sys.exit(f'sheets/{fname} already exists and may have hand edits. Run again with --force to replace it.')

labels = ['3rd Place', 'Final'] if sid == 'F' else [str(i + 1) for i in range(count)]
teams_of = {}
names = {}
if a.teams:
    get = lambda p: json.load(urllib.request.urlopen(a.url.rstrip('/') + p, timeout=20))
    state, sheets = get('/api/obstacle'), get('/api/sheets')
    names = {x['no']: x['name'] for x in sheets['teams']}
    js = """
const T = require(process.argv[1]); let s = ''; process.stdin.on('data', c => s += c).on('end', () => {
  const { sheets, data, sid } = JSON.parse(s);
  const rounds = Object.assign({}, sheets.rounds); (sid === 'F' ? ['P3', 'F'] : [sid]).forEach(k => delete rounds[k]);
  const b = T.compute(Object.assign({}, sheets, { rounds }), data || {});
  const ids = sid === 'F' ? ['P3', 'F'] : [sid];
  console.log(JSON.stringify(ids.flatMap(k => b.S[k].status === 'locked' ? [] : b.S[k].matches.map(m => ({ a: m.a, b: m.b, sa: m.seedA, sb: m.seedB })))));
});"""
    res = subprocess.run(['node', '-e', js, os.path.join(ROOT, 'views', 'tournament.js')],
                         input=json.dumps({'sheets': sheets, 'data': state.get('data'), 'sid': sid}), capture_output=True, text=True)
    if res.returncode:
        sys.exit(res.stderr)
    ms = json.loads(res.stdout)
    if len(ms) != len(labels):
        sys.exit(f"The live dashboard can't pair {title} yet (the round before it isn't finished), so --teams has nothing to fill in.")
    teams_of = dict(zip(labels, ms))

# Keep settings (and the first start time) from the current sheet.
length, gap, first = 3, 1, None
if os.path.exists(out):
    old = openpyxl.load_workbook(out).worksheets[0]
    length = old['C2'].value or length
    gap = old['C3'].value if old['C3'].value is not None else gap
    v = old.cell(HR + 1, 10).value
    first = v if isinstance(v, (dt.time, dt.datetime)) else None
if a.start:
    try:
        first = dt.datetime.strptime(a.start.strip().upper().replace('.', ''), '%I:%M %p').time()
    except ValueError:
        first = dt.datetime.strptime(a.start.strip(), '%H:%M').time()

wb = openpyxl.Workbook(); ws = wb.active; ws.title = title[:31]
navy, bold = '1B2142', Font(bold=True)
yellow = PatternFill('solid', fgColor='FFF2CC')
ws['A1'] = f'IM Project – {title} schedule'; ws['A1'].font = Font(bold=True, size=14)
ws['A2'] = 'Match length (min)'; ws['C2'] = length
ws['A3'] = 'Gap between matches (min)'; ws['C3'] = gap
for c in ('C2', 'C3'): ws[c].fill = yellow; ws[c].font = bold
notes = ['HOW TO USE: type a time (e.g. 3:00 PM) in the yellow Start Time of the first match. Every row below starts after the one above it.',
         'To move one match (a break, a delay): type a time over its Start Time — every match below follows. Delete it to go back to automatic.',
         'Team No: leave blank and the app pairs teams by score (seed 1 v the middle seed, …). Fill in every row only to fix the match-ups by hand.']
for r, t in zip((2, 3, 4), notes):
    ws.cell(r, 5, t).font = Font(italic=True, color='4A5280')
H = ['Match No', 'A Seed', 'A Team No', 'A Team Name', 'A Arena', 'B Seed', 'B Team No', 'B Team Name', 'B Arena', 'Start Time', 'End Time']
for i, h in enumerate(H, 1):
    c = ws.cell(HR, i, h); c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor=navy)
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
r0, line = HR + 1, Side(style='thin', color='CBD2E6')
for k, lbl in enumerate(labels):
    row = r0 + k
    m = teams_of.get(lbl)
    vals = [int(lbl) if lbl.isdigit() else lbl,
            m and m['sa'], m and m['a'] and int(m['a']), None, 'Red',
            m and m['sb'], m and m['b'] and int(m['b']), None, 'Blue']
    for i, v in enumerate(vals, 1):
        if v: ws.cell(row, i, v)
    for col, tc in (('D', 'C'), ('H', 'G')):
        ws[f'{col}{row}'] = f'=IF({tc}{row}="","(by score)",IFERROR(VLOOKUP({tc}{row},Teams!$A:$B,2,FALSE),"?"))'
    ws[f'J{row}'] = first if row == r0 else f'=IF(K{row - 1}="","",K{row - 1}+$C$3/1440)'
    ws[f'K{row}'] = f'=IF(J{row}="","",J{row}+$C$2/1440)'
    for c in ('J', 'K'): ws[f'{c}{row}'].number_format = 'h:mm AM/PM'
    ws[f'J{row}'].font = Font(bold=True, size=12)
    for i in range(1, 12):
        cell = ws.cell(row, i); cell.border = Border(bottom=line)
        cell.alignment = Alignment(horizontal='left' if i in (4, 8) else 'center')
        if i in (4, 8) and not m: cell.font = Font(italic=True, color='6C74A0')
last = r0 + len(labels) - 1
ws[f'J{r0}'].fill = yellow
ws.conditional_formatting.add(f'J{r0 + 1}:J{last + 10}', FormulaRule(formula=[f'AND(J{r0 + 1}<>"",NOT(ISFORMULA(J{r0 + 1})))'], fill=yellow))
dv = DataValidation(type='list', formula1='"Red,Blue"', allow_blank=True); ws.add_data_validation(dv)
dv.add(f'E{r0}:E{last + 10}'); dv.add(f'I{r0}:I{last + 10}')
for col, w in zip('ABCDEFGHIJK', [10, 8, 10, 24, 9, 8, 10, 24, 9, 13, 13]): ws.column_dimensions[col].width = w
ws.row_dimensions[HR].height = 30
ws.freeze_panes = f'A{r0}'
t = wb.create_sheet('Teams')
t.append(['Team No', 'Team Name']); t['A1'].font = bold; t['B1'].font = bold
if not names:
    try:
        res = subprocess.run(['node', '-e', "console.log(JSON.stringify(require(process.argv[1]).loadSheets().teams))", os.path.join(ROOT, 'lib', 'sheets.js')],
                             capture_output=True, text=True)
        names = {x['no']: x['name'] for x in json.loads(res.stdout)}
    except Exception:
        names = {}
for no, nm in sorted(names.items(), key=lambda x: int(x[0])): t.append([int(no), nm])
t['D1'] = 'Lookup only, so names show next to numbers. The app reads names from Teams.xlsx.'
t.column_dimensions['B'].width = 26
wb.calculation.fullCalcOnLoad = True
wb.save(out)

print(f'Wrote sheets/{fname}: {len(labels)} match(es), ' + ('team numbers filled in' if teams_of else 'times only (teams paired by score)')
      + (f', first start {first.strftime("%I:%M %p").lstrip("0")}' if first else ', no start time yet'))
for lbl in labels:
    m = teams_of.get(lbl)
    print(f"  {lbl:>9}  " + (f"{m['a']:>3} {names.get(m['a'], ''):<22} vs {m['b']:>3} {names.get(m['b'], '')}" if m else '(by score)'))
