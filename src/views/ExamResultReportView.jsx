import React, { useState } from 'react';
import MathMarkdown from '../components/MathMarkdown';
import SelectMenu from '../components/SelectMenu';
import { getQuestionTypeClass } from '../utils/questionTypes';

export default function ExamResultReportView({
  submission,
  onUpdateSubmission,
  onBackToLibrary,
  onRetakeExam,
  onOpenNotebook
}) {
  if (!submission) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-12 text-center">
        <span className="material-symbols-outlined text-[48px] text-outline mb-2">assignment_late</span>
        <h2 className="text-headline-sm font-semibold text-on-surface">未检测到作答提交记录</h2>
        <p className="text-body-md text-on-surface-variant mt-1 mb-6">请从试卷库中选择一份已完成的试卷或重新进入考场完成考试。</p>
        <button
          type="button"
          onClick={onBackToLibrary}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md cursor-pointer"
        >
          返回试卷库
        </button>
      </div>
    );
  }

  const {
    id,
    paperId,
    paperTitle = '未命名试卷',
    submitTime = '未记录',
    durationSpent = 0,
    score = 0,
    accuracy = 0,
    questions = [],
    totalScore = questions.reduce((sum, q) => sum + (Number(q.score) || 0), 0),
    aiOverallReview = null
  } = submission;

  // Question filter: 'all' | 'wrong' | 'correct' | 'unanswered'
  const [filterMode, setFilterMode] = useState('all');

  // Modal for exporting to notebook / question bank
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedQIds, setSelectedQIds] = useState(() => {
    // Default: pre-select all wrong questions
    return questions.filter(q => q.isCorrect === false && q.userAnswer?.trim()).map(q => q.id);
  });
  const [targetCollectionMode, setTargetCollectionMode] = useState('new'); // 'new' | 'existing'
  const [existingColId, setExistingColId] = useState('col-2');
  const [newCollectionName, setNewCollectionName] = useState(`${paperTitle} · 错题与精选集`);
  const [exportSuccessMessage, setExportSuccessMessage] = useState('');
  const [isRetryingDiagnosis, setIsRetryingDiagnosis] = useState(false);
  const [diagnosisRetryMessage, setDiagnosisRetryMessage] = useState('');
  const [isActionPlanExpanded, setIsActionPlanExpanded] = useState(false);

  // Expand / collapse all analyses toggle
  const [expandedAll, setExpandedAll] = useState(false);
  const [expandedMap, setExpandedMap] = useState({});
  const [expandedScratchpadMap, setExpandedScratchpadMap] = useState({});

  const toggleExpand = (qId) => {
    setExpandedMap(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const toggleScratchpad = (qId) => {
    setExpandedScratchpadMap(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const formatDuration = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}小时${remMins}分${secs}秒`;
    }
    return `${mins}分${secs}秒`;
  };

  const handleRetryDiagnosis = async () => {
    if (isRetryingDiagnosis || !questions.length) return;
    setIsRetryingDiagnosis(true);
    setDiagnosisRetryMessage('正在重新生成作答诊断…');
    try {
      const response = await fetch('/api/model/evaluate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperTitle,
          score,
          totalScore,
          accuracy,
          durationSpent,
          questionsSummary: questions.slice(0, 60).map((q, index) => ({
            index,
            num: q.num,
            type: q.type,
            prompt: String(q.prompt || '').slice(0, 2400),
            options: Array.isArray(q.options) ? q.options.slice(0, 8).map((option) => ({
              key: option.key,
              text: String(option.text || option.content || '').slice(0, 400)
            })) : [],
            isCorrect: q.isCorrect ?? null,
            scoreObtained: q.scoreObtained,
            maxScore: Number(q.score) || 0,
            userAnswer: String(q.userAnswer || '').slice(0, 1600),
            standardAnswer: String(q.standardAnswer || '').slice(0, 1600),
            analysis: String(q.analysis || '').slice(0, 1000),
            scratchpad: {
              text: String(q.scratchpad?.text || '').slice(0, 800),
              elements: (q.scratchpad?.elements || []).slice(0, 8).map((element) => ({
                title: String(element.title || '').slice(0, 100),
                actions: (element.actions || []).slice(0, 8).map((action) => ({
                  type: action.type,
                  content: typeof action.content === 'string' ? action.content.slice(0, 500) : undefined,
                  expr: typeof action.expr === 'string' ? action.expr.slice(0, 180) : undefined,
                  label: typeof action.label === 'string' ? action.label.slice(0, 120) : undefined,
                  shapeType: action.shapeType,
                  plane: action.plane
                }))
              }))
            }
          }))
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data || result.fallback) {
        throw new Error(result.error || result.data?.summary || '诊断服务暂不可用，请稍后重试。');
      }

      const reviews = new Map((result.data.questionReviews || [])
        .filter((review) => Number.isInteger(Number(review.index)))
        .map((review) => [Number(review.index), review]));
      const updatedQuestions = questions.map((question, index) => {
        const review = reviews.get(index);
        if (!review) return question;
        const hasScore = question.gradingStatus === 'manual-review'
          && question.userAnswer?.trim()
          && review.scoreObtained !== null
          && review.scoreObtained !== undefined
          && review.scoreObtained !== ''
          && Number.isFinite(Number(review.scoreObtained));
        const maxScore = Math.max(0, Number(question.score) || 0);
        const scoreObtained = hasScore
          ? Math.min(maxScore, Math.max(0, Number(review.scoreObtained)))
          : question.scoreObtained;
        return {
          ...question,
          ...(hasScore ? {
            scoreObtained,
            isCorrect: scoreObtained >= maxScore && maxScore > 0,
            gradingStatus: 'ai-graded'
          } : {}),
          aiInsight: typeof review.comment === 'string' ? review.comment.slice(0, 1200) : question.aiInsight
        };
      });
      const updatedSubmission = {
        ...submission,
        questions: updatedQuestions,
        score: updatedQuestions.reduce((sum, question) => sum + (Number(question.scoreObtained) || 0), 0),
        accuracy: updatedQuestions.filter((question) => question.userAnswer?.trim()).length
          ? Math.round((updatedQuestions.filter((question) => question.userAnswer?.trim() && question.isCorrect === true).length
            / updatedQuestions.filter((question) => question.userAnswer?.trim()).length) * 100)
          : 0,
        aiOverallReview: result.data
      };
      onUpdateSubmission?.(updatedSubmission);
      setDiagnosisRetryMessage('诊断已更新，并已保存到这份交卷记录。');
    } catch (error) {
      setDiagnosisRetryMessage(error.message || '重新生成失败，请稍后重试。');
    } finally {
      setIsRetryingDiagnosis(false);
    }
  };

  // Stats calculation
  const totalCount = questions.length;
  const correctCount = questions.filter(q => q.isCorrect).length;
  const wrongCount = questions.filter(q => q.isCorrect === false && q.userAnswer && q.userAnswer.trim().length > 0).length;
  const unansweredCount = questions.filter(q => !q.userAnswer || q.userAnswer.trim().length === 0).length;
  const answeredCount = totalCount - unansweredCount;
  const manualReviewCount = questions.filter(q => q.gradingStatus === 'manual-review').length;
  const diagnosisUnavailable = !aiOverallReview || String(aiOverallReview.summary || '').includes('智能诊断暂不可用');

  // Filter questions
  const filteredQuestions = questions.filter(q => {
    if (filterMode === 'wrong') return q.isCorrect === false && q.userAnswer && q.userAnswer.trim().length > 0;
    if (filterMode === 'correct') return q.isCorrect;
    if (filterMode === 'unanswered') return !q.userAnswer || q.userAnswer.trim().length === 0;
    return true;
  });

  // Calculate percentile

  // Selection handlers for Export Modal
  const handleSelectAllWrong = () => {
    const wrongIds = questions.filter(q => q.isCorrect === false && q.userAnswer?.trim()).map(q => q.id);
    setSelectedQIds(wrongIds);
  };

  const handleSelectAllCorrect = () => {
    const correctIds = questions.filter(q => q.isCorrect).map(q => q.id);
    setSelectedQIds(correctIds);
  };

  const handleSelectAll = () => {
    setSelectedQIds(questions.map(q => q.id));
  };

  const handleClearSelection = () => {
    setSelectedQIds([]);
  };

  const toggleSelectQuestion = (qId) => {
    setSelectedQIds(prev =>
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  // Perform export to localStorage notebook
  const handleConfirmExportToNotebook = () => {
    if (selectedQIds.length === 0) {
      alert('请至少勾选一道题目以沉淀至题集。');
      return;
    }

    const selectedQuestions = questions.filter(q => selectedQIds.includes(q.id));
    const finalFolderName = targetCollectionMode === 'new'
      ? (newCollectionName.trim() || `${paperTitle} · 精选题集`)
      : '归档题集';

    try {
      // 1. Read existing notebook storage or create initial
      const storedNotebookRaw = localStorage.getItem('examcraft_notebook_data');
      let notebookData = null;
      if (storedNotebookRaw) {
        try {
          notebookData = JSON.parse(storedNotebookRaw);
        } catch {}
      }

      const colId = targetCollectionMode === 'new' ? `col-${Date.now()}` : existingColId;
      
      const newCollection = {
        id: colId,
        title: finalFolderName,
        count: selectedQuestions.length,
        active: true,
        updated: '刚刚',
        desc: `收录自试卷《${paperTitle}》的 ${selectedQuestions.length} 道题目。`,
        icon: 'folder_special'
      };

      // Convert questions to mistake items
      const newItems = selectedQuestions.map(q => ({
        id: `item-${q.id}-${Date.now()}`,
        collectionId: colId,
        num: `题号 ${q.num}`,
        type: q.type || '试题',
        score: q.score || 5,
        title: q.prompt ? (q.prompt.length > 80 ? q.prompt.slice(0, 80) + '...' : q.prompt) : '题目详情',
        formula: q.mathExpression || '',
        fullPrompt: q.prompt,
        options: q.options,
        source: paperTitle,
        isCorrect: q.userAnswer?.trim() ? q.isCorrect : null,
        gradingStatus: q.userAnswer?.trim() ? q.gradingStatus : 'unanswered',
        myDeduction: !q.userAnswer?.trim() ? '未作答' : (q.isCorrect === true ? '+0分 (已做对)' : (q.gradingStatus === 'manual-review' ? '待人工复核' : `-${q.score || 5}分`)),
        errorReason: q.isCorrect === true
          ? '考生作答完全正确，收录为经典同构保留题'
          : (!q.userAnswer?.trim() ? '本题未作答。' : (q.gradingStatus === 'manual-review' ? '主观题尚未自动判分，请对照标准答案复核。' : (q.aiInsight || '请对照标准答案复核。'))),
        weakPoint: q.weakPoint || '',
        userWrongAnswer: q.userAnswer || '未填写',
        standardAnswer: q.standardAnswer || '',
        aiInsight: q.aiInsight || q.analysis || '',
        analysis: q.analysis || ''
      }));

      let collectionsList = notebookData?.collections || [];
      let itemsList = notebookData?.items || [];

      if (targetCollectionMode === 'new') {
        collectionsList = [newCollection, ...collectionsList];
      } else {
        collectionsList = collectionsList.map(c =>
          c.id === existingColId ? { ...c, count: (c.count || 0) + newItems.length } : c
        );
      }
      itemsList = [...newItems, ...itemsList];

      localStorage.setItem('examcraft_notebook_data', JSON.stringify({
        collections: collectionsList,
        items: itemsList
      }));

      const correctSelected = selectedQuestions.filter(q => q.isCorrect).length;
      const wrongSelected = selectedQuestions.filter(q => q.isCorrect === false && q.userAnswer?.trim()).length;
      const manualReviewSelected = selectedQuestions.filter(q => q.gradingStatus === 'manual-review').length;

      setExportSuccessMessage(`已收录 ${selectedQuestions.length} 道题目（${wrongSelected} 道错题、${correctSelected} 道核对正确、${manualReviewSelected} 道待复核）至题集《${finalFolderName}》。`);
      setTimeout(() => {
        setIsExportModalOpen(false);
        setExportSuccessMessage('');
      }, 2500);
    } catch (e) {
      alert(`保存题集失败: ${e.message}`);
    }
  };

  const scrollToQuestion = (qId) => {
    const el = document.getElementById(`q-card-${qId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-primary');
      }, 1500);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-background min-h-screen pb-24">
      {/* 1. Top Minimalist Telemetry & Action Navigation */}
      <header className="sticky top-0 z-40 w-full bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/30 px-4 sm:px-margin-desktop py-space-sm flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-space-md min-w-0">
          <button
            type="button"
            onClick={onBackToLibrary}
            className="flex items-center text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer mr-1"
            title="返回试卷库"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex items-center space-x-1.5 min-w-0">
            <span className="material-symbols-outlined text-secondary text-[22px] material-symbols-fill">
              verified
            </span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface truncate max-w-xs md:max-w-md">
                {paperTitle} · 作答复盘报告
              </span>
              <span className="text-[11px] font-label-mono text-on-surface-variant">
                提交时间: {submitTime} · 答题用时: {formatDuration(durationSpent)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-space-sm sm:space-x-space-md">
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer font-medium"
          >
            <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
            <span>📥 结果转题集 (自由组合)</span>
          </button>
          <button
            type="button"
            onClick={onRetakeExam}
            className="hidden sm:inline-flex items-center space-x-1 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md rounded-lg border border-outline-variant/40 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">restart_alt</span>
            <span>再做一次本卷</span>
          </button>
          <button
            type="button"
            onClick={onBackToLibrary}
            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-label-md text-label-md rounded-lg border border-outline-variant/30 transition-colors cursor-pointer"
          >
            <span>返回试卷库</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-margin-tablet lg:px-margin-desktop py-space-xl flex flex-col space-y-space-xl">
        
        {/* 2. Score & AI Master Review Dashboard */}
        <section className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col lg:flex-row gap-space-xl items-stretch">
          {/* Left: Score & Key KPI Cards */}
          <div className="lg:w-80 shrink-0 flex flex-col justify-between p-space-lg bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-space-md">
            <div>
              <div className="flex items-center justify-between text-on-surface-variant font-label-mono text-label-mono mb-1">
                  <span>AUTO-CHECKED SCORE</span>
                <span className="px-2 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-semibold text-[11px]">
                  本次得分
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-[52px] leading-tight font-extrabold font-mono text-secondary">
                  {score}
                </span>
                <span className="text-body-md font-mono text-on-surface-variant">
                  / {totalScore} 分
                </span>
              </div>
              {manualReviewCount > 0 && <p className="text-[11px] text-on-surface-variant mt-1">{manualReviewCount} 道主观题待人工复核，暂未计分</p>}
            </div>

            <div className="grid grid-cols-2 gap-space-sm pt-2 border-t border-outline-variant/20">
              <div className="p-2 rounded bg-surface-container-lowest/80 border border-outline-variant/20">
                <span className="text-[11px] font-label-mono text-on-surface-variant block">客观题正确率</span>
                <span className="text-headline-sm font-bold font-mono text-primary">{accuracy}%</span>
              </div>
              <div className="p-2 rounded bg-surface-container-lowest/80 border border-outline-variant/20">
                <span className="text-[11px] font-label-mono text-on-surface-variant block">已作答题目</span>
                <span className="text-headline-sm font-bold font-mono text-tertiary">{answeredCount} <span className="text-[11px] font-normal text-on-surface-variant">题</span></span>
              </div>
              <div className="p-2 rounded bg-surface-container-lowest/80 border border-outline-variant/20">
                <span className="text-[11px] font-label-mono text-on-surface-variant block">答对题目</span>
                <span className="text-headline-sm font-bold font-mono text-secondary">{correctCount} <span className="text-[11px] font-normal text-on-surface-variant">题</span></span>
              </div>
              <div className="p-2 rounded bg-surface-container-lowest/80 border border-outline-variant/20">
                <span className="text-[11px] font-label-mono text-on-surface-variant block">错题待攻坚</span>
                <span className="text-headline-sm font-bold font-mono text-error">{wrongCount} <span className="text-[11px] font-normal text-on-surface-variant">题</span></span>
              </div>
            </div>

            <div className="text-[11px] font-label-mono text-on-surface-variant flex items-center justify-between pt-1">
              <span>试卷总题数: {totalCount} 题</span>
              <span>未作答: {unansweredCount} 题</span>
            </div>
          </div>

          {/* Right: AI Master Diagnostic Review */}
          <div className="flex-1 flex flex-col justify-between space-y-space-md">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center space-x-2 text-primary">
                  <span className="material-symbols-outlined text-[22px] material-symbols-fill">psychology</span>
                  <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                    作答诊断
                  </h3>
                </div>
                {diagnosisUnavailable && (
                  <button
                    type="button"
                    onClick={handleRetryDiagnosis}
                    disabled={isRetryingDiagnosis}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary transition hover:bg-primary-container disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isRetryingDiagnosis ? 'animate-spin' : ''}`}>
                      {isRetryingDiagnosis ? 'progress_activity' : 'refresh'}
                    </span>
                    {isRetryingDiagnosis ? '重新生成中…' : '重试 AI 诊断'}
                  </button>
                )}
              </div>
              {diagnosisRetryMessage && <p className="mb-2 text-xs text-on-surface-variant" role="status">{diagnosisRetryMessage}</p>}
              <p className="text-body-md text-on-surface-variant leading-relaxed bg-surface-container-low/50 p-space-md rounded-xl border border-outline-variant/20">
                {aiOverallReview?.summary || '本次智能诊断暂不可用。您仍可根据逐题得分、标准答案与解析进行复盘。'}
              </p>
            </div>

            {/* Strengths & Weaknesses Tags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <div className="p-space-sm rounded-xl bg-secondary-container/20 border border-secondary-container/40">
                <span className="text-label-sm font-semibold text-secondary flex items-center gap-1 mb-1.5">
                  <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                  优势考点与解题长板
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(aiOverallReview?.strengths || []).map((st, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-surface-container-lowest text-[11px] font-label-mono text-secondary border border-secondary/20">
                      ✓ {st}
                    </span>
                  ))}
                  {!aiOverallReview?.strengths?.length && <span className="text-[12px] text-on-surface-variant">暂无诊断数据</span>}
                </div>
              </div>

              <div className="p-space-sm rounded-xl bg-error-container/20 border border-error-container/40">
                <span className="text-label-sm font-semibold text-error flex items-center gap-1 mb-1.5">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  典型失分点与薄弱环节
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(aiOverallReview?.weaknesses || []).map((wt, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-surface-container-lowest text-[11px] font-label-mono text-error border border-error/20">
                      ⚠ {wt}
                    </span>
                  ))}
                  {!aiOverallReview?.weaknesses?.length && <span className="text-[12px] text-on-surface-variant">暂无诊断数据</span>}
                </div>
              </div>
            </div>

            {/* Action Plan */}
            <div className="overflow-hidden rounded-lg bg-surface-container-low text-body-sm text-on-surface-variant">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-space-md py-2">
                <span className="font-semibold text-on-surface flex items-center gap-1 shrink-0">
                  <span className="material-symbols-outlined text-[16px] text-primary">lightbulb</span>
                  提分突破口：
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {aiOverallReview?.actionPlan?.[0] || '建议一键将本次错题与经典题收录至题集，针对失分题型进行举一反三重练。'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsActionPlanExpanded((expanded) => !expanded)}
                  aria-expanded={isActionPlanExpanded}
                  aria-controls="exam-action-plan-details"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline font-label-sm font-semibold shrink-0 cursor-pointer"
                >
                  {isActionPlanExpanded ? '收起' : '展开'}
                  <span className={`material-symbols-outlined text-[17px] transition-transform ${isActionPlanExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="text-primary hover:underline font-label-sm font-semibold shrink-0 cursor-pointer"
                >
                  立即转题集 &gt;
                </button>
              </div>
              {isActionPlanExpanded && (
                <ol id="exam-action-plan-details" className="space-y-2 border-t border-outline-variant/30 px-space-md py-3 text-[13px] leading-relaxed">
                  {(aiOverallReview?.actionPlan?.length
                    ? aiOverallReview.actionPlan
                    : ['建议一键将本次错题与经典题收录至题集，针对失分题型进行举一反三重练。']
                  ).map((item, index) => (
                    <li key={`${index}-${item}`} className="flex gap-2">
                      <span className="shrink-0 font-semibold text-primary">{index + 1}.</span>
                      <span className="min-w-0 break-words">{item}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>

        {/* 3. Filter Pill Bar & Question Mini-Map Matrix */}
        <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          {/* Left: Filter Pills */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-full font-label-mono text-label-mono transition-all flex items-center gap-1 cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-primary text-on-primary font-medium shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              <span>全部试题</span>
              <span className="opacity-80">({totalCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('wrong')}
              className={`px-3 py-1 rounded-full font-label-mono text-label-mono transition-all flex items-center gap-1 cursor-pointer ${
                filterMode === 'wrong'
                  ? 'bg-error text-on-error font-medium shadow-xs'
                  : 'bg-surface-container-low text-error hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">cancel</span>
              <span>仅看错题</span>
              <span className="opacity-80">({wrongCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('correct')}
              className={`px-3 py-1 rounded-full font-label-mono text-label-mono transition-all flex items-center gap-1 cursor-pointer ${
                filterMode === 'correct'
                  ? 'bg-secondary text-on-secondary font-medium shadow-xs'
                  : 'bg-surface-container-low text-secondary hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              <span>仅看对题</span>
              <span className="opacity-80">({correctCount})</span>
            </button>
            {unansweredCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterMode('unanswered')}
                className={`px-3 py-1 rounded-full font-label-mono text-label-mono transition-all flex items-center gap-1 cursor-pointer ${
                  filterMode === 'unanswered'
                    ? 'bg-outline text-on-primary font-medium shadow-xs'
                    : 'bg-surface-container-low text-outline hover:bg-surface-container'
                }`}
              >
                <span>未作答</span>
                <span className="opacity-80">({unansweredCount})</span>
              </button>
            )}
          </div>

          {/* Right: Quick actions */}
          <div className="flex items-center gap-space-sm shrink-0">
            <button
              type="button"
              onClick={() => {
                const nextState = !expandedAll;
                setExpandedAll(nextState);
                const newMap = {};
                questions.forEach(q => { newMap[q.id] = nextState; });
                setExpandedMap(newMap);
              }}
              className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">
                {expandedAll ? 'unfold_less' : 'unfold_more'}
              </span>
              <span>{expandedAll ? '全部收起解析' : '全部展开解析'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-3 py-1 rounded bg-primary-container hover:bg-primary text-on-primary font-label-sm text-label-sm transition-colors cursor-pointer flex items-center gap-1 font-medium"
            >
              <span className="material-symbols-outlined text-[16px]">playlist_add_check</span>
              <span>勾选题目转题集</span>
            </button>
          </div>
        </section>

        {/* 4. Question Navigation Mini-Map Matrix (Quick Jump) */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-xs border border-outline-variant/30 flex items-center gap-space-sm overflow-x-auto">
          <span className="text-[11px] font-label-mono text-on-surface-variant font-semibold shrink-0">
            答题卡快览:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {questions.map((q, idx) => {
              const isAns = q.userAnswer && q.userAnswer.trim().length > 0;
              let bgClass = 'bg-surface-container text-on-surface-variant';
              if (q.isCorrect) {
                bgClass = 'bg-secondary text-on-secondary font-bold';
              } else if (q.gradingStatus === 'manual-review') {
                bgClass = 'bg-tertiary-container text-on-tertiary-container font-bold';
              } else if (isAns) {
                bgClass = 'bg-error text-on-error font-bold';
              } else {
                bgClass = 'bg-surface-container-high text-outline';
              }

              return (
                <button
                  key={`res_p_${q.id ?? 'item'}_${idx}`}
                  type="button"
                  onClick={() => scrollToQuestion(q.id)}
                  title={`第 ${q.num} 题 (${q.type}) - ${q.isCorrect ? '正确' : (q.gradingStatus === 'manual-review' ? '待人工复核' : (isAns ? '错误' : '未作答'))}`}
                  className={`w-7 h-7 rounded text-[11px] font-mono transition-transform hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center shadow-2xs ${bgClass}`}
                >
                  {q.num}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Question Detailed Review Cards */}
        <section className="space-y-space-lg">
          {filteredQuestions.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-xl p-12 text-center text-on-surface-variant border border-outline-variant/30">
              <span className="material-symbols-outlined text-[40px] text-outline mb-2">check_circle_outline</span>
              <p className="text-body-md font-medium">当前筛选条件下暂无试题。</p>
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isExpanded = expandedMap[q.id] ?? false;
              const isAnswered = q.userAnswer && q.userAnswer.trim().length > 0;

              return (
                <article
                  key={`res_card_${q.id ?? 'item'}_${idx}`}
                  id={`q-card-${q.id}`}
                  className={`bg-surface-container-lowest rounded-2xl shadow-sm border transition-all p-space-lg sm:p-space-xl flex flex-col space-y-space-md ${
                      q.isCorrect
                      ? 'border-secondary/30 hover:border-secondary'
                      : (q.gradingStatus === 'manual-review' ? 'border-tertiary/30 hover:border-tertiary' : (isAnswered ? 'border-error/30 hover:border-error' : 'border-outline-variant/40'))
                  }`}
                >
                  {/* Top Bar: Question Specs, Status Badge, and Single-Question Action */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-space-xs border-b border-outline-variant/20">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded font-label-mono text-label-mono font-bold bg-surface-container text-on-surface">
                        第 {q.num} 题
                      </span>
                      <span className={`px-2 py-0.5 rounded border font-label-mono text-[11px] ${getQuestionTypeClass(q.type)}`}>
                        {q.type} · 满分 {q.score} 分
                      </span>
                      {q.section && (
                        <span className="text-[11px] font-label-mono text-outline hidden sm:inline">
                          [{q.section}]
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Correct / Wrong Pill */}
                      {q.isCorrect ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-label-mono text-[12px] font-semibold border border-secondary/30">
                          <span className="material-symbols-outlined text-[15px]">check_circle</span>
                          <span>回答正确 (+{q.score}分)</span>
                        </span>
                      ) : q.gradingStatus === 'manual-review' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-tertiary-container/50 text-on-tertiary-container font-label-mono text-[12px] font-semibold border border-tertiary/30">
                          <span className="material-symbols-outlined text-[15px]">rate_review</span>
                          <span>待人工复核</span>
                        </span>
                      ) : q.gradingStatus === 'ai-graded' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-primary-container/40 text-primary font-label-mono text-[12px] font-semibold border border-primary/30">
                          <span className="material-symbols-outlined text-[15px]">psychology</span>
                          <span>AI评分 {q.scoreObtained || 0}/{q.score} 分</span>
                        </span>
                      ) : isAnswered ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-error-container/40 text-error font-label-mono text-[12px] font-semibold border border-error/30">
                          <span className="material-symbols-outlined text-[15px]">cancel</span>
                          <span>回答错误 (得分 {q.scoreObtained || 0}/{q.score}分)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-surface-container text-outline font-label-mono text-[12px]">
                          <span className="material-symbols-outlined text-[15px]">help</span>
                          <span>未作答 (0/{q.score}分)</span>
                        </span>
                      )}

                      {/* Add to Notebook Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQIds([q.id]);
                          setIsExportModalOpen(true);
                        }}
                        className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                        title="收录此题到题集"
                      >
                        <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
                      </button>
                    </div>
                  </div>

                  {/* Passage context if English Reading / Comprehension */}
                  {q.passage && (
                    <div className="bg-surface-container-low/40 rounded-xl p-space-md border border-outline-variant/30 text-body-sm leading-relaxed text-on-surface-variant max-h-56 overflow-y-auto font-serif">
                      <div className="flex items-center space-x-1 text-primary font-semibold text-[12px] mb-1 font-sans">
                        <span className="material-symbols-outlined text-[16px]">menu_book</span>
                        <span>{q.passageTitle || '篇章阅读参考材料'}</span>
                      </div>
                      <MathMarkdown content={q.passage} />
                    </div>
                  )}

                  {/* Question Prompt */}
                  <div className="text-on-surface font-body-lg text-body-lg leading-relaxed">
                    <MathMarkdown content={q.prompt || ''} />
                    {q.mathExpression && (
                      <div className="my-2 p-2 bg-surface-container-low rounded-lg text-center font-mono">
                        <MathMarkdown content={`$$${q.mathExpression}$$`} />
                      </div>
                    )}
                  </div>

                  {/* Multiple Choice Options with In-Place Comparison */}
                  {q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
                      {q.options.map((opt) => {
                        const isUserChoice = (q.userAnswer || '').trim().toUpperCase() === opt.key.toUpperCase();
                        const isStandardChoice = (q.standardAnswer || '').trim().toUpperCase() === opt.key.toUpperCase();

                        let optCardStyle = 'bg-surface-container-low border-outline-variant/20 text-on-surface';
                        if (isStandardChoice) {
                          optCardStyle = 'bg-secondary-container/20 border-secondary text-secondary font-medium ring-1 ring-secondary/30';
                        } else if (isUserChoice && !q.isCorrect) {
                          optCardStyle = 'bg-error-container/20 border-error text-error ring-1 ring-error/30';
                        }

                        return (
                          <div
                            key={opt.key}
                            className={`flex items-start space-x-2.5 p-2.5 rounded-xl border text-body-md transition-all ${optCardStyle}`}
                          >
                            <span className="w-6 h-6 rounded-md bg-surface-container flex items-center justify-center font-bold text-[12px] shrink-0 font-mono">
                              {opt.key}
                            </span>
                            <div className="flex-1 min-w-0">
                              <MathMarkdown content={opt.text} />
                            </div>
                            {isStandardChoice && (
                              <span className="text-[11px] font-label-mono text-secondary px-1.5 py-0.5 rounded bg-secondary-container/40 shrink-0 font-semibold">
                                标准答案
                              </span>
                            )}
                            {isUserChoice && !isStandardChoice && (
                              <span className="text-[11px] font-label-mono text-error px-1.5 py-0.5 rounded bg-error-container/40 shrink-0 font-semibold">
                                考生错选
                              </span>
                            )}
                            {isUserChoice && isStandardChoice && (
                              <span className="text-[11px] font-label-mono text-secondary px-1.5 py-0.5 rounded bg-secondary-container/40 shrink-0 font-semibold">
                                考生作答 (正确)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* In-Place Candidate Answer vs Standard Answer Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md p-space-md rounded-xl bg-surface-container-low/70 border border-outline-variant/30">
                    {/* Candidate Answer */}
                    <div className="flex flex-col space-y-1">
                      <span className="font-label-mono text-[11px] text-on-surface-variant flex items-center gap-1 font-semibold">
                        <span className="material-symbols-outlined text-[15px] text-outline">history_edu</span>
                        考生本次作答:
                      </span>
                      <div className={`p-2.5 rounded-lg border font-mono text-body-sm min-h-[48px] flex items-center ${
                        q.isCorrect
                          ? 'bg-secondary-container/15 border-secondary/30 text-secondary font-semibold'
                          : (isAnswered ? 'bg-error-container/15 border-error/30 text-error' : 'bg-surface-container text-outline italic')
                      }`}>
                        {isAnswered ? (
                          <MathMarkdown content={q.userAnswer} />
                        ) : (
                          '（本题未作答填涂）'
                        )}
                      </div>
                    </div>

                    {/* Standard Answer */}
                    <div className="flex flex-col space-y-1">
                      <span className="font-label-mono text-[11px] text-secondary flex items-center gap-1 font-semibold">
                        <span className="material-symbols-outlined text-[15px]">verified</span>
                        官方标准答案:
                      </span>
                      <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-secondary/30 text-secondary font-mono font-semibold text-body-sm min-h-[48px] flex items-center">
                        <MathMarkdown content={q.standardAnswer || '详见分步解析'} />
                      </div>
                    </div>
                  </div>

                  {/* Action Bar: Official Analysis & Linked Scratchpad Viewer */}
                  <div className="pt-space-xs border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(q.id)}
                      className="inline-flex items-center space-x-1 text-primary hover:text-primary-container font-sans text-[12px] font-semibold transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                      </span>
                      <span>{isExpanded ? '收起官方解析与 AI 错因归因' : '查看完整分步解析与考点精讲'}</span>
                    </button>

                    {/* Toggle Button for Linked Scratchpad */}
                    <button
                      type="button"
                      onClick={() => toggleScratchpad(q.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-sans font-medium transition cursor-pointer border ${
                        expandedScratchpadMap[q.id]
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : q.scratchpad?.hasContent
                          ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/15'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container border-outline-variant/30'
                      }`}
                      title={q.scratchpad?.hasContent ? '查看本题考场关联留存的手绘草图与草稿笔记' : '本题未记录独立草稿'}
                    >
                      <span className="material-symbols-outlined text-[16px]">draw</span>
                      <span>{expandedScratchpadMap[q.id] ? '收起本题草稿纸' : '查看本题留存草稿纸'}</span>
                      {q.scratchpad?.hasContent ? (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                          有草稿
                        </span>
                      ) : (
                        <span className="text-[10px] text-outline font-normal">无草稿</span>
                      )}
                    </button>
                  </div>

                  {/* Render Linked Scratchpad when expanded */}
                  {expandedScratchpadMap[q.id] && (
                    <div className="mt-space-sm p-4 rounded-xl bg-surface-container-low/70 border border-primary/20 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 text-primary font-bold text-[13px] font-sans">
                          <span className="material-symbols-outlined text-[18px]">history_edu</span>
                          <span>第 {q.num} 题 · 考场实录草稿纸</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-medium">
                            交卷已关联归档
                          </span>
                        </div>
                        <span className="text-[11px] text-on-surface-variant/70 font-sans">
                          真实保留考场作答期间的书写草稿与手绘墨迹
                        </span>
                      </div>

                      {q.scratchpad?.hasContent ? (
                        <div className="space-y-3">
                          {/* 1. Canvas Drawing Preview */}
                          {q.scratchpad.canvasDataUrl && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1 font-sans">
                                <span className="material-symbols-outlined text-[14px] text-primary">gesture</span>
                                手绘涂鸦与矢量图形:
                              </span>
                              <div
                                className="w-full max-h-72 overflow-auto rounded-xl border border-outline-variant/30 flex items-center justify-center p-3 bg-white dark:bg-slate-900 shadow-inner"
                                style={{
                                  backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
                                  backgroundSize: '16px 16px'
                                }}
                              >
                                <img
                                  src={q.scratchpad.canvasDataUrl}
                                  alt={`第 ${q.num} 题手绘画布`}
                                  className="max-w-full max-h-64 object-contain shadow-xs rounded"
                                />
                              </div>
                            </div>
                          )}

                          {/* 2. Text / Math Notes */}
                          {q.scratchpad.text && q.scratchpad.text.trim().length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1 font-sans">
                                <span className="material-symbols-outlined text-[14px] text-secondary">notes</span>
                                演算文本与公式笔记:
                              </span>
                              <div className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20 text-body-sm text-on-surface leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-sans">
                                <MathMarkdown content={q.scratchpad.text} />
                              </div>
                            </div>
                          )}

                          {/* 3. Elements Summary */}
                          {q.scratchpad.elements && q.scratchpad.elements.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-on-surface-variant font-sans pt-1">
                              <span className="font-semibold text-primary">包含画入图元 ({q.scratchpad.elements.length} 个):</span>
                              {q.scratchpad.elements.map((el, i) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-surface-container text-on-surface border border-outline-variant/20">
                                  {el.kind === 'circle' ? '⭕ 几何圆与半径' : el.kind === 'coordinate' ? '📐 直角坐标系' : '公式/文本图元'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-on-surface-variant/70 text-body-sm font-sans flex flex-col items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-[24px] text-outline opacity-60">draw</span>
                          <span>考生在作答本题时未留存手绘草稿或速记笔记。</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expandable Official Analysis & AI Insight */}
                  {isExpanded && (
                    <div className="mt-space-sm p-space-md rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-space-md animate-in fade-in duration-200">
                      {/* Official Analysis */}
                      <div className="space-y-1">
                        <span className="font-sans text-[11px] text-primary font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">lightbulb</span>
                          官方分步推导解析:
                        </span>
                        <div className="text-body-md text-on-surface leading-relaxed pl-2 border-l-2 border-primary/40">
                          <MathMarkdown content={q.analysis || '暂无官方详细解析'} />
                        </div>
                      </div>

                      {/* AI Scribe / Master Insight */}
                      {q.aiInsight && (
                        <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/20 space-y-1">
                          <span className="font-sans text-[11px] text-tertiary font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">psychology</span>
                            本题 AI 评语:
                          </span>
                          <p className="text-body-sm text-on-surface-variant pl-2 font-sans">
                            {q.aiInsight}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
      </main>

      {/* 6. Modal: Export Questions to Notebook / Question Bank */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-space-xs border-b border-surface-container shrink-0">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-[24px] text-primary">bookmark_add</span>
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  结果转题集 (自由组合对题+错题)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="text-outline hover:text-on-surface p-1 rounded hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Quick Filter Pill Buttons */}
            <div className="flex items-center justify-between flex-wrap gap-2 shrink-0 py-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectAllWrong}
                  className="px-2.5 py-1 rounded bg-error-container/30 text-error hover:bg-error-container/50 font-label-mono text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  一键勾选所有错题 ({questions.filter(q => q.isCorrect === false && q.userAnswer?.trim()).length})
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllCorrect}
                  className="px-2.5 py-1 rounded bg-secondary-container/30 text-secondary hover:bg-secondary-container/50 font-label-mono text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  一键勾选所有做对题 ({questions.filter(q => q.isCorrect).length})
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-mono text-[11px] transition-colors cursor-pointer"
                >
                  全卷全选 ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-2.5 py-1 rounded text-outline hover:text-on-surface font-label-mono text-[11px] cursor-pointer"
                >
                  清空
                </button>
              </div>

              <span className="font-label-mono text-label-mono text-primary font-bold">
                已选中 {selectedQIds.length} 题
              </span>
            </div>

            {/* Scrollable Questions Checkbox List */}
            <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[300px] border border-outline-variant/30 rounded-xl p-space-sm space-y-1.5 bg-surface-container-low/30">
              {questions.map((q, idx) => {
                const isSelected = selectedQIds.includes(q.id);
                return (
                  <div
                    key={`modal_q_${q.id ?? 'item'}_${idx}`}
                    onClick={() => toggleSelectQuestion(q.id)}
                    className={`flex items-center space-x-3 p-2 rounded-lg transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-primary-fixed/20 border-primary text-on-surface'
                        : 'bg-surface-container-lowest border-outline-variant/20 hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent onClick
                      className="w-4 h-4 text-primary rounded border-outline-variant cursor-pointer"
                    />
                    <span className="font-mono font-bold text-[12px] w-12 shrink-0">
                      第 {q.num} 题
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-label-mono bg-surface-container shrink-0">
                      <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${getQuestionTypeClass(q.type)}`}>{q.type}</span>
                    </span>
                    {q.isCorrect ? (
                      <span className="text-secondary font-mono text-[11px] font-semibold shrink-0">
                        ✅ 做对
                      </span>
                    ) : (
                      <span className="text-error font-mono text-[11px] font-semibold shrink-0">
                        ❌ 做错
                      </span>
                    )}
                    <span className="text-body-sm truncate flex-1 font-sans">
                      {q.prompt || '题目详情'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Target Collection Setting */}
            <div className="space-y-space-sm pt-space-xs border-t border-surface-container shrink-0">
              <span className="text-label-sm font-semibold text-on-surface block">
                归档目标题集 / 错题本文件夹:
              </span>
              
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-1.5 text-body-sm cursor-pointer">
                  <input
                    type="radio"
                    name="targetCol"
                    checked={targetCollectionMode === 'new'}
                    onChange={() => setTargetCollectionMode('new')}
                    className="text-primary"
                  />
                  <span>新建专项题集</span>
                </label>
                <label className="flex items-center space-x-1.5 text-body-sm cursor-pointer">
                  <input
                    type="radio"
                    name="targetCol"
                    checked={targetCollectionMode === 'existing'}
                    onChange={() => setTargetCollectionMode('existing')}
                    className="text-primary"
                  />
                  <span>存入已有题集</span>
                </label>
              </div>

              {targetCollectionMode === 'new' ? (
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="输入题集名称，例如：2026考研英语二 · 典题与错题精选"
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-body-md border border-outline-variant/40 focus:outline-none focus:border-primary"
                />
              ) : (
                <SelectMenu
                  ariaLabel="选择目标题集"
                  value={existingColId}
                  onChange={setExistingColId}
                  options={[
                    { value: 'col-2', label: '高等数学期末易错集 (35 题)' },
                    { value: 'col-1', label: '考研数学核心压轴 (28 题)' },
                    { value: 'col-3', label: '线性代数特征值与矩阵 (19 题)' },
                    { value: 'col-4', label: '概率论大数定律与极限 (12 题)' }
                  ]}
                  className="w-full"
                  buttonClassName="inline-flex w-full items-center justify-between gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-left text-body-md text-on-surface hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              )}
            </div>

            {/* Success message banner if any */}
            {exportSuccessMessage && (
              <div className="p-3 bg-secondary-container/30 border border-secondary text-secondary rounded-xl text-body-sm font-medium animate-in fade-in">
                {exportSuccessMessage}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-surface-container shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsExportModalOpen(false);
                  onOpenNotebook();
                }}
                className="text-label-sm text-primary hover:underline font-semibold cursor-pointer"
              >
                前往我的错题本/题集中心 &gt;
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExportToNotebook}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md font-semibold shadow-sm cursor-pointer"
                >
                  确认归档收录 ({selectedQIds.length} 题)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
