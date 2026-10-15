# ExamCraft AI Workbench (双入口智能组卷与在线考练工作台)

> **ExamCraft AI Workbench** 是基于 **Google Stitch** 原型设计规范打造的现代化 Web 智能组卷与在线考练工作台。基于 **Node.js + React + Tailwind CSS** 架构，提供高还原度、全交互沉浸式的命题与考练一体化体验。

---

## 🌟 核心功能特色

### 1. 双入口智能组卷工作台 (Dual-Engine Generator)
- **入口一：完整真题 PDF 1:1 原样精确克隆**
  - 支持直接拖曳上传历年期末考试试卷或考研统考真题（`.pdf` / `.docx` / `.tex`）。
  - 自适应多模态视觉模型，原位提炼考卷标题、排版规范、分值规则与数学公式，OCR 解析度达 99.8%。
  - 全真还原双栏排版、分值结构（单选、填空、综合解答题占比平衡）与答题卡规范。
- **入口二：自由规格智能生成 (Parameterized Blueprint)**
  - 无需原题模板，自主设定试卷总分（50-150分）、考试时限、题量分布与分值权重。
  - 试题难度梯度三档可调：基础稳固 / 进阶拓展 / 考研冲刺。
  - 一键智能生成新卷并直通考场。
- **近期试卷快速入口与预设蓝图**：
  - 快速查看近期生成的试卷，一键套用教育部考试中心真题标准模版。

### 2. 试卷库与标签标注管理 (Exam Repository & Tagging)
- **多维度检索与排序**：支持关键字检索（⌘K快捷键）、按导入时间、总分值、难度等级排序。
- **多标签分类体系**：全量试卷、考研真题、高校期末、章节小测、薄弱强化与星标快速筛选。
- **智能卡片仪表盘**：
  - 试卷来源标签（1:1 真题复刻 / 自由规格生成 / 预设蓝图）。
  - 历史最高分统计、作答次数、检测到的典型错因追踪。
  - 考生自拟知识点攻防备忘录（支持卡片内即时编辑保存）。
  - 「大试卷总览」与「AI 知识点攻防诊断报告」弹窗。

### 3. 专注模式在线答题考场 (Focus Mode Online Exam Room)
- **极简顶栏状态监考**：
  - 防作弊闭卷监考模式状态指示。
  - 高精度实时答题倒计时（支持格式化显示）。
  - 全局答题卡填涂进度条实时跟踪。
  - 侧边抽屉式「便签草稿纸」随时记录演算过程。
  - 一键全屏专注模式。
- **题目交互展示**：
  - 题号导航与答题卡矩阵，题型切换与答题状态联动。
  - 支持 LaTeX 高等数学公式排版渲染与考纲分类标签。
- **双模态作答交付（互斥二选一）**：
  - **模式 A · 拍照扫码识图录入**：手机端微信/浏览器扫码拍照草稿纸极速回传，或本地图片拖拽上传。
  - **模式 B · AI 规范代笔排版**：考生自拟速记推导草稿，AI 实时规整转录为 LaTeX 标准数学分步卷面，并自动核对分步赋分标签（+3分、+3分、+4分步骤预估自核）。
- **智能评测与报告结算**：交卷后自动计算得分、正确率与典型错因，一键将失分题目沉淀到错题本。

### 4. 我的题集与错题本复盘 (Mistake Notebook & Question Bank)
- **题库分类体系**：全部题目、错题本重点复盘、高频收藏、AI 举一反三推荐、草稿与手写收录。
- **自定义题集文件夹**：支持分类管理（如《高等数学期末易错集》、《考研数学核心压轴》等），支持一键新建文件夹。
- **错因深度解剖**：
  - 典型错因自核（长除法符号分配律错误、等价无穷小滥用导致逻辑谬误等）。
  - 考生错解与标准答案双栏同构比对。
  - AI 阅卷名师深度归因解析与针对性提分建议。
  - 一键「导出 PDF (含解析)」、一键「AI 举一反三变式练习」与「智能组卷并开考」。

### 5. 控制面板与系统设置 (Dashboard & Settings)
- 控制面板总体概览：累计试卷数、知识点掌握率、错题消除率与考纲攻防态势雷达图。
- 系统设置：支持配置 AI 推理主模型（Gemini 3.8 Flash / Pro、DeepSeek R1、本地离线模型）、OCR 引擎与考场防作弊策略。

---

## 🛠 技术栈与架构设计

| 层次 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **前端框架** | React 18 + Vite 5 | 极致响应速度、组件化与热更新开发体验 |
| **样式与设计系统** | Tailwind CSS 3 | 严格对齐 Stitch 设计系统（Geist、JetBrains Mono、Material Symbols） |
| **后端运行环境** | Node.js + Express | 具备独立 API 接口与静态资源生产服务能力 |
| **设计源稿** | Google Stitch (Project 4688949870103698689) | 包含 4 大核心界面的 HTML 与视觉规范 |

---

## 🚀 快速启动指南

### 1. 环境准备
确保电脑已安装 Node.js（推荐 v18+ 或 v22+）与 pnpm / npm。

### 2. 安装依赖
```powershell
pnpm install
# 或者使用 npm
npm install
```

### 3. 启动本地开发服务器
```powershell
pnpm run dev
# 或 npm run dev
```
启动后在浏览器打开：`http://localhost:3000`

### 4. 生产环境构建与启动 Node 服务器
```powershell
# 1. 执行生产打包
pnpm run build

# 2. 启动 Node 生产服务器
npm start
```

---

## 📁 项目目录结构

```
ExamCraft/
├── dist/                   # 生产打包输出目录
├── stitch_dump/            # 来自 Stitch 原型的原始 HTML 与截图资源
├── src/
│   ├── assets/             # 静态资源与图标
│   ├── components/         # 公用组件（Header 导航栏等）
│   ├── data/               # 模拟试卷、试题与错题本数据（mockData.js）
│   ├── views/              # 核心功能页面
│   │   ├── DashboardView.jsx        # 控制面板概览
│   │   ├── ExamGeneratorView.jsx    # 双入口智能组卷大厅
│   │   ├── PaperLibraryView.jsx     # 试卷库与标签标注管理
│   │   ├── ExamRoomView.jsx         # 专注模式在线答题考场
│   │   ├── MistakeNotebookView.jsx  # 我的题集与错题本复盘
│   │   └── SettingsView.jsx         # 系统设置
│   ├── App.jsx             # 路由分发与全局考场状态管理
│   ├── index.css           # Tailwind 与 Material Symbols 基础样式
│   └── main.jsx            # React 挂载入口
├── index.html              # 网页主入口（引入 Geist 与 JetBrains Mono 字体）
├── package.json            # 依赖与脚本配置
├── postcss.config.js       # PostCSS 配置
├── server.js               # Node.js 后端服务器
├── tailwind.config.js      # 完整映射 Stitch 设计规范的 Tailwind 配置
└── vite.config.js          # Vite 构建配置
```

---

## 📄 开源许可
MIT License.
