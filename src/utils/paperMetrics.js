/**
 * ExamCraft AI Workbench - Paper & Question Metrics Engine
 * 
 * 动态难度与耗时评估引擎：
 * 杜绝硬编码假数据，根据试卷学科属性、题目真实题型、分值分布、公式密度与大题推导量，
 * 动态综合评估试卷的真实难度星级 (1-5 星)、难度文案标签及科学的预计平均完成用时。
 */

/**
 * 计算单道题目的难度等级
 * @param {object} q 试题对象
 * @returns {{ difficulty: number, stars: string, label: string }}
 */
export function getQuestionDifficulty(q) {
  if (!q) {
    return { difficulty: 3, stars: '★★★☆☆', label: '常规考题' };
  }

  if (q.difficultyStr && q.difficultyStr.includes('★')) {
    const starCount = (q.difficultyStr.match(/★/g) || []).length;
    return {
      difficulty: starCount,
      stars: q.difficultyStr,
      label: starCount >= 5 ? '压轴攻坚' : starCount >= 4 ? '进阶拔高' : '基础考点'
    };
  }

  if (typeof q.difficulty === 'number' && q.difficulty >= 1 && q.difficulty <= 5) {
    const stars = '★'.repeat(q.difficulty) + '☆'.repeat(5 - q.difficulty);
    return {
      difficulty: q.difficulty,
      stars,
      label: q.difficulty >= 5 ? '压轴攻坚' : q.difficulty >= 4 ? '进阶拔高' : '基础考点'
    };
  }

  const type = (q.type || '').trim();
  const score = Number(q.score) || 5;
  const prompt = (q.prompt || q.stem || q.question || '');
  const hasHeavyMath = prompt.includes('$$') || prompt.includes('\\int') || prompt.includes('\\lim') || prompt.includes('\\matrix') || /[\u2200-\u22FF]/.test(prompt);

  let diff = 3;

  if (type.includes('证明') || (hasHeavyMath && score >= 10)) {
    diff = 5;
  } else if (type.includes('写作') || type.includes('作文')) {
    diff = score >= 15 ? 5 : 4;
  } else if (type.includes('翻译')) {
    diff = 4;
  } else if (type.includes('解答') || type.includes('计算') || score >= 10) {
    diff = hasHeavyMath ? 5 : 4;
  } else if (type.includes('填空')) {
    diff = hasHeavyMath ? 4 : 3;
  } else if (type.includes('选择') || type.includes('客观')) {
    if (score <= 1) {
      diff = 2; // 完形填空选词等基础题
    } else if (score <= 2) {
      diff = 3; // 阅读理解中档选择
    } else {
      diff = hasHeavyMath ? 4 : 3; // 数学选择题
    }
  }

  const stars = '★'.repeat(diff) + '☆'.repeat(5 - diff);
  const label = diff >= 5 ? '压轴攻坚' : diff >= 4 ? '进阶拔高' : diff === 3 ? '中档常考' : '基础精练';

  return { difficulty: diff, stars, label };
}

/**
 * 动态综合测算整套试卷的真实难度星级与科学预估用时
 * @param {object} paper 试卷对象
 * @returns {{ difficulty: number, stars: string, difficultyLabel: string, estimatedMinutes: number }}
 */
export function calculatePaperMetrics(paper) {
  if (!paper) {
    return {
      difficulty: 4,
      stars: '★★★★☆',
      difficultyLabel: '全真选拔·较高难度',
      estimatedMinutes: 120
    };
  }

  const title = (paper.title || '').toLowerCase();
  const questions = paper.questions || [];
  const duration = Number(paper.duration) || 120;

  let totalEstimatedMinutes = 0;
  let weightedDifficultySum = 0;
  let totalScoreWeight = 0;

  if (questions.length > 0) {
    questions.forEach((q) => {
      const qDiffInfo = getQuestionDifficulty(q);
      const score = Number(q.score) || 5;
      const type = (q.type || '').trim();

      weightedDifficultySum += qDiffInfo.difficulty * score;
      totalScoreWeight += score;

      // Estimate answering duration per question type
      if (type.includes('写作') || type.includes('作文')) {
        totalEstimatedMinutes += score >= 15 ? 28 : 18;
      } else if (type.includes('翻译')) {
        totalEstimatedMinutes += 22;
      } else if (type.includes('证明') || type.includes('解答') || type.includes('计算') || score >= 10) {
        totalEstimatedMinutes += 14;
      } else if (type.includes('填空')) {
        totalEstimatedMinutes += 4.5;
      } else if (type.includes('选择') || type.includes('客观')) {
        if (score <= 1) {
          totalEstimatedMinutes += 1.2; // 完形填空平均约 1.2 分钟
        } else if (score <= 2) {
          totalEstimatedMinutes += 2.5; // 英语阅读理解含看文章
        } else {
          totalEstimatedMinutes += 4.5; // 数学选择题需推导草稿
        }
      } else {
        totalEstimatedMinutes += 5;
      }
    });
  }

  // Baseline difficulty score
  let baseDifficulty = totalScoreWeight > 0
    ? (weightedDifficultySum / totalScoreWeight)
    : (paper.difficulty || 3.8);

  // Subject and examination level semantic weighting
  const isKaoyanMath = (title.includes('数学') || title.includes('高等数学') || title.includes('数一') || title.includes('数二') || title.includes('数三')) &&
    (title.includes('考研') || title.includes('硕士') || title.includes('统考') || title.includes('真题'));
  const isKaoyanEnglish1 = title.includes('英语') && (title.includes('英语一') || title.includes('英语（一）'));
  const isKaoyanEnglish2 = title.includes('英语') && (title.includes('英语二') || title.includes('英语（二）'));
  const isCollegeFinal = title.includes('期末') || title.includes('单元');
  const isOlympiad = title.includes('竞赛') || title.includes('冲刺');

  if (isKaoyanMath || isOlympiad) {
    // 考研数学/竞赛压轴题比例极高，全国平均分较低，满评 5 星
    baseDifficulty = Math.max(baseDifficulty, 4.7);
  } else if (isKaoyanEnglish1) {
    baseDifficulty = Math.max(baseDifficulty, 4.5);
  } else if (isKaoyanEnglish2) {
    // 考研英语二难度稳定在 4 星水平（较高难度）
    baseDifficulty = Math.min(Math.max(baseDifficulty, 3.8), 4.2);
  } else if (isCollegeFinal) {
    baseDifficulty = Math.min(baseDifficulty, 3.4);
  }

  const finalDifficulty = Math.min(5, Math.max(1, Math.round(baseDifficulty)));
  const stars = '★'.repeat(finalDifficulty) + '☆'.repeat(5 - finalDifficulty);

  let difficultyLabel = '进阶精选';
  if (finalDifficulty >= 5) {
    difficultyLabel = '考研统考·极高难度';
  } else if (finalDifficulty === 4) {
    difficultyLabel = '全真选拔·较高难度';
  } else if (finalDifficulty === 3) {
    difficultyLabel = '标准模考·中等难度';
  } else {
    difficultyLabel = '基础巩固·基础难度';
  }

  // Realistic estimated completion time calculation
  let estMinutes = Math.round(totalEstimatedMinutes);
  if (estMinutes < 20) {
    estMinutes = Math.round(duration * 0.8);
  } else {
    estMinutes = Math.min(duration, Math.max(25, estMinutes));
  }

  return {
    difficulty: finalDifficulty,
    stars,
    difficultyLabel,
    estimatedMinutes: estMinutes
  };
}
