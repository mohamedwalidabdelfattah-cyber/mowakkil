// web/js/chart-theme.js
// إعدادات موحدة لكل الرسوم البيانية (Chart.js) بهوية مُوكِّل

export const PALETTE = {
  navy: '#0B1222',
  navy2: '#2A3654',
  gold: '#D4AF37',
  gold2: '#E8CC72',
  slate: '#98A2B3',
  success: '#12B76A',
  danger: '#F04438',
  warning: '#F79009',
  info: '#2E90FA',
};
// ترتيب الألوان للفئات (doughnut / bar متعدد)
export const SERIES = ['#0B1222', '#D4AF37', '#2A3654', '#E8CC72', '#667085', '#A8841F', '#98A2B3', '#475467'];

export function applyChartTheme() {
  const C = window.Chart;
  if (!C || C.__mowakkilThemed) return;
  C.__mowakkilThemed = true;
  const d = C.defaults;
  d.font.family = "'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif";
  d.font.size = 12;
  d.color = '#667085';
  d.borderColor = '#EAECF0';
  d.maintainAspectRatio = false;
  d.responsive = true;
  d.animation = { duration: 500, easing: 'easeOutQuart' };
  d.locale = 'ar-EG';

  const p = d.plugins;
  p.legend.position = 'bottom';
  p.legend.rtl = true;
  p.legend.labels.usePointStyle = true;
  p.legend.labels.pointStyle = 'circle';
  p.legend.labels.boxWidth = 8;
  p.legend.labels.boxHeight = 8;
  p.legend.labels.padding = 16;
  p.legend.labels.color = '#344054';
  p.legend.labels.font = { size: 12, weight: '500' };

  Object.assign(p.tooltip, {
    rtl: true,
    textDirection: 'rtl',
    backgroundColor: '#0B1222',
    borderColor: 'rgba(212,175,55,.45)',
    borderWidth: 1,
    titleColor: '#E8CC72',
    bodyColor: '#E4E7EC',
    titleFont: { weight: '600', size: 12.5 },
    bodyFont: { size: 12.5 },
    padding: 12,
    cornerRadius: 10,
    displayColors: true,
    boxPadding: 6,
    usePointStyle: true,
  });

  d.elements.line.tension = 0.35;
  d.elements.line.borderWidth = 2.5;
  d.elements.point.radius = 0;
  d.elements.point.hoverRadius = 5;
  d.elements.point.hitRadius = 12;
  d.elements.bar.borderRadius = 6;
  d.elements.bar.borderSkipped = false;
  d.elements.arc.borderWidth = 2;
  d.elements.arc.borderColor = '#FFFFFF';

  // محاور هادية
  for (const type of ['category', 'linear']) {
    const s = d.scales?.[type];
    if (!s) continue;
    s.grid = { ...(s.grid || {}), color: '#F2F4F7', drawTicks: false };
    s.border = { ...(s.border || {}), display: false };
    s.ticks = { ...(s.ticks || {}), padding: 8, color: '#98A2B3' };
  }
}

// تدرج لوني لمساحة تحت الخط
export function areaGradient(ctx, color = '#D4AF37') {
  const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight || 300);
  g.addColorStop(0, color + '33');
  g.addColorStop(1, color + '00');
  return g;
}
