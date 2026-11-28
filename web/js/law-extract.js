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

/** onProgress(msg) للتقدم — بيرجّع { text, ocr: boolean, quality: 'ok'|'broken' } */
export async function extractLawText(file, onProgress = () => {}) {
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
  if (garbled) onProgress('⚠️ خطوط الملف مش مقروءة — هقراه بالـ OCR…');
  if (garbled || text.replace(/\s/g, '').length < pdf.numPages * 80) {
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
