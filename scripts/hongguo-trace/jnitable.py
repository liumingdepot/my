#!/usr/bin/env python3
"""从 javap -c 输出里抽出 DalvikVM64$N（$N == JNIEnv 函数表槽位）的槽位→函数名映射。

为什么要机械抽取而不是手写：JNIEnv 全靠函数表下标间接调用，下标错一位是
**静默失败** —— 不报错，只是行为诡异。unidbg 的 DalvikVM64 构造函数按 jni.h
顺序依次 registerSvc 第 1..235 个 Svc，第 N 个就是槽位 N，所以「匿名类编号
== 槽位」是 unidbg 自己的事实，抽出即可当权威口径，不必依赖谁记得 jni.h 的顺序。

注意匹配 `) was called from` 那一行：同一个类里常同时出现
`JNIEnv->FindClass(...)` 和 `JNIEnv->FindNoClass(...)` 两个日志串，
取第一个会把 FindClass 误标成 FindNoClass。

用法：python3 jnitable.py <javap -c 输出>
"""
import re
import sys

src = open(sys.argv[1], encoding='utf-8', errors='replace').read()

# 以 "class ... DalvikVM64$N" 开头切块
parts = re.split(r'(?m)^(?:public |final |abstract )*class [^\n]*DalvikVM64\$(\d+)', src)

mapping = {}
for i in range(1, len(parts) - 1, 2):
    slot = int(parts[i])
    body = parts[i + 1]
    # 只认 "XXX(...) was called from" 形式的日志串 —— 那是真正的函数名。
    # 注意 FindClass 那个类里同时有 `JNIEnv->FindNoClass(...) was called from`，
    # 它在常量池里排在 FindClass 前面，取第一个会误标。所以再叠一层校验：
    # 该类自身的描述串里若出现 `FindClass env=`，以它为准。
    names = re.findall(r'// String JNIEnv->(\w+)\(.*\) was called from', body)
    # 该类自身的描述串是权威名字。两种写法都见过：
    #   FindClass env={} / GetMethodID class={} / GetObjectArrayElement array={}
    # 都以 "<函数名> <字段>=" 开头。比日志串可靠 —— 见下面 FindClass 的坑。
    self_desc = re.findall(r'// String (\w+) (?:env|class|array|object|field|method)=', body)
    if self_desc:
        mapping[slot] = self_desc[0]
    elif names:
        mapping[slot] = names[0]
    else:
        mapping[slot] = 'unsupported' if 'UnsupportedOperationException' in body else '?'

for slot in sorted(mapping):
    if mapping[slot] != 'unsupported':
        print(f'{slot}\t{mapping[slot]}')

implemented = sum(1 for v in mapping.values() if v not in ('unsupported', '?'))
print(f'# 共 {len(mapping)} 个槽位，其中已实现 {implemented} 个', file=sys.stderr)