// web/js/views/calc.js
import { apiJson } from '../api.js';
import { fmtMoney, toast } from '../ui.js';

export async function render(host) {
  host.innerHTML = `
    <div class="card">
      <h3>حاسبة الرسوم القضائية</h3>
      <div class="row">
        <div><label>قيمة الدعوى (جنيه)</label><input id="f-value" type="number" placeholder="50000"></div>
        <div><label>نوع الدعوى</label>
          <select id="f-known"><option value="known">معلومة القيمة</option><option value="unknown">مجهولة القيمة</option></select>
        </div>
      </div>
      <label>درجة التقاضي</label>
      <select id="f-degree"><option>جزئي</option><option selected>ابتدائي</option><option>استئناف</option></select>
      <button class="primary" style="margin-top:12px" id="calc-btn">احسب</button>
      <div id="fee-result"></div>
      <div class="warn">⚠️ رقم تقديري للاسترشاد فقط، راجع دائماً مع قلم الكتاب.</div>
    </div>`;

  host.querySelector('#calc-btn').addEventListener('click', async () => {
    const value = parseFloat(document.getElementById('f-value').value) || 0;
    const known = document.getElementById('f-known').value;
    const degree = document.getElementById('f-degree').value;
    const box = document.getElementById('fee-result');
    try {
      const out = await apiJson('/api/fee-calc', {
        method: 'POST',
        body: JSON.stringify({ value, known, degree }),
      });
      box.innerHTML = `<div class="item"><div style="font-size:12px;color:var(--ink-soft)">${out.note}</div><div class="name mono" style="font-size:22px">${fmtMoney(out.fee)} جنيه</div></div>`;
    } catch (e) {
      toast(e.message, 'bad');
    }
  });
}