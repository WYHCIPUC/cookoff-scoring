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

  const { phase } = event.data || {};
  if (!['setup', 'scoring', 'finished'].includes(phase)) return fail('非法阶段');

  let config;
  try {
    const res = await db.collection('cc_config').doc('app').get();
    config = Array.isArray(res.data) ? res.data[0] : res.data;
  } catch (e) {
    return fail('读取配置失败');
  }
  if (!config) return fail('配置不存在');

  config.phase = phase;
  config.updatedAt = Date.now();

  const clean = JSON.parse(JSON.stringify(config, (k, v) => k.startsWith('_') ? undefined : v));
  await db.collection('cc_config').doc('app').set(clean);

  return ok({ phase });
};
