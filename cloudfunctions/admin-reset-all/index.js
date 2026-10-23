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

  let config;
  try {
    const res = await db.collection('cc_config').doc('app').get();
    config = Array.isArray(res.data) ? res.data[0] : res.data;
  } catch (e) {
    config = null;
  }

  // 清空评分
  try {
    let lastId = null;
    while (true) {
      let q = db.collection('cc_scores').limit(500);
      if (lastId) q = q.where('_id', '>', lastId);
      const all = await q.get();
      const docs = all.data || [];
      if (!docs.length) break;
      for (const d of docs) {
        await db.collection('cc_scores').doc(d._id).remove();
        lastId = d._id;
      }
      if (docs.length < 500) break;
    }
  } catch (e) {}

  const next = {
    v: 3,
    phase: 'setup',
    settings: {
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
    },
    groups: [],
    pinHash: config?.pinHash || '',
    adminCustomUserId: config?.adminCustomUserId || 'admin',
    updatedAt: Date.now(),
  };

  const clean = JSON.parse(JSON.stringify(next, (k, v) => k.startsWith('_') ? undefined : v));
  await db.collection('cc_config').doc('app').set(clean);

  return ok({ reset: true });
};
