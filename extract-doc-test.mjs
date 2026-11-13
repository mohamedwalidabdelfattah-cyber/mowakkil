import WordExtractor from 'word-extractor';

const extractor = new WordExtractor();
const files = [
  'D:\\مجلد جديد\\الفلاشة القانونية للسادة المحامين\\القوانين\\اكواد قوانين\\اكواد\\قانون_العقوبات_المصري.doc',
  'D:\\مجلد جديد\\الفلاشة القانونية للسادة المحامين\\القوانين\\اكواد قوانين\\اكواد\\قانون_العمل_الموحد.doc',
  'D:\\مجلد جديد\\الفلاشة القانونية للسادة المحامين\\القوانين\\اكواد قوانين\\اكواد\\قانون_المخدرات.doc',
  'D:\\مجلد جديد\\الفلاشة القانونية للسادة المحامين\\القوانين\\اكواد قوانين\\اكواد\\قانون_المرافعات.doc',
  'D:\\مجلد جديد\\الفلاشة القانونية للسادة المحامين\\القوانين\\اكواد قوانين\\اكواد\\قانون_الخلع.doc',
];

for (const f of files) {
  try {
    const doc = await extractor.extract(f);
    const text = doc.getBody();
    console.log(`✅ ${f.split('\\').pop()} — ${text.length} حرف`);
    console.log(text.slice(0, 200).replace(/\n/g, ' '));
    console.log('---');
  } catch (e) {
    console.log(`❌ ${f.split('\\').pop()} — ${e.message}`);
  }
}