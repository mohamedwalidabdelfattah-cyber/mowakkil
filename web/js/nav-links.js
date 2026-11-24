// web/js/nav-links.js
// فتح رابط داخلي (من البحث أو الإشعارات): #case-12 / #client-5 / #task-3 / #invoice-9 / #agenda …
// بيفتح الشاشة، وبعدها بيطلب من الشاشة تفتح العنصر نفسه (القضية/الموكل…)

const VIEW_OF = {
  case: 'cases', client: 'clients', task: 'tasks', invoice: 'money-invoices', fee: 'fees',
  payment: 'fees', lawyer: 'lawyers', session: 'agenda', event: 'agenda',
};

export async function openLink(link = '', fallbackType = '') {
  const { showView } = await import('./router.js');
  const m = String(link).match(/^#([a-z-]+?)-(\d+)$/);
  if (m) {
    const [, kind, id] = m;
    const view = VIEW_OF[kind];
    if (view) {
      await showView(view);
      // الشاشة بتسمع الحدث ده وتفتح العنصر (لو بتدعمه)
      setTimeout(() => document.dispatchEvent(new CustomEvent(`mowakkil:open-${kind}`, { detail: { id } })), 50);
      return;
    }
  }
  const plain = String(link).replace(/^#/, '');
  if (/^[a-z-]+$/.test(plain) && plain !== 'login') { await showView(plain === 'subscription' ? 'subscription' : plain); return; }
  if (VIEW_OF[fallbackType]) await showView(VIEW_OF[fallbackType]);
}
