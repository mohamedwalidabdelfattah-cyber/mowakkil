// scripts/sa-laws/uqn-search.mjs
// بحث في جريدة أم القرى (الجريدة الرسمية) عن صفحات نصوص الأنظمة
// الاستخدام: node uqn-search.mjs "نظام الأحوال الشخصية" [عدد الصفحات]
const q = process.argv[2];
const pages = Number(process.argv[3] || 3);
const seen = new Map();
for (let page = 1; page <= pages; page++) {
  const url = `https://www.uqn.gov.sa/search?query=${encodeURIComponent(q)}&page=${page}`;
  const html = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } }).then(r => r.text()).catch(() => '');
  const items = [...html.matchAll(/href="https:\/\/www\.uqn\.gov\.sa\/details\?p=(\d+)"\s+title="([^"]+)"/g)];
  if (!items.length) break;
  for (const [, id, title] of items) if (!seen.has(id)) seen.set(id, title.trim());
  await new Promise(r => setTimeout(r, 800)); // بهدوء على السيرفر
}
for (const [id, title] of seen) console.log(id + ' | ' + title);
