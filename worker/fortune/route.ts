export function isFortuneApi(pathname: string) {
  return (
    pathname === '/api/report' ||
    pathname === '/api/fortune' ||
    pathname === '/api/home' ||
    pathname === '/api/bazi'
  )
}
