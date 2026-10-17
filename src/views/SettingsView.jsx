import React, { useState, useEffect } from 'react';
import SelectMenu from '../components/SelectMenu';

export default function SettingsView() {
  // Category: 'official' | 'protocol'
  const [category, setCategory] = useState('official');
  const [providerMode, setProviderMode] = useState('other-official');
  
  // Official fields
  const [vendor, setVendor] = useState('gemini'); // 'gemini' | 'openai' | 'anthropic'
  const [officialModel, setOfficialModel] = useState('gemini-2.5-flash');
  
  // Protocol fields
  const [protocol, setProtocol] = useState('openai-compatible');
  const [baseURL, setBaseURL] = useState('https://api.deepseek.com/v1');
  const [protocolModel, setProtocolModel] = useState('deepseek-chat');
  const [customInputPricePerMillion, setCustomInputPricePerMillion] = useState('');
  const [customOutputPricePerMillion, setCustomOutputPricePerMillion] = useState('');

  // Common fields
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxOutputTokens, setMaxOutputTokens] = useState(16384);
  const [timeoutSec, setTimeoutSec] = useState(30);
  const [structuredRetryLimit, setStructuredRetryLimit] = useState(3);
  const [modelUsage, setModelUsage] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);
  const refreshModelUsage = () => fetch('/api/model/usage')
    .then((res) => res.json())
    .then((data) => { if (data.success) setModelUsage(data); })
    .catch((err) => console.error('Failed to load model usage:', err));
  const refreshModelStatus = (force = false) => fetch(`/api/model/status${force ? '?refresh=1' : ''}`)
    .then((res) => res.json())
    .then((data) => { if (data.success) setModelStatus(data); })
    .catch((err) => console.error('Failed to load model status:', err));

  // Status & Test feedback
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string, latencyMs?: number, provider?: string }
  const [saveMessage, setSaveMessage] = useState('');
  const [defaultExamLayout, setDefaultExamLayout] = useState(() => {
    try { return localStorage.getItem('examcraft_exam_default_layout') || 'split'; }
    catch { return 'split'; }
  });
  const [showAnswersDefault, setShowAnswersDefault] = useState(() => {
    try { return localStorage.getItem('examcraft_exam_show_answers_default') !== 'false'; }
    catch { return true; }
  });
  const agentToneOptions = [
    { value: 'supportive', title: '温和鼓励', detail: '语气友善，适度肯定，避免催促', icon: 'favorite' },
    { value: 'concise', title: '简洁直接', detail: '少寒暄，清楚说明操作结果', icon: 'short_text' },
    { value: 'patient', title: '耐心清晰', detail: '分步骤说明，表达容易理解', icon: 'record_voice_over' },
    { value: 'professional', title: '严谨专业', detail: '措辞准确克制，反馈规范', icon: 'school' }
  ];
  const [scratchpadAgentTone, setScratchpadAgentTone] = useState(() => {
    try {
      const saved = localStorage.getItem('examcraft_scratchpad_agent_tone');
      return agentToneOptions.some((option) => option.value === saved) ? saved : 'supportive';
    } catch { return 'supportive'; }
  });

  const handleDefaultExamLayoutChange = (layout) => {
    setDefaultExamLayout(layout);
    try { localStorage.setItem('examcraft_exam_default_layout', layout); } catch {}
  };

  const handleShowAnswersDefaultChange = (show) => {
    setShowAnswersDefault(show);
    try { localStorage.setItem('examcraft_exam_show_answers_default', String(show)); } catch {}
  };

  const handleScratchpadAgentToneChange = (tone) => {
    setScratchpadAgentTone(tone);
    try { localStorage.setItem('examcraft_scratchpad_agent_tone', tone); } catch {}
  };

  // Local storage stats & clear
  const [localStats, setLocalStats] = useState(() => {
    let papersCount = 0;
    let subsCount = 0;
    let mistakesCount = 0;
    try {
      const p = localStorage.getItem('examcraft_papers');
      if (p) papersCount = (JSON.parse(p) || []).length;
    } catch {}
    try {
      const s = localStorage.getItem('examcraft_submissions');
      if (s) subsCount = (JSON.parse(s) || []).length;
    } catch {}
    try {
      const n = localStorage.getItem('examcraft_notebook_data');
      if (n) mistakesCount = (JSON.parse(n)?.items || []).length;
    } catch {}
    return { papersCount, subsCount, mistakesCount };
  });

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearAllData = () => {
    setShowClearConfirm(true);
  };

  const executeClearAllData = () => {
    try {
      localStorage.removeItem('examcraft_papers');
      localStorage.removeItem('examcraft_submissions');
      localStorage.removeItem('examcraft_notebook_data');
      localStorage.removeItem('examcraft_active_paper');
      localStorage.removeItem('examcraft_active_submission');
      localStorage.removeItem('examcraft_generator_session');
      localStorage.removeItem('examcraft_scratchpad_default');
      localStorage.removeItem('examcraft_exam_default_layout');
      localStorage.removeItem('examcraft_exam_show_answers_default');
      localStorage.removeItem('examcraft_scratchpad_agent_tone');
      localStorage.removeItem('examcraft_exam_split_ratio');
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('examcraft_scratchpad_')) localStorage.removeItem(k);
      });
    } catch {}
    setShowClearConfirm(false);
    window.location.reload();
  };

  // Fetch current config on mount
  useEffect(() => {
    fetch('/api/model/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          const c = data.config;
          setCategory(c.category || 'official');
          const detectedMode = c.providerMode || (c.category === 'protocol'
            ? (() => { try { return new URL(c.baseURL).hostname === 'api.deepseek.com' ? 'deepseek-official' : 'custom'; } catch { return 'custom'; } })()
            : 'other-official');
          setProviderMode(detectedMode);
          if (c.category === 'official') {
            setVendor(c.vendor || 'gemini');
            setOfficialModel(c.modelName || 'gemini-2.5-flash');
          } else {
            setProtocol(c.protocol || 'openai-compatible');
            setBaseURL(c.baseURL || 'https://api.deepseek.com/v1');
            setProtocolModel(c.modelName || (detectedMode === 'deepseek-official' ? 'deepseek-flash' : 'qwen2.5:7b'));
          }
          setCustomInputPricePerMillion(c.customInputPricePerMillion ? String(c.customInputPricePerMillion) : '');
          setCustomOutputPricePerMillion(c.customOutputPricePerMillion ? String(c.customOutputPricePerMillion) : '');
          if (c.hasApiKey) {
            setHasSavedKey(true);
            setApiKeyMasked(c.apiKeyMasked || '');
          }
          if (c.temperature !== undefined) setTemperature(c.temperature);
          if (c.maxTokens !== undefined) setMaxOutputTokens(Math.min(384000, Math.max(16384, Number(c.maxTokens) || 16384)));
          if (c.timeoutMs) setTimeoutSec(c.timeoutMs / 1000);
          if (c.structuredRetryLimit !== undefined) setStructuredRetryLimit(Math.min(10, Math.max(3, Number(c.structuredRetryLimit) || 3)));
        }
      })
      .catch((err) => console.error('Failed to load model config:', err));
    refreshModelUsage();
    refreshModelStatus();
  }, []);

  const buildPayload = () => {
    const base = {
      modelName: providerMode === 'other-official' ? officialModel : protocolModel,
      apiKey: apiKey.trim() || (hasSavedKey ? apiKeyMasked : ''),
      temperature: Number(temperature),
      maxTokens: Math.min(384000, Math.max(16384, Number(maxOutputTokens) || 16384)),
      timeoutMs: Number(timeoutSec) * 1000,
      maxRetries: 0,
      structuredRetryLimit: Number(structuredRetryLimit),
      providerMode,
      customInputPricePerMillion: Number(customInputPricePerMillion) || 0,
      customOutputPricePerMillion: Number(customOutputPricePerMillion) || 0,
      customPricingConfigured: customInputPricePerMillion.trim() !== '' && customOutputPricePerMillion.trim() !== ''
    };

    if (providerMode === 'other-official') {
      return {
        ...base,
        category: 'official',
        vendor: vendor
      };
    } else {
      return {
        ...base,
        category: 'protocol',
        protocol: providerMode === 'deepseek-official' ? 'openai-compatible' : protocol,
        baseURL: providerMode === 'deepseek-official' ? 'https://api.deepseek.com' : baseURL.trim()
      };
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const payload = buildPayload();
      const res = await fetch('/api/model/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage('✅ 模型与 API Key 配置已成功保存至本地！');
        setHasSavedKey(data.config.hasApiKey);
        setApiKeyMasked(data.config.apiKeyMasked);
        setApiKey('');
        window.dispatchEvent(new Event('examcraft-model-config-updated'));
        refreshModelStatus();
      } else {
        setSaveMessage(`❌ 保存失败: ${data.error}`);
      }
    } catch (err) {
      setSaveMessage(`❌ 保存失败: ${err.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 4000);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const payload = buildPayload();
      const res = await fetch('/api/model/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: data.reply || '模型通讯正常',
          latencyMs: data.latencyMs,
          provider: data.provider,
          modelName: data.modelName
        });
      } else {
        setTestResult({
          success: false,
          message: data.error,
          latencyMs: data.latencyMs
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const selectProviderMode = (mode) => {
    setProviderMode(mode);
    if (mode === 'other-official') {
      setCategory('official');
      return;
    }
    setCategory('protocol');
    if (mode === 'deepseek-official') {
      setProtocol('openai-compatible');
      setBaseURL('https://api.deepseek.com');
      if (!['deepseek-flash', 'deepseek-v4-pro'].includes(protocolModel)) setProtocolModel('deepseek-flash');
    }
  };

  return (
    <div className="flex min-w-0 flex-col w-full pb-16">
      <div className="w-full min-w-0 max-w-[1000px] mx-auto px-3 sm:px-margin-desktop py-4 sm:py-space-xl flex flex-col gap-4 sm:gap-space-xl">
        {/* Title Header */}
        <section className="bg-surface-container-lowest p-4 sm:p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-xs">
          <div className="inline-flex items-center gap-space-xs px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary font-label-mono text-label-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span>POWERED BY @CIVILIZATION/MODEL-CORE</span>
          </div>
          <h1 className="font-headline-xl text-[25px] leading-8 sm:text-headline-xl text-on-surface font-semibold">
            模型核心与 API Key 配置中心
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            可直连 DeepSeek 官方 API、配置其他云端模型，或接入自定义兼容接口。费用记录保存在本机，余额只向 DeepSeek 官方查询。
          </p>
        </section>

        <section className="bg-surface-container-lowest p-4 sm:p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-md">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">答题默认布局</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">设置进入考试时的默认工作区。考试中仍可通过顶部按钮临时切换；拖动分隔线调整的宽度会单独记住。</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl" role="radiogroup" aria-label="答题默认布局">
            {[
              { value: 'split', title: '左右分栏', detail: '左侧答题，右侧草稿纸', icon: 'vertical_split' },
              { value: 'stacked', title: '上下布局', detail: '答题区全宽，草稿纸按需打开', icon: 'view_agenda' }
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={defaultExamLayout === option.value}
                onClick={() => handleDefaultExamLayoutChange(option.value)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition cursor-pointer ${defaultExamLayout === option.value ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low'}`}
              >
                <span className={`material-symbols-outlined mt-0.5 ${defaultExamLayout === option.value ? 'text-primary' : 'text-on-surface-variant'}`}>{option.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-label-md font-semibold text-on-surface">{option.title}</span>
                  <span className="mt-0.5 block text-label-sm text-on-surface-variant">{option.detail}</span>
                </span>
                <span className={`material-symbols-outlined text-[18px] ${defaultExamLayout === option.value ? 'text-primary' : 'text-outline-variant'}`}>
                  {defaultExamLayout === option.value ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </button>
            ))}
          </div>
          <div className="text-label-sm text-secondary" aria-live="polite">默认布局已保存在本机设置中。</div>
        </section>

        <section className="bg-surface-container-lowest p-4 sm:p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-md">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">解析预览默认答案显示</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">控制智能组卷的题稿解析预览首次打开时，是否展示标准答案和解析。只影响预览显示，不会删除试卷中的答案。</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl" role="radiogroup" aria-label="解析预览默认答案显示">
            {[
              { value: true, title: '默认显示答案', detail: '预览中显示标准答案，可展开解析', icon: 'visibility' },
              { value: false, title: '默认隐藏答案', detail: '预览中先隐藏答案与解析', icon: 'visibility_off' }
            ].map((option) => (
              <button
                key={String(option.value)}
                type="button"
                role="radio"
                aria-checked={showAnswersDefault === option.value}
                onClick={() => handleShowAnswersDefaultChange(option.value)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition cursor-pointer ${showAnswersDefault === option.value ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low'}`}
              >
                <span className={`material-symbols-outlined mt-0.5 ${showAnswersDefault === option.value ? 'text-primary' : 'text-on-surface-variant'}`}>{option.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-label-md font-semibold text-on-surface">{option.title}</span>
                  <span className="mt-0.5 block text-label-sm text-on-surface-variant">{option.detail}</span>
                </span>
                <span className={`material-symbols-outlined text-[18px] ${showAnswersDefault === option.value ? 'text-primary' : 'text-outline-variant'}`}>
                  {showAnswersDefault === option.value ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </button>
            ))}
          </div>
          <div className="text-label-sm text-secondary" aria-live="polite">默认显示偏好已保存在本机设置中。</div>
        </section>

        <section className="bg-surface-container-lowest p-4 sm:p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-md">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">草稿纸助手语气</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">选择助手的默认交流方式，只影响操作反馈和安全提示，不会改变作图、誊写或防代答规则。设置保存在本机。</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl" role="radiogroup" aria-label="草稿纸助手语气">
            {agentToneOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={scratchpadAgentTone === option.value}
                onClick={() => handleScratchpadAgentToneChange(option.value)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition cursor-pointer ${scratchpadAgentTone === option.value ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low'}`}
              >
                <span className={`material-symbols-outlined mt-0.5 ${scratchpadAgentTone === option.value ? 'text-primary' : 'text-on-surface-variant'}`}>{option.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-label-md font-semibold text-on-surface">{option.title}</span>
                  <span className="mt-0.5 block text-label-sm text-on-surface-variant">{option.detail}</span>
                </span>
                <span className={`material-symbols-outlined text-[18px] ${scratchpadAgentTone === option.value ? 'text-primary' : 'text-outline-variant'}`}>
                  {scratchpadAgentTone === option.value ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </button>
            ))}
          </div>
          <div className="text-label-sm text-secondary" aria-live="polite">语气偏好已保存在本机设置中。</div>
        </section>

        {/* Main Model Core Configuration Deck */}
        <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-lg">
          {/* Category Tabs */}
          <div>
            <label className="block text-label-md font-semibold text-on-surface mb-2">模型调度架构分类</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 p-1 bg-surface-container-high rounded-xl max-w-3xl border border-outline-variant/30">
              <button
                type="button"
                onClick={() => selectProviderMode('deepseek-official')}
                className={`py-2 px-4 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                  providerMode === 'deepseek-official'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                DeepSeek 官方
              </button>
              <button
                type="button"
                onClick={() => selectProviderMode('custom')}
                className={`py-2 px-4 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                  providerMode === 'custom'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                自定义接口
              </button>
              <button
                type="button"
                onClick={() => selectProviderMode('other-official')}
                className={`py-2 px-4 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                  providerMode === 'other-official'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                其他官方模型
              </button>
            </div>
          </div>

          {/* Conditional Sub-settings: Official */}
          {category === 'official' && (
            <div className="space-y-4 pt-2 border-t border-surface-container">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                <div>
                  <label className="block text-label-md font-semibold text-on-surface mb-1">官方厂商 (Vendor)</label>
                  <SelectMenu
                    ariaLabel="官方模型厂商"
                    value={vendor}
                    onChange={(v) => {
                      setVendor(v);
                      if (v === 'gemini') setOfficialModel('gemini-2.5-flash');
                      if (v === 'openai') setOfficialModel('gpt-4o');
                      if (v === 'anthropic') setOfficialModel('claude-3-7-sonnet');
                    }}
                    options={[
                      { value: 'gemini', label: 'Google Gemini (官方 SDK: @google/genai)' },
                      { value: 'openai', label: 'OpenAI (官方 SDK: openai)' },
                      { value: 'anthropic', label: 'Anthropic (官方 SDK: @anthropic-ai/sdk)' }
                    ]}
                    className="w-full"
                    buttonClassName="inline-flex w-full items-center justify-between gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-left font-mono text-on-surface hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-label-md font-semibold text-on-surface mb-1">模型名称 (modelName)</label>
                  <input
                    type="text"
                    value={officialModel}
                    onChange={(e) => setOfficialModel(e.target.value)}
                    placeholder="如: gemini-2.5-flash 或 gpt-4o"
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono text-body-md"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Conditional Sub-settings: Protocol */}
          {category === 'protocol' && (
            <div className="space-y-4 pt-2 border-t border-surface-container">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                {providerMode === 'custom' && <div>
                  <label className="block text-label-md font-semibold text-on-surface mb-1">协议标准 (Protocol)</label>
                  <SelectMenu
                    ariaLabel="兼容接口协议标准"
                    value={protocol}
                    onChange={setProtocol}
                    options={[
                      { value: 'openai-compatible', label: 'OpenAI Compatible (DeepSeek / Ollama / vLLM / OneAPI)' },
                      { value: 'anthropic-compatible', label: 'Anthropic Compatible' }
                    ]}
                    className="w-full"
                    buttonClassName="inline-flex w-full items-center justify-between gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-left font-mono text-on-surface hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>}

                <div>
                  <label className="block text-label-md font-semibold text-on-surface mb-1">模型名称</label>
                  {providerMode === 'deepseek-official' ? (
                    <SelectMenu
                      ariaLabel="DeepSeek 模型"
                      value={protocolModel}
                      onChange={setProtocolModel}
                      options={[
                        { value: 'deepseek-flash', label: 'deepseek-flash · 日常推荐' },
                        { value: 'deepseek-v4-pro', label: 'deepseek-v4-pro · 高能力' }
                      ]}
                      className="w-full"
                      buttonClassName="inline-flex w-full items-center justify-between gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-left font-mono text-body-md text-on-surface hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  ) : (
                    <input type="text" value={protocolModel} onChange={(e) => setProtocolModel(e.target.value)} placeholder="例如：qwen-plus、模型部署名" className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono text-body-md" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-label-md font-semibold text-on-surface mb-1">接口基础地址 (baseURL)</label>
                <input
                  type="text"
                  value={baseURL}
                  onChange={(e) => setBaseURL(e.target.value)}
                  readOnly={providerMode === 'deepseek-official'}
                  placeholder="例如：https://your-provider.example/v1"
                  className={`w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono text-body-md ${providerMode === 'deepseek-official' ? 'opacity-70' : ''}`}
                />
                {providerMode === 'deepseek-official' && <p className="mt-1 text-label-sm text-on-surface-variant">官方 OpenAI 兼容地址由系统固定为 api.deepseek.com。</p>}
              </div>
              {providerMode === 'deepseek-official' && <p className="text-label-sm text-on-surface-variant">DeepSeek 费用按当前官方单价和请求时段估算；节假日、活动价或官方调价可能造成差异，实际扣款以钱包为准。</p>}
              {providerMode === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md rounded-lg bg-surface-container-low p-3">
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">输入单价（元 / 百万 token）</label>
                    <input type="number" min="0" step="0.01" value={customInputPricePerMillion} onChange={(e) => setCustomInputPricePerMillion(e.target.value)} placeholder="不填则仅统计 token" className="w-full px-3 py-2 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-on-surface font-mono" />
                  </div>
                  <div>
                    <label className="block text-label-sm font-semibold text-on-surface mb-1">输出单价（元 / 百万 token）</label>
                    <input type="number" min="0" step="0.01" value={customOutputPricePerMillion} onChange={(e) => setCustomOutputPricePerMillion(e.target.value)} placeholder="不填则仅统计 token" className="w-full px-3 py-2 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-on-surface font-mono" />
                  </div>
                  <p className="md:col-span-2 text-label-sm text-on-surface-variant">输入和输出单价都填写后才会估算费用；留空时只统计 token。缓存折扣、峰谷价和网关加价需折算进单价。</p>
                </div>
              )}
            </div>
          )}

          {/* API Key Input Section */}
          <div className="space-y-2 pt-2 border-t border-surface-container">
            <div className="flex items-center justify-between">
              <label className="block text-label-md font-semibold text-on-surface">
                API 密钥 (API Key)
              </label>
              {hasSavedKey && (
                <span className="font-label-mono text-code-sm text-secondary font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  已持久化保存: {apiKeyMasked}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasSavedKey ? '留空表示沿用已保存的 API Key；若需修改请在此粘贴新密钥' : '请输入 API Key (例如：AIzaSy... 或 sk-...)'}
                className="w-full px-4 py-2.5 pr-24 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface text-label-sm flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showKey ? 'visibility_off' : 'visibility'}
                </span>
                <span>{showKey ? '隐藏' : '显示'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
              <span>🔒 您的 API Key 存储在本地配置文件，仅在服务器与厂商间经安全 HTTPS 转发，绝不上传第三方。</span>
              {providerMode === 'deepseek-official' && (
                <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                  <span>DeepSeek API Key</span><span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
              )}
              {vendor === 'gemini' && category === 'official' && (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <span>获取 Gemini API Key</span>
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
              )}
            </div>
          </div>

          {/* Advanced Model Hyperparameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md pt-2 border-t border-surface-container">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-label-md font-semibold text-on-surface">发散度 (Temperature)</label>
                <span className="font-mono text-label-sm font-semibold text-primary">{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <span className="text-[11px] text-on-surface-variant block mt-1">数学试卷命题建议设为 0.2 ~ 0.7 保证严谨度</span>
            </div>

            <div>
              <label className="block text-label-md font-semibold text-on-surface mb-1">超时控制 (秒)</label>
              <input
                type="number"
                min="5"
                max="120"
                value={timeoutSec}
                onChange={(e) => setTimeoutSec(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono"
              />
            </div>
            <div>
              <label htmlFor="max-output-tokens" className="block text-label-md font-semibold text-on-surface mb-1">单次输出上限（max_tokens）</label>
              <input
                id="max-output-tokens"
                type="number"
                min="16384"
                max="384000"
                step="1024"
                value={maxOutputTokens}
                onChange={(e) => setMaxOutputTokens(Math.min(384000, Math.max(16384, Number(e.target.value) || 16384)))}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono"
              />
              <span className="text-[11px] text-on-surface-variant block mt-1">交卷诊断会使用此上限。它是生成上限，不代表每次都会用满；DeepSeek 官方 Chat Completions 文档支持最高 384K，其他服务商仍受各自限制。</span>
            </div>
            <div className="md:col-span-2 rounded-xl bg-surface-container-low p-4">
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="structured-retry-limit" className="text-label-md font-semibold text-on-surface">结构化解析重试上限</label>
                <span className="font-mono text-label-sm font-semibold text-primary">{structuredRetryLimit} 次</span>
              </div>
              <input
                id="structured-retry-limit"
                type="range"
                min="3"
                max="10"
                step="1"
                value={structuredRetryLimit}
                onChange={(e) => setStructuredRetryLimit(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
                aria-valuetext={`最多额外重试 ${structuredRetryLimit} 次`}
              />
              <p className="text-[11px] text-on-surface-variant mt-1">每次试卷解析任务最多额外纠错 {structuredRetryLimit} 次，由所有批次共享；仅对 JSON 或必需字段错误重试。输出触及 token 上限时停止纠错并提示本地规则兜底，网络、额度或鉴权失败不会自动重试。每次纠错调用都会计入 token 和费用。</p>
            </div>
          </div>

          {/* Test Feedback Area */}
          {testResult && (
            <div
              className={`p-space-md rounded-xl border flex items-start gap-space-sm ${
                testResult.success
                  ? 'bg-secondary/10 border-secondary/30 text-on-surface'
                  : 'bg-error-container/40 border-error-container text-on-error-container'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] mt-0.5 ${testResult.success ? 'text-secondary' : 'text-error'}`}>
                {testResult.success ? 'check_circle' : 'error'}
              </span>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-label-md">
                    {testResult.success ? '🎉 模型连接测试成功！' : '❌ 模型连接测试失败'}
                  </p>
                  {testResult.latencyMs && (
                    <span className="font-mono text-code-sm font-semibold opacity-80">
                      延迟: {testResult.latencyMs} ms
                    </span>
                  )}
                </div>
                <p className="text-body-sm leading-relaxed">{testResult.message}</p>
                {testResult.provider && (
                  <p className="font-mono text-[11px] opacity-75">
                    路由内核: {testResult.provider} ({testResult.modelName})
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="pt-2 flex items-center justify-between border-t border-surface-container flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="px-space-lg py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-semibold transition-all flex items-center gap-1.5 border border-outline-variant/30 cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${isTesting ? 'animate-spin' : ''}`}>
                  {isTesting ? 'progress_activity' : 'bolt'}
                </span>
                <span>{isTesting ? '正在通讯测试中...' : '测试模型连接'}</span>
              </button>

              {saveMessage && (
                <span className="text-label-sm font-medium animate-in fade-in duration-200">
                  {saveMessage}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-space-xl py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md font-semibold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>{isSaving ? '正在保存...' : '保存配置生效'}</span>
            </button>
          </div>
        </section>

        {/* Local model-call ledger */}
        <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-md">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">模型调用记录</h2>
              <p className="text-body-sm text-on-surface-variant mt-1">按模型入口记录 token 与估算费用，不保存题目内容或 API Key。DeepSeek 钱包余额为官方接口返回；自定义模型费用使用你填写的单价估算。</p>
            </div>
            <button type="button" onClick={refreshModelUsage} className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-label-sm hover:bg-surface-container-high">刷新记录</button>
          </div>
          {modelUsage ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                {[
                  ['请求数', modelUsage.totals.calls],
                  ['失败请求', modelUsage.totals.failed],
                  ['输入 token', modelUsage.totals.inputTokens.toLocaleString()],
                  ['输出 token', modelUsage.totals.outputTokens.toLocaleString()],
                  ['总 token', modelUsage.totals.totalTokens.toLocaleString()],
                  ['估算费用', modelUsage.totals.pricedCalls ? `¥${modelUsage.totals.estimatedCostCny.toFixed(4)}` : '未配置单价']
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-surface-container-low p-3">
                    <div className="text-label-sm text-on-surface-variant">{label}</div>
                    <div className="mt-1 font-label-mono font-bold text-on-surface">{value}</div>
                  </div>
                ))}
              </div>
              {modelStatus?.model?.providerMode === 'deepseek-official' && (
                <div className="flex items-center gap-2 rounded-lg bg-secondary/5 border border-secondary/20 px-3 py-2 text-label-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[17px] text-secondary">account_balance_wallet</span>
                  <span>DeepSeek 钱包：</span>
                  <strong className="font-label-mono text-secondary">
                    {(modelStatus?.balance?.balances?.find((item) => item.currency === 'CNY') || modelStatus?.balance?.balances?.[0])
                      ? `${(modelStatus.balance.balances.find((item) => item.currency === 'CNY') || modelStatus.balance.balances[0]).currency === 'CNY' ? '¥' : '$'}${(modelStatus.balance.balances.find((item) => item.currency === 'CNY') || modelStatus.balance.balances[0]).totalBalance.toFixed(2)}`
                      : (modelStatus?.balanceError || '查询中')}
                  </strong>
                  <button type="button" onClick={() => refreshModelStatus(true)} className="ml-auto text-primary hover:underline">刷新状态</button>
                </div>
              )}
              {modelUsage.records.length > 0 ? (
                <div className="max-h-64 overflow-auto rounded-lg border border-outline-variant/30 divide-y divide-outline-variant/20">
                  {modelUsage.records.map((record) => (
                    <div key={record.id} className="px-3 py-2 flex items-center justify-between gap-3 text-label-sm flex-wrap">
                      <div>
                        <span className={record.status === 'success' ? 'text-secondary font-semibold' : 'text-error font-semibold'}>{record.status === 'success' ? '成功' : '失败'}</span>
                        <span className="ml-2 text-on-surface font-medium">{record.operation}</span>
                        <span className="ml-2 text-on-surface-variant">{record.model}</span>
                        <span className="ml-2 text-outline">{new Date(record.time).toLocaleString()}</span>
                      </div>
                      <span className="font-label-mono text-on-surface-variant">
                        {record.usageReported ? `${record.inputTokens.toLocaleString()} in / ${record.outputTokens.toLocaleString()} out` : '服务端未返回 token 用量'}
                        {record.estimatedCostCny !== null && record.estimatedCostCny !== undefined ? ` · ¥${Number(record.estimatedCostCny).toFixed(4)}` : ''} · {record.durationMs} ms
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-label-sm text-on-surface-variant">暂无调用记录；记录从本次更新后的请求开始累计。</p>}
              {modelUsage.totals.unreported > 0 && <p className="text-label-sm text-on-surface-variant">有 {modelUsage.totals.unreported} 条失败或未返回用量的请求，token 数无法由应用确认；服务商账单仍是最终依据。</p>}
            </>
          ) : <p className="text-label-sm text-on-surface-variant">正在读取本地调用记录…</p>}
        </section>

        {/* Local Storage & Cache Data Management */}
        <section className="bg-surface-container-lowest p-space-xl rounded-2xl shadow-sm border border-outline-variant/30 space-y-space-md">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-outline text-[22px]">delete_sweep</span>
              <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">本地数据管理与缓存重置</h2>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container font-label-mono text-label-mono text-on-surface-variant">
              浏览器 localStorage
            </span>
          </div>

          <p className="text-body-sm text-on-surface-variant">
            试卷、交卷记录与错题集保存在当前浏览器中。清空本地数据后，这些内容将无法恢复。
          </p>

          <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant/20 flex-wrap gap-4">
            <div className="flex items-center gap-6 text-label-sm font-label-mono flex-wrap">
              <div>
                <span className="text-on-surface-variant">当前本地试卷：</span>
                <span className="font-bold text-on-surface ml-1">{localStats.papersCount} 份</span>
              </div>
              <div>
                <span className="text-on-surface-variant">模考历史：</span>
                <span className="font-bold text-on-surface ml-1">{localStats.subsCount} 次</span>
              </div>
              <div>
                <span className="text-on-surface-variant">收录题数：</span>
                <span className="font-bold text-on-surface ml-1">{localStats.mistakesCount} 题</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearAllData}
              className="px-4 py-2 rounded-lg bg-error-container hover:bg-error text-on-error-container hover:text-on-error font-label-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              <span>彻底清空所有本地数据并重置</span>
            </button>
          </div>
        </section>
      </div>

      {/* Clear All Data Confirm Dialog */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-[70] bg-on-background/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowClearConfirm(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="bg-surface-container-lowest text-on-surface rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/40 space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">delete_forever</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  清空所有本地数据？
                </h3>
                <p className="mt-1.5 text-body-sm text-on-surface-variant leading-relaxed">
                  此操作将彻底删除本地已保存的全部试卷（{localStats.papersCount} 份）、历史模考作答记录（{localStats.subsCount} 次）以及错题本收录题目（{localStats.mistakesCount} 题）。删除后无法恢复。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={executeClearAllData}
                className="px-4 py-2 rounded-xl bg-error text-on-error hover:bg-error/90 font-label-md font-semibold cursor-pointer transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                <span>确认清空并刷新</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
