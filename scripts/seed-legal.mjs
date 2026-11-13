// scripts/seed-legal.mjs
// يزرع نصوص قانونية أساسية. شغّله مرة واحدة.

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const db = process.argv[2] || 'mowakkil-db';
const remote = process.argv.includes('--remote');

const articles = [
  {
    law_name: 'قانون الرسوم القضائية',
    law_number: '90 لسنة 1944',
    article_number: 'المادة 1',
    article_text: 'تفرض على الدعاوى المدنية والتجارية وغيرها من الدعاوى المنصوص عليها في هذا القانون رسوم قضائية تُقدّر على أساس قيمة الدعوى.',
    source_url: 'https://www.cc.gov.eg',
  },
  {
    law_name: 'قانون الرسوم القضائية',
    law_number: '90 لسنة 1944',
    article_number: 'المادة 2',
    article_text: 'تُقدّر الرسوم على الدعاوى المعلومة القيمة بنسبة من قيمتها، وتُقدّر على الدعاوى مجهولة القيمة برسم ثابت.',
    source_url: 'https://www.cc.gov.eg',
  },
  {
    law_name: 'قانون المرافعات المدنية والتجارية',
    law_number: '13 لسنة 1968',
    article_number: 'المادة 1',
    article_text: 'لا يجوز لأحد أن يترافع أمام المحاكم إلا إذا كان من المحامين المقبولين أمامها.',
    source_url: 'https://www.cc.gov.eg',
  },
];

const stmts = articles.map(a => `INSERT INTO law_articles (law_name, law_number, article_number, article_text, source_url)
  VALUES ('${esc(a.law_name)}', '${esc(a.law_number)}', '${esc(a.article_number)}', '${esc(a.article_text)}', '${esc(a.source_url)}');`).join('\n');

function esc(s) { return String(s).replace(/'/g, "''"); }

const tmp = path.join(os.tmpdir(), `seed-${Date.now()}.sql`);
fs.writeFileSync(tmp, stmts);

try {
  execSync(
    `wrangler d1 execute ${db} ${remote ? '--remote' : '--local'} --file=${tmp}`,
    { stdio: 'inherit' }
  );
} finally {
  try { fs.unlinkSync(tmp); } catch {}
}