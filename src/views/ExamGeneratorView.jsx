import React, { useState, useEffect, useMemo, useRef } from 'react';
import MathMarkdown from '../components/MathMarkdown';
import SelectMenu from '../components/SelectMenu';
import { extractExamMeta, sliceMarkdownIntoChunks } from '../utils/examChunker';
import { calculatePaperMetrics } from '../utils/paperMetrics';
import { getQuestionTypeClass } from '../utils/questionTypes';

function loadGeneratorSession() {
  try {
    const session = JSON.parse(localStorage.getItem('examcraft_generator_session') || 'null');
    return session && typeof session === 'object' ? session : null;
  } catch {
    return null;
  }
}

async function loadStructuredRetryLimit() {
  try {
    const response = await fetch('/api/model/config');
    const data = await response.json();
    const limit = Number(data?.config?.structuredRetryLimit);
    return Number.isFinite(limit) ? Math.min(10, Math.max(3, Math.floor(limit))) : 3;
  } catch {
    return 3;
  }
}

export default function ExamGeneratorView({ papers, onStartExam, onSavePaper, onNavigate }) {
  const [restoredSession] = useState(loadGeneratorSession);
  const [activeMode, setActiveMode] = useState(() => (
    restoredSession?.activeMode || (restoredSession?.parseInProgress ? 'markdown' : 'clone')
  ));
  const [saveToast, setSaveToast] = useState(null); // { title: string, id: string }
  
  // Custom Spec State (Entry 2)
  
  // Markdown Generator State (Entry 3)
  const [markdownText, setMarkdownText] = useState(() => restoredSession?.markdownText || '');
  const markdownBatchCount = useMemo(
    () => markdownText.trim() ? sliceMarkdownIntoChunks(markdownText).length : 0,
    [markdownText]
  );
  const [parsedExam, setParsedExam] = useState(() => restoredSession?.parsedExam || null);
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [showAnswers, setShowAnswers] = useState(() => {
    try { return localStorage.getItem('examcraft_exam_show_answers_default') !== 'false'; }
    catch { return true; }
  });
  const [expandedAnalysis, setExpandedAnalysis] = useState({}); // { [qId]: boolean }
  const [expandedPassages, setExpandedPassages] = useState({}); // { [qId]: boolean }
  const [aiEnhanceMessage, setAiEnhanceMessage] = useState(() => (
    restoredSession?.parseInProgress
      ? '上次解析因离开页面而中断；草稿和已完成批次已恢复，点击 AI 解析可继续。'
      : ''
  ));
  const [parseUsageSummary, setParseUsageSummary] = useState(() => restoredSession?.parseUsageSummary || null);
  const [parseNeedsResume, setParseNeedsResume] = useState(() => Boolean(restoredSession?.parseInProgress));
  const [parseSourceText, setParseSourceText] = useState(() => restoredSession?.parseSourceText || (restoredSession?.parseInProgress ? restoredSession?.markdownText || '' : ''));

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
  const [isReadingPdf, setIsReadingPdf] = useState(false);

  const activeJobIdRef = useRef(0);
  const parseRequestInFlightRef = useRef(false);
  const parseAbortControllerRef = useRef(null);
  const cloneRequestInFlightRef = useRef(false);
  const [parsedMarkdownSource, setParsedMarkdownSource] = useState(() => restoredSession?.parsedMarkdownSource || '');
  const [completedChunkCount, setCompletedChunkCount] = useState(() => Number(restoredSession?.completedChunkCount) || 0);
  const [chunkProgress, setChunkProgress] = useState(() => restoredSession?.chunkProgress || { current: 0, total: 0, summary: '' });

  useEffect(() => {
    try {
      localStorage.setItem('examcraft_generator_session', JSON.stringify({
        activeMode,
        markdownText,
        parsedExam,
        parsedMarkdownSource,
        chunkProgress,
        completedChunkCount,
        parseUsageSummary,
        parseSourceText,
        parseInProgress: isParsingAI || parseNeedsResume
      }));
    } catch {}
  }, [activeMode, markdownText, parsedExam, parsedMarkdownSource, chunkProgress, completedChunkCount, parseUsageSummary, parseSourceText, isParsingAI, parseNeedsResume]);

  useEffect(() => () => {
    activeJobIdRef.current += 1;
    if (parseAbortControllerRef.current) {
      parseAbortControllerRef.current.abort();
      try {
        const session = loadGeneratorSession() || {};
        session.parseInProgress = true;
        localStorage.setItem('examcraft_generator_session', JSON.stringify(session));
      } catch {}
    }
  }, []);

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
  const runProgressiveChunkParser = async (mdText, { resume = true } = {}) => {
    if (!mdText || !mdText.trim()) return;
    if (parseRequestInFlightRef.current || isParsingAI) return;
    const chunks = sliceMarkdownIntoChunks(mdText);
    const savedSession = loadGeneratorSession();
    const canResume = Boolean(
      resume &&
      savedSession?.parseInProgress &&
      (savedSession.parseSourceText || savedSession.markdownText) === mdText &&
      Number(savedSession.completedChunkCount) > 0
    );
    const resumeFrom = canResume
      ? Math.min(chunks.length, Math.max(0, Number(savedSession.completedChunkCount) || 0))
      : 0;
    const scoreContext = mdText.split(/\r?\n/)
      .filter(line => /\d/.test(line) && /每(?:小)?题|小题.*分|题.*每.*分/.test(line))
      .slice(0, 30)
      .join('\n');
    if (chunks.length > 12 && !window.confirm(`这份题稿将拆为 ${chunks.length} 批，产生多次模型调用。仍要继续吗？建议先拆分题稿。`)) return;

    parseRequestInFlightRef.current = true;
    const currentJobId = ++activeJobIdRef.current;
    const controller = new AbortController();
    parseAbortControllerRef.current = controller;
    setParseNeedsResume(false);
    setIsParsingAI(true);
    setParseSourceText(mdText);
    const usageSummary = canResume && savedSession.parseUsageSummary
      ? { ...savedSession.parseUsageSummary, totalCalls: chunks.length, complete: false }
      : {
      completedCalls: 0,
      totalCalls: chunks.length,
      totalTokens: 0,
      estimatedCostCny: 0,
      pricedCalls: 0,
      unpricedCalls: 0,
      structuredRetries: 0,
      fallbackCalls: 0,
      truncatedCalls: 0,
      complete: false
    };
    setParseUsageSummary(usageSummary);
    const retryLimitForRun = await loadStructuredRetryLimit();
    usageSummary.retryLimit = retryLimitForRun;
    setParseUsageSummary({ ...usageSummary });
    let retryBudgetRemaining = Math.max(0, retryLimitForRun - (Number(usageSummary.structuredRetries) || 0));

    // 1. Instantly parse metadata in client
    const meta = extractExamMeta(mdText);
    setParsedExam(prev => ({
      title: meta.title,
      duration: meta.duration,
      totalScore: meta.totalScore,
      questionCount: canResume ? (savedSession.parsedExam?.questions?.length || 0) : 0,
      questions: canResume ? (savedSession.parsedExam?.questions || []) : []
    }));

    // 2. Slice into lightweight passage-aware chunks
    setChunkProgress({ current: resumeFrom, total: chunks.length, summary: chunks[resumeFrom]?.summary || (resumeFrom ? '准备继续未完成批次...' : '准备切片解析...') });
    setCompletedChunkCount(resumeFrom);

    const accumulatedQuestions = canResume ? [...(savedSession.parsedExam?.questions || [])] : [];
    let interrupted = false;

    for (let i = resumeFrom; i < chunks.length; i++) {
      if (activeJobIdRef.current !== currentJobId) {
        parseRequestInFlightRef.current = false;
        setIsParsingAI(false);
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
              rawQuestionsText: ch.rawQuestionsText,
              expectedQuestionNumbers: ch.qNums,
              examTitle: meta.title,
              scoreContext
            },
            useAI: true,
            structuredRetryBudget: retryBudgetRemaining
          }),
          signal: controller.signal
        });

        if (activeJobIdRef.current !== currentJobId) return;

        const data = await res.json();
        if (!res.ok || !data.success) {
          interrupted = true;
          setAiEnhanceMessage(`第 ${i + 1} 批解析未完成（${data.error || res.statusText || '请求失败'}），已保留之前结果；点击 AI 解析可重试此批及后续批次。`);
          break;
        }
        const retriesUsed = Number(data.structuredRetryCount) || 0;
        usageSummary.structuredRetries += retriesUsed;
        retryBudgetRemaining = Math.max(0, retryBudgetRemaining - retriesUsed);
        if (data.mode === 'algorithmic') usageSummary.fallbackCalls += 1;
        if (data.truncationDetected) usageSummary.truncatedCalls = (Number(usageSummary.truncatedCalls) || 0) + 1;
        setParseUsageSummary({ ...usageSummary });
        if (data.usage?.usageReported) {
          usageSummary.completedCalls += 1;
          const inputTokens = Number(data.usage.inputTokens) || 0;
          const outputTokens = Number(data.usage.outputTokens) || 0;
          usageSummary.totalTokens += Number(data.usage.totalTokens) || inputTokens + outputTokens;
          if (Number.isFinite(Number(data.usage.estimatedCostCny))) {
            usageSummary.estimatedCostCny += Number(data.usage.estimatedCostCny);
            usageSummary.pricedCalls += 1;
          } else {
            usageSummary.unpricedCalls += 1;
          }
          setParseUsageSummary({ ...usageSummary });
        }
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
        setCompletedChunkCount(i + 1);
      } catch (err) {
        console.warn(`[Chunk ${i + 1} parse error]:`, err.message);
        interrupted = true;
        if (!controller.signal.aborted) {
          setAiEnhanceMessage(`第 ${i + 1} 批解析连接中断，已保留之前结果；点击 AI 解析可从未完成批次继续。`);
        }
        break;
      }
    }

    if (activeJobIdRef.current === currentJobId) {
      if (!interrupted) {
        setChunkProgress({ current: chunks.length, total: chunks.length, summary: '切片解析完成' });
        setParsedMarkdownSource(mdText);
      }
      parseRequestInFlightRef.current = false;
      parseAbortControllerRef.current = null;
      setIsParsingAI(false);
      usageSummary.complete = !interrupted;
      setParseUsageSummary({ ...usageSummary });
      setParseNeedsResume(interrupted);
      if (!interrupted) {
        const retryNotice = usageSummary.structuredRetries > 0 ? `结构错误已反馈模型并纠正重试 ${usageSummary.structuredRetries} 次。` : '';
        const fallbackNotice = usageSummary.fallbackCalls > 0 ? `${usageSummary.fallbackCalls} 批使用了本地规则解析，请检查这些题目。` : '';
        const truncationNotice = usageSummary.truncatedCalls > 0 ? `${usageSummary.truncatedCalls} 批输出触及上限，已停止重复纠错并使用本地规则兜底，请重点检查。` : '';
        setAiEnhanceMessage(`🎉 分篇解析完成：${chunks.length} 批，规整 ${accumulatedQuestions.length} 道试题。${retryNotice}${fallbackNotice}${truncationNotice}`);
      }
    }
  };

  const importTextIntoMarkdownParser = async (text) => {
    const content = String(text || '').trim();
    if (!content) {
      alert('没有读取到试卷文字，请检查文件内容或重新粘贴。');
      return;
    }
    if (parseRequestInFlightRef.current || isParsingAI) return;

    setCloneRawText(content);
    setMarkdownText(content);
    setParsedExam(null);
    setParsedMarkdownSource('');
    setCompletedChunkCount(0);
    setChunkProgress({ current: 0, total: 0, summary: '' });
    setParseNeedsResume(false);
    setAiEnhanceMessage('');
    setActiveMode('markdown');
    await runProgressiveChunkParser(content, { resume: false });
  };

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

  // Parse text extracted by the user or uploaded from a supported text file.
  const triggerAiCloneWithText = async (textToAnalyze, fileName = '导入试卷.pdf') => {
    if (!textToAnalyze || !textToAnalyze.trim()) {
      alert('请先输入或粘贴试卷内容');
      return;
    }
    if (cloneRequestInFlightRef.current || isAiCloning) return;
    const chunks = sliceMarkdownIntoChunks(textToAnalyze);
    if (chunks.length > 12 && !window.confirm(`这份试卷将拆为 ${chunks.length} 批，产生多次模型调用。仍要继续吗？建议先拆分试卷。`)) return;
    cloneRequestInFlightRef.current = true;
    setIsAiCloning(true);
    setCloneStage(1);

    try {
      const meta = extractExamMeta(textToAnalyze);
      setCloneStage(2);

      const allQuestions = [];
      let retryBudgetRemaining = await loadStructuredRetryLimit();
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
              rawQuestionsText: ch.rawQuestionsText,
              expectedQuestionNumbers: ch.qNums,
              examTitle: meta.title
            },
            useAI: true,
            structuredRetryBudget: retryBudgetRemaining
          })
        });
        const data = await res.json();
        retryBudgetRemaining = Math.max(0, retryBudgetRemaining - (Number(data?.structuredRetryCount) || 0));
        if (data.success && data.questions) {
          allQuestions.push(...data.questions);
        }
      }

      if (allQuestions.length === 0) {
        throw new Error('没有识别到有效题目。请检查文本内容，或切换到 Markdown 工作台整理题稿。');
      }

      setCloneStage(3);

      allQuestions.sort((a, b) => {
        const numA = parseInt(String(a.num || a.id).replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(String(b.num || b.id).replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      const paper = {
        id: 'cloned-' + Date.now(),
        title: meta.title || fileName.replace(/\.[^/.]+$/, '') || 'AI 识别试卷',
        source: '试卷文本识别',
        sourceType: 'ai-imported',
        date: '刚刚',
        questionCount: allQuestions.length,
        totalScore: meta.totalScore || 100,
        duration: meta.duration || 120,
        difficulty: calculatePaperMetrics({ title: meta.title, questions: allQuestions, duration: meta.duration }).difficulty,
        tags: ['#文本识别', '#篇章切片', '#KaTeX排版'],
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
      cloneRequestInFlightRef.current = false;
      setIsAiCloning(false);
    }
  };

  const extractPdfText = async (file) => {
    const [pdfjsLib, workerModule] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    ]);
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const linesByY = new Map();
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 2) * 2;
        const line = linesByY.get(y) || [];
        line.push({ x: item.transform[4], text: item.str.trim() });
        linesByY.set(y, line);
      }
      const lines = [...linesByY.entries()]
        .sort(([yA], [yB]) => yB - yA)
        .map(([, line]) => line.sort((a, b) => a.x - b.x).map(item => item.text).join(' '));
      pages.push(lines.join('\n'));
    }

    return { text: pages.join('\n\n').trim(), pages };
  };

  const handleSimulateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    e.target.value = '';
    if (!['pdf', 'md', 'markdown', 'tex', 'txt'].includes(extension)) {
      alert('当前支持 PDF、Markdown、TeX 和 TXT 文件。Word 文档请先复制题目文本后粘贴到输入框。');
      return;
    }

    if (extension === 'pdf') {
      setIsReadingPdf(true);
      setUploadedFile({ name: file.name, size: (file.size / 1024).toFixed(1) + 'KB', status: '正在提取 PDF 文字…' });
      try {
        const { text: content } = await extractPdfText(file);
        if (!content) {
          throw new Error('未提取到可选文字。该文件可能是扫描图片版 PDF，目前需要先 OCR 或复制文字后粘贴。');
        }
        setUploadedFile(null);
        setIsReadingPdf(false);
        await importTextIntoMarkdownParser(content);
      } catch (error) {
        setUploadedFile(null);
        alert(`PDF 导入失败：${error.message || '无法读取文件'}`);
      } finally {
        setIsReadingPdf(false);
      }
      return;
    }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        setUploadedFile(null);
        importTextIntoMarkdownParser(content);
      };

      try {
        reader.readAsText(file);
      } catch {
        setUploadedFile(prev => ({ ...prev, name: file.name }));
      }
  };

  const handleSaveClone = (goToLibrary = false) => {
    if (!clonedPaperResult) return;
    if (onSavePaper) {
      onSavePaper(clonedPaperResult, goToLibrary);
    }
    setSaveToast({ title: clonedPaperResult.title, id: clonedPaperResult.id });
    setTimeout(() => setSaveToast(null), 4000);
  };

  const handleLaunchClone = () => {
    if (clonedPaperResult) onStartExam(clonedPaperResult);
  };

  const buildMarkdownPaperObject = () => {
    if (!parsedExam || !parsedExam.questions || parsedExam.questions.length === 0) {
      return null;
    }

    return {
      id: parsedExam.id || ('md-exam-' + Date.now()),
      title: parsedExam.title || '《Markdown 自定义试卷》',
      source: 'Markdown 题稿生成 (AI 深度规整)',
      sourceType: 'markdown',
      date: '刚刚',
      questionCount: parsedExam.questions.length,
      totalScore: parsedExam.totalScore || 100,
      duration: parsedExam.duration || 120,
      difficulty: calculatePaperMetrics(parsedExam).difficulty,
      tags: ['#Markdown录入', '#KaTeX公式渲染', '#已存试卷库'],
      status: '未作答 (已保存)',
      questions: parsedExam.questions
    };
  };

  const handleSaveMarkdownExam = (goToLibrary = false) => {
    const paper = buildMarkdownPaperObject();
    if (!paper) {
      alert('未能从 Markdown 中解析到有效试题，请先在左侧输入试卷内容。');
      return;
    }

    // Persist parsedExam id so repeated saves modify the same paper
    setParsedExam(prev => ({ ...prev, id: paper.id }));
    if (onSavePaper) {
      onSavePaper(paper, goToLibrary);
    }
    setSaveToast({ title: paper.title, id: paper.id });
    setTimeout(() => setSaveToast(null), 4000);
  };

  const handleLaunchMarkdownExam = () => {
    const paper = buildMarkdownPaperObject();
    if (!paper) {
      alert('未能从 Markdown 中解析到有效试题，请检查文本格式。');
      return;
    }

    onStartExam(paper);
  };

  const canContinueParse = Boolean(
    parseNeedsResume &&
    parseSourceText === markdownText &&
    completedChunkCount > 0 &&
    completedChunkCount < markdownBatchCount
  );
  const hasCurrentParse = Boolean(
    markdownText.trim() && (
      (parsedExam?.questions?.length && parsedMarkdownSource === markdownText) ||
      (parseSourceText === markdownText && (parseNeedsResume || completedChunkCount > 0))
    )
  );

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
              <span>试卷创建工作台 · 两种方式 · 统一进入考场</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-semibold">
              创建或导入试卷
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              导入识别已有试卷，或编写 Markdown 题稿并生成可作答试卷。
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
              <span>按需使用 AI 解析与整理</span>
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
            <span className="flex flex-col items-start text-left leading-tight">
              <span>识别已有试卷</span>
              <span className={`mt-0.5 text-[10px] font-normal ${activeMode === 'clone' ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>上传或粘贴 · AI 结构化</span>
            </span>
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
            <span className="flex flex-col items-start text-left leading-tight">
              <span>编辑 Markdown 题稿</span>
              <span className={`mt-0.5 text-[10px] font-normal ${activeMode === 'markdown' ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>编写或导入 · 实时预览</span>
            </span>
          </button>
        </div>

        {/* MODE 1: Raw Exam Text Parsing */}
        {activeMode === 'clone' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-xl items-stretch">
            {/* Left: Input (Dropzone + Direct Paste Textarea + AI Action) */}
            <section className="relative rounded-xl bg-surface-container-lowest shadow-sm p-space-xl border border-primary ring-2 ring-primary flex flex-col justify-between space-y-space-md">
              <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
              <div className="space-y-space-sm">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded bg-secondary/10 text-secondary font-label-mono text-label-mono font-medium">
                    <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                    <span>导入原卷 · 识别后可选下一步</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  </div>
                </div>

                <div className="space-y-space-xs">
                  <h2 className="font-headline-lg text-headline-lg text-on-surface font-semibold">
                    试卷文本识别与结构化
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    上传支持的文本文件或粘贴题目内容，AI 会整理为可作答试卷。解析后可直接进入考场，或转到 Markdown 工作台微调；原文件版式与图片不会保留。
                  </p>
                </div>

                {/* Upload Dropzone */}
                <label className="rounded-xl bg-surface-container-low p-space-md text-center flex flex-col items-center justify-center transition-colors hover:bg-surface-container group/drop cursor-pointer border border-dashed border-outline-variant/60 block">
                  <input type="file" accept=".pdf,.tex,.md,.markdown,.txt,application/pdf,text/plain,text/markdown" onChange={handleSimulateUpload} className="hidden" disabled={isReadingPdf || isParsingAI} />
                  <div className="w-10 h-10 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center text-primary group-hover/drop:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">cloud_upload</span>
                  </div>
                  <p className="mt-1 font-label-md text-label-md text-on-surface font-semibold">
                    选择或拖拽试卷文件至此处 (<span className="text-primary hover:underline">浏览本地文件</span>)
                  </p>
                  <p className="font-label-mono text-[11px] text-on-surface-variant">支持 PDF、Markdown、TeX、TXT；PDF 将提取文字后交由 AI 识别，扫描版 PDF 需先 OCR</p>
                </label>
                {isReadingPdf && (
                  <p className="flex items-center gap-1.5 text-xs text-primary" role="status" aria-live="polite">
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    正在读取 PDF 页面并提取文字…
                  </p>
                )}

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
                  onClick={() => importTextIntoMarkdownParser(cloneRawText)}
                  disabled={isReadingPdf || isParsingAI || !cloneRawText.trim()}
                  className="w-full h-11 px-space-lg rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[20px] ${isParsingAI ? 'animate-spin' : ''}`}>
                    {isParsingAI ? 'progress_activity' : 'bolt'}
                  </span>
                  <span>{isReadingPdf ? '正在提取 PDF 文字…' : isParsingAI ? '正在分批解析试题…' : 'AI 识别并生成试卷'}</span>
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
                      {clonedPaperResult ? '试卷识别结果' : '文本识别能力'}
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
                            <span className="font-semibold font-label-mono text-on-surface">第 {q.num || idx + 1} 题</span>
                            <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${getQuestionTypeClass(q.type)}`}>{q.type}</span>
                            <span className="text-primary font-semibold font-label-mono">{q.score}分</span>
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
                      <p className="text-body-sm text-on-surface-variant">自动识别篇章、题干、选项与标答，并整理为结构化试题。</p>
                      </div>
                    </div>
                    <div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">functions</span>
                      <div>
                        <p className="font-semibold text-label-md text-on-surface">复杂高等数学 LaTeX 向量化</p>
                        <p className="text-body-sm text-on-surface-variant">对多重积分、偏导数、特征值矩阵与微积分展开式原位提取并完成 KaTeX 渲染。</p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-primary/15 bg-primary/5 px-space-md py-space-sm text-body-sm text-on-surface-variant">
                      <div className="font-label-md font-semibold text-primary">识别完成后的去向</div>
                      <p className="mt-1">直接开考会留在入口一的流程；需要手动改题稿时，再选择下方“转到 Markdown 工作台”。</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-2 border-t border-surface-container">
                {clonedPaperResult ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveClone(false)}
                      className="flex-1 h-10 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-headline-sm text-label-md flex items-center justify-center gap-1.5 border border-primary/30 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                      title="保存试卷到试卷库，后续可随时开考或管理"
                    >
                      <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
                      <span>保存试卷到试卷库</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLaunchClone}
                      className="flex-[1.2] h-10 px-4 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-label-md flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.99] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">play_circle</span>
                    <span>进入考场</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleLaunchClone}
                    disabled={!clonedPaperResult}
                    className="w-full h-10 px-space-lg rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">play_circle</span>
                    <span>进入考场</span>
                  </button>
                )}
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
                    <span>转到 Markdown 工作台继续编辑（可选）</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeMode === 'markdown' && (
          <div className="flex flex-col gap-space-lg">
            {/* Control Bar */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-outline-variant/30 flex items-center justify-between gap-space-md flex-wrap">
              <div className="flex items-center gap-2 text-on-surface-variant font-label-sm">
                <span className="material-symbols-outlined text-[18px] text-primary">edit_note</span>
                <span>编辑或粘贴题稿后，使用 AI 解析生成预览；解析会按题目分批调用模型</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runProgressiveChunkParser(markdownText, { resume: false })}
                  disabled={!markdownText.trim() || isParsingAI}
                  title={`按篇章切片调用模型，预计 ${markdownBatchCount} 批`}
                  className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm font-semibold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isParsingAI ? 'animate-spin' : ''}`}>{isParsingAI ? 'progress_activity' : 'auto_awesome'}</span>
                  <span>{isParsingAI ? '正在解析…' : `${hasCurrentParse ? 'AI 重新解析' : 'AI 解析'}（${markdownBatchCount} 批）`}</span>
                </button>
                {canContinueParse && (
                  <button
                    type="button"
                    onClick={() => runProgressiveChunkParser(markdownText, { resume: true })}
                    disabled={isParsingAI}
                    title={`从第 ${completedChunkCount + 1} / ${markdownBatchCount} 批继续解析`}
                    className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm font-semibold transition-colors cursor-pointer border border-outline-variant/30 flex items-center gap-1 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    <span>继续解析</span>
                  </button>
                )}

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
              {parseUsageSummary && (
                <div className="w-full flex items-center gap-2 text-xs text-on-surface-variant" aria-live="polite">
                  <span className="material-symbols-outlined text-[15px] text-primary">monitoring</span>
                  <span>
                    本次解析：{parseUsageSummary.totalTokens.toLocaleString()} tokens
                    {' · '}
                    {parseUsageSummary.pricedCalls > 0
                      ? `约 ¥${parseUsageSummary.estimatedCostCny.toFixed(6)}`
                      : '费用暂不可估'}
                    {' · '}
                    {parseUsageSummary.complete
                      ? `已统计 ${parseUsageSummary.completedCalls}/${parseUsageSummary.totalCalls} 批`
                      : `统计中 ${parseUsageSummary.completedCalls}/${parseUsageSummary.totalCalls} 批`}
                    {parseUsageSummary.unpricedCalls > 0 && '（部分批次费用未计价）'}
                  </span>
                  {parseUsageSummary.structuredRetries > 0 && (
                    <span className="text-amber-700">结构纠错 {parseUsageSummary.structuredRetries}/{parseUsageSummary.retryLimit ?? '—'} 次</span>
                  )}
                  {parseUsageSummary.pricedCalls > 0 && parseUsageSummary.pricedCalls < parseUsageSummary.completedCalls && (
                    <span>部分批次费用暂不可估</span>
                  )}
                </div>
              )}
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
                    placeholder="在此编写或粘贴 Markdown 试卷文本，编辑完成后点击上方“AI 解析”..."
                    className="w-full h-[620px] mt-2 p-3.5 bg-surface-container-low rounded-lg font-mono text-code-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest border border-outline-variant/30 leading-relaxed resize-none"
                  />
                </div>

                {/* Markdown format tips */}
                <div className="p-space-sm bg-surface-container-low rounded-lg text-[11px] text-on-surface-variant space-y-1 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-on-surface font-sans">💡 AI 解析说明：</span>
                    <span className="text-[10px] text-primary">仅点击“AI 解析”后调用模型，避免编辑时重复消耗额度</span>
                  </div>
                  <p>• 篇章材料：支持 <code>#### Text 1</code>、<code>#### 阅读篇章</code> 自动关联绑定下属考题</p>
                  <p>• 题号：支持 <code>### 1</code>、<code>### 21</code>，大题小问（1.证明 2.计算）将智能保留在题干内</p>
                  <p>• 分值：支持 <code>（本题满分 12 分）</code>，自动提取为分值并从题干剥离</p>
                  <p>• 标答与解析：支持 <code>**答案: ** A</code> 与 <code>**解析**</code> / <code>**解：**</code></p>
                </div>
              </div>

              {/* Right: KaTeX Exam Paper Preview with Interactive Editing */}
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
                      ) : markdownText.trim() && parsedMarkdownSource !== markdownText ? (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-label-mono text-code-sm font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span>题稿有改动，待解析</span>
                        </span>
                      ) : parsedMarkdownSource ? (
                        <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-label-mono text-code-sm font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                          <span>已解析当前题稿</span>
                        </span>
                      ) : <span className="text-[11px] text-on-surface-variant">等待题稿解析</span>
                      }
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
                                <span className={`px-2 py-0.5 rounded border text-label-sm font-semibold ${getQuestionTypeClass(q.type)}`}>{q.type}</span>
                                <span className="text-primary font-semibold text-[12px] bg-surface-container px-2 py-0.5 rounded font-label-mono">
                                  {Number(q.score) > 0 ? `${q.score} 分` : '未设分值'}
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
                                    <SelectMenu
                                      ariaLabel={`设置第 ${editForm.num} 题的题型`}
                                      value={editForm.type}
                                      onChange={(type) => setEditForm(f => ({ ...f, type }))}
                                      options={[
                                        { value: '单项选择题', label: '单项选择题' },
                                        { value: '多项选择题', label: '多项选择题' },
                                        { value: '填空题', label: '填空题' },
                                        { value: '综合计算与解答题', label: '综合计算与解答题' },
                                        { value: '证明题', label: '证明题' },
                                        { value: '阅读理解题', label: '阅读理解题' }
                                      ]}
                                      className="w-full"
                                      buttonClassName="inline-flex h-8 w-full items-center justify-between gap-1 rounded border border-outline-variant/30 bg-surface-container-lowest px-2 text-left text-[12px] text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    />
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
                                  <div className="text-secondary font-bold text-label-md">
                                    <MathMarkdown content={q.standardAnswer} />
                                  </div>
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

                {/* Action CTA: Save Paper & Enter Exam Room */}
                <div className="pt-3 border-t border-surface-container flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSaveMarkdownExam(false)}
                    disabled={!parsedExam || !parsedExam.questions || parsedExam.questions.length === 0}
                    className="w-full sm:flex-1 h-11 px-4 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-headline-sm text-label-md flex items-center justify-center gap-2 border border-primary/30 shadow-xs transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                    title="将当前已排版试卷保存到试卷库中，不强制进入考场"
                  >
                    <span className="material-symbols-outlined text-[20px]">bookmark_add</span>
                    <span>保存试卷到试卷库</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLaunchMarkdownExam}
                    disabled={!parsedExam || !parsedExam.questions || parsedExam.questions.length === 0}
                    className="w-full sm:flex-[1.2] h-11 px-4 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-label-md flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
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

      {/* Toast Notification for Saved Paper */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-xl shadow-xl border border-outline-variant/30 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="material-symbols-outlined text-secondary text-[22px]">check_circle</span>
          <div className="text-body-sm">
            <span className="font-semibold block max-w-xs truncate">{saveToast.title}</span>
            <span className="text-[12px] opacity-80">已成功保存至试卷库！</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('paper-library')}
            className="ml-2 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold hover:bg-primary-container cursor-pointer transition-colors shadow-xs"
          >
            去试卷库查看
          </button>
          <button
            type="button"
            onClick={() => setSaveToast(null)}
            className="text-on-surface-variant hover:text-on-surface cursor-pointer p-0.5 ml-1"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
