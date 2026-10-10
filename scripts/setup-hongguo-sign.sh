#!/usr/bin/env bash
# 一次性准备红果网页版的签名运行时（macOS x64）。
# 幂等：已存在的步骤会跳过。用法：bash scripts/setup-hongguo-sign.sh
set -euo pipefail

# 默认写入项目根 hongguo-work（与 public/server 同级）；可用 HG_WORK 覆盖
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${HG_WORK:-$ROOT/hongguo-work}"
VERSION=68132
JAR_URL="https://github.com/waligoraamodio288-rgb/hongguo-desktop-releases/releases/download/v1.0.4/hongguo-1.0.4-third-party-sources.zip"
SRC_REPO="https://codeload.github.com/zhangbaio/hongguo/zip/5f8a58d10f48954bc9b6a58c9cd6418bf499feb9"

mkdir -p "$WORK"
cd "$WORK"

step() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }

step "1/6 JDK 17"
if [ ! -x "$WORK/jdk17/Contents/Home/bin/java" ]; then
  curl -fL --retry 2 -o corretto17.tar.gz \
    "https://corretto.aws/downloads/latest/amazon-corretto-17-x64-macos-jdk.tar.gz"
  rm -rf jdk17 && mkdir jdk17 && tar xzf corretto17.tar.gz -C jdk17 --strip-components=1
else
  echo "已存在，跳过"
fi

step "2/6 unidbg 签名 jar（内含 macOS x64 的 unicorn natives）"
if [ ! -f "$WORK/sign/unidbg-sign.jar" ]; then
  mkdir -p sign
  curl -fL --retry 2 -o sources.zip "$JAR_URL"
  unzip -q -o sources.zip -d sources_tmp || true   # 只为满足许可证随包
  rm -rf sources_tmp
  echo "注意：该 zip 是第三方源码声明，不含 jar。"
  echo "请从 zhangbaio/hongguo 的 windows-package-src/sign/ 取 unidbg-sign.jar，"
  echo "放到 $WORK/sign/（步骤 3 会自动下载源码树并抽取）。"
fi

step "3/6 源码树 + metasec 工件"
if [ ! -f "$WORK/capture/fq_oversea/libmetasec_ml.so" ]; then
  curl -fL --retry 2 -o src.zip "$SRC_REPO"
  WORK="$WORK" python3 - <<'PY'
import zipfile, os, shutil
work = os.environ['WORK']
z = zipfile.ZipFile(os.path.join(work, 'src.zip'))
root = 'hongguo-5f8a58d10f48954bc9b6a58c9cd6418bf499feb9/'
want = ['windows-package-src/sign/', 'windows-package-src/capture/fq_oversea/', 'unidbg-sign/src/']
out = os.path.join(work, 'hg')
n = 0
for i in z.infolist():
    if not i.filename.startswith(root):
        continue
    rel = i.filename[len(root):]
    if not any(rel.startswith(w) for w in want):
        continue
    tgt = os.path.join(out, rel)
    if i.filename.endswith('/'):
        os.makedirs(tgt, exist_ok=True); continue
    os.makedirs(os.path.dirname(tgt), exist_ok=True)
    with z.open(i) as s, open(tgt, 'wb') as o:
        shutil.copyfileobj(s, o)
    n += 1
print('extracted', n)
PY
  mkdir -p sign capture/fq_oversea
  cp hg/windows-package-src/sign/unidbg-sign.jar sign/
  cp hg/windows-package-src/capture/fq_oversea/* capture/fq_oversea/
else
  echo "已存在，跳过"
fi

step "4/6 编译 macOS 专用 FqTrace（Unicorn1 后端，避开 Unicorn2 的 SIGBUS）"
if [ ! -f "$WORK/build/out/com/hongguo/sign/FqTrace.class" ]; then
  mkdir -p build
  WORK="$WORK" python3 - <<'PY'
import os
p = os.path.join(os.environ['WORK'], 'hg/unidbg-sign/src/main/java/com/hongguo/sign/FqTrace.java')
s = open(p, encoding='utf-8').read()
old = """        emulator = AndroidEmulatorBuilder.for64Bit()
                .addBackendFactory(new com.github.unidbg.arm.backend.Unicorn2Factory(true))  // Unicorn2: Linux x64 自洽 native
                .setProcessName(PKG).build();"""
new = """        // macOS: Unicorn2 的 libunicorn.dylib 在 emu_start 阶段 SIGBUS；改用默认 Unicorn1 后端
        emulator = AndroidEmulatorBuilder.for64Bit()
                .setProcessName(PKG).build();"""
if old not in s:
    print('已打过补丁或源码结构不同，跳过改写')
else:
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    print('patched FqTrace -> Unicorn1')
PY
  mkdir -p build/out
  "$WORK/jdk17/Contents/Home/bin/javac" -nowarn \
    -cp "$WORK/sign/unidbg-sign.jar" \
    -d "$WORK/build/out" \
    "$WORK/hg/unidbg-sign/src/main/java/com/hongguo/sign/FqTrace.java"
else
  echo "已存在，跳过"
fi

step "5/6 裁剪自带 jre（jlink，部署免装 JDK）"
# 只保留 unidbg 实际依赖的模块；少一个就会在运行期 NoClassDefFoundError，
# 这里的清单由 hongguo-work/jre 反推确认（见 README-stream.md「自带 JRE」）。
JLINK_MODULES="java.base,java.logging,java.management,java.xml,jdk.httpserver"
if [ ! -x "$WORK/jre/bin/java" ]; then
  "$WORK/jdk17/Contents/Home/bin/jlink" \
    --add-modules "$JLINK_MODULES" \
    --strip-debug --no-header-files --no-man-pages --compress=2 \
    --output "$WORK/jre"
  # jlink 在 macOS 上产出扁平结构 <out>/bin/java，与 signService 的探测顺序一致
  echo "已生成 $(du -sh "$WORK/jre" | cut -f1) 的裁剪运行时（完整 jdk17 为 $(du -sh "$WORK/jdk17" | cut -f1)）"
else
  echo "已存在，跳过"
fi

step "6/6 冒烟测试"
HG_JAVA="$WORK/jre/bin/java"; [ -x "$HG_JAVA" ] || HG_JAVA="$WORK/jdk17/Contents/Home/bin/java"
[ -x "$HG_JAVA" ] || { echo "❌ 没有可用的 java，先跑完步骤 1/6"; exit 1; }
# cwd 必须是 sign/：FqTrace 按 ../capture/fq_oversea/ 相对定位 metasec 工件
# （server/hongguo/signService.ts 同样以 signDir 为 cwd 启动）
( cd "$WORK/sign" && exec "$HG_JAVA" --add-opens java.base/java.lang=ALL-UNNAMED \
  -cp "$WORK/build/out:$WORK/sign/unidbg-sign.jar" \
  com.hongguo.sign.FqTrace serve 9099 ) > "$WORK/sign-smoke.log" 2>&1 &
SMOKE_PID=$!
trap 'kill $SMOKE_PID 2>/dev/null || true' EXIT

# 必须等「签名工作线程就绪」——「服务已启动」只代表 HTTP 已监听，
# 模拟器仍在后台线程里加载 libmetasec_ml.so，早一步请求必然失败
for _ in $(seq 1 90); do
  if grep -q "签名工作线程就绪" "$WORK/sign-smoke.log" 2>/dev/null; then break; fi
  sleep 2
done

RESP=$(curl -s -m 120 -X POST http://127.0.0.1:9099/sign \
  -H 'content-type: application/json' \
  -d '{"url":"https://api5-normal-sinfonlineb.fqnovel.com/reading/bookapi/search/tab/v?aid=1967","headers":{"user-agent":"com.dragon.read.oversea.gp/68132"}}' || true)

if echo "$RESP" | grep -q "X-Argus"; then
  echo "✅ 签名服务正常（拿到 X-Argus / X-Gorgon …）"
else
  echo "❌ 签名失败，见 $WORK/sign-smoke.log"
  echo "$RESP" | head -c 300
  exit 1
fi