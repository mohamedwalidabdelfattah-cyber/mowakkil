// worker/lib/attribution.js
// تحويل بيانات مصدر الزيارة (UTM / fbclid / الموقع اللي جه منه) لمصدر موحّد
// Meta بتبعت utm_source={{site_source_name}} = fb | ig | msg | an

const SOURCE_ALIASES = {
  fb: 'facebook', facebook: 'facebook', 'facebook.com': 'facebook', meta: 'facebook',
  ig: 'instagram', instagram: 'instagram', 'instagram.com': 'instagram', insta: 'instagram',
  msg: 'messenger', messenger: 'messenger',
  an: 'audience_network',
  google: 'google', gads: 'google', adwords: 'google',
  whatsapp: 'whatsapp', wa: 'whatsapp',
  tiktok: 'tiktok', youtube: 'youtube', twitter: 'twitter', x: 'twitter', linkedin: 'linkedin',
};

function fromHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return null;
  if (h.includes('instagram')) return 'instagram';
  if (h.includes('facebook') || h === 'fb.com' || h.endsWith('.fb.com') || h === 'fb.me') return 'facebook';
  if (h.includes('messenger')) return 'messenger';
  if (h.includes('whatsapp') || h === 'wa.me') return 'whatsapp';
  if (h.includes('google')) return 'google';
  if (h.includes('tiktok')) return 'tiktok';
  if (h.includes('youtube') || h === 'youtu.be') return 'youtube';
  if (h === 't.co' || h.includes('twitter') || h === 'x.com') return 'twitter';
  if (h.includes('linkedin') || h === 'lnkd.in') return 'linkedin';
  return null;
}

const clip = (v, n = 120) => (v == null || v === '' ? null : String(v).trim().slice(0, n) || null);

export function normalizeAttribution(a) {
  if (!a || typeof a !== 'object') return { source: 'direct', medium: null, campaign: null, content: null, referrer: null, landing: null };
  const rawSource = clip(a.source, 60)?.toLowerCase() || null;
  const referrer = clip(a.referrer, 120)?.toLowerCase() || null;
  let source = rawSource ? (SOURCE_ALIASES[rawSource] || rawSource.replace(/[^a-z0-9_.-]/g, '').slice(0, 40) || null) : null;
  let medium = clip(a.medium, 40)?.toLowerCase() || null;
  if (!source && a.click === 'meta') { source = fromHost(referrer) === 'instagram' ? 'instagram' : 'facebook'; medium = medium || 'paid'; }
  if (!source && a.click === 'google') { source = 'google'; medium = medium || 'paid'; }
  if (!source && referrer) { source = fromHost(referrer) || 'referral'; medium = medium || (source === 'referral' ? 'referral' : 'organic'); }
  if (!source) source = 'direct';
  return {
    source, medium,
    campaign: clip(a.campaign), content: clip(a.content),
    referrer, landing: clip(a.landing, 80),
  };
}

export const SOURCE_LABELS = {
  facebook: 'فيسبوك', instagram: 'إنستجرام', messenger: 'ماسنجر', audience_network: 'شبكة Meta',
  google: 'جوجل', whatsapp: 'واتساب', tiktok: 'تيك توك', youtube: 'يوتيوب', twitter: 'إكس (تويتر)',
  linkedin: 'لينكد إن', referral: 'موقع تاني', direct: 'مباشر / مش معروف',
};
