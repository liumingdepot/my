#!/usr/bin/env python3
"""抽取 JNIEnv 函数表的**权威**槽位顺序。

口径说明（别用错来源）：
metasec 是普通 NDK 编译的 so，它按 `struct JNINativeInterface_` 的
**C 内存布局**去索引函数表 —— 开头有 4 个 reserved 槽，GetVersion 在索引 4。
所以实现 JNI 桩时必须用这个布局，不能用 unidbg 的注册编号：
unidbg 的 DalvikVM64$N 只是它自己 Svc 对象的分配序号（FindClass 恰好是 $3，
而 C 布局里 FindClass 是索引 6），两者差 3。照 unidbg 的编号填表会整体错位。

用法：python3 jnilayout.py <jni.h 路径>
"""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else \
    '/Users/mac/code/其他项目/我的简历/hongguo-work/jdk17/Contents/Home/include/jni.h'
src = open(path, encoding='utf-8', errors='replace').read()

m = re.search(r'struct JNINativeInterface_\s*\{(.*?)\n\};', src, re.S)
if not m:
    sys.exit('❌ 在 %s 里没找到 struct JNINativeInterface_' % path)
body = m.group(1)

slots = []
# 先吃掉 4 个 reserved，再按函数指针顺序收集
for mm in re.finditer(r'void \*(reserved\d+);|\(\s*(?:JNICALL\s*\*|\*)\s*(\w+)\s*\)', body):
    if mm.group(1):
        slots.append(mm.group(1))
    else:
        slots.append(mm.group(2))

for i, name in enumerate(slots):
    print(f'{i}\t{name}')

implemented = sum(1 for n in slots if not n.startswith('reserved'))
print(f'# 共 {len(slots)} 个槽位（其中 {implemented} 个函数），来源 {path}', file=sys.stderr)