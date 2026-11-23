export type Difficulty = 'beginner' | 'novice' | 'skilled' | 'advanced' | 'expert';
export type Puzzle = {
  id: string; puzzle_no: number; difficulty: Difficulty; rows: number; cols: number;
  row_hints: number[][]; column_hints: number[][];
};
export type CellState = 0 | 1 | 2;
export const LEVELS: Record<Difficulty, { title: string; description: string; pcOnly?: boolean }> = {
  beginner: { title: '초보자', description: '네모로직이 처음이신가요? 여기부터 도전해보세요.' },
  novice: { title: '입문자', description: '네모로직에 조금 익숙해지셨다면? 여기!' },
  skilled: { title: '숙련자', description: '조금 더 복잡한 퍼즐에 도전해보세요.' },
  advanced: { title: '고수', description: '어려운 퍼즐에 도전해보세요.' },
  expert: { title: '초고수', description: '가장 어려운 퍼즐에 도전해보세요.', pcOnly: true }
};
