// worker/lib/json-extract.js
// استخراج JSON من رد موديل (حتى لو فيه ```json أو كلام قبله/بعده أو اتقطع)

export function extractJson(raw) {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace === -1) throw new Error('No JSON object found');

  if (lastBrace === -1 || lastBrace < firstBrace) {
    s = completeJson(s.slice(firstBrace));
  } else {
    s = s.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(s);
  } catch {
    return JSON.parse(completeJson(s));
  }
}

function completeJson(s) {
  let inString = false;
  let escape = false;
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{' || c === '[') stack.push(c);
    if (c === '}' || c === ']') stack.pop();
  }
  if (inString) s += '"';
  while (stack.length) s += stack.pop() === '{' ? '}' : ']';
  return s;
}
