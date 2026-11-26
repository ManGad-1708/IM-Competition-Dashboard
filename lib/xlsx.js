// Minimal .xlsx reader with no dependencies: unzips with Node's zlib and reads
// shared strings + cell values. Enough for plain data sheets (no formulas evaluated;
// a formula cell's cached value is used).
const zlib = require('zlib');

function unzip(buf) {
  // Find the End Of Central Directory record.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip/xlsx file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const lnlen = buf.readUInt16LE(off + 26), lelen = buf.readUInt16LE(off + 28);
    const start = off + 30 + lnlen + lelen;
    const raw = buf.subarray(start, start + csize);
    files[name] = () => (method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8');
    p += 46 + nlen + elen + clen;
  }
  return files;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = s => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] ?? m));
const textOf = xml => { let out = ''; xml.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (_, t) => { out += t; }); return unxml(out); };
const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

/** Returns [{ name, rows: [[cell, ...], ...] }] — cells are string | number | null. */
function readXlsx(buf) {
  const z = unzip(buf);
  const get = n => (z[n] ? z[n]() : '');
  const shared = [];
  get('xl/sharedStrings.xml').replace(/<si>([\s\S]*?)<\/si>/g, (_, si) => { shared.push(textOf(si)); });
  const rels = {};
  get('xl/_rels/workbook.xml.rels').replace(/<Relationship\b[^>]*>/g, tag => {
    const id = /Id="([^"]+)"/.exec(tag), t = /Target="([^"]+)"/.exec(tag);
    if (id && t) rels[id[1]] = t[1].replace(/^\/?xl\//, '').replace(/^\//, '');
  });
  const sheets = [];
  get('xl/workbook.xml').replace(/<sheet\b[^>]*>/g, tag => {
    const nm = /name="([^"]*)"/.exec(tag), rid = /r:id="([^"]+)"/.exec(tag);
    if (!nm || !rid || !rels[rid[1]]) return;
    const xml = get('xl/' + rels[rid[1]]);
    const rows = [];
    xml.replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/g, (_, rattr, body) => {
      const rn = /r="(\d+)"/.exec(rattr);
      const row = [];
      body.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (__, attr, inner = '') => {
        const ref = /r="([A-Z]+\d+)"/.exec(attr);
        const type = (/t="(\w+)"/.exec(attr) || [])[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        let val = null;
        if (type === 's' && v) val = shared[+v[1]] ?? null;
        else if (type === 'inlineStr') val = textOf(inner);
        else if (type === 'str' && v) val = unxml(v[1]);
        else if (type === 'b' && v) val = v[1] === '1';
        else if (v) val = isNaN(+v[1]) ? unxml(v[1]) : +v[1];
        row[ref ? colIndex(ref[1]) : row.length] = val;
      });
      const idx = rn ? +rn[1] - 1 : rows.length;
      rows[idx] = Array.from(row, c => (c === undefined ? null : c));
    });
    sheets.push({ name: unxml(nm[1]), rows: Array.from(rows, r => r || []) });
  });
  return sheets;
}

module.exports = { readXlsx };
