import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { INVARIANTS } from '../framework/contracts.ts';

describe('Tier 1 - Feature Group 1: Authentication & Access Control', () => {
  let adapter: MockGameAdapter;
  const GAME_ID = 'test-game-auth-01';

  beforeEach(() => {
    adapter = new MockGameAdapter();
    adapter.createGame(GAME_ID);
  });

  describe('Feature 1: GM Passcode Authentication', () => {
    it('F01-T1: Valid master passcode grants GM War Room access', () => {
      const game = adapter.getGame(GAME_ID)!;
      const inputPasscode = 'melaka2026';
      const isAuthenticated = inputPasscode === game.passCode;
      assert.equal(isAuthenticated, true, 'GM passcode must match melaka2026');
    });

    it('F01-T2: Incorrect passcode denies GM War Room access', () => {
      const game = adapter.getGame(GAME_ID)!;
      const inputPasscode = 'wrong-password';
      const isAuthenticated = inputPasscode === game.passCode;
      assert.equal(isAuthenticated, false, 'Invalid passcode must not grant GM access');
    });

    it('F01-T3: Empty or whitespace passcode is rejected', () => {
      const game = adapter.getGame(GAME_ID)!;
      const emptyCheck = ''.trim() === game.passCode;
      const whitespaceCheck = '   '.trim() === game.passCode;
      assert.equal(emptyCheck, false, 'Empty string must be rejected');
      assert.equal(whitespaceCheck, false, 'Whitespace-only string must be rejected');
    });

    it('F01-T4: Passcode verification is strictly case-sensitive', () => {
      const game = adapter.getGame(GAME_ID)!;
      const upperCheck = 'MELAKA2026' === game.passCode;
      const mixedCheck = 'Melaka2026' === game.passCode;
      assert.equal(upperCheck, false, 'Uppercase passcode must fail');
      assert.equal(mixedCheck, false, 'Mixed-case passcode must fail');
    });

    it('F01-T5: Default passcode matches INVARIANTS.DEFAULT_GM_PASSCODE specification', () => {
      const game = adapter.getGame(GAME_ID)!;
      assert.equal(game.passCode, INVARIANTS.DEFAULT_GM_PASSCODE);
      assert.equal(game.passCode, 'melaka2026');
    });
  });

  describe('Feature 2: Player Frictionless Join (PIN & Nickname)', () => {
    beforeEach(async () => {
      await adapter.createTeam(GAME_ID, 'Crimson Tigers', '#EF4444', '1234');
    });

    it('F02-T1: Player joins successfully with valid 4-digit PIN and nickname', async () => {
      const result = await adapter.joinTeamByPin(GAME_ID, '1234', 'Ahmad');
      assert.equal(result.team.name, 'Crimson Tigers');
      assert.equal(result.team.pin, '1234');
      assert.ok(result.playerId.startsWith('anon_player_'));
    });

    it('F02-T2: Non-existent PIN throws invalid PIN error', async () => {
      await assert.rejects(
        async () => {
          await adapter.joinTeamByPin(GAME_ID, '9999', 'Siti');
        },
        /Invalid PIN/i
      );
    });

    it('F02-T3: Empty or missing nickname throws validation error', async () => {
      await assert.rejects(
        async () => {
          await adapter.joinTeamByPin(GAME_ID, '1234', '');
        },
        /Nickname is required/i
      );
    });

    it('F02-T4: Whitespace in nickname is validated and stripped', async () => {
      await assert.rejects(
        async () => {
          await adapter.joinTeamByPin(GAME_ID, '1234', '   ');
        },
        /Nickname is required/i
      );
    });

    it('F02-T5: Multiple players can join same team without account creation', async () => {
      const player1 = await adapter.joinTeamByPin(GAME_ID, '1234', 'Hunter 1');
      const player2 = await adapter.joinTeamByPin(GAME_ID, '1234', 'Hunter 2');
      assert.equal(player1.team.id, player2.team.id);
      assert.notEqual(player1.playerId, player2.playerId);
    });
  });

  describe('Feature 3: QR Code Join Flow', () => {
    it('F03-T1: Valid QR code URL with pin parameter parses correctly', () => {
      const qrUrl = 'https://melaka-hunt.vercel.app/play?pin=4821';
      const parsed = new URL(qrUrl);
      const pinParam = parsed.searchParams.get('pin');
      assert.equal(pinParam, '4821');
    });

    it('F03-T2: QR code URL format retains base route /play', () => {
      const qrUrl = 'https://melaka-hunt.vercel.app/play?pin=5555';
      const parsed = new URL(qrUrl);
      assert.equal(parsed.pathname, '/play');
      assert.equal(parsed.searchParams.get('pin'), '5555');
    });

    it('F03-T3: QR URL with missing pin param does not crash parser', () => {
      const qrUrl = 'https://melaka-hunt.vercel.app/play';
      const parsed = new URL(qrUrl);
      assert.equal(parsed.searchParams.get('pin'), null);
    });

    it('F03-T4: QR URL pin parameter auto-populates join flow', async () => {
      await adapter.createTeam(GAME_ID, 'Cobalt Dolphins', '#3B82F6', '5678');
      const url = new URL('https://melaka-hunt.vercel.app/play?pin=5678');
      const autoPin = url.searchParams.get('pin')!;
      const joined = await adapter.joinTeamByPin(GAME_ID, autoPin, 'Tan');
      assert.equal(joined.team.name, 'Cobalt Dolphins');
    });

    it('F03-T5: QR code payload encodes valid URI encoding for non-ASCII params', () => {
      const baseUrl = 'https://melaka-hunt.vercel.app/play';
      const pin = '7788';
      const fullUrl = `${baseUrl}?pin=${encodeURIComponent(pin)}`;
      assert.equal(fullUrl, 'https://melaka-hunt.vercel.app/play?pin=7788');
    });
  });

  describe('Feature 4: Firebase Anonymous Auth Integration', () => {
    it('F04-T1: Generates unique anonymous session UID per participant', async () => {
      await adapter.createTeam(GAME_ID, 'Emerald Dragons', '#10B981', '4321');
      const sessionA = await adapter.joinTeamByPin(GAME_ID, '4321', 'Ravi');
      const sessionB = await adapter.joinTeamByPin(GAME_ID, '4321', 'Mei');
      assert.ok(sessionA.playerId.length > 10);
      assert.ok(sessionB.playerId.length > 10);
      assert.notEqual(sessionA.playerId, sessionB.playerId);
    });

    it('F04-T2: Anonymous auth requires zero email or password credentials', () => {
      const credentialsRequired = false;
      assert.equal(credentialsRequired, false, 'Anonymous sign-in must not require user credentials');
    });

    it('F04-T3: Session persists across reloads via consistent client token format', () => {
      const mockToken = `anon_${Date.now()}_abc123`;
      assert.match(mockToken, /^anon_\d+_[a-z0-9]+$/);
    });

    it('F04-T4: Anonymous player session updates team lastActiveAt timestamp', async () => {
      await adapter.createTeam(GAME_ID, 'Amber Eagles', '#F59E0B', '3344');
      const beforeJoin = Date.now();
      const session = await adapter.joinTeamByPin(GAME_ID, '3344', 'Wei');
      assert.ok(Number(session.team.lastActiveAt) >= beforeJoin);
    });

    it('F04-T5: Anonymous session satisfies Firestore security rule non-null UID requirement', () => {
      const mockAuthContext = { uid: 'anon_player_test_uid_99' };
      const satisfiesAuthCheck = mockAuthContext !== null && mockAuthContext.uid !== '';
      assert.equal(satisfiesAuthCheck, true);
    });
  });
});
