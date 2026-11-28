// web/js/law-extract.js
// قراءة نص قانون من ملف: Word / نص / PDF (طبقة النص) — ولو الـ PDF متصوّر (أعداد الجريدة الرسمية غالباً)
// بنقرا كل صفحة بالـ OCR (Tesseract عربي). النص الناتج لازم يتراجع في شاشة المعاينة قبل الإضافة.

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('مقدرتش أحمّل ' + src));
    document.head.appendChild(s);
  });
}

async function pdfLib() {
  if (!window.pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  return window.pdfjsLib;
}

async function pageText(page) {
  const content = await page.getTextContent();
  const items = content.items.filter(i => i.str.trim()).map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));
  items.sort((a, b) => (Math.abs(a.y - b.y) > 5 ? b.y - a.y : b.x - a.x)); // عربي: من اليمين للشمال
  let text = '', lastY = null, line = '';
  for (const it of items) {
    if (lastY !== null && Math.abs(it.y - lastY) > 5) { text += line.trim() + '\n'; line = ''; }
    line += it.str + ' ';
    lastY = it.y;
  }
  if (line.trim()) text += line.trim() + '\n';
  return text;
}

/**
 * قراءة PDF متصوّر بالذكاء الاصطناعي (Gemini عن طريق السيرفر) صفحة صفحة — أدق بكتير من Tesseract في العربي.
 * ocrPage(base64Jpeg) → نص الصفحة. التقدم بيتحفظ في المتصفح، فلو الحصة خلصت نكمّل بعدين بنفس الملف.
 */
export async function aiReadPdf(file, ocrPage, onProgress = () => {}) {
  const lib = await pdfLib();
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const key = `mowakkil_law_ocr:${file.name}:${file.size}`;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
  const save = () => { try { localStorage.setItem(key, JSON.stringify(saved)); } catch {} };
  let last = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    if (saved[i] != null) continue;
    onProgress(`📸 قراءة الصفحة ${i} من ${pdf.numPages} بالذكاء الاصطناعي… (${Object.keys(saved).length} اتقرت)`);
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1.7 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, vp.width, vp.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    // دقة أقل شوية = صورة أصغر (النماذج الاحتياطية زي NVIDIA عندها حد لحجم الصورة)
    const b64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
    // حوالي 14 طلب في الدقيقة — تحت حد Gemini المجاني
    const wait = 4300 - (Date.now() - last);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    // لو كل النماذج عليها ضغط (حد في الدقيقة) نستنى ونعيد لوحدنا — لحد 4 مرات قبل ما نوقف
    for (let attempt = 0; ; attempt++) {
      last = Date.now();
      try {
        saved[i] = String(await ocrPage(b64)).replace(/^\s*\[صفحة بدون نص\]\s*$/, '');
        save();
        break;
      } catch (e) {
        save();
        const limited = e.status === 429 || e.status === 503;
        if (limited && attempt < 4) {
          const secs = Math.min(180, Number(e.data?.retry_after) || 60) * (attempt + 1);
          for (let s = secs; s > 0; s--) {
            onProgress(`⏳ الصفحة ${i} من ${pdf.numPages}: النماذج عليها ضغط — هعيد لوحدي بعد ${s} ثانية (محاولة ${attempt + 2} من 5)… التقدم محفوظ`);
            await new Promise(r => setTimeout(r, 1000));
          }
          continue;
        }
        const err = new Error(`اتقرا ${Object.keys(saved).length} من ${pdf.numPages} صفحة — ${e.message}. دوس «كمّل القراءة» بعدين وهيكمّل من مكانه.`);
        err.partial = true;
        throw err;
      }
    }
  }
  const text = Array.from({ length: pdf.numPages }, (_, k) => saved[k + 1] || '').join('\n');
  try { localStorage.removeItem(key); } catch {}
  return { text, ocr: true, ai: true, quality: 'ok' };
}

/** onProgress(msg) للتقدم — بيرجّع { text, ocr: boolean, quality: 'ok'|'broken', needsOcr? }
 *  opts.ocr = 'none': لو الـ PDF متصوّر ما نشغّلش Tesseract — نرجّع needsOcr والواجهة تخيّر المستخدم */
export async function extractLawText(file, onProgress = () => {}, opts = {}) {
  const name = String(file.name || '').toLowerCase();
  if (name.endsWith('.txt')) return { text: await file.text(), ocr: false, quality: 'ok' };
  if (name.endsWith('.docx')) {
    if (!window.mammoth) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    const r = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: r.value, ocr: false, quality: 'ok' };
  }
  if (/\.(jpg|jpeg|png|webp)$/.test(name)) {
    const w = await tesseract();
    try { onProgress('⏳ قراءة الصورة (OCR)…'); return { text: (await w.recognize(file)).data.text, ocr: true, quality: 'ok' }; }
    finally { await w.terminate(); }
  }
  if (!name.endsWith('.pdf')) throw new Error('الصيغ المدعومة: PDF أو Word أو TXT أو صورة');

  const lib = await pdfLib();
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress(`⏳ قراءة الصفحة ${i} من ${pdf.numPages}…`);
    text += await pageText(await pdf.getPage(i)) + '\n';
  }
  // ملف متصوّر (نص قليل جداً) أو خطوطه بايظة (رموز بدل الحروف العربية — زي ملفات WIPO) → OCR
  const letters = (text.match(/\p{L}/gu) || []).length;
  const arabic = (text.match(/[؀-ۿﭐ-﷿ﹰ-﻿]/g) || []).length;
  const garbled = letters > 200 && arabic / letters < 0.6;
  const scanned = garbled || text.replace(/\s/g, '').length < pdf.numPages * 80;
  if (scanned && opts.ocr === 'none') return { text: '', ocr: false, needsOcr: true, garbled, pages: pdf.numPages, quality: 'ok' };
  if (garbled) onProgress('⚠️ خطوط الملف مش مقروءة — هقراه بالـ OCR…');
  if (scanned) {
    const w = await tesseract();
    text = '';
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        onProgress(`🔍 الملف متصوّر — قراءة الصفحة ${i} من ${pdf.numPages} بالـ OCR (بطيئة شوية)…`);
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        text += (await w.recognize(canvas)).data.text + '\n';
      }
    } finally { await w.terminate(); }
    return { text, ocr: true, quality: 'ok' };
  }
  // pdf.js أحياناً بيطلّع العربي حروف مفرّقة — بننبّه لو نسبة «الكلمات» اللي حرف واحد كبيرة
  const words = text.split(/\s+/).filter(Boolean);
  const singles = words.filter(w => w.length === 1).length;
  return { text, ocr: false, quality: words.length && singles / words.length > 0.3 ? 'broken' : 'ok' };
}

async function tesseract() {
  if (!window.Tesseract) await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  return window.Tesseract.createWorker('ara');
}
