import React, { useState, useEffect, useRef } from 'react';
import { apiLogin, apiRegister } from '../utils/auth';

const SLIDES = [
  {
    num: "MODULE 01 / 03",
    category: "多模态试卷重构",
    title: "1:1 完整真题 PDF 原样精确克隆与排版解析",
    desc: "只需拖拽历年期末或考研真题卷，自适应多模态大模型即刻原位提取数学公式、题型分值结构与双栏排版。",
    filename: "2024届全国高等数学期末统考试卷A.pdf",
    statusTag: "100% 23题完全对齐",
    nodeLabel: "PARSE NODE: Question 17 (Differential Equation)",
    confidence: "LaTeX Confidence 99.8%",
    formula: "$$ \\lim_{x \\to 0} \\frac{\\int_0^x \\sin(t^2)\\,dt}{x^3} = \\frac{1}{3} \\quad \\implies \\quad \\nabla^2 \\Phi + \\lambda_k \\Phi = 0 $$",
    metaItems: [
      { label: "分值", value: "12 分", valueClass: "text-inverse-on-surface" },
      { label: "智能评分点", value: "4 个断点分步给分", valueClass: "text-secondary-fixed-dim" },
      { label: "重构格式", value: "标准 LaTeX 双栏印刷体", valueClass: "text-primary-fixed-dim" }
    ],
    tags: ["#数学公式LaTeX还原", "#智能分步给分", "#全真双栏印刷排版", "#原位OCR保留率 99.4%"],
    quote: "“复习备考效率提升 300%，特别是大试卷全景漫游和分步批改功能！”",
    author: "—— 985 高校高等数学教研组 核心考务团队"
  },
  {
    num: "MODULE 02 / 03",
    category: "沉浸式答题界面",
    title: "大试卷全景漫游模式与空格物理平移手势",
    desc: "无限画布自由缩放拖拽，支持题卡任意位置公式批注与分屏草稿本，还原高拟真考场心流体验。",
    filename: "物理学与凝聚态理论综合能力联考卷.pdf",
    statusTag: "60 FPS 物理平移手势",
    nodeLabel: "CANVAS NODE: Infinite Canvas & Gesture Panning",
    confidence: "Gesture Latency < 16ms",
    formula: "快捷交互：按住 [空格键] 拖拽画布 · 滚轮双指 25%~400% 无级缩放 · 随题草稿本实时公式推演",
    metaItems: [
      { label: "缩放范围", value: "25% ~ 400%", valueClass: "text-inverse-on-surface" },
      { label: "漫游体验", value: "整卷全景一览无余", valueClass: "text-secondary-fixed-dim" },
      { label: "智能草稿", value: "独立随题云端漫游", valueClass: "text-primary-fixed-dim" }
    ],
    tags: ["#无限画布漫游", "#手势平移", "#草稿本双屏同显", "#题干高保真缩放"],
    quote: "“彻底告别了传统网考单题死板翻页，学生作答大题推导逻辑一览无余。”",
    author: "—— 华东重点示范高中 教学质量评估组"
  },
  {
    num: "MODULE 03 / 03",
    category: "学术诚信与智能评阅",
    title: "AI辅助规范代笔·诚信作答实时行为分析",
    desc: "辅助规范考生解题推演步骤，杜绝无脑代码代做；毫秒级监控解题心流与公式书写逻辑链断裂。",
    filename: "计算机算法与数据结构期中实训评估卷.pdf",
    statusTag: "学术防线 100% 覆盖",
    nodeLabel: "INTEGRITY NODE: Academic Integrity & Step Analysis",
    confidence: "Compliance Grade A+",
    formula: "纪律准则：草稿纸严格规范 LaTeX 书写与思路大纲整理，严禁代算与题目答案泄露",
    metaItems: [
      { label: "防作弊机制", value: "代写代算刚性拦截", valueClass: "text-inverse-on-surface" },
      { label: "辅助定位", value: "启发式思路引导", valueClass: "text-secondary-fixed-dim" },
      { label: "评阅规范", value: "分步踩分客观核验", valueClass: "text-primary-fixed-dim" }
    ],
    tags: ["#防作弊逻辑链", "#学术诚信白名单", "#分步推理溯源", "#代笔规范约束"],
    quote: "“既赋予学生智能解题思路启发，又把住了考场学术诚信的红线底线。”",
    author: "—— 软件工程拔尖创新人才培养基地"
  }
];

export default function AuthModal({ isOpen, onClose, onSuccess, onGuest, allowGuest = true }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('teacher'); // 'teacher' | 'student'
  const [showPassword, setShowPassword] = useState(false);
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoNotice, setInfoNotice] = useState('');

  // Carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const startTimer = () => {
      timerRef.current = setInterval(() => {
        handleNextSlide();
      }, 6500);
    };

    startTimer();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNextSlide = () => {
    setIsFading(true);
    setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
      setIsFading(false);
    }, 150);
  };

  const handlePrevSlide = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsFading(true);
    setTimeout(() => {
      setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
      setIsFading(false);
    }, 150);
  };

  const handleSelectSlide = (idx) => {
    if (idx === currentSlide) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsFading(true);
    setTimeout(() => {
      setCurrentSlide(idx);
      setIsFading(false);
    }, 150);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoNotice('');

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMsg('请输入账号、邮箱或学工号');
      return;
    }

    if (isOtpMode) {
      if (!smsCode || smsCode.trim().length < 4) {
        setErrorMsg('请输入有效的动态验证码');
        return;
      }
    } else {
      if (!password) {
        setErrorMsg('请输入登录密码');
        return;
      }
    }

    if (tab === 'register') {
      if (cleanUsername.length < 2 || cleanUsername.length > 32) {
        setErrorMsg('用户名长度需在 2 到 32 个字符之间');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('密码长度不能少于 6 位');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('两次输入的密码不一致');
        return;
      }
    }

    setIsLoading(true);
    try {
      let user;
      if (tab === 'login') {
        const effectivePassword = isOtpMode ? `otp_${smsCode.trim()}` : password;
        user = await apiLogin(cleanUsername, effectivePassword);
      } else {
        user = await apiRegister(cleanUsername, password);
      }
      if (rememberMe) {
        try {
          localStorage.setItem('examcraft_remember_device', 'true');
        } catch {}
      }
      if (onSuccess) onSuccess(user);
      if (onClose) onClose();
    } catch (err) {
      setErrorMsg(err.message || '认证失败，请检查网络或账号密码');
    } finally {
      setIsLoading(false);
    }
  };

  // Fast SSO / Demo helpers
  const handleCarsiSSO = () => {
    setUsername('carsi.faculty@university.edu.cn');
    setPassword('Carsi2026!Edu');
    setInfoNotice('已连接 CARSI / EduID 高校教育联盟统一认证网关，账号与凭证已自动就绪');
  };

  const handleWechatLogin = () => {
    setUsername('wx_user_edu');
    setPassword('WechatPass888');
    setInfoNotice('已模拟微信扫码安全授权，账号信息已就绪');
  };

  const handleGithubLogin = () => {
    setUsername('github_developer');
    setPassword('GithubSecure2026');
    setInfoNotice('已调取 GitHub OpenID 授权，账号凭据已就绪');
  };

  const activeSlideData = SLIDES[currentSlide];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 lg:p-8 bg-black/75 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={() => {
        if (allowGuest && onClose) onClose();
      }}
    >
      <div
        className="w-full max-w-[1520px] my-auto flex flex-col lg:flex-row items-stretch justify-between gap-6 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* LEFT COLUMN: Showcase & Feature Walkthrough Carousel */}
        <div className="w-full lg:w-[54%] flex flex-col justify-between rounded-3xl bg-inverse-surface text-inverse-on-surface p-6 sm:p-8 lg:p-12 relative overflow-hidden shadow-2xl min-h-[580px] lg:min-h-[660px]">
          {/* Subtle Ambient Lighting Blobs */}
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-container/20 blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-surface-tint/15 blur-2xl pointer-events-none"></div>

          {/* Top Row: Badge & Global Status */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-highest/15 backdrop-blur-md border border-white/10">
              <span className="inline-block w-2 h-2 rounded-full bg-secondary-container animate-pulse"></span>
              <span className="font-mono text-[11px] tracking-wide text-inverse-primary uppercase font-medium">
                ExamCraft AI · v2.4 Feature Preview
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-surface-variant text-[12px] font-medium">
              <span className="material-symbols-outlined text-[16px] text-secondary-fixed">verified_user</span>
              <span>高等教育自适应模型已就绪</span>
            </div>
          </div>

          {/* Main Carousel Slider Content */}
          <div className="relative z-10 my-auto py-6">
            <div
              className={`transition-all duration-200 transform ${
                isFading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
              }`}
            >
              {/* Slide Title & Description */}
              <div className="space-y-3 mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-2 text-primary-fixed-dim font-mono text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-primary-container/40">{activeSlideData.num}</span>
                  <span className="text-surface-dim text-[12px]">{activeSlideData.category}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-[32px] font-semibold text-inverse-on-surface tracking-tight leading-tight">
                  {activeSlideData.title}
                </h2>
                <p className="text-sm sm:text-base text-surface-dim max-w-xl leading-relaxed">
                  {activeSlideData.desc}
                </p>
              </div>

              {/* Feature Mockup Glass Card */}
              <div className="relative rounded-2xl bg-surface-container-lowest/10 backdrop-blur-lg p-5 sm:p-6 shadow-2xl space-y-4 border border-white/10">
                {/* Mockup Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-primary-fixed text-[22px] shrink-0">
                      picture_as_pdf
                    </span>
                    <span className="font-mono text-xs sm:text-sm text-surface-bright font-medium truncate max-w-[260px] sm:max-w-md">
                      {activeSlideData.filename}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/20 text-secondary-fixed font-mono text-[11px] shrink-0">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    {activeSlideData.statusTag}
                  </span>
                </div>

                {/* Formula / Interactive Simulation Block */}
                <div className="rounded-xl bg-inverse-surface/85 p-4 space-y-2.5 border border-white/5">
                  <div className="flex items-center justify-between text-surface-dim font-mono text-[11px]">
                    <span className="truncate pr-2">{activeSlideData.nodeLabel}</span>
                    <span className="text-secondary-fixed font-mono shrink-0">{activeSlideData.confidence}</span>
                  </div>

                  <div className="font-mono text-xs sm:text-sm text-inverse-primary bg-surface-container-highest/10 p-3 rounded-lg overflow-x-auto leading-relaxed border border-white/5">
                    {activeSlideData.formula}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-surface-variant text-[11px] pt-1">
                    {activeSlideData.metaItems.map((item, idx) => (
                      <span key={idx}>
                        {item.label}: <strong className={item.valueClass}>{item.value}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Floating Capabilities Tags */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {activeSlideData.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className={`px-2.5 py-1 rounded-full font-mono text-[10px] sm:text-[11px] ${
                        idx === activeSlideData.tags.length - 1
                          ? 'bg-primary-container/40 text-primary-fixed font-medium'
                          : 'bg-surface-container-highest/20 text-surface-bright'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Customer/Endorsement Quote Card */}
              <div className="mt-5 rounded-xl bg-surface-container-highest/10 p-4 backdrop-blur-sm flex items-start gap-3 border border-white/5">
                <span className="material-symbols-outlined text-primary-fixed-dim text-[22px] shrink-0 mt-0.5">
                  format_quote
                </span>
                <div>
                  <p className="text-xs sm:text-sm text-inverse-on-surface italic leading-snug">
                    {activeSlideData.quote}
                  </p>
                  <p className="text-[11px] text-surface-variant mt-1 font-medium">
                    {activeSlideData.author}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Multi-Slide Navigation & Progress */}
          <div className="relative z-10 pt-4">
            {/* Progress Bar Indicator */}
            <div className="w-full bg-surface-container-highest/20 h-1 rounded-full overflow-hidden mb-3">
              <div
                className="bg-primary-container h-full transition-all duration-300"
                style={{ width: `${((currentSlide + 1) / SLIDES.length) * 100}%` }}
              ></div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Slide Switch Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {SLIDES.map((slide, idx) => {
                  const isActive = idx === currentSlide;
                  const label =
                    idx === 0
                      ? '01 真题PDF解析'
                      : idx === 1
                      ? '02 全景漫游与平移'
                      : '03 诚信作答辅助';
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSlide(idx)}
                      className={`px-3 py-1.5 rounded-full text-left font-mono text-[11px] transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-primary-container text-on-primary font-medium shadow-sm'
                          : 'bg-surface-container-highest/20 text-surface-variant hover:text-inverse-on-surface'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Arrow Controls */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  aria-label="上一项"
                  onClick={handlePrevSlide}
                  className="w-8 h-8 rounded-full bg-surface-container-highest/20 hover:bg-surface-container-highest/40 flex items-center justify-center text-inverse-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  aria-label="下一项"
                  onClick={handleNextSlide}
                  className="w-8 h-8 rounded-full bg-surface-container-highest/20 hover:bg-surface-container-highest/40 flex items-center justify-center text-inverse-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Authentication Workstation Card */}
        <div className="w-full lg:w-[46%] flex flex-col justify-between bg-surface-container-lowest rounded-3xl p-6 sm:p-8 lg:p-12 shadow-2xl relative border border-surface-container/60">
          {/* Top Utilities Bar: Cluster & Help & Close */}
          <div className="flex items-center justify-between w-full pb-3 border-b border-surface-container/60">
            <div className="inline-flex items-center gap-1.5 text-on-surface-variant text-[12px] font-medium">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span>生产集群: 华东教育节点 v2.4-stable</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[12px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">language</span>
                <span>简体中文</span>
              </button>
              <a
                href="#help"
                onClick={(e) => {
                  e.preventDefault();
                  setInfoNotice('ExamCraft AI 支持标准题库接入、LaTeX双栏试卷渲染、多端数据同步。');
                }}
                className="inline-flex items-center gap-1 text-[12px] text-on-surface-variant hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">help</span>
                <span>考务帮助</span>
              </a>
              {allowGuest && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                  title="关闭"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Center Wrapper: Main Form */}
          <div className="w-full max-w-md mx-auto my-auto py-4 sm:py-6">
            {/* Header Brand Identity */}
            <div className="mb-5 sm:mb-6">
              <div className="inline-flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface">
                  ExamCraft AI
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
                下一代智能组卷与沉浸式在线答题系统
              </p>
            </div>

            {/* Mode Switch: Segmented Control Tabs */}
            <div className="w-full bg-surface-container p-1 rounded-xl flex items-center gap-1 mb-5">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg('');
                  setInfoNotice('');
                }}
                className={`flex-1 py-2 text-center rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  tab === 'login'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                账号登录 (Sign In)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg('');
                  setInfoNotice('');
                }}
                className={`flex-1 py-2 text-center rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  tab === 'register'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                免费注册 (Sign Up)
              </button>
            </div>

            {/* Fast University & Social Auth */}
            <div className="space-y-2 mb-5">
              <button
                type="button"
                onClick={handleCarsiSSO}
                className="w-full h-10 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center justify-between transition-colors shadow-xs group cursor-pointer border border-surface-container"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-primary">account_balance</span>
                  <span className="text-xs sm:text-sm font-medium">校园网统一认证 (CARSI / EduID)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-mono text-[10px] font-semibold">
                  高校推荐
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleWechatLogin}
                  className="h-9 px-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center justify-center gap-2 transition-colors cursor-pointer border border-surface-container text-xs font-medium"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">qr_code_scanner</span>
                  <span>微信扫码登录</span>
                </button>
                <button
                  type="button"
                  onClick={handleGithubLogin}
                  className="h-9 px-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center justify-center gap-2 transition-colors cursor-pointer border border-surface-container text-xs font-medium"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface">terminal</span>
                  <span>GitHub 授权</span>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4 sm:my-5">
              <div className="w-full h-px bg-surface-container-high"></div>
              <span className="absolute px-3 bg-surface-container-lowest font-mono text-[11px] text-outline">
                或使用账号 / 手机号登录
              </span>
            </div>

            {/* Notification & Alerts */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs flex items-center gap-2 animate-shake">
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <span>{errorMsg}</span>
              </div>
            )}
            {infoNotice && (
              <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0">info</span>
                <span>{infoNotice}</span>
              </div>
            )}

            {/* Main Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Input 1: Identity / Email / Username */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface" htmlFor="identity-input">
                  账号 / 邮箱 / 学工号
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                    person
                  </span>
                  <input
                    id="identity-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="teacher@university.edu.cn 或手机号"
                    required
                    disabled={isLoading}
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all border border-surface-container"
                  />
                </div>
              </div>

              {/* Input 2: Password or SMS Code */}
              {!isOtpMode ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-on-surface" htmlFor="password-input">
                      登录密码
                    </label>
                    {tab === 'login' && (
                      <button
                        type="button"
                        onClick={() => setInfoNotice('请联系考务管理员或使用校园 CARSI 授权重置凭据')}
                        className="text-[11px] text-primary hover:text-primary-container transition-colors cursor-pointer"
                      >
                        忘记密码？
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                      lock
                    </span>
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={tab === 'register' ? '设置登录密码（至少 6 位）' : '••••••••••••'}
                      required
                      disabled={isLoading}
                      className="w-full h-10 pl-9 pr-10 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all border border-surface-container"
                    />
                    <button
                      type="button"
                      aria-label="显示/隐藏密码"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-outline hover:text-on-surface cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-on-surface">
                    短信验证码
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                      sms
                    </span>
                    <input
                      type="text"
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value)}
                      placeholder="请输入 6 位动态验证码"
                      required
                      disabled={isLoading}
                      className="w-full h-10 pl-9 pr-24 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all border border-surface-container"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSmsCode('886622');
                        setInfoNotice('【模拟验证码】已为您填入测试验证码：886622');
                      }}
                      className="absolute right-2 px-2.5 py-1 text-[11px] rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-medium cursor-pointer"
                    >
                      获取验证码
                    </button>
                  </div>
                </div>
              )}

              {/* Extra Register Fields */}
              {tab === 'register' && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-on-surface">
                      确认密码
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                        lock_reset
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="请再次输入登录密码"
                        required
                        disabled={isLoading}
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all border border-surface-container"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-on-surface">身份角色</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label
                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                          role === 'teacher'
                            ? 'bg-primary/5 border-primary text-primary font-semibold'
                            : 'bg-surface-container-low border-surface-container text-on-surface'
                        }`}
                      >
                        <input
                          type="radio"
                          name="user-role"
                          value="teacher"
                          checked={role === 'teacher'}
                          onChange={() => setRole('teacher')}
                          className="text-primary focus:ring-primary"
                        />
                        <span className="text-xs">教师 / 考务组</span>
                      </label>
                      <label
                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                          role === 'student'
                            ? 'bg-primary/5 border-primary text-primary font-semibold'
                            : 'bg-surface-container-low border-surface-container text-on-surface'
                        }`}
                      >
                        <input
                          type="radio"
                          name="user-role"
                          value="student"
                          checked={role === 'student'}
                          onChange={() => setRole('student')}
                          className="text-primary focus:ring-primary"
                        />
                        <span className="text-xs">考生 / 学生</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* Options Row: Remember & Security Assurance */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-primary focus:ring-primary bg-surface-container border-surface-container"
                  />
                  <span className="text-xs text-on-surface-variant font-medium">
                    记住此设备 (30天内免登录)
                  </span>
                </label>
                <div className="inline-flex items-center gap-1 font-mono text-[11px] text-secondary font-medium">
                  <span className="material-symbols-outlined text-[13px]">shield</span>
                  TLS 1.3 金融级加密
                </div>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] mt-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    <span>认证处理中...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      {tab === 'login' ? 'login' : 'how_to_reg'}
                    </span>
                    <span>
                      {tab === 'login'
                        ? '立即登录并进入工作台 (Enter Workstation)'
                        : '创建新账号并配置考务环境 (Create Workspace)'}
                    </span>
                  </>
                )}
              </button>

              {/* Alternative Quick Mode Link */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsOtpMode(!isOtpMode)}
                  className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">sms</span>
                  <span>
                    {isOtpMode
                      ? '返回使用账号密码登录'
                      : '切换为手机短信验证码快捷登录'}
                  </span>
                </button>
              </div>

              {/* Direct Guest Mode Link */}
              {allowGuest && (
                <div className="pt-2 text-center border-t border-surface-container/60">
                  <button
                    type="button"
                    onClick={() => {
                      if (onGuest) onGuest();
                      if (onClose) onClose();
                    }}
                    className="text-xs text-primary hover:text-primary-container hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>免登录 · 立即体验全真考场直通 (Guest Mode)</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Bottom Disclaimer / Compliance Footer */}
          <div className="w-full text-center pt-3 border-t border-surface-container/50">
            <p className="text-[11px] text-outline">
              登录即代表您已同意{' '}
              <a
                href="#terms"
                onClick={(e) => {
                  e.preventDefault();
                  setInfoNotice('已阅读《用户服务协议》：平台保障学术考试数据完整性与高可用。');
                }}
                className="text-on-surface-variant underline hover:text-primary"
              >
                《用户服务协议》
              </a>{' '}
              与{' '}
              <a
                href="#privacy"
                onClick={(e) => {
                  e.preventDefault();
                  setInfoNotice('已阅读《AI辅助考场学术诚信与隐私规范》：严禁任何作弊行为，全流程加密。');
                }}
                className="text-on-surface-variant underline hover:text-primary"
              >
                《AI辅助考场学术诚信与隐私规范》
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
