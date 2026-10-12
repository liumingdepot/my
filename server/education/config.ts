/**
 * B 站登录 Cookie（可选增强）。
 *
 * 教育模块全部走 anti-crawl 自动 cookie（buvid3 / buvid4 / bili_ticket，
 * 每次实时拉取），搜索与取流的主线路（APP 签名）不依赖登录态；
 * 这里的登录 Cookie 仅用于 Web WBI 备选线路提升可用清晰度。
 *
 * 读项目根 .env 的 BILI_COOKIE，不入库（无后台管理）。
 */

export function getEducationCookie(env: { BILI_COOKIE?: string } = {}): string {
  return (env.BILI_COOKIE ?? '').trim()
}