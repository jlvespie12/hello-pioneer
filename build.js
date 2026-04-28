const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.warn('build.js: SUPABASE_URL or SUPABASE_ANON_KEY missing — output will show config error in browser');
}

const html = fs.readFileSync('index.html', 'utf8');
const out = html
  .split('__SUPABASE_URL__').join(url)
  .split('__SUPABASE_ANON_KEY__').join(key);

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync(path.join('dist', 'index.html'), out);
console.log(`build.js: wrote dist/index.html (${out.length} bytes)`);
