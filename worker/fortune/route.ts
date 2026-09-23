export function isFortuneApi(pathname: string) {
  return (
    pathname === '/api/report' ||
    pathname === '/api/fortune' ||
    pathname === '/api/lots' ||
    pathname === '/api/bazi' ||
    pathname === '/api/hehun' ||
    pathname === '/api/liunian'
  )
}
