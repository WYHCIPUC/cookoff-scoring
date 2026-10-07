#!/usr/bin/env node
/* 生成部署目录 dist/index.html：把云端环境 ID 注入前端。
 * 用法: node scripts/build-dist.mjs <envId>
 */
import fs from 'node:fs';
import path from 'node:path';

const envId = process.argv[2];
if (!envId || !/^[a-z0-9-]+$/i.test(envId)) {
  console.error('用法: node scripts/build-dist.mjs <CloudBase环境ID>');
  process.exit(1);
}
const root = path.resolve(import.meta.dirname, '..');
let html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
if (!html.includes("window.TCB_ENV_ID='';")) {
  console.error('未找到占位符 window.TCB_ENV_ID=\'\'，请检查 public/index.html');
  process.exit(1);
}
html = html.replace("window.TCB_ENV_ID='';", `window.TCB_ENV_ID='${envId}';`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
console.log(`已生成 dist/index.html（云端环境: ${envId}）`);
