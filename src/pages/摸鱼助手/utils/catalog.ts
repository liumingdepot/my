export type SimId =
  | 'win-bsod'
  | 'win-repair'
  | 'win-chkdsk'
  | 'win-restore'
  | 'win-nosignal'
  | 'win10-update'
  | 'win11-update'
  | 'win-stuck'
  | 'mac-update'

export type SimCard = {
  id: SimId
  title: string
  desc: string
  badge: string
}

export type SimSection = {
  id: string
  title: string
  subtitle: string
  cards: SimCard[]
}

export const SECTIONS: SimSection[] = [
  {
    id: 'win-fault',
    title: '模拟 Windows 故障',
    subtitle: '蓝屏、修复、磁盘检查……假装电脑坏了',
    cards: [
      {
        id: 'win-bsod',
        title: '蓝屏死机',
        desc: '经典 Windows 蓝屏，含悲伤脸与错误码',
        badge: 'BSOD',
      },
      {
        id: 'win-repair',
        title: '自动修复',
        desc: '正在诊断你的 PC / 自动修复中',
        badge: 'Repair',
      },
      {
        id: 'win-chkdsk',
        title: '磁盘检查',
        desc: 'CHKDSK 扫描进度，黑底白字命令风',
        badge: 'CHKDSK',
      },
      {
        id: 'win-restore',
        title: '系统还原',
        desc: '正在还原 Windows，请勿关闭计算机',
        badge: 'Restore',
      },
      {
        id: 'win-nosignal',
        title: '无信号',
        desc: '显示器黑屏 No Signal，假装关机了',
        badge: 'Signal',
      },
    ],
  },
  {
    id: 'win-update',
    title: '模拟 Windows 升级',
    subtitle: '别关电脑，正在工作更新……',
    cards: [
      {
        id: 'win10-update',
        title: 'Windows 10 更新',
        desc: '经典圆环进度 + 百分比',
        badge: 'Win10',
      },
      {
        id: 'win11-update',
        title: 'Windows 11 更新',
        desc: '旋转圆点 + Working on updates',
        badge: 'Win11',
      },
      {
        id: 'win-stuck',
        title: '卡在 99%',
        desc: '永远停在 99%，摸鱼专用',
        badge: '99%',
      },
    ],
  },
  {
    id: 'mac-update',
    title: '模拟 Mac 升级',
    subtitle: '黑色苹果标 + 进度条',
    cards: [
      {
        id: 'mac-update',
        title: 'macOS 系统更新',
        desc: 'Apple logo 与剩余时间倒计时',
        badge: 'macOS',
      },
    ],
  },
]
