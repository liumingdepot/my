export const SHICHEN = [
  { name: '子时', range: '23:00–01:00' },
  { name: '丑时', range: '01:00–03:00' },
  { name: '寅时', range: '03:00–05:00' },
  { name: '卯时', range: '05:00–07:00' },
  { name: '辰时', range: '07:00–09:00' },
  { name: '巳时', range: '09:00–11:00' },
  { name: '午时', range: '11:00–13:00' },
  { name: '未时', range: '13:00–15:00' },
  { name: '申时', range: '15:00–17:00' },
  { name: '酉时', range: '17:00–19:00' },
  { name: '戌时', range: '19:00–21:00' },
  { name: '亥时', range: '21:00–23:00' },
] as const

export function formatBazi(birthDate: string, shichen: string) {
  const [year, month, day] = birthDate.split('-')
  return `${Number(year)}年${Number(month)}月${Number(day)}日 ${shichen}`
}

export function formatDateLabel(birthDate: string) {
  const [year, month, day] = birthDate.split('-')
  if (!year || !month || !day) return ''
  return `${Number(year)}年${Number(month)}月${Number(day)}日`
}

export const t = {
  docTitle: '周易',
  spine: '天行健，君子以自强不息',
  eyebrow: '观象于天',
  titleA: '周',
  titleB: '易',
  lead: '一阴一阳之谓道',
  body: '易与天地准，故能弥纶天地之道。',
  source: '系辞 · 上传',
  author: '作者：刘铭',
  backHome: '返回首页',
  clockLabel: '古代时辰钟',
  scroll: '向下填写生辰',
  kicker: '极数知来',
  quote: '仰以观于天文，俯以察于地理。',
  note: '生辰既定，吉凶自现',
  formEyebrow: '问卜',
  formTitle: '填写生辰',
  name: '姓名',
  namePh: '请输入姓名',
  bazi: '八字',
  date: '年月日',
  hour: '时辰',
  question: '咨询问题',
  questionPh: '请写下想问的事',
  submit: '生成报告',
  loading: '加载中',
  needDate: '请选择年月日',
  needHour: '请选择时辰',
  fail: '提交失败',
  network: '网络异常，请稍后再试',
  closeDate: '关闭日期选择',
  closeHour: '关闭时辰选择',
  chooseDate: '选择年月日',
  chooseHour: '选择时辰',
  confirm: '确定',
  cancel: '取消',
  year: '年',
  month: '月',
  day: '日',
}
