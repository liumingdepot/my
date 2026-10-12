/**
 * 将蓝湖「环信-UED」团队项目批量导入 works 表（作品管理）。
 * Usage: node scripts/import-lanhu-works-hxued.mjs
 *
 * - 同名标题已存在则跳过
 * - 默认停用（enabled=0），避免前台瞬间铺满占位卡片；后台可逐条启用
 * - 图片占位 /home-hero.jpg
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnv() {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    if (process.env[m[1]] == null) process.env[m[1]] = m[2]
  }
}

/** 蓝湖 环信-UED：两次目录拉取合并去重后的完整项目名 */
const PROJECTS = [
  '小保当煤矿',
  '陕西省生态环境厅多级一体化运维考核平台',
  '水气要素配色',
  '汉中尾气app',
  '固废app',
  '老界面改版',
  '后台系统通用样式',
  '陕西省生态环境政务资源中心',
  '陕西省生态环境政务资源中心2.0',
  'GIS',
  'APP',
  '一张图环境监测数据统计',
  '陝西省生态环境一张图2.0',
  '生态环境一张图 三维版本',
  '门户',
  '移动执法APP',
  '延安网格化管理APP(旧版本-第一版)',
  'GIS业务系统',
  '应急事件',
  '延安考试系统',
  '固废APP',
  '应急指挥APP',
  '互联网+',
  'OA项目',
  '网格化管理',
  '网格化任务模块',
  '互联网+界面优化',
  '环境监测监控中心-副本',
  '延安环境数据监测中心-卷子版',
  '延安环境监管执法系统',
  '延安市环境监测监控中心',
  '延安市环境综合业务管理系统平台',
  '延安固废知识竞答',
  '延安市生态环境领导驾驶舱',
  '延安市尾气及遥感监测系统',
  '延安需求',
  '延安噪声项目',
  '吴起医疗可视化',
  '吴起县大气环境质量监测查询',
  '延安水环境提升',
  '2023第七届西安国际环保产业博览会',
  '生态环境信息技术应用研讨会暨 中国环境科学学会环境 信息化分会学术年会',
  '中国环境科学学会 2024 年技术年会',
  '2024第七届数字中国',
  '可视化',
  '后台管理系统',
  '12369环境举报投诉业务',
  '14运应急DEMO',
  '十四运APP',
  '数字乡村可视化地理信息服务',
  '数字乡村APP',
  '环信官网',
  '手机适配',
  '企业运力及柴油车智能监管系统',
  '杨陵机动车尾气检测管理系统',
  '非道路移动机械监管平台',
  '环保厅网站手机端',
  '环保厅手机页面新增',
  '环保厅杂项',
  '陕西省声环境质量信息发布平台',
  '环评报告智能检索',
  '陕西省重点流域排污口基础信息管理平台',
  '【优化修改版】陕西省重点流域排污口基础信息管理平台',
  '咸阳企业运力及柴油车智能监管系统平台',
  '天地车人可视化系统',
  '陕西省天地车人后台样式',
  'GIS设计',
  '手机执法端V1.1',
  '执法手机端优化-2023/02',
  '商洛市机动车环保检测信息管理系统',
  '执法手机端优化-2024/4/21',
  '商洛市机动车排放检测监管可视化',
  '移动源-线索模块',
  '咸阳天地车人APP',
  '咸阳天地车人PC端',
  '咸阳升级',
  '移动源环保车辆管控平台',
  '外检APP',
  '榆林天地车人pc端',
  '榆林天地车人APP',
  '门禁企业端',
  '咸阳市移动源环保服务平台-小程序',
  '咸阳非道路机械小程序',
  '图片资料库',
  '外事办效果改版',
  '涉水污染源执法数据融合应用',
  'Al+数智监管执法应用',
  '监管任务数字化提升',
  '汇报大屏',
  '陕西省生态环境部门随机抽查管理系统',
  '登录池',
  '企业污染源上报',
  '垃圾清运及河湖治理项目-投标演示',
  'GIS组件',
  'APP组件',
  '最美水站',
  '国家网络安全宣传周',
  '云桌面',
  '执法案卷管理',
  '陕西省环境监控管理',
  '省厅公众号环境小程序',
  '陕西省环境监控监测中心',
  '环信APP上架资料及二维码管理',
  '陕西省环境披露平台',
  '陕西省环境权交易',
  '前端项目汇总界面',
  '双随机',
  '扶贫项目',
  '陕西省生态环境厅民主测评系统',
  '陕西省挥发性有机物填报系统',
  '陕西省地表水质断面(国控)自动监测数据发布平台',
  '陕西省生态环境厅视频图像共享交换平台',
  '陕西省生态文明建设示范区及实践基地管理系统',
  '生态大数据一体化管理系统',
  '奉新县湖泊管理平台与水环境监测系统',
  '多级化运维数据监管可视化',
  '环保涉税复核优化',
  '环信ITSM系统设计',
  '矿山污染状况调查数据信息',
  '数字看板（省级生态环境监测小程序)',
  '问卷系统',
  '久科三维',
  '陕西省流域生态环境精细化管理平台',
  '科研Demo',
  '大气数据治理项目',
]

function guessPlatform(title) {
  if (/小程序/.test(title)) return '小程序'
  if (/大屏|驾驶舱|可视化|看板|三维/.test(title)) return '大屏'
  if (/APP|app|手机|移动|执法端|外检/.test(title)) return '移动'
  if (/GIS|pc端|PC端|后台|门户|官网|平台|系统|管理/.test(title)) return 'PC'
  return 'PC'
}

loadEnv()

const host = process.env.MYSQL_HOST || '192.168.0.233'
const port = Number(process.env.MYSQL_PORT || 3306)
const user = process.env.MYSQL_USER || 'root'
const password = process.env.MYSQL_PASSWORD || '123456'
const database = process.env.MYSQL_DATABASE || 'liuming'

const unique = [...new Set(PROJECTS.map((name) => name.trim()).filter(Boolean))]
console.log(`环信-UED 待导入 ${unique.length} 个项目 → ${host}:${port}/${database}`)

const conn = await mysql.createConnection({ host, port, user, password, database })

try {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS works (
      id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      role VARCHAR(191) NOT NULL DEFAULT '',
      period VARCHAR(191) NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      image MEDIUMTEXT NOT NULL,
      badge VARCHAR(191) NOT NULL DEFAULT '',
      company VARCHAR(191) NOT NULL DEFAULT '',
      platform VARCHAR(64) NOT NULL DEFAULT '',
      stack TEXT NULL,
      highlights TEXT NULL,
      link VARCHAR(512) NOT NULL DEFAULT '',
      featured TINYINT NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      enabled TINYINT NOT NULL DEFAULT 1,
      created_at VARCHAR(64) NOT NULL,
      updated_at VARCHAR(64) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_works_sort (sort_order, enabled),
      KEY idx_works_featured (featured, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `)

  const [cols] = await conn.query(
    `SELECT COLUMN_NAME AS name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'works'`,
  )
  const names = new Set(cols.map((row) => row.name))
  const alters = [
    ["badge", "ADD COLUMN badge VARCHAR(191) NOT NULL DEFAULT '' AFTER image"],
    ["company", "ADD COLUMN company VARCHAR(191) NOT NULL DEFAULT '' AFTER badge"],
    ["platform", "ADD COLUMN platform VARCHAR(64) NOT NULL DEFAULT '' AFTER company"],
    ['stack', 'ADD COLUMN stack TEXT NULL AFTER platform'],
    ['highlights', 'ADD COLUMN highlights TEXT NULL AFTER stack'],
    ["link", "ADD COLUMN link VARCHAR(512) NOT NULL DEFAULT '' AFTER highlights"],
    ['featured', 'ADD COLUMN featured TINYINT NOT NULL DEFAULT 0 AFTER link'],
  ]
  for (const [name, ddl] of alters) {
    if (names.has(name)) continue
    await conn.query(`ALTER TABLE works ${ddl}`)
    console.log('added column:', name)
  }

  const [[{ maxSort }]] = await conn.query(
    'SELECT COALESCE(MAX(sort_order), 0) AS maxSort FROM works',
  )
  let sortOrder = Number(maxSort) || 0

  const [existingRows] = await conn.query('SELECT title FROM works')
  const existing = new Set(existingRows.map((row) => String(row.title).trim()))

  let inserted = 0
  let skipped = 0
  const now = new Date().toISOString()
  const company = '环信恒辉'
  const role = '前端开发'
  const image = '/home-hero.jpg'

  for (const title of unique) {
    if (existing.has(title)) {
      skipped += 1
      continue
    }
    sortOrder += 1
    const platform = guessPlatform(title)
    const description = `蓝湖「环信-UED」导入 · ${title}`
    await conn.query(
      `INSERT INTO works (
        id, title, role, period, description, image,
        badge, company, platform, stack, highlights, link, featured,
        sort_order, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        title,
        role,
        '',
        description,
        image,
        '',
        company,
        platform,
        '',
        '',
        '',
        0,
        sortOrder,
        0, // 默认停用，后台启用后再展示
        now,
        now,
      ],
    )
    existing.add(title)
    inserted += 1
  }

  console.log(`完成：新增 ${inserted}，跳过已存在 ${skipped}，合计目录 ${unique.length}`)
} finally {
  await conn.end()
}
