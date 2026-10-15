import React, { useState } from 'react';

export default function SettingsView() {
  const [model, setModel] = useState('gemini-3.8-flash');
  const [autoSaveSec, setAutoSaveSec] = useState(30);
  const [enableWatermark, setEnableWatermark] = useState(true);
  const [ocrEngine, setOcrEngine] = useState('hybrid-vision');

  return (
    <div className="flex flex-col w-full pb-16">
      <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-margin-desktop py-space-xl flex flex-col gap-space-xl">
        <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-xs">
          <h1 className="font-headline-xl text-headline-xl text-on-surface font-semibold">系统设置 (Settings)</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            配置 ExamCraft AI 模型调度核心、多模态 OCR 排版解析参数与考场防作弊策略。
          </p>
        </section>

        {/* Model Engine Configuration */}
        <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-md">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-container">
            <span className="material-symbols-outlined text-primary text-[22px]">psychology</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">AI 模型核心与推理调度</h2>
          </div>

          <div className="space-y-4 text-body-md">
            <div>
              <label className="block text-label-md font-semibold text-on-surface mb-1">主推理与判题模型</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full max-w-md px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono"
              >
                <option value="gemini-3.8-flash">Google Gemini 3.8 Flash (推荐 · 极速毫秒级响应)</option>
                <option value="gemini-3.8-pro">Google Gemini 3.8 Pro (高阶复杂数学定理证明)</option>
                <option value="deepseek-r1">DeepSeek R1 (深度链式推理与反思验证)</option>
                <option value="local-vllm">本地离线私有化部署 (Local vLLM / Ollama)</option>
              </select>
            </div>

            <div>
              <label className="block text-label-md font-semibold text-on-surface mb-1">试卷视觉 OCR 解析引擎</label>
              <select
                value={ocrEngine}
                onChange={(e) => setOcrEngine(e.target.value)}
                className="w-full max-w-md px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono"
              >
                <option value="hybrid-vision">自适应多模态视觉 + LaTeX 向量公式抽取 (99.8% 精度)</option>
                <option value="fast-ocr">快速轻量 OCR (仅保留纯文本与简单表格)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Exam Room Behavior */}
        <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-md">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-container">
            <span className="material-symbols-outlined text-secondary text-[22px]">security</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">考场专注模式策略</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-on-surface text-label-md">草稿纸即时自动同步</p>
                <p className="text-body-sm text-on-surface-variant">答题过程中自拟草稿或公式的本地与云端暂存间隔</p>
              </div>
              <div className="flex items-center gap-2 font-mono text-label-md">
                <span>每 {autoSaveSec} 秒</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-surface-container">
              <div>
                <p className="font-semibold text-on-surface text-label-md">防作弊动态盲水印与全屏监听</p>
                <p className="text-body-sm text-on-surface-variant">考试进行时启用考生身份代码半透明背景防摄录保护</p>
              </div>
              <input
                type="checkbox"
                checked={enableWatermark}
                onChange={(e) => setEnableWatermark(e.target.checked)}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* Data Management & Export */}
        <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-md">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-container">
            <span className="material-symbols-outlined text-outline text-[22px]">database</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">本地数据与备份导出</h2>
          </div>

          <div className="flex items-center gap-space-md flex-wrap">
            <button
              type="button"
              onClick={() => alert('已将全部试卷、题目、错题本数据打包下载为 examcraft_backup.json')}
              className="px-4 py-2 bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md rounded-lg border border-outline-variant/30 transition cursor-pointer"
            >
              导出全量题库数据 (JSON)
            </button>
            <button
              type="button"
              onClick={() => alert('已清空本地测试缓存。')}
              className="px-4 py-2 bg-surface-container-low hover:bg-surface-container text-tertiary font-label-md rounded-lg border border-outline-variant/30 transition cursor-pointer"
            >
              清理本地临时缓存
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
