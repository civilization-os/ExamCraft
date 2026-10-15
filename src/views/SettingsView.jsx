import React, { useState, useEffect } from 'react';

export default function SettingsView() {
  // Category: 'official' | 'protocol'
  const [category, setCategory] = useState('official');
  
  // Official fields
  const [vendor, setVendor] = useState('gemini'); // 'gemini' | 'openai' | 'anthropic'
  const [officialModel, setOfficialModel] = useState('gemini-2.5-flash');
  
  // Protocol fields
  const [protocol, setProtocol] = useState('openai-compatible');
  const [baseURL, setBaseURL] = useState('https://api.deepseek.com/v1');
  const [protocolModel, setProtocolModel] = useState('deepseek-chat');

  // Common fields
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [timeoutSec, setTimeoutSec] = useState(30);

  // Status & Test feedback
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string, latencyMs?: number, provider?: string }
  const [saveMessage, setSaveMessage] = useState('');

  // Fetch current config on mount
  useEffect(() => {
    fetch('/api/model/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          const c = data.config;
          setCategory(c.category || 'official');
          if (c.category === 'official') {
            setVendor(c.vendor || 'gemini');
            setOfficialModel(c.modelName || 'gemini-2.5-flash');
          } else {
            setProtocol(c.protocol || 'openai-compatible');
            setBaseURL(c.baseURL || 'https://api.deepseek.com/v1');
            setProtocolModel(c.modelName || 'deepseek-chat');
          }
          if (c.hasApiKey) {
            setHasSavedKey(true);
            setApiKeyMasked(c.apiKeyMasked || '');
          }
          if (c.temperature !== undefined) setTemperature(c.temperature);
          if (c.timeoutMs) setTimeoutSec(c.timeoutMs / 1000);
        }
      })
      .catch((err) => console.error('Failed to load model config:', err));
  }, []);

  const buildPayload = () => {
    const base = {
      modelName: category === 'official' ? officialModel : protocolModel,
      apiKey: apiKey.trim() || (hasSavedKey ? apiKeyMasked : ''),
      temperature: Number(temperature),
      timeoutMs: Number(timeoutSec) * 1000,
      maxRetries: 2
    };

    if (category === 'official') {
      return {
        ...base,
        category: 'official',
        vendor: vendor
      };
    } else {
      return {
        ...base,
        category: 'protocol',
        protocol: protocol,
        baseURL: baseURL.trim()
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

  // Quick preset helper
  const applyPreset = (type) => {
    if (type === 'gemini') {
      setCategory('official');
      setVendor('gemini');
      setOfficialModel('gemini-2.5-flash');
    } else if (type === 'deepseek') {
      setCategory('protocol');
      setProtocol('openai-compatible');
      setBaseURL('https://api.deepseek.com/v1');
      setProtocolModel('deepseek-chat');
    } else if (type === 'openai') {
      setCategory('official');
      setVendor('openai');
      setOfficialModel('gpt-4o');
    } else if (type === 'ollama') {
      setCategory('protocol');
      setProtocol('openai-compatible');
      setBaseURL('http://localhost:11434/v1');
      setProtocolModel('qwen2.5:7b');
      setApiKey('EMPTY');
    }
  };

  return (
    <div className="flex flex-col w-full pb-16">
      <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-margin-desktop py-space-xl flex flex-col gap-space-xl">
        {/* Title Header */}
        <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-xs">
          <div className="inline-flex items-center gap-space-xs px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary font-label-mono text-label-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span>POWERED BY @CIVILIZATION/MODEL-CORE</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface font-semibold">
            模型核心与 API Key 配置中心
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            基于底层统一架构 <code>model_core</code>，支持 Google Gemini、OpenAI、Anthropic 等官方提供商，以及兼容 DeepSeek、OneAPI、Ollama 等协议自部署网关。在此输入并校验您的 API Key。
          </p>
        </section>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">一键快速套用预设:</span>
          <button
            type="button"
            onClick={() => applyPreset('gemini')}
            className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-sm font-semibold transition-colors cursor-pointer border border-primary/20"
          >
            Google Gemini 官方
          </button>
          <button
            type="button"
            onClick={() => applyPreset('deepseek')}
            className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary font-label-sm font-semibold transition-colors cursor-pointer border border-secondary/20"
          >
            DeepSeek 协议直连
          </button>
          <button
            type="button"
            onClick={() => applyPreset('openai')}
            className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm font-semibold transition-colors cursor-pointer border border-outline-variant/30"
          >
            OpenAI 官方
          </button>
          <button
            type="button"
            onClick={() => applyPreset('ollama')}
            className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm font-semibold transition-colors cursor-pointer border border-outline-variant/30"
          >
            本地 Ollama / vLLM
          </button>
        </div>

        {/* Main Model Core Configuration Deck */}
        <section className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-outline-variant/30 space-y-space-lg">
          {/* Category Tabs */}
          <div>
            <label className="block text-label-md font-semibold text-on-surface mb-2">模型调度架构分类</label>
            <div className="grid grid-cols-2 p-1 bg-surface-container-high rounded-xl max-w-md border border-outline-variant/30">
              <button
                type="button"
                onClick={() => setCategory('official')}
                className={`py-2 px-4 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                  category === 'official'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                云端厂商直连 (Official)
              </button>
              <button
                type="button"
                onClick={() => setCategory('protocol')}
                className={`py-2 px-4 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                  category === 'protocol'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                网关与自部署协议 (Protocol)
              </button>
            </div>
          </div>

          {/* Conditional Sub-settings: Official */}
          {category === 'official' && (
            <div className="space-y-4 pt-2 border-t border-surface-container">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                <div>
                  <label className="block text-label-md font-semibold text-on-surface mb-1">官方厂商 (Vendor)</label>
                  <select
                    value={vendor}
                    onChange={(e) => {
                      const v = e.target.value;
                      setVendor(v);
                      if (v === 'gemini') setOfficialModel('gemini-2.5-flash');
                      if (v === 'openai') setOfficialModel('gpt-4o');
                      if (v === 'anthropic') setOfficialModel('claude-3-7-sonnet');
                    }}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono"
                  >
                    <option value="gemini">Google Gemini (官方 SDK: @google/genai)</option>
                    <option value="openai">OpenAI (官方 SDK: openai)</option>
                    <option value="anthropic">Anthropic (官方 SDK: @anthropic-ai/sdk)</option>
                  </select>
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
                <div>
                  <label className="block text-label-md font-semibold text-on-surface mb-1">协议标准 (Protocol)</label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono"
                  >
                    <option value="openai-compatible">OpenAI Compatible (DeepSeek / Ollama / vLLM / OneAPI)</option>
                    <option value="anthropic-compatible">Anthropic Compatible</option>
                  </select>
                </div>

                <div>
                  <label className="block text-label-md font-semibold text-on-surface mb-1">模型名称 (modelName)</label>
                  <input
                    type="text"
                    value={protocolModel}
                    onChange={(e) => setProtocolModel(e.target.value)}
                    placeholder="如: deepseek-chat 或 qwen2.5:7b"
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono text-body-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-label-md font-semibold text-on-surface mb-1">接口基础地址 (baseURL)</label>
                <input
                  type="text"
                  value={baseURL}
                  onChange={(e) => setBaseURL(e.target.value)}
                  placeholder="https://api.deepseek.com/v1 或 http://localhost:11434/v1"
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface font-mono text-body-md"
                />
              </div>
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
      </div>
    </div>
  );
}
