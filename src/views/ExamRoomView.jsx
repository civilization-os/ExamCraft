import React, { useState, useEffect } from 'react';

export default function ExamRoomView({ activePaper, questions, onExit, onOpenMistakes }) {
  const [currentQIndex, setCurrentQIndex] = useState(15); // Default to Q16 (index 15) to showcase the comprehensive math question
  const [questionList, setQuestionList] = useState(questions);
  
  // Timer state (starts at 1 hour 28 mins 45 secs = 5325 seconds)
  const [secondsLeft, setSecondsLeft] = useState(5325);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Answering Mode: 'ai-scribe' or 'ocr'
  const [answerMode, setAnswerMode] = useState('ai-scribe');

  // Candidate draft input for current question
  const currentQ = questionList[currentQIndex] || questionList[0];
  const [candidateDraft, setCandidateDraft] = useState(currentQ.userAnswer || '');

  // Scratchpad toggle
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [scratchpadNote, setScratchpadNote] = useState('');

  // Submit Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  // Sync draft when switching question
  useEffect(() => {
    setCandidateDraft(questionList[currentQIndex]?.userAnswer || '');
  }, [currentQIndex]);

  // Countdown timer effect
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimer = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const answeredCount = questionList.filter((q) => q.userAnswer && q.userAnswer.trim().length > 0).length;

  const handleUpdateAnswer = (val) => {
    setCandidateDraft(val);
    setQuestionList((prev) =>
      prev.map((q, idx) =>
        idx === currentQIndex
          ? { ...q, userAnswer: val, status: val.trim() ? 'answered' : 'unanswered' }
          : q
      )
    );
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-background min-h-screen">
      {/* Top Floating Minimalist Exam Status Strip */}
      <header className="sticky top-0 z-40 w-full bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/30 px-4 sm:px-margin-desktop py-space-sm flex items-center justify-between shadow-sm">
        {/* Left: Exam Title & Secure Integrity Status */}
        <div className="flex items-center space-x-space-md min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer mr-1"
            title="退出考场返回工作台"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex items-center space-x-space-xs text-primary font-headline-sm text-headline-sm">
            <span className="material-symbols-outlined text-primary text-[20px] material-symbols-fill">terminal</span>
            <span className="tracking-tight text-on-surface font-headline-sm truncate max-w-xs md:max-w-md font-semibold">
              {activePaper?.title || '全国高等数学模拟冲刺卷 #04'}
            </span>
          </div>
          <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-secondary-container/30 text-secondary font-label-mono text-label-mono border border-secondary-container">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
            <span>防作弊闭卷监考模式</span>
          </span>
        </div>

        {/* Center: Global Progress Bar & Current Type */}
        <div className="hidden lg:flex flex-col items-center justify-center min-w-[260px]">
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-on-surface-variant font-label-mono text-label-mono">
              答题卡填涂: {answeredCount} / {questionList.length}
            </span>
            <span className="px-1.5 py-0.2 bg-surface-container text-on-surface-variant font-label-mono text-label-mono rounded">
              {currentQ.type}
            </span>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / questionList.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Right: Telemetry & Actions */}
        <div className="flex items-center space-x-space-sm sm:space-x-space-md">
          {/* Countdown Timer */}
          <div className="flex items-center space-x-1.5 px-2.5 sm:px-space-md py-1 bg-surface-container-low rounded-lg border border-outline-variant/40">
            <span className="material-symbols-outlined text-tertiary text-[18px]">timer</span>
            <span className="font-code-md text-code-md font-semibold text-tertiary tracking-wider font-mono">
              {formatTimer(secondsLeft)}
            </span>
          </div>

          {/* Quick Scratchpad Toggle */}
          <button
            type="button"
            onClick={() => setShowScratchpad(!showScratchpad)}
            className={`hidden sm:inline-flex items-center space-x-1 px-space-md py-1 font-label-md text-label-md rounded border transition cursor-pointer ${
              showScratchpad
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface text-on-surface-variant hover:text-on-surface border-outline-variant/50 hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">draw</span>
            <span>便签草稿纸</span>
          </button>

          {/* Focus Mode Pill */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="hidden xl:flex items-center space-x-1 px-2 py-1 text-on-surface-variant font-label-mono text-label-mono hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">fullscreen</span>
            <span>全屏专注</span>
          </button>

          {/* Submit Exam Button */}
          <button
            type="button"
            onClick={() => setIsSubmitModalOpen(true)}
            className="inline-flex items-center space-x-1 px-3 sm:px-space-lg py-1.5 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>交卷并提交评测</span>
          </button>
        </div>
      </header>

      {/* Main Focus Runner Layout */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-margin-tablet lg:px-margin-desktop py-space-xl flex flex-col space-y-space-xl pb-24">
        {/* Navigation Sheet Pill Bar (答题卡横向快速切换) */}
        <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant/30 flex items-center justify-between gap-space-md overflow-x-auto">
          <div className="flex items-center gap-space-sm shrink-0">
            <span className="font-label-mono text-label-mono text-on-surface-variant font-semibold">答题卡矩阵:</span>
            <div className="flex items-center gap-1.5">
              {questionList.map((q, idx) => {
                const isCurrent = idx === currentQIndex;
                const isAnswered = q.userAnswer && q.userAnswer.trim().length > 0;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentQIndex(idx)}
                    className={`w-7.5 h-7.5 rounded text-[11px] font-label-mono transition-all flex items-center justify-center cursor-pointer ${
                      isCurrent
                        ? 'ring-2 ring-primary bg-primary text-on-primary font-bold shadow-xs'
                        : isAnswered
                        ? 'bg-secondary-container/40 text-secondary border border-secondary/30 font-medium'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {q.num}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={currentQIndex === 0}
              onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
              className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-label-sm font-label-sm cursor-pointer disabled:cursor-not-allowed"
            >
              上一题
            </button>
            <button
              type="button"
              disabled={currentQIndex === questionList.length - 1}
              onClick={() => setCurrentQIndex((i) => Math.min(questionList.length - 1, i + 1))}
              className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-label-sm font-label-sm cursor-pointer disabled:cursor-not-allowed"
            >
              下一题
            </button>
          </div>
        </section>

        {/* Question Header Card */}
        <section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/40 flex flex-col space-y-space-md">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
            <div className="flex items-center space-x-space-md">
              <span className="px-2.5 py-1 bg-primary-fixed text-on-primary-fixed font-headline-sm text-headline-sm rounded font-semibold">
                题号 {currentQ.num}
              </span>
              <span className="text-on-surface-variant font-label-md text-label-md">
                {currentQ.type} · 满分 {currentQ.score} 分
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => alert(`已为题号 ${currentQ.num} 添加考场备忘笔记。`)}
                className="inline-flex items-center space-x-1 px-2 py-1 text-on-surface-variant hover:text-primary text-label-sm font-label-sm rounded hover:bg-surface-container-low transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                <span>添加笔记</span>
              </button>
              <span className="text-outline-variant">|</span>
              <span className="text-on-surface-variant font-label-mono text-label-mono">
                难度: {currentQ.difficultyStr || '★★★★☆'}
              </span>
            </div>
          </div>

          {/* Mathematical Prompt Description */}
          <div className="py-space-md">
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight mb-space-sm font-semibold">
              {currentQ.prompt}
            </h2>
            {currentQ.mathExpression && (
              <div className="bg-surface-container-low px-space-xl py-space-lg rounded-lg border-l-4 border-primary flex items-center justify-between overflow-x-auto my-2">
                <div className="flex items-center space-x-3 font-mono text-headline-md text-primary font-semibold">
                  <span className="tracking-wide">{currentQ.mathExpression}</span>
                  {currentQ.condition && (
                    <span className="text-body-md text-on-surface-variant font-sans font-normal ml-4">
                      {currentQ.condition}
                    </span>
                  )}
                </div>
                <span className="text-on-surface-variant font-label-mono text-label-mono uppercase tracking-widest hidden md:inline-block">
                  {currentQ.category || 'ADVANCED EXAM'}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Question Type: Choice vs Blank vs Comprehensive */}
        {currentQ.options && (
          <section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/40 space-y-space-md">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">单选题候选项选择：</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {currentQ.options.map((opt) => {
                const isSelected = currentQ.userAnswer === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleUpdateAnswer(opt.key)}
                    className={`flex items-center gap-space-md p-space-md rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary/5 border-primary ring-2 ring-primary text-primary font-semibold'
                        : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-label-md ${
                        isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'
                      }`}
                    >
                      {opt.key}
                    </span>
                    <span className="font-body-md text-body-md">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* If Blank Fill */}
        {currentQ.type === '填空题' && (
          <section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/40 space-y-space-md">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">请在横线处填入最终算式或数值：</h3>
            <div className="max-w-md">
              <input
                type="text"
                value={candidateDraft}
                onChange={(e) => handleUpdateAnswer(e.target.value)}
                placeholder="例如：x^4/2 + (3/2)x^2"
                className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg font-mono text-body-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest"
              />
            </div>
          </section>
        )}

        {/* Comprehensive Calculus / Proof Question (Dual Modality Input Switcher) */}
        {currentQ.type === '综合计算与解答题' && (
          <section className="flex flex-col space-y-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-space-sm">
                <span className="text-on-surface font-headline-sm text-headline-sm font-semibold">
                  考生作答交付模式
                </span>
                <span className="text-on-surface-variant font-body-sm text-body-sm">
                  (互斥二选一 · 系统即时转译)
                </span>
              </div>
              <div className="text-label-mono text-label-mono text-on-surface-variant">
                当前已保存草稿: <span className="text-secondary font-semibold font-mono">14:02:19 自动暂存</span>
              </div>
            </div>

            {/* Segmented Buttons */}
            <div className="grid grid-cols-2 p-1 bg-surface-container-high rounded-xl max-w-xl shadow-inner border border-outline-variant/20">
              <button
                type="button"
                onClick={() => setAnswerMode('ocr')}
                className={`flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-label-md text-label-md transition cursor-pointer ${
                  answerMode === 'ocr'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[19px]">photo_camera</span>
                <span>模式 A · 拍照扫码识图录入</span>
              </button>
              <button
                type="button"
                onClick={() => setAnswerMode('ai-scribe')}
                className={`flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-label-md text-label-md transition cursor-pointer ${
                  answerMode === 'ai-scribe'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[19px]">auto_fix_high</span>
                <span>模式 B · AI 规范代笔排版</span>
              </button>
            </div>

            {/* Panel: Mode B (AI Scribe) */}
            {answerMode === 'ai-scribe' && (
              <div className="flex flex-col space-y-space-md">
                {/* Integrity Disclaimer Banner */}
                <div className="flex items-start space-x-space-md p-space-md bg-tertiary-fixed/30 border border-tertiary-fixed rounded-xl text-on-tertiary-fixed">
                  <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5 material-symbols-fill">
                    gavel
                  </span>
                  <div className="flex-1 text-body-sm font-body-sm leading-relaxed">
                    <span className="font-semibold text-tertiary">作答诚信与监考边界声明：</span>
                    本工作台开启的「AI 规范代笔」仅将考生的口述演录、凌乱草稿与简写符号转录为标准的 LaTeX 数学推导与分步排版。系统内嵌模型已被强制切断题目解答、逻辑修正与作弊引导能力，任何逻辑错误均会被原样忠实保留，确保考核客观性与独立性。
                  </div>
                </div>

                {/* Split Input & Realtime Render Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
                  {/* Left: Candidate Scratchpad & Shorthand Raw Input */}
                  <div className="flex flex-col bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/40 space-y-space-sm">
                    <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                      <div className="flex items-center space-x-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">edit_note</span>
                        <span className="font-label-md text-label-md text-on-surface font-semibold">
                          考生自拟速记推导草稿 (支持手打与语音转文字)
                        </span>
                      </div>
                      <span className="text-label-mono text-label-mono text-on-surface-variant font-code-sm">
                        {candidateDraft.length} 字符
                      </span>
                    </div>

                    <textarea
                      value={candidateDraft}
                      onChange={(e) => handleUpdateAnswer(e.target.value)}
                      placeholder="在此输入草稿推演，例如：
原式采用分部积分法...
设 u = ln(x+1), 则 du = 1/(x+1) dx
设 dv = x^2 dx, 则 v = 1/3 * x^3 ..."
                      className="w-full h-80 p-space-md font-mono text-code-md text-on-surface bg-surface-container-low rounded-lg border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition resize-none leading-relaxed"
                    />

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center space-x-2 text-on-surface-variant font-label-sm text-label-sm">
                        <span className="material-symbols-outlined text-[16px] text-secondary">sync</span>
                        <span>智能引擎自检排印中，实时对应分步赋分标签</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdateAnswer('')}
                        className="px-space-md py-1 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md rounded border border-outline-variant/40 transition cursor-pointer"
                      >
                        清空草稿
                      </button>
                    </div>
                  </div>

                  {/* Right: AI Standardized LaTeX Transcription */}
                  <div className="flex flex-col bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/40 space-y-space-sm justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                        <div className="flex items-center space-x-2">
                          <span className="material-symbols-outlined text-secondary text-[18px]">terminal</span>
                          <span className="font-label-md text-label-md text-on-surface font-semibold">
                            AI 规范转录标准数学分步卷面
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-label-mono text-code-sm font-semibold">
                          实时公式向量化
                        </span>
                      </div>

                      {/* Mathematical Render Container */}
                      <div className="mt-space-sm p-space-md bg-surface-container-low rounded-lg font-mono text-code-md space-y-space-sm border border-outline-variant/30 overflow-x-auto">
                        <div className="text-primary font-semibold">
                          ∫ x² ln(x+1) dx
                        </div>
                        <div className="text-on-surface pl-4 border-l-2 border-primary/30 space-y-1">
                          <p>= (x³/3) ln(x+1) - (1/3) ∫ [x³ / (x+1)] dx</p>
                          <p>= (x³/3) ln(x+1) - (1/3) ∫ (x² - x + 1 - 1/(x+1)) dx</p>
                          <p>= (x³/3) ln(x+1) - (x³/9) + (x²/6) - (x/3) + (1/3) ln(x+1) + C</p>
                        </div>
                      </div>

                      {/* Step-by-Step Scoring Checklist */}
                      <div className="mt-space-md space-y-1.5">
                        <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
                          AI 阅卷踩分点预估自核：
                        </span>
                        {(currentQ.stepScores || [
                          { step: "步骤 1: 准确应用分部积分设元与通式展开", score: "+3分 (已达成)" },
                          { step: "步骤 2: 假分式化简长除法分解拆项", score: "+3分 (已达成)" },
                          { step: "步骤 3: 逐项定常数积分与常数 C 补齐", score: "+4分 (已达成)" }
                        ]).map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded bg-surface-container-lowest border border-outline-variant/20 font-label-sm text-label-sm"
                          >
                            <span className="text-on-surface flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                              {item.step}
                            </span>
                            <span className="text-secondary font-mono font-semibold">{item.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => alert('公式变量与符号渲染格式已优化微调。')}
                        className="inline-flex items-center gap-1 px-space-md py-1 bg-surface text-primary border border-primary-fixed-dim hover:bg-surface-container font-label-md text-label-md rounded transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">tune</span>
                        <span>微调公式变量格式</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Panel: Mode A (OCR) */}
            {answerMode === 'ocr' && (
              <div className="flex flex-col space-y-space-md bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/40">
                <div className="flex items-center justify-between pb-space-md border-b border-surface-container">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      拍照/扫描草稿纸作答交卷
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      支持使用手持设备直接扫码拍照并极速回传同步，或本地上传清晰草稿图片。
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-surface-container text-on-surface-variant font-label-mono text-label-mono rounded">
                    支持 JPG, PNG, PDF (最大 20MB)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
                  {/* QR Sync Box */}
                  <div className="flex flex-col items-center justify-center p-space-xl bg-surface-container-low rounded-xl border border-dashed border-outline-variant text-center space-y-space-md">
                    <div className="w-28 h-28 bg-surface-container-lowest p-2 rounded-lg border border-outline-variant flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-[72px] text-on-surface">qr_code_2</span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-label-md text-label-md text-on-surface font-semibold">
                        微信/浏览器扫码拍照
                      </div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">
                        同步设备：已授权考生手机端
                      </div>
                    </div>
                  </div>

                  {/* Drag & Upload Dropzone */}
                  <label className="md:col-span-2 flex flex-col items-center justify-center p-space-xl bg-surface-container-low rounded-xl border-2 border-dashed border-primary-fixed-dim hover:border-primary transition cursor-pointer text-center space-y-space-sm group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={() => alert('手写草稿照片已上传并完成梯形倾斜校正与公式提取！')}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary group-hover:scale-110 transition">
                      <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-label-md text-label-md text-on-surface font-semibold">
                        点击上传手写答题卷或将文件拖曳至此
                      </div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">
                        算法将实时矫正倾斜、滤除背景阴影并提取标准算式
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mt-2 px-space-lg py-1.5 bg-surface text-on-surface font-label-md text-label-md rounded border border-outline-variant shadow-sm hover:bg-surface-container transition"
                    >
                      选择本地图像
                    </button>
                  </label>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Floating Scratchpad Drawer */}
      {showScratchpad && (
        <div className="fixed bottom-6 right-6 w-80 sm:w-96 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/40 p-space-md z-50 animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between pb-2 border-b border-surface-container">
            <div className="flex items-center gap-1.5 font-semibold text-on-surface text-label-md">
              <span className="material-symbols-outlined text-[18px] text-primary">draw</span>
              <span>便签草稿纸 (自动本地保存)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowScratchpad(false)}
              className="text-outline hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <textarea
            value={scratchpadNote}
            onChange={(e) => setScratchpadNote(e.target.value)}
            placeholder="随时记录草稿算式、换元设项、演算中间值..."
            className="w-full h-44 mt-2 p-2 bg-surface-container-low rounded-lg font-mono text-body-sm focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30 resize-none"
          />
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-md">
            <div className="flex items-center gap-space-sm text-primary">
              <span className="material-symbols-outlined text-[28px]">fact_check</span>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">确认交卷并评测？</h3>
            </div>
            <p className="text-body-md text-on-surface-variant">
              当前共答出 <span className="font-bold text-primary">{answeredCount}</span> 题，未填涂 <span className="font-bold text-tertiary">{questionList.length - answeredCount}</span> 题。
              系统将启动多模态判题模型，原位比对推导步骤并生成知识点分析与错因归类。
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md cursor-pointer"
              >
                继续作答
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSubmitModalOpen(false);
                  setIsResultModalOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md shadow-sm cursor-pointer"
              >
                确认交卷
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exam Result / Score Modal */}
      {isResultModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-background/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-space-xl shadow-2xl border border-outline-variant/40 space-y-space-lg text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-secondary-container/40 text-secondary flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[36px]">military_tech</span>
            </div>

            <div className="space-y-1">
              <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">
                考试圆满完成！
              </h2>
              <p className="text-body-md text-on-surface-variant">
                试卷《{activePaper?.title || '高等数学模拟冲刺卷 #04'}》评分报告已生成
              </p>
            </div>

            <div className="grid grid-cols-3 gap-space-md p-space-md bg-surface-container-low rounded-xl">
              <div>
                <p className="font-label-mono text-label-mono text-on-surface-variant">得分</p>
                <p className="font-headline-xl font-bold text-secondary font-mono">88 <span className="text-body-sm text-on-surface-variant font-normal">/ 100</span></p>
              </div>
              <div>
                <p className="font-label-mono text-label-mono text-on-surface-variant">正确率</p>
                <p className="font-headline-xl font-bold text-primary font-mono">87.5%</p>
              </div>
              <div>
                <p className="font-label-mono text-label-mono text-on-surface-variant">建议复盘</p>
                <p className="font-headline-xl font-bold text-tertiary font-mono">2 题</p>
              </div>
            </div>

            <div className="p-space-sm bg-surface-container rounded-lg text-left text-body-sm text-on-surface space-y-1">
              <p className="font-semibold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">psychology</span>
                AI 阅卷名师总结：
              </p>
              <p className="text-on-surface-variant">
                第 16 题微积分综合计算题推导完全严谨，步骤分全拿；第 2 题与第 9 题已自动归入《高等数学期末易错集》，建议前往错题本进行举一反三强化复盘。
              </p>
            </div>

            <div className="flex justify-center gap-space-md pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsResultModalOpen(false);
                  onOpenMistakes();
                }}
                className="px-space-xl py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md font-semibold shadow-md cursor-pointer"
              >
                前往我的错题本复盘
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsResultModalOpen(false);
                  onExit();
                }}
                className="px-space-lg py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer"
              >
                返回工作台
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
