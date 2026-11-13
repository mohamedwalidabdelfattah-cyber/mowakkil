// web/js/views/reports.js
import { apiJson } from '../api.js';
import { fmtMoney, esc, skeleton } from '../ui.js';

let reportChart = null;

export async function render(host) {
  const now = new Date().toISOString().slice(0, 7);
  host.innerHTML = `
    <div class="app-top">
      <h2>📊 التقرير المالي الشهري</h2>
      <button class="btn btn-ghost" id="print-btn">🖨 طباعة</button>
    </div>

    <div class="card">
      <label class="label">اختار الشهر</label>
      <input id="rp-month" class="input" type="month" value="${now}">
      <div id="report-box" style="margin-top:14px"></div>
    </div>

    <!-- Chart: توزيع المبالغ -->
    <div class="chart-card" id="revenue-chart-card" hidden>
      <h3>📊 توزيع المبالغ</h3>
      <div class="chart-wrapper">
        <canvas id="chart-report"></canvas>
      </div>
    </div>
  `;

  host.querySelector('#rp-month').addEventListener('change', () => load(host));
  host.querySelector('#print-btn').addEventListener('click', () => window.print());
  load(host);
}

async function load(host) {
  const month = host.querySelector('#rp-month').value;
  const box = host.querySelector('#report-box');
  if (!month) return;
  box.innerHTML = skeleton(3);

  if (reportChart) { reportChart.destroy(); reportChart = null; }

  try {
    const d = await apiJson(`/api/reports/monthly?month=${month}`);

    const isProfit = d.net >= 0;
    const totalExpenses = (d.salaries || 0) + (d.expenses || 0);

    box.innerHTML = `
      <div class="stats">
        <div class="stat">
          <div class="l">💰 الأتعاب المستحقة</div>
          <div class="n">${fmtMoney(d.fees_due)}</div>
        </div>
        <div class="stat">
          <div class="l">✅ المتحصّلة</div>
          <div class="n success">${fmtMoney(d.fees_paid)}</div>
        </div>
        <div class="stat">
          <div class="l">💸 المصاريف</div>
          <div class="n danger">${fmtMoney(totalExpenses)}</div>
        </div>
        <div class="stat">
          <div class="l">📊 الصافي</div>
          <div class="n ${isProfit ? 'success' : 'danger'}">${fmtMoney(d.net)}</div>
        </div>
      </div>

      <div class="card" style="background:var(--gray-50);margin-top:16px">
        <h4 style="margin:0 0 12px;font-size:14px">📋 التفاصيل</h4>
        <div class="report-row">
          <span>الأتعاب المستحقة</span>
          <span style="font-weight:700">${fmtMoney(d.fees_due)} ج</span>
        </div>
        <div class="report-row">
          <span>الأتعاب المتحصّلة</span>
          <span style="font-weight:700;color:var(--success)">${fmtMoney(d.fees_paid)} ج</span>
        </div>
        <div class="report-row">
          <span>إجمالي المرتبات</span>
          <span style="font-weight:700;color:var(--danger)">${fmtMoney(d.salaries)} ج</span>
        </div>
        <div class="report-row">
          <span>مصاريف الجلسات</span>
          <span style="font-weight:700;color:var(--danger)">${fmtMoney(d.expenses)} ج</span>
        </div>
        <div class="report-row total" style="border-top:2px solid var(--primary);margin-top:8px;padding-top:12px">
          <span>الصافي</span>
          <span style="color:${isProfit ? 'var(--success)' : 'var(--danger)'};font-weight:900">
            ${isProfit ? '+' : ''}${fmtMoney(d.net)} ج
          </span>
        </div>
      </div>
    `;

    const chartCard = document.getElementById('revenue-chart-card');
    const chartCtx = document.getElementById('chart-report');
    if (chartCard && chartCtx && typeof Chart !== 'undefined') {
      chartCard.hidden = false;

      reportChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
          labels: ['مستحقة', 'محصّلة', 'مرتبات', 'مصاريف', 'الصافي'],
          datasets: [{
            label: 'المبلغ (ج)',
            data: [
              d.fees_due || 0,
              d.fees_paid || 0,
              d.salaries || 0,
              d.expenses || 0,
              d.net || 0,
            ],
            backgroundColor: [
              'rgba(212, 175, 55, 0.8)',
              'rgba(16, 185, 129, 0.8)',
              'rgba(245, 158, 11, 0.8)',
              'rgba(239, 68, 68, 0.8)',
              d.net >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)',
            ],
            borderColor: [
              '#0F172A', '#10B981', '#F59E0B', '#EF4444', d.net >= 0 ? '#10B981' : '#EF4444',
            ],
            borderWidth: 2,
            borderRadius: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#111827',
              titleFont: { family: 'IBM Plex Sans Arabic', size: 13, weight: '700' },
              bodyFont: { family: 'IBM Plex Sans Arabic', size: 12.5 },
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                label: (c) => ` ${Number(c.parsed.y).toLocaleString('ar-EG')} ج`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: 'IBM Plex Sans Arabic', size: 12, weight: '600' }, color: '#6B7280' },
            },
            y: {
              beginAtZero: true,
              grid: { color: '#F3F4F6', drawBorder: false },
              ticks: {
                font: { family: 'IBM Plex Mono', size: 10 },
                color: '#9CA3AF',
                callback: (v) => Number(v).toLocaleString('ar-EG'),
              },
            },
          },
        },
      });
    }
  } catch (e) {
    box.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
} 
 
 
 
