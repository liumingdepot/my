/** 中英双语简历数据 — 依据 resumes/刘铭.pdf 与 resumes/liuming.pdf */
export const I18N = {
  zh: {
    ui: {
      brand: "LiuMing",
      brandSuffix: ".dev",
      nav: {
        intro: "简介",
        works: "个人作品",
        about: "关于",
        skills: "技能",
        projects: "项目",
        experience: "经历",
        contact: "联系"
      },
      resume: "简历",
      hireMe: "联系我",
      viewProjects: "查看项目 →",
      getInTouch: "联系我",
      phone: "电话 ↗",
      resumeLink: "简历 ↗",
      theme: "切换主题",
      lang: "EN",
      langTitle: "Switch to English",
      sectionWorks: "02 — 个人作品",
      sectionAbout: "03 — 关于",
      sectionSkills: "04 — 技能",
      sectionProjects: "05 — 项目",
      sectionExperience: "06 — 经历",
      sectionContact: "07 — 联系",
      skillsTitle: "我使用的工具与技术。",
      projectsTitle: "我做过的事。",
      experienceTitle: "我工作过的地方。",
      contactTitle: "一起合作。",
      worksTitle: "个人开发者作品，仅供学习交流",
      workOpen: "打开 →",
      contactEyebrow: "Let's build something",
      contactHeading: "有合适的机会想聊聊？",
      contactText: "目前开放全职前端开发 / 前端管理机会，也可交流微前端与 AI 工程化实践。欢迎直接联系。",
      downloadResume: "下载简历 ↓",
      techStack: "技术栈",
      featured: "精选 · 省级核心系统",
      footerCopy: "刘铭 · Liu Ming",
      menu: "打开菜单"
    },
    /** 新增作品：往这个数组追加一项即可 */
    works: [
      {
        name: "算命",
        desc: "填写生辰与问题，生成一份周易命盘解读。观象于天，仅作传统文化与娱乐参考。",
        href: "/fortune",
        tag: "已上线",
        tone: "violet",
        glyph: "周易"
      },
      {
        name: "音乐",
        desc: "搜索歌曲、浏览推荐与排行榜，在线听歌并同步歌词。兼容手机与电脑。",
        href: "/music",
        tag: "已上线",
        tone: "cyan",
        glyph: "♪"
      },
      {
        name: "视频",
        desc: "搜索影视、浏览分类与短剧，多线路播放与本地收藏。兼容手机与电脑。",
        href: "/video",
        tag: "已上线",
        tone: "emerald",
        glyph: "▶"
      }
    ],
    profile: {
      name: "刘铭",
      available: "开放新机会 · 西安 / 前端开发",
      headlineHtml: '<span class="grad">可扩展</span>的<span class="grad">前端</span>体验，用工程化精心打造。',
      bio: "拥有 9 年前端开发经验，专注微前端架构、多端交付与数据可视化。擅长 Vue / React / TypeScript，具备从 0 到 1 搭建前端基建、带领团队交付复杂业务系统的能力。求职意向：前端开发工程师 · 期望薪资 20–25K · 西安。",
      photo: "/images/my.jpg",
      resume: "/resumes/liuming-zh.pdf",
      phone: "15332335062"
    },
    stats: [
      { value: "9+", label: "年工作经验" },
      { value: "99+", label: "交付项目" },
      { value: "40%", label: "平均性能提升" },
      { value: "10", label: "团队峰值人数" }
    ],
    about: {
      title: "将近十年的界面与架构打磨。",
      paragraphs: [
        "全栈视野与深厚积淀：拥有 8 年前端开发经验，具备从移动端（UniApp、Flutter、鸿蒙）到桌面端（Electron 等跨平台方案）再到 Web 中后台（React、Vue）的全链路交付能力，能快速切入并主导各类复杂前端项目。",
        "工程化与架构思维：精通微前端架构设计与性能优化，擅长在大型项目中通过模块拆分、构建优化和规范制定，提升团队协作效率与代码可维护性，具备从 0 到 1 搭建前端基建体系的经验。",
        "AI 原生开发实践者：深度结合 Cursor、AI OpenCode 等智能编程工具，将 AI 能力融入日常开发流；同时是数据可视化与跨端适应力强的技术牵头人，乐于分享与人才培养。资格证书：系统架构设计师。"
      ],
      meta: [
        { label: "所在地", value: "西安 · 中国" },
        { label: "电话", value: "15332335062", href: "tel:15332335062" },
        { label: "求职意向", value: "前端开发工程师 · 20–25K" },
        { label: "资格证书", value: "系统架构设计师" }
      ]
    },
    skills: [
      {
        category: "框架与语言",
        items: ["Vue 2/3", "React", "TypeScript", "JavaScript", "HTML5", "CSS3"]
      },
      {
        category: "架构与工程",
        items: ["qiankun", "Module Federation", "Webpack", "Vite", "Next.js / Nuxt", "CI/CD", "脚手架与规范"]
      },
      {
        category: "多端与跨平台",
        items: ["UniApp", "Flutter", "HarmonyOS", "Electron", "H5", "PWA"]
      },
      {
        category: "数据可视化",
        items: ["ECharts", "Canvas", "GIS 地图", "大屏组件库", "实时数据流"]
      },
      {
        category: "AI 与效能",
        items: ["Cursor", "AI OpenCode", "AI 辅助编码", "Prompt 工程", "人机协作规范"]
      },
      {
        category: "协作与管理",
        items: ["团队管理", "Code Review", "技术分享", "需求分析", "售前 Demo", "敏捷交付"]
      },
      {
        category: "状态与请求",
        items: ["Vuex / Pinia", "Redux", "Axios", "REST", "WebSocket", "WebRTC"]
      },
      {
        category: "工具链",
        items: ["Git", "GitLab CI", "Jenkins", "Nginx", "SSR", "懒加载与缓存"]
      }
    ],
    projects: [
      {
        featured: true,
        name: "陕西省总队水气综合分析平台",
        badge: "精选 · 省级核心系统",
        role: "前端开发经理",
        period: "2026.03 — 至今",
        desc: "省级环保监测核心系统，覆盖水质监测站实时数据、空气质量指数、污染物趋势预测等场景，服务于省—市—县三级环保部门。",
        points: [
          "采用 qiankun 微前端，将水环境、大气环境、污染源拆分为独立子应用，实现三级数据穿透与精细化权限隔离",
          "自研 ECharts + Canvas / GIS 可视化大屏组件库，支持全省监测点位地图下钻、多维图表联动与实时数据流刷新",
          "通过懒加载、按需引入、Gzip、轮询节流等策略，大屏首屏从 4.2s 优化至 1.5s 以内，保障 7×24h 稳定运行",
          "封装通用图表配置生成工具，新增图表开发时间缩短约 60%"
        ],
        stack: ["qiankun", "Vue3", "TypeScript", "ECharts", "GIS", "Vite", "Axios"]
      },
      {
        name: "延安市生态环境综合管理平台",
        role: "前端开发经理",
        period: "2023.03 — 至今",
        desc: "覆盖监测监控、移动执法 App（UniApp）、企业端 App（Flutter）、OA、视频会议、应急指挥、噪声监管等 20+ 子系统；微前端统一门户与 SSO，新子系统周期 3 周→1 周，主门户 3.8s→1.2s。",
        stack: ["qiankun", "Vue/React", "UniApp", "Flutter", "WebRTC", "ECharts"]
      },
      {
        name: "省级 / 地市级环保信息化项目群（99+）",
        role: "前端开发经理",
        period: "2020.06 — 至今",
        desc: "覆盖大气治理、双随机、应急指挥、数字乡村、噪声监管等业务；沉淀组件库复用 10+ 项目（-30% 重复开发），脚手架初始化 2 天→1 小时，AI 辅助使人均效能 +30%。",
        stack: ["Vue2/3", "React", "TypeScript", "微前端", "UniApp", "CI/CD"]
      },
      {
        name: "陕西省涉气重点污染源监控平台",
        role: "前端开发经理",
        period: "环信恒辉期间",
        desc: "基于 Vue3 + TS + Vite 重构，扩展 PC 管理端 + 企业端 + H5 三端；集成天地车人、执法装备与用电监控物联网数据，实现非现场监管可视化。",
        stack: ["Vue3", "TypeScript", "Vite", "IoT", "H5"]
      }
    ],
    experience: [
      {
        role: "前端开发经理",
        period: "2020.06 — 至今",
        company: "陕西环信恒辉电子科技有限公司 · 西安",
        highlights: [
          "作为前端团队负责人，主导环保信息化、智慧政务产品前端架构与研发管理，带领 4–6 人团队支撑多端交付",
          "搭建 qiankun / Module Federation 微前端公共基座，实现多业务子系统独立部署与无缝集成",
          "主导 UniApp / Flutter / 鸿蒙移动端与 Electron 桌面端，形成「一套后台、多端触达」产品矩阵",
          "自研 ECharts + Canvas 交互大屏组件库；核心页面加载提升 40%+，构建时间缩短约 60%",
          "引入 Cursor + AI 辅助开发，重复性编码效率提升 30%+；从零搭建基建，团队从 3 人扩展至 10 人"
        ]
      },
      {
        role: "前端开发",
        period: "2018.06 — 2020.06",
        company: "西安云轻软件技术有限公司 · 西安",
        highlights: [
          "使用 HTML、CSS、JavaScript 完成页面开发与优化",
          "使用 Bootstrap 实现多端自适应布局，jQuery 完成页面交互",
          "使用 Webpack 优化构建与加载体验，提升用户留存与满意度"
        ]
      }
    ]
  },

  en: {
    ui: {
      brand: "LiuMing",
      brandSuffix: ".dev",
      nav: {
        intro: "Intro",
        works: "Works",
        about: "About",
        skills: "Skills",
        projects: "Projects",
        experience: "Experience",
        contact: "Contact"
      },
      resume: "Resume",
      hireMe: "Hire Me",
      viewProjects: "View Projects →",
      getInTouch: "Get In Touch",
      phone: "Phone ↗",
      resumeLink: "Resume ↗",
      theme: "Toggle theme",
      lang: "中文",
      langTitle: "切换到中文",
      sectionWorks: "02 — Works",
      sectionAbout: "03 — About",
      sectionSkills: "04 — Skills",
      sectionProjects: "05 — Projects",
      sectionExperience: "06 — Experience",
      sectionContact: "07 — Contact",
      skillsTitle: "Tools I work with.",
      projectsTitle: "Things I've built.",
      experienceTitle: "Where I've worked.",
      contactTitle: "Let's work together.",
      worksTitle: "Things you can open.",
      workOpen: "Open →",
      contactEyebrow: "Let's build something",
      contactHeading: "Have an opportunity in mind?",
      contactText: "Open to full-time frontend engineering / leadership roles. Happy to discuss micro-frontends and AI-assisted engineering. Feel free to reach out.",
      downloadResume: "Download Resume ↓",
      techStack: "Tech Stack",
      featured: "Featured · Provincial Core System",
      footerCopy: "Liu Ming",
      menu: "Open menu"
    },
    works: [
      {
        name: "Fortune",
        desc: "Enter a birth chart and a question, then read an I Ching report. Cultural entertainment, not professional advice.",
        href: "/fortune",
        tag: "Live",
        tone: "violet",
        glyph: "周易"
      },
      {
        name: "Music",
        desc: "Search tracks, browse playlists and charts, play online with synced lyrics. Works on phone and desktop.",
        href: "/music",
        tag: "Live",
        tone: "cyan",
        glyph: "♪"
      },
      {
        name: "Video",
        desc: "Search shows, browse categories and shorts, multi-source playback with local favorites. Phone and desktop.",
        href: "/video",
        tag: "Live",
        tone: "emerald",
        glyph: "▶"
      }
    ],
    profile: {
      name: "Liu Ming",
      available: "Available for new opportunities · Xi'an / Frontend",
      headlineHtml: '<span class="grad">Scalable</span> <span class="grad">frontend</span> experiences, crafted with engineering care.',
      bio: "Senior frontend engineer with 9 years of experience building micro-frontend platforms, multi-end apps, and data visualization. Strong in Vue / React / TypeScript, infrastructure from scratch, and leading teams on complex deliveries. Target role: Frontend Development Engineer · 20–25K · Xi'an.",
      photo: "/images/my.jpg",
      resume: "/resumes/liuming.pdf",
      phone: "15332335062"
    },
    stats: [
      { value: "9+", label: "Years Experience" },
      { value: "99+", label: "Projects Shipped" },
      { value: "40%", label: "Avg Perf Gain" },
      { value: "10", label: "Team Peak Size" }
    ],
    about: {
      title: "A decade of crafting interfaces & architecture.",
      paragraphs: [
        "Full-stack perspective & deep expertise: 8+ years spanning mobile (UniApp, Flutter, HarmonyOS), desktop (Electron), and web admin systems (React, Vue). Able to quickly own and lead complex frontend deliveries end to end.",
        "Engineering & architecture mindset: Strong in micro-frontend design and performance optimization—modularization, build optimization, and standards that improve collaboration and maintainability. Experience building frontend infrastructure from scratch.",
        "AI-native practitioner: Deeply integrates Cursor and AI OpenCode into daily workflows. Also a data-visualization and cross-platform lead who enjoys mentoring. Certificate: Systems Architecture Designer."
      ],
      meta: [
        { label: "Location", value: "Xi'an · China" },
        { label: "Phone", value: "15332335062", href: "tel:15332335062" },
        { label: "Intent", value: "Frontend Engineer · 20–25K" },
        { label: "Certificate", value: "Systems Architecture Designer" }
      ]
    },
    skills: [
      {
        category: "Frameworks & Languages",
        items: ["Vue 2/3", "React", "TypeScript", "JavaScript", "HTML5", "CSS3"]
      },
      {
        category: "Architecture & Engineering",
        items: ["qiankun", "Module Federation", "Webpack", "Vite", "Next.js / Nuxt", "CI/CD", "Scaffolding & Standards"]
      },
      {
        category: "Multi-end & Cross-platform",
        items: ["UniApp", "Flutter", "HarmonyOS", "Electron", "H5", "PWA"]
      },
      {
        category: "Data Visualization",
        items: ["ECharts", "Canvas", "GIS Maps", "Dashboard Libraries", "Realtime Streams"]
      },
      {
        category: "AI & Productivity",
        items: ["Cursor", "AI OpenCode", "AI-assisted Coding", "Prompt Engineering", "Human–AI Workflows"]
      },
      {
        category: "Collaboration & Leadership",
        items: ["Team Leadership", "Code Review", "Tech Sharing", "Requirements", "Pre-sales Demos", "Agile Delivery"]
      },
      {
        category: "State & Networking",
        items: ["Vuex / Pinia", "Redux", "Axios", "REST", "WebSocket", "WebRTC"]
      },
      {
        category: "Tooling",
        items: ["Git", "GitLab CI", "Jenkins", "Nginx", "SSR", "Lazy Load & Caching"]
      }
    ],
    projects: [
      {
        featured: true,
        name: "Shaanxi Corps Water & Air Comprehensive Analysis Platform",
        badge: "Featured · Provincial Core System",
        role: "Frontend Development Manager",
        period: "Mar 2026 – Present",
        desc: "Provincial environmental monitoring core system—real-time water stations, AQI, pollutant trend forecasting—serving province–city–county agencies.",
        points: [
          "qiankun micro-frontends: split water, atmosphere, and pollution-source modules into independent sub-apps with three-level drill-through and fine-grained permissions",
          "Built ECharts + Canvas / GIS dashboard library for province-wide map drill-down, linked charts, and realtime streams",
          "Lazy loading, Gzip, polling throttling: first paint 4.2s → under 1.5s; 7×24 monitoring hall stability",
          "Chart config tooling cut new chart development time by ~60%"
        ],
        stack: ["qiankun", "Vue3", "TypeScript", "ECharts", "GIS", "Vite", "Axios"]
      },
      {
        name: "Yan'an Eco-Environment Integrated Management Platform",
        role: "Frontend Development Manager",
        period: "Mar 2023 – Present",
        desc: "20+ subsystems: monitoring, UniApp enforcement, Flutter enterprise app, OA, WebRTC meetings, emergency command, noise supervision. Unified portal + SSO; new subsystem 3 weeks → 1 week; portal 3.8s → 1.2s.",
        stack: ["qiankun", "Vue/React", "UniApp", "Flutter", "WebRTC", "ECharts"]
      },
      {
        name: "Provincial / Prefecture Environmental Projects (99+)",
        role: "Frontend Development Manager",
        period: "Jun 2020 – Present",
        desc: "Air governance, dual-random inspections, emergency command, digital villages, noise supervision, and more. Shared libraries across 10+ projects (−30% duplicate work); scaffold init 2 days → 1 hour; AI-assisted +30% productivity.",
        stack: ["Vue2/3", "React", "TypeScript", "Micro-frontends", "UniApp", "CI/CD"]
      },
      {
        name: "Shaanxi Key Air Pollution Source Monitoring Platform",
        role: "Frontend Development Manager",
        period: "During Huanxin Henghui",
        desc: "Vue3 + TS + Vite rebuild across PC admin, enterprise, and H5; integrated sky–ground–vehicle–person and IoT power/equipment data for non-on-site supervision visualization.",
        stack: ["Vue3", "TypeScript", "Vite", "IoT", "H5"]
      }
    ],
    experience: [
      {
        role: "Frontend Development Manager",
        period: "Jun 2020 – Present",
        company: "Shaanxi Huanxin Henghui Electronic Technology Co., Ltd. · Xi'an",
        highlights: [
          "Lead architecture and R&D for environmental-informatization and smart-government products; manage a 4–6 person frontend team for multi-end delivery",
          "Built qiankun / Module Federation platform base for independent deploy and seamless subsystem integration",
          "Led UniApp / Flutter / HarmonyOS mobile and Electron desktop strategy—“one backend, multi-end reach”",
          "Built ECharts + Canvas dashboard library; core page load +40%+; build time −60%",
          "Introduced Cursor + AI workflows (+30% coding efficiency); scaffolding/CI/CD from scratch; team grew 3 → 10"
        ]
      },
      {
        role: "Frontend Developer",
        period: "Jun 2018 – Jun 2020",
        company: "Xi'an Yunqing Software Technology Co., Ltd. · Xi'an",
        highlights: [
          "Page development and optimization with HTML, CSS, and JavaScript",
          "Responsive layouts with Bootstrap; interactive UX with jQuery",
          "Webpack build and load-time optimization to improve retention and satisfaction"
        ]
      }
    ]
  }
};
