const tcb = require('@cloudbase/node-sdk');
const crypto = require('crypto');

const PIN_PREFIX = 'cookoff:';
function pinHash(p) {
  return crypto.createHash('sha256').update(PIN_PREFIX + String(p)).digest('hex');
}

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

function ok(data) { return { code: 0, data }; }
function fail(msg, code = 1) { return { code, message: msg }; }

exports.main = async (event, context) => {
  const envId = process.env.TCB_ENV_ID;
  if (!envId) return fail('缺少环境变量 TCB_ENV_ID');

  const app = tcb.init({ env: envId });
  const auth = app.auth();
  const db = app.database();

  const { pin, setup } = event.data || {};
  if (!pin || !/^\d{4,6}$/.test(pin)) return fail('口令需为 4–6 位数字');

  let config;
  try {
    const res = await db.collection('cc_config').doc('app').get();
    config = Array.isArray(res.data) ? res.data[0] : res.data;
  } catch (e) {
    config = null;
  }

  const isFirstSetup = !config || !config.pinHash;
  if (setup && !isFirstSetup) return fail('口令已设置，请用「登录」模式');
  if (!setup && isFirstSetup) return fail('首次使用，请用「设置口令」模式');

  const hash = pinHash(pin);
  if (!setup && hash !== config.pinHash) return fail('口令不对');

  const ticket = issueTicket(envId, 'admin');

  // 保存/更新 pinHash，并记录管理员 customUserId 为 admin
  const next = config || { v: 3, phase: 'setup', settings: defaultSettings(), groups: [] };
  next.pinHash = hash;
  next.adminCustomUserId = 'admin';
  next.updatedAt = Date.now();

  const clean = JSON.parse(JSON.stringify(next, (k, v) => k.startsWith('_') ? undefined : v));
  await db.collection('cc_config').doc('app').set(clean);

  return ok({ ticket, isFirstSetup });
};

function defaultSettings() {
  return {
    eventName: '厨艺比赛',
    eventWhen: '',
    eventWhere: '',
    dims: [
      { key: 'color', name: '色', weight: 30 },
      { key: 'aroma', name: '香', weight: 30 },
      { key: 'taste', name: '味', weight: 40 },
    ],
    dropExtremes: true,
    hideScoresDuringScoring: true,
  };
}
