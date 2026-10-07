#!/usr/bin/env node
/* 云端一键初始化（2026-09-24 实测通过的命令链）
 * 用法: node scripts/setup-cloud.mjs <envId>
 * 前置: 已 tcb login；环境为「云数据库（文档型）」模式
 * 注意: 匿名登录开关需在控制台手动开启（见输出提示）
 */
import { execSync } from 'node:child_process';

const envId = process.argv[2];
if (!envId) {
  console.error('用法: node scripts/setup-cloud.mjs <envId>');
  process.exit(1);
}
const run = (cmd, desc, optional = false) => {
  console.log(`\n▸ ${desc}`);
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log((out || '').trim().split('\n').slice(-4).join('\n'));
    return true;
  } catch (e) {
    const msg = ((e.stdout || '') + (e.stderr || '')).trim().split('\n').pop();
    const benign = /already exists|NamespaceExists/i.test(msg);
    console.log(benign ? '  · 已存在，跳过' : optional ? `  ⚠ 跳过：${msg}` : `  ✗ 失败：${msg}`);
    if (!optional && !benign) process.exit(1);
    return false;
  }
};
const q = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;

console.log(`== 厨艺大赛打分工具 · 云端初始化（环境 ${envId}）==`);

// 1) 建集合（已存在视为成功）
for (const col of ['cc_config', 'cc_scores']) {
  run(`tcb db nosql execute -e ${envId} --command ${q(`[{"TableName":"${col}","CommandType":"COMMAND","Command":"{\\"create\\":\\"${col}\\"}"}]`)}`, `创建集合 ${col}`, true);
}

// 2) 安全规则：所有用户可读写（ModifySafeRule，实测有效）
for (const col of ['cc_config', 'cc_scores']) {
  run(`tcb api tcb ModifySafeRule -e ${envId} --body ${q(`{"EnvId":"${envId}","CollectionName":"${col}","AclTag":"CUSTOM","Rule":"{\\\\\\"read\\\\\\": true, \\\\\\"write\\\\\\": true}"}`)} --json`, `设置 ${col} 权限为所有用户可读写`, true);
}

// 3) 安全域名（tcb cors add，非交互 --yes）
const domain = `${envId}-1259386436.tcloudbaseapp.com`;
run(`tcb cors add -e ${envId} ${domain} --yes`, `添加安全域名 ${domain}`, true);

console.log('\n== 自动部分完成 ==');
console.log('⚠ 还差一步（只能手动）：到控制台开启匿名登录');
console.log(`   https://tcb.cloud.tencent.com/dev?envId=${envId}#/identity/login-manage`);
console.log('   路径：环境 → 身份认证 → 登录方式 → 开启「匿名登录」');
console.log('   （安全规则生效有 2–5 分钟缓存，开启后稍等片刻再访问）');
