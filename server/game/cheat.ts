import { cacheKey, getJsonCache, putJsonCache } from '../utils/cache.js'

/**
 * 金手指（Cheat）数据源：与 ROM/列表同源，取自 yikm `/cheat?id=<playId>`。
 *
 * 上游返回纯文本，一行一条，逗号分隔，格式为 `AAAA-MM-VVVV$名称`：
 *   - `AAAA`   16 位内存地址（$0000-$FFFF）
 *   - `MM`     写入字节数标记（01/02/03/04 为主，个别为 11/14 等特殊类型）
 *   - `VVVV`   目标值，按小端顺序连续写入（低字节在前）
 *   - `名称`   分隔符 `$` 之后的说明文本，可能为空
 *
 * 例：`0032-01-64$1P生命数` → 持续把 $64(100) 写入 $0032（魂斗罗 1P 命数）
 *     `0109-02-270F$金钱`   → 持续把 $0F,$27 写入 $0109,$010A（9999 = 0x270F）
 */

const YIKM_ORIGIN = 'https://www.yikm.net'
const CHEAT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/** 上游数据几乎不变，缓存 6 小时；失败或无数据的结果不写入缓存。 */
const CHEAT_CACHE_TTL_SEC = 6 * 60 * 60

/** 单条最多连续写 4 字节：上游实际数据最长为 mode=04 */
const MAX_CHEAT_BYTES = 4

export type GameCheat = {
  /** 上游顺序中的下标，作为前端稳定标识 */
  index: number
  /** 展示用名称；上游缺失时回退为原始码 */
  name: string
  /** 16 位内存地址（$0000-$FFFF） */
  address: number
  /** 从 address 起按小端顺序连续写入的字节 */
  bytes: number[]
  /** 原始码，如 `0032-01-64` */
  code: string
}

/** `270F` → [0x0f, 0x27]；非十六进制返回 null */
function hexToBytes(hex: string) {
  const clean = hex.trim()
  if (!/^[0-9a-fA-F]+$/.test(clean)) return null
  const padded = clean.length % 2 === 1 ? `0${clean}` : clean
  const bytes: number[] = []
  for (let i = 0; i + 1 < padded.length; i += 2) {
    bytes.push(parseInt(padded.slice(i, i + 2), 16))
  }
  return bytes.slice(0, MAX_CHEAT_BYTES)
}

export function parseYikmCheats(raw: string): GameCheat[] {
  const text = raw.trim()
  if (!text) return []

  const cheats: GameCheat[] = []
  for (const entry of text.split(',')) {
    const item = entry.trim()
    if (!item) continue

    const sep = item.indexOf('$')
    const code = (sep === -1 ? item : item.slice(0, sep)).trim()
    // 名称本身可含 `$`（如 `1P$HP`），故只去掉上游偶发的结尾 `$`
    const name = (sep === -1 ? '' : item.slice(sep + 1).replace(/\$+$/, '')).trim()

    // `MM` 字段仅作写入宽度标记，不参与解析（上游存在 11/14 等非宽度取值）
    const parts = code.split('-')
    if (parts.length < 3) continue

    const address = Number.parseInt(parts[0], 16)
    if (!Number.isInteger(address) || address < 0 || address > 0xffff) continue

    const bytes = hexToBytes(parts[2])
    if (!bytes || bytes.length === 0) continue

    cheats.push({
      index: cheats.length,
      name: name || code,
      address,
      bytes,
      code,
    })
  }
  return cheats
}

async function fetchCheatText(playId: string) {
  const response = await fetch(`${YIKM_ORIGIN}/cheat?id=${encodeURIComponent(playId)}`, {
    headers: {
      'User-Agent': CHEAT_UA,
      Accept: '*/*',
      Referer: `${YIKM_ORIGIN}/play?id=${playId}`,
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`请求失败 ${response.status}`)
  return response.text()
}

export async function fetchYikmGameCheats(playId: string): Promise<GameCheat[]> {
  const id = playId.trim()
  if (!/^\d+$/.test(id)) return []

  const key = cacheKey('game:cheats', { id })
  const cached = await getJsonCache<GameCheat[]>(key)
  if (cached) return cached

  let cheats: GameCheat[] = []
  try {
    cheats = parseYikmCheats(await fetchCheatText(id))
  } catch (err) {
    console.warn('[game cheat] fetch failed', id, err)
    return []
  }

  // 空结果多为「该游戏无金手指」或上游抖动，不缓存，避免长时间锁死
  if (cheats.length > 0) {
    await putJsonCache(key, cheats, CHEAT_CACHE_TTL_SEC)
  }
  return cheats
}