export const isValidEmail = e =>
  typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const isStr = (s, max = 500) =>
  typeof s === 'string' && s.trim().length > 0 && s.length <= max;

export const toInt = v => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

export async function safeJson(request) {
  try { return await request.json(); }
  catch { return null; }
}