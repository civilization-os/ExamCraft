import React, { useState, useEffect, useRef } from 'react';
import MathMarkdown from '../components/MathMarkdown';
import { extractExamMeta, sliceMarkdownIntoChunks } from '../utils/examChunker';

export default function ExamGeneratorView({ papers, onStartExam, onNavigate }) {
  const [activeMode, setActiveMode] = useState('markdown'); // Default to markdown
  
  // Custom Spec State (Entry 2)
  const [customTitle, setCustomTitle] = useState('');
  const [totalScore, setTotalScore] = useState(100);
  const [duration, setDuration] = useState(120);
  const [difficulty, setDifficulty] = useState('进阶拓展');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Markdown Generator State (Entry 3)
  const [markdownText, setMarkdownText] = useState('');
  const [parsedExam, setParsedExam] = useState(null);
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [showAnswers, setShowAnswers] = useState(true);
  const [expandedAnalysis, setExpandedAnalysis] = useState({}); // { [qId]: boolean }
  const [expandedPassages, setExpandedPassages] = useState({}); // { [qId]: boolean }
  const [aiEnhanceMessage, setAiEnhanceMessage] = useState('');

  // Single Question Interactive Editing & AI Assist
  const [editingQId, setEditingQId] = useState(null); // id of question being edited manually
  const [editForm, setEditForm] = useState(null);
  const [aiAssistQId, setAiAssistQId] = useState(null); // id of question with AI assist tray open
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [customAiPrompt, setCustomAiPrompt] = useState('');
  const [flashSuccessId, setFlashSuccessId] = useState(null);

  // File upload & AI Clone state (Entry 1)
  const [cloneRawText, setCloneRawText] = useState('');
  const [isAiCloning, setIsAiCloning] = useState(false);
  const [cloneStage, setCloneStage] = useState(0); // 0: idle, 1: reading, 2: parsing, 3: latex, 4: done
  const [clonedPaperResult, setClonedPaperResult] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  const debounceTimerRef = useRef(null);
  const activeJobIdRef = useRef(0);
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 0, summary: '' });

  // Toggle analysis visibility for a question
  const toggleAnalysis = (id) => {
    setExpandedAnalysis(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Toggle reading passage visibility
  const togglePassage = (id) => {
    setExpandedPassages(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Progressive Chunked AI Parser
  // Cuts long texts into lightweight passage-aware batches, preventing HTTP 413 and LLM output token overflows
  const runProgressiveChunkParser = async (mdText) => {
    if (!mdText || !mdText.trim()) return;

    const currentJobId = ++activeJobIdRef.current;
    setIsParsingAI(true);

    // 1. Instantly parse metadata in client
    const meta = extractExamMeta(mdText);
    setParsedExam(prev => ({
      title: meta.title,
      duration: meta.duration,
      totalScore: meta.totalScore,
      questionCount: prev?.questions?.length || 0,
      questions: prev?.questions || []
    }));

    // 2. Slice into lightweight passage-aware chunks
    const chunks = sliceMarkdownIntoChunks(mdText);
    setChunkProgress({ current: 0, total: chunks.length, summary: chunks[0]?.summary || '准备切片解析...' });

    const accumulatedQuestions = [];

    for (let i = 0; i < chunks.length; i++) {
      if (activeJobIdRef.current !== currentJobId) {
        return; // Aborted by newer user input
      }

      const ch = chunks[i];
      setChunkProgress({
        current: i + 1,
        total: chunks.length,
        summary: ch.summary
      });

      try {
        const res = await fetch('/api/model/parse-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chunk: {
              section: ch.section,
              passageTitle: ch.passageTitle,
              passage: ch.passage,
              rawQuestionsText: ch.rawQuestionsText
            },
            useAI: true
          })
        });

        if (activeJobIdRef.current !== currentJobId) return;

        const data = await res.json();
        if (data.success && data.questions && data.questions.length > 0) {
          accumulatedQuestions.push(...data.questions);

          // Progressive live stream update into KaTeX preview
          setParsedExam(prev => {
            const sorted = [...accumulatedQuestions];
            sorted.sort((a, b) => {
              const numA = parseInt(String(a.num || a.id).replace(/\D/g, ''), 10) || 0;
              const numB = parseInt(String(b.num || b.id).replace(/\D/g, ''), 10) || 0;
              return numA - numB;
            });
            return {
              ...prev,
              title: prev?.title || meta.title,
              duration: prev?.duration || meta.duration,
              totalScore: prev?.totalScore || meta.totalScore,
              questionCount: sorted.length,
              questions: sorted
            };
          });
        }
      } catch (err) {
        console.warn(`[Chunk ${i + 1} parse error]:`, err.message);
      }
    }

    if (activeJobIdRef.current === currentJobId) {
      setChunkProgress({ current: chunks.length, total: chunks.length, summary: '切片解析完成' });
      setIsParsingAI(false);
      setAiEnhanceMessage(`🎉 model_core 分篇章切片解析完毕！已完成 ${chunks.length} 个任务批次，成功规整 ${accumulatedQuestions.length} 道试题，杜绝了超长文本溢出。`);
    }
  };

  // Automatic AI parse triggered when markdownText changes with debounce
  // No manual button needed: all parsing defaults to AI with seamless KaTeX loading state
  useEffect(() => {
    if (activeMode !== 'markdown') return;
    if (!markdownText || !markdownText.trim()) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      runProgressiveChunkParser(markdownText);
    }, 600);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [markdownText, activeMode]);

  // Recalculate and sync total score from questions
  const handleRecalculateTotalScore = () => {
    if (!parsedExam || !parsedExam.questions) return;
    const computedTotal = parsedExam.questions.reduce((sum, q) => sum + (Number(q.score) || 0), 0);
    setParsedExam(prev => ({
      ...prev,
      totalScore: computedTotal
    }));
  };

  // Start Manual Editing a Question
  const handleStartEdit = (q) => {
    setEditingQId(q.id);
    setAiAssistQId(null);
    setEditForm({
      id: q.id,
      num: q.num || '01',
      type: q.type || '单项选择题',
      score: q.score || 5,
      section: q.section || '试题',
      prompt: q.prompt || '',
      options: q.options ? JSON.parse(JSON.stringify(q.options)) : [],
      standardAnswer: q.standardAnswer || '',
      analysis: q.analysis || '',
      passage: q.passage || '',
      passageTitle: q.passageTitle || ''
    });
  };

  // Cancel Manual Editing
  const handleCancelEdit = () => {
    setEditingQId(null);
    setEditForm(null);
  };

  // Save Manual Editing
  const handleSaveEdit = () => {
    if (!editForm || !parsedExam) return;
    const updatedQuestions = parsedExam.questions.map(q => {
      if (q.id === editForm.id) {
        return {
          ...q,
          ...editForm,
          score: Number(editForm.score) || 5
        };
      }
      return q;
    });

    setParsedExam(prev => ({
      ...prev,
      questions: updatedQuestions
    }));
    setEditingQId(null);
    setEditForm(null);
    triggerFlashSuccess(editForm.id);
  };

  // Delete a Question
  const handleDeleteQuestion = (qId) => {
    if (!window.confirm('确定要从试卷中删除本道题目吗？删除后试卷将重新排序与计分。')) return;
    if (!parsedExam || !parsedExam.questions) return;
    const filtered = parsedExam.questions.filter(q => q.id !== qId);
    filtered.forEach((q, idx) => {
      const newNum = idx + 1;
      q.num = String(newNum).padStart(2, '0');
    });
    setParsedExam(prev => ({
      ...prev,
      questions: filtered,
      questionCount: filtered.length
    }));
  };

  // Visual flash indicator for updated question
  const triggerFlashSuccess = (id) => {
    setFlashSuccessId(id);
    setTimeout(() => {
      setFlashSuccessId(null);
    }, 2500);
  };

  // Single Question AI Assist Modification
  const handleExecuteAiAssist = async (q, instructionType, customMsg = '') => {
    setAiAssistLoading(true);
    try {
      const res = await fetch('/api/model/question-edit-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          instructionType,
          customPrompt: customMsg || customAiPrompt
        })
      });
      const data = await res.json();
      if (data.success && data.updatedQuestion) {
        const newQ = data.updatedQuestion;
        setParsedExam(prev => ({
          ...prev,
          questions: prev.questions.map(item => item.id === q.id ? { ...item, ...newQ } : item)
        }));
        setAiAssistQId(null);
        setCustomAiPrompt('');
        triggerFlashSuccess(q.id);
        setAiEnhanceMessage(`✨ 题目 #${q.num || q.id} 已完成 AI 智能微调！已应用最新排版与分步推导。`);
      } else {
        alert(data.error || '单题 AI 辅助修改失败，请检查 API Key 配置。');
      }
    } catch (err) {
      alert(`AI 辅助修改调用异常: ${err.message}`);
    } finally {
      setAiAssistLoading(false);
    }
  };

  // Trigger 1:1 AI Clone
  const triggerAiCloneWithText = async (textToAnalyze, fileName = '导入试卷.pdf') => {
    if (!textToAnalyze || !textToAnalyze.trim()) {
      alert('请先输入或粘贴试卷内容');
      return;
    }
    setIsAiCloning(true);
    setCloneStage(1);

    try {
      const meta = extractExamMeta(textToAnalyze);
      const chunks = sliceMarkdownIntoChunks(textToAnalyze);
      setCloneStage(2);

      const allQuestions = [];
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i];
        setCloneStage(Math.min(3, 2 + ((i + 1) / chunks.length)));
        const res = await fetch('/api/model/parse-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chunk: {
              section: ch.section,
              passageTitle: ch.passageTitle,
              passage: ch.passage,
              rawQuestionsText: ch.rawQuestionsText
            },
            useAI: true
          })
        });
        const data = await res.json();
        if (data.success && data.questions) {
          allQuestions.push(...data.questions);
        }
      }

      setCloneStage(3);

      allQuestions.sort((a, b) => {
        const numA = parseInt(String(a.num || a.id).replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(String(b.num || b.id).replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      const paper = {
        id: 'cloned-' + Date.now(),
        title: meta.title || fileName.replace(/\.[^/.]+$/, '') || '1:1 AI 智能克隆试卷',
        source: '真题克隆 (篇章切片 AI 解析)',
        sourceType: 'ai-imported',
        date: '刚刚',
        questionCount: allQuestions.length,
        totalScore: meta.totalScore || 100,
        duration: meta.duration || 120,
        difficulty: 4,
        tags: ['#AI克隆', '#篇章切片', '#KaTeX高保真'],
        status: '未作答 (全新排版完毕)',
        typeBreakdown: {
          choices: allQuestions.filter(q => q.type.includes('选择')).length,
          blanks: allQuestions.filter(q => q.type.includes('填空')).length,
          solutions: allQuestions.filter(q => q.type.includes('解答') || q.type.includes('计算') || q.type.includes('证明')).length
        },
        markdown: textToAnalyze,
        questions: allQuestions
      };

      setCloneStage(4);
      setClonedPaperResult(paper);
      setUploadedFile({
        name: paper.title,
        size: '篇章切片解析完毕',
        status: '已由 AI 深度解析',
        progress: 100,
        matchedQuestions: paper.questionCount,
        choices: paper.typeBreakdown.choices,
        blanks: paper.typeBreakdown.blanks,
        solutions: paper.typeBreakdown.solutions
      });
    } catch (err) {
      alert(`AI 导入切片解析失败: ${err.message}`);
      setCloneStage(0);
    } finally {
      setIsAiCloning(false);
    }
  };

  const handleSimulateUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        reader.onload = (event) => {
          const content = event.target.result;
          setMarkdownText(content);
          setActiveMode('markdown');
        };
        reader.readAsText(file);
        return;
      }

      reader.onload = (event) => {
        const content = event.target.result;
        setCloneRawText(content);
        setUploadedFile(prev => ({
          ...prev,
          name: file.name,
          size: (file.size / 1024).toFixed(1) + 'KB',
          status: '已载入文件'
        }));
        triggerAiCloneWithText(content, file.name);
      };

      try {
        reader.readAsText(file);
      } catch {
        setUploadedFile(prev => ({ ...prev, name: file.name }));
      }
    }
  };

  const handleLaunchClone = () => {
    if (clonedPaperResult) {
      onStartExam(clonedPaperResult);
      return;
    }
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

  const handleLaunchMarkdownExam = () => {
    if (!parsedExam || !parsedExam.questions || parsedExam.questions.length === 0) {
      alert('未能从 Markdown 中解析到有效试题，请检查文本格式。');
      return;
    }

    const mdPaper = {
      id: 'md-exam-' + Date.now(),
      title: parsedExam.title || '《Markdown 自定义试卷》',
      source: 'Markdown 题稿生成 (AI 深度规整)',
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
              支持「1:1 历年真题 PDF 克隆」、「自由参数规格蓝图」与「Markdown 题稿即时转卷」，全量支持长文本篇章切片、KaTeX 矩阵排版与单题交互 AI 微调。
            </p>
          </div>

          {/* Telemetry Chips */}
          <div className="flex items-center gap-space-md font-label-mono text-label-mono flex-wrap">
            <div className="px-space-md py-space-xs rounded-lg bg-surface-container-lowest shadow-sm flex items-center gap-space-xs text-on-surface border border-outline-variant/30">
              <span className="material-symbols-outlined text-secondary text-[16px]">verified</span>
              <span>KaTeX 公式高保真排版: 就绪</span>
            </div>
            <div className="px-space-md py-space-xs rounded-lg bg-surface-container-lowest shadow-sm flex items-center gap-space-xs text-on-surface border border-outline-variant/30">
              <span className="material-symbols-outlined text-primary text-[16px]">auto_awesome</span>
              <span>model_core 全程自动 AI 介入</span>
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
            <span className="text-[10px] font-label-mono px-1.5 py-0.2 rounded bg-secondary-container text-on-secondary-container font-bold">无感 AI</span>
          </button>
        </div>

        {/* MODE 1: 1:1 PDF & Raw Exam Text AI Clone */}
        {activeMode === 'clone' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-xl items-stretch">
            {/* Left: Input (Dropzone + Direct Paste Textarea + AI Action) */}
            <section className="relative rounded-xl bg-surface-container-lowest shadow-sm p-space-xl border border-primary ring-2 ring-primary flex flex-col justify-between space-y-space-md">
              <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
              <div className="space-y-space-sm">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded bg-secondary/10 text-secondary font-label-mono text-label-mono font-medium">
                    <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                    <span>model_core 大模型全面介入分析</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  </div>
                </div>

                <div className="space-y-space-xs">
                  <h2 className="font-headline-lg text-headline-lg text-on-surface font-semibold">
                    真题文件 / 试题草稿 1:1 AI 智能克隆
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    导入任意非规范格式的真题文件或直接粘贴考题文本。底层大模型自动按篇章切分、推导分值、并将公式转录为标准矢量 LaTeX。
                  </p>
                </div>

                {/* Upload Dropzone */}
                <label className="rounded-xl bg-surface-container-low p-space-md text-center flex flex-col items-center justify-center transition-colors hover:bg-surface-container group/drop cursor-pointer border border-dashed border-outline-variant/60 block">
                  <input type="file" accept=".pdf,.docx,.tex,.md,.txt" onChange={handleSimulateUpload} className="hidden" />
                  <div className="w-10 h-10 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center text-primary group-hover/drop:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">cloud_upload</span>
                  </div>
                  <p className="mt-1 font-label-md text-label-md text-on-surface font-semibold">
                    选择或拖拽试卷文件至此处 (<span className="text-primary hover:underline">浏览本地文件</span>)
                  </p>
                  <p className="font-label-mono text-[11px] text-on-surface-variant">支持 .pdf, .docx, .tex, .md, .txt (自动分块解析长文本)</p>
                </label>

                {/* Direct Paste Raw Exam Textarea */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-primary">edit_note</span>
                      或直接在此粘贴试卷文本/题干内容：
                    </label>
                  </div>
                  <textarea
                    value={cloneRawText}
                    onChange={(e) => setCloneRawText(e.target.value)}
                    placeholder="可在此粘贴从 Word、PDF、网页或其他渠道复制的任意非结构化试卷文本..."
                    className="w-full h-32 p-space-sm bg-surface-container-low rounded-lg font-mono text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest border border-outline-variant/30 resize-none leading-relaxed"
                  />
                </div>

                {/* AI Multi-stage Progress Strip */}
                {isAiCloning && (
                  <div className="p-space-sm bg-secondary-container/30 border border-secondary/30 rounded-xl space-y-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-secondary font-label-sm font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                        <span>AI 智能格式深度解析中...</span>
                      </span>
                      <span className="font-mono">{cloneStage * 25}%</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-secondary h-full rounded-full transition-all duration-500"
                        style={{ width: `${cloneStage * 25}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-on-surface-variant font-label-mono">
                      {cloneStage === 1 && '正在读取文本并进行篇章切片...'}
                      {cloneStage === 2 && 'model_core 正在分析题型结构并自动计算合理分值...'}
                      {cloneStage === 3 && '正在将复杂公式转录为标准矢量 LaTeX 矩阵并生成标答...'}
                      {cloneStage >= 4 && '解析完毕！已生成标准交互试卷。'}
                    </p>
                  </div>
                )}
              </div>

              {/* Primary AI Trigger Button */}
              <div className="pt-space-md">
                <button
                  type="button"
                  onClick={() => triggerAiCloneWithText(cloneRawText.trim() || undefined, uploadedFile?.name || 'custom_exam.md')}
                  disabled={isAiCloning || (!cloneRawText.trim() && !uploadedFile)}
                  className="w-full h-11 px-space-lg rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[20px] ${isAiCloning ? 'animate-spin' : ''}`}>
                    {isAiCloning ? 'progress_activity' : 'bolt'}
                  </span>
                  <span>{isAiCloning ? '正在调用 model_core 深度解析中...' : '⚡ 启动 model_core AI 深度解析并克隆生成'}</span>
                </button>
              </div>
            </section>

            {/* Right: AI Output Preview Card & Quick Actions with Score/Duration Adjustments */}
            <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between space-y-space-md">
              <div className="space-y-space-md">
                <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">verified</span>
                    <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                      {clonedPaperResult ? 'AI 试卷模型解析生成成果' : '1:1 克隆技术特性'}
                    </h3>
                  </div>
                  {clonedPaperResult && (
                    <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-label-mono text-code-sm font-semibold">
                      就绪可开考
                    </span>
                  )}
                </div>

                {clonedPaperResult ? (
                  <div className="space-y-space-md">
                    {/* Header info with interactive Score / Duration / Title edit */}
                    <div className="p-space-md bg-surface-container-low rounded-xl space-y-3 border border-outline-variant/20">
                      <div>
                        <label className="text-[11px] font-label-mono text-on-surface-variant block mb-0.5">试卷标题</label>
                        <input
                          type="text"
                          value={clonedPaperResult.title}
                          onChange={(e) => setClonedPaperResult(p => ({ ...p, title: e.target.value }))}
                          className="w-full h-8 px-2 bg-surface-container-lowest rounded font-headline-sm text-on-surface font-bold border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {/* Score and Duration controls */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-surface-container-lowest flex items-center justify-between border border-outline-variant/20">
                          <div>
                            <span className="text-[11px] text-on-surface-variant block">试卷总分</span>
                            <span className="font-label-mono font-bold text-primary text-label-md">
                              {clonedPaperResult.totalScore} <span className="text-[10px] text-on-surface-variant">分</span>
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setClonedPaperResult(p => ({ ...p, totalScore: Math.max(10, p.totalScore - 10) }))}
                              className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-center font-bold cursor-pointer"
                            >-</button>
                            <button
                              type="button"
                              onClick={() => setClonedPaperResult(p => ({ ...p, totalScore: p.totalScore + 10 }))}
                              className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-center font-bold cursor-pointer"
                            >+</button>
                          </div>
                        </div>

                        <div className="p-2 rounded bg-surface-container-lowest flex items-center justify-between border border-outline-variant/20">
                          <div>
                            <span className="text-[11px] text-on-surface-variant block">建议限时</span>
                            <span className="font-label-mono font-bold text-secondary text-label-md">
                              {clonedPaperResult.duration} <span className="text-[10px] text-on-surface-variant">分钟</span>
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setClonedPaperResult(p => ({ ...p, duration: Math.max(10, p.duration - 10) }))}
                              className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-center font-bold cursor-pointer"
                            >-</button>
                            <button
                              type="button"
                              onClick={() => setClonedPaperResult(p => ({ ...p, duration: p.duration + 10 }))}
                              className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-center font-bold cursor-pointer"
                            >+</button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[12px] font-label-mono text-on-surface-variant">
                        <span>总题量: {clonedPaperResult.questionCount} 题</span>
                        <span>·</span>
                        <span>选择: {clonedPaperResult.typeBreakdown?.choices || 0}</span>
                        <span>·</span>
                        <span>填空: {clonedPaperResult.typeBreakdown?.blanks || 0}</span>
                        <span>·</span>
                        <span>解答: {clonedPaperResult.typeBreakdown?.solutions || 0}</span>
                      </div>
                    </div>

                    {/* Preview Questions */}
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {clonedPaperResult.questions.map((q, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 space-y-1 text-body-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-primary font-label-mono">第 {q.num || idx + 1} 题 ({q.type} · {q.score}分)</span>
                            <span className="text-secondary font-semibold font-mono text-[12px]">标答: {q.standardAnswer}</span>
                          </div>
                          <MathMarkdown content={q.prompt} className="text-on-surface font-medium" />
                          {q.analysis && (
                            <div className="p-2 rounded bg-surface-container text-[12px] text-on-surface-variant">
                              <span className="font-semibold text-primary">解析: </span>
                              <MathMarkdown content={q.analysis} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-space-sm">
                    <div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">format_shapes</span>
                      <div>
                        <p className="font-semibold text-label-md text-on-surface">全格式自适应大模型解析</p>
                        <p className="text-body-sm text-on-surface-variant">无需手动修改排版，大模型自动识别长篇篇章、题干、选项 A/B/C/D 与分步标答。</p>
                      </div>
                    </div>
                    <div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">functions</span>
                      <div>
                        <p className="font-semibold text-label-md text-on-surface">复杂高等数学 LaTeX 向量化</p>
                        <p className="text-body-sm text-on-surface-variant">对多重积分、偏导数、特征值矩阵与微积分展开式原位提取并完成 KaTeX 渲染。</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={handleLaunchClone}
                  className="w-full h-10 px-space-lg rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">play_circle</span>
                  <span>{clonedPaperResult ? '🚀 立即以此 AI 克隆试卷进入考场' : '直接进入预置考场'}</span>
                </button>
                {clonedPaperResult && (
                  <button
                    type="button"
                    onClick={() => {
                      if (clonedPaperResult.markdown) {
                        setMarkdownText(clonedPaperResult.markdown);
                      }
                      setActiveMode('markdown');
                    }}
                    className="w-full h-9 px-space-md rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md flex items-center justify-center gap-space-xs transition-colors cursor-pointer border border-outline-variant/30"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    <span>导入至 Markdown 工作台进行微调</span>
                  </button>
                )}
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
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setDuration(d => Math.max(30, d - 10))}
                      className="w-6 h-6 rounded bg-surface-container-lowest text-on-surface flex items-center justify-center hover:bg-surface-container shadow-xs cursor-pointer"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuration(d => Math.min(240, d + 10))}
                      className="w-6 h-6 rounded bg-surface-container-lowest text-on-surface flex items-center justify-center hover:bg-surface-container shadow-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
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

        {/* MODE 3: Markdown Generation Workbench with Full KaTeX UI & Seamless AI Ingestion */}
        {activeMode === 'markdown' && (
          <div className="flex flex-col gap-space-lg">
            {/* Control Bar */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-outline-variant/30 flex items-center justify-between gap-space-md flex-wrap">
              <div className="flex items-center gap-2 text-on-surface-variant font-label-sm">
                <span className="material-symbols-outlined text-[18px] text-primary">edit_note</span>
                <span>在左侧编写或粘贴 Markdown 试题，大模型自动实时按篇章切片并同步至 KaTeX 排版预览</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm transition-colors cursor-pointer border border-outline-variant/30 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>导入本地 Markdown</span>
                  <input type="file" accept=".md,.markdown,.txt" onChange={handleSimulateUpload} className="hidden" />
                </label>

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

            {/* AI Status / Notice Banner */}
            {aiEnhanceMessage && (
              <div className="p-3 bg-secondary-container/40 border border-secondary/30 rounded-xl text-secondary text-body-sm flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2 font-medium">
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  <span>{aiEnhanceMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAiEnhanceMessage('')}
                  className="text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {/* Split Screen: Editor on Left, KaTeX Live Preview with AI Loading & In-place Editing on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg items-stretch">
              {/* Left: Markdown Source Editor */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 p-space-lg flex flex-col justify-between space-y-space-sm">
                <div>
                  <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">edit_note</span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">Markdown 题稿源码编辑器</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isParsingAI && (
                        <span className="flex items-center gap-1 text-[11px] text-secondary font-semibold font-label-mono animate-pulse">
                          <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                          <span>AI 正在分析文本...</span>
                        </span>
                      )}
                      <span className="font-mono text-label-mono text-on-surface-variant">
                        {markdownText.length} 字符 · {markdownText.split('\n').length} 行
                      </span>
                    </div>
                  </div>

                  <textarea
                    value={markdownText}
                    onChange={(e) => setMarkdownText(e.target.value)}
                    placeholder="在此编写或粘贴 Markdown 试卷文本，大模型将自动实时切分与规整..."
                    className="w-full h-[620px] mt-2 p-3.5 bg-surface-container-low rounded-lg font-mono text-code-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest border border-outline-variant/30 leading-relaxed resize-none"
                  />
                </div>

                {/* Markdown format tips */}
                <div className="p-space-sm bg-surface-container-low rounded-lg text-[11px] text-on-surface-variant space-y-1 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-on-surface font-sans">💡 自动 AI 规整规范：</span>
                    <span className="text-[10px] text-primary">无需手动点按钮，停止输入后自动触发 AI</span>
                  </div>
                  <p>• 篇章材料：支持 <code>#### Text 1</code>、<code>#### 阅读篇章</code> 自动关联绑定下属考题</p>
                  <p>• 题号：支持 <code>### 1</code>、<code>### 21</code>，大题小问（1.证明 2.计算）将智能保留在题干内</p>
                  <p>• 分值：支持 <code>（本题满分 12 分）</code>，自动提取为分值并从题干剥离</p>
                  <p>• 标答与解析：支持 <code>**答案: ** A</code> 与 <code>**解析**</code> / <code>**解：**</code></p>
                </div>
              </div>

              {/* Right: Real-time KaTeX Live Exam Paper Preview with Rich Loading State & Interactive Editing */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 p-space-lg flex flex-col justify-between space-y-space-md relative overflow-hidden">
                <div className="space-y-space-md">
                  {/* Preview Header & AI Synchronizer Indicator */}
                  <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[18px]">functions</span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">KaTeX 高保真排版预览</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isParsingAI ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-mono text-[11px] font-semibold flex items-center gap-1.5 shadow-xs animate-pulse">
                          <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                          <span>AI 正在重构排版...</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-label-mono text-code-sm font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                          <span>已同步最新</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Top Paper Header Info: Interactive Title, Score, Duration Edit */}
                  {parsedExam && (
                    <div className="p-space-md bg-surface-container-low rounded-xl space-y-3 border border-outline-variant/20">
                      {/* Title Edit */}
                      <div>
                        <label className="text-[11px] font-label-mono text-on-surface-variant block mb-1">
                          试卷标题（点击可直接修改）
                        </label>
                        <input
                          type="text"
                          value={parsedExam.title || ''}
                          onChange={(e) => setParsedExam(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full px-2.5 py-1 bg-surface-container-lowest rounded font-headline-sm text-on-surface font-bold border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary text-[15px]"
                          placeholder="输入试卷标题..."
                        />
                      </div>

                      {/* Score, Duration and Recalculate Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Score Control */}
                        <div className="p-2 rounded-lg bg-surface-container-lowest flex items-center justify-between border border-outline-variant/20">
                          <div>
                            <span className="text-[11px] text-on-surface-variant block font-label-mono">全卷设定总分</span>
                            <div className="flex items-baseline gap-1">
                              <input
                                type="number"
                                value={parsedExam.totalScore || 100}
                                onChange={(e) => setParsedExam(prev => ({ ...prev, totalScore: Number(e.target.value) || 0 }))}
                                className="w-14 font-label-mono font-bold text-primary text-[16px] bg-transparent border-b border-primary/40 focus:outline-none"
                              />
                              <span className="text-[11px] text-on-surface-variant">分</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setParsedExam(prev => ({ ...prev, totalScore: Math.max(10, (prev.totalScore || 100) - 10) }))}
                              className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-bold flex items-center justify-center cursor-pointer text-[13px]"
                              title="减少 10 分"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => setParsedExam(prev => ({ ...prev, totalScore: (prev.totalScore || 100) + 10 }))}
                              className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-bold flex items-center justify-center cursor-pointer text-[13px]"
                              title="增加 10 分"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={handleRecalculateTotalScore}
                              className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold flex items-center gap-0.5 cursor-pointer ml-1"
                              title="按每道题目的当前分值自动累计总分"
                            >
                              <span className="material-symbols-outlined text-[13px]">calculate</span>
                              <span>重算</span>
                            </button>
                          </div>
                        </div>

                        {/* Duration Control */}
                        <div className="p-2 rounded-lg bg-surface-container-lowest flex items-center justify-between border border-outline-variant/20">
                          <div>
                            <span className="text-[11px] text-on-surface-variant block font-label-mono">建议测试时限</span>
                            <div className="flex items-baseline gap-1">
                              <input
                                type="number"
                                value={parsedExam.duration || 120}
                                onChange={(e) => setParsedExam(prev => ({ ...prev, duration: Number(e.target.value) || 0 }))}
                                className="w-14 font-label-mono font-bold text-secondary text-[16px] bg-transparent border-b border-secondary/40 focus:outline-none"
                              />
                              <span className="text-[11px] text-on-surface-variant">分钟</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setParsedExam(prev => ({ ...prev, duration: Math.max(10, (prev.duration || 120) - 10) }))}
                              className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-bold flex items-center justify-center cursor-pointer text-[13px]"
                              title="减少 10 分钟"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => setParsedExam(prev => ({ ...prev, duration: (prev.duration || 120) + 10 }))}
                              className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-bold flex items-center justify-center cursor-pointer text-[13px]"
                              title="增加 10 分钟"
                            >
                              +
                            </button>
                            <span className="material-symbols-outlined text-[16px] text-secondary ml-1">timer</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-label-mono text-on-surface-variant pt-0.5">
                        <span className="text-secondary font-semibold">
                          总计: {parsedExam.questions?.length || parsedExam.questionCount} 道试题
                        </span>
                        <span>可点击任意卡片上的「✏️ 编辑本题」或「✨ AI 辅助微调」</span>
                      </div>
                    </div>
                  )}

                  {/* Progressive Chunk Parsing Progress Strip */}
                  {isParsingAI && chunkProgress.total > 0 && (
                    <div className="p-3 rounded-xl bg-secondary-container/25 border border-secondary/30 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between text-[12px] font-semibold text-secondary">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                          <span>篇章切片解析中: {chunkProgress.summary}</span>
                        </span>
                        <span className="font-mono text-[11px] bg-secondary/15 px-2 py-0.5 rounded text-secondary font-bold">
                          {Math.round((chunkProgress.current / chunkProgress.total) * 100)}% ({chunkProgress.current}/{chunkProgress.total} 批次)
                        </span>
                      </div>
                      <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-secondary h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(5, (chunkProgress.current / chunkProgress.total) * 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-label-mono">
                        <span>轻量分段请求 · 规避 413 与 Token 溢出</span>
                        <span>每批仅处理当前篇章与 3~5 题</span>
                      </div>
                    </div>
                  )}

                  {/* Questions Stream / AI Loading Container */}
                  <div className="h-[490px] overflow-y-auto space-y-space-md pr-1.5 relative">
                    {/* Seamless Loading Overlay when Parsing */}
                    {isParsingAI && (!parsedExam || !parsedExam.questions || parsedExam.questions.length === 0) ? (
                      <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                            <span className="material-symbols-outlined text-[36px] animate-spin">progress_activity</span>
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-on-secondary text-[12px]">
                            <span className="material-symbols-outlined text-[12px]">bolt</span>
                          </div>
                        </div>

                        <div className="space-y-1 max-w-sm">
                          <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                            model_core 正在通过大模型进行深度语义解析与排版规整...
                          </h4>
                          <p className="text-body-sm text-on-surface-variant">
                            正在分析题目结构、分离题干与解答、处理长文篇章切片，并将高等数学公式规范为矢量 KaTeX。
                          </p>
                        </div>

                        {/* Skeleton Cards */}
                        <div className="w-full space-y-3 pt-2">
                          <div className="h-16 rounded-xl bg-surface-container-low animate-pulse"></div>
                          <div className="h-24 rounded-xl bg-surface-container-low animate-pulse"></div>
                          <div className="h-16 rounded-xl bg-surface-container-low animate-pulse"></div>
                        </div>
                      </div>
                    ) : parsedExam && parsedExam.questions && parsedExam.questions.length > 0 ? (
                      parsedExam.questions.map((q, idx) => {
                        const isAnalysisExpanded = expandedAnalysis[q.id || idx];
                        const isPassageExpanded = expandedPassages[q.id || idx];
                        const isEditingThis = editingQId === q.id;
                        const isAiTrayOpen = aiAssistQId === q.id;
                        const isFlashSuccess = flashSuccessId === q.id;

                        return (
                          <div
                            key={q.id || idx}
                            className={`p-space-md rounded-xl bg-surface-container-lowest border space-y-3 shadow-xs transition-all duration-300 ${
                              isFlashSuccess
                                ? 'border-secondary ring-2 ring-secondary/50 bg-secondary/5'
                                : isEditingThis
                                ? 'border-primary ring-2 ring-primary/40'
                                : 'border-outline-variant/30 hover:border-primary/40'
                            }`}
                          >
                            {/* Card Top: Number, Type, Score and Interactive Action Buttons */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary font-label-mono text-label-mono font-semibold">
                                  {q.num || String(idx + 1).padStart(2, '0')}
                                </span>
                                <span className="text-label-sm font-semibold text-on-surface">{q.type}</span>
                                <span className="text-primary font-semibold text-[12px] bg-surface-container px-2 py-0.5 rounded font-label-mono">
                                  {q.score} 分
                                </span>
                              </div>

                              {/* Question Action Buttons */}
                              <div className="flex items-center gap-1.5">
                                {/* AI Assist Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAiAssistQId(isAiTrayOpen ? null : q.id);
                                    setEditingQId(null);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg font-label-sm text-[12px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                                    isAiTrayOpen
                                      ? 'bg-secondary text-on-secondary shadow-xs'
                                      : 'bg-secondary-container/70 hover:bg-secondary hover:text-on-secondary text-secondary'
                                  }`}
                                  title="使用 AI 辅助微调、规范 LaTeX 或生成变式题"
                                >
                                  <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                                  <span>AI 辅助微调</span>
                                </button>

                                {/* Manual Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isEditingThis) {
                                      handleCancelEdit();
                                    } else {
                                      handleStartEdit(q);
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-lg font-label-sm text-[12px] transition-colors flex items-center gap-1 cursor-pointer ${
                                    isEditingThis
                                      ? 'bg-primary text-on-primary font-semibold'
                                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                                  }`}
                                  title="手动编辑题干、分值、选项与解析"
                                >
                                  <span className="material-symbols-outlined text-[14px]">
                                    {isEditingThis ? 'close' : 'edit'}
                                  </span>
                                  <span>{isEditingThis ? '取消' : '编辑本题'}</span>
                                </button>

                                {/* Delete Question */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="p-1 rounded-lg hover:bg-error/15 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                                  title="删除此题"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            </div>

                            {/* IN-PLACE MANUAL EDIT FORM */}
                            {isEditingThis && editForm && (
                              <div className="p-3 bg-surface-container-low rounded-xl border border-primary/30 space-y-3 animate-in fade-in duration-150">
                                <div className="flex items-center justify-between pb-1 border-b border-outline-variant/20">
                                  <span className="font-semibold text-primary text-[13px] flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[15px]">edit_note</span>
                                    编辑题目 #{editForm.num} 属性与内容
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[11px] text-on-surface-variant block mb-0.5">题型</label>
                                    <select
                                      value={editForm.type}
                                      onChange={(e) => setEditForm(f => ({ ...f, type: e.target.value }))}
                                      className="w-full h-8 px-2 bg-surface-container-lowest rounded text-[12px] border border-outline-variant/30 text-on-surface focus:outline-none"
                                    >
                                      <option value="单项选择题">单项选择题</option>
                                      <option value="多项选择题">多项选择题</option>
                                      <option value="填空题">填空题</option>
                                      <option value="综合计算与解答题">综合计算与解答题</option>
                                      <option value="证明题">证明题</option>
                                      <option value="阅读理解题">阅读理解题</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="text-[11px] text-on-surface-variant block mb-0.5">分值 (分)</label>
                                    <input
                                      type="number"
                                      value={editForm.score}
                                      onChange={(e) => setEditForm(f => ({ ...f, score: e.target.value }))}
                                      className="w-full h-8 px-2 bg-surface-container-lowest rounded text-[12px] border border-outline-variant/30 text-on-surface focus:outline-none font-mono"
                                    />
                                  </div>

                                  <div>
                                    <label className="text-[11px] text-on-surface-variant block mb-0.5">标准答案</label>
                                    <input
                                      type="text"
                                      value={editForm.standardAnswer}
                                      onChange={(e) => setEditForm(f => ({ ...f, standardAnswer: e.target.value }))}
                                      className="w-full h-8 px-2 bg-surface-container-lowest rounded text-[12px] border border-outline-variant/30 text-on-surface focus:outline-none font-mono"
                                      placeholder="如: A, 2, 详见证明"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[11px] text-on-surface-variant block mb-0.5">题干内容 (支持 KaTeX)</label>
                                  <textarea
                                    value={editForm.prompt}
                                    onChange={(e) => setEditForm(f => ({ ...f, prompt: e.target.value }))}
                                    className="w-full h-24 p-2 bg-surface-container-lowest rounded text-[13px] border border-outline-variant/30 text-on-surface focus:outline-none font-mono leading-relaxed"
                                  />
                                </div>

                                {/* Options Editor if applicable */}
                                {editForm.options && editForm.options.length > 0 && (
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] text-on-surface-variant block">选项内容</label>
                                    {editForm.options.map((opt, optIdx) => (
                                      <div key={optIdx} className="flex items-center gap-1.5">
                                        <span className="w-6 font-mono font-bold text-primary text-center">({opt.key})</span>
                                        <input
                                          type="text"
                                          value={opt.text}
                                          onChange={(e) => {
                                            const newOpts = [...editForm.options];
                                            newOpts[optIdx].text = e.target.value;
                                            setEditForm(f => ({ ...f, options: newOpts }));
                                          }}
                                          className="flex-1 h-7 px-2 bg-surface-container-lowest rounded text-[12px] border border-outline-variant/30 font-mono text-on-surface"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div>
                                  <label className="text-[11px] text-on-surface-variant block mb-0.5">分步解析 / 踩分点 (支持 LaTeX)</label>
                                  <textarea
                                    value={editForm.analysis}
                                    onChange={(e) => setEditForm(f => ({ ...f, analysis: e.target.value }))}
                                    className="w-full h-24 p-2 bg-surface-container-lowest rounded text-[13px] border border-outline-variant/30 text-on-surface focus:outline-none font-mono leading-relaxed"
                                  />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1 rounded bg-surface-container text-on-surface text-[12px] hover:bg-surface-container-high cursor-pointer"
                                  >
                                    取消
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveEdit}
                                    className="px-3.5 py-1 rounded bg-primary text-on-primary font-semibold text-[12px] hover:bg-primary-container cursor-pointer shadow-xs"
                                  >
                                    保存本题修改
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* AI ASSIST EXPANDED TRAY */}
                            {isAiTrayOpen && (
                              <div className="p-3 bg-secondary-container/20 rounded-xl border border-secondary/30 space-y-2.5 animate-in fade-in duration-150">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-secondary font-semibold text-[13px]">
                                    <span className="material-symbols-outlined text-[16px]">magic_button</span>
                                    <span>AI 智能辅助微调本题 (model_core)</span>
                                  </div>
                                  <span className="text-[11px] text-on-surface-variant">选择快捷指令或输入自定义要求</span>
                                </div>

                                {/* Preset Action Pills */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                  <button
                                    type="button"
                                    disabled={aiAssistLoading}
                                    onClick={() => handleExecuteAiAssist(q, 'format')}
                                    className="p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface text-left text-[11px] font-medium border border-outline-variant/30 transition-all cursor-pointer flex flex-col gap-0.5 disabled:opacity-50"
                                  >
                                    <span className="font-semibold text-primary flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px]">tune</span>
                                      规范 LaTeX
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant">校准符号与数学排版</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={aiAssistLoading}
                                    onClick={() => handleExecuteAiAssist(q, 'variant')}
                                    className="p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface text-left text-[11px] font-medium border border-outline-variant/30 transition-all cursor-pointer flex flex-col gap-0.5 disabled:opacity-50"
                                  >
                                    <span className="font-semibold text-secondary flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px]">restart_alt</span>
                                      同考点变式题
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant">举一反三生成同构新题</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={aiAssistLoading}
                                    onClick={() => handleExecuteAiAssist(q, 'expand_analysis')}
                                    className="p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface text-left text-[11px] font-medium border border-outline-variant/30 transition-all cursor-pointer flex flex-col gap-0.5 disabled:opacity-50"
                                  >
                                    <span className="font-semibold text-on-surface flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px]">school</span>
                                      扩充分步解析
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant">增补踩分点与易错避坑</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={aiAssistLoading}
                                    onClick={() => handleExecuteAiAssist(q, 'adjust_difficulty', '适度提升综合推导量与考查深度')}
                                    className="p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface text-left text-[11px] font-medium border border-outline-variant/30 transition-all cursor-pointer flex flex-col gap-0.5 disabled:opacity-50"
                                  >
                                    <span className="font-semibold text-primary flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px]">trending_up</span>
                                      提升考查难度
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant">增加综合思维深度</span>
                                  </button>
                                </div>

                                {/* Custom instruction input */}
                                <div className="flex items-center gap-1.5 pt-1">
                                  <input
                                    type="text"
                                    value={customAiPrompt}
                                    onChange={(e) => setCustomAiPrompt(e.target.value)}
                                    placeholder="或输入针对本题的个性化修改指令，如：'把数字2改成3重新推导' 或 '将选择题改成填空题'..."
                                    className="flex-1 h-8 px-2.5 bg-surface-container-lowest rounded text-[12px] border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                                  />
                                  <button
                                    type="button"
                                    disabled={aiAssistLoading || !customAiPrompt.trim()}
                                    onClick={() => handleExecuteAiAssist(q, 'custom', customAiPrompt)}
                                    className="h-8 px-3 rounded bg-secondary hover:bg-secondary/90 text-on-secondary font-semibold text-[12px] transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1 shrink-0"
                                  >
                                    {aiAssistLoading ? (
                                      <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                    ) : (
                                      <span className="material-symbols-outlined text-[14px]">send</span>
                                    )}
                                    <span>{aiAssistLoading ? '微调中...' : '发送指令'}</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Reading Passage Block (for English / Long text papers) */}
                            {q.passage && (
                              <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 text-body-sm space-y-1">
                                <div className="flex items-center justify-between text-secondary font-semibold font-label-sm">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px]">menu_book</span>
                                    <span>{q.passageTitle || '关联阅读篇章 / 材料'}</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => togglePassage(q.id || idx)}
                                    className="text-[12px] text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                                  >
                                    <span>{isPassageExpanded ? '收起材料' : '展开阅读材料'}</span>
                                    <span className="material-symbols-outlined text-[14px]">
                                      {isPassageExpanded ? 'expand_less' : 'expand_more'}
                                    </span>
                                  </button>
                                </div>
                                {isPassageExpanded && (
                                  <div className="max-h-56 overflow-y-auto p-2 bg-surface-container-lowest rounded text-[13px] leading-relaxed text-on-surface mt-1 border border-outline-variant/20 whitespace-pre-line font-sans">
                                    <MathMarkdown content={q.passage} />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Question Prompt rendered via MathMarkdown */}
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
                    <span>确认此试卷并进入全真考场</span>
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

            {/* Blueprint Action Card */}
            <div
              onClick={() => {
                setActiveMode('markdown');
              }}
              className="rounded-xl bg-surface-container-low p-space-md flex flex-col justify-between hover:bg-surface-container transition-colors group cursor-pointer border border-dashed border-outline-variant/60"
            >
              <div className="space-y-space-xs">
                <div className="flex items-center justify-between">
                  <span className="px-space-xs py-0.5 rounded bg-surface-container-lowest text-on-surface-variant font-label-mono text-label-mono">
                    Markdown 快速组卷
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">markdown</span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                  即时编写或导入 Markdown
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant">由大模型自动分批切片并规整为矢量 KaTeX 试卷</p>
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
