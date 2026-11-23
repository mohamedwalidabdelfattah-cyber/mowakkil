// web/js/views/invoice-detail.js
// صفحة تفاصيل الفاتورة

import { apiJson } from '../api.js';
import { esc, toast, fmtMoney } from '../ui.js';
import { openModal } from '../modal.js';

export async function showInvoiceDetail(invoiceId, onBack) {
  const host = document.getElementById('view-host');
  host.innerHTML = '<div class="card">' + '<div class="skeleton"></div>'.repeat(5) + '</div>';

  let data;
  try {
    data = await apiJson(`/api/invoices/${invoiceId}`);
  } catch (e) {
    host.innerHTML = `<div class="card"><div class="empty">خطأ: ${esc(e.message)}</div></div>`;
    return;
  }

  const { invoice: inv, lines, office } = data;
  const remaining = (inv.total || 0) - (inv.paid_amount || 0);
  const officeName = office.name_ar || office.name || 'مُوكِّل';

  host.innerHTML = `
    <button class="ghost" id="back-btn" style="margin-bottom:14px">← رجوع للفواتير</button>

    <!-- بيانات الفاتورة -->
    <div class="card">
      <div class="section-header">
        <h3>
          📄 فاتورة ${esc(inv.invoice_number)}
          <span class="badge ${getStatusBadge(inv.status)}" style="margin-right:8px">${esc(inv.status)}</span>
        </h3>
        <div style="display:flex;gap:6px">
          <button class="ghost" id="print-btn">🖨 طباعة</button>
          <button class="ghost" id="status-btn">🔄 تغيير الحالة</button>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item"><div class="info-label">تاريخ الإصدار</div><div class="info-value">${esc(inv.issue_date)}</div></div>
        <div class="info-item"><div class="info-label">تاريخ الاستحقاق</div><div class="info-value">${esc(inv.due_date || '—')}</div></div>
        <div class="info-item"><div class="info-label">الموكل</div><div class="info-value">${esc(inv.client_name || '—')}</div></div>
        <div class="info-item"><div class="info-label">القضية</div><div class="info-value">${esc(inv.case_number || '—')}</div></div>
      </div>
    </div>

    <!-- الإحصائيات -->
    <div class="stats">
      <div class="stat"><div class="n">${fmtMoney(inv.subtotal)}</div><div class="l">المجموع الفرعي</div></div>
      <div class="stat"><div class="n">${fmtMoney(inv.tax_amount)}</div><div class="l">الضريبة (${inv.tax_rate}%)</div></div>
      <div class="stat"><div class="n" style="color:var(--brass-deep)">${fmtMoney(inv.total)}</div><div class="l">الإجمالي</div></div>
      <div class="stat"><div class="n" style="color:var(--bad)">${fmtMoney(remaining)}</div><div class="l">المتبقي</div></div>
    </div>

    <!-- البنود -->
    <div class="card">
      <h3>📋 البنود</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13.5px">
        <thead>
          <tr style="background:var(--paper)">
            <th style="padding:10px;text-align:right;border-bottom:1px solid var(--line)">الوصف</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid var(--line)">الكمية</th>
            <th style="padding:10px;text-align:left;border-bottom:1px solid var(--line)">السعر</th>
            <th style="padding:10px;text-align:left;border-bottom:1px solid var(--line)">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map(l => `
            <tr>
              <td style="padding:10px;text-align:right;border-bottom:1px dashed var(--line)">${esc(l.description)}</td>
              <td style="padding:10px;text-align:center;border-bottom:1px dashed var(--line)">${l.quantity}</td>
              <td style="padding:10px;text-align:left;border-bottom:1px dashed var(--line)">${fmtMoney(l.rate)}</td>
              <td style="padding:10px;text-align:left;border-bottom:1px dashed var(--line);font-weight:700">${fmtMoney(l.amount)}</td>
            </tr>
          `).join('')}
          <tr style="background:var(--paper)">
            <td colspan="3" style="padding:10px;text-align:left;font-weight:700">المجموع الفرعي</td>
            <td style="padding:10px;text-align:left;font-weight:700">${fmtMoney(inv.subtotal)}</td>
          </tr>
          ${inv.discount > 0 ? `
            <tr>
              <td colspan="3" style="padding:10px;text-align:left;color:var(--bad)">الخصم</td>
              <td style="padding:10px;text-align:left;color:var(--bad)">-${fmtMoney(inv.discount)}</td>
            </tr>
          ` : ''}
          <tr>
            <td colspan="3" style="padding:10px;text-align:left">الضريبة (${inv.tax_rate}%)</td>
            <td style="padding:10px;text-align:left">${fmtMoney(inv.tax_amount)}</td>
          </tr>
          <tr style="background:#f3efe2">
            <td colspan="3" style="padding:12px;text-align:left;font-weight:900;font-size:15px">الإجمالي النهائي</td>
            <td style="padding:12px;text-align:left;font-weight:900;font-size:16px;color:var(--brass-deep)">${fmtMoney(inv.total)} ج</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${inv.notes ? `
      <div class="card">
        <h3>📝 ملاحظات</h3>
        <p style="font-size:13.5px;line-height:1.7">${esc(inv.notes)}</p>
      </div>
    ` : ''}

    ${inv.terms ? `
      <div class="card">
        <h3>📋 شروط السداد</h3>
        <p style="font-size:13.5px;line-height:1.7">${esc(inv.terms)}</p>
      </div>
    ` : ''}

    <!-- تسجيل دفعة -->
    ${remaining > 0 ? `
      <div class="card">
        <h3>💵 تسجيل دفعة</h3>
        <button class="primary" style="width:100%;padding:14px" id="record-payment">
          💵 تسجيل دفعة على الفاتورة
        </button>
      </div>
    ` : `
      <div class="card" style="background:#dcecdf;text-align:center">
        <div style="font-size:32px">✅</div>
        <div style="font-weight:900;font-size:16px;color:var(--ok)">الفاتورة مدفوعة بالكامل</div>
      </div>
    `}
  `;

  // الأحداث
  host.querySelector('#back-btn').addEventListener('click', () => {
    if (onBack) onBack();
    else import('../router.js').then(m => m.showView('money-invoices'));
  });

  host.querySelector('#print-btn').addEventListener('click', () => {
    printInvoice(inv, lines, office);
  });

  host.querySelector('#status-btn')?.addEventListener('click', async () => {
    const status = prompt('اختر الحالة الجديدة:\n(مسودة / مرسلة / مدفوعة / متأخرة)', inv.status);
    if (!status) return;
    await apiJson(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    toast('اتحدّثت', 'ok');
    showInvoiceDetail(invoiceId, onBack);
  });

  host.querySelector('#record-payment')?.addEventListener('click', async () => {
    const result = await openModal({
      title: '💵 تسجيل دفعة',
      submitText: 'تسجيل',
      initialData: { amount: remaining },
      fields: [
        { name: 'amount', label: 'المبلغ (ج)', type: 'number', required: true },
      ],
      onSubmit: async (d) => {
        const newPaid = (inv.paid_amount || 0) + Number(d.amount);
        const newStatus = newPaid >= inv.total ? 'مدفوعة' : inv.status;
        await apiJson(`/api/invoices/${invoiceId}`, {
          method: 'PATCH',
          body: JSON.stringify({ paid_amount: newPaid, status: newStatus }),
        });
      },
    });
    if (result) {
      toast('اتسجلت الدفعة', 'ok');
      showInvoiceDetail(invoiceId, onBack);
    }
  });
}

function getStatusBadge(status) {
  const map = {
    'مسودة': 'trial',
    'مرسلة': 'active',
    'مدفوعة': 'active',
    'متأخرة': 'suspended',
  };
  return map[status] || 'trial';
}

// ============================================================
// طباعة الفاتورة (PDF)
// ============================================================
function printInvoice(inv, lines, office) {
  const officeName = office.name_ar || office.name || 'مُوكِّل';
  const logo = office.logo || '';
  const win = window.open('', '_blank', 'width=800,height=1000');

  // حساب المتبقي والمبلغ المدفوع
  const paid = inv.paid_amount || 0;
  const remaining = (inv.total || 0) - paid;

  win.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة ${inv.invoice_number}</title>
      <link href="${location.origin}/assets/fonts.css" rel="stylesheet">
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 40px; background: #f6f3ec; color: #101b28; }
        .invoice { max-width: 800px; margin: 0 auto; background: #fff; padding: 50px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px double #b6903f; padding-bottom: 24px; margin-bottom: 30px; }
        .office-info h1 { margin: 0; color: #b6903f; font-size: 28px; }
        .office-info p { margin: 6px 0 0; color: #7c611f; font-size: 13px; }
        .office-logo { max-height: 80px; max-width: 200px; }
        .invoice-info { text-align: left; }
        .invoice-info h2 { margin: 0; font-size: 22px; color: #101b28; }
        .invoice-info .num { color: #b6903f; font-weight: 700; margin-top: 6px; font-size: 16px; }
        .invoice-info .date { color: #48586b; font-size: 13px; margin-top: 4px; }
        .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
        .party { background: #f6f3ec; padding: 16px; border-radius: 8px; }
        .party h3 { margin: 0 0 8px; font-size: 13px; color: #7c611f; }
        .party p { margin: 4px 0; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #101b28; color: #fff; padding: 12px; text-align: right; font-size: 13px; }
        td { padding: 12px; border-bottom: 1px solid #e3dcc8; font-size: 14px; }
        td.num { text-align: left; }
        .totals { margin-left: auto; max-width: 320px; }
        .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
        .totals .row.total { border-top: 2px solid #101b28; margin-top: 8px; padding-top: 14px; font-weight: 900; font-size: 18px; color: #b6903f; }
        .totals .row.discount { color: #a13d2f; }
        .notes { background: #f3efe2; padding: 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; line-height: 1.7; }
        .footer { text-align: center; color: #7c611f; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e3dcc8; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #eee6d3; color: #7c611f; }
        .status-paid { background: #dcecdf; color: #2f6b4f; }
        .status-late { background: #f6e2dc; color: #a13d2f; }
        @media print { body { background: #fff; padding: 0; } .invoice { box-shadow: none; padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="invoice">
        <div class="header">
          <div class="office-info">
            ${logo ? `<img src="${logo}" class="office-logo" alt="">` : ''}
            <h1>${officeName}</h1>
            <p>محاماة واستشارات قانونية</p>
          </div>
          <div class="invoice-info">
            <h2>فاتورة</h2>
            <div class="num">${inv.invoice_number}</div>
            <div class="date">تاريخ الإصدار: ${inv.issue_date}</div>
            ${inv.due_date ? `<div class="date">تاريخ الاستحقاق: ${inv.due_date}</div>` : ''}
            <div style="margin-top:8px"><span class="status ${inv.status === 'مدفوعة' ? 'status-paid' : inv.status === 'متأخرة' ? 'status-late' : ''}">${inv.status}</span></div>
          </div>
        </div>

        <div class="parties">
          <div class="party">
            <h3>من:</h3>
            <p><strong>${officeName}</strong></p>
          </div>
          <div class="party">
            <h3>إلى:</h3>
            <p><strong>${inv.client_name || '—'}</strong></p>
            ${inv.client_phone ? `<p>📞 ${inv.client_phone}</p>` : ''}
            ${inv.case_number ? `<p>⚖️ قضية: ${inv.case_number}</p>` : ''}
            ${inv.court ? `<p>🏛️ ${inv.court}</p>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>الوصف</th>
              <th style="text-align:center">الكمية</th>
              <th style="text-align:left">السعر</th>
              <th style="text-align:left">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map(l => `
              <tr>
                <td>${esc(l.description)}</td>
                <td style="text-align:center">${l.quantity}</td>
                <td class="num">${fmtMoney(l.rate)} ج</td>
                <td class="num"><strong>${fmtMoney(l.amount)} ج</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="row"><span>المجموع الفرعي</span><span>${fmtMoney(inv.subtotal)} ج</span></div>
          ${inv.discount > 0 ? `<div class="row discount"><span>الخصم</span><span>-${fmtMoney(inv.discount)} ج</span></div>` : ''}
          <div class="row"><span>الضريبة (${inv.tax_rate}%)</span><span>${fmtMoney(inv.tax_amount)} ج</span></div>
          <div class="row total"><span>الإجمالي</span><span>${fmtMoney(inv.total)} ج</span></div>
          
          ${paid > 0 ? `
            <div class="row" style="margin-top:8px;border-top:1px dashed #ccc;padding-top:8px">
              <span>المدفوع</span>
              <span style="color:#2f6b4f;font-weight:700">${fmtMoney(paid)} ج</span>
            </div>
            <div class="row" style="font-weight:900;color:#a13d2f;font-size:16px">
              <span>المتبقي</span>
              <span>${fmtMoney(remaining)} ج</span>
            </div>
          ` : ''}
        </div>

        ${inv.notes ? `
          <div class="notes" style="margin-top:24px">
            <strong>📝 ملاحظات:</strong><br>${esc(inv.notes)}
          </div>
        ` : ''}

        ${inv.terms ? `
          <div class="notes">
            <strong>📋 شروط السداد:</strong><br>${esc(inv.terms)}
          </div>
        ` : ''}

        <div class="footer">
          شكراً لتعاملكم معنا · ${officeName}
        </div>
      </div>

      <script>window.onload = () => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(() => window.print(), 300));</script>
    </body>
    </html>
  `);
  win.document.close();
} 
