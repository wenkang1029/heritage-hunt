/**
 * Heritage Hunt — Firestore emulator stress test.
 *
 * Spawns worker processes (each one a real Firebase client running the app's gameService)
 * against the local Firebase Emulator Suite, then checks the resulting Firestore state.
 * See scripts/stress/README.md.
 *
 *   npm run stress                    # all scenarios
 *   npm run stress -- --only=s1,s4    # some scenarios
 *   npm run stress -- --scale=2       # 2x the worker processes / players
 */

import { fork } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Task, WorkerResult, PlayerSpec } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'demo-heritage-hunt'; // demo-* = emulator only, can never touch a real project
const HOST = '127.0.0.1';
const FIRESTORE = `http://${HOST}:8080`;
const AUTH = `http://${HOST}:9099`;

// Must be set before firebase.ts is imported (it initialises at module load); workers inherit it.
Object.assign(process.env, {
  VITE_FIREBASE_API_KEY: 'demo-api-key',
  VITE_FIREBASE_PROJECT_ID: PROJECT_ID,
  VITE_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
  VITE_FIREBASE_APP_ID: 'demo-app',
  VITE_FIREBASE_EMULATOR_HOST: HOST,
});

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);
const ONLY = argv.only ? String(argv.only).toLowerCase().split(',') : null;
const SCALE = Math.max(1, Number(argv.scale || 1));
const n = (base: number) => Math.round(base * SCALE);

// ---------------------------------------------------------------------------
// Emulator + app setup
// ---------------------------------------------------------------------------

async function emulatorUp(): Promise<boolean> {
  try {
    await fetch(FIRESTORE);
    await fetch(AUTH);
    return true;
  } catch {
    return false;
  }
}

if (!(await emulatorUp())) {
  console.error(
    `❌ Firebase emulator not reachable at ${FIRESTORE} / ${AUTH}.\n` +
      '   Start it first in another terminal:  npm run emulators'
  );
  process.exit(2);
}

async function resetEmulator() {
  await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
}

const { gameService, isMockMode } = await import('../../src/services/gameService.ts');
const { db, ensureAnonymousAuth } = await import('../../src/services/firebase.ts');
const { DEFAULT_TEAMS } = await import('../../src/data/melakaZones.ts');
const { doc, getDoc, getDocs, collection } = await import('firebase/firestore');

if (isMockMode() || !db) {
  console.error('❌ gameService is in mock mode — the emulator env vars did not take effect.');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKER = join(HERE, 'worker.ts');
const EXEC_ARGV = [
  '--experimental-strip-types',
  '--disable-warning=ExperimentalWarning',
  '--import',
  join(HERE, 'register.mjs'),
  '--max-old-space-size=256',
];

/** Fork one process per task, wait until all have signed in, release them together. */
async function runWorkers(tasks: Task[], timeoutMs: number): Promise<WorkerResult[]> {
  const children = tasks.map((task) =>
    fork(WORKER, [], {
      execArgv: EXEC_ARGV,
      env: { ...process.env, STRESS_TASK: JSON.stringify(task) },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    })
  );

  const ready = children.map(
    (c) => new Promise<void>((res, rej) => {
      c.on('message', (m: any) => m?.type === 'ready' && res());
      c.once('exit', (code) => rej(new Error(`worker exited (${code}) before ready`)));
    })
  );
  const results = children.map(
    (c, i) => new Promise<WorkerResult>((res) => {
      c.on('message', (m: any) => m?.type === 'result' && res(m.result));
      c.once('exit', (code) =>
        res({
          ok: false,
          role: tasks[i].role,
          label: tasks[i].label,
          warnings: { mockFallback: 0, swallowed: 0, samples: [] },
          error: `worker exited with code ${code} without a result`,
        })
      );
    })
  );

  const kill = () => children.forEach((c) => c.connected && c.kill());
  const timer = setTimeout(kill, timeoutMs);
  try {
    await Promise.all(ready);
    children.forEach((c) => c.send({ type: 'go' }));
    return await Promise.all(results);
  } catch (e) {
    kill();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function stats(values: number[]) {
  if (values.length === 0) return { n: 0, p50: 0, p95: 0, max: 0 };
  const s = [...values].sort((a, b) => a - b);
  const at = (q: number) => Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))]);
  return { n: s.length, p50: at(0.5), p95: at(0.95), max: Math.round(s[s.length - 1]) };
}
const fmt = (st: ReturnType<typeof stats>) => `n=${st.n} p50=${st.p50}ms p95=${st.p95}ms max=${st.max}ms`;

async function readTeam(gameId: string, teamId: string) {
  const snap = await getDoc(doc(db!, 'games', gameId, 'teams', teamId));
  return snap.data() as any;
}
async function readSubmissions(gameId: string) {
  const snap = await getDocs(collection(db!, 'games', gameId, 'submissions'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/** A fresh game created by the app's own GM code path, plus `clueCount` clues. */
async function newGame(name: string, numTeams: number, clueCount = 0) {
  const game = await gameService.createGameWithTeams(name, numTeams, 120);
  const clues = [];
  for (let i = 0; i < clueCount; i++) {
    clues.push(
      await gameService.createClue(game.id, {
        gameId: game.id,
        title: `Stress clue ${i + 1}`,
        description: 'stress',
        points: 100 + i * 10,
        location: { latitude: 2.1944, longitude: 102.2491 },
      } as any)
    );
  }
  return { game, clues };
}

async function submitAll(gameId: string, teamId: string, clueIds: string[]) {
  const ids: string[] = [];
  for (const clueId of clueIds) {
    const sub = await gameService.submitCluePhoto(gameId, {
      gameId,
      teamId,
      teamName: teamId,
      teamColor: '#000000',
      clueId,
      clueTitle: clueId,
      selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      submittedBy: 'stress-setup',
      submissionCoords: { latitude: 2.1944, longitude: 102.2491 },
    } as any);
    ids.push(sub.id);
  }
  return ids;
}

function playersFor(prefix: string, procs: number, perProc: number): PlayerSpec[][] {
  return Array.from({ length: procs }, (_, p) =>
    Array.from({ length: perProc }, (_, i) => ({ id: `${prefix}-p${p}-${i}`, nickname: `${prefix}-p${p}-${i}` }))
  );
}

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}
interface ScenarioResult {
  id: string;
  title: string;
  checks: Check[];
  metrics: Record<string, string>;
  workerErrors: string[];
}

function commonChecks(results: WorkerResult[]): { checks: Check[]; workerErrors: string[] } {
  const crashed = results.filter((r) => !r.ok);
  const mockFallback = results.reduce((a, r) => a + r.warnings.mockFallback, 0);
  const swallowed = results.reduce((a, r) => a + r.warnings.swallowed, 0);
  const samples = results.flatMap((r) => r.warnings.samples).slice(0, 3);
  return {
    checks: [
      { name: 'no worker crashed', pass: crashed.length === 0, detail: `${crashed.length} crashed` },
      { name: 'no silent fallback to mock data (B7)', pass: mockFallback === 0, detail: `${mockFallback} fallbacks` },
      {
        name: 'no swallowed write failures (heartbeat / offline)',
        pass: swallowed === 0,
        detail: swallowed ? `${swallowed}, e.g. ${samples[0]}` : '0',
      },
    ],
    workerErrors: crashed.map((r) => `${r.label}: ${r.error}`),
  };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/** S1 — Heartbeat storm: one team's players hammer heartbeat / offline (B4). */
async function s1(): Promise<ScenarioResult> {
  const procs = n(4);
  const perProc = 3;
  const { game } = await newGame('stress-s1', 2);
  const teamId = 'team_1';
  const groups = playersFor('s1', procs, perProc);

  const results = await runWorkers(
    groups.map((players, i) => ({
      role: 'presence',
      label: `s1-presence-${i}`,
      gameId: game.id,
      teamId,
      players,
      durationMs: 15000,
      minDelayMs: 0,
      maxDelayMs: 120,
    })),
    60000
  );

  const team = await readTeam(game.id, teamId);
  const members: any[] = team.members || [];
  const expected = groups.flat();
  const finalState: Record<string, boolean> = Object.assign({}, ...results.map((r) => r.data?.finalState || {}));
  const ids = members.map((m) => m.id);
  const wrong = expected.filter((p) => {
    const m = members.find((x) => x.id === p.id);
    return !m || m.isOnline !== finalState[p.id];
  });
  const common = commonChecks(results);

  return {
    id: 's1',
    title: `S1 heartbeat storm — ${expected.length} players on 1 team doc (${procs} processes)`,
    checks: [
      ...common.checks,
      { name: 'every player is in members', pass: expected.every((p) => ids.includes(p.id)), detail: `${members.length}/${expected.length}` },
      { name: 'no duplicate members', pass: new Set(ids).size === ids.length, detail: `${ids.length} entries, ${new Set(ids).size} unique` },
      {
        name: "each player's isOnline matches their last action (no lost update)",
        pass: wrong.length === 0,
        detail: wrong.length ? `${wrong.length} wrong: ${wrong.slice(0, 3).map((p) => p.id).join(', ')}` : 'all match',
      },
    ],
    metrics: {
      ops: String(results.reduce((a, r) => a + (r.data?.ops || 0), 0)),
      latency: fmt(stats(results.flatMap((r) => r.data?.latencies || []))),
    },
    workerErrors: common.workerErrors,
  };
}

/** S2 — Opening burst: every player scans the QR at once, some twice (B5). */
async function s2(): Promise<ScenarioResult> {
  const procs = n(10);
  const { game } = await newGame('stress-s2', 3);
  const pins = ['1001', '2002', '3003'];

  const results = await runWorkers(
    Array.from({ length: procs }, (_, i) => ({
      role: 'join' as const,
      label: `s2-join-${i}`,
      gameId: game.id,
      pin: pins[i % pins.length],
      nickname: `s2-player-${i}`,
      times: i % 2 === 0 ? 2 : 1, // half of them re-join (refresh / re-scan)
    })),
    60000
  );

  const allMembers: any[] = [];
  for (const teamId of ['team_1', 'team_2', 'team_3']) {
    allMembers.push(...((await readTeam(game.id, teamId)).members || []));
  }
  const ids = allMembers.map((m) => m.id);
  const joined = results.map((r) => r.data?.playerId).filter(Boolean);
  const errors = results.flatMap((r) => r.data?.errors || []);
  const common = commonChecks(results);

  return {
    id: 's2',
    title: `S2 opening burst — ${procs} players join 3 teams at once, half of them twice`,
    checks: [
      ...common.checks,
      { name: 'every join succeeded', pass: errors.length === 0, detail: errors.length ? errors[0] : `${joined.length} players` },
      { name: 'every player is in members', pass: joined.every((id) => ids.includes(id)), detail: `${new Set(ids).size}/${procs}` },
      { name: 'no duplicate members after re-join', pass: new Set(ids).size === ids.length, detail: `${ids.length} entries, ${new Set(ids).size} unique` },
    ],
    metrics: { latency: fmt(stats(results.flatMap((r) => r.data?.latencies || []))) },
    workerErrors: common.workerErrors,
  };
}

/** S3 — Hot team doc: GM approves a batch while the same team spams heartbeat + GPS (B3/B4). */
async function s3(): Promise<ScenarioResult> {
  const k = 15;
  const noiseProcs = n(3);
  const teamId = 'team_2';
  const { game, clues } = await newGame('stress-s3', 2, k);
  const subIds = await submitAll(game.id, teamId, clues.map((c) => c.id));
  const groups = playersFor('s3', noiseProcs, 2);

  const results = await runWorkers(
    [
      ...groups.map((players, i): Task => ({
        role: 'presence',
        label: `s3-noise-${i}`,
        gameId: game.id,
        teamId,
        players,
        durationMs: 8000,
        minDelayMs: 20,
        maxDelayMs: 150,
        gps: true,
      })),
      { role: 'gm', label: 's3-gm', gameId: game.id, submissionIds: subIds },
    ],
    60000
  );

  const gm = results.find((r) => r.role === 'gm')!;
  const team = await readTeam(game.id, teamId);
  const subs = await readSubmissions(game.id);
  const expectedScore = clues.reduce((a, c) => a + c.points, 0);
  const members: any[] = team.members || [];
  const common = commonChecks(results);

  return {
    id: 's3',
    title: `S3 hot team doc — GM approves ${k} at once while ${groups.flat().length} players spam heartbeat + GPS`,
    checks: [
      ...common.checks,
      {
        name: 'every approval committed (no transaction gave up)',
        pass: (gm.data?.approved?.length || 0) === k,
        detail: gm.data?.errors?.length ? gm.data.errors[0] : `${gm.data?.approved?.length}/${k}`,
      },
      { name: 'team score = sum of clue points', pass: team.score === expectedScore, detail: `${team.score} vs ${expectedScore}` },
      { name: 'all clues in completedClueIds', pass: clues.every((c) => team.completedClueIds?.includes(c.id)), detail: `${team.completedClueIds?.length}/${k}` },
      { name: 'all submissions approved', pass: subs.every((s) => s.status === 'approved'), detail: `${subs.filter((s) => s.status === 'approved').length}/${subs.length}` },
      { name: 'members intact', pass: members.length === groups.flat().length, detail: `${members.length}/${groups.flat().length}` },
    ],
    metrics: {
      'approve latency': fmt(stats(gm.data?.latencies || [])),
      'presence/gps latency': fmt(stats(results.filter((r) => r.role === 'presence').flatMap((r) => r.data?.latencies || []))),
    },
    workerErrors: common.workerErrors,
  };
}

/** S4 — Two GMs approve the same pending list at the same moment (B3). */
async function s4(): Promise<ScenarioResult> {
  const m = 10;
  const teamId = 'team_1';
  const { game, clues } = await newGame('stress-s4', 2, m);
  const subIds = await submitAll(game.id, teamId, clues.map((c) => c.id));

  const results = await runWorkers(
    [0, 1].map((i) => ({ role: 'gm' as const, label: `s4-gm-${i}`, gameId: game.id, submissionIds: subIds })),
    60000
  );

  const approvedTotal = results.reduce((a, r) => a + (r.data?.approved?.length || 0), 0);
  const errors: string[] = results.flatMap((r) => r.data?.errors || []);
  const unexpected = errors.filter((e) => !/already been reviewed/.test(e));
  const team = await readTeam(game.id, teamId);
  const expectedScore = clues.reduce((a, c) => a + c.points, 0);
  const common = commonChecks(results);

  return {
    id: 's4',
    title: `S4 two GMs — both approve the same ${m} submissions at once`,
    checks: [
      ...common.checks,
      { name: 'each submission approved exactly once', pass: approvedTotal === m, detail: `${approvedTotal} approvals for ${m} submissions` },
      { name: 'the losing GM gets "already been reviewed"', pass: unexpected.length === 0, detail: unexpected[0] || `${errors.length} rejected as expected` },
      { name: 'team score = sum of clue points (not doubled)', pass: team.score === expectedScore, detail: `${team.score} vs ${expectedScore}` },
    ],
    metrics: { 'approve latency': fmt(stats(results.flatMap((r) => r.data?.latencies || []))) },
    workerErrors: common.workerErrors,
  };
}

/** S5 — Cold start: many phones open the app before the game exists, then join (B8). */
async function s5(): Promise<ScenarioResult> {
  const procs = n(8);
  const sourceClues = 3;
  for (let i = 0; i < sourceClues; i++) {
    await gameService.createClue('hunt-nkvcz', {
      gameId: 'hunt-nkvcz',
      title: `Source clue ${i + 1}`,
      description: 'stress',
      points: 100,
      location: { latitude: 2.1944, longitude: 102.2491 },
    } as any);
  }
  const gameId = `stress-coldstart-${Date.now()}`;

  const results = await runWorkers(
    Array.from({ length: procs }, (_, i) => ({
      role: 'bootstrap' as const,
      label: `s5-boot-${i}`,
      gameId,
      joinPin: DEFAULT_TEAMS[i % DEFAULT_TEAMS.length].pin,
      nickname: `s5-player-${i}`,
    })),
    60000
  );

  const stored = (await getDoc(doc(db!, 'games', gameId))).data() as any;
  const teams = (await getDocs(collection(db!, 'games', gameId, 'teams'))).docs.map((d) => d.data() as any);
  const clueCount = (await getDocs(collection(db!, 'games', gameId, 'clues'))).size;
  const memberIds = teams.flatMap((t) => (t.members || []).map((m: any) => m.id));
  const joined = results.map((r) => r.data?.playerId).filter(Boolean);
  const disagree = results.filter((r) => r.data && r.data.createdAt !== stored?.createdAt);
  const joinRetries = results.reduce((a, r) => a + (r.data?.errors?.length || 0), 0);
  const common = commonChecks(results);

  return {
    id: 's5',
    title: `S5 cold start — ${procs} clients run initializeDefaultGame at once, then join`,
    checks: [
      ...common.checks,
      { name: 'game created', pass: Boolean(stored), detail: gameId },
      {
        name: 'only one client seeded the game (all got the stored game back)',
        pass: disagree.length === 0,
        detail: `${procs - disagree.length}/${procs} agree`,
      },
      { name: `teams = ${DEFAULT_TEAMS.length}`, pass: teams.length === DEFAULT_TEAMS.length, detail: String(teams.length) },
      { name: `clues copied = ${sourceClues}`, pass: clueCount === sourceClues, detail: String(clueCount) },
      {
        name: 'no joined player wiped by a late bootstrap',
        pass: joined.length === procs && joined.every((id) => memberIds.includes(id)),
        detail: `${memberIds.length} members for ${procs} players (${joined.length} joined)`,
      },
    ],
    metrics: {
      'bootstrap latency': fmt(stats(results.flatMap((r) => r.data?.latencies || []))),
      '"No team found" retries': String(joinRetries),
    },
    workerErrors: common.workerErrors,
  };
}

/** S6 — Fan-out: phones receive every 150KB photo in real time while teams upload. */
async function s6(): Promise<ScenarioResult> {
  const listeners = n(6);
  const uploaders = 2;
  const perUploader = 8;
  const intervalMs = 1000;
  const photoKB = 140;
  const { game, clues } = await newGame('stress-s6', uploaders, uploaders * perUploader);
  const startedAt = Date.now();
  const durationMs = (perUploader + 1) * intervalMs + 15000;

  const results = await runWorkers(
    [
      ...Array.from({ length: listeners }, (_, i): Task => ({
        role: 'listener',
        label: `s6-listener-${i}`,
        gameId: game.id,
        durationMs,
        startedAt,
      })),
      ...Array.from({ length: uploaders }, (_, u): Task => ({
        role: 'uploader',
        label: `s6-uploader-${u}`,
        gameId: game.id,
        teamId: `team_${u + 1}`,
        clueIds: clues.slice(u * perUploader, (u + 1) * perUploader).map((c) => c.id),
        photoKB,
        intervalMs,
      })),
    ],
    durationMs + 60000
  );

  const ls = results.filter((r) => r.role === 'listener');
  const ups = results.filter((r) => r.role === 'uploader');
  const uploaded = ups.reduce((a, r) => a + (r.data?.ids?.length || 0), 0);
  const uploadErrors: string[] = ups.flatMap((r) => r.data?.errors || []);
  const delivery = stats(ls.flatMap((r) => r.data?.deliveryMs || []));
  const mbPerListener = ls.map((r) => (r.data?.bytesDelivered || 0) / 1048576);
  const common = commonChecks(results);

  return {
    id: 's6',
    title: `S6 fan-out — ${listeners} phones listening, ${uploaders} teams upload ${uploaders * perUploader} × ${photoKB}KB photos`,
    checks: [
      ...common.checks,
      { name: 'every upload succeeded', pass: uploadErrors.length === 0, detail: uploadErrors[0] || `${uploaded}` },
      {
        name: 'every listener received every photo',
        pass: ls.every((r) => r.data?.received === uploaded),
        detail: ls.map((r) => r.data?.received ?? '✗').join(','),
      },
    ],
    metrics: {
      'upload latency': fmt(stats(ups.flatMap((r) => r.data?.latencies || []))),
      'upload → phone delivery': fmt(delivery),
      'snapshot callbacks / phone': String(Math.round(ls.reduce((a, r) => a + (r.data?.submissionCallbacks || 0), 0) / Math.max(1, ls.length))),
      'photo data handed to app / phone': `${(mbPerListener.reduce((a, b) => a + b, 0) / Math.max(1, ls.length)).toFixed(1)} MB (whole list is re-delivered on every change)`,
      'listener heap / rss (max)': `${Math.max(...ls.map((r) => r.data?.heapMB || 0))} MB / ${Math.max(...ls.map((r) => r.data?.rssMB || 0))} MB`,
    },
    workerErrors: common.workerErrors,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SCENARIOS: Record<string, () => Promise<ScenarioResult>> = { s1, s2, s3, s4, s5, s6 };
const selected = Object.keys(SCENARIOS).filter((id) => !ONLY || ONLY.includes(id));

console.log(`Heritage Hunt stress test — emulator ${HOST}, project ${PROJECT_ID}, scale ×${SCALE}`);
await resetEmulator();
await ensureAnonymousAuth();

const report: ScenarioResult[] = [];
for (const id of selected) {
  process.stdout.write(`\n▶ ${id} ... `);
  const t0 = Date.now();
  let r: ScenarioResult;
  try {
    r = await SCENARIOS[id]();
  } catch (e: any) {
    r = { id, title: id, checks: [{ name: 'scenario ran', pass: false, detail: e?.message }], metrics: {}, workerErrors: [e?.stack || String(e)] };
  }
  report.push(r);
  const pass = r.checks.every((c) => c.pass);
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  (${((Date.now() - t0) / 1000).toFixed(1)}s)\n  ${r.title}`);
  for (const c of r.checks) console.log(`    ${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? `  — ${c.detail}` : ''}`);
  for (const [k, v] of Object.entries(r.metrics)) console.log(`    · ${k}: ${v}`);
  for (const e of r.workerErrors.slice(0, 3)) console.log(`    ! ${e.split('\n')[0]}`);
}

const failed = report.filter((r) => !r.checks.every((c) => c.pass));
const outDir = join(HERE, 'results');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `stress-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(outFile, JSON.stringify({ scale: SCALE, at: new Date().toISOString(), report }, null, 2));

console.log(`\n${failed.length === 0 ? '✅' : '❌'} ${report.length - failed.length}/${report.length} scenarios passed   (details: ${outFile})`);
process.exit(failed.length === 0 ? 0 : 1);
