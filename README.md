# ExamCraft AI Workbench

<p align="center">
  <a href="https://github.com/civilization-os/ExamCraft/releases/tag/v1.3.0"><img src="https://img.shields.io/badge/Release-v1.3.0-blue.svg?logo=github" alt="Release v1.3.0"></a>
  <a href="https://github.com/civilization-os/ExamCraft/actions/workflows/docker-publish.yml"><img src="https://github.com/civilization-os/ExamCraft/actions/workflows/docker-publish.yml/badge.svg" alt="Docker Publish CI"></a>
  <a href="https://github.com/users/civilization-os/packages?repo_name=ExamCraft"><img src="https://img.shields.io/badge/GHCR-Docker%20Package-2496ED?logo=docker&logoColor=white" alt="GitHub Container Registry"></a>
  <a href="https://github.com/civilization-os/ExamCraft/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" alt="Node.js 20+">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white" alt="Vite 5">
  <img src="https://img.shields.io/badge/KaTeX-0.19-38B2AC" alt="KaTeX Math">
  <a href="https://github.com/civilization-os/ExamCraft/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
</p>

<p align="center">
  <b>English</b> · <a href="./README.zh-CN.md">简体中文</a>
</p>

---

> **ExamCraft AI Workbench** is a modern, full-lifecycle Web AI platform for multimodal exam paper authoring, real-time Markdown conversion, interactive focus exam testing, anti-cheating scratchpad derivation, and diagnostic grade analytics.
>
> Built with **React 18 + Vite 5 + Tailwind CSS + Node.js Express**, it delivers an immersive, high-fidelity experience for students, educators, and assessment creators.

---

## 🌟 Key Features

### 1. Triple-Engine Exam Paper Generator
- **Engine 1 · 1:1 Precision Exam Cloning (PDF / Docx / TeX / Markdown)**
  - Direct drag-and-drop of past university exams or standardized tests.
  - Multimodal vision AI extracts structure, formulas, scoring rubrics, and answer keys with up to 99.8% fidelity.
- **Engine 2 · Parameterized Custom Assembly (Blueprint)**
  - Configure total scores (50–150), test duration, question distribution, and difficulty gradients (Foundational / Advanced / Master).
  - One-click synthesis of bespoke exam papers ready for immediate testing.
- **Engine 3 · Real-Time Markdown-to-Exam (Split-Screen & Progressive Streaming)**
  - **Client-Side Passage-Aware Chunking**: Solves HTTP 413 `Payload Too Large` and LLM token truncation overflows by breaking long English reading comprehensions or calculus exams into lightweight 3–5 question batches.
  - **Live Streaming KaTeX Preview**: Progressive cards materialize in real time with high-precision batch indicators.
  - **In-Place Question Editing & AI Reconstruction**: Local fine-tuning of points, question types, or invoking AI commands like "Standardize LaTeX", "Generate Isomorphic Variations", or "Expand Step Rubrics".

### 2. Interactive Anti-Cheating Scratchpad Workbench 🆕
- **Dual-Zone Physical Isolation**:
  - **Zone 1 (Left) · Drawing & Plots**: Hand-drawn geometry, Cartesian axes, function curves ($y = x^2$, $\sin x$), circles with radius $r$.
  - **Zone 2 (Right) · Math Formulas & Scribe**: Structured step derivations and board scribe, completely eliminating visual overlap.
- **Free Window Dragging & Viewport Boundary Guard**:
  - Drag the modal anywhere on screen by grabbing the top header or drag handle.
  - Double-click to toggle fullscreen maximization / restore.
  - One-click **Reset Position** button to return smoothly to the bottom-right dock.
- **Stepless See-Through Opacity (30% – 100%)**:
  - Frosted glass translucent backdrop allows students to see through the scratchpad directly to the underlying exam question text and figures for seamless overlay derivation.
  - Quick-preset cycling (`100%` $\to$ `75%` $\to$ `50%`) with persistent local storage of user preferences.
- **Strict Anti-Cheating Guardrail**:
  - Quick-input formula chips are 100% restricted to formulas and parameters explicitly printed in the question text.
  - Prohibits external theorem leaks, unsolicited Taylor expansions, or equivalent infinitesimal shortcuts.
- **Per-Question Persistent Storage**:
  - Every problem possesses its own independent Canvas ink archive, automatically saved and restored when switching questions or reviewing submissions.
- **Agent Loop Board Derivation & Interactive Control**:
  - **Free Board Dragging & Font Scaling**: Drag board elements anywhere on screen and scale math typography from 80% to 160%.
  - **In-Place Board Editing**: Click and edit or delete chalk text directly on the board anytime.
  - **Strict Agent "Read-Before-Write" Law**: The AI assistant inspects current canvas state before applying changes, preventing destructive overwrites of user modifications.
  - **Silent Math Equivalence Substitution**: Resolves expressions like "substitute with cosy equation" silently in the background without UI clutter.

### 3. User Profile & Avatar Archive Center 🆕
- **12 Curated Gradient Theme Avatars**: High-fidelity artistic avatars (Scholar, Geek, Geometry, Rocket, Owl, Koi, etc.) with real-time selection.
- **Profile Customization**: Personalize nicknames, target examinations (Postgraduate Math, CET-4/6, College Transfer, Custom), and motivational mottoes.
- **Full Guest & Auth Cloud Sync**: Seamlessly works for both anonymous guests (local storage) and authenticated cloud accounts, displaying real-time metrics for created exams, test submissions, and mistake logs.
- **Global Version Indicators**: Prominently shows release version `v1.3.0` on the top navigation bar, user dropdown menu, and system settings panel.
- **Glassmorphic Floating Timer HUD (v1.3.0)**:
  - **Zero-Backdrop Non-Blocking**: Discards full-screen modal overlays and garish red rings, anchoring an ultra-slim glassmorphic HUD safely beneath the navigation header (`top-18 right-6`).
  - **Motion & UI Motion Atlas Spring Physics**: Powered by `motion/react`, featuring entrance spring damping, breathing alerts, a mini progress bar, and a 10-second auto-minimize timer to an unobtrusive dynamic island pill.
- **AI Answer Autofill & In-Chat Shortcuts (v1.2.9)**:
  - **Dictate to Fill (`fill_exam_answer`)**: After board derivations, students can dictate "select A" or "fill 1/6" to directly backfill answers into the exam paper and answer sheet without leaving the scratchpad.
  - **In-Chat Quick Actions**: A responsive chip button appears beneath assistant derivation bubbles allowing 1-click answer backfilling.
- **Dual-Mode Agent Architecture & Smart Substitution (v1.2.8)**: 
  - **In-Exam Scratchpad Assistant (`exam_scratchpad`)**: Strictly focused on a single guardrail: *never proactively reveal unstated formulas or final answers*. Eliminates over-defensive refusals and warmly assists in algebraic substitution, step grouping, and simplification from scratchpad knowns.
  - **Post-Exam Notebook Tutor (`notebook_tutor`)**: Dedicated tutor agent for exam review and mistake notebook analysis, unlocking full multi-step derivations, proof explanations, and isomorphic variant drills.
- **Comprehensive LaTeX Formatter Fixes & Superscript Fractions (v1.2.8)**: Elegantly renders superscript fractions like `(1+x^2)^\frac{1}{3}` as `(1+x²)¹ᐟ³`, fully resolves whitespace macros (`\quad`, `\qquad`, `\enspace`), eliminates the `\left(` bracket truncation bug (`≤ft(`), and renders equivalent infinitesimal symbols (`\sim` $\to$ `～`).
- **Action Throttling & Self-Healing Sanitizer (v1.2.7)**: Throttles canvas actions streaming frequency by 99.4%, eradicates multi-line overlapping ghosts, and introduces automated element deduplication and healing.

### 4. Focus-Mode Proctored Online Exam Room
- **Cross-Device Real-Time Exam Persistence (Zustand + Cloud Debounced Sync)** 🆕:
  - **Seamless Mobile ⇄ Desktop Handoff**: Answers entered on a smartphone are debounced (700ms) and saved to cloud exam sessions. Opening the paper on a PC immediately resumes with all answers, review flags (`M` key), timer seconds, and seal states intact.
  - **Offline Fault Tolerance & Reconnection**: When offline or facing packet loss, the app falls back to local storage and displays a real-time sync pill (`Syncing...` 🔄 / `Cloud Saved` ☁️ / `Offline Cached` ⚠️).
  - **Timestamp-Based Smart Merge**: Uses conflict-free `updatedAt` timestamps to prevent overwrites when switching devices.
  - **Layered Zustand Stores Architecture**: Standardizes state into `useExamSessionStore`, `usePaperStore`, `useSubmissionStore`, `useNotebookStore`, and `useUserStore`.
- **Minimalist Proctored Status Header**:
  - High-precision countdown timer with **Pause / Seal State** support (simulating tournament adjournment).
  - **Dynamic Color Gradient (Green $\to$ Yellow $\to$ Red)**: The countdown pill smoothly transitions from calm green (>50%) to warning yellow (20%~50%), urgent red ($\le$20% or alert threshold), and pulsating alarm red ($\le$5 min), with an embedded live progress track.
  - **Configurable Remaining Time Alert (Custom UI MSG)**:
    - Customizable alert threshold in System Settings (30m / 15m default / 10m / 5m / custom minute entry).
    - Automatically pops up our dedicated full-view modal when crossing the threshold, displaying big countdown clock, answered vs. unanswered count, and rhythm advice.
    - Supports "Snooze 5 minutes" and "Mute for this exam session".
    - In-room top bar quick-control dropdown to preview or adjust reminder threshold on the fly.
    - Pure Web Audio harmonic chime alert without external asset overhead.
  - Global answer sheet matrix tracking completion progress.
  - **One-Click Reset Entire Exam**: Prominently accessible from both the top header and answer sheet toolbar, allowing candidates to reset all answers, purge all scratchpad canvas ink, restore the full countdown clock, and unseal the session to restart from scratch.
- **Dual Modality Submission**:
  - **Modality A · Photo / QR Code Upload**: Mobile camera snapshot upload for handwritten work.
  - **Modality B · AI Mathematical Transcription**: Scribes quick shorthand drafts into publication-grade KaTeX mathematical steps with automated step score previews (+3, +3, +4 points).

### 5. AI Automated Grading & Diagnostic Review Reports
- **Instant Objective & Step-by-Step Subjective Grading**:
  - Instant submission evaluation with total score, percentage, elapsed time, and simulated national percentile.
  - **Teacher Insights & Defense Analysis**: Automatic extraction of candidate strengths vs. typical cognitive misconceptions.
  - **Answer Sheet Mini-Map**: Color-coded matrix (Emerald Green = Correct, Coral Red = Incorrect, Slate = Skipped) with smooth scroll navigation.
  - **Selective Question Archiving**: Archive chosen correct or incorrect problems directly into personal mistake notebooks with variant question generation.

### 6. Universal Vector Math Typography (KaTeX)
- Deep integration of KaTeX 0.19 across all views: matrices (`pmatrix`, `bmatrix`, `vmatrix`), limits, integrals, summations, and multiline proofs.

---

## 🚀 Quick Start

### Option A · GitHub Packages (GHCR) Docker Container (Recommended)

ExamCraft is automatically built and published to the **[GitHub Container Registry](https://github.com/users/civilization-os/packages?repo_name=ExamCraft)** via GitHub Actions:

```bash
# 1. Pull the container image from GitHub Packages
docker pull ghcr.io/civilization-os/examcraft:latest

# 2. Run the container (mapping host port 3001, persisting model config and encrypted user data)
docker run -d \
  --name examcraft \
  -p 3001:3000 \
  -v $(pwd)/examcraft-config.json:/app/examcraft-config.json \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  ghcr.io/civilization-os/examcraft:latest

# 3. Open in your browser
# Navigate to http://localhost:3001
```

> **Tip**: Initialize `examcraft-config.json` before mounting (`cp examcraft-config.example.json examcraft-config.json`). The very first user to register on the platform automatically receives **Administrator** privileges.

---

### Option B · Docker Compose

```bash
# Start all services in the background
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

---

### Option C · Local Development

Prerequisites: **Node.js 20+** and **pnpm**

```bash
# 1. Clone the repository
git clone https://github.com/civilization-os/ExamCraft.git
cd ExamCraft

# 2. Install dependencies
pnpm install

# 3. Create your configuration from the template (optional)
cp examcraft-config.example.json examcraft-config.json

# 4. Start the local dev server (with Hot Module Replacement)
pnpm run dev
# The workbench is now running at http://localhost:3000

# 5. Production build and launch
pnpm run build
pnpm run start
```

---

## ⚙️ Model Providers & Security Safeguards

ExamCraft allows switching LLM providers directly in the **Settings** view:

| Provider | Supported Models | Configuration |
| :--- | :--- | :--- |
| **DeepSeek Official** | DeepSeek-V3 / DeepSeek-R1 / DeepSeek-Flash | Enter `apiKey`, default endpoint `https://api.deepseek.com` |
| **Google Gemini** | Gemini 2.5 Pro / Flash | Enter Google AI Studio API Key |
| **OpenAI-Compatible** | Qwen / GLM / OneAPI / Ollama / vLLM | Custom `baseURL`, `modelName`, and `apiKey` |

### 🔒 Security & Credential Isolation
- **Physical Git Untracking**: `examcraft-config.json` and usage statistics are strictly ignored by `.gitignore` and `.dockerignore`. Your credentials remain 100% on your local machine and are never uploaded to GitHub or baked into Docker images.
- **Environment Variable Fallback**: Can also run in stateless cloud environments using `MODEL_API_KEY`, `DEEPSEEK_API_KEY`, or `OPENAI_API_KEY`.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 5, Tailwind CSS
- **Typography & Math**: KaTeX 0.19, Marked
- **Backend & Middleware**: Node.js, Express, `@civilization/model-core`
- **CI/CD & Container Registry**: GitHub Actions, GitHub Packages (GHCR), Docker, Docker Compose

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
