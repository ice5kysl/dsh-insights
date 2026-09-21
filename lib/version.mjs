/**
 * lib/version — 粗粒度版本比较。
 *
 * 用途单一且明确：判断「仓库 package.json 的版本」与「npm latest」**谁领先**，
 * 好把「版本不一致」拆成两个含义完全不同的方向：
 *   repo > npm → 作者改了版本号但没发版（可行动，该催）
 *   npm  > repo → 发布版比默认分支还新（多为 CI 发布没回写，通常无害）
 *
 * ⚠️ 这不是完整 semver：预发布标识（-rc.1 / -alpha.2）不是"更低"，
 * 而是按段取数字后并列比较。本管线的用途只需要「谁大」，不需要 semver 优先级。
 * 需要严谨 semver 的地方请显式引入依赖，别用这里。
 *
 * @module dsh-insights/lib-version
 */

/**
 * 按 `.` `-` `+` 分段、各段取前导数字后逐段比较。
 * @returns {number} a 领先返回正数，b 领先返回负数，相等（或无法区分）返回 0
 */
export function cmpVersion(a, b) {
  const seg = (v) => String(v ?? '').split(/[.\-+]/).map((x) => Number.parseInt(x, 10) || 0)
  const A = seg(a)
  const B = seg(b)
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] ?? 0
    const y = B[i] ?? 0
    if (x !== y) return x - y
  }
  return 0
}
