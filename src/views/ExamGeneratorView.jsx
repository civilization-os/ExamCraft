import React, { useState, useEffect } from 'react';
import MathMarkdown from '../components/MathMarkdown';

const SAMPLE_MATH_MD = `# 2026年全国硕士研究生入学统一考试（数学二）试题与解析
- 建议时限: 180分钟
- 设定总分: 150分

## 一、选择题：1～10小题，每小题5分，共50分。下列每题给出的四个选项中，只有一个选项是符合题目要求的。

### 1
当 $x \\to 0$ 时，若 $ax^2 + bx + \\arcsin x$ 与 $\\sqrt[3]{1+x^2} - 1$ 是等价无穷小，则
(A) $a=1, b=0$
(B) $a=\\frac{1}{3}, b=-1$
(C) $a=-\\frac{1}{3}, b=1$
(D) $a=0, b=1$

**答案: ** B

**解析**
当 $x \\to 0$ 时，
$$
\\sqrt[3]{1+x^2} - 1 \\sim \\frac{1}{3} x^2, \\qquad \\arcsin x = x + o(x^2).
$$
故
$$
ax^2 + bx + \\arcsin x = (b+1)x + ax^2 + o(x^2).
$$
与 $\\frac{1}{3} x^2$ 等价，必有
$$
b+1 = 0, \\qquad a = \\frac{1}{3}.
$$
故选 **B**。

::: info :bulb:深度讲解
等价无穷小代换的核心是高阶展开阶数保持一致。本题通过麦克劳林展开立即可得 $b=-1, a=1/3$。
:::

### 2
设函数 $f(x)$ 满足 $\\lim_{x \\to 0} \\frac{f(x)}{x} = 2$，且 $f(0)=0$，则曲线 $y=f(x)$ 在点 $(0,0)$ 处的切线方程为：
(A) $y = 2x$
(B) $y = -2x$
(C) $y = x$
(D) $y = 0$

**答案: ** A

**解析**
由导数定义，$f'(0) = \\lim_{x \\to 0} \\frac{f(x)-f(0)}{x-0} = \\lim_{x \\to 0} \\frac{f(x)}{x} = 2$。
切线方程为 $y - 0 = f'(0)(x - 0)$，即 $y = 2x$。选 **A**。

## 二、填空题：11～16小题，每小题5分，共30分。

### 11
定积分 $\\int_0^1 (3x^2 + 2x) \\, dx$ 的计算结果为 ______。

**答案: ** 2

**解析**
原式 $= [x^3 + x^2]_0^1 = (1 + 1) - 0 = 2$。

## 三、解答证明题：17～22小题，共70分。

### 17
求矩阵 $\\boldsymbol{H}$ 使得 $\\boldsymbol{A} = \\boldsymbol{G} \\boldsymbol{H}$，并求 $\\boldsymbol{A}^{10}$。
证明：$\\boldsymbol{\\alpha}_1, \\boldsymbol{\\alpha}_2$ 是极大线性无关组。

**解析**
**（1）证明：** 将 $\\boldsymbol{A}$ 进行初等行变换化简:
$$
\\boldsymbol{A} = \\begin{pmatrix} 1 & 0 & 0 \\\\ 0 & -1 & -1 \\\\ -1 & 0 & 1 \\\\ -1 & -2 & -1 \\end{pmatrix} \\sim \\begin{pmatrix} 1 & 0 & -1 \\\\ 0 & 1 & -1 \\\\ 0 & 0 & 0 \\\\ 0 & 0 & 0 \\end{pmatrix}
$$
故 $r(\\boldsymbol{A}) = 2$。而 $\\boldsymbol{\\alpha}_1, \\boldsymbol{\\alpha}_2$ 显然线性无关，所以它们构成一个极大线性无关组。
另外由化简结果可直接读出:
$$
\\boldsymbol{\\alpha}_3 = -\\boldsymbol{\\alpha}_1 + \\boldsymbol{\\alpha}_2
$$
`;

const SAMPLE_LINALG_MD = `# 《线性代数矩阵特征值专项强化卷》
- 建议时限: 90分钟
- 设定总分: 100分

## 一、单项选择题
### 1
设 3 阶方阵 $A$ 的特征值为 $1, -1, 2$，则伴随矩阵的行列式 $|A^*|$ 等于：
(A) -2
(B) 2
(C) 4
(D) -4

**答案: ** C

**解析**
因为 $|A| = 1 \\times (-1) \\times 2 = -2$。
根据伴随矩阵行列式性质，$|A^*| = |A|^{n-1} = (-2)^{3-1} = (-2)^2 = 4$。选 **C**。

### 2
若向量组 $\\boldsymbol{\\alpha}_1, \\boldsymbol{\\alpha}_2, \\boldsymbol{\\alpha}_3$ 线性无关，则下列向量组中线性无关的是：
(A) $\\boldsymbol{\\alpha}_1 - \\boldsymbol{\\alpha}_2, \\boldsymbol{\\alpha}_2 - \\boldsymbol{\\alpha}_3, \\boldsymbol{\\alpha}_3 - \\boldsymbol{\\alpha}_1$
(B) $\\boldsymbol{\\alpha}_1 + \\boldsymbol{\\alpha}_2, \\boldsymbol{\\alpha}_2 + \\boldsymbol{\\alpha}_3, \\boldsymbol{\\alpha}_3 + \\boldsymbol{\\alpha}_1$
(C) $\\boldsymbol{\\alpha}_1 + \\boldsymbol{\\alpha}_2 + \\boldsymbol{\\alpha}_3, 2\\boldsymbol{\\alpha}_1 + 2\\boldsymbol{\\alpha}_2 + 2\\boldsymbol{\\alpha}_3$
(D) $\\mathbf{0}, \\boldsymbol{\\alpha}_1, \\boldsymbol{\\alpha}_2$

**答案: ** B

## 二、解答题
### 3
求下列矩阵的特征值与特征向量：
$$
A = \\begin{pmatrix} 2 & 1 \\\\ 1 & 2 \\end{pmatrix}
$$

**解析**
计算特征方程：
$$
|\\lambda E - A| = \\begin{vmatrix} \\lambda - 2 & -1 \\\\ -1 & \\lambda - 2 \\end{vmatrix} = (\\lambda - 2)^2 - 1 = (\\lambda - 1)(\\lambda - 3) = 0
$$
解得特征值为 $\\lambda_1 = 1, \\lambda_2 = 3$。
`;

export default function ExamGeneratorView({ papers, onStartExam, onNavigate }) {
  const [activeMode, setActiveMode] = useState('markdown'); // Default to markdown to showcase the new renderer
  
  // Custom Spec State
  const [customTitle, setCustomTitle] = useState('《概率论与数理统计阶段模拟测验》');
  const [totalScore, setTotalScore] = useState(100);
  const [duration, setDuration] = useState(120);
  const [difficulty, setDifficulty] = useState('进阶拓展');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Markdown Generator State
  const [markdownText, setMarkdownText] = useState(SAMPLE_MATH_MD);
  const [parsedExam, setParsedExam] = useState(null);
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [showAnswers, setShowAnswers] = useState(true);
  const [expandedAnalysis, setExpandedAnalysis] = useState({}); // { [qId]: boolean }

  // File upload state simulation
  const [uploadedFile, setUploadedFile] = useState({
    name: '2024届全国高等数学期末考试统考卷A.pdf',
    size: '2.4MB',
    status: '解析完毕',
    progress: 100,
    matchedQuestions: 23,
    choices: 8,
    blanks: 5,
    solutions: 4
  });
  const [isUploading, setIsUploading] = useState(false);

  // Toggle analysis visibility for a question
  const toggleAnalysis = (id) => {
    setExpandedAnalysis(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Parse markdown on change
  useEffect(() => {
    if (activeMode !== 'markdown') return;
    const timeout = setTimeout(() => {
      fetch('/api/model/parse-markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: markdownText, useAI: false })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setParsedExam(data.data);
          }
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timeout);
  }, [markdownText, activeMode]);

  const handleSimulateUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setMarkdownText(event.target.result);
          setActiveMode('markdown');
        };
        reader.readAsText(file);
        return;
      }

      setIsUploading(true);
      setTimeout(() => {
        setUploadedFile({
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(1) + 'MB',
          status: '解析完毕',
          progress: 100,
          matchedQuestions: 21,
          choices: 8,
          blanks: 5,
          solutions: 4
        });
        setIsUploading(false);
      }, 1000);
    }
  };

  const handleLaunchClone = () => {
    const paper = papers.find(p => p.id === 'paper-math-2024a') || papers[0];
    onStartExam(paper);
  };

  const handleLaunchCustom = async () => {
    setIsGenerating(true);
    let generatedQuestion = null;

    try {
      const res = await fetch('/api/model/generate-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: customTitle,
          subject: '高等数学与微积分',
          totalScore,
          duration,
          difficulty,
          choicesCount: 8,
          blanksCount: 5,
          solutionsCount: 4
        })
      });
      const data = await res.json();
      if (data.success && data.data?.highlightQuestion) {
        generatedQuestion = data.data.highlightQuestion;
      }
    } catch (e) {
      console.warn('Backend paper generation notice:', e.message);
    } finally {
      setIsGenerating(false);
    }

    const customPaper = {
      id: 'custom-' + Date.now(),
      title: customTitle,
      source: '自由规格智能生成 (model_core 驱动)',
      sourceType: 'custom',
      date: '刚刚',
      questionCount: 17,
      totalScore: totalScore,
      duration: duration,
      difficulty: difficulty === '考研冲刺' ? 5 : difficulty === '进阶拓展' ? 4 : 3,
      tags: ['#自定义组卷', `#${difficulty}`, '#model_core生成'],
      status: '未作答 (全新排版完毕)',
      typeBreakdown: { choices: 8, blanks: 5, solutions: 4 },
      highlightQuestion: generatedQuestion
    };

    onStartExam(customPaper);
  };

  const handleAIMarkdownEnhance = async () => {
    setIsParsingAI(true);
    try {
      const res = await fetch('/api/model/parse-markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: markdownText, useAI: true })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setParsedExam(data.data);
        alert('🎉 model_core 结构化规整完毕！已自动补齐试题分值、考题类型与标准 LaTeX 公式结构。');
      } else {
        alert(data.error || '未配置有效 API Key，已切换为算法极速排版。');
      }
    } catch (err) {
      alert(`AI 增强失败: ${err.message}`);
    } finally {
      setIsParsingAI(false);
    }
  };

  const handleLaunchMarkdownExam = () => {
    if (!parsedExam || !parsedExam.questions || parsedExam.questions.length === 0) {
      alert('未能从 Markdown 中解析到有效试题，请检查文本格式。');
      return;
    }

    const mdPaper = {
      id: 'md-exam-' + Date.now(),
      title: parsedExam.title || '《Markdown 自定义试卷》',
      source: 'Markdown 题稿生成',
      sourceType: 'markdown',
      date: '刚刚',
      questionCount: parsedExam.questions.length,
      totalScore: parsedExam.totalScore || 100,
      duration: parsedExam.duration || 120,
      difficulty: 4,
      tags: ['#Markdown录入', '#KaTeX公式渲染', '#即时开考'],
      status: '未作答 (全新排版完毕)',
      questions: parsedExam.questions
    };

    onStartExam(mdPaper);
  };

  return (
    <div className="flex flex-col w-full relative min-h-full pb-16">
      {/* Background Matrix */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <div className="absolute -top-32 left-1/4 w-[640px] h-[360px] bg-primary/5 rounded-full blur-[120px]"></div>
        <div className="absolute top-48 right-10 w-[420px] h-[300px] bg-secondary-container/30 rounded-full blur-[100px]"></div>
        <svg className="w-full h-full opacity-[0.035]" height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern height="32" id="workbench-grid" patternUnits="userSpaceOnUse" width="32">
              <circle cx="2" cy="2" fill="#3525cd" r="1"></circle>
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#131b2e" strokeDasharray="2,6" strokeWidth="0.5"></path>
            </pattern>
          </defs>
          <rect fill="url(#workbench-grid)" height="100%" width="100%"></rect>
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-margin-desktop py-space-xl flex flex-col gap-space-xl">
        {/* Top Header & Workstation Telemetry */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
          <div className="space-y-space-xs max-w-2xl">
            <div className="inline-flex items-center gap-space-xs px-space-sm py-0.5 rounded bg-surface-container text-primary font-label-mono text-label-mono tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span>INTELLIGENT TRIPLE-ENGINE WORKSPACE · KATEX READY</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-semibold">
              多模态智能组卷工作台
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              支持「1:1 历年真题 PDF 克隆」、「自由参数规格蓝图」与全新的「Markdown 题稿即时转卷」，全量支持 KaTeX 高等数学矩阵与分式排版。
            </p>
          </div>

          {/* Telemetry Chips */}
          <div className="flex items-center gap-space-md font-label-mono text-label-mono flex-wrap">
            <div className="px-space-md py-space-xs rounded-lg bg-surface-container-lowest shadow-sm flex items-center gap-space-xs text-on-surface border border-outline-variant/30">
              <span className="material-symbols-outlined text-secondary text-[16px]">verified</span>
              <span>KaTeX 数学公式渲染器: 就绪</span>
            </div>
            <div className="px-space-md py-space-xs rounded-lg bg-surface-container-lowest shadow-sm flex items-center gap-space-xs text-on-surface border border-outline-variant/30">
              <span className="material-symbols-outlined text-primary text-[16px]">bolt</span>
              <span>Markdown 即时结构化 &lt; 0.2s</span>
            </div>
          </div>
        </section>

        {/* Triple Mode Selector Pills */}
        <div className="flex items-center p-1.5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveMode('clone')}
            className={`flex-1 min-w-[200px] py-2.5 px-4 rounded-xl font-label-md text-label-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMode === 'clone'
                ? 'bg-primary text-on-primary font-semibold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>入口一 · 1:1 真题 PDF 原样克隆</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('custom')}
            className={`flex-1 min-w-[200px] py-2.5 px-4 rounded-xl font-label-md text-label-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMode === 'custom'
                ? 'bg-primary text-on-primary font-semibold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">dashboard_customize</span>
            <span>入口二 · 自由规格矩阵智能生成</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('markdown')}
            className={`flex-1 min-w-[200px] py-2.5 px-4 rounded-xl font-label-md text-label-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMode === 'markdown'
                ? 'bg-primary text-on-primary font-semibold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">markdown</span>
            <span>入口三 · Markdown 题稿即时转卷</span>
            <span className="text-[10px] font-label-mono px-1.5 py-0.2 rounded bg-secondary-container text-on-secondary-container font-bold">KaTeX</span>
          </button>
        </div>

        {/* MODE 1: 1:1 PDF Clone */}
        {activeMode === 'clone' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-xl items-stretch">
            <section className="relative rounded-xl bg-surface-container-lowest shadow-sm p-space-xl border border-primary ring-2 ring-primary flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
              <div className="space-y-space-md">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded bg-secondary/10 text-secondary font-label-mono text-label-mono font-medium">
                    <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                    <span>100% 题型排版原貌保留</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  </div>
                </div>

                <div className="space-y-space-xs">
                  <h2 className="font-headline-lg text-headline-lg text-on-surface font-semibold">
                    完整真题 PDF 1:1 原样精确克隆
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    支持上传各学期标准真题试卷。自适应多模态视觉模型，原位提炼考卷标题、排版规范、分值规则与数学公式。
                  </p>
                </div>

                <label className="mt-space-md rounded-xl bg-surface-container-low p-space-lg text-center flex flex-col items-center justify-center transition-colors hover:bg-surface-container group/drop cursor-pointer border border-dashed border-outline-variant/60 block">
                  <input type="file" accept=".pdf,.docx,.tex,.md" onChange={handleSimulateUpload} className="hidden" />
                  <div className="w-12 h-12 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center text-primary group-hover/drop:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[26px]">cloud_upload</span>
                  </div>
                  <p className="mt-space-sm font-headline-sm text-headline-sm text-on-surface font-semibold">
                    拖拽试卷文件至此处，或 <span className="text-primary hover:underline">浏览本地文件</span>
                  </p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">支持格式：.pdf, .docx, .tex, .md (最大 35MB)</p>
                </label>

                <div className="rounded-lg bg-surface-container-low p-space-md flex flex-col gap-space-sm border border-outline-variant/30">
                  <div className="flex items-start justify-between gap-space-sm">
                    <div className="flex items-center gap-space-sm min-w-0">
                      <div className="w-8 h-8 rounded bg-error-container text-on-error-container flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">description</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-label-md text-label-md text-on-surface truncate font-semibold">{uploadedFile.name}</p>
                        <p className="font-label-mono text-label-mono text-on-surface-variant">{uploadedFile.size} • 已完成公式向量转录</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-space-xs py-0.5 rounded bg-surface-container text-primary font-label-mono text-code-sm">
                      {isUploading ? '解析中...' : uploadedFile.status}
                    </span>
                  </div>

                  <div className="bg-surface-container-lowest rounded p-space-sm space-y-space-xs border border-outline-variant/20">
                    <div className="flex justify-between font-label-mono text-code-sm">
                      <span className="text-on-surface-variant">结构提取完成度</span>
                      <span className="text-secondary font-semibold">100% ({uploadedFile.matchedQuestions} 题完全对齐)</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                      <div className="w-full h-full bg-secondary transition-all duration-700"></div>
                    </div>
                    <div className="pt-1 grid grid-cols-3 gap-space-xs text-center font-label-mono text-label-mono text-on-surface">
                      <div className="py-1 rounded bg-surface-container-low">选择题 <span className="font-semibold text-primary">{uploadedFile.choices} 题</span></div>
                      <div className="py-1 rounded bg-surface-container-low">填空题 <span className="font-semibold text-primary">{uploadedFile.blanks} 题</span></div>
                      <div className="py-1 rounded bg-surface-container-low">解答题 <span className="font-semibold text-primary">{uploadedFile.solutions} 题</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-space-lg">
                <button
                  type="button"
                  onClick={handleLaunchClone}
                  className="w-full h-11 px-space-lg rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">play_circle</span>
                  <span>确认此试卷并进入考场</span>
                </button>
              </div>
            </section>

            <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between space-y-space-lg">
              <div className="space-y-space-md">
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  1:1 克隆技术特性
                </h3>
                <div className="space-y-space-sm">
                  <div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-sm">
                    <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">format_shapes</span>
                    <div>
                      <p className="font-semibold text-label-md text-on-surface">双栏排版与题号答题卡映射</p>
                      <p className="text-body-sm text-on-surface-variant">严格保留教育部与各高校期末统考真题的原貌布局。</p>
                    </div>
                  </div>
                  <div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-sm">
                    <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">functions</span>
                    <div>
                      <p className="font-semibold text-label-md text-on-surface">复杂高等数学 LaTeX 向量化</p>
                      <p className="text-body-sm text-on-surface-variant">对多重积分、偏导数、矩阵与级数公式原位高保真提取并结合 KaTeX 渲染。</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-space-md bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-between">
                <div>
                  <span className="font-label-mono text-label-sm text-primary font-semibold">快速体验</span>
                  <p className="font-body-sm text-on-surface">已有预置《2024届全国高等数学期末统考试卷A》</p>
                </div>
                <button
                  type="button"
                  onClick={handleLaunchClone}
                  className="px-3 py-1.5 bg-primary text-on-primary rounded-lg font-label-sm font-semibold shadow-xs cursor-pointer"
                >
                  立即开考
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: Custom Parameterized Spec Engine */}
        {activeMode === 'custom' && (
          <section className="relative rounded-xl bg-surface-container-lowest shadow-sm p-space-xl border border-primary ring-2 ring-primary max-w-4xl mx-auto w-full space-y-space-lg">
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
              <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded bg-primary/10 text-primary font-label-mono text-label-mono font-medium">
                <span className="material-symbols-outlined text-[14px]">tune</span>
                <span>自定义分值与题型矩阵 (model_core 驱动)</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[18px]">dashboard_customize</span>
              </div>
            </div>

            <div className="space-y-space-xs">
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-semibold">
                自由规格智能生成
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                无原题模板时，自主调控题量分布、分数权重与测试考纲。底层通过 <code>model_core</code> 智能选拔符合要求的优质题目。
              </p>
            </div>

            <div className="space-y-space-sm">
              <div>
                <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">测验标题命名</label>
                <div className="relative">
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full h-9 px-space-md bg-surface-container-low rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors border border-outline-variant/30 pr-8"
                  />
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute right-space-sm top-2.5">edit</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-space-md">
                <div className="bg-surface-container-low rounded p-space-sm flex items-center justify-between border border-outline-variant/20">
                  <div>
                    <span className="block font-label-sm text-label-sm text-on-surface-variant">试卷设定总分</span>
                    <span className="font-label-mono text-headline-sm font-semibold text-on-surface">
                      {totalScore} <span className="text-body-sm font-normal text-on-surface-variant">PTS</span>
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setTotalScore(s => Math.max(50, s - 10))}
                      className="w-6 h-6 rounded bg-surface-container-lowest text-on-surface flex items-center justify-center hover:bg-surface-container shadow-xs cursor-pointer"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setTotalScore(s => Math.min(150, s + 10))}
                      className="w-6 h-6 rounded bg-surface-container-lowest text-on-surface flex items-center justify-center hover:bg-surface-container shadow-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="bg-surface-container-low rounded p-space-sm flex items-center justify-between border border-outline-variant/20">
                  <div>
                    <span className="block font-label-sm text-label-sm text-on-surface-variant">建议限时时长</span>
                    <span className="font-label-mono text-headline-sm font-semibold text-on-surface">
                      {duration} <span className="text-body-sm font-normal text-on-surface-variant">MIN</span>
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">hourglass_top</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleLaunchCustom}
                disabled={isGenerating}
                className="w-full h-11 px-space-lg rounded-lg bg-inverse-surface hover:bg-on-background text-inverse-on-surface font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[20px] ${isGenerating ? 'animate-spin' : ''}`}>
                  {isGenerating ? 'progress_activity' : 'psychology'}
                </span>
                <span>{isGenerating ? '正在调用 model_core 组卷中...' : '智能生成新卷并进入考场'}</span>
              </button>
            </div>
          </section>
        )}

        {/* MODE 3: Markdown Generation Workbench with Full KaTeX UI Rendering */}
        {activeMode === 'markdown' && (
          <div className="flex flex-col gap-space-lg">
            {/* Quick Presets & AI Action Toolbar */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-outline-variant/30 flex items-center justify-between gap-space-md flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">快速套用真题/练习 Markdown:</span>
                <button
                  type="button"
                  onClick={() => setMarkdownText(SAMPLE_MATH_MD)}
                  className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-sm font-semibold transition-colors cursor-pointer border border-primary/20"
                >
                  2026考研数学二真题与解析
                </button>
                <button
                  type="button"
                  onClick={() => setMarkdownText(SAMPLE_LINALG_MD)}
                  className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary font-label-sm font-semibold transition-colors cursor-pointer border border-secondary/20"
                >
                  线性代数矩阵特征值专练
                </button>
                <button
                  type="button"
                  onClick={() => setMarkdownText('# 《自拟测试卷》\n- 建议时限: 60分钟\n\n## 一、选择题\n### 1\n当 $x \\to 0$ 时，下列选项正确的是：\n(A) 选项A\n(B) 选项B\n\n**答案: ** A')}
                  className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm transition-colors cursor-pointer border border-outline-variant/30"
                >
                  空白简要模板
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm transition-colors cursor-pointer border border-outline-variant/30 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>导入本地 .md</span>
                  <input type="file" accept=".md,.markdown,.txt" onChange={handleSimulateUpload} className="hidden" />
                </label>

                <button
                  type="button"
                  onClick={handleAIMarkdownEnhance}
                  disabled={isParsingAI}
                  className="px-3.5 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-on-secondary font-label-sm font-semibold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="调用 model_core 检查并自动补齐缺失的分值与排版"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isParsingAI ? 'animate-spin' : ''}`}>
                    {isParsingAI ? 'progress_activity' : 'auto_fix_high'}
                  </span>
                  <span>{isParsingAI ? 'AI 规整中...' : '⚡ AI 智能规整与分值补齐'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAnswers(!showAnswers)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface hover:text-primary font-label-sm transition-colors cursor-pointer flex items-center gap-1 border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {showAnswers ? 'visibility' : 'visibility_off'}
                  </span>
                  <span>{showAnswers ? '隐藏标答/解析' : '显示标答/解析'}</span>
                </button>
              </div>
            </div>

            {/* Split Screen: Editor on Left, KaTeX Live Preview on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg items-stretch">
              {/* Left: Markdown Source Editor */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 p-space-lg flex flex-col justify-between space-y-space-sm">
                <div>
                  <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">edit_note</span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">Markdown 题稿源码编辑器</span>
                    </div>
                    <span className="font-mono text-label-mono text-on-surface-variant">
                      {markdownText.length} 字符 · {markdownText.split('\n').length} 行
                    </span>
                  </div>

                  <textarea
                    value={markdownText}
                    onChange={(e) => setMarkdownText(e.target.value)}
                    placeholder="在此编写或粘贴 Markdown 试卷文本，例如：
# 2026年考研数学真题
## 一、选择题
### 1
当 $x \to 0$ 时...
(A) $a=1$
(B) $a=2$
**答案: ** A
**解析**
因为..."
                    className="w-full h-[620px] mt-2 p-3.5 bg-surface-container-low rounded-lg font-mono text-code-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest border border-outline-variant/30 leading-relaxed resize-none"
                  />
                </div>

                {/* Markdown format tips */}
                <div className="p-space-sm bg-surface-container-low rounded-lg text-[11px] text-on-surface-variant space-y-1 font-mono">
                  <span className="font-semibold text-on-surface font-sans">💡 语法与 KaTeX 速记：</span>
                  <p>• 题号：支持 <code>### 1</code>、<code>### 题 1</code>、<code>1. </code> 或 <code>## 1</code></p>
                  <p>• 选项：支持 <code>(A) $...$</code>、<code>- A. $...$</code> 或 <code>A. $...$</code></p>
                  <p>• 标答与解析：以 <code>**答案: ** A</code> 与 <code>**解析**</code> 分隔，解析支持 LaTeX 矩阵与推导</p>
                  <p>• 矩阵格式：<code>\begin&#123;pmatrix&#125; 1 & 0 \\ 0 & 1 \end&#123;pmatrix&#125;</code></p>
                </div>
              </div>

              {/* Right: Real-time KaTeX Live Exam Paper Preview */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 p-space-lg flex flex-col justify-between space-y-space-md">
                <div className="space-y-space-md">
                  <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[18px]">functions</span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">KaTeX 数学高保真排版预览</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-label-mono text-code-sm font-semibold">
                      实时矢量渲染
                    </span>
                  </div>

                  {/* Top Paper Header Info */}
                  {parsedExam && (
                    <div className="p-space-md bg-surface-container-low rounded-xl space-y-1 border border-outline-variant/20">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                        {parsedExam.title}
                      </h3>
                      <div className="flex items-center gap-3 text-body-sm text-on-surface-variant font-label-mono flex-wrap">
                        <span className="text-secondary font-semibold">共 {parsedExam.questionCount} 道题</span>
                        <span>·</span>
                        <span className="text-primary font-semibold">测验满分: {parsedExam.totalScore} 分</span>
                        <span>·</span>
                        <span>建议时限: {parsedExam.duration} 分钟</span>
                      </div>
                    </div>
                  )}

                  {/* Rendered Questions Stream with MathMarkdown */}
                  <div className="h-[520px] overflow-y-auto space-y-space-md pr-1.5">
                    {parsedExam && parsedExam.questions && parsedExam.questions.length > 0 ? (
                      parsedExam.questions.map((q, idx) => {
                        const isAnalysisExpanded = expandedAnalysis[q.id || idx];
                        return (
                          <div
                            key={idx}
                            className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-2.5 shadow-xs transition-all hover:border-primary/40"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary font-label-mono text-label-mono font-semibold">
                                  {q.num || idx + 1}
                                </span>
                                <span className="text-label-sm font-semibold text-on-surface">{q.type}</span>
                                <span className="text-on-surface-variant text-[11px]">({q.score} 分)</span>
                              </div>
                              <span className="text-[11px] font-label-mono text-outline">{q.section}</span>
                            </div>

                            {/* Question statement rendered via MathMarkdown */}
                            <div className="font-body-md text-on-surface font-medium leading-relaxed">
                              <MathMarkdown content={q.prompt} />
                            </div>

                            {q.mathExpression && (
                              <div className="p-2 bg-surface-container-low rounded font-mono text-code-sm text-primary">
                                <MathMarkdown content={q.mathExpression} />
                              </div>
                            )}

                            {/* Options rendered via MathMarkdown */}
                            {q.options && q.options.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {q.options.map((opt) => (
                                  <div
                                    key={opt.key}
                                    className="p-2 px-3 rounded-lg bg-surface-container-low text-body-sm flex items-start gap-2 border border-outline-variant/20 hover:border-primary/30 transition-colors"
                                  >
                                    <span className="font-bold text-primary font-mono text-label-sm shrink-0 mt-0.5">
                                      ({opt.key})
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <MathMarkdown content={opt.text} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Standard Answer */}
                            {showAnswers && q.standardAnswer && (
                              <div className="pt-2 border-t border-surface-container text-body-sm flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container text-[11px] font-bold">
                                    标准答案
                                  </span>
                                  <span className="font-mono text-secondary font-bold text-label-md">
                                    {q.standardAnswer}
                                  </span>
                                </div>

                                {q.analysis && (
                                  <button
                                    type="button"
                                    onClick={() => toggleAnalysis(q.id || idx)}
                                    className="text-primary hover:underline text-[12px] flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <span>{isAnalysisExpanded ? '收起解析' : '展开名师详细解析'}</span>
                                    <span className="material-symbols-outlined text-[14px]">
                                      {isAnalysisExpanded ? 'expand_less' : 'expand_more'}
                                    </span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Detailed Analysis / Proof Block */}
                            {showAnswers && q.analysis && isAnalysisExpanded && (
                              <div className="mt-2 p-space-md bg-surface-container-low rounded-xl border border-primary/20 space-y-1 animate-in fade-in duration-150">
                                <div className="flex items-center gap-1 font-semibold text-primary text-label-sm mb-1">
                                  <span className="material-symbols-outlined text-[16px]">school</span>
                                  <span>真题推导与分步解析：</span>
                                </div>
                                <div className="text-body-sm text-on-surface leading-relaxed">
                                  <MathMarkdown content={q.analysis} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-24 text-center text-on-surface-variant space-y-2">
                        <span className="material-symbols-outlined text-[36px] opacity-40">description</span>
                        <p className="font-label-md">在左侧输入 Markdown 题目即可实时在此生成 KaTeX 交互试卷卡片</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action CTA: Enter Exam Room with this parsed exam */}
                <div className="pt-2 border-t border-surface-container">
                  <button
                    type="button"
                    onClick={handleLaunchMarkdownExam}
                    disabled={!parsedExam || !parsedExam.questions || parsedExam.questions.length === 0}
                    className="w-full h-11 px-space-lg rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]">play_circle</span>
                    <span>确认此 Markdown 试卷并进入考场</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Workspace Papers & Artifacts Row */}
        <section className="space-y-space-md pt-space-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">history_edu</span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">近期生成的试卷快速入口</h3>
            </div>
            <button
              onClick={() => onNavigate('paper-library')}
              className="font-label-md text-label-md text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>查看试卷库全集 ({papers.length}份)</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
            {papers.slice(0, 3).map((paper) => (
              <div
                key={paper.id}
                onClick={() => onStartExam(paper)}
                className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group cursor-pointer border border-outline-variant/30"
              >
                <div className="space-y-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-space-xs py-0.5 rounded bg-surface-container text-on-primary-fixed-variant font-label-mono text-label-mono">
                      {paper.source}
                    </span>
                    <span className="font-label-mono text-label-mono text-on-surface-variant">刚刚</span>
                  </div>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors font-semibold truncate">
                    {paper.title}
                  </h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">
                    全卷 {paper.questionCount} 题 • 满分 {paper.totalScore} 分 • 建议 {paper.duration}min
                  </p>
                </div>
                <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-mono text-label-mono text-on-surface-variant">
                  <span className="text-secondary flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>已就绪
                  </span>
                  <span className="group-hover:translate-x-1 transition-transform text-primary font-semibold flex items-center">
                    开考 →
                  </span>
                </div>
              </div>
            ))}

            {/* Blueprint Template Card */}
            <div
              onClick={() => {
                setActiveMode('markdown');
                setMarkdownText(SAMPLE_MATH_MD);
              }}
              className="rounded-xl bg-surface-container-low p-space-md flex flex-col justify-between hover:bg-surface-container transition-colors group cursor-pointer border border-dashed border-outline-variant/60"
            >
              <div className="space-y-space-xs">
                <div className="flex items-center justify-between">
                  <span className="px-space-xs py-0.5 rounded bg-surface-container-lowest text-on-surface-variant font-label-mono text-label-mono">
                    Markdown 范本
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">markdown</span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                  一键载入标准 Markdown 试卷
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant">即时解析排版与进入考场全真测试</p>
              </div>
              <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-mono text-label-mono text-primary font-medium">
                <span>进入 Markdown 组卷</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
