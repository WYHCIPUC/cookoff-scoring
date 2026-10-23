const tcb = require('@cloudbase/node-sdk');

function ok(data) { return { code: 0, data }; }
function fail(msg, code = 1) { return { code, message: msg }; }

function loadCredentials() {
  if (process.env.TCB_CUSTOM_LOGIN) {
    try { return JSON.parse(process.env.TCB_CUSTOM_LOGIN); } catch (e) { return null; }
  }
  const path = process.env.TCB_CUSTOM_LOGIN_PATH || './tcb_custom_login.json';
  try { return require('fs').readFileSync(path, 'utf8'); } catch (e) { return null; }
}

function issueTicket(envId, customUserId) {
  const creds = loadCredentials();
  if (!creds) throw new Error('缺少自定义登录私钥');
  const app = tcb.init({ env: envId, credentials: creds });
  return app.auth().createTicket(customUserId, {
    refresh: 3600 * 1000,
    expire: 24 * 3600 * 1000,
  });
}

exports.main = async (event, context) => {
  const envId = process.env.TCB_ENV_ID;
  if (!envId) return fail('缺少环境变量 TCB_ENV_ID');

  const app = tcb.init({ env: envId });
  const auth = app.auth();
  const db = app.database();

  const caller = auth.getUserInfo();
  if (!caller || !caller.uid) return fail('请先登录', 401);

  const { groupId } = event.data || {};
  if (!groupId) return fail('缺少组 ID');

  let config;
  try {
    const res = await db.collection('cc_config').doc('app').get();
    config = Array.isArray(res.data) ? res.data[0] : res.data;
  } catch (e) {
    config = null;
  }
  if (!config) return fail('比赛尚未配置');
  if (!['setup', 'scoring'].includes(config.phase)) return fail('当前阶段不能登记评委');

  const group = (config.groups || []).find(g => g.id === groupId);
  if (!group) return fail('组不存在');

  // 检查是否已有评委登记本组；仅在 setup 阶段允许覆盖重新登记
  let existing;
  try {
    const r = await db.collection('cc_judges').doc(groupId).get();
    existing = Array.isArray(r.data) ? r.data[0] : r.data;
  } catch (e) {
    existing = null;
  }
  if (existing && config.phase !== 'setup') return fail('该组已有评委登记', 409);

  const customUserId = 'judge:' + groupId;
  await db.collection('cc_judges').doc(groupId).set({
    groupId,
    customUserId,
    registeredAt: Date.now(),
  });

  const ticket = issueTicket(envId, customUserId);
  return ok({ ticket, groupId, groupName: group.name });
};
