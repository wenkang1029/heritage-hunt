/**
 * Stress worker: one real Firebase client (own anonymous uid, own connection to the emulator)
 * running the app's real gameService. Spawned by run.ts via fork(); the task comes in
 * STRESS_TASK, the result goes back over IPC.
 *
 * Protocol: worker signs in -> sends {type:'ready'} -> waits for {type:'go'} (a start barrier
 * so all workers hit Firestore at the same moment) -> runs its role -> sends {type:'result'}.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Task, WorkerResult, LoadOp, LoadOpResult } from './types.ts';

const task: Task = JSON.parse(process.env.STRESS_TASK || '{}');

// Load mode: lets a swallowed console.warn be traced back to the request that caused it.
const callContext = new AsyncLocalStorage<{ swallowed?: string }>();

// gameService swallows some errors with console.warn (heartbeat failures, the silent
// fallback to mock data). Count them: under stress they are failures, not noise.
const warnings = { mockFallback: 0, listenerStopped: 0, swallowed: 0, samples: [] as string[] };
const origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
  const ctx = callContext.getStore();
  let counted = true;
  if (/fall(ing|back) (back )?to mock|fallback to mock/i.test(msg)) warnings.mockFallback++;
  else if (/listener stopped/.test(msg)) warnings.listenerStopped++;
  else if (/^Failed to /.test(msg)) {
    warnings.swallowed++;
    if (ctx) ctx.swallowed = msg;
  } else counted = false;
  if (counted && warnings.samples.length < 5) warnings.samples.push(msg.slice(0, 300));
  if (process.env.STRESS_VERBOSE) origWarn(...args);
};

const { gameService } = await import('../../src/services/gameService.ts');
const { ensureAnonymousAuth, db } = await import('../../src/services/firebase.ts');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

async function timed<T>(latencies: number[], fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    latencies.push(performance.now() - t0);
  }
}

/** One request of a load op, or null when the op has run out of pre-created items. */
function loadCall(op: LoadOp, gameId: string, i: number, photo: string): (() => Promise<unknown>) | null {
  const teamId = op.teamIds[i % op.teamIds.length];
  const player = `load-${teamId}-p${Math.floor(i / op.teamIds.length) % op.playersPerTeam}`;
  switch (op.op) {
    case 'heartbeat':
      return () => gameService.updatePlayerHeartbeat(gameId, teamId, player, player);
    case 'offline':
      return () => gameService.markPlayerOffline(gameId, teamId, player, player);
    case 'gps': {
      const coords = { latitude: 2.1944 + rand(-0.003, 0.003), longitude: 102.2491 + rand(-0.003, 0.003) };
      return () => gameService.updateTeamGps(gameId, teamId, coords);
    }
    case 'join':
      return () => gameService.joinTeamByPin(gameId, op.pins[i % op.pins.length], `load-joiner-${process.pid}`);
    case 'submit': {
      const clueId = op.items?.[i];
      if (!clueId) return null;
      return () =>
        gameService.submitCluePhoto(gameId, {
          gameId,
          teamId,
          teamName: teamId,
          teamColor: '#000000',
          clueId,
          clueTitle: clueId,
          selfieBase64: photo,
          submittedBy: player,
          submissionCoords: { latitude: 2.1944, longitude: 102.2491 },
        } as any);
    }
    case 'approve': {
      const submissionId = op.items?.[i];
      if (!submissionId) return null;
      return () => gameService.verifySubmission(gameId, submissionId, 'approve');
    }
    case 'broadcast':
      return () => gameService.sendBroadcast({ gameId, message: `load test ${i}`, type: 'info' } as any);
  }
}

/** Fire `op` at a fixed rate (open loop: the schedule never waits for earlier requests). */
async function runLoadOp(op: LoadOp, gameId: string, photo: string): Promise<LoadOpResult> {
  const interval = 1000 / op.qps;
  const scheduled = op.count;
  const start = performance.now() + op.offsetMs;
  const r: LoadOpResult = {
    op: op.op, scheduled, issued: 0, ok: 0, err: 0, errors: {}, latencies: [], lateMs: [], maxInFlight: 0, wallSeconds: 0, ranOutOfItems: 0,
  };
  let inFlight = 0;
  let lastDone = start;
  const pending: Promise<void>[] = [];

  for (let i = 0; i < scheduled; i++) {
    const due = start + i * interval;
    if (due > performance.now()) await sleep(due - performance.now());
    const call = loadCall(op, gameId, i, photo);
    if (!call) {
      r.ranOutOfItems++;
      continue;
    }
    r.issued++;
    r.lateMs.push(Math.max(0, performance.now() - due));
    r.maxInFlight = Math.max(r.maxInFlight, ++inFlight);
    const ctx: { swallowed?: string } = {};
    const t0 = performance.now();
    pending.push(
      callContext
        .run(ctx, call)
        .then(() => {
          if (ctx.swallowed) throw new Error(ctx.swallowed);
        })
        .then(
          () => {
            r.ok++;
          },
          (e: any) => {
            r.err++;
            const key = String(e?.message || e).slice(0, 160);
            r.errors[key] = (r.errors[key] || 0) + 1;
          }
        )
        .finally(() => {
          lastDone = performance.now();
          r.latencies.push(lastDone - t0);
          inFlight--;
        })
    );
  }
  await Promise.all(pending);
  r.wallSeconds = (lastDone - start) / 1000;
  return r;
}

function syntheticPhoto(kb: number): string {
  // Random bytes so nothing compresses it away; size is the base64 string length.
  const bytes = Buffer.alloc(Math.floor((kb * 1024 * 3) / 4));
  for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0;
  return 'data:image/jpeg;base64,' + bytes.toString('base64');
}

const roles: Record<Task['role'], (t: any) => Promise<Record<string, unknown>>> = {
  /** S1 / S3 noise: players spamming heartbeat / offline (and optionally GPS) on one team doc. */
  async presence(t: Extract<Task, { role: 'presence' }>) {
    const latencies: number[] = [];
    const finalState: Record<string, boolean> = {};
    let ops = 0;
    const deadline = Date.now() + t.durationMs;

    await Promise.all(
      t.players.map(async (p) => {
        await timed(latencies, () => gameService.updatePlayerHeartbeat(t.gameId, t.teamId, p.id, p.nickname));
        finalState[p.id] = true;
        ops++;
        while (Date.now() < deadline) {
          await sleep(rand(t.minDelayMs, t.maxDelayMs));
          const r = Math.random();
          if (t.gps && r < 0.34) {
            const coords = { latitude: 2.1944 + rand(-0.003, 0.003), longitude: 102.2491 + rand(-0.003, 0.003) };
            await timed(latencies, () => gameService.updateTeamGps(t.gameId, t.teamId, coords));
          } else if (r < 0.67) {
            await timed(latencies, () => gameService.updatePlayerHeartbeat(t.gameId, t.teamId, p.id, p.nickname));
            finalState[p.id] = true;
          } else {
            await timed(latencies, () => gameService.markPlayerOffline(t.gameId, t.teamId, p.id, p.nickname));
            finalState[p.id] = false;
          }
          ops++;
        }
      })
    );
    return { ops, latencies, finalState };
  },

  /** S2: one real player (this process's anonymous uid) joining, possibly several times. */
  async join(t: Extract<Task, { role: 'join' }>) {
    const latencies: number[] = [];
    const errors: string[] = [];
    let playerId = '';
    for (let i = 0; i < t.times; i++) {
      try {
        const res = await timed(latencies, () => gameService.joinTeamByPin(t.gameId, t.pin, t.nickname));
        playerId = res.playerId;
      } catch (e: any) {
        errors.push(e.message);
      }
      if (i < t.times - 1) await sleep(rand(0, 200));
    }
    return { playerId, latencies, errors };
  },

  /** S3 / S4: a Game Master approving a list of submissions all at once. */
  async gm(t: Extract<Task, { role: 'gm' }>) {
    const latencies: number[] = [];
    const settled = await Promise.allSettled(
      t.submissionIds.map((id) => timed(latencies, () => gameService.verifySubmission(t.gameId, id, 'approve')))
    );
    const approved = t.submissionIds.filter((_, i) => settled[i].status === 'fulfilled');
    const errors = settled
      .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
      .map((s) => String(s.reason?.message || s.reason));
    return { approved, errors, latencies };
  },

  /** S5: app cold start (initializeDefaultGame), then the player joins straight away. */
  async bootstrap(t: Extract<Task, { role: 'bootstrap' }>) {
    const latencies: number[] = [];
    const game = await timed(latencies, () => gameService.initializeDefaultGame(t.gameId));
    let playerId = '';
    const errors: string[] = [];
    if (t.joinPin) {
      // "No team found" right after start-up is a visible but retryable error; losing a
      // member silently is the bug we are looking for.
      for (let attempt = 0; attempt < 5 && !playerId; attempt++) {
        try {
          playerId = (await gameService.joinTeamByPin(t.gameId, t.joinPin, t.nickname)).playerId;
        } catch (e: any) {
          errors.push(e.message);
          await sleep(200);
        }
      }
    }
    return { gameId: game.id, createdAt: game.createdAt, playerId, errors, latencies };
  },

  /** S6: a phone with the app open, receiving every submission (with photo) in real time. */
  async listener(t: Extract<Task, { role: 'listener' }>) {
    const seen = new Map<string, number>();
    const deliveryMs: number[] = [];
    let submissionCallbacks = 0;
    let teamCallbacks = 0;
    let bytesDelivered = 0;
    let maxDocs = 0;

    const unsubSubs = gameService.subscribeToSubmissions(t.gameId, (subs) => {
      const now = Date.now();
      submissionCallbacks++;
      maxDocs = Math.max(maxDocs, subs.length);
      for (const s of subs) {
        bytesDelivered += s.selfieBase64?.length || 0;
        if (!seen.has(s.id)) {
          seen.set(s.id, now);
          if (s.submittedAt && now >= t.startedAt) deliveryMs.push(now - Number(s.submittedAt));
        }
      }
    });
    const unsubTeams = gameService.subscribeToTeams(t.gameId, () => {
      teamCallbacks++;
    });

    await sleep(t.durationMs);
    unsubSubs();
    unsubTeams();
    const mem = process.memoryUsage();
    return {
      received: seen.size,
      deliveryMs,
      submissionCallbacks,
      teamCallbacks,
      bytesDelivered,
      maxDocs,
      heapMB: Math.round(mem.heapUsed / 1048576),
      rssMB: Math.round(mem.rss / 1048576),
    };
  },

  /** S7: the phone loses its connection; every action must say so clearly and promptly. */
  async offline(t: Extract<Task, { role: 'offline' }>) {
    const { disableNetwork, enableNetwork } = await import('firebase/firestore');

    // --- B7: connection status follows reality and never swaps in mock data
    const statuses: string[] = [];
    gameService.subscribeToConnectionStatus((st) => statuses.push(st.state));
    const waitFor = async (state: string, ms: number) => {
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        if (statuses[statuses.length - 1] === state) return Math.round(performance.now() - t0);
        await sleep(50);
      }
      return -1;
    };
    gameService.subscribeToGame(t.gameId, () => {});
    const firstOnline = await waitFor('online', 5000);
    await disableNetwork(db!);
    const wentOffline = await waitFor('offline', 8000);
    await enableNetwork(db!);
    const backOnline = await waitFor('online', 8000);
    // A listener Firestore terminates: the stress rules (= docs rules) deny `broadcasts`.
    let broadcastCallbacks = 0;
    gameService.subscribeToBroadcasts(t.gameId, () => broadcastCallbacks++);
    const wentError = await waitFor('error', 8000);
    const status = { firstOnline, wentOffline, backOnline, wentError, broadcastCallbacks, statuses };

    await disableNetwork(db!);
    // Outcome of one action: its error message, 'succeeded', or 'hung' (no answer in 15s).
    const attempt = async (fn: () => Promise<unknown>) => {
      const t0 = performance.now();
      const timeout = new Promise<string>((res) => setTimeout(() => res('hung'), 15000));
      const outcome = await Promise.race([
        fn().then(() => 'succeeded', (e: any) => String(e?.message || e)),
        timeout,
      ]);
      return { outcome, ms: Math.round(performance.now() - t0) };
    };
    return {
      status,
      bootstrap: await attempt(() => gameService.initializeDefaultGame(`s7-offline-${process.pid}`)),
      join: await attempt(() => gameService.joinTeamByPin(t.gameId, t.pin, 'offline-player')),
      createTeam: await attempt(() => gameService.createTeam(t.gameId, 'Offline Dup', '#000000', t.takenPin)),
      submit: await attempt(() =>
        gameService.submitCluePhoto(t.gameId, {
          gameId: t.gameId,
          teamId: t.teamId,
          teamName: t.teamId,
          teamColor: '#000000',
          clueId: t.clueId,
          clueTitle: t.clueId,
          selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          submittedBy: 'offline-player',
          submissionCoords: { latitude: 2.1944, longitude: 102.2491 },
        } as any)
      ),
    };
  },

  /** Load mode: every op of this worker at its share of the target QPS, in parallel. */
  async load(t: Extract<Task, { role: 'load' }>) {
    // Build the photo before any schedule starts: generating it blocks the event loop.
    const submit = t.ops.find((op) => op.op === 'submit');
    const photo = submit ? syntheticPhoto(submit.photoKB) : '';
    return { ops: await Promise.all(t.ops.map((op) => runLoadOp(op, t.gameId, photo))) };
  },

  /** S6: a team uploading photos one clue after another. */
  async uploader(t: Extract<Task, { role: 'uploader' }>) {
    const latencies: number[] = [];
    const errors: string[] = [];
    const ids: string[] = [];
    for (const clueId of t.clueIds) {
      await sleep(t.intervalMs); // also gives listeners time to attach before the first upload
      try {
        const sub = await timed(latencies, () =>
          gameService.submitCluePhoto(t.gameId, {
            gameId: t.gameId,
            teamId: t.teamId,
            teamName: t.teamId,
            teamColor: '#000000',
            clueId,
            clueTitle: clueId,
            selfieBase64: syntheticPhoto(t.photoKB),
            submittedBy: `uploader-${t.teamId}`,
            submissionCoords: { latitude: 2.1944, longitude: 102.2491 },
          } as any)
        );
        ids.push(sub.id);
      } catch (e: any) {
        errors.push(e.message);
      }
    }
    return { ids, errors, latencies };
  },
};

let result: WorkerResult;
try {
  await ensureAnonymousAuth();
  process.send!({ type: 'ready' });
  await new Promise<void>((resolve) => process.once('message', () => resolve()));
  const data = await roles[task.role](task);
  result = { ok: true, role: task.role, label: task.label, warnings, data };
} catch (e: any) {
  result = { ok: false, role: task.role, label: task.label, warnings, error: e?.stack || String(e) };
}
// Firestore keeps the connection open; leave explicitly once the result is flushed.
process.send!({ type: 'result', result }, () => process.exit(0));
