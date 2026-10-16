/**
 * ExamCraft AI Workbench - Clean Production Initial State
 * 
 * 纯净初始状态说明：
 * 移除所有写死的 Mock 假数据与样例试卷。
 * 所有试卷、考题、提交记录与错题集均由用户在智能组卷与在线考场中真实创建与作答生成。
 */

export const MOCK_EXAM_QUESTIONS = [];

export const OFFICIAL_SAMPLE_PAPERS = [];

export const INITIAL_PAPERS = [];

export const MISTAKE_COLLECTIONS = [
  {
    id: "col-default",
    title: "默认错题集",
    active: true,
    code: "COL-DEFAULT",
    updated: "刚刚",
    priority: "通用复习",
    desc: "在全真模考或练习交卷后，自动或手动收录的错题与攻坚题目沉淀于此，支持一键针对薄弱点生成同构变式题。",
    icon: "folder_open"
  }
];

export const MISTAKE_ITEMS = [];

export const INITIAL_SUBMISSIONS = [];
