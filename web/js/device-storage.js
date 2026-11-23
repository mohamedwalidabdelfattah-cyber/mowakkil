// web/js/device-storage.js
// حفظ المستندات في فولدر حقيقي على كمبيوتر المكتب (File System Access API — كروم/إيدج على الكمبيوتر).
// السيرفر بيحتفظ ببيانات الملف بس (الاسم/النوع/المكان)، والملف نفسه بيفضل على الجهاز.
//
// ⚠️ حدود: مش متاح على الموبايل ولا فايرفوكس/سفاري، والملف بيبان على الجهاز ده بس،
//    والنسخ الاحتياطي مسؤولية المكتب.

const DB = 'mowakkil-device';
const LABEL_KEY = 'mowakkil_device_label';

export const deviceSupported = () =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window && window.isSecureContext;

export function getDeviceLabel() {
  try { return localStorage.getItem(LABEL_KEY) || 'كمبيوتر المكتب'; } catch { return 'كمبيوتر المكتب'; }
}
export function setDeviceLabel(v) {
  try { localStorage.setItem(LABEL_KEY, String(v || '').trim().slice(0, 60) || 'كمبيوتر المكتب'); } catch {}
}

// ---------------- حفظ مقبض الفولدر (بيتحفظ في IndexedDB) ----------------
function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('handles');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbGet(key) {
  const d = await idb();
  return new Promise((res, rej) => { const q = d.transaction('handles').objectStore('handles').get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
async function idbPut(key, val) {
  const d = await idb();
  return new Promise((res, rej) => { const t = d.transaction('handles', 'readwrite'); t.objectStore('handles').put(val, key); t.oncomplete = res; t.onerror = () => rej(t.error); });
}

export async function getRootFolder() {
  if (!deviceSupported()) return null;
  try { return (await idbGet('root')) || null; } catch { return null; }
}

/** اختيار الفولدر (لازم من ضغطة زرار) */
export async function pickRootFolder() {
  const handle = await window.showDirectoryPicker({ id: 'mowakkil-docs', mode: 'readwrite', startIn: 'documents' });
  await idbPut('root', handle);
  return handle;
}

/** صلاحية القراءة/الكتابة على الفولدر — المتصفح بيسأل المستخدم مرة كل جلسة */
async function ensurePermission(handle, write = true) {
  const opts = { mode: write ? 'readwrite' : 'read' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

/** الفولدر جاهز للاستخدام؟ (لو مش متختار → يختاره دلوقتي) */
export async function ensureRootFolder({ write = true, pickIfMissing = true } = {}) {
  if (!deviceSupported()) throw new Error('الحفظ على الكمبيوتر متاح على كروم أو إيدج على الكمبيوتر بس');
  let root = await getRootFolder();
  if (!root) {
    if (!pickIfMissing) return null;
    root = await pickRootFolder();
  }
  if (!(await ensurePermission(root, write))) throw new Error('محتاج تسمح للمتصفح يوصل لفولدر المستندات');
  return root;
}

// أسماء فولدرات آمنة (ويندوز بيرفض \ / : * ? " < > |)
const safe = s => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'بدون اسم';

/** مسار الملف جوه فولدر المكتب: قضية 1234-2026 / توكيل / الملف.pdf */
export function buildPath({ caseLabel = null, caseId = null, taskId = null, docType = 'أخرى', fileName }) {
  const owner = caseId ? `قضية ${safe(caseLabel || '#' + caseId)}` : taskId ? `مهام/مهمة ${taskId}` : 'عام';
  return [...owner.split('/').map(safe), safe(docType), safe(fileName)];
}

async function dirFor(root, parts, create) {
  let dir = root;
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
  return dir;
}

/** يحفظ الملف ويرجّع المسار النهائي (لو الاسم موجود بيزوّد رقم) */
export async function saveToDevice(file, pathParts) {
  const root = await ensureRootFolder({ write: true });
  const folders = pathParts.slice(0, -1);
  let name = pathParts[pathParts.length - 1];
  const dir = await dirFor(root, folders, true);
  // اسم مكرر → "ملف (2).pdf"
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; i < 500; i++) {
    try { await dir.getFileHandle(name); name = `${base} (${i})${ext}`; } catch { break; }
  }
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(file);
  await w.close();
  return [...folders, name].join('/');
}

/** يجيب الملف من الفولدر — null لو مش موجود على الجهاز ده */
export async function readFromDevice(path) {
  const root = await getRootFolder();
  if (!root) return null;
  if (!(await ensurePermission(root, false))) return null;
  const parts = String(path).split('/');
  try {
    const dir = await dirFor(root, parts.slice(0, -1), false);
    const fh = await dir.getFileHandle(parts[parts.length - 1]);
    return await fh.getFile();
  } catch { return null; }
}

export async function deleteFromDevice(path) {
  const root = await getRootFolder();
  if (!root || !(await ensurePermission(root, true))) return false;
  const parts = String(path).split('/');
  try {
    const dir = await dirFor(root, parts.slice(0, -1), false);
    await dir.removeEntry(parts[parts.length - 1]);
    return true;
  } catch { return false; }
}

/** يفتح الملف (PDF/صور في تاب جديد، غير كده تنزيل) */
export function openBlob(file, name) {
  const url = URL.createObjectURL(file);
  const viewable = /pdf|image|text/.test(file.type || '');
  const a = document.createElement('a');
  a.href = url;
  if (viewable) a.target = '_blank'; else a.download = name || file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
