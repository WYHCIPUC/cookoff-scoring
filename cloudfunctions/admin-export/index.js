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
  if (!config) return fail('配置不存在');

  const scores = [];
  const pageSize = 500;
  let skip = 0, hasMore = true;
  while (hasMore) {
    const res = await db.collection('cc_scores').limit(pageSize).skip(skip).get();
    const docs = (res && res.data) || [];
    scores.push(...docs);
    hasMore = docs.length === pageSize;
    skip += pageSize;
  }

  return ok({
    version: 'cookoff-scoring-export-v1',
    exportedAt: Date.now(),
    config: JSON.parse(JSON.stringify(config, (k, v) => k.startsWith('_') ? undefined : v)),
    scores,
  });
};
