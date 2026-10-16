/**
 * ExamCraft Workbench - Initial Storage State
 * Clean production-ready data definitions with zero mock data.
 */

export const INITIAL_PAPERS = [];

export const MOCK_EXAM_QUESTIONS = [];

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
