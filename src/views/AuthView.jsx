import React, { useState, useEffect, useRef } from 'react';
import {
  apiLogin,
  apiRegister,
  apiForgotPassword,
  apiVerifyResetToken,
  apiResetPassword
} from '../utils/auth';

const SLIDES = [
  {
    num: "MODULE 01 / 03",
    category: "多模态试卷重构",
    title: "1:1 完整真题 PDF 原样精确克隆与排版解析",
    desc: "支持直接导入历年期末或考研真题 PDF 试卷，多模态大模型即刻原位提取数学公式、题型分值结构与双栏排版。",
    filename: "高等数学期末统考真题卷.pdf",
    statusTag: "双栏题型版面原位还原",
    nodeLabel: "PARSE NODE: 微积分与微分方程综合题",
    confidence: "LaTeX 公式置信度 99.8%",
    formula: "$$ \\lim_{x \\to 0} \\frac{\\int_0^x \\sin(t^2)\\,dt}{x^3} = \\frac{1}{3} \\quad \\implies \\quad \\nabla^2 \\Phi + \\lambda_k \\Phi = 0 $$",
    metaItems: [
      { label: "试题分值", value: "12 分", valueClass: "text-inverse-on-surface" },
      { label: "评分断点", value: "4 个步骤采分点", valueClass: "text-secondary-fixed-dim" },
      { label: "排版规范", value: "标准 LaTeX 双栏印刷体", valueClass: "text-primary-fixed-dim" }
    ],
    highlights: [
      { icon: "view_column", title: "双栏印刷原位排版", desc: "保留大题排版与公式图表位置，避免题型格式错位" },
      { icon: "speed", title: "分步断点智能采分", desc: "多模态模型自动划分采分节点，解答题按步骤客观给分" },
      { icon: "precision_manufacturing", title: "公式高清还原", desc: "数学符号与微积分公式无损转为标准可编辑 LaTeX 格式" }
    ],
    tags: ["#数学公式LaTeX还原", "#智能分步给分", "#全真双栏印刷排版", "#PDF多模态解析"],
    note: "支持将历年试卷与参考答案直接拖拽导入，系统自动拆解大题题型与选项结构，快速复原为高拟真数字考卷。"
  },
  {
    num: "MODULE 02 / 03",
    category: "沉浸式答题界面",
    title: "大试卷全景漫游模式与空格物理平移手势",
    desc: "无限画布自由缩放拖拽，支持题卡任意位置公式批注与分屏草稿本，还原高拟真考场心流体验。",
    filename: "大学物理与力学综合考评卷.pdf",
    statusTag: "物理快捷手势漫游",
    nodeLabel: "CANVAS NODE: 无限大试卷画布与平移手势",
    confidence: "手势交互延时 < 16ms",
    formula: "快捷交互：按住 [空格键] 拖拽画布 · 滚轮双指 25%~400% 无级缩放 · 随题草稿本实时公式推演",
    metaItems: [
      { label: "缩放范围", value: "25% ~ 400%", valueClass: "text-inverse-on-surface" },
      { label: "漫游体验", value: "整卷全景一览无余", valueClass: "text-secondary-fixed-dim" },
      { label: "智能草稿", value: "独立随题云端漫游", valueClass: "text-primary-fixed-dim" }
    ],
    highlights: [
      { icon: "pan_tool", title: "按住空格极速平移", desc: "大试卷物理手势自由漫游，双指与滚轮 25%~400% 顺滑缩放" },
      { icon: "edit_note", title: "分屏便签随题草稿", desc: "每一道题目配备专属草稿纸，随时记录公式推导与思路备忘" },
      { icon: "cloud_sync", title: "作答状态实时持久化", desc: "作答记录与草稿笔记实时云端漫游，切题或断网永不丢失" }
    ],
    tags: ["#无限画布漫游", "#手势平移", "#草稿本双屏同显", "#全景大试卷心流"],
    note: "打破传统单题死板翻页模式，采用整卷全景漫游画卷，考生可在全局与细节之间自如缩放，掌控答题节奏。"
  },
  {
    num: "MODULE 03 / 03",
    category: "智能评阅与学情诊断",
    title: "多维智能批阅与全卷学情诊断分析报告",
    desc: "客观题标准答案毫秒比对，主观解答题多步骤踩分复核，交卷后即时输出雷达图与薄弱知识点提分动作建议。",
    filename: "计算机算法与数据结构期末考试卷.pdf",
    statusTag: "客观智能全卷复核",
    nodeLabel: "EVALUATE NODE: 步骤推导溯源与学情雷达",
    confidence: "评阅规范 100% 覆盖",
    formula: "全卷总评：考点掌握度雷达图 · 典型错因定位 · 专项举一反三提分行动建议",
    metaItems: [
      { label: "评阅机制", value: "分步踩分客观核验", valueClass: "text-inverse-on-surface" },
      { label: "诊断报告", value: "雷达分析与薄弱点", valueClass: "text-secondary-fixed-dim" },
      { label: "复习闭环", value: "错题集一键重考", valueClass: "text-primary-fixed-dim" }
    ],
    highlights: [
      { icon: "assignment_turned_in", title: "客观步骤智能评分", desc: "大模型结合考生最终答案与草稿推演，按步骤给出合理分数" },
      { icon: "insights", title: "全卷学情雷达诊断", desc: "多维度量化概念掌握度、计算准确率与时间分配策略" },
      { icon: "collections_bookmark", title: "错题智能归纳沉淀", desc: "自动收录错题至错题本，支持智能组卷进行举一反三专项巩固" }
    ],
    tags: ["#多维学情诊断", "#错题智能收录", "#分步推理踩分", "#专项举一反三"],
    note: "交卷后无需漫长等待，AI 阅卷引擎即刻生成全卷诊断报告，清晰指出失分原因并规划针对性复习路径。"
  }
];

export default function AuthView({
  onSuccess,
  onGuest,
  onBack,
  allowBack = false
}) {
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('teacher'); // 'teacher' | 'student'
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Password reset specific state
  const [resetToken, setResetToken] = useState('');
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotSuccessInfo, setForgotSuccessInfo] = useState(null);

  // Carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // 监听 URL 携带的重置参数（支持 ?token=xxx 或 #/login?mode=reset&token=xxx）
    try {
      const fullUrl = window.location.href;
      let searchParamsString = window.location.search;
      const hashIndex = fullUrl.indexOf('#');
      if (hashIndex !== -1) {
        const hashPart = fullUrl.slice(hashIndex);
        const qIndex = hashPart.indexOf('?');
        if (qIndex !== -1) {
          searchParamsString = hashPart.slice(qIndex);
        }
      }
      const params = new URLSearchParams(searchParamsString);
      const tokenParam = params.get('token');
      const modeParam = params.get('mode');

      if (tokenParam) {
        setResetToken(tokenParam);
        setTab('reset');
        setIsLoading(true);
        apiVerifyResetToken(tokenParam)
          .then((res) => {
            if (res.user) setResetTargetUser(res.user);
          })
          .catch((err) => {
            setErrorMsg(err.message || '重置凭证无效或已过期，请重新申请');
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else if (modeParam === 'forgot') {
        setTab('forgot');
      }
    } catch {}
  }, []);

  useEffect(() => {
    const startTimer = () => {
      timerRef.current = setInterval(() => {
        handleNextSlide();
      }, 6500);
    };

    startTimer();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
    setSuccessMsg('');

    // 1. 找回密码申请模式
    if (tab === 'forgot') {
      const cleanIdentity = username.trim();
      if (!cleanIdentity) {
        setErrorMsg('请输入注册用户名或邮箱');
        return;
      }
      setIsLoading(true);
      try {
        const data = await apiForgotPassword(cleanIdentity);
        setForgotSuccessInfo({
          message: data.message,
          resetUrl: data.resetUrl,
          username: cleanIdentity
        });
        setSuccessMsg(data.message || '重置邮件已分发，请查收！');
      } catch (err) {
        setErrorMsg(err.message || '申请重置密码失败，请核对账号信息');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 2. 动态重置新密码模式
    if (tab === 'reset') {
      if (!resetToken) {
        setErrorMsg('缺少有效重置凭证，请从邮件链接重新进入');
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        setErrorMsg('新密码长度不能少于 6 位');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setErrorMsg('两次输入的新密码不一致');
        return;
      }
      setIsLoading(true);
      try {
        await apiResetPassword(resetToken, newPassword);
        setSuccessMsg('🎉 密码重置成功！正在为您自动登录...');
        const targetUsername = resetTargetUser?.username || username;
        if (targetUsername) {
          try {
            const user = await apiLogin(targetUsername, newPassword);
            setTimeout(() => {
              if (onSuccess) onSuccess(user);
            }, 1000);
            return;
          } catch {}
        }
        setTimeout(() => {
          setTab('login');
          setNewPassword('');
          setConfirmNewPassword('');
          setSuccessMsg('密码已修改成功，请使用新密码登录');
        }, 1200);
      } catch (err) {
        setErrorMsg(err.message || '重置密码失败，链接可能已过期');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 3. 正常登录与注册模式
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMsg('请输入用户名或邮箱');
      return;
    }

    if (!password) {
      setErrorMsg('请输入登录密码');
      return;
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
        user = await apiLogin(cleanUsername, password);
      } else {
        user = await apiRegister(cleanUsername, password, role);
      }
      if (rememberMe) {
        try {
          localStorage.setItem('examcraft_remember_device', 'true');
        } catch {}
      }
      if (onSuccess) onSuccess(user);
    } catch (err) {
      setErrorMsg(err.message || '认证失败，请检查账号密码');
    } finally {
      setIsLoading(false);
    }
  };

  const activeSlideData = SLIDES[currentSlide];

  return (
    <div className="w-full min-h-screen bg-surface text-on-surface flex flex-col justify-center items-stretch p-3 sm:p-4 lg:p-5 xl:p-6 selection:bg-primary-container selection:text-on-primary-container animate-fade-in">
      <div className="w-full flex-1 flex flex-col lg:flex-row items-stretch justify-between gap-4 lg:gap-5 xl:gap-6 my-auto">
        {/* LEFT COLUMN: Showcase & Feature Walkthrough Carousel (Large & Expansive) */}
        <div className="w-full lg:flex-1 flex flex-col justify-between rounded-3xl bg-inverse-surface text-inverse-on-surface p-6 sm:p-8 lg:p-9 xl:p-11 relative overflow-hidden shadow-2xl min-h-[580px] lg:min-h-0">
          {/* Subtle Ambient Lighting Blobs */}
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-container/20 blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-surface-tint/15 blur-2xl pointer-events-none"></div>

          {/* Top Row: Brand & Product Features Indicator */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-highest/15 backdrop-blur-md border border-white/10">
              <span className="inline-block w-2 h-2 rounded-full bg-secondary-container animate-pulse"></span>
              <span className="font-mono text-[11px] tracking-wide text-inverse-primary uppercase font-medium">
                ExamCraft AI Workbench
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-surface-variant text-[12px] font-medium">
              <span className="material-symbols-outlined text-[16px] text-secondary-fixed">auto_fix_high</span>
              <span>双入口智能组卷 · 原卷解析 · 在线考练</span>
            </div>
          </div>

          {/* Main Carousel Slider Content */}
          <div className="relative z-10 my-auto py-4 sm:py-6">
            <div
              className={`transition-all duration-200 transform ${
                isFading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
              }`}
            >
              {/* Slide Title & Description */}
              <div className="space-y-2.5 mb-5 sm:mb-6">
                <div className="inline-flex items-center gap-2 text-primary-fixed-dim font-mono text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-primary-container/40 font-semibold">{activeSlideData.num}</span>
                  <span className="text-surface-dim text-[12px]">{activeSlideData.category}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-[34px] xl:text-[38px] font-semibold text-inverse-on-surface tracking-tight leading-tight">
                  {activeSlideData.title}
                </h2>
                <p className="text-sm sm:text-base xl:text-lg text-surface-dim max-w-3xl leading-relaxed">
                  {activeSlideData.desc}
                </p>
              </div>

              {/* Feature Mockup Glass Card */}
              <div className="relative rounded-2xl bg-surface-container-lowest/10 backdrop-blur-lg p-5 sm:p-6 xl:p-7 shadow-2xl space-y-4 border border-white/10">
                {/* Mockup Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-primary-fixed text-[22px] shrink-0">
                      picture_as_pdf
                    </span>
                    <span className="font-mono text-xs sm:text-sm text-surface-bright font-medium truncate max-w-[280px] sm:max-w-xl">
                      {activeSlideData.filename}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/20 text-secondary-fixed font-mono text-[11px] shrink-0 font-medium">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    {activeSlideData.statusTag}
                  </span>
                </div>

                {/* Formula / Interactive Simulation Block */}
                <div className="rounded-xl bg-inverse-surface/90 p-4 space-y-2.5 border border-white/5 shadow-inner">
                  <div className="flex items-center justify-between text-surface-dim font-mono text-[11px]">
                    <span className="truncate pr-2 font-medium">{activeSlideData.nodeLabel}</span>
                    <span className="text-secondary-fixed font-mono shrink-0">{activeSlideData.confidence}</span>
                  </div>

                  <div className="font-mono text-xs sm:text-sm xl:text-base text-inverse-primary bg-surface-container-highest/10 p-3.5 rounded-lg overflow-x-auto leading-relaxed border border-white/5">
                    {activeSlideData.formula}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-surface-variant text-[11px] sm:text-xs pt-1">
                    {activeSlideData.metaItems.map((item, idx) => (
                      <span key={idx}>
                        {item.label}: <strong className={item.valueClass}>{item.value}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Intelligent Capability Highlights Grid */}
                {activeSlideData.highlights && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {activeSlideData.highlights.map((h, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-surface-container-highest/10 border border-white/5 backdrop-blur-sm space-y-1 hover:bg-surface-container-highest/15 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary-fixed-dim text-[18px]">
                            {h.icon}
                          </span>
                          <span className="text-xs font-semibold text-inverse-on-surface">
                            {h.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-surface-dim leading-snug line-clamp-2">
                          {h.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

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

              {/* Functional Explanation Note Card */}
              <div className="mt-4 rounded-xl bg-surface-container-highest/10 p-3.5 sm:p-4 backdrop-blur-sm flex items-start gap-3 border border-white/5">
                <span className="material-symbols-outlined text-primary-fixed-dim text-[20px] shrink-0 mt-0.5">
                  info
                </span>
                <div>
                  <p className="text-xs sm:text-sm text-inverse-on-surface leading-snug">
                    {activeSlideData.note}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Multi-Slide Navigation & Progress */}
          <div className="relative z-10 pt-3">
            {/* Progress Bar Indicator */}
            <div className="w-full bg-surface-container-highest/20 h-1.5 rounded-full overflow-hidden mb-3">
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
                      : '03 智能评阅诊断';
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSlide(idx)}
                      className={`px-3.5 py-1.5 rounded-full text-left font-mono text-[11px] transition-all duration-200 cursor-pointer ${
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

        {/* RIGHT COLUMN: Authentication Workstation Card (Slimmer & Focused) */}
        <div className="w-full lg:w-[400px] xl:w-[430px] shrink-0 flex flex-col justify-between bg-surface-container-lowest rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-surface-container/60 min-h-[580px] lg:min-h-0">
          {/* Top Utilities: Back Button if available */}
          <div className="flex items-center justify-end w-full pb-2 min-h-[32px]">
            {allowBack && onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer border border-surface-container"
                title="返回工作台"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>返回工作台</span>
              </button>
            )}
          </div>

          {/* Center Wrapper: Main Form */}
          <div className="w-full mx-auto my-auto py-2">
            {/* Header Identity according to mode */}
            {tab === 'forgot' ? (
              <div className="flex items-center gap-2.5 mb-5 pb-2 border-b border-surface-container">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                    setForgotSuccessInfo(null);
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  title="返回登录"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                <div>
                  <h1 className="text-xl font-bold text-on-surface">找回密码</h1>
                  <p className="text-[11px] text-on-surface-variant font-medium">以 ExamCraft 专属服务分发重置链接</p>
                </div>
              </div>
            ) : tab === 'reset' ? (
              <div className="flex items-center gap-2.5 mb-5 pb-2 border-b border-surface-container">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">key</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-on-surface">重置登录密码</h1>
                  <p className="text-[11px] text-on-surface-variant font-medium">
                    {resetTargetUser?.username ? `为用户 ${resetTargetUser.username} 设置新密码` : '验证有效，请设置新登录密码'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-5">
                <div className="inline-flex items-center gap-2.5 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
                    <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-on-surface">
                    ExamCraft AI
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
                  智能组卷与在线考练工作台
                </p>
              </div>
            )}

            {/* Mode Switch: Segmented Control Tabs (Only in login/register modes) */}
            {(tab === 'login' || tab === 'register') && (
              <div className="w-full bg-surface-container p-1 rounded-xl flex items-center gap-1 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMsg('');
                    setSuccessMsg('');
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
                    setSuccessMsg('');
                  }}
                  className={`flex-1 py-2 text-center rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    tab === 'register'
                      ? 'bg-surface-container-lowest text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  新用户注册 (Sign Up)
                </button>
              </div>
            )}

            {/* Notification & Alerts */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs flex items-center gap-2 animate-shake">
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
                <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
                <span>{successMsg}</span>
              </div>
            )}

            {/* VIEW MODE 1: FORGOT PASSWORD */}
            {tab === 'forgot' ? (
              forgotSuccessInfo ? (
                <div className="space-y-4 py-1">
                  <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container-high space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary text-[28px] shrink-0 mt-0.5">
                        mark_email_read
                      </span>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-on-surface">密码重置邮件已分发！</h3>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          系统已向目标账号 <strong className="text-on-surface">{forgotSuccessInfo.username}</strong> 生成包含专属重置凭证的动态邮件。
                        </p>
                      </div>
                    </div>

                    {/* SPAM REMINDER CALLOUT */}
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="material-symbols-outlined text-[18px]">folder_special</span>
                        <span>特别提示：请务必检查【垃圾箱】</span>
                      </div>
                      <p className="text-[11px] opacity-90">
                        本邮件由 ExamCraft AI 自动化系统直接派发（未经外部商业企业认证），公共邮箱极大概率会将其自动归入<strong>【垃圾邮件】或【垃圾箱】</strong>，请前往垃圾箱查阅并点击动态链接重置。
                      </p>
                    </div>

                    {/* Dev/Local Shortcut if available */}
                    {forgotSuccessInfo.resetUrl && (
                      <div className="pt-1">
                        <a
                          href={forgotSuccessInfo.resetUrl}
                          className="w-full py-2 px-3 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                          <span>前往重置页面 (直达链接)</span>
                        </a>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotSuccessInfo(null);
                      setTab('login');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="w-full h-10 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold transition-colors cursor-pointer"
                  >
                    返回账号登录
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-on-surface" htmlFor="forgot-identity-input">
                      用户名 / 注册邮箱
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                        mail
                      </span>
                      <input
                        id="forgot-identity-input"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入注册用户名或邮箱"
                        required
                        disabled={isLoading}
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all border border-surface-container"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-container-low text-[11px] text-on-surface-variant leading-relaxed">
                    💡 提示：提交后系统将以 ExamCraft 官方身份直接向该账号派发时效为 15 分钟的专属重置凭证。若在收件箱中未看到，请特别留意查收<strong>【垃圾箱】</strong>。
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <span className="material-symbols-outlined text-[18px] animate-spin">
                          progress_activity
                        </span>
                        <span>正在生成并发送...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        <span>发送重置密码邮件</span>
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setTab('login');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                    >
                      想起密码了？返回登录
                    </button>
                  </div>
                </form>
              )
            ) : tab === 'reset' ? (
              /* VIEW MODE 2: DYNAMIC RESET PASSWORD */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-on-surface" htmlFor="reset-new-password">
                    设置新密码
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                      lock
                    </span>
                    <input
                      id="reset-new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="设置新密码（至少 6 位）"
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

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-on-surface" htmlFor="reset-confirm-password">
                    确认新密码
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                      lock_reset
                    </span>
                    <input
                      id="reset-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="再次输入新密码"
                      required
                      disabled={isLoading}
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all border border-surface-container"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                      <span>正在更新密码...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>确认修改并立即登录</span>
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setTab('login');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-xs text-on-surface-variant hover:text-on-surface hover:underline font-semibold cursor-pointer"
                  >
                    放弃并返回登录
                  </button>
                </div>
              </form>
            ) : (
              /* VIEW MODE 3: LOGIN / REGISTER */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Input 1: Identity / Email / Username */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-on-surface" htmlFor="identity-input">
                    用户名 / 邮箱
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
                      placeholder="请输入用户名或注册邮箱"
                      required
                      disabled={isLoading}
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:outline-none transition-all border border-surface-container"
                    />
                  </div>
                </div>

                {/* Input 2: Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-on-surface" htmlFor="password-input">
                    登录密码
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                      lock
                    </span>
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={tab === 'register' ? '设置登录密码（至少 6 位）' : '请输入登录密码'}
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
                      <label className="block text-xs font-semibold text-on-surface">身份类型</label>
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
                          <span className="text-xs">教师 / 考务</span>
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

                {/* Options Row: Remember login state & Forgot Password */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary bg-surface-container border-surface-container"
                    />
                    <span className="text-xs text-on-surface-variant font-medium">
                      记住登录状态
                    </span>
                  </label>

                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setTab('forgot');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-xs text-primary hover:text-primary-container hover:underline font-semibold cursor-pointer"
                    >
                      忘记密码？
                    </button>
                  )}
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
                      <span>处理中...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">
                        {tab === 'login' ? 'login' : 'how_to_reg'}
                      </span>
                      <span>
                        {tab === 'login' ? '立即登录' : '创建账号并开启云端体验'}
                      </span>
                    </>
                  )}
                </button>

                {/* Direct Guest Mode Link */}
                <div className="pt-3 text-center border-t border-surface-container/60">
                  <button
                    type="button"
                    onClick={() => {
                      if (onGuest) onGuest();
                    }}
                    className="text-xs text-primary hover:text-primary-container hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>免登录 · 立即以离线游客身份体验</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Clean Footer */}
          <div className="w-full text-center pt-3 border-t border-surface-container/50">
            <p className="text-[11px] text-outline">
              ExamCraft AI Workbench · 数据加密隔离存储
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
