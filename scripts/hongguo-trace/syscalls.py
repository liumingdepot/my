#!/usr/bin/env python3
"""把 TraceRun 抓到的 @@SYS <nr> 解码成 aarch64 名字，并汇总成实施清单。

用法: python3 syscalls.py <trace.log>
"""
import sys
from collections import Counter

# asm-generic (aarch64) syscall 表，只列 unidbg trace 实际可能命中的区间
AARCH64 = {
    17: 'getcwd', 25: 'fcntl', 29: 'ioctl', 35: 'uname_at', 48: 'faccessat', 56: 'openat',
    57: 'close', 61: 'getdents64', 62: 'lseek', 63: 'read', 64: 'write', 66: 'writev',
    78: 'readlinkat', 79: 'newfstatat', 80: 'fstat', 93: 'exit', 94: 'exit_group',
    96: 'set_tid_address', 98: 'futex', 113: 'clock_gettime', 117: 'ptrace', 129: 'kill',
    131: 'tgkill', 134: 'rt_sigaction', 135: 'rt_sigprocmask', 139: 'rt_sigreturn',
    153: 'times', 160: 'uname', 167: 'prctl', 169: 'getcwd', 172: 'getpid', 173: 'getppid',
    174: 'getuid', 175: 'geteuid', 176: 'getgid', 177: 'getegid', 178: 'gettid',
    179: 'sysinfo', 198: 'socket', 200: 'bind', 203: 'connect', 206: 'sendto',
    207: 'recvfrom', 208: 'setsockopt', 210: 'shutdown', 212: 'recvmsg', 214: 'brk',
    215: 'munmap', 220: 'clone', 221: 'execve', 222: 'mmap', 226: 'mprotect',
    233: 'madvise', 260: 'wait4', 281: 'epoll_pwait',
}


def main(path):
    nrs, bad = Counter(), Counter()
    for line in open(path, encoding='utf-8', errors='replace'):
        if line.startswith('@@SYS '):
            try:
                n = int(line.split()[1])
            except (IndexError, ValueError):
                continue
            (nrs if 0 <= n <= 400 else bad)[n] += 1

    print(f'## aarch64 syscall 覆盖（{path}）\n')
    print('| nr | 名称 | 次数 | 重写要点 |')
    print('|---:|---|---:|---|')
    total = 0
    for n, c in sorted(nrs.items(), key=lambda kv: -kv[1]):
        name = AARCH64.get(n, '???')
        total += c
        print(f'| {n} | `{name}` | {c} | {_note(name)} |')
    print(f'\n合计 {sum(nrs.values())} 次调用，**{len(nrs)} 个不同 syscall**')
    if bad:
        print(f'\n（另有 {sum(bad.values())} 次读到 x8 的非 syscall 值，已排除：'
              f'{", ".join(str(k) for k in sorted(bad))}）')
    unknown = [n for n in nrs if n not in AARCH64]
    if unknown:
        print(f'\n⚠️ 未收录的 nr: {unknown}')
    return nrs


def _note(name):
    return {
        'mmap': '匿名映射为主；须解析 MAP_FIXED/anonymous，给出足够大的保留区',
        'mprotect': 'RWX 切换（自修改代码），mem_protect 必须真的生效',
        'futex': '几乎全是同步原语，实现 WAIT/WAKE 即可，不要真阻塞',
        'clone': 'pthread_create 用的，按 CLONE_VM|CLONE_FS|CLONE_FILES 记 flag',
        'brk': 'malloc 堆边界',
        'prctl': '反调试/线程名；照 unidbg 的默认值返回 0',
        'uname': 'nodename/release/machine=aarch64',
        'openat': '只有 5 个路径需要真实现，其余走 stub',
        'clock_gettime': '必须单调递增，否则时间戳类防重放会失效',
        'gettid': '每个线程一个稳定 id',
        'getpid': '固定值即可',
        'read': '/proc/stat、/dev/urandom、/dev/__properties__',
        'close': 'fd 表管理',
        'fstat': '补齐 st_mode/st_size/st_ino',
        'munmap': '释放 mmap 区',
        'socket': '环境探测，全程应返回失败即可',
        'connect': '同上，探测到失败后走降级路径',
        'faccessat': '存在性检查，msdata 之类的探测',
        'writev': '写 /dev/urandom 之外基本不用',
        'getcwd': '给个假的 cwd',
        'fcntl': 'fd 属性查询',
        'getuid': 'FQNREG 未设置的路径；见 README「设备身份不能乱改」',
    }.get(name, '')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'trace.log')