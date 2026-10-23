const tcb = require('@cloudbase/node-sdk');

const SCORE_MIN = 1;
const SCORE_MAX = 10;

function ok(data) { return { code: 0, data }; }
function fail(msg, code = 1) { return { code, message: msg }; }

function isValidNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && !Number.isNaN(v);
}

exports.main = async (event, context) => {
  const envId = process.env.TCB_ENV_ID;
  if (!envId) return fail('缺少环境变量 TCB_ENV_ID');

  const app = tcb.init({ env: envId });
  const auth = app.auth();
  const db = app.database();

  const caller = auth.getUserInfo();
  const customUserId = caller && caller.customUserId;
  if (!customUserId || !customUserId.startsWith('judge:')) return fail('需要评委身份', 403);

  const judgeGroupId = customUserId.slice(6);

  const { target, idx, scores, comment } = event.data || {};
  if (!target || typeof idx !== 'number') return fail('参数错误');

  let config;
  try {
    const res = await db.collection('cc_config').doc('app').get();
    config = Array.isArray(res.data) ? res.data[0] : res.data;
  } catch (e) {
    config = null;
  }
  if (!config) return fail('比赛尚未配置');
  if (config.phase !== 'scoring') return fail('当前不在评分阶段');

  const groups = config.groups || [];
  const judgeGroup = groups.find(g => g.id === judgeGroupId);
  const targetGroup = groups.find(g => g.id === target);
  if (!judgeGroup) return fail('评委组不存在');
  if (!targetGroup) return fail('目标组不存在');
  if (target === judgeGroupId) return fail('不能给本组打分');

  const targetDishes = targetGroup.dishes || [];
  if (idx < 0 || idx >= targetDishes.length) return fail('菜品序号越界');

  const dims = (config.settings && Array.isArray(config.settings.dims)) ? config.settings.dims : [];
  if (!dims.length) return fail('评分维度未配置');

  const cleanScores = {};
  for (const d of dims) {
    const v = scores && scores[d.key];
    if (!isValidNumber(v) || v < SCORE_MIN || v > SCORE_MAX) {
      return fail(`${d.name || d.key} 必须是 ${SCORE_MIN}–${SCORE_MAX} 的有效数字`);
    }
    cleanScores[d.key] = +v.toFixed(2);
  }

  const docId = `${judgeGroupId}__${target}__${idx}`;
  await db.collection('cc_scores').doc(docId).set({
    judge: judgeGroupId,
    target,
    idx,
    scores: cleanScores,
    comment: String(comment || '').trim().slice(0, 200),
    ts: Date.now(),
  });

  return ok({ id: docId, judge: judgeGroupId, target, idx });
};
