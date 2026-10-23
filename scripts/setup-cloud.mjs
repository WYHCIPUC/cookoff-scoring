#!/usr/bin/env node
/* 云端一键初始化：创建集合并设置最小授权安全规则
 * 用法: node scripts/setup-cloud.mjs <envId>
 * 前置: 已 tcb login；环境为「云数据库（文档型）」模式
 * 注意:
 *   1. 匿名登录开关需在控制台手动开启
 *   2. 自定义登录私钥需下载后配置到各云函数环境变量或文件中
 *   3. 云函数需单独部署（tcb fn deploy）
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
const collections = ['cc_config', 'cc_scores', 'cc_photos', 'cc_dishphotos', 'cc_judges'];
for (const col of collections) {
  run(`tcb db nosql execute -e ${envId} --command ${q(`[{"TableName":"${col}","CommandType":"COMMAND","Command":"{\\"create\\":\\"${col}\\"}"}]`)}`, `创建集合 ${col}`, true);
}

// 2) 安全规则：所有登录用户可读，仅云函数可写（客户端直接写入会被拒绝）
const ruleReadOnly = '{\\"read\\": true, \\"write\\": false}';
for (const col of collections) {
  run(`tcb api tcb ModifySafeRule -e ${envId} --body ${q(`{"EnvId":"${envId}","CollectionName":"${col}","AclTag":"CUSTOM","Rule":"${ruleReadOnly}"}`)} --json`, `设置 ${col} 为只读（写操作走云函数）`, true);
}

// 3) 安全域名（tcb cors add，非交互 --yes）
const domain = `${envId}-1259386436.tcloudbaseapp.com`;
run(`tcb cors add -e ${envId} ${domain} --yes`, `添加安全域名 ${domain}`, true);

console.log('\n== 自动部分完成 ==');
console.log('⚠ 还差以下步骤（只能手动）：');
console.log(`   1. 到控制台开启「匿名登录」与「自定义登录」：`);
console.log(`      https://tcb.cloud.tencent.com/dev?envId=${envId}#/identity/login-manage`);
console.log(`   2. 下载自定义登录私钥 tcb_custom_login.json，部署时注入各云函数；`);
console.log(`      或设置环境变量 TCB_CUSTOM_LOGIN=<JSON 字符串>`);
console.log(`   3. 部署云函数：tcb fn deploy --env ${envId}`);
console.log(`   4. 构建并部署前端：npm run build -- ${envId}`);
console.log('   （安全规则生效有 2–5 分钟缓存，开启后稍等片刻再访问）');
