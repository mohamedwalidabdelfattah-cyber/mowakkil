// generate-icons.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const INPUT = 'C:\\Users\\hi\\mowakkil\\web\\assets\\app-icon.png';
const OUT_DIR = 'C:\\Users\\hi\\mowakkil\\web\\assets';

const sizes = [
  { name: 'web-app-manifest-192x192.png', size: 192 },
  { name: 'web-app-manifest-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-96x96.png', size: 96 },
];

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error('❌ مش لاقي الملف:', INPUT);
    process.exit(1);
  }

  for (const { name, size } of sizes) {
    const outPath = path.join(OUT_DIR, name);
    await sharp(INPUT)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(outPath);
    console.log(`✅ ${name} (${size}x${size})`);
  }

  console.log('\n🎉 كل الأيقونات اتولدت!');
}

main().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});