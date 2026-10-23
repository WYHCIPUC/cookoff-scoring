#!/usr/bin/env node
/* 简单静态检查：确保 dist/index.html 不含占位符、硬编码 envId/口令 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
let exit = 0;

// public/index.html 源码保留占位符是正常的；构建后必须被替换
if (html.includes('cooktool2026-d7gyuz92r0462a11c')) {
  console.error('❌ public/index.html 包含旧环境 ID');
  exit = 1;
}

// 检查是否还有旧默认口令的提示文案
if (/仍是默认口令\s*1011/.test(html)) {
  console.error('❌ public/index.html 仍提示默认口令 1011');
  exit = 1;
}

const distPath = path.join(root, 'dist', 'index.html');
if (fs.existsSync(distPath)) {
  const dist = fs.readFileSync(distPath, 'utf8');
  if (dist.includes("window.TCB_ENV_ID='';")) {
    console.error('❌ dist/index.html 仍包含未注入的 TCB_ENV_ID 占位符');
    exit = 1;
  }
  if (dist.includes('cooktool2026-d7gyuz92r0462a11c')) {
    console.error('❌ dist/index.html 包含旧环境 ID');
    exit = 1;
  }
}

if (exit === 0) console.log('✅ 静态检查通过');
process.exit(exit);
