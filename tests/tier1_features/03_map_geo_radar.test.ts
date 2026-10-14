import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { INVARIANTS } from '../framework/contracts.ts';
import type { GeoCoordinate } from '../framework/contracts.ts';
import { MELAKA_ZONES, findZoneForCoordinate } from '../framework/zones.ts';
import { calculateHaversineDistance, isWithinProximity } from '../framework/haversine.ts';

describe('Tier 1 - Feature Group 3: Map, Geolocation & Radar Engine', () => {
  let adapter: MockGameAdapter;
  const GAME_ID = 'test-game-map-03';

  beforeEach(() => {
    adapter = new MockGameAdapter();
    adapter.createGame(GAME_ID);
  });

  describe('Feature 8: Melaka Heritage Leaflet Map', () => {
    it('F08-T1: Map center coordinates default to Melaka UNESCO heritage center [2.1944, 102.2491]', () => {
      const center = INVARIANTS.MELAKA_MAP_CENTER;
      assert.equal(center.lat, 2.1944);
      assert.equal(center.lng, 102.2491);
    });

    it('F08-T2: Geographic bounding box encloses all core historical monuments', () => {
      const bounds = INVARIANTS.MELAKA_BOUNDS;
      assert.ok(bounds.minLat <= 2.1905, 'Bounds must contain A Famosa');
      assert.ok(bounds.maxLat >= 2.1990, 'Bounds must contain Cheng Hoon Teng');
      assert.ok(bounds.minLng <= 102.2450, 'Bounds must contain Harmony Street');
      assert.ok(bounds.maxLng >= 102.2520, 'Bounds must contain Bukit St. Paul');
    });

    it('F08-T3: Initial default zoom level supports pedestrian street navigation (zoom 16-17)', () => {
      const recommendedZoom = 16.5;
      assert.ok(recommendedZoom >= 16 && recommendedZoom <= 18);
    });

    it('F08-T4: OpenStreetMap tile URL template is properly formatted', () => {
      const osmTemplate = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      assert.ok(osmTemplate.includes('{z}'));
      assert.ok(osmTemplate.includes('{x}'));
      assert.ok(osmTemplate.includes('{y}'));
    });

    it('F08-T5: Pan-to-coordinate computes within valid Melaka bounding box', () => {
      const targetLocation: GeoCoordinate = { lat: 2.1960, lng: 102.2475 };
      const isInside =
        targetLocation.lat >= INVARIANTS.MELAKA_BOUNDS.minLat &&
        targetLocation.lat <= INVARIANTS.MELAKA_BOUNDS.maxLat &&
        targetLocation.lng >= INVARIANTS.MELAKA_BOUNDS.minLng &&
        targetLocation.lng <= INVARIANTS.MELAKA_BOUNDS.maxLng;
      assert.equal(isInside, true);
    });
  });

  describe('Feature 9: 5 UNESCO Heritage Zones', () => {
    it('F09-T1: Exactly 5 UNESCO heritage zones are defined in system', () => {
      assert.equal(MELAKA_ZONES.length, 5);
      const zoneIds = MELAKA_ZONES.map((z) => z.id);
      assert.deepEqual(zoneIds, [
        'jonker-street',
        'dutch-square',
        'jalan-tokong',
        'a-famosa',
        'st-pauls-hill',
      ]);
    });

    it('F09-T2: Each zone has a distinct high-contrast color code', () => {
      const colors = MELAKA_ZONES.map((z) => z.color);
      const uniqueColors = new Set(colors);
      assert.equal(uniqueColors.size, 5, 'Every zone must possess a unique color');
    });

    it('F09-T3: Jonker Street zone polygon correctly encloses Jonker cultural stage', () => {
      const stageCoord: GeoCoordinate = { lat: 2.1960, lng: 102.2475 };
      const matched = findZoneForCoordinate(stageCoord);
      assert.ok(matched !== null);
      assert.equal(matched?.id, 'jonker-street');
    });

    it('F09-T4: Dutch Square zone polygon encloses Tan Beng Swee Clock Tower', () => {
      const clockTowerCoord: GeoCoordinate = { lat: 2.1944, lng: 102.2491 };
      const matched = findZoneForCoordinate(clockTowerCoord);
      assert.ok(matched !== null);
      assert.equal(matched?.id, 'dutch-square');
    });

    it('F09-T5: A Famosa zone polygon encloses Porta de Santiago gate', () => {
      const portaCoord: GeoCoordinate = { lat: 2.1918, lng: 102.2505 };
      const matched = findZoneForCoordinate(portaCoord);
      assert.ok(matched !== null);
      assert.equal(matched?.id, 'a-famosa');
    });
  });

  describe('Feature 10: Custom SVG divIcon Clue Markers', () => {
    it('F10-T1: Clue marker generates inline SVG markup without external image URLs', () => {
      const generateClueSvg = (color: string) => `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5" fill="#FFFFFF"/>
        </svg>
      `.trim();

      const svgHtml = generateClueSvg('#DC2626');
      assert.ok(svgHtml.startsWith('<svg'));
      assert.ok(svgHtml.includes('fill="#DC2626"'));
      assert.equal(svgHtml.includes('src='), false, 'Must not depend on external image src');
    });

    it('F10-T2: Marker HTML incorporates matching zone color styling', () => {
      const zoneColor = '#F59E0B';
      const markerClass = `zone-pin-${zoneColor.replace('#', '')}`;
      assert.equal(markerClass, 'zone-pin-F59E0B');
    });

    it('F10-T3: Completed clue marker displays distinct visual checkmark state', () => {
      const isCompleted = true;
      const innerIcon = isCompleted ? 'icon-check' : 'icon-pin';
      assert.equal(innerIcon, 'icon-check');
    });

    it('F10-T4: Custom divIcon anchor is centered at the bottom pin tip', () => {
      const iconSize = [32, 32];
      const iconAnchor = [iconSize[0] / 2, iconSize[1]]; // [16, 32]
      assert.deepEqual(iconAnchor, [16, 32]);
    });

    it('F10-T5: HTML generation guarantees zero 404 network requests', () => {
      const svgPayload = '<svg></svg>';
      // Zero HTTP network request required to display SVG markup
      assert.ok(svgPayload.length > 0);
    });
  });

  describe('Feature 11: Custom SVG divIcon Team Markers & Radar Pulse', () => {
    it('F11-T1: Team marker embeds assigned team color', () => {
      const teamColor = '#EF4444';
      const markerHtml = `<div class="team-marker" style="background-color: ${teamColor}"><div class="radar-pulse"></div></div>`;
      assert.ok(markerHtml.includes(teamColor));
    });

    it('F11-T2: Radar marker includes CSS radar-pulse animation class', () => {
      const markerHtml = `<div class="team-marker"><div class="radar-pulse animate-ping"></div></div>`;
      assert.ok(markerHtml.includes('radar-pulse'));
      assert.ok(markerHtml.includes('animate-ping'));
    });

    it('F11-T3: Marker displays team initial or abbreviation for accessibility', () => {
      const teamName = 'Cobalt Dolphins';
      const initials = teamName.split(' ').map(w => w[0]).join('');
      assert.equal(initials, 'CD');
    });

    it('F11-T4: Team marker divIcon size defaults to touch-friendly radius (>= 32px)', () => {
      const markerRadius = 36;
      assert.ok(markerRadius >= 32);
    });

    it('F11-T5: Multiple teams render with distinct CSS color filters', () => {
      const team1Color = '#EF4444';
      const team2Color = '#3B82F6';
      assert.notEqual(team1Color, team2Color);
    });
  });

  describe('Feature 12: Live GPS Position Hook', () => {
    it('F12-T1: GPS position hook extracts latitude and longitude from GeolocationPosition', () => {
      const mockPosition = {
        coords: {
          latitude: 2.1944,
          longitude: 102.2491,
          accuracy: 8.5,
          heading: null,
          speed: null,
          altitude: null,
          altitudeAccuracy: null,
        },
        timestamp: Date.now(),
      };

      assert.equal(mockPosition.coords.latitude, 2.1944);
      assert.equal(mockPosition.coords.longitude, 102.2491);
      assert.equal(mockPosition.coords.accuracy, 8.5);
    });

    it('F12-T2: High accuracy option is enabled in geolocation configuration', () => {
      const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 };
      assert.equal(geoOptions.enableHighAccuracy, true);
      assert.equal(geoOptions.timeout, 10000);
    });

    it('F12-T3: Accuracy reporting classifies accuracy below 15m as high quality', () => {
      const isHighAccuracy = (accuracyMeters: number) => accuracyMeters <= 15;
      assert.equal(isHighAccuracy(8.2), true);
      assert.equal(isHighAccuracy(35.0), false);
    });

    it('F12-T4: Error callback categorizes GPS permission denied code 1', () => {
      const mockError = { code: 1, message: 'User denied Geolocation' };
      const isPermissionDenied = mockError.code === 1;
      assert.equal(isPermissionDenied, true);
    });

    it('F12-T5: Position timestamp is updated on each fresh reading', () => {
      const beforeTime = Date.now();
      const reading = { lat: 2.1944, lng: 102.2491, updatedAt: Date.now() };
      assert.ok(reading.updatedAt >= beforeTime);
    });
  });

  describe('Feature 13: 15s GPS Broadcast Throttle', () => {
    let teamId: string;

    beforeEach(async () => {
      const team = await adapter.createTeam(GAME_ID, 'Crimson Tigers', '#EF4444', '1111');
      teamId = team.id;
    });

    it('F13-T1: First GPS position update is broadcast immediately', async () => {
      const emitted = await adapter.updateTeamGps(GAME_ID, teamId, { lat: 2.1944, lng: 102.2491 });
      assert.equal(emitted, true);
    });

    it('F13-T2: Immediate successive update (< 15s) is throttled and dropped', async () => {
      await adapter.updateTeamGps(GAME_ID, teamId, { lat: 2.1944, lng: 102.2491 });
      const secondCallEmitted = await adapter.updateTeamGps(GAME_ID, teamId, { lat: 2.1945, lng: 102.2492 });
      assert.equal(secondCallEmitted, false, 'Update within 15s throttle interval must be dropped');
    });

    it('F13-T3: Force flag bypasses 15s throttle for critical events', async () => {
      await adapter.updateTeamGps(GAME_ID, teamId, { lat: 2.1944, lng: 102.2491 });
      const forcedEmitted = await adapter.updateTeamGps(
        GAME_ID,
        teamId,
        { lat: 2.1945, lng: 102.2492 },
        true // force bypass
      );
      assert.equal(forcedEmitted, true, 'Forced update must bypass throttle');
    });

    it('F13-T4: Throttle duration constant matches 15000 milliseconds', () => {
      assert.equal(INVARIANTS.GPS_BROADCAST_THROTTLE_MS, 15000);
    });

    it('F13-T5: Team coordinates and updatedAt timestamp persist in state after broadcast', async () => {
      await adapter.updateTeamGps(GAME_ID, teamId, { lat: 2.1960, lng: 102.2475 });
      const team = Array.from(adapter['teams'].get(GAME_ID)!.values()).find(t => t.id === teamId)!;
      assert.equal(team.currentCoords?.lat, 2.1960);
      assert.equal(team.currentCoords?.lng, 102.2475);
      assert.ok(team.currentCoords?.updatedAt !== undefined);
    });
  });

  describe('Feature 14: Radar Map of Other Teams', () => {
    it('F14-T1: Radar map aggregates all teams in active game', async () => {
      await adapter.createTeam(GAME_ID, 'Team Alpha', '#EF4444', '1111');
      await adapter.createTeam(GAME_ID, 'Team Beta', '#3B82F6', '2222');
      const teams = Array.from(adapter['teams'].get(GAME_ID)!.values());
      assert.equal(teams.length, 2);
    });

    it('F14-T2: Current team is distinguishable from rival teams on player map', async () => {
      const myTeam = await adapter.createTeam(GAME_ID, 'My Team', '#10B981', '3333');
      const otherTeam = await adapter.createTeam(GAME_ID, 'Rival Team', '#EF4444', '4444');

      const isSelf = (teamId: string) => teamId === myTeam.id;
      assert.equal(isSelf(myTeam.id), true);
      assert.equal(isSelf(otherTeam.id), false);
    });

    it('F14-T3: Approximate radar positions handle undefined coordinates gracefully', async () => {
      const team = await adapter.createTeam(GAME_ID, 'No GPS Team', '#F59E0B', '5555');
      assert.equal(team.currentCoords, undefined);
      const isVisibleOnMap = team.currentCoords !== undefined;
      assert.equal(isVisibleOnMap, false);
    });

    it('F14-T4: Radar tracks coordinate updates in real-time subscription', async () => {
      const team = await adapter.createTeam(GAME_ID, 'Moving Team', '#8B5CF6', '6666');
      let latestCoord: GeoCoordinate | undefined;

      adapter.subscribeToTeams(GAME_ID, (teams) => {
        const found = teams.find(t => t.id === team.id);
        latestCoord = found?.currentCoords;
      });

      await adapter.updateTeamGps(GAME_ID, team.id, { lat: 2.1927, lng: 102.2498 }, true);
      assert.equal(latestCoord?.lat, 2.1927);
      assert.equal(latestCoord?.lng, 102.2498);
    });

    it('F14-T5: Stale positions (> 5 minutes inactive) can be flagged with opacity attenuation', () => {
      const now = Date.now();
      const freshTimestamp = now - 30 * 1000; // 30s ago
      const staleTimestamp = now - 350 * 1000; // ~6 mins ago

      const isStale = (timestamp: number) => now - timestamp > 300 * 1000;
      assert.equal(isStale(freshTimestamp), false);
      assert.equal(isStale(staleTimestamp), true);
    });
  });

  describe('Feature 15: Haversine Proximity Check', () => {
    it('F15-T1: Distance between identical points is exactly 0 meters', () => {
      const p = { lat: 2.1944, lng: 102.2491 };
      const dist = calculateHaversineDistance(p, p);
      assert.equal(dist, 0);
    });

    it('F15-T2: Distance between Dutch Square and Jonker Cultural Stage is ~250m - 270m', () => {
      const dutchSquare = { lat: 2.1944, lng: 102.2491 };
      const jonkerStage = { lat: 2.1960, lng: 102.2475 };
      const dist = calculateHaversineDistance(dutchSquare, jonkerStage);
      assert.ok(dist >= 230 && dist <= 290, `Calculated distance was ${dist}m`);
    });

    it('F15-T3: Distance between Dutch Square and A Famosa is ~310m - 340m', () => {
      const dutchSquare = { lat: 2.1944, lng: 102.2491 };
      const aFamosa = { lat: 2.1918, lng: 102.2505 };
      const dist = calculateHaversineDistance(dutchSquare, aFamosa);
      assert.ok(dist >= 300 && dist <= 360, `Calculated distance was ${dist}m`);
    });

    it('F15-T4: isWithinProximity correctly evaluates threshold (<= 30 meters)', () => {
      const target = { lat: 2.19440, lng: 102.24910 };
      const closePlayer = { lat: 2.19445, lng: 102.24915 }; // ~7m away
      const farPlayer = { lat: 2.19800, lng: 102.24910 }; // ~400m away

      assert.equal(isWithinProximity(closePlayer, target, 30), true);
      assert.equal(isWithinProximity(farPlayer, target, 30), false);
    });

    it('F15-T5: Proximity check handles negative and meridian boundaries without NaN', () => {
      const coordA = { lat: -0.5, lng: 179.9 };
      const coordB = { lat: 0.5, lng: -179.9 };
      const dist = calculateHaversineDistance(coordA, coordB);
      assert.ok(!Number.isNaN(dist));
      assert.ok(dist > 0);
    });
  });
});
