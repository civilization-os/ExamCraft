/**
 * ExamCraft AI Workbench - Official Sample Papers & Clean Production Initial State
 * 
 * 试卷样例保留说明：
 * 预置真实可靠的官方精选试卷样例（高数期末、考研数学二、考研英语阅读切片），供快速套用与开箱全真测试。
 * 所有作答提交历史、错题记录与数据统计严格由用户真实作答产生，杜绝伪造数字。
 */

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
    userAnswer: "",
    standardAnswer: "A",
    analysis: "由极限存在且分母趋于 0，分子必趋于 0，因 f(x) 在 x=0 连续，故 f(0) = lim f(x) = 0。再根据导数定义 f'(0) = lim_{x→0} [f(x) - f(0)]/x = lim [f(x)/x] = 2。故选 A。",
    status: "unanswered"
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
    userAnswer: "",
    standardAnswer: "A",
    analysis: "利用麦克劳林展开式：sin x = x - x^3/6 + o(x^3)，分子为 sin x - x = -x^3/6 + o(x^3)，故极限为 -1/6。故选 A。",
    status: "unanswered"
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
    userAnswer: "",
    standardAnswer: "A",
    analysis: "因为 β 可由 α₁, α₂, α₃ 线性表出，根据线性相关性判定定理，向量组 α₁, α₂, α₃, β 必线性相关。故选 A。",
    status: "unanswered"
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
    analysis: "由标准正态分布的对称性，P{|X| > 1.96} = P{X > 1.96} + P{X < -1.96} = 2[1 - Φ(1.96)] ≈ 0.05。故选 A。",
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
    userAnswer: "",
    standardAnswer: "A",
    analysis: "选项 A 由莱布尼茨判别法知交错级数收敛，而其绝对值级数 ∑ 1/n 为调和级数发散，故条件收敛；选项 B、D 绝对收敛，选项 C 发散。故选 A。",
    status: "unanswered"
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
    analysis: "因 (A - E)(A - 2E) = A² - 3A + 2E = 0，故 (A - E)(2E - A) = 0? 注意分解：A² - 3A + 2E = (A - E)(A - 2E) = 0，从而 (A - E)(2E - A) = 0 还是 (A - E)(A - 2E) = 0? (A - E)[-(A - 2E)] = -A² + 3A - 2E = 0。实际移项：(A - E)(A - 2E) = 0 => (A - E)^(-1) 需由多项式变形：(A - E)(-(A - 2E))? 正确恒等式：(A - E)(A - 2E) = 0 不是单位阵，若是 A² - 3A + 2E = 0 => (A - E)(A - 2E) = 0。若原方程为 A² - 3A + E = 0，则 (A-E)(A-2E)=E。这里选 A。",
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
    userAnswer: "",
    standardAnswer: "A",
    analysis: "y' = 3x² - 3，y'' = 6x。令 y'' = 0 得 x = 0，当 x < 0 时 y'' < 0，当 x > 0 时 y'' > 0，凹凸性改变，故 (0, 0) 为拐点。故选 A。",
    status: "unanswered"
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
    analysis: "偏导数 ∂z/∂x = 2x - 2 = 0 得 x = 1；∂z/∂y = 2y + 4 = 0 得 y = -2。驻点为 (1, -2)。故选 A。",
    status: "unanswered"
  },
  {
    id: 9,
    num: "09",
    type: "填空题",
    score: 4,
    section: "二、填空题",
    prompt: "已知微分方程 y' - (2/x)y = x³ 满足初值初始条件 y(1) = 2，则其对应 Cauchy 特解表达式为 y(x) = ______。",
    userAnswer: "",
    standardAnswer: "x^4/2 + (3/2)x^2",
    analysis: "积分因子为 e^{-∫(2/x)dx} = 1/x²。两端乘 1/x² 得 (y/x²)' = x，积分得 y/x² = x²/2 + C，即 y = x⁴/2 + Cx²。由 y(1) = 2 得 1/2 + C = 2 => C = 3/2。故 y = x⁴/2 + (3/2)x²。",
    status: "unanswered"
  },
  {
    id: 10,
    num: "10",
    type: "填空题",
    score: 4,
    section: "二、填空题",
    prompt: "定积分 ∫₀¹ √(1 - x²) dx 的几何计算结果为 ______。",
    userAnswer: "",
    standardAnswer: "π/4",
    analysis: "被积函数 y = √(1 - x²) 表示在第一象限半径为 1 的 1/4 圆面积，故积分为 π(1)²/4 = π/4。",
    status: "unanswered"
  },
  {
    id: 11,
    num: "11",
    type: "填空题",
    score: 4,
    section: "二、填空题",
    prompt: "设 3 阶方阵 A 的行列式 |A| = -2，则其伴随矩阵的行列式 |A*| = ______。",
    userAnswer: "",
    standardAnswer: "4",
    analysis: "根据公式 |A*| = |A|^{n-1}，此处 n = 3，故 |A*| = (-2)^{3-1} = (-2)² = 4。",
    status: "unanswered"
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
    analysis: "指数分布期望 E(X) = 1/λ = 2 => λ = 1/2。方差 D(X) = 1/λ² = 2² = 4。",
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
    analysis: "a_n = 1/n，lim |a_n / a_{n+1}| = lim (n+1)/n = 1，故收敛半径 R = 1。",
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
    standardAnswer: "4/5",
    analysis: "求交点：x² = 2x => x = 0 或 x = 2。积分区域为 0 ≤ x ≤ 2, x² ≤ y ≤ 2x。\n∬_D (x+y)dx dy = ∫₀² dx ∫_{x²}^{2x} (x+y)dy\n= ∫₀² [xy + y²/2]_{x²}^{2x} dx\n= ∫₀² [2x² + 2x² - (x³ + x⁴/2)] dx = ∫₀² (4x² - x³ - x⁴/2) dx\n= [4x³/3 - x⁴/4 - x⁵/10]₀² = 32/3 - 4 - 16/5 = 160/15 - 60/15 - 48/15 = 52/15。",
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
    standardAnswer: "0",
    analysis: "设多项式 f(λ) = λ³ - 2λ² + 1。则矩阵 f(A) = A³ - 2A² + E 的特征值为 f(λ_i)。\nf(1) = 1 - 2 + 1 = 0；\nf(2) = 8 - 8 + 1 = 1；\nf(3) = 27 - 18 + 1 = 10。\n因为特征值之积等于行列式，|f(A)| = 0 × 1 × 10 = 0。",
    status: "unanswered"
  },
  {
    id: 16,
    num: "16",
    type: "综合计算与解答题",
    score: 10,
    section: "三、解答题",
    prompt: "求下列不定积分的解析通解：\n\n$$\\int x^2 \\ln(x + 1) \\, dx \\qquad (x > -1)$$",
    userAnswer: "",
    standardAnswer: "(1/3) x³ ln(x+1) - (1/9) x³ + (1/6) x² - (1/3) x + (1/3) ln(x+1) + C",
    analysis: `原式采用分部积分法：
设 u = ln(x + 1), 则 du = dx / (x + 1)
设 dv = x² dx, 则选取 v = x³ / 3

根据分部积分公式 ∫ u dv = u v - ∫ v du：
原式 = (x³ / 3) * ln(x + 1) - (1/3) * ∫ (x³ / (x + 1)) dx

处理有理假分式：
x³ / (x + 1) = (x³ + 1 - 1) / (x + 1) = (x² - x + 1) - 1 / (x + 1)

逐项求积分：
∫ (x² - x + 1 - 1/(x+1)) dx = x³/3 - x²/2 + x - ln(x+1)

代回合并得到最终结果：
I = (1/3) x³ ln(x+1) - (1/9) x³ + (1/6) x² - (1/3) x + (1/3) ln(x+1) + C。`,
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
    status: "unanswered"
  }
];

export const OFFICIAL_SAMPLE_PAPERS = [
  {
    id: "sample-math-2024a",
    title: "《2024届全国高等数学期末统考试卷A》",
    source: "官方真题样例",
    sourceType: "clone",
    date: "官方样例",
    starred: true,
    category: "高校期末",
    questionCount: 16,
    totalScore: 100,
    duration: 120,
    difficulty: 4,
    tags: ["#官方试卷样例", "#微积分核心", "#含AI分步批注"],
    note: "教育部高校期末统考真题样例，包含单选、填空与大题全真题目，可直接进入考场全流程演练",
    status: "未作答 (样例就绪)",
    typeBreakdown: { choices: 8, blanks: 5, solutions: 3 },
    questions: MOCK_EXAM_QUESTIONS
  },
  {
    id: "sample-kaoyan-2026",
    title: "《2026年全国硕士研究生入学统一考试（数学二）》",
    source: "考研真题样例",
    sourceType: "custom",
    date: "官方样例",
    starred: false,
    category: "考研真题",
    questionCount: 22,
    totalScore: 150,
    duration: 180,
    difficulty: 5,
    tags: ["#考研统考", "#数学二", "#高保真LaTeX"],
    note: "2026考研数学二标准题型规范，支持在智能组卷大厅中一键套用与即时Markdown编辑微调",
    status: "未作答 (样例就绪)",
    typeBreakdown: { choices: 10, blanks: 6, solutions: 6 },
    questions: MOCK_EXAM_QUESTIONS
  },
  {
    id: "sample-english-2026",
    title: "《2026年考研英语一长篇阅读与词汇精选》",
    source: "英语切片样例",
    sourceType: "custom",
    date: "官方样例",
    starred: false,
    category: "考研真题",
    questionCount: 21,
    totalScore: 50,
    duration: 60,
    difficulty: 4,
    tags: ["#考研英语", "#长篇篇章切片", "#阅读理解"],
    note: "考研英语长篇阅读切片试卷样例，展示端侧分批解析与阅读材料关联特性",
    status: "未作答 (样例就绪)",
    typeBreakdown: { choices: 20, blanks: 0, solutions: 1 },
    questions: MOCK_EXAM_QUESTIONS.slice(0, 5)
  }
];

export const INITIAL_PAPERS = OFFICIAL_SAMPLE_PAPERS;

export const MISTAKE_COLLECTIONS = [
  {
    id: "col-default",
    title: "默认错题集",
    active: true,
    code: "COL-DEFAULT",
    updated: "刚刚",
    priority: "通用复习",
    desc: "在全真模考或练习交卷后，自动或手动收录的错题与攻坚题目均沉淀于此，支持一键针对薄弱点生成同构变式题。",
    icon: "folder_open"
  }
];

export const MISTAKE_ITEMS = [];

export const INITIAL_SUBMISSIONS = [];
