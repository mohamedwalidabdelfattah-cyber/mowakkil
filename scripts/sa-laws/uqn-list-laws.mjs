// scripts/sa-laws/uqn-list-laws.mjs
// قايمة صفحات "لوائح وأنظمة" في جريدة أم القرى — بنطلّع منها الصفحات اللي عنوانها "نظام …"
// الاستخدام: node uqn-list-laws.mjs [عدد الصفحات]
const pages = Number(process.argv[2] || 20);
const seen = new Map();
for (let page = 1; page <= pages; page++) {
  const url = `https://www.uqn.gov.sa/decisions/rules-and-regulations?page=${page}`;
  const html = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } }).then(r => r.text()).catch(() => '');
  const items = [...html.matchAll(/href="https:\/\/www\.uqn\.gov\.sa\/(?:details\?p=|decisions-and-regulations\/)(\d+)"\s+title="([^"]+)"/g)];
  if (!items.length) { console.error('no items on page', page); break; }
  let added = 0;
  for (const [, id, title] of items) if (!seen.has(id)) { seen.set(id, title.trim()); added++; }
  if (!added) break;
  await new Promise(r => setTimeout(r, 700));
}
const laws = [...seen].filter(([, t]) => /^نظام\s/.test(t));
console.error('pages scanned, total items:', seen.size, 'laws:', laws.length);
for (const [id, t] of laws) console.log(id + ' | ' + t);
