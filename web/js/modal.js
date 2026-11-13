// web/js/modal.js
// Modal احترافي

export function openModal({ title, fields, submitText = 'حفظ', onSubmit, initialData = {} }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">✕</button>
        </div>
        <form class="modal-body" id="modal-form">
          ${fields.map(f => renderField(f, initialData[f.name])).join('')}
        </form>
        <div class="modal-footer">
          <button class="ghost modal-cancel">إلغاء</button>
          <button class="primary modal-submit">${submitText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => backdrop.classList.add('open'));

    const close = (result) => {
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 200);
      resolve(result);
    };

    backdrop.querySelector('.modal-close').addEventListener('click', () => close(null));
    backdrop.querySelector('.modal-cancel').addEventListener('click', () => close(null));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });

    backdrop.querySelector('.modal-submit').addEventListener('click', async () => {
      const form = backdrop.querySelector('#modal-form');
      const data = {};
      for (const f of fields) {
        const el = form.querySelector(`[name="${f.name}"]`);
        if (!el) continue;
        let val = el.value;
        if (f.type === 'number') val = parseFloat(val) || 0;
        if (f.required && !val) {
          el.style.borderColor = 'var(--bad)';
          el.focus();
          return;
        }
        data[f.name] = val;
      }
      try {
        await onSubmit(data);
        close(data);
      } catch (e) {
        alert('خطأ: ' + e.message);
      }
    });

    backdrop.querySelector('#modal-form').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        backdrop.querySelector('.modal-submit').click();
      }
    });

    setTimeout(() => {
      backdrop.querySelector('input, select, textarea')?.focus();
    }, 200);
  });
}

function renderField(f, initialValue = '') {
  const val = initialValue ?? f.default ?? '';
  const required = f.required ? 'required' : '';

  if (f.type === 'select') {
    return `
      <label>${f.label}${f.required ? ' *' : ''}</label>
      <select name="${f.name}" ${required}>
        ${(f.options || []).map(o => {
          const value = typeof o === 'string' ? o : o.value;
          const label = typeof o === 'string' ? o : o.label;
          return `<option value="${value}" ${value == val ? 'selected' : ''}>${label}</option>`;
        }).join('')}
      </select>
    `;
  }

  if (f.type === 'textarea') {
    return `
      <label>${f.label}${f.required ? ' *' : ''}</label>
      <textarea name="${f.name}" rows="3" ${required}>${val}</textarea>
    `;
  }

  const inputType = f.type || 'text';
  return `
    <label>${f.label}${f.required ? ' *' : ''}</label>
    <input type="${inputType}" name="${f.name}" value="${val}" placeholder="${f.placeholder || ''}" ${required}>
  `;
}