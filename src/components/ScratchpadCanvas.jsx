import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * ScratchpadCanvas - 考场手绘涂鸦草稿画板
 * 支持鼠标、触控板、触控笔（Stylus）平滑书写，支持撤销/重做、多色笔刷、橡皮擦、方格网格/横线底纹切换与持久化存储
 */
export default function ScratchpadCanvas({ storageKey = 'examcraft_scratchpad_canvas' }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  
  // 画笔设置
  const [tool, setTool] = useState('brush'); // 'brush' | 'eraser'
  const [brushColor, setBrushColor] = useState('#0f172a'); // 墨黑
  const [brushSize, setBrushSize] = useState(3); // 2 | 4 | 8
  const [paperPattern, setPaperPattern] = useState('grid'); // 'grid' | 'lined' | 'blank'
  
  // 绘制状态与历史记录（用于撤销/重做）
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // 初始化与尺寸自适应（保持 Retina 屏高清晰度）
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    
    // 如果已经有画好的内容，先临时保存
    let tempImgData = null;
    const ctx = canvas.getContext('2d');
    if (canvas.width > 0 && canvas.height > 0) {
      tempImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    // 设置高分辨率物理像素与 CSS 显示像素
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 尝试从 localStorage 恢复已有手绘笔迹，或恢复临时图像
    if (tempImgData) {
      // 放大重置尺寸后恢复
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
      // 防抖自适应
      resizeCanvas();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [resizeCanvas]);

  // 保存当前画布快照到历史栈
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyStep + 1);
      newHistory.push(dataUrl);
      if (newHistory.length > 20) newHistory.shift(); // 最多保存 20 步
      return newHistory;
    });
    setHistoryStep((prev) => Math.min(prev + 1, 19));

    try {
      localStorage.setItem(storageKey, dataUrl);
    } catch (e) {
      console.warn('Canvas save to localStorage error:', e);
    }
  }, [historyStep, storageKey]);

  // 恢复历史快照
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

  // 一键清屏
  const handleClear = () => {
    if (window.confirm('确认清空当前手绘草稿画布吗？')) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      saveToHistory();
    }
  };

  // 导出图片下载
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // 合并背景底纹与手绘前景，生成美观真实的草稿纸图片
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');
    
    // 填充纸张底色
    expCtx.fillStyle = '#f8fafc';
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    
    // 绘制笔迹
    expCtx.drawImage(canvas, 0, 0);
    
    const link = document.createElement('a');
    link.download = `考场草稿手绘_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
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

  // 手绘移动（二次贝塞尔曲线平滑处理）
  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return;
    const currentPoint = getPointerPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    
    // 中点二次平滑插值
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
      // Ignore if not captured
    }
    saveToHistory();
  };

  return (
    <div className="flex flex-col h-full w-full select-none">
      {/* 画板专属顶部快捷工具条 */}
      <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-surface-container shrink-0 flex-wrap text-[12px]">
        {/* 工具：画笔 / 橡皮擦 */}
        <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded-lg border border-outline-variant/30">
          <button
            type="button"
            onClick={() => setTool('brush')}
            className={`flex items-center gap-1 px-2 py-1 rounded font-medium transition cursor-pointer ${
              tool === 'brush'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="画笔工具（用于随手书写、画坐标图、推导公式）"
          >
            <span className="material-symbols-outlined text-[15px]">edit</span>
            <span>画笔</span>
          </button>
          <button
            type="button"
            onClick={() => setTool('eraser')}
            className={`flex items-center gap-1 px-2 py-1 rounded font-medium transition cursor-pointer ${
              tool === 'eraser'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="橡皮擦工具（擦除手绘线条）"
          >
            <span className="material-symbols-outlined text-[15px]">ink_eraser</span>
            <span>橡皮</span>
          </button>
        </div>

        {/* 笔刷粗细 */}
        <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/30">
          {[
            { size: 2, label: '细', dot: 'w-1.5 h-1.5' },
            { size: 4, label: '中', dot: 'w-2.5 h-2.5' },
            { size: 7, label: '粗', dot: 'w-3.5 h-3.5' }
          ].map((item) => (
            <button
              key={item.size}
              type="button"
              onClick={() => setBrushSize(item.size)}
              className={`p-1 rounded flex items-center justify-center transition cursor-pointer ${
                brushSize === item.size
                  ? 'bg-surface-container-high ring-1 ring-primary'
                  : 'hover:bg-surface-container'
              }`}
              title={`笔触粗细: ${item.label}`}
            >
              <div
                className={`rounded-full ${item.dot}`}
                style={{ backgroundColor: tool === 'eraser' ? '#64748b' : brushColor }}
              />
            </button>
          ))}
        </div>

        {/* 笔触颜色盘（画笔状态下可用） */}
        {tool === 'brush' && (
          <div className="flex items-center gap-1.5 bg-surface-container-low px-1.5 py-1 rounded-lg border border-outline-variant/30">
            {[
              { color: '#0f172a', name: '墨黑' },
              { color: '#1d4ed8', name: '考场蓝' },
              { color: '#b91c1c', name: '批注红' },
              { color: '#047857', name: '推演绿' }
            ].map((c) => (
              <button
                key={c.color}
                type="button"
                onClick={() => setBrushColor(c.color)}
                className={`w-4 h-4 rounded-full transition cursor-pointer ${
                  brushColor === c.color ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c.color }}
                title={`颜色：${c.name}`}
              />
            ))}
          </div>
        )}

        {/* 稿纸背景底纹 */}
        <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded-lg border border-outline-variant/30">
          <button
            type="button"
            onClick={() => setPaperPattern('grid')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              paperPattern === 'grid'
                ? 'bg-surface-container-high text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="方格坐标纸（适于几何作图、函数图像推演、列竖式）"
          >
            方格
          </button>
          <button
            type="button"
            onClick={() => setPaperPattern('lined')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              paperPattern === 'lined'
                ? 'bg-surface-container-high text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="信纸横线（经典草稿纸排版）"
          >
            横线
          </button>
          <button
            type="button"
            onClick={() => setPaperPattern('blank')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              paperPattern === 'blank'
                ? 'bg-surface-container-high text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="纯白无痕白纸"
          >
            空白
          </button>
        </div>

        {/* 撤销 / 重做 / 清空 / 下载 */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyStep <= 0}
            className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer disabled:opacity-30"
            title="撤销上一步笔迹 (Ctrl+Z)"
          >
            <span className="material-symbols-outlined text-[17px]">undo</span>
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
            className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer disabled:opacity-30"
            title="重做下一步笔迹"
          >
            <span className="material-symbols-outlined text-[17px]">redo</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition cursor-pointer"
            title="导出保存手绘草稿为图片"
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded text-outline hover:text-error hover:bg-surface-container transition cursor-pointer ml-1"
            title="一键擦除整张草稿纸"
          >
            <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
          </button>
        </div>
      </div>

      {/* 画布主工作区 (带有逼真的考场网格/横线纸纹理) */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full min-h-[300px] rounded-xl border border-outline-variant/40 overflow-hidden cursor-crosshair touch-none shadow-inner"
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

        {/* 提示水印（当用户尚未书写时引导） */}
        {history.length <= 1 && (
          <div className="absolute bottom-3 right-3 pointer-events-none text-[11px] text-outline/60 flex items-center gap-1 font-mono">
            <span className="material-symbols-outlined text-[14px]">gesture</span>
            <span>可使用鼠标、触摸板或触控手写笔随意演算与画图</span>
          </div>
        )}
      </div>
    </div>
  );
}
