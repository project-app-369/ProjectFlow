import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { docxText, fileToText, UnreadableFile, xlsxText } from './fileText';

/** A zip of the given files (deflated), the way Word and Excel write them. */
function zip(files: Record<string, string>): File {
  const parts: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = deflateRawSync(Buffer.from(text, 'utf8')), nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(Buffer.byteLength(text), 22); local.writeUInt16LE(nameBuf.length, 26);
    const head = Buffer.alloc(46); head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(8, 10); head.writeUInt32LE(data.length, 20); head.writeUInt32LE(Buffer.byteLength(text), 24); head.writeUInt16LE(nameBuf.length, 28); head.writeUInt32LE(offset, 42);
    parts.push(local, nameBuf, data); central.push(head, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return new File([Buffer.concat([...parts, cd, end])], 'x.zip');
}
const named = (f: File, name: string) => new File([f], name);

describe('fileToText', () => {
  it('reads plain text and drops a byte-order mark', async () => {
    expect(await fileToText(new File(['﻿Item 1: late drawings'], 'mom.txt'))).toBe('Item 1: late drawings');
  });

  it('reads Word paragraphs and table rows', async () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>Minutes &amp; actions</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>No.</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Action</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Chase vendor</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
    const text = await fileToText(named(zip({ 'word/document.xml': xml }), 'mom.docx'));
    expect(text).toContain('Minutes & actions');
    expect(text.split('\n').some(l => /^1\s+Chase vendor$/.test(l.trim()))).toBe(true);
    expect(docxText('<w:p><w:r><w:t>a</w:t></w:r><w:tab/><w:r><w:t>b</w:t></w:r></w:p>')).toBe('a\tb');
  });

  it('reads Excel sheets: shared strings, numbers and dates', async () => {
    const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2"><v>7</v></c><c r="B2" s="1"><v>46345</v></c><c r="C2" t="inlineStr"><is><t>Late</t></is></c></row></sheetData></worksheet>';
    const out = await fileToText(named(zip({
      'xl/workbook.xml': '<workbook><sheets><sheet name="Register" sheetId="1"/></sheets></workbook>',
      'xl/sharedStrings.xml': '<sst><si><t>No.</t></si><si><r><t>Ti</t></r><r><t>tle</t></r></si></sst>',
      'xl/styles.xml': '<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
      'xl/worksheets/sheet1.xml': sheet,
    }), 'reg.xlsx'));
    expect(out).toBe('# Sheet: Register\nNo.\t\tTitle\n7\t2026-11-19\tLate');
    expect(xlsxText({ workbook: '', shared: '', styles: '', sheets: [] })).toBe('');
  });

  it('says why a PDF or an unknown file cannot be read', async () => {
    await expect(fileToText(new File(['x'], 'mom.pdf'))).rejects.toThrow(/PDF/);
    await expect(fileToText(new File(['x'], 'mom.xyz'))).rejects.toBeInstanceOf(UnreadableFile);
    await expect(fileToText(named(new File(['not a zip'], 'a'), 'bad.docx'))).rejects.toThrow(/Office/);
  });
});
