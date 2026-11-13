// ============================================================
// Professional Export & Print Utilities for مُوكِّل
// ============================================================

/**
 * تصدير احترافي لـ Excel (بصيغة xlsx) باستخدام SheetJS
 */
function exportToExcel(table, filename = 'export') {
  if (!window.XLSX) {
    alert('⚠️ مكتبة Excel مش متحملة.');
    return;
  }

  // تحويل جدول HTML لشيت إكسيل
  const wb = XLSX.utils.table_to_book(table, { sheet: "البيانات", raw: true });
  
  // تعديل عرض الأعمدة عشان تبان حلوة
  const ws = wb.Sheets["البيانات"];
  const wscols = [
    { wch: 20 }, // عرض عمود أول
    { wch: 30 }, // عرض عمود تاني
    { wch: 15 },
    { wch: 15 },
    { wch: 15 }
  ];
  ws['!cols'] = wscols;

  // حفظ الملف
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * تصدير احترافي لـ Word (بصيغة docx) باستخدام مكتبة docx
 */
async function exportToWord(content, filename = 'export') {
  if (!window.docx) {
    alert('⚠️ مكتبة Word مش متحملة.');
    return;
  }

  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } = window.docx;
  
  const children = [];
  
  // ترويسة الملف
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "مُوكِّل", bold: true, size: 40, color: "0F172A" }),
        new TextRun({ text: ` - ${filename}`, bold: true, size: 28, color: "D4AF37" }),
      ],
      alignment: "center",
      spacing: { after: 400 }
    })
  );

  // قراءة المحتوى (جداول أو كروت)
  const tables = content.querySelectorAll('table');
  
  if (tables.length > 0) {
    tables.forEach(table => {
      const rows = [];
      table.querySelectorAll('tr').forEach(tr => {
        const cells = [];
        tr.querySelectorAll('th, td').forEach(td => {
          cells.push(
            new TableCell({
              children: [new Paragraph(td.innerText || '')],
              shading: td.tagName === 'TH' ? { fill: "0F172A", color: "auto" } : undefined,
            })
          );
        });
        rows.push(new TableRow({ children: cells }));
      });
      
      children.push(
        new Table({
          rows: rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
      children.push(new Paragraph({ text: "" })); // مسافة
    });
  } else {
    // لو مفيش جدول، نقرا الكروت
    content.querySelectorAll('.item, .card').forEach(el => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: el.innerText, size: 24 })],
          spacing: { after: 200 }
        })
      );
    });
  }

  // الفوتر
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `تم إصدار هذا التقرير آلياً من منصة مُوكِّل © ${new Date().getFullYear()}`, size: 18, color: "999999" })],
      alignment: "center",
      spacing: { before: 400 }
    })
  );

  const doc = new Document({ sections: [{ properties: {}, children: children }] });
  
  const blob = await Packer.toBlob(doc);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.docx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * طباعة محتوى محدد فقط (PDF / طباعة)
 */
function printContent(content, title = 'طباعة') {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('⚠️ المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
    return;
  }

  const contentHtml = content.innerHTML;

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${title} - مُوكِّل</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap">
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; color: #000; line-height: 1.6; font-size: 12pt; }
        .print-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; margin-bottom: 20px; border-bottom: 2px solid #D4AF37; }
        .print-header h1 { margin: 0; color: #0F172A; font-size: 24pt; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; page-break-inside: auto; }
        th, td { border: 1px solid #CBD5E1; padding: 8px; text-align: right; }
        th { background: #0F172A !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .export-buttons, .tabs, .app-top, .actions, .btn, button, .filter-bar, .filter-bar-inner, .filter-item, .filter-input, .filter-label, .filter-reset, input, select, .stats, .stat, .chart-card, .welcome-hero, .quick-actions { display: none !important; }
      </style>
    </head>
    <body>
      <div class="print-header">
        <div>
          <h1>مُوكِّل</h1>
          <div style="color:#D4AF37; font-weight:bold; font-size:14pt;">${title}</div>
        </div>
        <div style="color:#666; font-size:10pt; text-align:left;">${new Date().toLocaleString('ar-EG')}</div>
      </div>
      <div>${contentHtml}</div>
      <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 500); };</script>
    </body>
    </html>
  `;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * الدالة الرئيسية للتصدير
 */
async function exportElement(format = 'excel', filename = 'export') {
  let content = document.querySelector('#view-host');
  if (!content) return alert('⚠️ مفيش محتوى للتصدير');

  const clone = content.cloneNode(true);
  const toRemove = ['.export-buttons', '.filter-bar', '.app-top', '.tabs', 'button', '.actions', '.stats', '.chart-card', '.welcome-hero', '.quick-actions'];
  toRemove.forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()));

  switch (format) {
    case 'excel':
      const table = clone.querySelector('table');
      if (table) {
        exportToExcel(table, filename);
      } else {
        alert('⚠️ مفيش جدول في الصفحة دي لتصديره كـ Excel.');
      }
      break;
    case 'word':
      exportToWord(clone, filename);
      break;
    case 'pdf':
    case 'print':
      printContent(clone, filename);
      break;
    default:
      alert('⚠️ صيغة غير مدعومة');
  }
}

/**
 * توليد أزرار التصدير
 */
function createExportButtons(filename = 'export') {
  const container = document.createElement('div');
  container.className = 'export-buttons no-print';
  container.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;justify-content:flex-start;';

  const buttons = [
    { label: '📊 Excel', format: 'excel', color: '#10B981' },
    { label: '📄 Word', format: 'word', color: '#3B82F6' },
    { label: '📕 PDF', format: 'pdf', color: '#EF4444' },
    { label: '🖨️ طباعة', format: 'print', color: '#6B7280' },
  ];

  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.textContent = btn.label;
    button.className = 'btn-export';
    button.style.cssText = `padding: 8px 16px; background: ${btn.color}; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Tajawal', sans-serif; font-weight: 600; font-size: 13px; transition: all 0.2s;`;
    button.addEventListener('mouseover', () => { button.style.transform = 'translateY(-1px)'; });
    button.addEventListener('mouseout', () => { button.style.transform = 'translateY(0)'; });
    button.addEventListener('click', () => exportElement(btn.format, filename));
    container.appendChild(button);
  });

  return container;
}

// جعل الدوال متاحة عالمياً
window.MowakkilExport = {
  exportToExcel,
  exportToWord,
  printContent,
  exportElement,
  createExportButtons,
};