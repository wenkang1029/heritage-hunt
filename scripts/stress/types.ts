/** Tasks run.ts hands to worker.ts, and what comes back. */

export interface PlayerSpec {
  id: string;
  nickname: string;
}

interface TaskBase {
  label: string;
  gameId: string;
}

export type Task =
  | (TaskBase & {
      role: 'presence';
      teamId: string;
      players: PlayerSpec[];
      durationMs: number;
      minDelayMs: number;
      maxDelayMs: number;
      gps?: boolean;
    })
  | (TaskBase & { role: 'join'; pin: string; nickname: string; times: number })
  | (TaskBase & { role: 'gm'; submissionIds: string[] })
  | (TaskBase & { role: 'bootstrap'; joinPin?: string; nickname: string })
  | (TaskBase & { role: 'listener'; durationMs: number; startedAt: number })
  | (TaskBase & { role: 'uploader'; teamId: string; clueIds: string[]; photoKB: number; intervalMs: number });

export interface WorkerResult {
  ok: boolean;
  role: Task['role'];
  label: string;
  warnings: { mockFallback: number; swallowed: number; samples: string[] };
  data?: any;
  error?: string;
}
