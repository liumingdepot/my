# 用 Node 替代 unidbg + JVM：可行性实测

结论先行：**可行，且实测工作量比最初估计低一个档**。关键数据都在下面，
跑 `bash scripts/hongguo-trace/run.sh` 可复现。

> 本文只讨论「去掉 Java 运行时」，不讨论「去掉 unidbg 直接算签名」——
> 后者需要从 so 里 dump 密钥派生链，红果升版本即废，不建议。

## 为什么 Java 能被拆掉

`signService.ts` 拉起 JVM 跑 `unidbg-sign.jar`，但真正干活的**不是 Java**：

| 层 | 实际执行者 | 换成 Node 的成本 |
| --- | --- | --- |
| ARM64 CPU 模拟 | **Unicorn Engine（C）** | 低 —— 但**不能用 jar 自带的**，见下 |
| ELF 装载 / 重定位 / linker | unidbg（Java，982 个 class / 2.8 MB 字节码） | 要重写，但只用到一小块 |
| bionic syscall | unidbg | 要重写，见下方实测 |
| JNI 回调 | unidbg `AbstractJni` | 要重写，但**极小** |

两个关键的有利事实：

1. **jar 里没有任何 `.dex` / `.apk`**，且用的是 `createDalvikVM()` 无参重载。
   所以**不需要实现 Dalvik 字节码解释器**，只要把 JNI 回调打成字符串键的桩。
2. **metasec 完全没有调用 `AndroidModule` / `JniGraphics` 的任何 JNI**。
   unidbg 的虚拟模块（Context / ActivityThread / Bitmap / 图形栈）一个都没用上，
   这一大块可以直接砍掉。

## ⚠️ 纠正：jar 自带的 Unicorn 不能直接用

第一版评估里写过「jar 里有 `natives/<plat>/libunicorn.dylib`，是无 JNI 依赖的纯
Unicorn，Node 直接 dlopen 即可」。**实测证伪**，别按那条路走：

| 文件 | 实测结果 |
| --- | --- |
| `natives/<plat>/libunicorn.dylib` | C 和 Node 直接调，`uc_emu_start` 必崩（SIGUSR1 / EXC_BAD_ACCESS，PC 落在 `0xffffffffa9025cf5`） |
| `natives/<plat>/libunicorn_java.dylib` | 不崩，但 `uc_reg_read` 对任何寄存器号都恒返回 0，等于残废 |

原因：对一个跑着的签名 JVM 做 `lsof`，它**只加载 `libunicorn_java.dylib`，
根本不碰 `libunicorn.dylib`**。而 `unicorn.Unicorn` 类里 `emu_start` / `reg_read`
全是 `native` 方法 —— 引擎只经 `Java_unicorn_Unicorn_*` 走 JNI 抵达，
那两份 dylib 导出的 `uc_*` C 符号并不是可用的 C API。

**结论**：改用上游官方 Unicorn。`bash scripts/setup-hongguo-unicorn.sh` 下载，
Node → koffi → 官方 Unicorn → ARM64 闭环已验证通过（`scripts/hongguo-emu-smoke.mjs`）。

好消息：**官方 Unicorn 的 ARM64 寄存器编号与 unidbg 的 `unicorn.Arm64Const` 完全一致**
（`X0=199 … X8=207 … PC=260`），所以下面这份 syscall 清单可以直接当验收标准，不用重测。

写这层时踩的坑都固化在 `server/hongguo/emu/unicorn.ts` 注释里了：

- 寄存器号不是 `0..31` 而是 `X0=199`（按 `66` 读会拿到一堆 0，很容易误判成「模拟器没跑」）
- MOVZ 的 `imm16` 在 `bit20:5`，编码是 `0xd2800000 | (imm16 << 5) | Rd`
- **koffi 必须先绑定 `uc_version`**，否则后面调 `uc_open` 会 SIGUSR1 杀掉整个进程

## 实测数据

数据来自 `scripts/hongguo-trace/run.sh`：从 jar 的 `FqTrace` 派生一个
`TraceRun`，挂额外的 `InterruptHook` 在 SVC 时读 x8 记录 syscall 号，
跑一次真实签名。

### 1. syscall：**22 个**

| nr | 名称 | 次数 | nr | 名称 | 次数 |
|---:|---|---:|---:|---|---:|
| 98 | `futex` | 98 | 57 | `close` | 3 |
| 226 | `mprotect` | 26 | 63 | `read` | 3 |
| 178 | `gettid` | 26 | 220 | `clone` | 3 |
| 113 | `clock_gettime` | 13 | 174 | `getuid` | 2 |
| 222 | `mmap` | 10 | 66 | `writev` | 2 |
| 215 | `munmap` | 6 | 214 | `brk` | 1 |
| 167 | `prctl` | 5 | 169 | `getcwd` | 1 |
| 172 | `getpid` | 5 | 198 | `socket` | 1 |
| 56 | `openat` | 4 | 25 | `fcntl` | 1 |
| 48 | `faccessat` | 4 | 203 | `connect` | 1 |
| 80 | `fstat` | 3 | 173 | `getppid` | 1 |

几个要注意的：

- `futex` 占 43%，但全是 pthread 同步原语，**只要实现 WAIT/WAKE，不要真阻塞**。
- `mprotect` 26 次 = 自修改代码，`uc_mem_protect` 必须真的生效。
- `socket` + `connect` 各 1 次 = 环境探测，返回失败让它走降级路径即可。
- 没有 `ptrace`、没有 `fork`、没有 `/proc/self/*` 的实际读取 —— so 里虽然
  导入了这些符号，但这条签名路径上没走。
- **覆盖范围警告**：这是单次单 URL 的签名。换 URL / 换设备 / 服务端改协议后
  可能走到别的分支（例如错误路径上的网络探测）。落地时应以「跑通为基线，
  出错再补」的方式迭代，不要假设清单封闭。

### 2. JNI：**14 个函数**

```
FindClass          GetSuperClass        RegisterNatives      GetStaticMethodID
GetMethodID        CallStaticObjectMethodV                   CallObjectMethodV
CallLongMethodV    NewStringUTF         GetStringUtfChars    ReleaseStringUTFChars
GetArrayLength     GetByteArrayRegion   GetObjectArrayElement
```

Java 侧只需实现这 14 个。`FqTrace` 已覆盖的全部回调：

| 回调 | 行为 |
| --- | --- |
| `MS.b(0x10003)` | 返回 `files/.msdata` 路径字符串 |
| `MS.b(0x2000001/2)` | 返回 `true` |
| `MS.b(0x1000011)` | 返回版本号 `"6.8.1.32"` |
| `MS.b(0x1000010)` | 返回 `Integer(68132)`（version_code） |
| `MS.b(0x100000e)` | 返回 `Long(System.currentTimeMillis())` |
| `MS.b(0x1000012)` | 返回 APK 签名证书字节（`ms_16777218.bin`） |
| `MS.a()V` | `getStaticIntField` 返回 `0x40` |
| `Thread->currentThread/getStackTrace/getBytes` | 给一组固定的 Java 栈帧 |

### 3. 文件访问：**5 个真实路径**

```
/dev/__properties__   （android 属性表，__system_property_find/read 会查）
/proc/stat            1871 字节
/dev/urandom          4096 字节
stdin / stdout / stderr
```

`.msdata` 的**路径字符串被取了、也 hash 了，但文件从未被打开** —— 不需要实现
应用私有目录的文件系统。

### 4. 依赖：**227 个外部符号，但不用自己实现**

`libmetasec_ml.so` 的 `NEEDED` 只有：

```
liblog.so  libandroid.so  libm.so  libdl.so  libc.so
```

- **不需要 `libc++_shared.so`**：C++ 运行时是静态链进 metasec 自己的
  （`FqTrace` 里那句 `loadLibrary(cpp)` 其实是多余的）。
- 227 个未定义符号绝大多数是 libc 常规函数。这些**照旧从 jar 里
  `android/sdk23/lib64/` 的 bionic sysroot so 加载**到 Unicorn —— 和 unidbg
  现在做的一样，不需要重写 libc，只需要实现它下面的 syscall 层。

符号闭包实测（`scripts/hongguo-elf-loader-check.mjs`）：

```
libmetasec_ml.so  未定义 226  →  全部解析成功
libc.so           未定义   4  →  全部解析成功
libm.so           未定义  14  →  全部解析成功
liblog.so         未定义  74  →  全部解析成功
libdl.so          未定义   3  →  全部解析成功
全局符号 1501 个
```

**唯一解析不了的 10 个全是 `libandroid.so` 的**（jar 里根本没有这个库，
unidbg 是靠 `AndroidModule` 提供桩的）：

```
ALooper_forThread  ALooper_pollOnce  ALooper_prepare
ASensorEventQueue_{disableSensor,enableSensor,getEvents}
ASensorManager_{createEventQueue,destroyEventQueue,getDefaultSensor,getInstance}
```

这 10 个做成返回 0 的桩即可 —— 它们是传感器/事件循环探测，metasec 只是读它们
判断「有没有真实传感器」，探测不到才是这台机器该有的答案。

### 5. 重定位：**只有 4 种类型**

`scripts/hongguo-trace/reloinfo.py` 在真实工件上统计（不是猜）：

| 类型 | 数量 | 处理方式 |
| --- | ---: | --- |
| `R_AARCH64_RELATIVE` | 9100 | `*loc = base + addend`，一行搞定 |
| `R_AARCH64_JUMP_SLOT` | 910 | 写 `*loc = 符号地址`（全量绑定，见下） |
| `R_AARCH64_ABS64` | 164 | `*loc = 符号地址 + addend` |
| `R_AARCH64_GLOB_DAT` | 40 | 写 `*loc = 符号地址` |

`COPY` / `IRELATIVE` / `TLS_*` 一个都没有。全部 DT_INIT 也是空的，只有
`DT_INIT_ARRAY`（metasec 有 113 个构造器）。

**全量绑定**：JUMP_SLOT 直接写真实地址，不走 lazy binding。aarch64 的 PLT stub
本身是 `adrp/ldr/br` 走 GOT 的，把 GOT 槽写实就等于提前完成绑定，语义等价，
但省掉整个 `dl_runtime`。

**必须两遍**：这批 so 有环状依赖 —— `libdl.so` 标称无 NEEDED，但它 undefined 的
`__cxa_finalize` / `__register_atfork` / `__cxa_atexit` 实际住在 `libc.so` 里，
而 `libc.so` 又 NEEDED `libdl.so`。所以「装载即重定位」的单遍写法必然有一边找不到
符号。正确做法是先建全量符号表，再统一重定位（真实 linker 也是这么干的）。

## 重估后的工作量

| 模块 | 行数 | 说明 |
| --- | ---: | --- |
| `koffi` ↔ Unicorn 绑定 | 300–500 | `uc_open` / `emu_start` / `mem_map` / `hook_add` / `reg_read` ✅ 已完成 |
| ELF64 loader + 重定位 | 600–900 | 含 TLS ✅ 已完成（实测只需 4 种重定位类型） |
| bionic syscall 层 | **500–700** | 只要 22 个 syscall，比原估的 800–1500 少 |
| JNI 桩 | **200–300** | 14 个函数，无 dex，比原估的 400–700 少 |
| FqTrace 等价逻辑 | 200–300 | inode 表、uid、libs、sign 入口 `0x168C80` |
| 调试 / trace | 300 | `scripts/hongguo-trace/` 已覆盖 |
| **合计** | **~2.2–3k** | 原估 3–5k |

配合第 1 步的裁剪 JRE（33 MB，部署免装 JDK），结论从「1–3 周」收敛到
**「1–2 周」**。

## 风险

| 风险 | 说明 | 缓解 |
| --- | --- | --- |
| macOS Unicorn2 SIGBUS | jar 自带的 `FqTrace` 在 macOS 上必崩，要退回 Unicorn1 | 直接用 `natives/osx_arm64/libunicorn.dylib` 的 v1 API |
| syscall 清单不封闭 | 只测了一条签名路径 | 灰度对比：Node 版与 Java 版对同一批 URL 出签名，服务端验签 + 本地 diff 双保险 |
| `mprotect` 自修改代码 | 26 次调用 | `uc_mem_protect` 必须真实生效，不能虚拟化 |
| 时钟类防重放 | `clock_gettime` 13 次、`gettid` 26 次 | 必须单调递增且带真实间隔，不能全部返回常数 |

## 进度

| 步骤 | 状态 |
| --- | --- |
| 部署免装 JDK（jlink 裁剪 JRE） | ✅ 已完成，见 `README-stream.md`「自带 JRE」 |
| 抓 syscall / JNI / 依赖 / 重定位清单 | ✅ 已完成，`scripts/hongguo-trace/run.sh` 可复现 |
| 验证 Java 基线真的能用 | ✅ 已完成，见文末 |
| CPU 模拟层（Unicorn + koffi） | ✅ `server/hongguo/emu/unicorn.ts` |
| ELF 解析 + 装载 + 重定位 | ✅ `server/hongguo/emu/{elf,loader}.ts` |
| bionic syscall 层（22 个） | ⬜ 下一块 |
| JNI 层（14 个函数） | ⬜ |
| 跑 `.init_array` → `JNI_OnLoad` | ⬜ |
| 与 Java 版签名逐字节比对 | ⬜ |

自检脚本：

```bash
node --experimental-strip-types scripts/hongguo-emu-smoke.mjs         # CPU 层
node --experimental-strip-types scripts/hongguo-elf-check.mjs         # ELF 解析
node --experimental-strip-types scripts/hongguo-elf-loader-check.mjs   # 装载 + 重定位
```

## 建议

装载层已经通了（5 个 so + 1 个桩库，226 个符号全解析，10214 条重定位全部落地，
回读校验一致，33ms）。**接下来唯一挡路的是 syscall 层** —— 从 `.init_array` 开始
执行 metasec 的构造器时，第一件事就会 `mmap`/`futex`，没有 syscall 层寸步难行。

好消息是 syscall 清单已经完全确定（22 个，见上），不用再探测：
按「先 `mmap`/`brk`/`futex`/`mprotect` 这几个高频的 → 再 `openat`/`read`/`fstat`
那 5 个路径 → 最后 `socket`/`connect` 这两个探测」分三批加，每加一批跑一次
`.init_array` 看能不能往下走。

**暂时不做也行**：当前 Java 链路已验证可用，签名服务瓶颈是单模拟器串行，
不是 JVM 本身。

## 基线验证

改任何东西之前先确认签名是真的能用，别在坏基线上开发：

```
[search/tab (GET, 签名)]            HTTP 200  code=100103 PARAM_INVALID  ← 签名过了，是缺参数
[multi_video_model (POST, 签名)]    HTTP 200  code=0 请求成功            ← 真正取到播放信息
```

`PARAM_INVALID` 是结构化业务错误，**说明网关已经放行签名**。
真正的签名失败是 `HTTP 200 + 空 body`（见 `README-stream.md`「设备身份不能乱改」）。

顺带一个坑：sign 过程中 metasec 会打两行
`Fatal: SDK not init, crashing...`，但**签名照样正常产出**。
这是内部降级路径的噪音，不影响结果 —— 别把它当故障去修。