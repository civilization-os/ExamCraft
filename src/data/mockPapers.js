export const DEFAULT_TEST_MATH_PAPER = {
  id: 'paper-math-ai-grading-2026',
  title: '《2026 高等数学极速精炼卷 · AI智能判题体验专用》',
  source: '考研数学命题组精选',
  sourceType: 'standard',
  subject: '数学',
  date: '2026.10',
  questionCount: 3,
  totalScore: 30,
  duration: 15,
  difficulty: 3,
  status: '未作答',
  tags: ['#考研数学', '#AI智能判题', '#分步采分'],
  typeBreakdown: {
    choices: 1,
    blanks: 1,
    solutions: 1
  },
  questions: [
    {
      id: 'q-math-test-1',
      num: 1,
      type: '单项选择题',
      section: '一、单项选择题',
      score: 5,
      prompt: '设当 $x \\to 0$ 时，函数 $f(x) = \\sin x - x \\cos x$ 与 $c x^k$ 为等价无穷小，则常数 $c$ 与 $k$ 的值分别为（　　）。',
      mathExpression: '\\lim_{x \\to 0} \\frac{\\sin x - x \\cos x}{c x^k} = 1',
      options: [
        { key: 'A', text: 'c = \\frac{1}{3}, \\ k = 3' },
        { key: 'B', text: 'c = \\frac{1}{6}, \\ k = 3' },
        { key: 'C', text: 'c = \\frac{1}{2}, \\ k = 2' },
        { key: 'D', text: 'c = \\frac{1}{3}, \\ k = 2' }
      ],
      standardAnswer: 'A',
      analysis: '利用麦克劳林展开式：\n当 $x \\to 0$ 时，\n$$\\sin x = x - \\frac{x^3}{6} + o(x^3)$$\n$$\\cos x = 1 - \\frac{x^2}{2} + o(x^2) \\implies x \\cos x = x - \\frac{x^3}{2} + o(x^3)$$\n两式相减得：\n$$f(x) = \\left(x - \\frac{x^3}{6}\\right) - \\left(x - \\frac{x^3}{2}\\right) + o(x^3) = \\frac{x^3}{3} + o(x^3)$$\n因此 $f(x) \\sim \\frac{1}{3} x^3$，对比 $c x^k$ 可得 $c = \\frac{1}{3}, k = 3$。正确答案选 A。'
    },
    {
      id: 'q-math-test-2',
      num: 2,
      type: '填空题',
      section: '二、填空题',
      score: 5,
      prompt: '计算定积分 $\\int_0^1 (3x^2 + 2x) \\, dx$ 的值为 ________。',
      mathExpression: '\\int_0^1 (3x^2 + 2x) \\, dx',
      options: [],
      standardAnswer: '2',
      analysis: '根据微积分基本定理（牛顿-莱布尼茨公式）求原函数：\n$$\\int (3x^2 + 2x) \\, dx = x^3 + x^2 + C$$\n代入积分上下限 $0$ 与 $1$：\n$$\\int_0^1 (3x^2 + 2x) \\, dx = \\left[ x^3 + x^2 \\right]_0^1 = (1^3 + 1^2) - (0 + 0) = 2$$\n故本题填空答案为 2。'
    },
    {
      id: 'q-math-test-3',
      num: 3,
      type: '综合解答题',
      section: '三、综合计算解答题',
      score: 20,
      prompt: '设函数 $f(x) = x^3 - 3x + 1$。\n(1) 求函数 $f(x)$ 的单调区间与极值；\n(2) 求曲线 $y = f(x)$ 在点 $(2, f(2))$ 处的切线方程。',
      mathExpression: 'f(x) = x^3 - 3x + 1',
      options: [],
      standardAnswer: '(1) 单调递增区间为 $(-\\infty, -1)$ 与 $(1, +\\infty)$；单调递减区间为 $(-1, 1)$。极大值为 $f(-1) = 3$，极小值为 $f(1) = -1$。\n(2) 在点 $(2, 3)$ 处的切线方程为 $9x - y - 15 = 0$（或 $y = 9x - 15$）。',
      analysis: '【详细采分点与解题步骤】：\n**第一问（10分）：**\n① 对 $f(x)$ 求导：$f\'(x) = 3x^2 - 3 = 3(x+1)(x-1)$。（3分）\n② 令 $f\'(x) = 0$，得驻点 $x_1 = -1, x_2 = 1$。（2分）\n③ 列表分析符号：\n- 当 $x \\in (-\\infty, -1)$ 时，$f\'(x) > 0$，$f(x)$ 单调递增；\n- 当 $x \\in (-1, 1)$ 时，$f\'(x) < 0$，$f(x)$ 单调递减；\n- 当 $x \\in (1, +\\infty)$ 时，$f\'(x) > 0$，$f(x)$ 单调递增。（3分）\n④ 计算极值：\n- 极大值 $f(-1) = (-1)^3 - 3(-1) + 1 = 3$；\n- 极小值 $f(1) = 1^3 - 3(1) + 1 = -1$。（2分）\n\n**第二问（10分）：**\n① 计算切点坐标：当 $x = 2$ 时，$f(2) = 2^3 - 3 \\times 2 + 1 = 3$，切点为 $(2, 3)$。（3分）\n② 计算切线斜率：$k = f\'(2) = 3 \\times 2^2 - 3 = 9$。（3分）\n③ 写出点斜式方程：$y - 3 = 9(x - 2)$，整理化简为：$y = 9x - 15$ 或 $9x - y - 15 = 0$。（4分）'
    }
  ]
};

export const DEFAULT_MOCK_PAPERS = [DEFAULT_TEST_MATH_PAPER];
