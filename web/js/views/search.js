// web/js/views/search.js
import { apiJson } from '../api.js';
import { esc, toast, skeleton } from '../ui.js';
import { mountExportMenu } from '../exporter.js';
import { mountAiMeter } from '../ai-usage.js';
import { dateLocale, fmtDay, hijriDate, isSaudi } from '../country.js';

const GOV_LINKS = [
  { name: 'منصة مصر الرقمية', desc: 'خدمات التوثيق والتقاضي الإلكتروني', url: 'https://digital.gov.eg', icon: '🇪🇬' },
  { name: 'البوابة القانونية للتشريعات', desc: 'كل القوانين واللوائح والقرارات', url: 'https://elpai.idsc.gov.eg', icon: '📖' },
  { name: 'محكمة النقض', desc: 'المبادئ والأحكام الصادرة', url: 'https://www.cc.gov.eg', icon: '⚖️' },
  { name: 'مجلس الدولة', desc: 'أحكام القضاء الإداري', url: 'https://www.esc.gov.eg', icon: '🏛️' },
  { name: 'وزارة العدل', desc: 'خدمات الشهر العقاري والتوثيق', url: 'https://www.moj.gov.eg', icon: '📋' },
  { name: 'مصلحة الضرائب المصرية', desc: 'الخدمات الضريبية والقوانين', url: 'https://www.eta.gov.eg', icon: '💰' },
  { name: 'هيئة الاستثمار', desc: 'قوانين وخدمات الاستثمار', url: 'https://www.gafi.gov.eg', icon: '🏢' },
  { name: 'جهاز حماية المستهلك', desc: 'شكاوى وقوانين حماية المستهلك', url: 'https://www.consumer.gov.eg', icon: '🛡️' },
];

// المكتب السعودي: الجهات والمنصات العدلية السعودية
const GOV_LINKS_SA = [
  { name: 'منصة ناجز', desc: 'الخدمات العدلية الإلكترونية: رفع الدعاوى والجلسات والتنفيذ', url: 'https://najiz.sa', icon: '🇸🇦' },
  { name: 'هيئة الخبراء بمجلس الوزراء', desc: 'نصوص الأنظمة واللوائح السعودية الرسمية', url: 'https://laws.boe.gov.sa', icon: '📖' },
  { name: 'وزارة العدل', desc: 'الخدمات العدلية والتوثيق والمبادئ القضائية', url: 'https://www.moj.gov.sa', icon: '⚖️' },
  { name: 'ديوان المظالم', desc: 'القضاء الإداري وأحكامه', url: 'https://www.bog.gov.sa', icon: '🏛️' },
  { name: 'النيابة العامة', desc: 'خدمات النيابة والقضايا الجزائية', url: 'https://www.pp.gov.sa', icon: '📋' },
  { name: 'هيئة الزكاة والضريبة والجمارك', desc: 'ضريبة القيمة المضافة والفوترة الإلكترونية', url: 'https://zatca.gov.sa', icon: '💰' },
  { name: 'وزارة التجارة', desc: 'السجلات التجارية والأنظمة التجارية', url: 'https://mc.gov.sa', icon: '🏢' },
  { name: 'الهيئة السعودية للمحامين', desc: 'شؤون المهنة والتراخيص', url: 'https://sba.gov.sa', icon: '🛡️' },
];
const govLinks = () => (isSaudi() ? GOV_LINKS_SA : GOV_LINKS);

// ترحيب الشات: المكتب السعودي بالفصحى ومن غير ذكر قاعدة النصوص المصرية
function chatWelcome(withFiles) {
  const p = (inner) => `<h3 style="margin:0 0 8px;font-size:20px">${isSaudi() ? 'أهلاً بك!' : 'أهلاً بيك!'}</h3>
    <p style="color:var(--text-soft);margin:0 0 20px;font-size:14px;line-height:1.7">${inner}</p>`;
  if (isSaudi()) {
    return p(`أنا مساعدك القانوني، أجيب وفق <strong>الأنظمة السعودية</strong>، ويمكنني البحث في <strong>الإنترنت</strong> عند الحاجة.`
      + (withFiles ? '<br>يمكنك أيضًا رفع ملف (PDF/Word/صورة) لأحلّله.' : ''));
  }
  return p(`أنا مساعدك القانوني. بستخدم قاعدة بيانات فيها <strong>5,828 مادة قانونية</strong>
    + بقدر أدور في <strong>الإنترنت</strong> لو محتاج.` + (withFiles ? '<br>ممكن كمان ترفع ملف (PDF/Word/صورة) وأنا أحلله.' : ''));
}
const legalSystemWord = () => (isSaudi() ? 'الأنظمة السعودية' : 'القانون المصري');

export async function render(host) {
  host.innerHTML = `
    <div class="tabs" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="tab-btn primary" data-tab="chat">💬 مساعد قانوني ذكي</button>
      <button class="tab-btn ghost" data-tab="analyze">🧠 تحليل ذكي</button>
      <button class="tab-btn ghost" data-tab="generate">📝 توليد مستندات</button>
    </div>
    <div id="ai-meter-host" style="margin-bottom:12px"></div>

    <!-- ==================== شات المساعد ==================== -->
    <div id="tab-chat" class="tab-content">
      <div class="card" style="padding:0;overflow:hidden">
        <div class="chat-header">
          <div class="chat-avatar">⚖️</div>
          <div style="flex:1">
            <div class="chat-title">المساعد القانوني الذكي</div>
            <div class="chat-subtitle">يبحث في قاعدة البيانات + الإنترنت</div>
          </div>
          <button class="chat-new-btn" id="chat-new" title="محادثة جديدة">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="chat-new-btn" id="chat-history-btn" title="المحادثات السابقة">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
        </div>

        <div id="chat-messages" class="chat-messages">
          <div class="chat-welcome">
            <div style="font-size:48px;margin-bottom:12px">⚖️</div>
            ${chatWelcome(true)}
            <div class="chat-suggestions">
              <button class="chat-suggestion" data-suggestion="إيه شروط صحة عقد البيع؟">📄 شروط صحة عقد البيع؟</button>
              <button class="chat-suggestion" data-suggestion="عندي قضية تعويض عن ضرر، إيه نقاط الضعف اللي ممكن تكون ضدي؟">⚖️ نقاط ضعف قضية تعويض</button>
              <button class="chat-suggestion" data-suggestion="إيه شروط الطلاق للضرر في ${legalSystemWord()}؟">💔 شروط الطلاق للضرر</button>
              <button class="chat-suggestion" data-suggestion="إيه أحكام ${isSaudi() ? 'نظام العمل' : 'قانون العمل'} بخصوص الفصل التعسفي؟">💼 الفصل التعسفي</button>
            </div>
          </div>
        </div>

        <div id="chat-attachment" class="chat-attachment" style="display:none">
          <div class="chat-attachment-info">
            <span class="chat-attachment-icon">📎</span>
            <span class="chat-attachment-name" id="chat-attachment-name"></span>
            <button class="chat-attachment-remove" id="chat-attachment-remove">✕</button>
          </div>
        </div>

        <div class="chat-input-area">
          <label class="chat-attach-btn" title="إرفاق ملف">
            <input type="file" id="chat-file-input" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" style="display:none">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </label>
          <textarea id="chat-input" class="chat-input" placeholder="اكتب سؤالك القانوني..." rows="1"></textarea>
          <button id="chat-send" class="chat-send-btn" title="إرسال">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>🌐 بوابات حكومية رسمية</h3>
        <div class="gov-links-grid">
          ${govLinks().map(link => `
            <a class="gov-link" href="${link.url}" target="_blank" rel="noopener">
              <div class="gov-link-icon">${link.icon}</div>
              <div class="gov-link-body">
                <div class="gov-link-name">${esc(link.name)}</div>
                <div class="gov-link-desc">${esc(link.desc)}</div>
              </div>
              <div class="gov-link-arrow">↗</div>
            </a>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- ==================== تحليل ذكي ==================== -->
    <div id="tab-analyze" class="tab-content" style="display:none">
      <div class="card">
        <h3>🧠 التحليل الذكي</h3>
        <p style="font-size:12.5px;color:var(--ink-soft);margin-top:-6px">
          حلل عقد، قضية، أو مستند — وطلع المخاطر والدفوع والتوصيات.
        </p>

        <label>نوع التحليل</label>
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <button class="analyze-type-btn primary" data-type="contract">📄 عقد</button>
          <button class="analyze-type-btn ghost" data-type="case">⚖️ قضية</button>
          <button class="analyze-type-btn ghost" data-type="document">📋 مستند</button>
        </div>

        <label style="margin-top:10px">النص</label>
        <textarea id="analyze-text" placeholder="الصق النص هنا..." style="min-height:140px"></textarea>

        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <label class="file-btn ghost" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:8px 14px;border-radius:8px">
            📎 رفع ملف
            <input type="file" id="analyze-file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" style="display:none">
          </label>
          <button class="primary" id="analyze-btn">🧠 حلل</button>
        </div>
        <div id="analyze-file-name" style="font-size:12px;color:var(--ink-soft);margin-top:6px"></div>

        <div id="analyze-out" style="margin-top:14px"></div>
        <div class="warn">⚠️ التحليل استرشادي — راجعه مع محامٍ متخصص.</div>
      </div>

      <div class="card">
        <h3>📚 التحليلات السابقة</h3>
        <div id="analyses-list"><div style="color:var(--ink-soft);font-size:13px">جاري التحميل...</div></div>
      </div>
    </div>

    <!-- ==================== توليد مستندات ==================== -->
    <div id="tab-generate" class="tab-content" style="display:none">
      <div class="card">
        <h3>📝 توليد مسودة مستند قانوني</h3>
        <p style="font-size:12.5px;color:var(--ink-soft);margin-top:-6px">
          اختار نوع المستند، اكتب الوقائع، والـ AI هيولّدلك مسودة احترافية.
        </p>

        <label>نوع المستند</label>
        <select id="doc-type">
          <option>مذكرة دفاع</option>
          <option>إنذار على يد محضر</option>
          <option>صحيفة دعوى</option>
          <option>إنذار رسمي بفسخ عقد</option>
          <option>إخطار بإنهاء علاقة عمل</option>
          <option>توكيل خاص</option>
        </select>

        <label style="margin-top:10px">الأطراف (اختياري)</label>
        <input id="doc-parties" placeholder="مثال: أحمد السيد (موكل) ضد شركة النيل (خصم)">

        <label style="margin-top:10px">الوقائع *</label>
        <textarea id="doc-facts" placeholder="اكتب ملخص الوقائع: إيه اللي حصل، امتى، وإيه المطالب..." style="min-height:120px"></textarea>

        <label style="margin-top:10px">تفاصيل إضافية (اختياري)</label>
        <input id="doc-extra" placeholder="أي معلومات إضافية">

        <button class="primary" style="margin-top:10px" id="gen-btn">✍️ توليد المسودة</button>
        <div id="doc-out" style="margin-top:14px"></div>
        <div class="warn">⚠️ المسودات أولية — محتاجة مراجعة محامٍ متخصص قبل التقديم الرسمي.</div>
      </div>
    </div>
  `;

  mountAiMeter(host.querySelector('#ai-meter-host'));

  // ==================== Tab Switching ====================
  const tabs = host.querySelectorAll('.tab-btn');
  const contents = {
    chat: host.querySelector('#tab-chat'),
    analyze: host.querySelector('#tab-analyze'),
    generate: host.querySelector('#tab-generate'),
  };

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => { b.classList.remove('primary'); b.classList.add('ghost'); });
      btn.classList.remove('ghost');
      btn.classList.add('primary');
      Object.values(contents).forEach(c => c.style.display = 'none');
      const target = btn.dataset.tab;
      if (contents[target]) contents[target].style.display = '';
      if (target === 'analyze') loadAnalyses();
    });
  });

  // ==================== Chat Logic ====================
  let chatHistory = [];
  let currentSessionId = null;
  let attachmentText = null;
  let attachmentName = '';

  const chatMessages = host.querySelector('#chat-messages');
  const chatInput = host.querySelector('#chat-input');
  const chatSend = host.querySelector('#chat-send');
  const chatFileInput = host.querySelector('#chat-file-input');
  const chatAttachment = host.querySelector('#chat-attachment');
  const chatAttachmentName = host.querySelector('#chat-attachment-name');
  const chatAttachmentRemove = host.querySelector('#chat-attachment-remove');

  chatSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  host.querySelectorAll('[data-suggestion]').forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.dataset.suggestion;
      sendMessage();
    });
  });

  host.querySelector('#chat-new').addEventListener('click', () => {
    if (chatHistory.length > 0 && !confirm('هيتم بدء محادثة جديدة. متأكد؟')) return;
    resetChat();
  });

  host.querySelector('#chat-history-btn').addEventListener('click', showHistoryModal);

  chatFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    attachmentName = file.name;
    chatAttachmentName.textContent = file.name;
    chatAttachment.style.display = 'block';
    toast('جاري استخراج النص...', 'ok');

    try {
      attachmentText = await extractAnyFile(file, host);
      toast(`✅ تم استخراج ${attachmentText.length} حرف`, 'ok');
    } catch (err) {
      toast('فشل: ' + err.message, 'bad');
      chatAttachment.style.display = 'none';
      attachmentText = null;
      attachmentName = '';
    }
  });

  chatAttachmentRemove.addEventListener('click', () => {
    chatAttachment.style.display = 'none';
    chatFileInput.value = '';
    attachmentText = null;
    attachmentName = '';
  });

  function resetChat() {
    chatHistory = [];
    currentSessionId = null;
    attachmentText = null;
    attachmentName = '';
    chatAttachment.style.display = 'none';
    chatFileInput.value = '';
    chatMessages.innerHTML = `
      <div class="chat-welcome">
        <div style="font-size:48px;margin-bottom:12px">⚖️</div>
        ${chatWelcome(false)}
        <div class="chat-suggestions">
          <button class="chat-suggestion" data-suggestion="إيه شروط صحة عقد البيع؟">📄 شروط صحة عقد البيع؟</button>
          <button class="chat-suggestion" data-suggestion="إيه شروط الطلاق للضرر في ${legalSystemWord()}؟">💔 شروط الطلاق للضرر</button>
          <button class="chat-suggestion" data-suggestion="إيه أحكام ${isSaudi() ? 'نظام العمل' : 'قانون العمل'} بخصوص الفصل التعسفي؟">💼 الفصل التعسفي</button>
        </div>
      </div>
    `;
    host.querySelectorAll('[data-suggestion]').forEach(btn => {
      btn.addEventListener('click', () => {
        chatInput.value = btn.dataset.suggestion;
        sendMessage();
      });
    });
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addMessage(role, content) {
    const welcome = chatMessages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const msg = document.createElement('div');
    msg.className = `chat-message chat-message-${role}`;
    if (role === 'user') {
      msg.innerHTML = `<div class="chat-bubble chat-bubble-user">${esc(content).replace(/\n/g, '<br>')}</div>`;
    } else {
      msg.innerHTML = `
        <div class="chat-bubble chat-bubble-assistant">
          <div class="chat-ai-icon">⚖️</div>
          <div class="chat-ai-text">${formatAIResponse(content)}</div>
        </div>
      `;
    }
    chatMessages.appendChild(msg);
    scrollToBottom();
  }

  function addTyping() {
    const msg = document.createElement('div');
    msg.className = 'chat-message chat-message-assistant';
    msg.id = 'typing-indicator';
    msg.innerHTML = `
      <div class="chat-bubble chat-bubble-assistant">
        <div class="chat-ai-icon">⚖️</div>
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    `;
    chatMessages.appendChild(msg);
    scrollToBottom();
  }

  function removeTyping() {
    document.getElementById('typing-indicator')?.remove();
  }

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text && !attachmentText) return;

    // ✅ ندمج النص + الملف في رسالة واحدة
    let messageContent = text;
    if (attachmentText) {
      if (attachmentText.length > 10000) toast('⚠️ الملف طويل — هيتحلل أول 10,000 حرف بس', 'bad');
      messageContent += `\n\n---\n📎 **محتوى الملف المرفق (${attachmentName}):**\n${attachmentText.slice(0, 10000)}`;
    }

    // نعرض للمستخدم النص الأساسي بس
    const displayText = text || `📎 ${attachmentName}`;
    addMessage('user', displayText);

    chatHistory.push({ role: 'user', content: messageContent });

    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatSend.disabled = true;
    addTyping();

    try {
      // ✅ بنبعت chatHistory (فيه الملف مدمج)
      const data = await apiJson('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: chatHistory,
          session_id: currentSessionId,
        }),
      });

      removeTyping();

      if (data.session_id) currentSessionId = data.session_id;

      if (data.answer) {
        addMessage('assistant', data.answer);
        chatHistory.push({ role: 'assistant', content: data.answer });
      } else {
        addMessage('assistant', 'معلش، حصل خطأ. جرب تاني.');
      }

      // نصفّر المرفق
      attachmentText = null;
      attachmentName = '';
      chatAttachment.style.display = 'none';
      chatFileInput.value = '';
    } catch (e) {
      removeTyping();
      addMessage('assistant', `⚠️ ${e.message || 'حصل خطأ في الاتصال'}`);
    } finally {
      chatSend.disabled = false;
      chatInput.focus();
    }
  }

  async function showHistoryModal() {
    try {
      const data = await apiJson('/api/chat/sessions');
      const sessions = data.items || [];

      document.getElementById('chat-history-modal')?.remove();

      const modal = document.createElement('div');
      modal.id = 'chat-history-modal';
      modal.className = 'modal-overlay show';
      modal.innerHTML = `
        <div class="modal-card" style="max-width:520px;max-height:80vh;overflow:auto">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0">📚 المحادثات السابقة</h3>
            <button class="icon-btn" data-action="close">✕</button>
          </div>
          ${sessions.length ? sessions.map(s => `
            <div class="chat-history-item" data-session-id="${s.id}">
              <div class="chat-history-title">${esc(s.title || 'محادثة')}</div>
              <div class="chat-history-meta">
                ${new Date(s.updated_at).toLocaleDateString(dateLocale())}
              </div>
              <button class="chat-history-delete" data-delete-id="${s.id}" title="حذف">🗑</button>
            </div>
          `).join('') : '<div style="color:var(--text-soft);text-align:center;padding:40px">مفيش محادثات سابقة</div>'}
        </div>
      `;
      document.body.appendChild(modal);

      modal.addEventListener('click', async (e) => {
        if (e.target === modal || e.target.closest('[data-action="close"]')) {
          modal.remove();
          return;
        }

        const deleteBtn = e.target.closest('[data-delete-id]');
        if (deleteBtn) {
          e.stopPropagation();
          if (!confirm('متأكد من حذف المحادثة؟')) return;
          await apiJson(`/api/chat/sessions/${deleteBtn.dataset.deleteId}`, { method: 'DELETE' });
          modal.remove();
          showHistoryModal();
          return;
        }

        const item = e.target.closest('[data-session-id]');
        if (item) {
          const sid = item.dataset.sessionId;
          try {
            const d = await apiJson(`/api/chat/sessions/${sid}`);
            currentSessionId = sid;
            chatHistory = (d.messages || []).map(m => ({ role: m.role, content: m.content }));
            chatMessages.innerHTML = '';
            d.messages.forEach(m => addMessage(m.role, m.content));
            modal.remove();
          } catch (err) {
            toast(err.message, 'bad');
          }
        }
      });
    } catch (e) {
      toast('فشل جلب المحادثات: ' + e.message, 'bad');
    }
  }

  // ==================== تحليل ذكي ====================
  let analyzeType = 'contract';
  host.querySelectorAll('.analyze-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      host.querySelectorAll('.analyze-type-btn').forEach(b => { b.classList.remove('primary'); b.classList.add('ghost'); });
      btn.classList.remove('ghost');
      btn.classList.add('primary');
      analyzeType = btn.dataset.type;
    });
  });

  let uploadedFileName = '';
  host.querySelector('#analyze-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadedFileName = file.name;
    host.querySelector('#analyze-file-name').textContent = `📎 ${file.name}`;
    host.querySelector('#analyze-text').value = '';
    toast('جاري استخراج النص...', 'ok');

    try {
      const text = await extractAnyFile(file, host);
      host.querySelector('#analyze-text').value = text;
      toast(`✅ تم استخراج ${text.length} حرف`, 'ok');
    } catch (err) {
      toast('فشل: ' + err.message, 'bad');
    }
  });

  host.querySelector('#analyze-btn').addEventListener('click', async () => {
    const text = host.querySelector('#analyze-text').value.trim();
    const box = host.querySelector('#analyze-out');
    if (text.length < 30) return toast('اكتب نص أطول', 'bad');

    box.innerHTML = skeleton(6);
    try {
      const endpoint = {
        contract: '/api/analyze/contract',
        case: '/api/analyze/case',
        document: '/api/analyze/document',
      }[analyzeType];

      const data = await apiJson(endpoint, {
        method: 'POST',
        body: JSON.stringify({ text, file_name: uploadedFileName || null }),
      });

      box.innerHTML = renderAnalysisResult(data);
      loadAnalyses();
    } catch (e) {
      box.innerHTML = `<div class="warn">${esc(e.message)}</div>`;
    }
  });

  async function loadAnalyses() {
    const list = host.querySelector('#analyses-list');
    if (!list) return;
    try {
      const data = await apiJson('/api/analyze/history?limit=10');
      if (!data.items || !data.items.length) {
        list.innerHTML = '<div style="color:var(--ink-soft);font-size:13px">مفيش تحليلات سابقة</div>';
        return;
      }
      list.innerHTML = data.items.map(item => `
        <div class="item" style="cursor:pointer" data-id="${item.id}">
          <div class="name">${esc(item.title || 'تحليل')}</div>
          <div class="meta">${esc(item.type)} · ${esc(item.created_at)}</div>
        </div>
      `).join('');

      list.querySelectorAll('.item').forEach(el => {
        el.addEventListener('click', async () => {
          const id = el.dataset.id;
          try {
            const detail = await apiJson('/api/analyze/history/' + id);
            host.querySelector('#analyze-out').innerHTML = renderAnalysisResult(detail);
            host.querySelector('#analyze-out').scrollIntoView({ behavior: 'smooth' });
          } catch (e) { toast(e.message, 'bad'); }
        });
      });
    } catch (e) {
      list.innerHTML = `<div class="warn">${esc(e.message)}</div>`;
    }
  }

  // ==================== توليد المستندات ====================
  host.querySelector('#gen-btn').addEventListener('click', async () => {
    const doc_type = host.querySelector('#doc-type').value;
    const facts = host.querySelector('#doc-facts').value.trim();
    const parties = host.querySelector('#doc-parties').value.trim();
    const extra = host.querySelector('#doc-extra').value.trim();
    const box = host.querySelector('#doc-out');
    if (facts.length < 10) return toast('اكتب الوقائع بوضوح', 'bad');
    box.innerHTML = '<div class="answer">' + skeleton(5) + '</div>';
    try {
      const data = await apiJson('/api/generate-doc', {
        method: 'POST',
        body: JSON.stringify({ doc_type, facts, parties, extra }),
      });
      if (data.error) {
        box.innerHTML = `<div class="warn">${esc(data.error)}</div>`;
        return;
      }
      box.innerHTML = `
        <div class="doc-output" style="white-space:pre-wrap">${esc(data.document)}</div>
        <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
          <button class="ghost" id="copy-doc">📋 نسخ</button>
          <div id="doc-export"></div>
        </div>
      `;
      host.querySelector('#copy-doc').addEventListener('click', () => {
        navigator.clipboard.writeText(data.document);
        toast('اتنسخ', 'ok');
      });
      // المسودة كمستند Word للتعديل، أو طباعة/PDF
      mountExportMenu(host.querySelector('#doc-export'), () => ({
        title: doc_type,
        meta: parties ? [['الأطراف', parties]] : [],
        blocks: [{ type: 'text', text: data.document }],
      }), { formats: ['word', 'pdf'], label: '⬇️ Word / طباعة', filename: doc_type });
    } catch (e) {
      box.innerHTML = `<div class="warn">${esc(e.message)}</div>`;
    }
  });
}

// ============================================================
// Markdown formatting
// ============================================================
function formatAIResponse(text) {
  if (!text) return '';
  let html = esc(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  if (!html.startsWith('<')) html = '<p>' + html + '</p>';
  return html;
}

// ============================================================
// Extract files
// ============================================================
async function extractAnyFile(file, host) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return await extractPdfText(file);
  if (name.endsWith('.docx')) return await extractWordText(file);
  if (name.endsWith('.txt')) return await file.text();
  if (/\.(jpg|jpeg|png|webp)$/.test(name)) return await extractImageText(file, host);
  throw new Error('صيغة الملف مش مدعومة');
}

async function extractPdfText(file) {
  if (!window.pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter(i => i.str.trim()).map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));
    items.sort((a, b) => Math.abs(a.y - b.y) > 5 ? b.y - a.y : b.x - a.x);
    let lastY = null, line = '';
    for (const item of items) {
      if (lastY !== null && Math.abs(item.y - lastY) > 5) { text += line.trim() + '\n'; line = ''; }
      line += item.str + ' ';
      lastY = item.y;
    }
    if (line.trim()) text += line.trim() + '\n';
  }
  return text.trim();
}

async function extractWordText(file) {
  if (!window.mammoth) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractImageText(file, host) {
  if (!window.Tesseract) await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  const worker = await window.Tesseract.createWorker('ara+eng');
  try {
    const { data: { text } } = await worker.recognize(file);
    return text;
  } finally {
    await worker.terminate();
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ============================================================
// Analysis rendering
// ============================================================
function renderAnalysisResult(data) {
  if (!data || !data.result) return '<div class="warn">مفيش نتيجة</div>';
  const r = data.result;
  const type = data.type || 'تحليل';

  if (typeof r !== 'object') {
    return `<div class="ai-result-card"><div class="ai-result-body">${esc(String(r))}</div></div>`;
  }

  let html = `
    <div class="analysis-header">
      <div class="analysis-icon">${type === 'contract' ? '📄' : type === 'case' ? '⚖️' : '📋'}</div>
      <div>
        <div class="analysis-title">${esc(r.summary || 'تحليل قانوني')}</div>
        <div class="analysis-type">${type === 'contract' ? 'تحليل عقد' : type === 'case' ? 'تحليل قضية' : 'تحليل مستند'}</div>
      </div>
    </div>
  `;

  if (r.summary) html += `<div class="ai-result-card"><div class="ai-result-header"><span class="ai-result-icon">📋</span><span class="ai-result-title">الملخص</span></div><div class="ai-result-body" dir="rtl">${esc(r.summary)}</div></div>`;
  if (Array.isArray(r.strengths) && r.strengths.length) html += renderListSection('💪', 'نقاط القوة', r.strengths, 'success');
  if (Array.isArray(r.weaknesses) && r.weaknesses.length) html += renderListSection('⚠️', 'نقاط الضعف', r.weaknesses, 'danger');
  if (Array.isArray(r.defenses) && r.defenses.length) {
    html += `<div class="ai-result-card"><div class="ai-result-header"><span class="ai-result-icon">🛡️</span><span class="ai-result-title">الدفوع المقترحة</span></div><div class="ai-result-body">${r.defenses.map((d, i) => {
      if (typeof d === 'string') return `<div class="defense-item"><strong>${i + 1}.</strong> ${esc(d)}</div>`;
      return `<div class="defense-item"><div class="defense-type">${d.type === 'شكلي' ? '📋 شكلي' : '⚖️ موضوعي'}</div><div class="defense-text">${esc(d.defense || '')}</div>${d.legal_basis ? `<div class="defense-basis">📚 ${esc(d.legal_basis)}</div>` : ''}</div>`;
    }).join('')}</div></div>`;
  }
  if (Array.isArray(r.risks) && r.risks.length) {
    html += `<div class="ai-result-card"><div class="ai-result-header"><span class="ai-result-icon">🚨</span><span class="ai-result-title">المخاطر</span></div><div class="ai-result-body">${r.risks.map(risk => {
      if (typeof risk === 'string') return `<div class="risk-item">${esc(risk)}</div>`;
      const sev = risk.severity || 'medium';
      const sevLabel = sev === 'high' ? '🔴 عالي' : sev === 'low' ? '🟢 منخفض' : '🟡 متوسط';
      return `<div class="risk-item risk-${sev}"><div class="risk-header"><span class="risk-title">${esc(risk.risk || '')}</span><span class="risk-severity">${sevLabel}</span></div>${risk.explanation ? `<div class="risk-explanation">${esc(risk.explanation)}</div>` : ''}</div>`;
    }).join('')}</div></div>`;
  }
  if (Array.isArray(r.unfair_terms) && r.unfair_terms.length) {
    html += `<div class="ai-result-card"><div class="ai-result-header"><span class="ai-result-icon">📝</span><span class="ai-result-title">بنود محتاجة تعديل</span></div><div class="ai-result-body">${r.unfair_terms.map(t => `<div class="term-item"><div class="term-clause">📌 ${esc(t.clause || '')}</div>${t.issue ? `<div class="term-issue">⚠️ ${esc(t.issue)}</div>` : ''}${t.suggestion ? `<div class="term-suggestion">✅ ${esc(t.suggestion)}</div>` : ''}</div>`).join('')}</div></div>`;
  }
  if (Array.isArray(r.recommendations) && r.recommendations.length) html += renderListSection('💡', 'التوصيات', r.recommendations, 'info');
  if (r.success_probability) {
    const p = r.success_probability;
    const cls = p.includes('عالي') ? 'high' : p.includes('منخفض') ? 'low' : 'medium';
    html += `<div class="success-probability success-${cls}"><div class="success-label">🎯 تقييم فرص النجاح</div><div class="success-value">${esc(p)}</div></div>`;
  }
  if (r.overall_assessment) html += `<div class="ai-result-card"><div class="ai-result-header"><span class="ai-result-icon">⭐</span><span class="ai-result-title">التقييم العام</span></div><div class="ai-result-body" dir="rtl">${esc(r.overall_assessment)}</div></div>`;

  const otherSections = [
    { key: 'parties', icon: '👥', title: 'الأطراف' },
    { key: 'dates', icon: '📅', title: 'التواريخ' },
    { key: 'amounts', icon: '💰', title: 'المبالغ' },
    { key: 'key_facts', icon: '📌', title: 'الوقائع' },
    { key: 'legal_issues', icon: '⚖️', title: 'المسائل القانونية' },
    { key: 'missing_info', icon: '❓', title: 'معلومات ناقصة' },
  ];
  otherSections.forEach(s => {
    if (Array.isArray(r[s.key]) && r[s.key].length) html += renderListSection(s.icon, s.title, r[s.key], 'neutral');
  });

  return html;
}

function renderListSection(icon, title, items, variant = 'neutral') {
  return `<div class="ai-result-card ai-result-${variant}"><div class="ai-result-header"><span class="ai-result-icon">${icon}</span><span class="ai-result-title">${title}</span></div><div class="ai-result-body"><ul class="ai-result-list">${items.map(x => `<li>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('')}</ul></div></div>`;
} 
