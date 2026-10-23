const tcb = require('@cloudbase/node-sdk');

function ok(data) { return { code: 0, data }; }
function fail(msg, code = 1) { return { code, message: msg }; }

exports.main = async (event, context) => {
  const envId = process.env.TCB_ENV_ID;
  if (!envId) return fail('缺少环境变量 TCB_ENV_ID');

  const app = tcb.init({ env: envId });
  const auth = app.auth();
  const db = app.database();

  const caller = auth.getUserInfo();
  if (!caller || caller.customUserId !== 'admin') return fail('需要管理员身份', 403);

  const { config: incoming } = event.data || {};
  if (!incoming || !Array.isArray(incoming.groups)) return fail('配置格式错误');

  let old;
  try {
    const res = await db.collection('cc_config').doc('app').get();
    old = Array.isArray(res.data) ? res.data[0] : res.data;
  } catch (e) {
    old = null;
  }

  const next = {
    v: incoming.v || 3,
    phase: incoming.phase || old?.phase || 'setup',
    settings: incoming.settings || old?.settings || defaultSettings(),
    groups: incoming.groups,
    // 允许管理员在设置页修改 PIN；adminCustomUserId 永远保留
    pinHash: incoming.pinHash || old?.pinHash || '',
    adminCustomUserId: old?.adminCustomUserId || 'admin',
    updatedAt: Date.now(),
  };

  // 清理前端可能带过来的 _ 前缀字段
  const clean = JSON.parse(JSON.stringify(next, (k, v) => k.startsWith('_') ? undefined : v));
  await db.collection('cc_config').doc('app').set(clean);

  return ok({ updatedAt: next.updatedAt });
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
