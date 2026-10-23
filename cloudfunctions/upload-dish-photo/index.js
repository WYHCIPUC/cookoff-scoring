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
  if (!caller || !caller.uid) return fail('请先登录', 401);

  const { gid, idx, dataURL } = event.data || {};
  if (!dataURL || !dataURL.startsWith('data:')) return fail('照片数据无效');
  if (!gid || typeof idx !== 'number') return fail('参数错误');

  await db.collection('cc_dishphotos').doc(`${gid}_${idx}`).set({
    gid,
    idx,
    dataURL,
    ts: Date.now(),
  });

  return ok({ id: `${gid}_${idx}` });
};
