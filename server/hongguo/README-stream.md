# 红果网页版（/test）

搜索 + **全集**播放的网页版红果短剧。放在 `src/pages/测试`，接口挂 `/api/test`。

## 为什么需要一套额外运行时

网页源（hongguoduanju.com）只开放每部剧前 3 集试看；要拿全集播放地址，
必须走 App 的 `fqnovel` 接口，而它的每个请求都要 **metasec 签名**
（X-Argus / X-Gorgon / X-Khronos …），只能由 unidbg 模拟红果的原生库算出。

于是分成三段，各干各擅长的事：

| 环节 | 位置 | 说明 |
| --- | --- | --- |
| 目录 / 搜索 / 集数列表 | `server/hongguo/hongguo.ts` | 网页源，拿得到**全集 vid** |
| 播放地址 | `fqapi.ts` + `signService.ts` | App 接口签名，给全部集数下发直链 |
| 下载 / 解密 / 串流 | `media.ts` + `spade.ts` `mp4.ts` `decrypt.ts` `demux.ts` | 服务端解密 CENC 后直送浏览器 |

两边共用同一套 vid，所以能拼起来。

## 视频为什么要服务端解密

红果的 mp4 是 **CENC / AES-128-CTR** 加密的，浏览器放不了：

```
video_model.encrypt_info.spade_a  ──unwrapV1()──▶ content key(16B)
密文 mp4 + senc 首样本 IV          ──AES-128-CTR──▶ 明文样本
```

- `spade.ts`：纯字节变换（XOR + POPCOUNT + 位置相关），无 KEK 无 AES，5 组真值自测
- `decrypt.ts`：逐样本计数器 `((base_iv + n) << 64)`，视频按 NAL 结构自证
- `demux.ts`：解密后还留着 `encv/sinf/senc/saiz/saio` 信令，浏览器会拒播，
  这里重建 moov 去掉它们（`encv`→`hvc1`、`enca`→`mp4a`），
  并用 `free` 盒把 moov 补回原长度 —— `stco` 里是绝对偏移，mdat 一旦位移就全废

首播要先处理整集（5~18MB，实测 1~3 秒），之后走缓存 + Range 拖动。

## HLS 分片与 Cloudflare 穿透

整文件 Range 在高延迟链路（cloudflared 隧道）上不友好：播放器要么等整集到位，
要么拖一次就重拉一大段。所以解密完再切一刀：

```
明文 mp4 ──ffmpeg -c copy──▶ init.mp4 + seg000.mp4 … （fMP4，约 3s/片）
```

- `hls.ts` 负责切片，`media.ts` 的 `ensureHls()` 在 mp4 落盘后自动调用；
  成功则 `/play` 返回 `mediaType: 'hls'`、`/stream?…&seg=index.m3u8`，
  失败静默回退整文件 mp4 + Range，播放不受影响
- **依赖本机 ffmpeg**：`HG_FFMPEG` / `hongguo-work/bin/ffmpeg` / PATH 都找不到就退回 mp4。
  `resolveFfmpeg()` 会实际执行一次 `ffmpeg -version` 验证，不会把裸 PATH 名当命中
- 预热：进详情页和每次切集都会 `GET /api/hongguo/prefetch?episode_id=`，
  服务端后台把该集「下载 + 解密 + 切片」整条做完（`prefetchEpisode()`），
  等真正播到时通常已经就绪

### ⚠️ 分片默认不会被 Cloudflare 缓存

分片走 `/api/hongguo/stream?…&seg=seg000.m4s`，路径 `/api/hongguo/stream` **没有文件后缀**，
而 Cloudflare 的默认缓存规则只按 URL 路径后缀匹配（`.m4s` 不在列表，`.mp4` 在——
但 query 里的后缀不算数）。所以默认配置下每个分片仍然每次穿透隧道，
响应里的 `cache-control: public, max-age=3600` 形同虚设。

必须**手动加一条 Cache Rule**（dashboard → Caching → Cache Rules）：

| 项 | 值 |
| --- | --- |
| 条件 | `http.request.uri.path eq "/api/hongguo/stream"` **且** `http.request.uri.query contains "seg="` |
| Cache eligibility | Eligible for cache |
| Edge TTL | 用 `cache-control` 里的值（1 小时） |

`seg=` 这个条件是必须的：同一条路由的 `seg=index.m3u8` 是 playlist，
缓存 1 小时会让新切片要等很久才生效。

> 另一个思路：把分片挪到带后缀的路径（如 `/api/hongguo/seg/<vid>/seg000.m4s`），
> 蹭 Cloudflare 默认规则免配 dashboard。代价是多一条路由 + 要改 `rewritePlaylist()`，
> 暂时没做。


## 运行时准备（一次性）

签名服务需要 **Java 17** + 项目内 unidbg 组件。运行时在项目根
（与 `public`、`server` 同级）：

```
hongguo-work/
  jre/                      # jlink 裁剪的自带运行时（~33M，部署免装 JDK）
  jdk17/                    # macOS 便携 Corretto 17（~310M，Windows 请装系统 JDK）
  sign/unidbg-sign.jar      # 预编译签名服务
  capture/fq_oversea/       # libmetasec_ml.so / libc++_shared.so / ms_16777218.bin
  build/out/                # 打过补丁的 FqTrace 类（macOS 必需，见下）
```

`vite build` 后会复制到 `.output/hongguo-work`（与 `.output/public`、`.output/server` 同级）。

- **macOS**：跑 `bash scripts/setup-hongguo-sign.sh`，会顺带 jlink 出 `hongguo-work/jre`
- **Windows**：安装 Temurin/Corretto 17 后**重启 Node 进程**；或设 `HG_JAVA=C:\Path\to\java.exe`
- 取流卡住时先看 `/api/hongguo/stats` 里的 `sign.error`

可用环境变量覆盖：`HG_WORK` `HG_SIGN_DIR` `HG_JAVA` `HG_SIGN_PORT` `HG_SIGN_PATCH`。

> 想彻底去掉 JVM？见 [README-node-porting.md](README-node-porting.md)——
> 那份实测了 syscall/JNI/依赖清单，结论是可行且工作量比预期低。

### 自带 JRE（部署免装 JDK）

`signService` 探测 java 的优先级是：

```
HG_JAVA  >  hongguo-work/jre/bin/java  >  hongguo-work/jdk17/...  >  JAVA_HOME  >  扫盘
```

所以只要 `hongguo-work/jre` 存在，部署机上完全不需要装 JDK——把
`hongguo-work/` 整个目录拷过去即可。

裁剪模块集固定为 `java.base,java.logging,java.management,java.xml,jdk.httpserver`
（310M → 33M）。少一个就会在**运行期**炸，两处实际踩到的坑：

| 缺失模块 | 报错 |
| --- | --- |
| `java.management` | `ClassNotFoundException: java.lang.management.ManagementFactory`（unidbg 取机器指纹） |
| `java.xml` | `{"error":"javax/xml/transform/TransformerException"}` |

两者都在**启动之后**才暴露（HTTP 服务已监听但一签名就失败），容易误判成签名逻辑问题。

**组件来源**：zhangbaio/hongguo（该仓库 LICENSE 允许，本项目仅本地自用）。
jar 里 `natives/` 已含 macOS x64 的 unicorn。

### macOS 必须用打过补丁的 FqTrace

jar 自带的那份 `FqTrace` 用 Unicorn2 后端，在 macOS 上 `libunicorn.dylib`
的 `emu_start` 阶段必定 SIGBUS 崩溃。改成 unidbg 默认的 Unicorn1 后端即可：

```java
// FqTrace 构造器
emulator = AndroidEmulatorBuilder.for64Bit()
        .setProcessName(PKG).build();   // 去掉 addBackendFactory(new Unicorn2Factory(true))
```

编译后把 `com/hongguo/sign/FqTrace*.class` 放到 `build/out`，
`signService.ts` 会用 `-cp build/out:sign/unidbg-sign.jar` 让它覆盖 jar 里的版本。

> 主类要显式指定 `com.hongguo.sign.FqTrace`；jar 的默认 Main-Class 是
> `MetasecSign`，它要红果自己的 `libmetasec_ml.so`，我们没有。

## 设备身份不能乱改

`fqapi.ts` 里的 `DEVICE` 必须与 unidbg 里模拟的包（`com.dragon.read.oversea.gp`，
aid=1967）**整套自洽**：机型、系统、分辨率、UA、cookie 要配套。
换成随机 device_id 或改单个字段，网关会**静默返回 HTTP 200 + 空 body**，
不报任何错。当前值来自 `fqnovel-unidbg` 仓库里已注册的设备配置。

## 接口

| 路径 | 说明 |
| --- | --- |
| `GET /api/test/search?name=&page=` | 搜索（无 name 时返回目录） |
| `GET /api/test/catalog?page=&category=` | 分类目录 |
| `GET /api/test/detail?id=` | 详情 + 全集 vid 列表 |
| `GET /api/test/play?vid=` | 只查该集清晰度，不下载 |
| `GET /api/test/prepare?vid=` | 下载 + 解密，返回可播 src |
| `GET /api/test/stream?vid=` | 串流（支持 Range） |
| `GET /api/test/diag?vid=` | 自检：签名链路 / 密钥 / 清晰度 |

## 已知限制

- 清晰度只有 **bytevc1(HEVC)** 能在浏览器放；bytevc2 是字节自研编码，
  `pickPlayable()` 会自动只挑 HEVC（通常就是 1080p）
- 签名服务单模拟器串行，高并发下签名是瓶颈
- CDN 直链约 6 小时过期；缓存命中时不会重新取流