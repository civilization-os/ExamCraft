import React, { useRef, useEffect, useState, useCallback } from 'react';
import MathMarkdown from './MathMarkdown';

/**
 * ScratchpadCanvas / Workbench
 * 一体化考场草稿演算工作台：
 * 1. 自由手绘涂鸦画板（Canvas、方格坐标纸、信纸横线、白纸、多色笔刷、橡皮、撤销重做、导出）
 * 2. 智能 AI 画图与手写引擎：AI 可直接在 Canvas 上代画直角坐标系、函数曲线、几何三角形/圆、辅助线，手写推导文字
 * 3. 文本公式笔记与 KaTeX 实时高保真渲染（同屏呈现，无需模式切换）
 * 4. 考场专属 Agent Loop（严格限制：只能画/写考生说出的内容，严禁代算）
 * 5. 统一 UI 确认对话框与 Toast 提示，彻底根除浏览器丑陋的原生 alert/confirm
 */
export default function ScratchpadCanvas({
  storageKey = 'examcraft_scratchpad_canvas',
  textStorageKey = 'examcraft_scratchpad_text',
  contextProblem = '',
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
  const [agentLoopStage, setAgentLoopStage] = useState('');
  const [agentMessage, setAgentMessage] = useState('');

  // ==================== 统一 UI 弹窗与 Toast 状态 ====================
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '确认',
    confirmType: 'danger',
    onConfirm: () => {}
  });

  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'info'
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

  // 保存手绘画布快照到撤销栈
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
      console.warn('Canvas save error:', e);
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

  // 清空手绘（统一内嵌 UI）
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

  // 清空板书（统一内嵌 UI）
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

  // 导出图片
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

  // 手绘坐标计算
  const getPointerPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // 手绘事件
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

  // ==================== 智能 Canvas 绘图与写字执行引擎 ====================
  // AI 真正可以在 Canvas 画板上帮画直角坐标系、函数曲线、几何三角形/圆，以及手写板书文字！
  const executeCanvasActions = useCallback((actions) => {
    const canvas = canvasRef.current;
    if (!canvas || !actions || actions.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    let textCursorY = 55;

    actions.forEach((act) => {
      if (act.type === 'write' && act.content) {
        // 1. 在 Canvas 上手写工整板书
        ctx.fillStyle = act.color || '#0f172a';
        ctx.font = '600 16px "KaTeX_Main", "STKaiti", "KaiTi", "Microsoft YaHei", sans-serif';
        ctx.textBaseline = 'middle';

        const lines = act.content.split('\n');
        lines.forEach((line) => {
          if (!line.trim()) {
            textCursorY += 16;
            return;
          }
          const maxWidth = width - 80;
          let currentLine = '';
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) {
              ctx.fillText(currentLine, 36, textCursorY);
              currentLine = char;
              textCursorY += 26;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) {
            ctx.fillText(currentLine, 36, textCursorY);
            textCursorY += 28;
          }
        });
        textCursorY += 15;

      } else if (act.type === 'axes') {
        // 2. 在 Canvas 上绘制直角坐标系
        const cx = Math.min(width * 0.45, 240);
        const cy = Math.min(height * 0.55, 270);
        const axisLen = 120;

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';

        // X 轴
        ctx.beginPath();
        ctx.moveTo(cx - axisLen, cy);
        ctx.lineTo(cx + axisLen, cy);
        ctx.lineTo(cx + axisLen - 8, cy - 5);
        ctx.moveTo(cx + axisLen, cy);
        ctx.lineTo(cx + axisLen - 8, cy + 5);
        ctx.stroke();

        // Y 轴
        ctx.beginPath();
        ctx.moveTo(cx, cy + axisLen);
        ctx.lineTo(cx, cy - axisLen);
        ctx.lineTo(cx - 5, cy - axisLen + 8);
        ctx.moveTo(cx, cy - axisLen);
        ctx.lineTo(cx + 5, cy - axisLen + 8);
        ctx.stroke();

        // 标签 O, x, y
        ctx.fillStyle = '#334155';
        ctx.font = 'italic bold 15px "KaTeX_Math", serif';
        ctx.fillText(act.xLabel || 'x', cx + axisLen + 6, cy + 4);
        ctx.fillText(act.yLabel || 'y', cx - 6, cy - axisLen - 8);
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('O', cx - 14, cy + 14);

      } else if (act.type === 'plot') {
        // 3. 在 Canvas 上绘制函数图像曲线
        const cx = Math.min(width * 0.45, 240);
        const cy = Math.min(height * 0.55, 270);
        const scaleX = 26;
        const scaleY = 26;

        ctx.strokeStyle = act.color || '#1d4ed8';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';

        ctx.beginPath();
        let isFirst = true;

        const evalFn = (x) => {
          const expr = (act.expr || 'x^2').toLowerCase();
          if (expr.includes('sin')) return Math.sin(x);
          if (expr.includes('cos')) return Math.cos(x);
          if (expr.includes('ln') || expr.includes('log')) return x > 0.05 ? Math.log(x) : NaN;
          if (expr.includes('exp') || expr.includes('e^x')) return Math.exp(x);
          if (expr.includes('sqrt')) return x >= 0 ? Math.sqrt(x) : NaN;
          if (expr.includes('1/x')) return Math.abs(x) > 0.05 ? 1 / x : NaN;
          if (expr.includes('x^3')) return Math.pow(x, 3);
          return Math.pow(x, 2);
        };

        for (let x = -3.5; x <= 3.5; x += 0.08) {
          const y = evalFn(x);
          if (!isNaN(y) && isFinite(y)) {
            const canvasX = cx + x * scaleX;
            const canvasY = cy - y * scaleY;
            if (canvasY >= cy - 130 && canvasY <= cy + 130 && canvasX >= cx - 130 && canvasX <= cx + 130) {
              if (isFirst) {
                ctx.moveTo(canvasX, canvasY);
                isFirst = false;
              } else {
                ctx.lineTo(canvasX, canvasY);
              }
            } else {
              isFirst = true;
            }
          } else {
            isFirst = true;
          }
        }
        ctx.stroke();

        if (act.label) {
          ctx.fillStyle = act.color || '#1d4ed8';
          ctx.font = 'bold 14px "KaTeX_Math", serif';
          ctx.fillText(act.label, cx + 50, cy - 70);
        }

      } else if (act.type === 'shape') {
        // 4. 绘制几何图形
        ctx.strokeStyle = act.color || '#047857';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const originX = Math.min(width * 0.45, 240) - 60;
        const originY = Math.min(height * 0.55, 270) - 40;

        if (act.shapeType === 'right_triangle') {
          ctx.beginPath();
          ctx.moveTo(originX, originY + 100);
          ctx.lineTo(originX + 130, originY + 100);
          ctx.lineTo(originX, originY);
          ctx.closePath();
          ctx.stroke();

          // 直角标
          ctx.beginPath();
          ctx.moveTo(originX, originY + 86);
          ctx.lineTo(originX + 14, originY + 86);
          ctx.lineTo(originX + 14, originY + 100);
          ctx.stroke();

          ctx.fillStyle = act.color || '#047857';
          ctx.font = 'bold 14px serif';
          ctx.fillText(act.labels?.[0] || 'A', originX - 16, originY);
          ctx.fillText(act.labels?.[1] || 'C', originX - 16, originY + 115);
          ctx.fillText(act.labels?.[2] || 'B', originX + 135, originY + 115);

        } else if (act.shapeType === 'circle') {
          const cx = originX + 60;
          const cy = originY + 50;
          const r = 50;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + r, cy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = act.color || '#047857';
          ctx.font = 'bold 13px serif';
          ctx.fillText('O', cx - 12, cy - 4);
          ctx.fillText('r', cx + 22, cy - 6);
        } else {
          // 一般三角形
          ctx.beginPath();
          ctx.moveTo(originX + 60, originY);
          ctx.lineTo(originX + 130, originY + 90);
          ctx.lineTo(originX, originY + 90);
          ctx.closePath();
          ctx.stroke();

          ctx.fillStyle = act.color || '#047857';
          ctx.font = 'bold 14px serif';
          ctx.fillText(act.labels?.[0] || 'A', originX + 55, originY - 8);
          ctx.fillText(act.labels?.[1] || 'B', originX - 14, originY + 105);
          ctx.fillText(act.labels?.[2] || 'C', originX + 135, originY + 105);
        }

      } else if (act.type === 'line') {
        // 5. 辅助线 / 切线
        ctx.strokeStyle = act.color || '#b91c1c';
        ctx.lineWidth = 1.8;
        if (act.lineType === 'dashed') ctx.setLineDash([5, 5]);
        const lx1 = 120;
        const ly1 = 180;
        const lx2 = 280;
        const ly2 = 120;
        ctx.beginPath();
        ctx.moveTo(lx1, ly1);
        ctx.lineTo(lx2, ly2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (act.label) {
          ctx.fillStyle = act.color || '#b91c1c';
          ctx.font = '12px sans-serif';
          ctx.fillText(act.label, (lx1 + lx2) / 2 + 5, (ly1 + ly2) / 2 - 8);
        }
      }
    });

    ctx.restore();
    saveToHistory();
  }, [saveToHistory]);

  // ==================== 核心 Agent Loop 执行逻辑 ====================
  const handleTriggerAgentLoop = async (customPrompt = '') => {
    const textToRun = (customPrompt || spokenInput).trim();
    if (!textToRun) {
      showToast('请先输入或点击快捷指令选择要画的图或写的字', 'warn');
      return;
    }

    setIsAgentRunning(true);
    setAgentLoopStage('Loop 1 · 诚信纪律审计中...');
    setAgentMessage('');

    try {
      await new Promise((r) => setTimeout(r, 200));
      setAgentLoopStage('Loop 2 · 编译 Canvas 绘图与手写指令...');

      const res = await fetch('/api/model/scratchpad-agent-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spokenText: textToRun,
          contextProblem: contextProblem,
          currentBoardContent: boardText
        })
      });

      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Agent Loop 执行失败', 'warn');
        return;
      }

      setAgentLoopStage('Loop 3 · 正在画板上执行画图与书写...');
      const agentData = data.agentData;

      if (!agentData.audit.passed) {
        setAgentMessage(`⚠️ ${agentData.audit.reason}：只能帮画/帮写您说出的内容，严禁代算代答！`);
        showToast('检测到计算诱导，已触碰考场防作弊纪律红线', 'warn');
      } else {
        // 1. 在 Canvas 画板上真正绘制图形和书写文字！
        if (agentData.canvasActions && agentData.canvasActions.length > 0) {
          executeCanvasActions(agentData.canvasActions);
        }

        // 2. 同步追加到右侧规范板书笔记
        const newBoardText = boardText
          ? `${boardText}\n\n${agentData.scribeResult}`
          : agentData.scribeResult;
        setBoardText(newBoardText);

        setSpokenInput('');
        setAgentMessage('✨ AI 已在画板上完成画图与手写板书（未作多余代算）');
        showToast('AI 已在草稿板上为您完成画图与写字！', 'success');
      }
    } catch (err) {
      showToast(`Agent Loop 异常: ${err.message}`, 'warn');
    } finally {
      setIsAgentRunning(false);
      setAgentLoopStage('');
    }
  };

  return (
    <div className="relative flex flex-col h-full w-full select-none overflow-hidden bg-surface-container-lowest rounded-2xl">
      {/* 统一 Toast 顶部提示条 */}
      {toast.show && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-60 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none">
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
            <span>铁律：AI 帮画帮写不帮算，只能局限于您说出的内容</span>
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
            <span>{isNotesCollapsed ? '展开板书栏' : '收起板书'}</span>
          </button>

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

      {/* 主体工作区：手绘画布 与 公式板书 一体同屏并存 */}
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

          {history.length <= 1 && (
            <div className="absolute bottom-3 left-3 pointer-events-none text-[11px] text-outline/60 flex items-center gap-1 font-mono">
              <span className="material-symbols-outlined text-[14px]">gesture</span>
              <span>手绘画板：支持鼠标/触控笔自由涂鸦，右侧可让 AI 帮画坐标系、函数图与手写板书</span>
            </div>
          )}
        </div>

        {/* 右侧：一体化公式板书与 Agent Loop 帮画/帮写协作区 */}
        {!isNotesCollapsed && (
          <div className="w-full lg:w-[420px] xl:w-[460px] h-full flex flex-col gap-2 shrink-0 animate-in fade-in duration-150">
            {/* 模块 1：Agent Loop 口述帮画 & 帮写工作区 */}
            <div className="bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/30 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between text-[12px] font-medium text-on-surface">
                <div className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                  <span>AI 帮画图 & 帮写板书 (Agent Loop)</span>
                </div>
                <span className="text-[10px] text-outline">
                  只能帮画/写您说的 · 严禁帮算
                </span>
              </div>

              {/* 快捷画图 & 常用板书指令胶囊 */}
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { label: '📈 直角坐标系', prompt: '帮我画一个标准的直角坐标系' },
                  { label: '抛物线 y=x²', prompt: '画一个直角坐标系并绘制二次函数 y=x^2 抛物线' },
                  { label: '正弦 y=sin(x)', prompt: '画一个直角坐标系并绘制正弦波 y=sin(x)' },
                  { label: '📐 直角三角形', prompt: '画一个直角三角形 ABC，角 C 为直角' },
                  { label: '⭕ 画圆与半径', prompt: '画一个圆并标出圆心 O 和半径 r' }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setSpokenInput(item.prompt);
                      handleTriggerAgentLoop(item.prompt);
                    }}
                    disabled={isAgentRunning}
                    className="px-2 py-0.5 rounded-md bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-[10px] font-medium border border-outline-variant/30 transition cursor-pointer disabled:opacity-40"
                    title={`点击快捷执行：${item.prompt}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 口述/需求输入框 */}
              <div className="relative">
                <textarea
                  value={spokenInput}
                  onChange={(e) => setSpokenInput(e.target.value)}
                  placeholder="说出或输入您要画的图或写的字，例如：
“画一个坐标系并在上面画 y = x^2”
“帮我把设项：设 u = ln(x+1) 写入画板”
（AI 将严格按您所说在画板上作画/写字，绝不替您算答案）"
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
                    <span className="text-secondary text-[11px] truncate max-w-[210px]" title={agentMessage}>
                      {agentMessage}
                    </span>
                  ) : (
                    <span className="text-outline text-[11px]">随时下达画图或写字指令</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleTriggerAgentLoop()}
                  disabled={isAgentRunning || !spokenInput.trim()}
                  className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 shadow-xs"
                >
                  <span className={`material-symbols-outlined text-[13px] ${isAgentRunning ? 'animate-spin' : ''}`}>
                    {isAgentRunning ? 'progress_activity' : 'auto_fix_high'}
                  </span>
                  <span>{isAgentRunning ? '执行绘制中...' : '⚡ AI 帮画 / 帮写'}</span>
                </button>
              </div>
            </div>

            {/* 模块 2：规范板书与 KaTeX 预览 */}
            <div className="flex-1 min-h-0 bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/30 flex flex-col gap-1.5 overflow-hidden">
              <div className="flex items-center justify-between pb-1 border-b border-surface-container shrink-0 text-[12px]">
                <div className="flex items-center gap-1.5 text-on-surface font-medium">
                  <span className="material-symbols-outlined text-[15px] text-secondary">menu_book</span>
                  <span>板书备份与 KaTeX 公式</span>
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
                <textarea
                  value={boardText}
                  onChange={(e) => setBoardText(e.target.value)}
                  placeholder="AI 整理的公式板书文本同步备份于此，亦可在此自由记录..."
                  className="h-20 w-full p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-[12px] font-mono text-on-surface focus:outline-none resize-none leading-relaxed shrink-0"
                />

                <div className="flex-1 overflow-y-auto p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-[13px] leading-relaxed text-on-surface">
                  {boardText.trim() ? (
                    <MathMarkdown content={boardText} />
                  ) : (
                    <div className="text-outline text-center py-6 text-[12px]">
                      在上方输入指令让 AI 在左侧画图/写字，右侧将同步呈现高保真 KaTeX 公式
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-1 border-t border-surface-container flex items-center justify-between shrink-0 text-[11px] text-outline font-mono">
                <span>{boardText.length} 字符</span>
                <span>草稿演算专享 · 不计入卷面</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
