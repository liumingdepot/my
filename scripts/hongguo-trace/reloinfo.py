#!/usr/bin/env python3
"""统计 ELF64 aarch64 共享库用到的重定位类型 / 段布局 / 依赖闭包。

这是「ELF 装载器要实现哪些指令」的权威依据——不靠猜，直接数。
"""
import struct
import sys
from collections import Counter

PT_LOAD, PT_DYNAMIC, PT_PHDR, PT_TLS = 1, 2, 6, 7
SHT_RELA, SHT_REL, SHT_DYNSYM, SHT_DYNAMIC, SHT_INIT_ARRAY = 4, 9, 11, 6, 14
SHT_INIT, SHT_FINI_ARRAY = 12, 0x1d

# aarch64 relocation types
RELOC = {
    0: 'NONE', 257: 'ABS64', 258: 'ABS32', 260: 'PREL64', 261: 'PREL32',
    262: 'PREL32_AARCH64',
    1024: 'COPY', 1025: 'GLOB_DAT', 1026: 'JUMP_SLOT', 1027: 'RELATIVE',
    1028: 'TLS_DTPMOD64', 1029: 'TLS_DTPREL64', 1030: 'TLS_TPREL64', 1031: 'TLSDESC',
    1032: 'IRELATIVE',
}

DT_NEEDED, DT_STRTAB, DT_SYMTAB, DT_STRSZ, DT_SONAME, DT_INIT, DT_FINI = 1, 5, 6, 10, 14, 12, 13
DT_INIT_ARRAY, DT_FINI_ARRAY, DT_INIT_ARRAYSZ, DT_FINI_ARRAYSZ = 25, 26, 27, 28
DT_RELA, DT_RELASZ, DT_RELAENT, DT_JMPREL = 7, 8, 9, 23
DT_PLTRELSZ, DT_PLTREL, DT_TEXTREL, DT_FLAGS, DT_RELACOUNT = 2, 20, 22, 30, 0x6ffffff9


class E:
    def __init__(self, data):
        self.d = data
        self.machine = struct.unpack_from('<H', data, 18)[0]
        self.entry = struct.unpack_from('<Q', data, 0x18)[0]
        self.phoff, self.shoff = struct.unpack_from('<QQ', data, 0x20)
        self.phentsize, self.phnum = struct.unpack_from('<HH', data, 0x36)
        self.shentsize, self.shnum, self.shstrndx = struct.unpack_from('<HHH', data, 0x3A)

    def phdrs(self):
        out = []
        for i in range(self.phnum):
            o = self.phoff + i * self.phentsize
            typ, flags, off, vaddr, paddr, filesz, memsz, align = struct.unpack_from(
                '<IIQQQQQQ', self.d, o)
            out.append(dict(type=typ, flags=flags, off=off, vaddr=vaddr,
                            filesz=filesz, memsz=memsz, align=align))
        return out

    def shdrs(self):
        out = []
        for i in range(self.shnum):
            o = self.shoff + i * self.shentsize
            name, typ, flags, addr, offset, size, link, info, align, entsize = struct.unpack_from(
                '<IIQQQQIIQQ', self.d, o)
            out.append(dict(name=name, type=typ, flags=flags, addr=addr, offset=offset,
                            size=size, link=link, info=info, entsize=entsize))
        return out

    def cstr(self, base, i):
        return base[i:base.index(b'\x00', i)].decode('utf-8', 'replace')


def analyze(path, relocs_by_file):
    d = open(path, 'rb').read()
    e = E(d)
    secs = e.shdrs()
    shstr = None
    for s in secs:
        if s['type'] == 3:
            shstr = d[s['offset']:s['offset'] + s['size']]
    for s in secs:
        s['sname'] = e.cstr(shstr, s['name']) if shstr else ''

    loads = [p for p in e.phdrs() if p['type'] == PT_LOAD]
    span = max(p['vaddr'] + p['memsz'] for p in loads) if loads else 0

    # .rela.* 段
    reloc_counts = Counter()
    for s in secs:
        if s['type'] != SHT_RELA:
            continue
        n = s['size'] // 24
        for i in range(n):
            r_off, r_info, r_add = struct.unpack_from('<QQq', d, s['offset'] + i * 24)
            rtype = r_info & 0xFFFFFFFF
            rsym = r_info >> 32
            reloc_counts[RELOC.get(rtype, f'?{rtype}')] += 1
    relocs_by_file[path] = reloc_counts

    # .dynamic
    dynstr = None
    needed = []
    dt = {}
    for s in secs:
        if s['type'] != SHT_DYNAMIC:
            continue
        for i in range(s['size'] // 16):
            tag, val = struct.unpack_from('<qQ', d, s['offset'] + i * 16)
            if tag == 0:
                break
            dt[tag] = val
            if tag == DT_NEEDED:
                needed.append(val)
        break
    for s in secs:
        if s['addr'] == dt.get(DT_STRTAB):
            dynstr = d[s['offset']:s['offset'] + (dt.get(DT_STRSZ) or s['size'])]
            break
    needed_names = [e.cstr(dynstr, n) for n in needed] if dynstr else []

    init_array_sz = dt.get(DT_INIT_ARRAYSZ, 0)
    init_sz = dt.get(DT_INIT, 0)
    # 未定义符号数
    undef = 0
    dynsym = next((s for s in secs if s['type'] == SHT_DYNSYM), None)
    if dynsym:
        for i in range(dynsym['size'] // 24):
            st_name, st_info = struct.unpack_from('<IB', d, dynsym['offset'] + i * 24 + 0)[0], \
                d[dynsym['offset'] + i * 24 + 4]
            st_shndx = struct.unpack_from('<H', d, dynsym['offset'] + i * 24 + 6)[0]
            if st_shndx == 0 and st_name:
                undef += 1

    flags = ''.join(ch for ch, bit in (('R', 4), ('W', 2), ('X', 1))
                    if any(p['flags'] & bit for p in loads))
    print(f'\n### {path.split("/")[-1]}  ({len(d)/1024:.0f}KB, 镜像跨度 0x{span:x})')
    print(f'  PT_LOAD x{len(loads)}  权限合并 [{flags or "?"}]  '
          f'DT_INIT={hex(init_sz) if init_sz else "无"}  '
          f'DT_INIT_ARRAY={init_array_sz}B')
    print(f'  NEEDED: {" ".join(needed_names) or "（无）"}')
    print(f'  未定义符号: {undef}')
    print(f'  重定位: {dict(reloc_counts) or "无"}')
    return needed_names, undef


if __name__ == '__main__':
    rb = {}
    print('=== 共享库布局与重定位统计 ===')
    for p in sys.argv[1:]:
        analyze(p, rb)
    print('\n=== 全量重定位类型汇总 ===')
    total = Counter()
    for v in rb.values():
        total.update(v)
    for k, c in total.most_common():
        print(f'  {k:14} {c}')