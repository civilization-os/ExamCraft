# ExamCraft AI Workbench (多模态智能组卷与在线考练工作台)

<p align="center">
  <a href="https://github.com/civilization-os/ExamCraft/releases/tag/v1.0.0"><img src="https://img.shields.io/badge/Release-v1.0.0-blue.svg?logo=github" alt="Release v1.0.0"></a>
  <a href="https://github.com/civilization-os/ExamCraft/actions/workflows/docker-publish.yml"><img src="https://github.com/civilization-os/ExamCraft/actions/workflows/docker-publish.yml/badge.svg" alt="Docker 发布状态"></a>
  <a href="https://github.com/users/civilization-os/packages?repo_name=ExamCraft"><img src="https://img.shields.io/badge/GHCR-Docker%20Package-2496ED?logo=docker&logoColor=white" alt="GitHub 容器镜像"></a>
  <a href="https://github.com/civilization-os/ExamCraft/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="开源协议: MIT"></a>
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" alt="Node.js 20+">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white" alt="Vite 5">
  <img src="https://img.shields.io/badge/KaTeX-0.19-38B2AC" alt="KaTeX 矢量公式排版">
  <a href="https://github.com/civilization-os/ExamCraft/pulls"><img src="https://img.shields.io/badge/PRs-欢迎贡献-brightgreen.svg" alt="欢迎 PR"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <b>简体中文</b>
</p>

---

> **ExamCraft AI Workbench** 是基于 **Google Stitch** 原型设计规范与统一大模型调用引擎打造的现代化 Web 智能组卷与在线考练工作台。采用 **Node.js + React + Tailwind CSS** 架构，提供高还原度、全交互沉浸式的考题生成、在线实战模考与考情诊断一体化体验。

---

## 🌟 核心功能特色

### 1. 三入口多模态智能组卷工作台 (Triple-Engine Generator)
- **入口一：完整真题 PDF 1:1 原样精确克隆**
  - 支持直接拖曳上传历年期末考试试卷或考研统考真题（`.pdf` / `.docx` / `.tex` / `.md`）。
  - 自适应多模态视觉模型，原位提炼考卷标题、排版规范、分值规则与数学公式，OCR 解析度达 99.8%。
  - 全真还原双栏排版、分值结构（单选、填空、综合解答题占比平衡）与答题卡规范。
- **入口二：自由规格智能生成 (Parameterized Blueprint)**
  - 无需原题模板，自主设定试卷总分（50-150分）、考试时限、题量分布与分值权重。
  - 试题难度梯度三档可调：基础稳固 / 进阶拓展 / 考研冲刺。
  - 一键根据所填参数实时由 AI 生成定制考题大纲并直通考场。
- **入口三：Markdown 题稿即时转卷 (Markdown to Exam)**
  - **分屏即时编辑与渲染**：左侧 Markdown 源码编辑区（带行号、语法小贴士、字符统计），右侧 KaTeX 高保真交互式试卷卡片即时排版渲染。
  - **客户端篇章级轻量切分 (Passage-Aware Chunking)**：
    - 彻底根治 `413 Request Entity Too Large`：解除大文件限制，并在前端秒级提取卷面元数据，按篇章/大题切分成若干轻量任务块。
    - **分批渐进式流式解析**：右侧实时按篇章流式浮现题目，并带有高精度分批进度指示条，彻底杜绝单次生成超出 Token 限制被截断的痛点。
  - **单题就地编辑与 AI 智能重构**：支持就地调整分值、题型、标准答案，内置「规范 LaTeX」、「同考点变式题」、「扩充分步解析踩分点」、「调节难度」等智能指令。
  - **保存与开考双通道**：支持直接「保存到试卷库」归档管理，或「确认并进入全真考场」立即实测。

### 2. 专属防作弊草稿纸工作台 (Interactive Scratchpad) 🆕
- **双区分割物理隔离**：
  - **1. 画图区（左侧）**：专供手绘涂鸦、函数曲线、平面坐标系与几何图形；
  - **2. 写公式区（右侧）**：专供公式推导演算与板书书写，彻底解决写公式误画抛物线与重叠问题。
- **窗口自由拖拽与智能复位**：
  - 按住草稿纸顶部工具栏或专属抓手即可在屏幕任意位置自由移动，绝不遮挡题目；
  - 内置屏幕边界判定防脱出，被移动后提供「一键复位」平滑归位至默认停靠区。
- **无级透视透明度 (30% ~ 100%)**：
  - 支持毛玻璃磨砂半透明无级调节，调低透明度可直接透过草稿纸看到下方的试卷题干与图像，实现“边看题边演算、临摹对比”；
  - 支持一键预设循环切换（`100%` $\to$ `75%` $\to$ `50%`）与偏好持久化记忆。
- **严格恪守防作弊红线**：
  - 快捷公式胶囊 100% 局限于原题已白纸黑字写出的式子与选项参数；
  - 坚决杜绝任何擅自联想的泰勒展开式或等价无穷小外部定理，确保学术诚信。
- **题卷独立持久化**：每一道题均拥有独立的草稿画板存档，切换题目或回看历史记录时完整还原。
- **Agent Loop 规范板书演算与双向交互**：
  - **板书自由缩放与拖拽**：支持手动拖拽板书位置与调整字体缩放比例（80% ~ 160%）；
  - **用户直接在板编辑**：用户可随时直接点选板书就地修改或删除；
  - **Agent「先读后写」铁律**：草稿纸助手在执行任何增删改操作前必须先调用工具读取当前画板的真实状态，杜绝覆盖用户手动更改；
  - **等量代换智能推导**：后台静默解析已知等式池，支持口述“用cosy等式替换”精准等量代换，界面无多余繁杂按钮干扰。

### 3. 个人中心与个性化档案系统 (User Profile & Avatar Center) 🆕
- **12 款精美渐变主题头像**：涵盖学者、极客、数理几何、火箭、猫头鹰、锦鲤等高质感头像，点击即时预览；
- **个人档案定制**：支持定制考生昵称、备考目标考试（考研数学、四六级、专升本、自主命题等）及励志座右铭；
- **全场景同步与统计**：
  - 访客（Guest）模式与注册账户全兼容，支持本地持久化与云端保存；
  - 个人中心一键汇聚生成试卷数、实战模考交卷数与错题本积累进度；
- **版本标识全局呈现**：顶栏 Logo 旁、用户下拉菜单及系统设置页统一醒目标注系统发行版本号（当前版本：`v1.0.0`）。

### 4. 专注模式在线答题考场 (Focus Mode Exam Room)
- **多端实时答题持久化同步 (Zustand + Cloud Real-time Debounced Sync)** 🆕：
  - **手机 ⇄ 电脑跨端无缝接续**：彻底解决手机作答、电脑打开试卷空白的痛点。考试期间的每一步作答、选择题填涂、复查标记（`M`键）、倒计时秒数与封卷状态均采用**本地即时渲染 + 700ms 防抖自动同步至云端会话（Exam Sessions）**；
  - **离线安全容灾与断网重连**：当网络波动或离线时，自动切换为本地离线安全缓存，答题卡矩阵标题栏实时展示同步状态微标（`云端同步中` 🔄 / `已云端同步` ☁️ / `离线已存` ⚠️）；
  - **基于时间戳智能合并**：登录或切换设备时，根据最后修改时间戳（`updatedAt`）自动智能合并最新作答记录，换设备立即无缝续考；
  - **现代化分层 Zustand Store 架构**：全项目状态解耦收敛至 `useExamSessionStore`、`usePaperStore`、`useSubmissionStore`、`useNotebookStore`、`useUserStore`，告别零散裸调 `localStorage` 与状态不同步风险。
- **极简顶栏状态监考**：
  - 闭卷监考模式状态指示；
  - **动态颜色渐变倒计时（绿 $\to$ 黄 $\to$ 红）**：倒计时标签随时间进程自动由沉稳绿（>50%）平滑过渡至警示黄（20%~50%）、紧迫红（$\le$20% 或达预警）及脉冲警报红（$\le$5分钟），底栏实时附带微型进度指示条；
  - **专属剩余考时弹窗提醒 (Custom UI MSG)**：
    - 支持在系统设置中自主配置剩余时间提醒阈值（30分 / 15分推荐 / 10分 / 5分 / 任意自定义输入）；
    - 倒计时到达设定阈值时自动弹出专属考场时间提醒窗口，展示剩余时钟、当前答题进度与查漏补缺建议，支持「5分钟后再次提醒」与「本场不再提示」；
    - 顶栏常驻提醒快捷控制菜单，无需退出考场即可就地一键切换阈值或试看弹窗；
    - 内置轻柔考场提示音（Web Audio 原生合成，离线即用零额外资源）；
  - 全局答题卡填涂进度条实时跟踪；
  - 支持考试中与「封卷」暂停状态切换；
  - **一键重置整场考试 (Reset Entire Exam)**：顶栏与答题卡工具栏常驻「重置整卷」按钮，二次确认后一键清空全部题目作答记录、重置所有草稿纸板书图元，并将考试倒计时恢复至初始设定时长，解除封卷无痕重新开考。
- **双模态作答交付（互斥二选一）**：
  - **模式 A · 拍照扫码识图录入**：手机端微信/浏览器扫码拍照草稿纸极速回传，或本地图片拖拽上传。
  - **模式 B · AI 规范代笔排版**：考生自拟速记推导草稿，AI 实时规整转录为 LaTeX 标准数学分步卷面，并自动核对分步赋分标签（+3分、+3分、+4分步骤预估自核）。

### 5. 全真 AI 智能判卷与结果全景复盘报告 (Exam Diagnostics)
- **客观题/主观题全自动判分**：
  - 交卷瞬间启动判题引擎，客观题标准化比对，主观题按关键演算步骤估算得分。
  - **顶部全景考情仪表盘**：得分、满分、正确率、用时、击败同考考生百分比一览无余。
  - **名师深度诊断评语**：攻防透视标签（优势考点 vs 典型失分点）与后续提分建议。
  - **答题卡矩阵快览 (Mini-Map)**：按对错实时着色，点击瞬间平滑滚动定位高亮对应题目。
  - **全卷自由勾选沉淀转题集**：支持将对题作为「典题」收录，错题作为「攻坚项」存入错题本并支持一键衍生变式题。

### 6. 全场景 KaTeX 数学矢量公式排版
- 全站无死角集成 KaTeX 数学渲染引擎；
- 完美渲染高等数学极限、微积分、定积分、矩阵变换（`pmatrix`, `bmatrix`, `vmatrix`）与多行推导。

---

## 🚀 极速上手

### 选项 A：使用 GitHub Packages (GHCR) Docker 镜像（推荐）

本项目已接入 GitHub Actions 自动化 CI/CD，自动打包镜像并发布至 [GitHub Container Registry](https://github.com/users/civilization-os/packages?repo_name=ExamCraft)：

```bash
# 1. 从 GitHub Packages 拉取最新容器镜像
docker pull ghcr.io/civilization-os/examcraft:latest

# 2. 运行容器（映射宿主机 3001 端口，持久化模型配置与多用户加密数据）
docker run -d \
  --name examcraft \
  -p 3001:3000 \
  -v $(pwd)/examcraft-config.json:/app/examcraft-config.json \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  ghcr.io/civilization-os/examcraft:latest

# 3. 在浏览器打开
# 访问 http://localhost:3001
```

> **提示**：挂载前请先使用模板生成配置文件：`cp examcraft-config.example.json examcraft-config.json`；首位注册的用户将自动拥有**平台管理员**权限。

---

### 选项 B：使用 Docker Compose 一键编排

```bash
# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

---

### 选项 C：本地源码运行与开发

要求环境：**Node.js 20+** 与 **pnpm**

```bash
# 1. 克隆代码仓库
git clone https://github.com/civilization-os/ExamCraft.git
cd ExamCraft

# 2. 安装项目依赖
pnpm install

# 3. 复制配置文件模板（可选，亦可在网页端设置）
cp examcraft-config.example.json examcraft-config.json

# 4. 启动本地开发服务
pnpm run dev
# 服务将在 http://localhost:3000 启动并支持实时热更新

# 5. 构建生产包
pnpm run build
pnpm run start
```

---

## ⚙️ 模型配置与安全说明

ExamCraft 支持多种主流大模型提供商，在前端「系统设置」中即可一键切换：

| 提供商类型 | 支持厂商/协议 | 配置参数说明 |
| :--- | :--- | :--- |
| **DeepSeek 官方直连** | DeepSeek-V3 / DeepSeek-R1 | 填入 `apiKey`，默认端点 `https://api.deepseek.com` |
| **Google Gemini** | Gemini 2.5 Pro / Flash | 填入 Google AI Studio API Key |
| **OpenAI 兼容协议** | 通义千问 / 智谱 GLM / OneAPI / Ollama | 自定义 `baseURL`、`modelName` 与 `apiKey` |

### 🔒 安全与隐私保护
- **配置文件物理隔离**：`examcraft-config.json` 受到 `.gitignore` 与 `.dockerignore` 绝对拦截，所有密钥只留存于您的本地机器，绝不上传至 GitHub。
- **环境变量降级支持**：支持通过 `MODEL_API_KEY`、`DEEPSEEK_API_KEY` 等系统环境变量无文件启动，适合云原生无状态环境。

---

## 🛠️ 技术栈一览

- **前端核心**：React 18, Vite 5, Tailwind CSS
- **排版引擎**：KaTeX 0.19, Marked
- **后端服务**：Node.js, Express, @civilization/model-core
- **CI/CD & 容器化**：GitHub Actions, GitHub Packages (GHCR), Docker, Docker Compose

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。
