/**
 * Text of a document, read in the browser (nothing is uploaded here): plain text files as they are, Word (.docx) as paragraphs and table rows,
 * Excel (.xlsx) as tab-separated rows per sheet. A .docx or .xlsx is a zip of XML files, opened with the browser's own inflate.
 */
export const READABLE = ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'log', 'eml', 'docx', 'xlsx'];
export const ACCEPT = READABLE.map(e => `.${e}`).join(',');
const MAX_ROWS = 3000;

export class UnreadableFile extends Error {}

export const extensionOf = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '');

interface ZipEntry { name: string; method: number; start: number; size: number }

function listZip(buf: ArrayBuffer): ZipEntry[] {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66_000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new UnreadableFile('This file is not a valid Office document.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: ZipEntry[] = [];
  for (let n = 0; n < count && v.getUint32(p, true) === 0x02014b50; n++) {
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nameLen));
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    out.push({ name, method, start, size });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function inflate(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  const data = new Uint8Array(buf, e.start, e.size);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new UnreadableFile('This Office document uses a compression this page cannot read.');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()]));

/** Paragraphs one to a line; a table row is one line with its cells separated by tabs. */
export function docxText(xml: string): string {
  return decode(xml
    .replace(/<\/w:p>\s*<\/w:tc>/g, '</w:tc>').replace(/<w:tab\s*\/>/g, '\t').replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
    .replace(/<\/w:tc>/g, '\t').replace(/<\/w:tr>/g, '\n').replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/\t+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const colIndex = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const isoOfSerial = (n: number) => new Date(Math.round((n - 25569) * 86_400_000)).toISOString().slice(0, 10);
const textOf = (xml: string) => decode([...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join(''));

/** Each sheet as a block of tab-separated rows under its name; cells formatted as dates are written as yyyy-mm-dd. */
export function xlsxText(files: { workbook: string; shared: string; styles: string; sheets: string[] }): string {
  const shared = [...files.shared.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1]));
  const custom = new Map<number, string>([...files.styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)].map(m => [Number(m[1]), m[2]]));
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(files.styles)?.[1] ?? '';
  const isDate = [...cellXfs.matchAll(/<xf\b[^>]*numFmtId="(\d+)"/g)].map(m => {
    const id = Number(m[1]);
    return (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (custom.has(id) && /[dmy]/i.test(custom.get(id)!.replace(/\[[^\]]*\]|"[^"]*"/g, '')) && !/h|s/i.test(custom.get(id)!.replace(/\[[^\]]*\]|"[^"]*"/g, '')));
  });
  const names = [...files.workbook.matchAll(/<sheet\b[^>]*name="([^"]*)"/g)].map(m => decode(m[1]));
  const blocks: string[] = [];
  let rowsLeft = MAX_ROWS;
  files.sheets.forEach((xml, i) => {
    const rows: string[] = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attr = c[1], body = c[2] ?? '';
        const ref = /\br="([A-Z]+\d+)"/.exec(attr)?.[1];
        const type = /\bt="([^"]*)"/.exec(attr)?.[1];
        const style = Number(/\bs="(\d+)"/.exec(attr)?.[1] ?? 0);
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value = '';
        if (type === 'inlineStr') value = textOf(body);
        else if (raw !== undefined && type === 's') value = shared[Number(raw)] ?? '';
        else if (raw !== undefined && type === 'str') value = decode(raw);
        else if (raw !== undefined) value = isDate[style] && Number.isFinite(Number(raw)) ? isoOfSerial(Number(raw)) : decode(raw);
        if (ref) cells[colIndex(ref)] = value.replace(/[\t\r\n]+/g, ' ');
      }
      if (cells.some(c => c)) rows.push(Array.from(cells, c => c ?? '').join('\t'));
      if (--rowsLeft <= 0) break;
    }
    if (rows.length) blocks.push(`# Sheet: ${names[i] ?? `Sheet ${i + 1}`}\n${rows.join('\n')}`);
  });
  return blocks.join('\n\n');
}

export async function fileToText(file: File): Promise<string> {
  const ext = extensionOf(file.name);
  if (!READABLE.includes(ext)) throw new UnreadableFile(ext === 'pdf' ? 'PDF files cannot be read yet: copy the text from the PDF and paste it, or save the document as .docx.' : `A .${ext || 'unknown'} file cannot be read. Use ${READABLE.map(e => `.${e}`).join(', ')}, or paste the text.`);
  if (ext !== 'docx' && ext !== 'xlsx') return (await file.text()).replace(/^﻿/, '');
  const buf = await file.arrayBuffer();
  const zip = listZip(buf);
  const read = (name: string) => { const e = zip.find(z => z.name === name); return e ? inflate(buf, e) : Promise.resolve(''); };
  if (ext === 'docx') return docxText(await read('word/document.xml'));
  const sheetNames = zip.map(z => z.name).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  return xlsxText({ workbook: await read('xl/workbook.xml'), shared: await read('xl/sharedStrings.xml'), styles: await read('xl/styles.xml'), sheets: await Promise.all(sheetNames.map(read)) });
}
