export type Category = 'work' | 'study' | 'break' | 'personal';
export type View = 'today' | 'week' | 'insights' | 'settings';
export type Block = {
  id: string;
  date: string;
  title: string;
  category: Category;
  start: string;
  end: string;
  notes: string;
  completed: boolean;
  actualSeconds: number;
};
export type TimerState = {
  blockId: string;
  remainingSeconds: number;
  isRunning: boolean;
  lastTickAt: number | null;
};
export type Preferences = { dailyGoal: number; notifications: boolean };
export type EditorValues = Pick<Block, 'title' | 'category' | 'start' | 'end' | 'notes'>;
