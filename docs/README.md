# مُوكِّل — Mowakkil

منصة SaaS لإدارة مكاتب المحاماة: القضايا، الموكلون، الجلسات، التحصيل،
المهام، المستندات، والتقارير — مع بحث قانوني مبني على نصوص موثّقة.

## المعمارية

- **Backend:** Cloudflare Workers (ES modules)
- **DB:** Cloudflare D1 (SQLite)
- **Files:** Cloudflare R2
- **Rate limiting:** Cloudflare KV (اختياري)
- **Frontend:** Vanilla ES modules + Cloudflare Pages

## البدء السريع

```bash
npm install
npx wrangler d1 create mowakkil-db
npx wrangler r2 bucket create mowakkil-files
npx wrangler kv namespace create RATE_LIMIT_KV

# عدّل wrangler.toml بالـ IDs

npx wrangler d1 execute mowakkil-db --local --file=schema.sql
npx wrangler d1 execute mowakkil-db --local --file=migration_007_security.sql
npx wrangler d1 execute mowakkil-db --local --file=migrations/008_cron.sql

# أسرار
npx wrangler secret put JWT_SECRET
npx wrangler secret put SETUP_KEY
npx wrangler secret put GEMINI_API_KEY

npm run dev