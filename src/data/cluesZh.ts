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

export function normalizeClueZh<T extends { id: string; title?: string; landmarkName?: string; description?: string; hint?: string }>(clue: T): T {
  const zh = CLUES_ZH_MAP[clue.id];
  if (!zh) return clue;
  return {
    ...clue,
    title: zh.title,
    landmarkName: zh.landmarkName,
    description: zh.description,
    hint: zh.hint,
  };
}
