export const INITIAL_PAPERS = [
  {
    id: "paper-math-2024a",
    title: "《2024届全国高等数学期末统考试卷A》",
    source: "1:1 真题复刻 (PDF导入)",
    sourceType: "clone",
    date: "2025-02-28 14:30",
    starred: true,
    category: "高校期末",
    questionCount: 23,
    totalScore: 100,
    duration: 120,
    difficulty: 4,
    tags: ["#大一上期末", "#微积分核心", "#含AI步骤标注"],
    note: "重点关注第16题分部积分与第21题级数收敛性证明（已完成复盘）",
    status: "已就绪",
    typeBreakdown: { choices: 8, blanks: 5, solutions: 4 }
  },
  {
    id: "paper-ode-04",
    title: "《微分方程与多元函数微积分专项冲刺卷 #04》",
    source: "自由规格智能生成",
    sourceType: "custom",
    date: "2025-02-26 18:20",
    starred: false,
    category: "考研真题",
    questionCount: 16,
    totalScore: 100,
    duration: 90,
    difficulty: 5,
    tags: ["#考研强化", "#微分方程", "#压轴题专练"],
    note: "考研数学一真题同构变式，强化洛必达与泰勒展开综合应用",
    status: "未作答 (全新排版完毕)",
    typeBreakdown: { choices: 8, blanks: 4, solutions: 4 }
  },
  {
    id: "paper-math-kaoyan-2023",
    title: "《2023年全国硕士研究生入学考试数学一统考真题》",
    source: "1:1 真题复刻 (PDF导入)",
    sourceType: "clone",
    date: "2025-02-20 09:15",
    starred: true,
    category: "考研真题",
    questionCount: 23,
    totalScore: 150,
    duration: 180,
    difficulty: 5,
    tags: ["#国家统考", "#数学一真题", "#标准全真排版"],
    note: "教育部命题中心原版试卷克隆，包含答题卡扫描比对与标答步进拆分",
    status: "已完成复评",
    typeBreakdown: { choices: 10, blanks: 6, solutions: 7 }
  },
  {
    id: "paper-linalg-matrix",
    title: "《线性代数矩阵运算与特征值特训卷》",
    source: "自由规格智能生成",
    sourceType: "custom",
    date: "2025-02-18 20:00",
    starred: false,
    category: "章节小测",
    questionCount: 18,
    totalScore: 100,
    duration: 75,
    difficulty: 4,
    tags: ["#特征值分解", "#二次型正定性", "#秩与方程组"],
    note: "自动聚类错因较多的施密特正交化算法推导题",
    status: "未作答 (待强化)",
    typeBreakdown: { choices: 8, blanks: 6, solutions: 4 }
  }
];

export const MOCK_EXAM_QUESTIONS = [
  {
    id: 1,
    num: "01",
    type: "单项选择题",
    score: 5,
    section: "一、选择题",
    prompt: "设函数 f(x) 在 x=0 处连续，且 lim_{x→0} [f(x)/x] = 2，则下列结论正确的是：",
    options: [
      { key: "A", text: "f(0) = 0 且 f'(0) = 2" },
      { key: "B", text: "f(0) = 2 且 f'(0) = 0" },
      { key: "C", text: "f(x) 在 x=0 处不可导" },
      { key: "D", text: "f'(0) 存在但值不确定" }
    ],
    userAnswer: "A",
    standardAnswer: "A",
    status: "answered"
  },
  {
    id: 2,
    num: "02",
    type: "单项选择题",
    score: 5,
    section: "一、选择题",
    prompt: "极限 lim_{x → 0} \\frac{\\sin x - x}{x^3} 的计算值等于下列哪个选项？",
    options: [
      { key: "A", text: "-1/6" },
      { key: "B", text: "1/6" },
      { key: "C", text: "-1/3" },
      { key: "D", text: "0" }
    ],
    userAnswer: "A",
    standardAnswer: "A",
    status: "answered"
  },
  {
    id: 3,
    num: "03",
    type: "单项选择题",
    score: 5,
    section: "一、选择题",
    prompt: "若向量组 α₁, α₂, α₃ 线性无关，向量 β 可由其线性表出，则下列必线性相关的是：",
    options: [
      { key: "A", text: "α₁, α₂, α₃, β" },
      { key: "B", text: "α₁ + β, α₂ + β, α₃ + β" },
      { key: "C", text: "α₁ - α₂, α₂ - α₃, α₃ - α₁" },
      { key: "D", text: "α₁, α₂" }
    ],
    userAnswer: "A",
    standardAnswer: "A",
    status: "answered"
  },
  {
    id: 4,
    num: "04",
    type: "单项选择题",
    score: 5,
    section: "一、选择题",
    prompt: "设随机变量 X ~ N(0, 1)，记 Φ(x) 为标准正态分布函数，则 P{|X| > 1.96} 等于：",
    options: [
      { key: "A", text: "2[1 - Φ(1.96)] ≈ 0.05" },
      { key: "B", text: "Φ(1.96) ≈ 0.975" },
      { key: "C", text: "1 - Φ(1.96) ≈ 0.025" },
      { key: "D", text: "2Φ(1.96) - 1 ≈ 0.95" }
    ],
    userAnswer: "",
    standardAnswer: "A",
    status: "unanswered"
  },
  {
    id: 5,
    num: "05",
    type: "单项选择题",
    score: 5,
    section: "一、选择题",
    prompt: "下列级数中，条件收敛的是：",
    options: [
      { key: "A", text: "∑_{n=1}^∞ (-1)^n / n" },
      { key: "B", text: "∑_{n=1}^∞ (-1)^n / n²" },
      { key: "C", text: "∑_{n=1}^∞ 1 / n" },
      { key: "D", text: "∑_{n=1}^∞ (-1)^n / √n³" }
    ],
    userAnswer: "A",
    standardAnswer: "A",
    status: "answered"
  },
  {
    id: 6,
    num: "06",
    type: "单项选择题",
    score: 5,
    section: "一、选择题",
    prompt: "已知方阵 A 满足 A² - 3A + 2E = 0，则 (A - E) 的逆矩阵等于：",
    options: [
      { key: "A", text: "A - 2E" },
      { key: "B", text: "2E - A" },
      { key: "C", text: "A + E" },
      { key: "D", text: "不存在" }
    ],
    userAnswer: "",
    standardAnswer: "A",
    status: "unanswered"
  },
  {
    id: 7,
    num: "07",
    type: "单项选择题",
    score: 5,
    section: "一、选择题",
    prompt: "曲线 y = x³ - 3x 的拐点坐标为：",
    options: [
      { key: "A", text: "(0, 0)" },
      { key: "B", text: "(1, -2)" },
      { key: "C", text: "(-1, 2)" },
      { key: "D", text: "(√3, 0)" }
    ],
    userAnswer: "A",
    standardAnswer: "A",
    status: "answered"
  },
  {
    id: 8,
    num: "08",
    type: "单项选择题",
    score: 5,
    section: "一、选择题",
    prompt: "设二元函数 z = x² + y² - 2x + 4y + 5，则其驻点为：",
    options: [
      { key: "A", text: "(1, -2)" },
      { key: "B", text: "(-1, 2)" },
      { key: "C", text: "(2, -4)" },
      { key: "D", text: "(0, 0)" }
    ],
    userAnswer: "",
    standardAnswer: "A",
    status: "unanswered"
  },
  {
    id: 9,
    num: "09",
    type: "填空题",
    score: 4,
    section: "二、填空题",
    prompt: "已知微分方程 y' - (2/x)y = x³ 满足初值初始条件 y(1) = 2，则其对应 Cauchy 特解表达式为 y(x) = ______。",
    userAnswer: "x^4/2 + (3/2)x^2",
    standardAnswer: "x^4/2 + (3/2)x^2",
    status: "answered"
  },
  {
    id: 10,
    num: "10",
    type: "填空题",
    score: 4,
    section: "二、填空题",
    prompt: "定积分 ∫₀¹ √(1 - x²) dx 的几何计算结果为 ______。",
    userAnswer: "π/4",
    standardAnswer: "π/4",
    status: "answered"
  },
  {
    id: 11,
    num: "11",
    type: "填空题",
    score: 4,
    section: "二、填空题",
    prompt: "设 3 阶方阵 A 的行列式 |A| = -2，则其伴随矩阵的行列式 |A*| = ______。",
    userAnswer: "4",
    standardAnswer: "4",
    status: "answered"
  },
  {
    id: 12,
    num: "12",
    type: "填空题",
    score: 4,
    section: "二、填空题",
    prompt: "若连续型随机变量 X 的概率密度为 f(x) = λ e^{-λ x} (x > 0)，已知 E(X) = 2，则方差 D(X) = ______。",
    userAnswer: "",
    standardAnswer: "4",
    status: "unanswered"
  },
  {
    id: 13,
    num: "13",
    type: "填空题",
    score: 4,
    section: "二、填空题",
    prompt: "幂级数 ∑_{n=1}^∞ (x - 2)^n / n 的收敛半径 R = ______。",
    userAnswer: "",
    standardAnswer: "1",
    status: "unanswered"
  },
  {
    id: 14,
    num: "14",
    type: "综合计算与解答题",
    score: 10,
    section: "三、解答题",
    prompt: "计算二重积分 ∬_D (x + y) dx dy，其中闭区域 D 是由抛物线 y = x² 与直线 y = 2x 所围成。",
    userAnswer: "",
    standardAnswer: "积分区域交点为 (0,0) 与 (2,4)。\n∬_D (x + y) dx dy = ∫₀² dx ∫_{x²}^{2x} (x + y) dy\n内层计算得 [xy + y²/2] 从 y=x² 到 y=2x = 3x² - x³ - x⁴/2\n外层对 x 从 0 到 2 积分得 [x³ - x⁴/4 - x⁵/10] = 8 - 4 - 3.2 = 0.8 = 4/5。",
    status: "unanswered"
  },
  {
    id: 15,
    num: "15",
    type: "综合计算与解答题",
    score: 10,
    section: "三、解答题",
    prompt: "设三阶实对称矩阵 A 拥有特征值 λ₁ = 1, λ₂ = 2, λ₃ = 3，求 |A³ - 2A² + E| 的数值。",
    userAnswer: "",
    standardAnswer: "特征多项式计算得矩阵多项式特征值为 1³-2(1)+1 = 0，因此行列式必然为 0。",
    status: "unanswered"
  },
  {
    id: 16,
    num: "16",
    type: "综合计算与解答题",
    score: 10,
    section: "三、解答题",
    prompt: "求下列不定积分的解析通解：",
    mathExpression: "∫ x² · ln(x + 1) dx",
    condition: "(定义域 x > -1)",
    category: "CALCULUS II",
    difficultyStr: "★★★★☆",
    userAnswer: `原式采用分部积分法：
设 u = ln(x + 1), 则 du = dx / (x + 1)
设 dv = x^2 dx, 则选取 v = x^3 / 3

根据分部积分公式 ∫ u dv = u v - ∫ v du：
原式 = (x^3 / 3) * ln(x + 1) - (1/3) * ∫ (x^3 / (x + 1)) dx

处理有理假分式：
x^3 / (x + 1) = (x^3 + 1 - 1) / (x + 1)
= (x^2 - x + 1) - 1 / (x + 1)

逐项求积分：
∫ (x^2 - x + 1 - 1/(x+1)) dx
= x^3/3 - x^2/2 + x - ln(x+1)

代回合并得到最终结果 (包含常数 C)。`,
    aiTranscription: `\\begin{aligned}
\\int x^2 \\ln(x+1) \\, dx &= \\frac{x^3}{3} \\ln(x+1) - \\frac{1}{3} \\int \\frac{x^3}{x+1} \\, dx \\\\[6pt]
&= \\frac{x^3}{3} \\ln(x+1) - \\frac{1}{3} \\int \\left( x^2 - x + 1 - \\frac{1}{x+1} \\right) dx \\\\[6pt]
&= \\frac{x^3}{3} \\ln(x+1) - \\frac{x^3}{9} + \\frac{x^2}{6} - \\frac{x}{3} + \\frac{1}{3} \\ln(x+1) + C
\\end{aligned}`,
    stepScores: [
      { step: "步骤 1: 准确应用分部积分设元与通式展开", score: "+3分 (已达成)" },
      { step: "步骤 2: 假分式化简长除法分解拆项", score: "+3分 (已达成)" },
      { step: "步骤 3: 逐项定常数积分与常数 C 补齐", score: "+4分 (已达成)" }
    ],
    status: "answered"
  }
];

export const MISTAKE_COLLECTIONS = [
  {
    id: "col-1",
    title: "考研数学核心压轴",
    count: 28,
    active: false,
    icon: "folder"
  },
  {
    id: "col-2",
    title: "高等数学期末易错集",
    count: 35,
    active: true,
    code: "MATH-COLLECTION-35",
    updated: "2 小时前",
    priority: "高优先级复习",
    desc: "收录历次模考与真题中失分解答题与典型易错填空题，已关联标准解析与 AI 步骤判题定位，针对微积分计算死角持续动态重排。",
    icon: "folder_open"
  },
  {
    id: "col-3",
    title: "线性代数特征值与矩阵",
    count: 19,
    active: false,
    icon: "folder"
  },
  {
    id: "col-4",
    title: "概率论大数定律与极限",
    count: 12,
    active: false,
    icon: "folder"
  }
];

export const MISTAKE_ITEMS = [
  {
    id: "m-1",
    num: "题号 16",
    type: "综合解答题",
    score: 10,
    title: "求不定积分的解析通解：",
    formula: "∫ x² · ln(x + 1) dx  (x > -1)",
    source: "2024届全国高等数学期末统考试卷A",
    myDeduction: "-4 分",
    errorReason: "长除法分解假分式时负号分配律错误，导致末项常数项计算失真",
    weakPoint: "微积分 / 有理分式多项式长除积分",
    userWrongAnswer: "I = (x³/3) ln(x+1) - (x³/9) - (x²/6) + (x/3) + C  [符号错]",
    standardAnswer: "I = (1/3) x³ ln(x+1) - (1/9) x³ + (1/6) x² - (1/3) x + (1/3) ln(x+1) + C",
    aiInsight: "考生在处理有理假分式拆解时，将 -1/3 乘入括号时出现负号漏乘。建议加强多项式长除法符号检验，并熟练使用综合除法或因式分解凑项法。"
  },
  {
    id: "m-2",
    num: "题号 02",
    type: "单项选择题",
    score: 5,
    title: "极限计算选项辨析：",
    formula: "\\lim_{x \\to 0} \\frac{\\sin x - x}{x^3}",
    source: "高校期末统考冲刺卷",
    myDeduction: "-5 分",
    errorReason: "仅使用等价无穷小 sin x ~ x 造成分子直接消为 0，陷入 0/0 逻辑谬误",
    weakPoint: "极限求法 / 泰勒公式展开阶数与等价无穷小代换条件",
    userWrongAnswer: "选 D (误认为极限为 0)",
    standardAnswer: "选 A (-1/6)",
    aiInsight: "求差形式的极限不可随意单独替换等价无穷小！应利用麦克劳林展开式 sin x = x - x³/6 + o(x³)，分子展开为 -x³/6 + o(x³)，立即得到结果为 -1/6。"
  },
  {
    id: "m-3",
    num: "题号 09",
    type: "填空题",
    score: 4,
    title: "一阶非齐次线性微分方程 Cauchy 初始值问题：",
    formula: "y' - (2/x)y = x³ ,  y(1) = 2",
    source: "微分方程专项训练卷 #02",
    myDeduction: "-4 分",
    errorReason: "通解公式中积分因子 e^{-∫ P(x)dx} 漏乘负号，导致基础解系幂次错误",
    weakPoint: "常微分方程 / 一阶线性方程通解公式推导",
    userWrongAnswer: "y(x) = x⁵/3 + (5/3)x⁻²",
    standardAnswer: "y(x) = (1/2) x⁴ + (3/2) x²",
    aiInsight: "公式记忆失误：P(x) = -2/x，故 -∫P(x)dx = 2 ln x，积分因子应为 x² 而非 1/x²。推荐通过齐次方程常数变易法现场反推，降低纯公式记忆偏差风险。"
  }
];

export const INITIAL_SUBMISSIONS = [
  {
    id: "sub-2024a-v2",
    paperId: "paper-math-2024a",
    paperTitle: "《2024届全国高等数学期末统考试卷A》",
    source: "1:1 真题复刻 (PDF导入)",
    submitTime: "2025-02-28 16:45",
    durationSpent: 5240,
    score: 86,
    totalScore: 100,
    accuracy: 87,
    questions: MOCK_EXAM_QUESTIONS.map((q, idx) => {
      // simulate Q02 mistake and Q16 partial deduction
      if (idx === 1) {
        return {
          ...q,
          isCorrect: false,
          scoreObtained: 0,
          userAnswer: "D",
          aiInsight: "误用等价无穷小导致 0/0 逻辑谬误。应使用麦克劳林展开 sin x = x - x³/6 + o(x³)，答案为 A (-1/6)。"
        };
      }
      if (idx === 8) {
        return {
          ...q,
          isCorrect: false,
          scoreObtained: 0,
          userAnswer: "y(x) = x⁵/3",
          aiInsight: "通解公式积分因子负号漏乘，标准答案为 y(x) = (1/2)x⁴ + (3/2)x²。"
        };
      }
      if (idx === 15) {
        return {
          ...q,
          isCorrect: true,
          scoreObtained: 8,
          aiInsight: "分部积分思路清晰严密，步骤分拿到 8/10 分，长除法常数项微瑕已自核。"
        };
      }
      return {
        ...q,
        isCorrect: true,
        scoreObtained: q.score || 5,
        aiInsight: "推导严谨，得分点完全达成。"
      };
    }),
    aiOverallReview: {
      summary: "考生在《2024届高数期末试卷A》二刷冲刺中表现出色，总分由一刷的 68 分显著提升至 86 分！基础选择题与常规微分方程求解熟练度明显改善，但在微积分综合解答题细节变形及等价无穷小展开阶数仍有提分空间。",
      strengths: ["定积分换元计算准确无误", "线性代数矩阵运算速度快", "大题分步书写格式规范严谨"],
      weaknesses: ["差式极限中随意套用等价无穷小", "一阶微分方程通解公式符号易混淆", "有理假分式长除法符号分配漏乘"],
      actionPlan: [
        "针对第 2 题与第 9 题进行同构变式练习，巩固泰勒展开与常数变易法",
        "将失分题目一键沉淀至《高等数学期末易错集》"
      ],
      radarAnalysis: {
        conceptMastery: 88,
        calculationAccuracy: 84,
        logicalRigorousness: 86,
        speedAndStrategy: 90,
        difficultProblemAttack: 80
      }
    }
  },
  {
    id: "sub-2024a-v1",
    paperId: "paper-math-2024a",
    paperTitle: "《2024届全国高等数学期末统考试卷A》",
    source: "1:1 真题复刻 (PDF导入)",
    submitTime: "2025-02-27 10:15",
    durationSpent: 6600,
    score: 68,
    totalScore: 100,
    accuracy: 65,
    questions: MOCK_EXAM_QUESTIONS.map((q, idx) => {
      const isWrong = idx === 1 || idx === 3 || idx === 8 || idx === 11 || idx === 14;
      return {
        ...q,
        isCorrect: !isWrong,
        scoreObtained: isWrong ? 0 : (q.score || 5),
        userAnswer: isWrong ? "C" : q.standardAnswer,
        aiInsight: isWrong ? "基础概念理解不透彻，已自动记录错因。" : "作答正确。"
      };
    }),
    aiOverallReview: {
      summary: "一刷首测由于临场时间分配较紧张，后半段解答题未及充分演算。客观题中存在 3 处典型易错点，建议回归教材基础定义，完成错题归集后进行二刷。",
      strengths: ["常规导数求值准确", "作答态度端正完整"],
      weaknesses: ["做题节奏稍显滞后", "综合题步骤踩分点不明确", "易出现计算粗心"],
      actionPlan: ["重点复习微积分有理化拆项", "控制单道选择题用时在 2 分钟以内"]
    }
  }
];

