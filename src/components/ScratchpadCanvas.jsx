import React, { useRef, useEffect, useState, useCallback } from 'react';
import MathMarkdown from './MathMarkdown';

/**
 * ScratchpadCanvas / Workbench
 * 一体化考场草稿演算工作台：
 * 1. 自由手绘涂鸦画板（Canvas、方格坐标纸、信纸横线、白纸、多色笔刷、橡皮、撤销重做、导出）
 * 2. 文本公式笔记与 KaTeX 实时高保真渲染（无缝同屏呈现，无需模式切换）
 * 3. 考场专属 Agent Loop 帮写草稿引擎（严格限制：只能局限于考生说出来的才能写，绝不帮算）
 * 4. 统一 UI 确认对话框与 Toast 提示，彻底根除浏览器丑陋的原生 alert/confirm
 */
export default function ScratchpadCanvas({
  storageKey = 'examcraft_scratchpad_canvas',
  textStorageKey = 'examcraft_scratchpad_text',
  contextProblem = '',
  currentAnswerDraft = '',
  onScribeToAnswer = null,
  isMaximized = false,
  onToggleMaximize = null,
  onClose = null
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // ==================== 画板手绘状态 ====================
  const [tool, setTool] = useState('brush'); // 'brush' | 'eraser'
  const [brushColor, setBrushColor] = useState('#0f172a'); // 墨黑
  const [brushSize, setBrushSize] = useState(3); // 2 | 4 | 7
  const [paperPattern, setPaperPattern] = useState('grid'); // 'grid' | 'lined' | 'blank'

  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // ==================== 文本与板书笔记状态 ====================
  const [boardText, setBoardText] = useState(() => {
    try {
      return localStorage.getItem(textStorageKey) || '';
    } catch {
      return '';
    }
  });
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(false); // 在小窗时可折叠右侧板书栏

  // ==================== Agent Loop 状态 ====================
  const [spokenInput, setSpokenInput] = useState('');
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentLoopStage, setAgentLoopStage] = useState(''); // 'audit' | 'scribe' | 'board'
  const [agentMessage, setAgentMessage] = useState('');

  // ==================== 统一 UI 弹窗与 Toast 状态 ====================
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '确认',
    confirmType: 'danger', // 'danger' | 'primary'
    onConfirm: () => {}
  });

  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'info' // 'success' | 'warn' | 'info'
  });

  const showToast = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3500);
  }, []);

  // 保存文本到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(textStorageKey, boardText);
    } catch (e) {
      console.warn('Text save error:', e);
    }
  }, [boardText, textStorageKey]);

  // ==================== 画板尺寸自适应与高分辨率适配 ====================
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;

    let tempImgData = null;
    const ctx = canvas.getContext('2d');
    if (canvas.width > 0 && canvas.height > 0) {
      tempImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tempImgData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = tempImgData.width;
      tempCanvas.height = tempImgData.height;
      tempCanvas.getContext('2d').putImageData(tempImgData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
    } else {
      const savedDataUrl = localStorage.getItem(storageKey);
      if (savedDataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          saveToHistory();
        };
        img.src = savedDataUrl;
      } else {
        saveToHistory();
      }
    }
  }, [storageKey]);

  useEffect(() => {
    resizeCanvas();
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => {
      resizeObserver.disconnect();
    };
  }, [resizeCanvas]);

  // 保存手绘画布快照
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyStep + 1);
      newHistory.push(dataUrl);
      if (newHistory.length > 20) newHistory.shift();
      return newHistory;
    });
    setHistoryStep((prev) => Math.min(prev + 1, 19));

    try {
      localStorage.setItem(storageKey, dataUrl);
    } catch (e) {
      console.warn('Canvas save to localStorage error:', e);
    }
  }, [historyStep, storageKey]);

  // 恢复历史笔画
  const restoreFromDataUrl = (dataUrl) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.drawImage(img, 0, 0, width, height);
      try {
        localStorage.setItem(storageKey, dataUrl);
      } catch (e) {
        console.warn(e);
      }
    };
    img.src = dataUrl;
  };

  // 撤销
  const handleUndo = () => {
    if (historyStep > 0) {
      const nextStep = historyStep - 1;
      setHistoryStep(nextStep);
      restoreFromDataUrl(history[nextStep]);
    }
  };

  // 重做
  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      restoreFromDataUrl(history[nextStep]);
    }
  };

  // 一键清屏（使用统一系统 UI 弹窗）
  const handleClearCanvasClick = () => {
    setConfirmDialog({
      isOpen: true,
      title: '清空手绘草稿',
      message: '确定要清空当前画布上的所有手绘笔迹吗？清空后将无法恢复。',
      confirmText: '确认清空',
      confirmType: 'danger',
      onConfirm: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        saveToHistory();
        showToast('手绘画板已清空', 'info');
      }
    });
  };

  // 一键清空文本草稿（使用统一系统 UI 弹窗）
  const handleClearNotesClick = () => {
    setConfirmDialog({
      isOpen: true,
      title: '清空公式笔记',
      message: '确定要清空右侧的文本与公式草稿内容吗？',
      confirmText: '清空笔记',
      confirmType: 'danger',
      onConfirm: () => {
        setBoardText('');
        showToast('公式草稿笔记已清空', 'info');
      }
    });
  };

  // 导出图片下载
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');

    expCtx.fillStyle = '#f8fafc';
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    expCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `考场草稿手绘_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    showToast('草稿手绘图已导出保存', 'success');
  };

  // 坐标计算
  const getPointerPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // 手绘开始
  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pos = getPointerPos(e);
    lastPointRef.current = pos;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (brushSize * (tool === 'eraser' ? 4 : 1)) / 2, 0, Math.PI * 2);
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = brushColor;
      ctx.fill();
    }
  };

  // 手绘移动
  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return;
    const currentPoint = getPointerPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    const midX = (lastPointRef.current.x + currentPoint.x) / 2;
    const midY = (lastPointRef.current.y + currentPoint.y) / 2;
    ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 5;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
    }

    ctx.stroke();
    lastPointRef.current = currentPoint;
  };

  // 手绘结束
  const handlePointerUp = (e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    saveToHistory();
  };

  // ==================== 核心 Agent Loop 执行逻辑 ====================
  // 严格限制：只能局限于考生说出来的才能写，严禁帮算！
  const handleTriggerAgentLoop = async () => {
    if (!spokenInput.trim()) {
      showToast('请先输入或口述您的解题步骤或思路', 'warn');
      return;
    }

    setIsAgentRunning(true);
    setAgentLoopStage('Loop 1 · 诚信纪律审计中...');
    setAgentMessage('');

    try {
      // 阶段 1：模拟审计进度
      await new Promise((r) => setTimeout(r, 200));
      setAgentLoopStage('Loop 2 · 规范 LaTeX 与数学步骤转写中...');

      const res = await fetch('/api/model/scratchpad-agent-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spokenText: spokenInput,
          contextProblem: contextProblem,
          currentBoardContent: boardText
        })
      });

      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Agent Loop 执行失败', 'warn');
        return;
      }

      setAgentLoopStage('Loop 3 · 注入草稿板书...');
      const agentData = data.agentData;

      if (!agentData.audit.passed) {
        setAgentMessage(`⚠️ ${agentData.audit.reason}：只能帮写您明确说出的内容，严禁诱导计算！`);
        showToast('检测到计算诱导，已触碰考场防纪律红线', 'warn');
      } else {
        // 成功将考生说出的内容规范誊写并追加到草稿板
        const newBoardText = boardText
          ? `${boardText}\n\n${agentData.scribeResult}`
          : agentData.scribeResult;

        setBoardText(newBoardText);
        setSpokenInput('');
        setAgentMessage('✨ Agent Loop 帮写完成：已忠实规范誊写您的解题思路（未作多余代算）');
        showToast('AI 已规范整理您的思路至草稿板书！', 'success');
      }
    } catch (err) {
      showToast(`Agent Loop 异常: ${err.message}`, 'warn');
    } finally {
      setIsAgentRunning(false);
      setAgentLoopStage('');
    }
  };

  // 一键将草稿文本誊抄到试题答题区
  const handleScribeToAnswerCard = () => {
    if (!boardText.trim()) {
      showToast('草稿板书为空，无内容可誊抄', 'warn');
      return;
    }
    if (onScribeToAnswer) {
      const mergedAnswer = currentAnswerDraft
        ? `${currentAnswerDraft}\n\n${boardText}`
        : boardText;
      onScribeToAnswer(mergedAnswer);
      showToast('✨ 已将草稿板书成功誊录入当前试题作答区！', 'success');
    }
  };

  return (
    <div className="relative flex flex-col h-full w-full select-none overflow-hidden bg-surface-container-lowest rounded-2xl">
      {/* 统一 Toast 顶部提示条 */}
      {toast.show && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-60 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium shadow-lg flex items-center gap-1.5 backdrop-blur-md border ${
              toast.type === 'success'
                ? 'bg-primary text-on-primary border-primary/20'
                : toast.type === 'warn'
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-on-surface text-surface border-outline-variant/30'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">
              {toast.type === 'success' ? 'check_circle' : toast.type === 'warn' ? 'warning' : 'info'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* 统一自定义 Confirm 确认弹窗（约束在草稿工作台内部，居中显示且绝不被遮挡） */}
      {confirmDialog.isOpen && (
        <div className="absolute inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-outline-variant/40 space-y-3 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-error">
              <span className="material-symbols-outlined text-[24px]">warning_amber</span>
              <h4 className="font-semibold text-on-surface text-[16px]">{confirmDialog.title}</h4>
            </div>
            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[12px] font-medium transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                }}
                className={`px-3.5 py-1.5 rounded-lg text-white text-[12px] font-semibold transition cursor-pointer shadow-xs ${
                  confirmDialog.confirmType === 'danger'
                    ? 'bg-error hover:bg-error/90'
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 顶部主工作台控制工具栏 */}
      <div className="flex items-center justify-between gap-1.5 px-3 py-2 border-b border-surface-container shrink-0 flex-wrap text-[12px] bg-surface-container-low/40">
        {/* 左区：画板与考场学术诚信防线标志 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-primary font-bold">
            <span className="material-symbols-outlined text-[19px]">draw</span>
            <span className="text-[13px]">草稿演算工作台</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container/30 border border-secondary/20 text-secondary text-[11px] font-medium">
            <span className="material-symbols-outlined text-[13px]">shield</span>
            <span>铁律：AI 帮写不帮算，只能局限于您说出的内容</span>
          </div>
        </div>

        {/* 中区：手绘画笔/橡皮/粗细/颜色/背景底纹 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 画笔 / 橡皮 */}
          <div className="flex items-center bg-surface-container-lowest p-0.5 rounded-lg border border-outline-variant/30">
            <button
              type="button"
              onClick={() => setTool('brush')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                tool === 'brush' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="手绘笔（画图、画坐标轴、推导式子）"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
              <span className="text-[11px]">笔</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                tool === 'eraser' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="橡皮擦（擦除前景笔画）"
            >
              <span className="material-symbols-outlined text-[14px]">ink_eraser</span>
              <span className="text-[11px]">擦</span>
            </button>
          </div>

          {/* 粗细 */}
          <div className="flex items-center gap-1 bg-surface-container-lowest p-0.5 rounded-lg border border-outline-variant/30">
            {[
              { size: 2, label: '细', dot: 'w-1 h-1' },
              { size: 4, label: '中', dot: 'w-2 h-2' },
              { size: 7, label: '粗', dot: 'w-3 h-3' }
            ].map((item) => (
              <button
                key={item.size}
                type="button"
                onClick={() => setBrushSize(item.size)}
                className={`p-1 rounded flex items-center justify-center transition cursor-pointer ${
                  brushSize === item.size ? 'bg-surface-container-high ring-1 ring-primary' : 'hover:bg-surface-container'
                }`}
                title={`粗细: ${item.label}`}
              >
                <div
                  className={`rounded-full ${item.dot}`}
                  style={{ backgroundColor: tool === 'eraser' ? '#64748b' : brushColor }}
                />
              </button>
            ))}
          </div>

          {/* 调色盘 */}
          {tool === 'brush' && (
            <div className="flex items-center gap-1 bg-surface-container-lowest px-1.5 py-0.5 rounded-lg border border-outline-variant/30">
              {[
                { color: '#0f172a', name: '墨黑' },
                { color: '#1d4ed8', name: '考场蓝' },
                { color: '#b91c1c', name: '红' },
                { color: '#047857', name: '绿' }
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => setBrushColor(c.color)}
                  className={`w-3.5 h-3.5 rounded-full transition cursor-pointer ${
                    brushColor === c.color ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
            </div>
          )}

          {/* 稿纸底纹 */}
          <div className="flex items-center bg-surface-container-lowest p-0.5 rounded-lg border border-outline-variant/30">
            {[
              { id: 'grid', label: '方格' },
              { id: 'lined', label: '横线' },
              { id: 'blank', label: '白纸' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaperPattern(p.id)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  paperPattern === p.id ? 'bg-surface-container-high text-primary font-semibold' : 'text-on-surface-variant'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 撤销 / 重做 / 导出 / 清空手绘 */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyStep <= 0}
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer disabled:opacity-30"
              title="撤销上一步笔迹"
            >
              <span className="material-symbols-outlined text-[16px]">undo</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyStep >= history.length - 1}
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer disabled:opacity-30"
              title="重做下一步笔迹"
            >
              <span className="material-symbols-outlined text-[16px]">redo</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition cursor-pointer"
              title="导出手绘草稿为图片"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
            </button>
            <button
              type="button"
              onClick={handleClearCanvasClick}
              className="p-1 rounded text-outline hover:text-error hover:bg-surface-container transition cursor-pointer"
              title="清空当前手绘笔迹"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            </button>
          </div>
        </div>

        {/* 右区：侧栏收放、全屏与关闭控制 */}
        <div className="flex items-center gap-1">
          {/* 折叠/展开板书栏按钮 */}
          <button
            type="button"
            onClick={() => setIsNotesCollapsed(!isNotesCollapsed)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1 cursor-pointer border ${
              !isNotesCollapsed
                ? 'bg-primary-fixed text-on-primary-fixed border-primary-fixed-dim'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant/30'
            }`}
            title={isNotesCollapsed ? '展开右侧公式与 Agent 帮写板书' : '收起右侧板书栏以扩充手绘区域'}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isNotesCollapsed ? 'splitscreen_left' : 'splitscreen'}
            </span>
            <span>{isNotesCollapsed ? '展开公式板书' : '收起板书'}</span>
          </button>

          {/* 全屏放大 */}
          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer"
              title={isMaximized ? '还原为便签窗口' : '放大为全屏大工作台'}
            >
              <span className="material-symbols-outlined text-[17px]">
                {isMaximized ? 'close_fullscreen' : 'open_in_full'}
              </span>
            </button>
          )}

          {/* 关闭 */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition cursor-pointer"
              title="收起草稿纸"
            >
              <span className="material-symbols-outlined text-[17px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* 主体工作区：手绘画布 与 公式笔记板书 一体同屏并存 */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row w-full h-full p-2 gap-2">
        {/* 左侧：手绘涂鸦主画板 */}
        <div
          ref={containerRef}
          className={`relative h-full rounded-xl border border-outline-variant/40 overflow-hidden cursor-crosshair touch-none shadow-inner transition-all duration-200 ${
            isNotesCollapsed ? 'w-full' : 'flex-1 min-w-[320px]'
          }`}
          style={{
            backgroundColor: '#fafaf9',
            backgroundImage:
              paperPattern === 'grid'
                ? 'linear-gradient(to right, rgba(148, 163, 184, 0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.22) 1px, transparent 1px)'
                : paperPattern === 'lined'
                ? 'linear-gradient(to bottom, transparent calc(28px - 1px), rgba(148, 163, 184, 0.28) calc(28px - 1px))'
                : 'none',
            backgroundSize: paperPattern === 'grid' ? '24px 24px' : paperPattern === 'lined' ? '100% 28px' : 'auto'
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="absolute inset-0 block w-full h-full touch-none"
          />

          {/* 水印引导 */}
          {history.length <= 1 && (
            <div className="absolute bottom-3 left-3 pointer-events-none text-[11px] text-outline/60 flex items-center gap-1 font-mono">
              <span className="material-symbols-outlined text-[14px]">gesture</span>
              <span>手绘草稿区：支持鼠标或触控笔任意演算、画几何图与对齐竖式</span>
            </div>
          )}
        </div>

        {/* 右侧：一体化公式板书与 Agent Loop 帮写面板 */}
        {!isNotesCollapsed && (
          <div className="w-full lg:w-[420px] xl:w-[480px] h-full flex flex-col gap-2 shrink-0 animate-in fade-in duration-150">
            {/* 模块 1：Agent Loop 口述帮写工作区 */}
            <div className="bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/30 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between text-[12px] font-medium text-on-surface">
                <div className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[15px]">record_voice_over</span>
                  <span>Agent Loop 帮写草稿</span>
                </div>
                <span className="text-[10px] text-outline">
                  只能帮写您说出的步骤 · 严禁帮算
                </span>
              </div>

              {/* 口述输入框 */}
              <div className="relative">
                <textarea
                  value={spokenInput}
                  onChange={(e) => setSpokenInput(e.target.value)}
                  placeholder="在此输入或口述您的解题步骤（例如：
“由分部积分法，设 u=ln(x), dv=x dx，则 du=1/x dx...”
AI 将启动 Agent Loop 将其誊写为规范板书，严禁替您算后续）"
                  disabled={isAgentRunning}
                  rows={2}
                  className="w-full p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/40 text-[12px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                />
              </div>

              {/* Agent 触发按钮与状态 */}
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <div className="flex items-center gap-1 text-[11px]">
                  {isAgentRunning ? (
                    <span className="text-primary font-mono animate-pulse flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
                      <span>{agentLoopStage}</span>
                    </span>
                  ) : agentMessage ? (
                    <span className="text-secondary text-[11px] truncate max-w-[220px]" title={agentMessage}>
                      {agentMessage}
                    </span>
                  ) : (
                    <span className="text-outline text-[11px]">准备就绪，支持分步循环帮写</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleTriggerAgentLoop}
                  disabled={isAgentRunning || !spokenInput.trim()}
                  className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 shadow-xs"
                >
                  <span className={`material-symbols-outlined text-[13px] ${isAgentRunning ? 'animate-spin' : ''}`}>
                    {isAgentRunning ? 'progress_activity' : 'smart_toy'}
                  </span>
                  <span>{isAgentRunning ? 'Agent 执行中...' : '⚡ 启动 Agent Loop 帮写'}</span>
                </button>
              </div>
            </div>

            {/* 模块 2：整理后的规范板书 (支持实时 KaTeX 呈现与编辑) */}
            <div className="flex-1 min-h-0 bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/30 flex flex-col gap-1.5 overflow-hidden">
              <div className="flex items-center justify-between pb-1 border-b border-surface-container shrink-0 text-[12px]">
                <div className="flex items-center gap-1.5 text-on-surface font-medium">
                  <span className="material-symbols-outlined text-[15px] text-secondary">menu_book</span>
                  <span>规范板书与 KaTeX 预览</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleClearNotesClick}
                    className="text-outline hover:text-error text-[11px] px-1.5 py-0.5 rounded hover:bg-surface-container transition cursor-pointer"
                    title="清空板书"
                  >
                    清空板书
                  </button>
                </div>
              </div>

              {/* 板书内容展示与编辑 */}
              <div className="flex-1 min-h-0 grid grid-cols-1 gap-2 overflow-hidden">
                {/* 源码小框 */}
                <textarea
                  value={boardText}
                  onChange={(e) => setBoardText(e.target.value)}
                  placeholder="AI 规范帮写整理出的板书将呈现于此，您也可以随时手动增删..."
                  className="h-24 w-full p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-[12px] font-mono text-on-surface focus:outline-none resize-none leading-relaxed shrink-0"
                />

                {/* KaTeX 渲染大预览区 */}
                <div className="flex-1 overflow-y-auto p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-[13px] leading-relaxed text-on-surface">
                  {boardText.trim() ? (
                    <MathMarkdown content={boardText} />
                  ) : (
                    <div className="text-outline text-center py-6 text-[12px]">
                      在上方输入思路并启动 Agent Loop，此处将实时呈现规范的 LaTeX 向量级板书
                    </div>
                  )}
                </div>
              </div>

              {/* 底部操作：一键誊抄进大题答题卡 */}
              <div className="pt-1.5 border-t border-surface-container flex items-center justify-between shrink-0">
                <span className="text-[11px] text-outline font-mono">
                  {boardText.length} 字符
                </span>

                <button
                  type="button"
                  onClick={handleScribeToAnswerCard}
                  disabled={!boardText.trim()}
                  className="px-3 py-1 rounded-lg bg-primary-fixed hover:bg-primary-fixed-dim text-on-primary-fixed text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  title="将右侧规范板书追加插入到当前试题的主观题答题区"
                >
                  <span className="material-symbols-outlined text-[13px] text-primary">content_paste_go</span>
                  <span>📋 誊入本题答题卡</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
