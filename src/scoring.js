/**
 * 厨艺比赛评分计算模块
 * 可在浏览器与 Node.js 中运行，不依赖 DOM/CloudBase。
 */

const DEFAULT_DIMS = [
  { key: 'color', name: '色', weight: 30 },
  { key: 'aroma', name: '香', weight: 30 },
  { key: 'taste', name: '味', weight: 40 },
];

const SCORE_MIN = 1;
const SCORE_MAX = 10;

function isValidNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && !Number.isNaN(v);
}

/**
 * 校验一条评分记录的分项是否合法。
 * @param {Object} scores - { color: 9.5, aroma: 8, taste: 9 }
 * @param {Array} dims - 维度定义数组
 * @returns {{ok:boolean, errors:string[], total:number|null}}
 */
export function validateScore(scores, dims) {
  const errors = [];
  let total = 0;
  const wSum = dims.reduce((s, d) => s + (Number(d.weight) || 0), 0) || 100;

  for (const d of dims) {
    const v = scores && scores[d.key];
    if (!isValidNumber(v)) {
      errors.push(`${d.name || d.key} 不是有效数字`);
      continue;
    }
    if (v < SCORE_MIN || v > SCORE_MAX) {
      errors.push(`${d.name || d.key} 越界（${SCORE_MIN}–${SCORE_MAX}）`);
      continue;
    }
    total += v * (Number(d.weight) || 0);
  }

  return {
    ok: errors.length === 0,
    errors,
    total: errors.length === 0 ? +(total / wSum).toFixed(4) : null,
  };
}

/**
 * 汇总计算榜单。
 * @param {Object} config - 比赛配置（含 settings、groups）
 * @param {Object} scoresMap - { targetGroupId: { dishIdx: { judgeGroupId: { scores, comment, ts } } } }
 * @returns {Array} 按总分排序的组结果
 */
export function computeResults(config, scoresMap) {
  if (!config || !Array.isArray(config.groups)) {
    throw new TypeError('config.groups 必须是数组');
  }

  const dims = (config.settings && Array.isArray(config.settings.dims))
    ? config.settings.dims
    : DEFAULT_DIMS;
  const dropExtremes = !!(config.settings && config.settings.dropExtremes);
  const wSum = dims.reduce((s, d) => s + (Number(d.weight) || 0), 0) || 100;
  const nJudges = Math.max(config.groups.length - 1, 0);

  const rows = config.groups.map((g) => {
    const dishes = (g.dishes || []).map((dname, idx) => {
      const byJudge = (scoresMap[g.id] || {})[idx] || {};
      const entries = Object.entries(byJudge)
        .map(([jid, rec]) => {
          // 排除本组自评
          if (jid === g.id) return null;
          const jg = config.groups.find((x) => x.id === jid);
          if (!jg) return null;
          const validation = validateScore(rec.scores, dims);
          if (!validation.ok) return null;
          return {
            jid,
            jname: jg.name,
            judgeName: jg.judge || '',
            total: validation.total,
            raw: rec.scores,
            comment: (rec.comment || '').trim(),
            ts: rec.ts || 0,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.total - a.total);

      let used = entries;
      let dropped = [];
      if (dropExtremes && entries.length >= 4) {
        dropped = [entries[0], entries[entries.length - 1]];
        used = entries.slice(1, -1);
      }

      const avg = (arr, pick) => {
        if (!arr || !arr.length) return null;
        const sum = arr.reduce((s, e) => s + pick(e), 0);
        return +(sum / arr.length).toFixed(2);
      };

      return {
        idx,
        name: dname || '（未命名菜品）',
        expected: nJudges,
        received: entries.length,
        avgTotal: avg(used, (e) => e.total),
        dims: dims.map((d) => ({
          name: d.name,
          key: d.key,
          avg: avg(used, (e) => e.raw[d.key] || 0),
        })),
        entries,
        dropped,
      };
    });

    const scored = dishes.filter((d) => d.avgTotal !== null);
    return {
      id: g.id,
      name: g.name,
      members: g.members,
      judge: g.judge,
      dishes,
      expectedTotal: nJudges * dishes.length,
      receivedTotal: dishes.reduce((s, d) => s + d.received, 0),
      avgTotal: scored.length
        ? +(scored.reduce((s, d) => s + d.avgTotal, 0) / scored.length).toFixed(2)
        : null,
    };
  });

  // 排序：有分数的在前，按分数降序；无分数的在后
  rows.sort((a, b) => {
    const aScore = a.avgTotal == null ? -Infinity : a.avgTotal;
    const bScore = b.avgTotal == null ? -Infinity : b.avgTotal;
    return bScore - aScore;
  });

  // 排名（同分同名次）
  let lastScore = null;
  let lastRank = 0;
  rows.forEach((r, i) => {
    if (r.avgTotal !== null && r.avgTotal === lastScore) {
      r.rank = lastRank;
    } else {
      r.rank = i + 1;
      if (r.avgTotal !== null) {
        lastScore = r.avgTotal;
        lastRank = r.rank;
      }
    }
  });

  return rows;
}

/**
 * 从评分记录中提取干净的 scores 对象。
 * @param {Object} raw
 * @param {Array} dims
 * @returns {Object|null}
 */
export function sanitizeScores(raw, dims) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const d of dims) {
    const v = raw[d.key];
    if (isValidNumber(v) && v >= SCORE_MIN && v <= SCORE_MAX) {
      out[d.key] = +v.toFixed(2);
    }
  }
  return Object.keys(out).length === dims.length ? out : null;
}

export { SCORE_MIN, SCORE_MAX, DEFAULT_DIMS };
