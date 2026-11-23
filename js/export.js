import {
  budgetBase, debtPaid, debtRemaining, fmtPlain, goalSaved, monthOf, potAmount, signed, sortTx, today,
} from './logic.js';

const TYPE = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' };
const catName = (s, id) => s.categories.find((c) => c.id === id)?.name || 'Sem categoria';

// Impede que o Excel interprete texto do utilizador como fórmula.
const safeCsv = (v) => {
  let t = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function toCSV(s) {
  const head = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Método de pagamento', 'Valor (€)'];
  const rows = sortTx(s.transactions).map((t) => [
    t.date, TYPE[t.type], t.description, t.type === 'transfer' ? '' : catName(s, t.categoryId), t.method,
  ].map(safeCsv).concat((signed(t) < 0 ? '-' : '') + fmtPlain(t.amount)).join(';'));
  return `﻿${[head.join(';'), ...rows].join('\r\n')}\r\n`;
}

const xml = (v) => String(v ?? '')
  .replace(/[^\u0009\u000A\u000D -퟿-�]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (c) => ({ n: c / 100, s: 1 });
const date = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { n: (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000, s: 2 };
};
const col = (i) => {
  let out = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
  return out;
};

function sheetXml(rows) {
  const body = rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
    const ref = `${col(c)}${r + 1}`;
    if (cell && typeof cell === 'object') return `<c r="${ref}" s="${cell.s}"><v>${cell.n}</v></c>`;
    if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${r === 0 ? ' s="3"' : ''}><is><t xml:space="preserve">${xml(cell)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const cols = (rows[0] || []).map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="20" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** ZIP sem compressão: suficiente para um .xlsx válido, sem dependências. */
function zip(files) {
  const enc = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(content);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(12, 0x21, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    locals.push(new Uint8Array(local.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(14, 0x21, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...locals, ...central, new Uint8Array(end.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function toXLSX(s) {
  const sheets = [
    ['Movimentos', [['Data', 'Tipo', 'Descrição', 'Categoria', 'Método', 'Valor (€)'],
      ...sortTx(s.transactions).map((t) => [date(t.date), TYPE[t.type], t.description, t.type === 'transfer' ? '' : catName(s, t.categoryId), t.method, money(signed(t))])]],
    ['Categorias', [['Nome', 'Tipo'], ...s.categories.map((c) => [c.name, c.kind === 'income' ? 'Receita' : 'Despesa'])]],
    ['Orçamento', [['Pote', 'Modo', 'Definido', 'Valor neste mês (€)'],
      ...s.budget.pots.map((p) => [p.name, p.mode === 'percent' ? 'Percentagem' : 'Valor fixo', p.mode === 'percent' ? `${p.value}%` : fmtPlain(p.value), money(potAmount(budgetBase(s, monthOf(today())), p))])]],
    ['Pagamentos mensais', [['Nome', 'Valor (€)', 'Dia', 'Categoria', 'Método'],
      ...s.bills.map((b) => [b.name, money(b.amount), b.dueDay, catName(s, b.categoryId), b.method])]],
    ['Dívidas', [['Tipo', 'Pessoa', 'Motivo', 'Data', 'Total (€)', 'Pago (€)', 'Em falta (€)'],
      ...s.debts.map((d) => [d.direction === 'owed' ? 'Devem-me' : 'Devo', d.person, d.reason, date(d.date), money(d.total), money(debtPaid(d)), money(debtRemaining(d))])]],
    ['Amortizações', [['Pessoa', 'Data', 'Valor (€)', 'Nota'],
      ...s.debts.flatMap((d) => d.payments.map((p) => [d.person, date(p.date), money(p.amount), p.note]))]],
    ['Poupança', [['Cofre', 'Objetivo (€)', 'Atual (€)'], ...s.goals.map((g) => [g.name, money(g.target), money(goalSaved(s, g))])]],
  ];
  const overrides = sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zip([
    ['[Content_Types].xml', `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`],
    ['_rels/.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${head}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([n], i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `${head}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...sheets.map(([, rows], i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(rows)]),
  ]);
}

export const toJSONBlob = (s) => new Blob(
  [JSON.stringify({ ...s, exportedAt: new Date().toISOString() }, null, 2)],
  { type: 'application/json' },
);
export const csvBlob = (s) => new Blob([toCSV(s)], { type: 'text/csv;charset=utf-8' });
export const fileName = (ext) => `mealheiro-${today()}.${ext}`;

/** Em telemóvel usa a folha de partilha, que é o caminho fiável em PWAs no iOS. */
export async function saveFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
