#!/usr/bin/env node
/* 生成部署目录 dist/index.html：把云端环境 ID 注入前端。
 * 用法:
 *   node scripts/build-dist.mjs <envId>
 *   TCB_ENV_ID=xxx npm run build
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

// 尝试从 .env 加载 TCB_ENV_ID
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^TCB_ENV_ID\s*=\s*(.+)$/);
    if (m && !process.env.TCB_ENV_ID) process.env.TCB_ENV_ID = m[1].trim();
  }
}

const envId = process.argv[2] || process.env.TCB_ENV_ID;
if (!envId || !/^[a-z0-9-]+$/i.test(envId)) {
  console.error('用法: node scripts/build-dist.mjs <CloudBase环境ID>');
  console.error('或设置环境变量 TCB_ENV_ID');
  process.exit(1);
}

let html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
if (!html.includes("window.TCB_ENV_ID='';")) {
  console.error('未找到占位符 window.TCB_ENV_ID=\'\'，请检查 public/index.html');
  process.exit(1);
}
html = html.replace("window.TCB_ENV_ID='';", `window.TCB_ENV_ID='${envId}';`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
console.log(`已生成 dist/index.html（云端环境: ${envId}）`);
