#!/usr/bin/env bash
# 抓红果 metasec 的 syscall / JNI / 依赖清单 —— 用来评估「用 Node 替代 unidbg+JVM」的可行性。
#
# 原理：从 unidbg-sign.jar 的 FqTrace 派生出 TraceRun：
#   1. 摘掉 Unicorn2Factory（macOS 上 libunicorn.dylib 在 emu_start 阶段必 SIGBUS）
#   2. 挂一个额外的 InterruptHook，SVC 时读 x8(=207) 记录 syscall 号
#   3. 打开 syscall/JNI verbose
# 跑一次签名，把原始 trace 和汇总表打出来。
#
# 用法:
#   bash scripts/hongguo-trace/run.sh                 # 全部
#   bash scripts/hongguo-trace/run.sh --deps-only     # 只出 ELF 导入表（不跑 JVM）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${HG_WORK:-$ROOT/hongguo-work}"
OUT="$WORK/trace"
SRC_URL="https://codeload.github.com/zhangbaio/hongguo/zip/5f8a58d10f48954bc9b6a58c9cd6418bf499feb9"

step() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }

step "1/5 ELF 导入/导出表（libmetasec_ml.so 真正依赖哪些外部符号）"
python3 "$ROOT/scripts/hongguo-trace/elfdeps.py" \
  "$WORK/capture/fq_oversea/libmetasec_ml.so" | tee "$OUT-deps.md" 2>/dev/null \
  || { mkdir -p "$(dirname "$OUT")"; python3 "$ROOT/scripts/hongguo-trace/elfdeps.py" \
       "$WORK/capture/fq_oversea/libmetasec_ml.so" | tee "$OUT-deps.md"; }
if [ "${1:-}" = "--deps-only" ]; then echo "\n（--deps-only，跳过 JVM trace）"; exit 0; fi

step "2/5 取 FqTrace 源码"
mkdir -p "$OUT"
FQ="$OUT/FqTrace.java"
if [ ! -f "$FQ" ]; then
  curl -fsSL --max-time 120 -o "$WORK/src.zip" "$SRC_URL"
  unzip -o -q "$WORK/src.zip" "*/unidbg-sign/src/main/java/com/hongguo/sign/FqTrace.java" -d "$WORK"
  mv "$WORK"/hongguo-*/unidbg-sign/src/main/java/com/hongguo/sign/FqTrace.java "$FQ"
  rm -rf "$WORK"/hongguo-*
fi
echo "$FQ"

step "3/5 派生 TraceRun.java"
FQ="$FQ" OUT="$OUT" python3 - <<'PY'
import os
src = open(os.environ['FQ'], encoding='utf-8').read()
src = src.replace('public class FqTrace extends', 'public class TraceRun extends')
src = src.replace('public FqTrace()', 'public TraceRun()')
src = src.replace('FqTrace t = new FqTrace();', 'TraceRun t = new TraceRun();')
# macOS 必须用 Unicorn1
src = src.replace(
    '                .addBackendFactory(new com.github.unidbg.arm.backend.Unicorn2Factory(true))'
    '  // Unicorn2: Linux x64 自洽 native\n', '')
# syscall 号追踪
src = src.replace('        emulator.getSyscallHandler().setVerbose(false);',
                  '        installSyscallTracer();\n'
                  '        emulator.getSyscallHandler().setVerbose(true);', 1)
src = src.replace('        vm.setVerbose(false);', '        vm.setVerbose(true);')

TRACER = '''
    /** 挂一个额外的 InterruptHook，SVC 时读 x8(=UC_ARM64_REG_X8) 记录 syscall 号。
     *
     *  两个坑：
     *  1) reg 号 207 硬编码，避免依赖 unicorn 的 ArmConst 常量；
     *  2) Unicorn 的 UC_HOOK_INTR 是「追加」不是「替换」，所以这里只能观测、
     *     绝不能把事件再委托回 unidbg 的 syscall handler —— 一次 SVC 会被分发两遍，
     *     模拟器状态直接错乱（JNI_OnLoad 返回 0xffffffff，callJNI_OnLoad 抛
     *     IllegalStateException: Illegal JNI version）。
     */
    private void installSyscallTracer() {
        try {
            emulator.getBackend().hook_add_new(new com.github.unidbg.arm.backend.InterruptHook() {
                public void hook(com.github.unidbg.arm.backend.Backend b, int intno, int cpsr, Object user) {
                    if (intno != 2) return;   // INTR_SVC
                    try { System.out.println("@@SYS " + b.reg_read(207).intValue()); }
                    catch (Throwable ignore) { }
                }
                public void onAttach(com.github.unidbg.arm.backend.UnHook unHook) { }
                public void detach() { }
            }, null);
        } catch (Throwable e) {
            System.out.println("@@TRACER_FAIL " + e);
        }
    }
'''
src = src.replace('    static final java.util.Map<Long, Integer> READS',
                  TRACER + '\n    static final java.util.Map<Long, Integer> READS', 1)
open(os.path.join(os.environ['OUT'], 'TraceRun.java'), 'w', encoding='utf-8').write(src)
print('generated TraceRun.java')
PY

step "4/5 编译 + 跑一次签名"
JAVA="$WORK/jdk17/Contents/Home/bin/java"
JAVAC="$WORK/jdk17/Contents/Home/bin/javac"
[ -x "$JAVA" ] || JAVA="$WORK/jre/bin/java"
[ -x "$JAVA" ] || { echo "❌ 先跑 bash scripts/setup-hongguo-sign.sh"; exit 1; }
"$JAVAC" -nowarn -cp "$WORK/sign/unidbg-sign.jar" -d "$OUT/out" "$OUT/TraceRun.java" 2>&1 | grep -v '^注:' || true

URL="https://api5-normal-sinfonlineb.fqnovel.com/reading/bookapi/search/tab/v?aid=1967"
# cwd 必须是 sign/：FqTrace 按 ../capture/fq_oversea/ 相对定位 metasec 工件
( cd "$WORK/sign" && "$JAVA" --add-opens java.base/java.lang=ALL-UNNAMED \
    -cp "$OUT/out:$WORK/sign/unidbg-sign.jar" com.hongguo.sign.TraceRun \
    "$URL" 'user-agent\r\ncom.dragon.read.oversea.gp/68132' ) > "$OUT/trace.log" 2>&1
echo "rc=$?  syscall 事件 $(grep -c '@@SYS' "$OUT/trace.log")  →  $OUT/trace.log"

step "5/5 汇总 syscall 覆盖"
python3 "$ROOT/scripts/hongguo-trace/syscalls.py" "$OUT/trace.log" | tee "$OUT-syscalls.md"
printf '\n产物: %s-deps.md  %s-syscalls.md  %s/trace.log\n' "$OUT" "$OUT" "$OUT"