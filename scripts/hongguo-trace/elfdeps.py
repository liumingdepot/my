#!/usr/bin/env python3
"""解析 ELF64 aarch64 的 .dynamic，导出 libmetasec_ml.so 真正依赖的外部符号。

这是「Node 重写需要模拟哪些 syscall」的权威答案 —— 比跑 runtime trace 更直接：
trace 只覆盖本次签名走过的路径，导入表是全集。
"""
import struct
import sys
from collections import defaultdict

SEC_STRTAB = 2
SHT_DYNSYM = 11
SHT_DYNAMIC = 6
DT_NEEDED, DT_SONAME, DT_STRTAB, DT_STRSZ, DT_SYMTAB = 1, 14, 5, 10, 6
DT_HASH, DT_GNU_HASH = 4, 0x6FFFFEF5
STB_GLOBAL, STB_WEAK, STB_GNU_UNIQUE = 1, 2, 10
STT_FUNC, STT_OBJECT, STT_GNU_IFUNC = 2, 1, 10


class Elf:
    def __init__(self, data):
        self.d = data
        assert data[:4] == b'\x7fELF', 'not ELF'
        assert data[4] == 2, 'not ELF64'
        self.machine = struct.unpack_from('<H', data, 18)[0]
        (self.e_shoff,) = struct.unpack_from('<Q', data, 0x28)
        (self.e_shentsize, self.e_shnum, self.e_shstrndx) = struct.unpack_from('<HHH', data, 0x3A)
        self.shoff_off = 0x3A  # e_shentsize offset marker

    def sections(self):
        out = []
        for i in range(self.e_shnum):
            off = self.e_shoff + i * self.e_shentsize
            name, typ, flags, addr, offset, size, link, info, align, entsize = struct.unpack_from(
                '<IIQQQQIIQQ', self.d, off)
            out.append(dict(name=name, type=typ, flags=flags, addr=addr, offset=offset,
                            size=size, link=link, info=info, entsize=entsize))
        return out

    def shstr(self, secs):
        s = secs[self.e_shstrndx]
        return self.d[s['offset']:s['offset'] + s['size']]

    def cstr(self, base, i):
        end = base.index(b'\x00', i)
        return base[i:end].decode('utf-8', 'replace')


def analyze(path):
    data = open(path, 'rb').read()
    e = Elf(data)
    secs = e.sections()
    shstr = e.shstr(secs)
    print(f'# {path}')
    print(f'# size={len(data)/1048576:.2f} MB  machine=0x{e.machine:x} (0xb7=aarch64)  sections={e.e_shnum}')

    for s in secs:
        nm = e.cstr(shstr, s['name'])
        s['sname'] = nm

    dyn = [s for s in secs if s['type'] == SHT_DYNAMIC]
    if not dyn:
        print('no .dynamic')
        return
    d = dyn[0]
    dynstr_off = dynstr_sz = None
    needed = []
    symtab = None
    for i in range(d['size'] // 16):
        tag, val = struct.unpack_from('<qQ', data, d['offset'] + i * 16)
        if tag == 0:
            break
        if tag == DT_NEEDED:
            needed.append(val)
        elif tag == DT_STRTAB:
            dynstr_off = val
        elif tag == DT_STRSZ:
            dynstr_sz = val
        elif tag == DT_SYMTAB:
            symtab = val
    dynstr = None
    if dynstr_off is not None:
        for s in secs:
            if s['addr'] == dynstr_off:
                dynstr = data[s['offset']:s['offset'] + (dynstr_sz or s['size'])]
                break
    print('\n## NEEDED (直接依赖的 so)')
    if dynstr:
        for n in needed:
            print(f'  {e.cstr(dynstr, n)}')

    # 找 .dynsym
    dsym = next((s for s in secs if s['type'] == SHT_DYNSYM), None)
    if not dsym:
        return
    strtab = secs[dsym['link']]
    strbase = data[strtab['offset']:strtab['offset'] + strtab['size']]

    undef, exported = defaultdict(list), []
    n = dsym['size'] // 24
    for i in range(n):
        off = dsym['offset'] + i * 24
        st_name, st_info, st_other, st_shndx, st_value, st_size = struct.unpack_from('<IBBHQQ', data, off)
        if st_name == 0:
            continue
        name = e.cstr(strbase, st_name)
        bind = st_info >> 4
        typ = st_info & 0xF
        if st_shndx == 0:  # SHN_UNDEF → 外部依赖
            undef[name].append('WEAK' if bind == STB_WEAK else 'GLOBAL')
        else:
            exported.append((name, st_value, st_size, typ))

    print(f'\n## 导出符号 (defined, {len(exported)} 个) — JNI 入口在这')
    for name, val, size, typ in sorted(exported, key=lambda x: x[1]):
        kind = {STT_FUNC: 'FUNC', STT_OBJECT: 'OBJ', STT_GNU_IFUNC: 'IFUNC'}.get(typ, typ)
        print(f'  0x{val:06x} {kind:6} {name}')

    print(f'\n## 未定义符号 (undefined, {len(undef)} 个) — 重写时必须提供')
    groups = defaultdict(list)
    for name in sorted(undef):
        groups[name.split('_')[-1] if name.startswith('__') else name].append(name)
    for name in sorted(undef):
        flags = ','.join(sorted(set(undef[name])))
        print(f'  {name}  [{flags}]')


if __name__ == '__main__':
    for p in sys.argv[1:]:
        analyze(p)
        print()