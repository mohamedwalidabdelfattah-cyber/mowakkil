// web/js/exporter.js
// التصدير والطباعة (Excel / Word / PDF) بدعم كامل للعربي واتجاه RTL.
// بيشتغل على "بيانات" مش على شكل الصفحة، عشان الناتج يبقى نضيف ومنظم.
//
// شكل المستند:
// {
//   title: 'القضايا',
//   subtitle?: 'كل القضايا المفتوحة',
//   meta?: [['المكتب', '...'], ['الفلتر', '...']],
//   blocks: [
//     { type: 'table', heading?, columns: [{ label, key, type?: 'money'|'number'|'date'|'text' }], rows: [...], totals?: { key: value } },
//     { type: 'kv',    heading?, pairs: [['الأتعاب المستحقة', 1500, 'money'], ...] },
//     { type: 'list',  heading,  items: ['...'] },
//     { type: 'text',  heading?, text: '...' },
//   ],
// }

const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';

// ============================================================
// Helpers
// ============================================================
const escHtml = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const today = () => new Date().toISOString().slice(0, 10);
const safeFile = s => String(s || 'export').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80);

// رمز عملة المكتب (ج / ر.س …) — من إعدادات المكتب المحفوظة على الجهاز
const CUR_SYMBOLS = { EGP: 'ج', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك', QAR: 'ر.ق', BHD: 'د.ب', OMR: 'ر.ع', JOD: 'د.أ', USD: 'USD', EUR: 'EUR' };
function curSymbol() {
  let c = 'EGP';
  try { c = localStorage.getItem('mowakkil_currency') || 'EGP'; } catch {}
  return CUR_SYMBOLS[c] || c;
}

function fmtValue(v, type) {
  if (v === null || v === undefined || v === '') return '—';
  if (type === 'money') return Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + curSymbol();
  if (type === 'number') return Number(v || 0).toLocaleString('ar-EG');
  if (type === 'date') return String(v).slice(0, 10);
  return String(v);
}
const cellValue = (row, col) => (typeof col.value === 'function' ? col.value(row) : row[col.key]);

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function officeName() {
  try { return JSON.parse(localStorage.getItem('mowakkil_office') || '{}')?.name_ar || JSON.parse(localStorage.getItem('mowakkil_office') || '{}')?.name || ''; }
  catch { return ''; }
}

// ============================================================
// HTML مشترك (Word + PDF)
// ============================================================
function blocksHtml(doc) {
  const parts = [];
  for (const b of doc.blocks || []) {
    if (b.heading) parts.push(`<h2>${escHtml(b.heading)}</h2>`);
    if (b.type === 'table') {
      const head = b.columns.map(c => `<th>${escHtml(c.label)}</th>`).join('');
      const body = (b.rows || []).map((r, i) =>
        `<tr class="${i % 2 ? 'alt' : ''}">${b.columns.map(c =>
          `<td class="${c.type === 'money' || c.type === 'number' ? 'num' : ''}">${escHtml(fmtValue(cellValue(r, c), c.type))}</td>`).join('')}</tr>`).join('');
      const foot = b.totals
        ? `<tr class="total">${b.columns.map((c, i) => `<td class="${c.type === 'money' || c.type === 'number' ? 'num' : ''}">${
            i === 0 ? 'الإجمالي' : (b.totals[c.key] !== undefined ? escHtml(fmtValue(b.totals[c.key], c.type)) : '')}</td>`).join('')}</tr>`
        : '';
      parts.push((b.rows || []).length
        ? `<table dir="rtl"><thead><tr>${head}</tr></thead><tbody>${body}${foot}</tbody></table>
           <p class="muted">عدد السجلات: ${(b.rows || []).length.toLocaleString('ar-EG')}</p>`
        : `<p class="muted">لا توجد بيانات</p>`);
    }
    if (b.type === 'kv') {
      parts.push(`<table dir="rtl" class="kv"><tbody>${b.pairs.map(([k, v, t]) =>
        `<tr><th>${escHtml(k)}</th><td class="${t === 'money' || t === 'number' ? 'num' : ''}">${escHtml(fmtValue(v, t))}</td></tr>`).join('')}</tbody></table>`);
    }
    if (b.type === 'list') {
      parts.push((b.items || []).length
        ? `<ul>${b.items.map(x => `<li>${escHtml(x)}</li>`).join('')}</ul>`
        : '<p class="muted">—</p>');
    }
    if (b.type === 'text') {
      parts.push(`<p>${escHtml(b.text || '—').replace(/\n/g, '<br>')}</p>`);
    }
  }
  return parts.join('\n');
}

function headerHtml(doc) {
  const office = officeName();
  const meta = [...(doc.meta || []), ['تاريخ الإصدار', new Date().toLocaleString('ar-EG')]];
  return `
    <table class="header" dir="rtl"><tr>
      <td><div class="brand">مُوكِّل${office ? ' — ' + escHtml(office) : ''}</div>
          <div class="title">${escHtml(doc.title)}</div>
          ${doc.subtitle ? `<div class="muted">${escHtml(doc.subtitle)}</div>` : ''}</td>
      <td class="meta">${meta.map(([k, v]) => `<div><b>${escHtml(k)}:</b> ${escHtml(v)}</div>`).join('')}</td>
    </tr></table>`;
}

const SHARED_CSS = `
  body { direction: rtl; text-align: right; color: #0F172A; line-height: 1.6; }
  h2 { font-size: 14pt; color: #0F172A; border-right: 4px solid #D4AF37; padding-right: 8px; margin: 18px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 4px; direction: rtl; }
  th, td { border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; vertical-align: top; font-size: 10.5pt; }
  thead th { background: #0F172A; color: #FFFFFF; font-weight: bold; }
  tr.alt td { background: #F8FAFC; }
  tr.total td { background: #FEF3C7; font-weight: bold; }
  td.num { direction: ltr; text-align: left; white-space: nowrap; }
  table.kv th { background: #F1F5F9; color: #0F172A; width: 40%; }
  table.header td { border: none; padding: 0; vertical-align: top; }
  table.header { border-bottom: 3px solid #D4AF37; margin-bottom: 14px; }
  .brand { font-size: 18pt; font-weight: bold; color: #0F172A; }
  .title { font-size: 15pt; font-weight: bold; color: #B8860B; margin-top: 2px; }
  .meta { text-align: left; font-size: 9pt; color: #475569; width: 40%; }
  .muted { color: #64748B; font-size: 9pt; }
  ul { margin: 4px 0; padding-right: 20px; }
  li { margin-bottom: 4px; }
  .footer { margin-top: 20px; border-top: 1px solid #CBD5E1; padding-top: 6px; color: #94A3B8; font-size: 8.5pt; text-align: center; }
`;

// ============================================================
// Excel (.xlsx) — RTL + أعمدة بعرض مناسب + أرقام كأرقام
// ============================================================
async function ensureXlsx() {
  if (window.XLSX) return window.XLSX;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = XLSX_URL;
    s.onload = resolve;
    s.onerror = () => reject(new Error('مكتبة Excel مش متاحة — اتأكد من الاتصال بالإنترنت'));
    document.head.appendChild(s);
  });
  return window.XLSX;
}

export async function toExcel(doc, filename) {
  const XLSX = await ensureXlsx();
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };

  const tables = (doc.blocks || []).filter(b => b.type === 'table' || b.type === 'kv');
  if (!tables.length) throw new Error('مفيش بيانات جدولية للتصدير');

  tables.forEach((b, idx) => {
    const aoa = [[doc.title + (b.heading ? ' — ' + b.heading : '')], []];
    let widths;
    if (b.type === 'table') {
      aoa.push(b.columns.map(c => c.label));
      for (const r of b.rows || []) {
        aoa.push(b.columns.map(c => {
          const v = cellValue(r, c);
          if ((c.type === 'money' || c.type === 'number') && v !== null && v !== '' && !isNaN(v)) return Number(v);
          return v === null || v === undefined ? '' : (c.type === 'date' ? String(v).slice(0, 10) : String(v));
        }));
      }
      if (b.totals) aoa.push(b.columns.map((c, i) => (i === 0 ? 'الإجمالي' : (b.totals[c.key] ?? ''))));
      widths = b.columns.map((c, i) => ({
        wch: Math.min(60, Math.max(10, c.label.length + 2, ...aoa.slice(3).map(r => String(r[i] ?? '').length + 2))),
      }));
    } else {
      aoa.push(['البند', 'القيمة']);
      b.pairs.forEach(([k, v, t]) => aoa.push([k, (t === 'money' || t === 'number') && !isNaN(v) ? Number(v) : (v ?? '')]));
      widths = [{ wch: 35 }, { wch: 20 }];
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = widths;
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, (b.columns?.length || 2) - 1) } }];
    // تنسيق الأرقام المالية
    if (b.type === 'table') {
      b.columns.forEach((c, ci) => {
        if (c.type !== 'money') return;
        for (let ri = 3; ri < aoa.length; ri++) {
          const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
          if (ws[ref] && ws[ref].t === 'n') ws[ref].z = '#,##0.00';
        }
      });
    }
    const name = safeFile(b.heading || doc.title || 'البيانات').replace(/[\[\]]/g, '').slice(0, 28) || `Sheet${idx + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, wb.SheetNames.includes(name) ? `${name.slice(0, 25)}_${idx + 1}` : name);
  });

  XLSX.writeFile(wb, `${safeFile(filename || doc.title)}_${today()}.xlsx`);
}

// ============================================================
// Word (.doc) — HTML بصيغة Word، بيفتح في Word بالعربي والاتجاه الصح
// ============================================================
export function toWord(doc, filename) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ar">
<head><meta charset="utf-8"><title>${escHtml(doc.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  @page WordSection1 { size: ${doc.landscape ? '841.9pt 595.3pt; mso-page-orientation: landscape' : '595.3pt 841.9pt'}; margin: 1.6cm 1.6cm 1.6cm 1.6cm; }
  div.WordSection1 { page: WordSection1; }
  body, p, td, th, li, div { font-family: 'Arial', 'Traditional Arabic', 'Simplified Arabic', sans-serif; mso-bidi-font-family: Arial; }
  p, li, td, th, h2, div { direction: rtl; unicode-bidi: embed; mso-bidi-language: AR-SA; }
  ${SHARED_CSS}
  thead th { mso-shading: #0F172A; }
</style></head>
<body dir="rtl" lang="AR-SA"><div class="WordSection1">
${headerHtml(doc)}
${blocksHtml(doc)}
<div class="footer">تم إصدار هذا المستند من منصة مُوكِّل</div>
</div></body></html>`;
  download(new Blob(['﻿', html], { type: 'application/msword' }), `${safeFile(filename || doc.title)}_${today()}.doc`);
}

// ============================================================
// PDF / طباعة — نافذة طباعة RTL بخط عربي محلي، ومنها "حفظ كـ PDF"
// ============================================================
export function toPrint(doc) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('المتصفح منع فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة للموقع');
  const fontsCss = `${location.origin}/assets/fonts.css`;
  w.document.open();
  w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>${escHtml(doc.title)} — مُوكِّل</title>
<link rel="stylesheet" href="${fontsCss}">
<style>
  @page { size: A4 ${doc.landscape ? 'landscape' : 'portrait'}; margin: 14mm; }
  body { font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; font-size: 11pt; }
  ${SHARED_CSS}
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  thead th, tr.alt td, tr.total td, table.kv th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .toolbar { position: sticky; top: 0; background: #fff; padding: 10px 0; display: flex; gap: 8px; border-bottom: 1px solid #E2E8F0; margin-bottom: 12px; }
  .toolbar button { font: inherit; padding: 8px 16px; border-radius: 8px; border: 1px solid #0F172A; background: #0F172A; color: #fff; cursor: pointer; }
  .toolbar button.ghost { background: #fff; color: #0F172A; }
  .wrap { max-width: 1000px; margin: 0 auto; padding: 0 16px; }
  @media print { .toolbar { display: none; } .wrap { padding: 0; max-width: none; } }
</style></head>
<body><div class="wrap">
<div class="toolbar"><button onclick="window.print()">🖨 طباعة / حفظ PDF</button><button class="ghost" onclick="window.close()">إغلاق</button></div>
${headerHtml(doc)}
${blocksHtml(doc)}
<div class="footer">تم إصدار هذا المستند من منصة مُوكِّل</div>
</div>
<script>
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
    .then(() => setTimeout(() => window.print(), 300));
</script>
</body></html>`);
  w.document.close();
}

/** بيحول الفلاتر المستخدمة لسطور في رأس المستند (بيتجاهل الفاضي) */
export function filterMeta(pairs) {
  return pairs.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([k, v]) => [k, String(v)]);
}

// ============================================================
// زرار "تصدير" بقائمة صغيرة — بيتحط في المكان المخصص بس
// ============================================================
let menuSeq = 0;
/**
 * @param {HTMLElement} container  المكان اللي الزرار هيتحط فيه
 * @param {() => object | Promise<object>} getDoc  بترجع المستند وقت الضغط (بالبيانات الحالية بعد الفلترة)
 * @param {{ formats?: ('excel'|'word'|'pdf')[], label?: string, filename?: string }} opts
 */
export function mountExportMenu(container, getDoc, { formats = ['excel', 'word', 'pdf'], label = '⬇️ تصدير', filename } = {}) {
  if (!container) return;
  const id = `exp-${++menuSeq}`;
  const items = {
    excel: '📊 Excel',
    word: '📄 Word',
    pdf: '🖨 طباعة / PDF',
  };
  const wrap = document.createElement('div');
  wrap.className = 'export-menu no-print';
  wrap.style.cssText = 'position:relative;display:inline-block';
  wrap.innerHTML = `
    <button type="button" class="btn btn-ghost" id="${id}" aria-haspopup="true" aria-expanded="false">${label}</button>
    <div role="menu" hidden style="position:absolute;inset-inline-end:0;top:calc(100% + 4px);z-index:50;min-width:170px;
         background:var(--surface, #fff);border:1px solid var(--border-soft, #E2E8F0);border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.12);padding:4px">
      ${formats.map(f => `<button type="button" role="menuitem" data-fmt="${f}"
          style="display:block;width:100%;text-align:right;background:none;border:none;padding:9px 12px;border-radius:8px;cursor:pointer;font:inherit;color:inherit">${items[f]}</button>`).join('')}
    </div>`;
  container.appendChild(wrap);

  const btn = wrap.querySelector('button');
  const menu = wrap.querySelector('[role="menu"]');
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    btn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', e => { if (!wrap.contains(e.target)) close(); });
  menu.addEventListener('mouseover', e => { const b = e.target.closest('[data-fmt]'); if (b) b.style.background = 'var(--gray-50, #F8FAFC)'; });
  menu.addEventListener('mouseout', e => { const b = e.target.closest('[data-fmt]'); if (b) b.style.background = 'none'; });

  menu.addEventListener('click', async e => {
    const b = e.target.closest('[data-fmt]');
    if (!b) return;
    close();
    const fmt = b.dataset.fmt;
    // نافذة الطباعة لازم تتفتح مباشرة من الضغطة (عشان المتصفح ميمنعهاش)
    try {
      const doc = await getDoc();
      if (fmt === 'excel') await toExcel(doc, filename);
      if (fmt === 'word') toWord(doc, filename);
      if (fmt === 'pdf') toPrint(doc);
    } catch (err) {
      const { toast } = await import('./ui.js');
      toast(err.message || 'فشل التصدير', 'bad');
    }
  });
  return wrap;
}
