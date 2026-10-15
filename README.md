# ExamCraft AI Workbench (双入口智能组卷与在线考练工作台)

> **ExamCraft AI Workbench** 是基于 **Google Stitch** 原型设计规范与底层统一大模型调用核心 **`@civilization/model-core`** 打造的现代化 Web 智能组卷与在线考练工作台。基于 **Node.js + React + Tailwind CSS** 架构，提供高还原度、全交互沉浸式的命题与考练一体化体验。

---

## 🌟 核心功能特色

### 1. 底层大模型核心 `model_core` 深度集成
- **全厂商与多协议统一调度**：
  - **云端官方直连 (Official)**：支持 Google Gemini（通过 `@google/genai`）、OpenAI、Anthropic Claude。
  - **协议网关与自部署 (Protocol)**：支持 OpenAI Compatible 协议，兼容 **DeepSeek**、**通义千问**、**智谱 GLM**、**OneAPI**、本地 **Ollama** / **vLLM**。
- **直观的 API Key 配置中心**：
  - 在「系统设置」中提供可视化配置面板，支持 API 密钥安全掩码存储、一键预设套用、思考预算（Thinking Budget）与发散度（Temperature）调节。
  - 提供 **「测试模型连接」** 按钮，实时测试网络连通性与往返延迟（Latency）。
  - 顶部导航栏动态感知模型连接状态（未配置时高亮提示，已接入时展示当前使用的模型名）。

### 2. 双入口智能组卷工作台 (Dual-Engine Generator)
- **入口一：完整真题 PDF 1:1 原样精确克隆**
  - 支持直接拖曳上传历年期末考试试卷或考研统考真题（`.pdf` / `.docx` / `.tex`）。
  - 自适应多模态视觉模型，原位提炼考卷标题、排版规范、分值规则与数学公式，OCR 解析度达 99.8%。
  - 全真还原双栏排版、分值结构（单选、填空、综合解答题占比平衡）与答题卡规范。
- **入口二：自由规格智能生成 (Parameterized Blueprint)**
  - 无需原题模板，自主设定试卷总分（50-150分）、考试时限、题量分布与分值权重。
  - 试题难度梯度三档可调：基础稳固 / 进阶拓展 / 考研冲刺。
  - 直连 `model_core`，一键根据所填参数实时由 AI 生成定制考题大纲并直通考场。
- **近期试卷快速入口与预设蓝图**：
  - 快速查看近期生成的试卷，一键套用教育部考试中心真题标准模版。

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
  - **模式 B · AI 规范代笔排版 (model_core 驱动)**：考生自拟速记推导草稿，点击「⚡ 调用 model_core 规范转录」，AI 实时规整转录为 LaTeX 标准数学分步卷面，并自动核对分步赋分标签（+3分、+3分、+4分步骤预估自核）。
- **智能评测与报告结算**：交卷后自动计算得分、正确率与典型错因，一键将失分题目沉淀到错题本。

### 4. 我的题集与错题本复盘 (Mistake Notebook & Question Bank)
- **题库分类体系**：全部题目、错题本重点复盘、高频收藏、AI 举一反三推荐、草稿与手写收录。
- **自定义题集文件夹**：支持分类管理（如《高等数学期末易错集》、《考研数学核心压轴》等），支持一键新建文件夹。
- **错因深度解剖**：
  - 典型错因自核（长除法符号分配律错误、等价无穷小滥用导致逻辑谬误等）。
  - 考生错解与标准答案双栏同构比对。
  - AI 阅卷名师深度归因解析与针对性提分建议。
  - **AI 举一反三变式题**：调用 `model_core` 根据真实错题实时生成同考点不同数字/换元形式的变式练习。
  - 一键「导出 PDF (含解析)」与「智能组卷并开考」。

---

## 🛠 技术栈与架构设计

| 层次 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **模型调度核心** | `@civilization/model-core` | 统一抽象、两进两出双向翻译、指数退避重试、支持 Gemini/OpenAI/Claude/DeepSeek 等 |
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
```

### 3. 启动本地开发服务器
```powershell
pnpm run dev
```
启动后在浏览器打开：`http://localhost:3000`

### 4. 配置您的 API Key
1. 打开网页右上角或点击导航中的 **「系统设置」**。
2. 选择提供商：
   - 使用 **Google Gemini**：选择官方厂商 Google Gemini，输入您的 Gemini API Key。
   - 使用 **DeepSeek**：点击「DeepSeek 协议直连」预设，粘贴您的 DeepSeek API Key（Base URL 默认为 `https://api.deepseek.com/v1`）。
   - 使用 **本地模型**：点击「本地 Ollama / vLLM」预设即可无 Key 运行。
3. 点击 **「测试模型连接」** 验证通讯正常后，点击 **「保存配置生效」**。

---

## 📁 项目目录结构

```
ExamCraft/
├── dist/                   # 生产打包输出目录
├── stitch_dump/            # 来自 Stitch 原型的原始 HTML 与截图资源
├── api-router.js           # model_core 统一模型调度与接口路由
├── examcraft-config.json   # 模型与 API Key 本地安全配置文件
├── src/
│   ├── components/         # 公用组件（Header 导航栏等）
│   ├── data/               # 模拟试卷、试题与错题本数据（mockData.js）
│   ├── views/              # 核心功能页面
│   │   ├── DashboardView.jsx        # 控制面板概览
│   │   ├── ExamGeneratorView.jsx    # 双入口智能组卷大厅
│   │   ├── PaperLibraryView.jsx     # 试卷库与标签标注管理
│   │   ├── ExamRoomView.jsx         # 专注模式在线答题考场
│   │   ├── MistakeNotebookView.jsx  # 我的题集与错题本复盘
│   │   └── SettingsView.jsx         # 系统设置（API Key 与模型管理）
│   ├── App.jsx             # 路由分发与全局考场状态管理
│   ├── index.css           # Tailwind 与 Material Symbols 基础样式
│   └── main.jsx            # React 挂载入口
├── index.html              # 网页主入口
├── package.json            # 依赖配置（已软链 link:../model_core）
├── server.js               # Node.js 生产服务器
├── tailwind.config.js      # 完整映射 Stitch 设计规范的 Tailwind 配置
└── vite.config.js          # Vite 构建与 API 中间件配置
```

---

## 📄 开源许可
MIT License.
