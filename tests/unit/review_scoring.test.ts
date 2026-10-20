/**
 * Regression tests: GM review scoring (approve / bonus / duplicate review).
 * Runs against src/services/mockAdapter.ts, which mirrors the Firestore logic in gameService.ts.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockAdapterService } from '../../src/services/mockAdapter.ts';
import type { Team } from '../../src/types/index.ts';

const CLUE_POINTS = 150;

describe('GM review scoring', () => {
  let adapter: MockAdapterService;
  let gameId: string;
  let team: Team;

  beforeEach(async () => {
    adapter = new MockAdapterService();
    gameId = adapter.getGame().id;
    team = await adapter.createTeam(gameId, 'Scoring Team', '#000000', '9911');
  });

  async function submitNewClue() {
    const clue = await adapter.createClue(gameId, {
      title: 'Scoring clue',
      points: CLUE_POINTS,
      location: { latitude: 2.1944, longitude: 102.2491 },
    } as any);
    return adapter.submitCluePhoto(gameId, {
      gameId,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      clueId: clue.id,
      clueTitle: clue.title,
      selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    } as any);
  }

  function teamScore(): number {
    let score = -1;
    adapter.subscribeToTeams(gameId, (teams) => {
      score = teams.find((t) => t.id === team.id)!.score;
    })();
    return score;
  }

  function awarded(submissionId: string): number | undefined {
    let points: number | undefined;
    adapter.subscribeToSubmissions(gameId, (subs) => {
      points = subs.find((s) => s.id === submissionId)?.awardedPoints;
    })();
    return points;
  }

  it('approve awards the clue points', async () => {
    const sub = await submitNewClue();
    await adapter.verifySubmission(gameId, sub.id, 'approve');
    assert.equal(awarded(sub.id), CLUE_POINTS);
    assert.equal(teamScore(), CLUE_POINTS);
  });

  it('bonus awards clue points plus the bonus amount', async () => {
    const sub = await submitNewClue();
    await adapter.verifySubmission(gameId, sub.id, 'bonus', 25);
    assert.equal(awarded(sub.id), CLUE_POINTS + 25);
    assert.equal(teamScore(), CLUE_POINTS + 25);
  });

  it('bonus without an amount defaults to +20', async () => {
    const sub = await submitNewClue();
    await adapter.verifySubmission(gameId, sub.id, 'bonus');
    assert.equal(awarded(sub.id), CLUE_POINTS + 20);
  });

  it('reviewing the same submission twice awards points only once', async () => {
    const sub = await submitNewClue();
    const results = await Promise.allSettled([
      adapter.verifySubmission(gameId, sub.id, 'approve'),
      adapter.verifySubmission(gameId, sub.id, 'approve'),
    ]);
    assert.deepEqual(
      results.map((r) => r.status).sort(),
      ['fulfilled', 'rejected']
    );
    assert.equal(teamScore(), CLUE_POINTS);
  });

  it('an approved submission cannot be rejected afterwards', async () => {
    const sub = await submitNewClue();
    await adapter.verifySubmission(gameId, sub.id, 'approve');
    await assert.rejects(() => adapter.verifySubmission(gameId, sub.id, 'reject'), /already been reviewed/);
    assert.equal(teamScore(), CLUE_POINTS);
  });
});
