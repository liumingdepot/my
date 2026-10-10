#!/usr/bin/env bash
# 下载**官方** Unicorn Engine 到 hongguo-work/emu/unicorn。
#
# 为什么不用 unidbg-sign.jar 里自带的那两份：
#   libunicorn.dylib       → uc_emu_start 直接段错误 / SIGUSR1
#   libunicorn_java.dylib  → uc_reg_read 对任何寄存器号都返回 0（不可用）
# unidbg 只走 JNI（Java_unicorn_Unicorn_*），它的 uc_* C 符号不是可用的 C API。
# 详见 server/hongguo/emu/unicorn.ts 顶部说明。
#
# 幂等：已存在则跳过。用法：bash scripts/setup-hongguo-unicorn.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${HG_EMU_DIR:-$ROOT/hongguo-work/emu/unicorn}"
VERSION="${HG_UNICORN_VERSION:-2.1.4}"

case "$(uname -s)/$(uname -m)" in
  Darwin/arm64) ASSET="macos-arm64-cmake-shared-x64.7z"; LIB="lib/libunicorn.dylib" ;;
  Darwin/x86_64) ASSET="macos-x64-cmake-shared-x64.7z"; LIB="lib/libunicorn.dylib" ;;
  Linux/aarch64)  ASSET="ubuntu-cmake-aarch64.7z";      LIB="lib/libunicorn.so" ;;
  Linux/x86_64)   ASSET="ubuntu-cmake-shared-x86_64.7z"; LIB="lib/libunicorn.so" ;;
  *) echo "❌ 暂不支持 $(uname -s)/$(uname -m)，请手动下载 https://github.com/unicorn-engine/unicorn/releases"; exit 1 ;;
esac

if [ -e "${DEST}/${LIB}" ]; then
  echo "✅ 已存在 ${DEST}/${LIB}，跳过下载"
  HG_UNICORN="${DEST}/${LIB}" node --experimental-strip-types "$ROOT/scripts/hongguo-emu-smoke.mjs"
  exit $?
fi

printf '\n\033[1;36m== 下载官方 Unicorn %s\033[0m\n' "$VERSION"
mkdir -p "$DEST"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

URL="https://github.com/unicorn-engine/unicorn/releases/download/${VERSION}/${ASSET}"
curl -fL --retry 2 -o "$TMP/u.7z" "$URL"

printf '\033[1;36m== 解压\033[0m\n'
# 7za 在 npm 包里带二进制，pnpm 安装后不保留可执行位，这里显式补上
SEVENZA="$("$ROOT/node_modules/.bin/7za" 2>/dev/null || true)"
if [ -z "$SEVENZA" ]; then
  SEVENZA="$(node -e "process.stdout.write(require('${ROOT}/node_modules/7zip-bin').path7za)")"
fi
chmod +x "$SEVENZA"
"$SEVENZA" x -y -o"$DEST" "$TMP/u.7z" >/dev/null

if [ ! -e "${DEST}/${LIB}" ]; then
  echo "❌ 解压后没找到 $LIB，实际内容："
  find "$DEST" -name 'libunicorn*' | head
  exit 1
fi

printf '\n\033[1;36m== 冒烟测试\033[0m\n'
HG_UNICORN="${DEST}/${LIB}" node --experimental-strip-types "$ROOT/scripts/hongguo-emu-smoke.mjs"

echo "✅ Unicorn 就绪：${DEST}/${LIB}"
echo "   可用 HG_UNICORN 覆盖路径"