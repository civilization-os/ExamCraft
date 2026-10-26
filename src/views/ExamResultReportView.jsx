import React, { useState } from 'react';
import MathMarkdown from '../components/MathMarkdown';
import SelectMenu from '../components/SelectMenu';
import { getQuestionTypeClass, isPseudoPassage } from '../utils/questionTypes';
import { useVocabularyStore } from '../stores/useVocabularyStore';

export default function ExamResultReportView({
  submission,
  onUpdateSubmission,
  onBackToLibrary,
  onRetakeExam,
  onOpenNotebook,
  onOpenVocabulary
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
    aiOverallReview = null,
    aiGradingUsage = null
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

  // Vocabulary sync state
  const markedVocabList = submission.markedVocabList || [];
  const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);
  const [selectedWordIds, setSelectedWordIds] = useState(() => markedVocabList.map(w => w.id));
  const [targetVocabFolderMode, setTargetVocabFolderMode] = useState('existing'); // 'existing' | 'new'
  const vocabFolders = useVocabularyStore((s) => s.folders) || [];
  const [existingVocabFolderId, setExistingVocabFolderId] = useState(() => {
    return vocabFolders[0]?.id || 'folder-default';
  });
  const [newVocabFolderName, setNewVocabFolderName] = useState(`${paperTitle} 考场生词`);
  const [enableAiEnrichVocab, setEnableAiEnrichVocab] = useState(true);
  const [isEnrichingVocab, setIsEnrichingVocab] = useState(false);
  const [vocabSyncSuccessMessage, setVocabSyncSuccessMessage] = useState('');

  const handleToggleSelectAllWords = () => {
    if (selectedWordIds.length === markedVocabList.length) {
      setSelectedWordIds([]);
    } else {
      setSelectedWordIds(markedVocabList.map(w => w.id));
    }
  };

  const handleToggleWord = (id) => {
    setSelectedWordIds(prev =>
      prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]
    );
  };

  const handleConfirmSyncVocab = async () => {
    if (selectedWordIds.length === 0) {
      alert('请至少勾选一个生词以同步至生词本。');
      return;
    }

    const wordsToSync = markedVocabList.filter(w => selectedWordIds.includes(w.id));
    setIsEnrichingVocab(true);

    try {
      let finalTargetFolderId = existingVocabFolderId;
      if (targetVocabFolderMode === 'new') {
        const folderName = newVocabFolderName.trim() || `${paperTitle} 考场生词`;
        useVocabularyStore.getState().addFolder(folderName);
        const updatedFolders = useVocabularyStore.getState().folders;
        const createdFolder = updatedFolders[updatedFolders.length - 1];
        if (createdFolder) finalTargetFolderId = createdFolder.id;
      }

      let payloadWords = wordsToSync;

      if (enableAiEnrichVocab) {
        try {
          const res = await fetch('/api/model/batch-enrich-words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              words: wordsToSync,
              paperTitle
            })
          });
          const resData = await res.json();
          if (resData.success && Array.isArray(resData.data) && resData.data.length > 0) {
            payloadWords = resData.data;
          }
        } catch (enrichErr) {
          console.warn('AI word enrich warning:', enrichErr);
        }
      }

      useVocabularyStore.getState().addWords(payloadWords, finalTargetFolderId);
      setVocabSyncSuccessMessage(`🎉 成功同步 ${payloadWords.length} 个考场生词至生词本！`);
    } catch (err) {
      alert(`同步生词失败: ${err.message}`);
    } finally {
      setIsEnrichingVocab(false);
    }
  };

  // Expand / collapse all analyses toggle
  const [expandedAll, setExpandedAll] = useState(false);
  const [expandedMap, setExpandedMap] = useState({});
  const [expandedScratchpadMap, setExpandedScratchpadMap] = useState({});
  const [generatingAiAnalysisMap, setGeneratingAiAnalysisMap] = useState({});
  const [showOfficialMap, setShowOfficialMap] = useState({});

  const toggleExpand = (qId) => {
    setExpandedMap(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const toggleScratchpad = (qId) => {
    setExpandedScratchpadMap(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleGenerateAiAnalysis = async (q, index) => {
    setGeneratingAiAnalysisMap((prev) => ({ ...prev, [q.id]: true }));
    try {
      const res = await fetch('/api/model/explain-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: {
            num: q.num,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            standardAnswer: q.standardAnswer
          }
        })
      });
      const data = await res.json();
      if (data.success && data.data?.aiAnalysis) {
        const updatedQuestions = questions.map((item, i) =>
          i === index ? { ...item, aiAnalysis: data.data.aiAnalysis } : item
        );
        const updatedSubmission = { ...submission, questions: updatedQuestions };
        onUpdateSubmission?.(updatedSubmission);
      }
    } catch (e) {
      console.warn('Generate AI analysis failed:', e);
    } finally {
      setGeneratingAiAnalysisMap((prev) => ({ ...prev, [q.id]: false }));
    }
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

      const notebookPayload = {
        collections: collectionsList,
        items: itemsList
      };
      localStorage.setItem('examcraft_notebook_data', JSON.stringify(notebookPayload));
      window.dispatchEvent(new CustomEvent('examcraft-notebook-updated', { detail: notebookPayload }));

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
    <div className="w-full min-w-0 flex-1 flex flex-col bg-background min-h-screen pb-24">
      {/* 1. Top Minimalist Telemetry & Action Navigation */}
      <header className="sticky top-0 z-40 w-full bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/30 px-3 sm:px-margin-desktop py-2 sm:py-space-sm flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex flex-1 items-center space-x-2 sm:space-x-space-md min-w-0">
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

        <div className="flex w-full sm:w-auto items-center justify-end space-x-1 sm:space-x-space-md">
          {markedVocabList.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setVocabSyncSuccessMessage('');
                setIsVocabModalOpen(true);
              }}
              className="inline-flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1.5 bg-secondary-container/80 hover:bg-secondary-container text-on-secondary-container text-[11px] sm:font-label-md sm:text-label-md rounded-lg border border-secondary/40 shadow-xs transition-all active:scale-95 cursor-pointer font-medium"
              title="将本次考试标记的生词同步至单词本"
            >
              <span className="material-symbols-outlined text-[17px] text-secondary">menu_book</span>
              <span>生词本 ({markedVocabList.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3.5 py-1.5 bg-primary hover:bg-primary-container text-on-primary text-[11px] sm:font-label-md sm:text-label-md rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer font-medium"
          >
            <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
            <span className="hidden min-[420px]:inline">📥 结果转题集</span>
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
            className="inline-flex items-center space-x-1 px-2 sm:px-3 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface-variant text-[11px] sm:font-label-md sm:text-label-md rounded-lg border border-outline-variant/30 transition-colors cursor-pointer"
          >
            <span className="hidden min-[420px]:inline">返回试卷库</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full min-w-0 max-w-7xl mx-auto px-3 sm:px-margin-tablet lg:px-margin-desktop py-4 sm:py-space-xl flex flex-col space-y-4 sm:space-y-space-xl">
        
        {/* 2. Score & AI Master Review Dashboard */}
        <section className="bg-surface-container-lowest rounded-2xl p-3 sm:p-space-xl shadow-sm border border-outline-variant/30 flex flex-col lg:flex-row gap-3 sm:gap-space-xl items-stretch">
          {/* Left: Score & Key KPI Cards */}
          <div className="lg:w-80 shrink-0 flex flex-col justify-between p-3 sm:p-space-lg bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-space-md">
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
              {aiGradingUsage?.total > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant" aria-label="AI逐题复核用量">
                  <span>{aiGradingUsage.enabled === false ? '未配置模型，逐题复核使用本地判分' : `AI 逐题复核：${aiGradingUsage.checked}/${aiGradingUsage.total} 题`}</span>
                  {aiGradingUsage.failed > 0 && <span>复核失败 {aiGradingUsage.failed} 题</span>}
                  {aiGradingUsage.totalTokens > 0 && <span>{Number(aiGradingUsage.totalTokens).toLocaleString()} Tokens</span>}
                  {aiGradingUsage.estimatedCostCny !== null && aiGradingUsage.estimatedCostCny !== undefined && Number.isFinite(Number(aiGradingUsage.estimatedCostCny)) && aiGradingUsage.calls > 0 && <span>约 ¥{Number(aiGradingUsage.estimatedCostCny).toFixed(4)}</span>}
                </p>
              )}
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

        {/* English Vocabulary Capture Banner */}
        {markedVocabList && markedVocabList.length > 0 && (
          <section className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-secondary/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-secondary-container/60 text-secondary flex items-center justify-center shrink-0 border border-secondary/20">
                <span className="material-symbols-outlined text-[24px]">menu_book</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-title-sm font-bold text-on-surface">考场真题生词捕获</h3>
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-on-secondary text-[11px] font-bold font-mono">
                    共标记 {markedVocabList.length} 词
                  </span>
                  <span className="text-[12px] text-on-surface-variant font-label-mono">
                    来源：《{paperTitle}》
                  </span>
                </div>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">
                  已自动提取考场真题长难句切片语境。您可以一键全部同步或挑选部分生词同步至单词本，开启艾宾浩斯抗遗忘记忆。
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {markedVocabList.slice(0, 10).map((w, i) => (
                    <span key={i} className="px-2 py-0.5 bg-surface-container-low text-on-surface font-mono text-[11px] rounded-md border border-outline-variant/30">
                      {w.word}
                    </span>
                  ))}
                  {markedVocabList.length > 10 && (
                    <span className="text-[11px] text-outline self-center">
                      等共 {markedVocabList.length} 个单词
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  setVocabSyncSuccessMessage('');
                  setIsVocabModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary font-label-md font-semibold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
                <span>同步至生词本 (可部分选择)</span>
              </button>
            </div>
          </section>
        )}

        {/* 3. Filter Pill Bar & Question Mini-Map Matrix */}
        <section className="min-w-0 bg-surface-container-lowest rounded-xl p-3 sm:p-space-md shadow-sm border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-space-md">
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
              <span>{expandedAll ? '全部收起 AI 解析' : '全部展开 AI 深度解析'}</span>
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
                  {q.passage && !isPseudoPassage(q.passage) && (
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
                      <span>{isExpanded ? '收起本题 AI 深度解析' : '🤖 查看 AI 智能深度解析与阅卷点评'}</span>
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

                  {/* Expandable AI Deep Analysis & AI Insight */}
                  {isExpanded && (
                    <div className="mt-space-sm p-4 rounded-2xl bg-surface-container-low/80 border border-primary/20 space-y-4 animate-in fade-in duration-200">
                      {/* 1. 🤖 AI 智能名师深度解析 (绝对主角) */}
                      <div className="p-4 rounded-xl bg-surface-container-lowest border border-primary/25 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20 flex-wrap gap-2">
                          <span className="font-sans text-xs text-primary font-bold flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                            🤖 AI 名师深度解析 (分步精讲与核心考点)
                          </span>
                          <button
                            type="button"
                            disabled={generatingAiAnalysisMap[q.id]}
                            onClick={() => handleGenerateAiAnalysis(q, idx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                            title="由 AI 重新深度推导本题解析"
                          >
                            <span className={`material-symbols-outlined text-[13px] ${generatingAiAnalysisMap[q.id] ? 'animate-spin' : ''}`}>
                              {generatingAiAnalysisMap[q.id] ? 'progress_activity' : 'refresh'}
                            </span>
                            <span>{generatingAiAnalysisMap[q.id] ? 'AI 解析生成中...' : (q.aiAnalysis ? '重新生成 AI 解析' : '一键生成 AI 深度解析')}</span>
                          </button>
                        </div>

                        <div className="text-body-md text-on-surface leading-relaxed pl-1 pt-1">
                          <MathMarkdown content={q.aiAnalysis || q.analysis || '暂无解析，点击上方「一键生成 AI 深度解析」即刻推导'} />
                        </div>
                      </div>

                      {/* 2. 🎯 AI 针对作答诊断与踩分点评 (如有) */}
                      {q.aiInsight && (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 space-y-1">
                          <span className="font-sans text-[11px] text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">psychology</span>
                            🎯 AI 判卷评语与失分采分点剖析:
                          </span>
                          <p className="text-body-sm text-on-surface-variant pl-2 font-sans leading-relaxed">
                            {q.aiInsight}
                          </p>
                        </div>
                      )}

                      {/* 3. 官方原始说明 (次要选看，若原题有且不同才可展开) */}
                      {q.analysis && q.analysis !== q.aiAnalysis && (
                        <div className="pt-0.5">
                          <button
                            type="button"
                            onClick={() => setShowOfficialMap(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                            className="inline-flex items-center gap-1 text-[11px] text-outline hover:text-on-surface-variant transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {showOfficialMap[q.id] ? 'expand_less' : 'expand_more'}
                            </span>
                            <span>{showOfficialMap[q.id] ? '收起试卷原始附带说明' : '📄 展开试卷原始附带说明（选看）'}</span>
                          </button>
                          {showOfficialMap[q.id] && (
                            <div className="mt-2 p-3 rounded-lg bg-surface-container text-body-sm text-on-surface-variant leading-relaxed border border-outline-variant/20">
                              <MathMarkdown content={q.analysis} />
                            </div>
                          )}
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

      {/* 7. Modal: Sync Marked Vocabulary to Vocabulary Notebook */}
      {isVocabModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-space-xs border-b border-surface-container shrink-0">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-[24px] text-secondary">menu_book</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                    同步考场生词至生词本
                  </h3>
                  <p className="text-[12px] text-on-surface-variant">
                    收录自《{paperTitle}》考场真题长难句切片，支持挑选部分同步
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVocabModalOpen(false)}
                className="text-outline hover:text-on-surface p-1 rounded hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Quick Selection Toolbar */}
            <div className="flex items-center justify-between py-1 px-1 shrink-0">
              <label className="flex items-center space-x-2 text-label-sm font-semibold text-on-surface cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedWordIds.length === markedVocabList.length && markedVocabList.length > 0}
                  onChange={handleToggleSelectAllWords}
                  className="rounded text-secondary focus:ring-secondary w-4 h-4 cursor-pointer"
                />
                <span>全选所有已标生词 (已勾选 {selectedWordIds.length} / {markedVocabList.length} 词)</span>
              </label>

              <div className="text-[11px] text-outline">
                点击复选框可自由增删待同步词汇
              </div>
            </div>

            {/* Word List Scroll Container */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-64 border border-outline-variant/30 rounded-xl p-space-sm bg-surface-container-low/30">
              {markedVocabList.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant text-body-sm">
                  未检测到标记生词。
                </div>
              ) : (
                markedVocabList.map((item) => {
                  const isChecked = selectedWordIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleWord(item.id)}
                      className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-surface-container-lowest border-secondary/50 shadow-2xs'
                          : 'bg-surface-container-low/50 border-outline-variant/20 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-1 rounded text-secondary focus:ring-secondary w-4 h-4 cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-on-surface font-mono text-[14px]">
                            {item.word}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant shrink-0">
                            题号 {item.qNum}
                          </span>
                        </div>
                        {item.sentence && (
                          <p className="text-[12px] text-on-surface-variant mt-1 font-sans line-clamp-2 leading-relaxed">
                            "{item.sentence}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Target Folder Setting */}
            <div className="space-y-space-xs pt-space-xs border-t border-surface-container shrink-0">
              <span className="text-label-sm font-semibold text-on-surface block">
                归档目标生词本文件夹:
              </span>
              
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-1.5 text-body-sm cursor-pointer">
                  <input
                    type="radio"
                    name="targetVocabFolder"
                    checked={targetVocabFolderMode === 'existing'}
                    onChange={() => setTargetVocabFolderMode('existing')}
                    className="text-secondary"
                  />
                  <span>存入已有生词本</span>
                </label>
                <label className="flex items-center space-x-1.5 text-body-sm cursor-pointer">
                  <input
                    type="radio"
                    name="targetVocabFolder"
                    checked={targetVocabFolderMode === 'new'}
                    onChange={() => setTargetVocabFolderMode('new')}
                    className="text-secondary"
                  />
                  <span>新建生词本文件夹</span>
                </label>
              </div>

              {targetVocabFolderMode === 'new' ? (
                <input
                  type="text"
                  value={newVocabFolderName}
                  onChange={(e) => setNewVocabFolderName(e.target.value)}
                  placeholder="输入生词本名称，例如：2026考研英语 · 真题核心生词"
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-body-md border border-outline-variant/40 focus:outline-none focus:border-secondary font-sans"
                />
              ) : (
                <SelectMenu
                  ariaLabel="选择目标生词本"
                  value={existingVocabFolderId}
                  onChange={setExistingVocabFolderId}
                  options={vocabFolders.map((f) => ({
                    value: f.id,
                    label: `${f.name} (${f.count || 0} 词)`
                  }))}
                  className="w-full"
                  buttonClassName="inline-flex w-full items-center justify-between gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-left text-body-md text-on-surface hover:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                />
              )}

              {/* AI Enrich Checkbox */}
              <label className="flex items-center space-x-2 pt-1 text-[12px] text-on-surface cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableAiEnrichVocab}
                  onChange={(e) => setEnableAiEnrichVocab(e.target.checked)}
                  className="rounded text-secondary focus:ring-secondary w-3.5 h-3.5"
                />
                <span>开启 AI 深度补齐释义、音标、真题例句翻译与构词助记 (model_core)</span>
              </label>
            </div>

            {/* Success message banner */}
            {vocabSyncSuccessMessage && (
              <div className="p-3 bg-secondary-container/40 border border-secondary text-secondary rounded-xl text-body-sm font-medium flex items-center justify-between animate-in fade-in">
                <span>{vocabSyncSuccessMessage}</span>
                {onOpenVocabulary && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsVocabModalOpen(false);
                      onOpenVocabulary();
                    }}
                    className="px-3 py-1 rounded-lg bg-secondary text-on-secondary text-[12px] font-semibold cursor-pointer shadow-xs active:scale-95"
                  >
                    前往背单词 &gt;
                  </button>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-surface-container shrink-0">
              {onOpenVocabulary ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsVocabModalOpen(false);
                    onOpenVocabulary();
                  }}
                  className="text-label-sm text-secondary hover:underline font-semibold cursor-pointer"
                >
                  前往背单词模块 &gt;
                </button>
              ) : <div />}

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsVocabModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer"
                >
                  {vocabSyncSuccessMessage ? '关闭' : '取消'}
                </button>
                <button
                  type="button"
                  disabled={isEnrichingVocab || selectedWordIds.length === 0}
                  onClick={handleConfirmSyncVocab}
                  className="px-5 py-2 rounded-lg bg-secondary hover:bg-secondary/90 text-on-secondary font-label-md font-semibold shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isEnrichingVocab && (
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                  )}
                  <span>
                    {isEnrichingVocab
                      ? 'AI 补齐词义并同步中...'
                      : `确认同步至生词本 (${selectedWordIds.length} 词)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
