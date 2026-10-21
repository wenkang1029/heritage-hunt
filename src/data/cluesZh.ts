import cluesData from './cluesZh.json';

export interface ClueZhMeta {
  file: string;
  id: string;
  title: string;
  landmarkName: string;
  description: string;
  hint: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  radiusMeters: number;
  zoneId: string;
}

export const CLUES_ZH: ClueZhMeta[] = cluesData as ClueZhMeta[];

export const CLUES_ZH_MAP: Record<string, ClueZhMeta> = CLUES_ZH.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<string, ClueZhMeta>
);

export function getClueNumber(id: string): string {
  const match = id.match(/\d+/);
  return match ? `#${match[0].padStart(3, '0')}` : id;
}

export function getClueLabel(id: string, language: 'zh' | 'en' = 'zh'): string {
  const num = getClueNumber(id);
  return language === 'zh' ? `线索 ${num}` : `Clue ${num}`;
}

export function normalizeClueZh<T extends { id: string; title?: string; landmarkName?: string; description?: string; hint?: string; points?: number }>(clue: T): T {
  return {
    ...clue,
    title: '',
    landmarkName: '',
    description: '',
    points: 50,
  };
}
