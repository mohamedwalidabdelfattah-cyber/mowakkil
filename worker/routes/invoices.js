// worker/routes/invoices.js
// نظام الفواتير

import { ok, fail } from '../lib/response.js';
import { audit } from '../lib/audit.js';
import { toInt, safeJson, isStr } from '../lib/validation.js';
import { syncInvoiceEntry, recordPayment } from '../services/accounting.js';
import { requireFeature } from '../middleware/feature-gate.js';
import { createNotification } from './notifications.js';

export const routes = [
  { method: 'GET',    path: '/api/invoices',                    handler: list },
  { method: 'POST',   path: '/api/invoices',                    handler: create },
  { method: 'GET',    path: '/api/invoices/stats',              handler: stats },
  { method: 'GET',    path: /^\/api\/invoices\/(\d+)$/,         handler: get },
  { method: 'PATCH',  path: /^\/api\/invoices\/(\d+)$/,         handler: update },
  { method: 'DELETE', path: /^\/api\/invoices\/(\d+)$/,         handler: remove },
];

async function generateInvoiceNumber(env, officeId) {
  const year = new Date().getFullYear();
  const count = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM invoices WHERE office_id = ? AND substr(invoice_number, 1, 4) = ?`
  ).bind(officeId, String(year)).first();
  const seq = String((count?.c || 0) + 1).padStart(4, '0');
  return `${year}-${seq}`;
}

async function list({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'invoices');
  if (gate) return gate;

  const status = url.searchParams.get('status');
  const clientId = toInt(url.searchParams.get('client_id'));
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const search = url.searchParams.get('search');

  let q = `SELECT i.*, cl.name as client_name, c.case_number
           FROM invoices i
           LEFT JOIN clients cl ON cl.id = i.client_id
           LEFT JOIN cases c ON c.id = i.case_id
           WHERE i.office_id = ?`;
  const binds = [officeId];

  if (status)   { q += ' AND i.status = ?'; binds.push(status); }
  if (clientId) { q += ' AND i.client_id = ?'; binds.push(clientId); }
  if (from)     { q += ' AND i.issue_date >= ?'; binds.push(from); }
  if (to)       { q += ' AND i.issue_date <= ?'; binds.push(to); }
  
  // البحث النصي (برقم الفاتورة أو اسم الموكل)
  if (search) {
    q += ' AND (i.invoice_number LIKE ? OR cl.name LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`);
  }

  q += ' ORDER BY i.issue_date DESC, i.id DESC';

  const { results } = await env.DB.prepare(q).bind(...binds).all();
  return ok(env, results || []);
}

async function get({ env, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'invoices');
  if (gate) return gate;

  const id = toInt(params[0]);
  const invoice = await env.DB.prepare(
    `SELECT i.*, cl.name as client_name, cl.phone as client_phone,
            cl.national_id as client_national_id,
            c.case_number, c.court
     FROM invoices i
     LEFT JOIN clients cl ON cl.id = i.client_id
     LEFT JOIN cases c ON c.id = i.case_id
     WHERE i.id = ? AND i.office_id = ?`
  ).bind(id, officeId).first();

  if (!invoice) return fail(env, 'not found', 404);

  const { results: lines } = await env.DB.prepare(
    `SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id`
  ).bind(id).all();

  const office = await env.DB.prepare(
    `SELECT name, name_ar, logo FROM offices WHERE id = ?`
  ).bind(officeId).first();

  // الدفعات: على الفاتورة نفسها، أو على الأتعاب المربوطة بيها
  const { results: payments } = await env.DB.prepare(
    `SELECT id, amount, method, payment_date, receipt_number, notes FROM payments
     WHERE office_id = ? AND (invoice_id = ? OR (? IS NOT NULL AND fee_id = ?)) ORDER BY payment_date, id`
  ).bind(officeId, id, invoice.fee_id ?? null, invoice.fee_id ?? null).all();
  return ok(env, { invoice, lines: lines || [], office: office || {}, payments: payments || [] });
}

async function create({ request, env, authUser, officeId }) {
  const gate = await requireFeature(env, officeId, 'invoices');
  if (gate) return gate;

  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);
  if (!b.issue_date) return fail(env, 'اكتب تاريخ الفاتورة', 400);
  if (!Array.isArray(b.lines) || b.lines.length === 0) {
    return fail(env, 'الفاتورة لازم يكون فيها بند واحد على الأقل', 400);
  }

  // ربط بأتعاب مسجلة (الإيراد اتسجل مع الأتعاب، فالفاتورة متعملش إيراد تاني)
  let linkedFee = null;
  if (b.fee_id) {
    linkedFee = await env.DB.prepare('SELECT * FROM fees WHERE id = ? AND office_id = ?').bind(toInt(b.fee_id), officeId).first();
    if (!linkedFee) return fail(env, 'الأتعاب مش موجودة', 400);
    if (!b.client_id) b.client_id = linkedFee.client_id;
    if (!b.case_id) b.case_id = linkedFee.case_id;
  }

  const subtotal = b.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const taxRate = Number(b.tax_rate) || 0;
  const discount = Number(b.discount) || 0;
  const taxAmount = (subtotal - discount) * (taxRate / 100);
  const total = subtotal - discount + taxAmount;

  const invoiceNumber = await generateInvoiceNumber(env, officeId);

  const r = await env.DB.prepare(
    `INSERT INTO invoices
      (office_id, invoice_number, client_id, case_id, issue_date, due_date,
       subtotal, tax_rate, tax_amount, discount, total, status, notes, terms, created_by, fee_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    officeId,
    invoiceNumber,
    b.client_id || null,
    b.case_id || null,
    b.issue_date,
    b.due_date || null,
    subtotal,
    taxRate,
    taxAmount,
    discount,
    total,
    b.status || 'مسودة',
    b.notes || null,
    b.terms || null,
    authUser.user_id,
    linkedFee ? linkedFee.id : null
  ).run();

  const invoiceId = r.meta.last_row_id;

  for (const line of b.lines) {
    const amount = Number(line.amount) || (Number(line.quantity || 1) * Number(line.rate || 0));
    await env.DB.prepare(
      `INSERT INTO invoice_lines (invoice_id, description, quantity, rate, amount)
       VALUES (?,?,?,?,?)`
    ).bind(
      invoiceId,
      line.description || '',
      Number(line.quantity) || 1,
      Number(line.rate) || 0,
      amount
    ).run();
  }

  // القيد حسب الحالة: المسودة ملهاش قيد، والمربوطة بأتعاب ضريبتها بس
  try {
    await syncInvoiceEntry(env, officeId, invoiceId, authUser.user_id);
  } catch (e) {
    console.error('auto journal entry failed:', e.message);
  }

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'create', entity: 'invoice', entity_id: invoiceId,
    metadata: { invoice_number: invoiceNumber, total }, request,
  });

  // 🔔 إشعار فوري
  const clientName = b.client_id ? (await env.DB.prepare(
    `SELECT name FROM clients WHERE id = ?`
  ).bind(b.client_id).first())?.name : null;

  await createNotification(env, {
    officeId,
    userId: null,
    type: 'invoice_created',
    title: '📄 فاتورة جديدة',
    body: `فاتورة ${invoiceNumber} · ${total.toLocaleString('ar-EG')} ج${clientName ? '\n👤 ' + clientName : ''}`,
    link: `#invoice-${invoiceId}`,
    icon: '📄',
    priority: 'normal',
    referenceType: 'invoice',
    referenceId: invoiceId,
  });

  return ok(env, { id: invoiceId, invoice_number: invoiceNumber, total }, 201);
}

async function update({ request, env, authUser, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'invoices');
  if (gate) return gate;

  const id = toInt(params[0]);
  const b = await safeJson(request);
  if (!b) return fail(env, 'JSON غلط', 400);

  const existing = await env.DB.prepare(
    `SELECT * FROM invoices WHERE id = ? AND office_id = ?`
  ).bind(id, officeId).first();
  if (!existing) return fail(env, 'not found', 404);

  const fields = [];
  const binds = [];

  if (b.issue_date !== undefined)    { fields.push('issue_date = ?'); binds.push(b.issue_date); }
  if (b.due_date !== undefined)      { fields.push('due_date = ?'); binds.push(b.due_date); }
  if (b.client_id !== undefined)     { fields.push('client_id = ?'); binds.push(b.client_id || null); }
  if (b.case_id !== undefined)       { fields.push('case_id = ?'); binds.push(b.case_id || null); }
  if (b.tax_rate !== undefined)      { fields.push('tax_rate = ?'); binds.push(Number(b.tax_rate) || 0); }
  if (b.discount !== undefined)      { fields.push('discount = ?'); binds.push(Number(b.discount) || 0); }
  // "مدفوعة" و"المدفوع" بيتحسبوا من الدفعات الحقيقية — متتكتبش بإيدك
  if (b.status !== undefined && !['مدفوعة', 'مدفوعة جزئياً'].includes(b.status)) { fields.push('status = ?'); binds.push(b.status); }
  if (b.fee_id !== undefined) {
    const fid = toInt(b.fee_id) || null;
    if (fid && !(await env.DB.prepare('SELECT id FROM fees WHERE id = ? AND office_id = ?').bind(fid, officeId).first())) return fail(env, 'الأتعاب مش موجودة', 400);
    fields.push('fee_id = ?'); binds.push(fid);
  }
  // لو النسبة أو الخصم اتغيروا نعيد حساب الإجمالي
  if (b.tax_rate !== undefined || b.discount !== undefined) {
    const rate = b.tax_rate !== undefined ? (Number(b.tax_rate) || 0) : (Number(existing.tax_rate) || 0);
    const disc = b.discount !== undefined ? (Number(b.discount) || 0) : (Number(existing.discount) || 0);
    const taxAmt = ((Number(existing.subtotal) || 0) - disc) * rate / 100;
    fields.push('tax_amount = ?', 'total = ?'); binds.push(taxAmt, (Number(existing.subtotal) || 0) - disc + taxAmt);
  }

  // تحصيل: "مدفوعة" أو مبلغ مدفوع أكبر → بيتسجل كدفعة حقيقية (بتدخل الصندوق/البنك)
  const paidNow = Number(existing.paid_amount) || 0;
  let collect = 0;
  if (b.paid_amount !== undefined) {
    const target = Number(b.paid_amount) || 0;
    if (target + 0.01 < paidNow) return fail(env, 'لتقليل المدفوع احذف الدفعة من سجل الدفعات', 400);
    collect = target - paidNow;
  } else if (b.status === 'مدفوعة') {
    collect = (Number(existing.total) || 0) - paidNow;
  }
  if (collect > 0.009 && existing.status === 'مسودة' && b.status === undefined) { fields.push('status = ?'); binds.push('مرسلة'); }
  if (b.notes !== undefined)         { fields.push('notes = ?'); binds.push(b.notes); }
  if (b.terms !== undefined)         { fields.push('terms = ?'); binds.push(b.terms); }

  if (!fields.length && !(collect > 0.009)) return fail(env, 'مفيش تغييرات', 400);
  if (fields.length) {
    binds.push(id, officeId);
    await env.DB.prepare(
      `UPDATE invoices SET ${fields.join(', ')} WHERE id = ? AND office_id = ?`
    ).bind(...binds).run();
  }
  if (collect > 0.009) {
    try {
      await recordPayment(env, { officeId, userId: authUser.user_id, amount: collect, method: b.method || 'نقدي',
        date: b.payment_date || new Date().toISOString().slice(0, 10), invoiceId: id });
    } catch (e) { return fail(env, e.message, 400); }
  }
  // القيد يتظبط على الحالة والأرقام الجديدة
  try { await syncInvoiceEntry(env, officeId, id, authUser.user_id); } catch (e) { console.error('invoice sync failed:', e.message); }

  await audit(env, {
    office_id: officeId, user_id: authUser.user_id,
    action: 'update', entity: 'invoice', entity_id: id, request,
  });

  return ok(env, { updated: true });
}

async function remove({ request, env, authUser, officeId, params }) {
  const gate = await requireFeature(env, officeId, 'invoices');
  if (gate) return gate;

  try {
    const id = toInt(params[0]);
    if (!id) return fail(env, 'id غلط', 400);

    const existing = await env.DB.prepare(
      `SELECT id FROM invoices WHERE id = ? AND office_id = ?`
    ).bind(id, officeId).first();
    if (!existing) return fail(env, 'الفاتورة مش موجودة', 404);
    const hasPay = await env.DB.prepare('SELECT COUNT(*) AS c FROM payments WHERE invoice_id = ? AND office_id = ?').bind(id, officeId).first();
    if (hasPay?.c) return fail(env, 'الفاتورة عليها دفعات — احذف الدفعات الأول أو خلّيها "ملغاة"', 400);

    const entriesRes = await env.DB.prepare(
      `SELECT id FROM journal_entries WHERE reference_type = 'invoice' AND reference_id = ? AND office_id = ?`
    ).bind(id, officeId).all();

    const entries = entriesRes.results || [];

    for (const entry of entries) {
      try {
        await env.DB.prepare(`DELETE FROM journal_lines WHERE entry_id = ?`)
          .bind(entry.id).run();
      } catch (e) {
        console.warn('delete journal_lines failed for entry', entry.id, e.message);
      }
    }

    try {
      await env.DB.prepare(
        `DELETE FROM journal_entries WHERE reference_type = 'invoice' AND reference_id = ? AND office_id = ?`
      ).bind(id, officeId).run();
    } catch (e) {
      console.warn('delete journal_entries failed', e.message);
    }

    try {
      await env.DB.prepare(`DELETE FROM invoice_lines WHERE invoice_id = ?`)
        .bind(id).run();
    } catch (e) {
      console.warn('delete invoice_lines failed', e.message);
    }

    await env.DB.prepare(`DELETE FROM invoices WHERE id = ? AND office_id = ?`)
      .bind(id, officeId).run();

    try {
      await audit(env, {
        office_id: officeId, user_id: authUser.user_id,
        action: 'delete', entity: 'invoice', entity_id: id, request,
      });
    } catch (e) {
      console.warn('audit failed', e.message);
    }

    return ok(env, { deleted: true });
  } catch (err) {
    console.error('invoice remove error:', err);
    return fail(env, 'فشل الحذف: ' + err.message, 500);
  }
}

async function stats({ env, officeId, url }) {
  const gate = await requireFeature(env, officeId, 'invoices');
  if (gate) return gate;

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let where = `WHERE office_id = ?`;
  const binds = [officeId];
  if (from) { where += ' AND issue_date >= ?'; binds.push(from); }
  if (to)   { where += ' AND issue_date <= ?'; binds.push(to); }

  const totals = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(total), 0) as total_amount,
       COALESCE(SUM(paid_amount), 0) as paid_amount,
       COUNT(*) as total_invoices,
       COUNT(CASE WHEN status = 'مدفوعة' THEN 1 END) as paid_count,
       COUNT(CASE WHEN status = 'متأخرة' THEN 1 END) as late_count
     FROM invoices ${where}`
  ).bind(...binds).first();

  const byStatus = await env.DB.prepare(
    `SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as total
     FROM invoices ${where}
     GROUP BY status`
  ).bind(...binds).all();

  return ok(env, {
    totals: totals || {},
    by_status: byStatus.results || [],
    remaining: (totals?.total_amount || 0) - (totals?.paid_amount || 0),
  });
}