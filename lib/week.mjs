/**
 * lib/week.mjs — ISO 周工具（周报/洞察的周标签单一事实来源）。
 *
 * 关键语义：报告覆盖「刚结束的完整 ISO 周」（周一 00:00Z → 周日 24:00Z）。
 * 生成时机 2026-09 起从周五改为周一——周一跑时「本周」尚未结束，
 * lastCompleteIsoWeek 取的是上一周；任何日期跑都回退到最近一个已完结的周。
 *
 * @module dsh-insights/lib/week
 */

/** ISO 周标签（YYYY-Www，UTC）。 */
export function isoWeek(d) {
  const date = new Date(typeof d === 'string' ? d + 'T00:00:00Z' : d)
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day + 3)
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((date - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** ISO 周 → [周一, 周日] 展示串（YYYY/MM/DD～YYYY/MM/DD）。 */
export function weekLabel(isoWk) {
  const m = isoWk.match(/^(\d{4})-W(\d{2})$/)
  const d = new Date(Date.UTC(+m[1], 0, 4))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - day + 1 + (+m[2] - 1) * 7)
  const fmt = (x) => `${x.getUTCFullYear()}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${String(x.getUTCDate()).padStart(2, '0')}`
  return `${fmt(d)}～${fmt(new Date(d.getTime() + 6 * 86400000))}`
}

/** UTC 日期的 ISO  weekday（周一=1 … 周日=7）。 */
export function isoDow(date = new Date()) {
  return date.getUTCDay() || 7
}

/**
 * 最近一个已完结的 ISO 周：今天减去「今天是本周第几天」天，落在上周日——
 * 周一跑减 1 天（昨天周日，上一周）；周日跑减 7 天（本周要到 24:00 才完结）。
 */
export function lastCompleteIsoWeek(now = new Date()) {
  const d = new Date(now.getTime() - isoDow(now) * 86400000)
  return isoWeek(d.toISOString().slice(0, 10))
}
