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
  | (TaskBase & { role: 'uploader'; teamId: string; clueIds: string[]; photoKB: number; intervalMs: number })
  | (TaskBase & { role: 'load'; durationMs: number; ops: LoadOp[] })
  | (TaskBase & { role: 'offline'; pin: string; takenPin: string; teamId: string; clueId: string });

/** Load mode (--load=op:qps): operations a worker fires at a fixed rate. */
export const LOAD_OPS = ['heartbeat', 'offline', 'gps', 'join', 'submit', 'approve', 'broadcast'] as const;
export type LoadOpName = (typeof LOAD_OPS)[number];

export interface LoadOp {
  op: LoadOpName;
  /** This worker's share of the target rate. */
  qps: number;
  /** This worker's share of the total request count (qps × duration, split exactly). */
  count: number;
  /** Start offset so the workers' schedules interleave evenly. */
  offsetMs: number;
  teamIds: string[];
  pins: string[];
  playersPerTeam: number;
  photoKB: number;
  /** submit: clue ids, approve: submission ids — one per request, never reused. */
  items?: string[];
}

export interface LoadOpResult {
  op: LoadOpName;
  scheduled: number;
  issued: number;
  ok: number;
  err: number;
  errors: Record<string, number>;
  latencies: number[];
  /** How late each request left vs its scheduled time (generator health). */
  lateMs: number[];
  maxInFlight: number;
  /** Seconds from this op's first scheduled request to its last completion. */
  wallSeconds: number;
  ranOutOfItems: number;
}

export interface WorkerResult {
  ok: boolean;
  role: Task['role'];
  label: string;
  warnings: { mockFallback: number; listenerStopped: number; swallowed: number; samples: string[] };
  data?: any;
  error?: string;
}
