/**
 * unidbg 离线签名服务桥接。
 *
 * 签名由红果 metasec 原生库（libmetasec_ml.so）在 JVM 里算出，本进程不参与计算，
 * 只负责把 {url, headers} 转给常驻的 Java 服务，拿回 X-Argus / X-Gorgon 等安全头。
 *
 * 目录约定（unidbg-sign.jar 内部按相对路径找工件，所以 cwd 很关键）：
 *   <root>/hongguo-work/sign/unidbg-sign.jar
 *   <root>/hongguo-work/capture/fq_oversea/{libmetasec_ml.so, libc++_shared.so, ms_16777218.bin}
 *
 * <root> 优先为项目根 / 打包后的 .output（与 public、server 同级），可用 HG_WORK 覆盖。
 *
 * 可用环境变量覆盖：
 *   HG_WORK      hongguo-work 根目录
 *   HG_SIGN_DIR  jar 所在目录（默认 <HG_WORK>/sign）
 *   HG_JAVA      java 可执行文件路径
 *   HG_SIGN_PORT 签名服务端口（默认 9099）
 *   HG_SIGN_PATCH 补丁 class 目录（默认 <HG_WORK>/build/out）
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAIN_CLASS = 'com.hongguo.sign.FqTrace'
const SIGN_PORT = Number(process.env.HG_SIGN_PORT || 9099)
const SIGN_URL = `http://127.0.0.1:${SIGN_PORT}/sign`

/** 签名头（红果安全因子） */
export type SignHeaders = Record<string, string>

type SignState = {
  proc: ChildProcess | null
  chain: Promise<unknown>
  ready: boolean
  lastError: string | null
  stderr: string
}

const state: SignState = {
  proc: null,
  chain: Promise.resolve(),
  ready: false,
  lastError: null,
  stderr: '',
}

function moduleNearbyRoots(): string[] {
  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    const out: string[] = []
    for (let i = 0; i < 6; i++) {
      out.push(join(dir, 'hongguo-work'))
      out.push(join(dir, '.output', 'hongguo-work'))
      dir = dirname(dir)
    }
    return out
  } catch {
    return []
  }
}

function resolveWorkRoot(): string {
  if (process.env.HG_WORK) return process.env.HG_WORK
  const candidates = [
    join(process.cwd(), 'hongguo-work'),
    join(process.cwd(), '.output', 'hongguo-work'),
    join(process.cwd(), '..', 'hongguo-work'),
    ...moduleNearbyRoots(),
    join(homedir(), 'hongguo-work'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'sign', 'unidbg-sign.jar'))) return dir
  }
  return candidates[0]!
}

function workPaths() {
  const root = resolveWorkRoot()
  const signDir = process.env.HG_SIGN_DIR || join(root, 'sign')
  const jar = join(signDir, 'unidbg-sign.jar')
  const patched = process.env.HG_SIGN_PATCH || join(root, 'build', 'out')
  return { root, signDir, jar, patched }
}

/** 扫描 parent 下 namePrefix* / rel 路径 */
function scanJavaUnder(parent: string, namePrefix: string, rel: string): string[] {
  if (!existsSync(parent)) return []
  try {
    return readdirSync(parent)
      .filter((name) => name.startsWith(namePrefix))
      .map((name) => join(parent, name, rel))
      .filter((p) => existsSync(p))
  } catch {
    return []
  }
}

function listJavaCandidates(workRoot: string): string[] {
  const exe = process.platform === 'win32' ? 'java.exe' : 'java'
  const home = homedir()
  // 顺序即优先级：显式指定 > 随包裁剪的 jre > 随包完整 JDK > 系统 JAVA_HOME > 扫盘
  const hard = [
    process.env.HG_JAVA,
    join(workRoot, 'jre', 'bin', exe),
    join(workRoot, 'jre', 'Contents', 'Home', 'bin', 'java'),
    join(workRoot, 'jdk17', 'bin', exe),
    join(workRoot, 'jdk17', 'Contents', 'Home', 'bin', 'java'),
    process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', exe) : '',
    join(home, 'hongguo-work', 'jdk17', 'Contents', 'Home', 'bin', 'java'),
    join(home, 'hongguo-work', 'jre', 'Contents', 'Home', 'bin', 'java'),
    '/opt/homebrew/opt/openjdk@17/bin/java',
    '/usr/local/opt/openjdk@17/bin/java',
    '/opt/homebrew/opt/openjdk/bin/java',
    '/usr/local/opt/openjdk/bin/java',
  ]

  const scanned: string[] = []
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files'
    scanned.push(
      ...scanJavaUnder(join(pf, 'Eclipse Adoptium'), 'jdk-17', join('bin', exe)),
      ...scanJavaUnder(join(pf, 'Microsoft'), 'jdk-17', join('bin', exe)),
      ...scanJavaUnder(join(pf, 'Amazon Corretto'), 'jdk17', join('bin', exe)),
      ...scanJavaUnder(join(pf, 'Java'), 'jdk-17', join('bin', exe)),
      ...scanJavaUnder(join(pf, 'Zulu'), 'zulu-17', join('bin', exe)),
    )
  }

  if (process.platform === 'darwin') {
    for (const base of ['/Library/Java/JavaVirtualMachines', join(home, 'Library/Java/JavaVirtualMachines')]) {
      scanned.push(...scanJavaUnder(base, '', join('Contents', 'Home', 'bin', 'java')))
    }
    try {
      const r = spawnSync('/usr/libexec/java_home', ['-v', '17'], { encoding: 'utf8' })
      const home17 = (r.stdout || '').trim()
      if (r.status === 0 && home17) scanned.push(join(home17, 'bin', 'java'))
    } catch {
      /* ignore */
    }
  }

  return [...hard, ...scanned, exe].filter((v): v is string => typeof v === 'string' && v.length > 0)
}

function isWorkingJava(bin: string): boolean {
  try {
    const r = spawnSync(bin, ['-version'], {
      encoding: 'utf8',
      timeout: 15_000,
      env: process.env,
    })
    const out = `${r.stdout || ''}${r.stderr || ''}`
    // macOS stub exits non-zero with "Unable to locate a Java Runtime"
    if (r.error || r.status !== 0) return false
    return /version\s+"?\d+/i.test(out)
  } catch {
    return false
  }
}

function javaBin(workRoot: string): string {
  const candidates = listJavaCandidates(workRoot)
  for (const bin of candidates) {
    if (bin === 'java' || bin === 'java.exe') {
      if (isWorkingJava(bin)) return bin
      continue
    }
    if (existsSync(bin) && isWorkingJava(bin)) return bin
  }
  throw new Error(
    '未找到可用的 Java 17。请安装 Temurin/Corretto 17，或设置 HG_JAVA 指向 java 可执行文件；' +
      '也可运行 bash scripts/setup-hongguo-sign.sh 生成随包裁剪的 hongguo-work/jre（无需装 JDK）',
  )
}

export function signRuntimeStatus(): {
  ready: boolean
  dir: string
  port: number
  error: string | null
  work: string
} {
  const { root, signDir } = workPaths()
  return {
    ready: state.ready,
    dir: signDir,
    port: SIGN_PORT,
    error: state.lastError,
    work: root,
  }
}

function startJava(): ChildProcess {
  const { root, signDir, jar, patched } = workPaths()
  if (!existsSync(jar)) {
    throw new Error(
      `签名运行时缺失：${jar}（将 hongguo-work 放在项目根或 .output 下，与 public/server 同级；见 server/hongguo/README-stream.md 或 HG_WORK）`,
    )
  }
  const bin = javaBin(root)
  const classpath = existsSync(patched) ? `${patched}${delimiter}${jar}` : jar
  state.stderr = ''
  const proc = spawn(
    bin,
    [
      '--add-opens',
      'java.base/java.lang=ALL-UNNAMED',
      '-cp',
      classpath,
      MAIN_CLASS,
      'serve',
      String(SIGN_PORT),
    ],
    { cwd: signDir, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const onChunk = (d: Buffer) => {
    const text = d.toString('utf8')
    state.stderr = (state.stderr + text).slice(-4000)
    process.stderr.write(`[sign] ${text}`)
  }
  proc.stdout?.on('data', onChunk)
  proc.stderr?.on('data', onChunk)
  proc.on('exit', (code) => {
    state.proc = null
    state.ready = false
    state.lastError = `签名服务退出（code=${code}）${state.stderr ? `：${state.stderr.slice(0, 300)}` : ''}`
  })
  proc.on('error', (err) => {
    state.proc = null
    state.ready = false
    state.lastError = `签名服务无法启动：${err.message}`
  })
  state.proc = proc
  return proc
}

async function postSign(url: string, headers: Record<string, string>): Promise<SignHeaders> {
  const res = await fetch(SIGN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url, headers }),
    signal: AbortSignal.timeout(90_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`签名服务 HTTP ${res.status}：${text.slice(0, 200)}`)
  try {
    return JSON.parse(text) as SignHeaders
  } catch {
    throw new Error(`签名服务返回无效：${text.slice(0, 200)}`)
  }
}

/** 等 Java 服务起来（首签前 unidbg 需要初始化模拟器，可能要十几秒） */
async function waitReady(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!state.proc || state.proc.exitCode != null || state.proc.signalCode) {
      throw new Error(state.lastError || '签名服务进程已退出')
    }
    try {
      await postSign('https://api5-normal-sinfonlinea.fqnovel.com/reading/bookapi/search/tab/v?aid=8662', {})
      return
    } catch {
      await new Promise((r) => setTimeout(r, 800))
    }
  }
  throw new Error(state.lastError || `签名服务就绪超时（${Math.round(timeoutMs / 1000)}s）`)
}

/** 请求一个签名；内部保证串行 + 失败自动重启一次 */
export function sign(url: string, headers: Record<string, string>): Promise<SignHeaders> {
  const task = state.chain.then(async () => {
    try {
      if (!state.proc) startJava()
      if (!state.ready) {
        await waitReady(180_000)
        state.ready = true
      }
      const signed = await postSign(url, headers)
      state.lastError = null
      return signed
    } catch (first) {
      state.ready = false
      state.proc?.kill()
      state.proc = null
      // Java 不可用时不要再空等一轮
      const msg = first instanceof Error ? first.message : String(first)
      if (/未找到可用的 Java|签名运行时缺失|签名服务无法启动|签名服务退出/.test(msg)) {
        state.lastError = msg
        throw first
      }
      try {
        startJava()
        await waitReady(180_000)
        state.ready = true
        return await postSign(url, headers)
      } catch (second) {
        state.lastError = second instanceof Error ? second.message : String(second)
        throw second
      }
    }
  })
  state.chain = task.catch(() => undefined)
  return task
}
