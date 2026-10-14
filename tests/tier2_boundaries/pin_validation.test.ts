import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';

describe('Tier 2 - Boundary: PIN Validation & Edge Cases', () => {
  let adapter: MockGameAdapter;
  const GAME_ID_1 = 'test-game-pin-01';
  const GAME_ID_2 = 'test-game-pin-02';

  beforeEach(() => {
    adapter = new MockGameAdapter();
    adapter.createGame(GAME_ID_1);
    adapter.createGame(GAME_ID_2);
  });

  it('T2-PIN-1: Allows 4-digit PIN with leading zeros (e.g. 0042, 0000)', async () => {
    const team1 = await adapter.createTeam(GAME_ID_1, 'Team Zero 1', '#EF4444', '0042');
    const team2 = await adapter.createTeam(GAME_ID_1, 'Team Zero 2', '#3B82F6', '0000');

    assert.equal(team1.pin, '0042');
    assert.equal(team2.pin, '0000');

    const joined = await adapter.joinTeamByPin(GAME_ID_1, '0042', 'Rider');
    assert.equal(joined.team.id, team1.id);
  });

  it('T2-PIN-2: Rejects PIN with less than 4 digits (e.g. 12, 123)', async () => {
    await assert.rejects(
      async () => {
        await adapter.createTeam(GAME_ID_1, 'Short PIN Team', '#10B981', '123');
      },
      /must be exactly 4 numeric digits/i
    );
  });

  it('T2-PIN-3: Rejects PIN with more than 4 digits (e.g. 12345, 123456)', async () => {
    await assert.rejects(
      async () => {
        await adapter.createTeam(GAME_ID_1, 'Long PIN Team', '#10B981', '12345');
      },
      /must be exactly 4 numeric digits/i
    );
  });

  it('T2-PIN-4: Rejects non-numeric alphanumeric characters (e.g. 12A4, ABCD, 99-9)', async () => {
    const invalidPins = ['12A4', 'ABCD', '99-9', '12.4', '####'];
    for (const invalidPin of invalidPins) {
      await assert.rejects(
        async () => {
          await adapter.createTeam(GAME_ID_1, `Invalid Team ${invalidPin}`, '#10B981', invalidPin);
        },
        /must be exactly 4 numeric digits/i
      );
    }
  });

  it('T2-PIN-5: Trims outer whitespace but rejects inner whitespace', async () => {
    // Outer whitespace trimmed
    const team = await adapter.createTeam(GAME_ID_1, 'Trim Team', '#8B5CF6', ' 5678 ');
    assert.equal(team.pin, '5678');

    // Inner whitespace rejected
    await assert.rejects(
      async () => {
        await adapter.createTeam(GAME_ID_1, 'Inner Space Team', '#8B5CF6', '56 78');
      },
      /must be exactly 4 numeric digits/i
    );
  });

  it('T2-PIN-6: Enforces uniqueness within same game but allows identical PIN across different games', async () => {
    await adapter.createTeam(GAME_ID_1, 'Team Alpha G1', '#EF4444', '7788');

    // Duplicate in Game 1 rejected
    await assert.rejects(
      async () => {
        await adapter.createTeam(GAME_ID_1, 'Team Beta G1', '#3B82F6', '7788');
      },
      /PIN collision/i
    );

    // Same PIN in Game 2 allowed
    const teamG2 = await adapter.createTeam(GAME_ID_2, 'Team Alpha G2', '#EF4444', '7788');
    assert.equal(teamG2.pin, '7788');
  });
});
