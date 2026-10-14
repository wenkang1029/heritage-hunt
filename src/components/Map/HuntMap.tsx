/**
 * Melaka Heritage Hunt - Interactive Leaflet Map Component
 * Path: src/components/Map/HuntMap.tsx
 *
 * Renders OpenStreetMap base layer, colored zone polygons, clue pins, and live pulsing team radar markers.
 */

import React, { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  Popup,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type {
  Zone,
  Clue,
  Team,
  GeoCoordinate,
} from '../../types/index.ts';
import { MELAKA_MAP_CENTER } from '../../data/melakaZones.ts';
import { MapPin, Navigation, Crosshair } from 'lucide-react';

// ============================================================================
// Custom Leaflet DivIcons (No broken image asset URLs)
// ============================================================================

function createClueIcon(isCompleted: boolean, points: number): L.DivIcon {
  const bgColor = isCompleted ? '#10B981' : '#F59E0B';
  const borderColor = isCompleted ? '#059669' : '#D97706';
  const iconSvg = isCompleted
    ? `<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>`
    : `<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`;

  return L.divIcon({
    className: 'custom-clue-marker',
    html: `
      <div style="
        background: ${bgColor};
        border: 2px solid ${borderColor};
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        position: relative;
        cursor: pointer;
        transition: transform 0.2s ease;
      ">
        ${iconSvg}
        <span style="
          position: absolute;
          bottom: -6px;
          right: -8px;
          background: #1e293b;
          color: #f8fafc;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 9999px;
          border: 1px solid ${borderColor};
        ">${points}</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function createTeamIcon(teamName: string, teamColor: string, isCurrentTeam: boolean): L.DivIcon {
  return L.divIcon({
    className: 'custom-team-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <div style="
          background: ${teamColor};
          width: ${isCurrentTeam ? '22px' : '16px'};
          height: ${isCurrentTeam ? '22px' : '16px'};
          border-radius: 50%;
          border: 3px solid #ffffff;
          box-shadow: 0 0 14px ${teamColor};
          animation: team-pulse 2s infinite;
          --team-rgb: ${teamColor};
        "></div>
        <div style="
          background: rgba(15, 23, 42, 0.85);
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 6px;
          border: 1px solid ${teamColor};
          margin-top: 4px;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        ">${teamName}${isCurrentTeam ? ' (You)' : ''}</div>
      </div>
    `,
    iconSize: [80, 40],
    iconAnchor: [40, isCurrentTeam ? 11 : 8],
    popupAnchor: [0, -20],
  });
}

// Map Controller for Recenter buttons
function MapController({ targetCenter }: { targetCenter: GeoCoordinate | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetCenter) {
      map.flyTo([targetCenter.latitude, targetCenter.longitude], 17, { duration: 1.2 });
    }
  }, [targetCenter, map]);
  return null;
}

// ============================================================================
// Main HuntMap Component
// ============================================================================

export interface HuntMapProps {
  zones?: readonly Zone[] | Zone[];
  clues?: Clue[];
  teams?: Team[];
  currentTeamId?: string;
  playerCoords?: GeoCoordinate | null;
  completedClueIds?: string[];
  onSelectClue?: (clue: Clue) => void;
  className?: string;
}

export const HuntMap: React.FC<HuntMapProps> = ({
  zones = [],
  clues = [],
  teams = [],
  currentTeamId,
  playerCoords,
  completedClueIds = [],
  onSelectClue,
  className = 'h-full w-full',
}) => {
  const [targetRecenter, setTargetRecenter] = React.useState<GeoCoordinate | null>(null);

  const completedSet = useMemo(() => new Set(completedClueIds), [completedClueIds]);

  return (
    <div className={`relative ${className} overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl`}>
      <MapContainer
        center={[MELAKA_MAP_CENTER.latitude, MELAKA_MAP_CENTER.longitude]}
        zoom={16}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
        style={{ minHeight: '380px', height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapController targetCenter={targetRecenter} />

        {/* 1. Zone Polygons */}
        {zones.map((zone) => {
          const positions: [number, number][] = zone.polygon.map((p) => [
            p.latitude,
            p.longitude,
          ]);
          return (
            <Polygon
              key={zone.id}
              positions={positions}
              pathOptions={{
                color: zone.borderColor || zone.color,
                fillColor: zone.fillColor || zone.color,
                fillOpacity: 0.18,
                weight: 2,
                dashArray: '4, 4',
              }}
            >
              <Popup>
                <div className="p-1">
                  <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ background: zone.color }}
                    />
                    {zone.name}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">{zone.description}</p>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* 2. Clue Pins */}
        {clues.map((clue) => {
          if (!clue.location) return null;
          const isDone = completedSet.has(clue.id);

          return (
            <Marker
              key={clue.id}
              position={[clue.location.latitude, clue.location.longitude]}
              icon={createClueIcon(isDone, clue.points)}
            >
              <Popup>
                <div className="w-56 p-1">
                  {clue.targetPhotoBase64 && (
                    <div className="w-full h-28 overflow-hidden rounded-md mb-2 bg-slate-800">
                      <img
                        src={clue.targetPhotoBase64}
                        alt={clue.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h4 className="font-bold text-sm text-slate-100 leading-tight">
                      {clue.title}
                    </h4>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                      +{clue.points} pts
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mb-2 line-clamp-2">
                    {clue.hint || clue.description || 'Locate this landmark detail and take a team selfie!'}
                  </p>

                  {isDone ? (
                    <div className="text-center text-xs font-bold text-emerald-400 bg-emerald-950/60 py-1.5 rounded-lg border border-emerald-600/40">
                      ✓ Completed!
                    </div>
                  ) : onSelectClue ? (
                    <button
                      onClick={() => onSelectClue(clue)}
                      className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      View Clue & Submit Selfie
                    </button>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 3. Live Team Radar Markers */}
        {teams.map((team) => {
          if (!team.currentCoords) return null;
          const isCurrent = team.id === currentTeamId;

          return (
            <Marker
              key={team.id}
              position={[team.currentCoords.latitude, team.currentCoords.longitude]}
              icon={createTeamIcon(team.name, team.color, isCurrent)}
            >
              <Popup>
                <div className="text-xs text-slate-100 p-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: team.color }}
                    />
                    {team.name}
                  </div>
                  <div className="text-slate-300 mt-1">Score: <strong className="text-amber-400">{team.score} pts</strong></div>
                  <div className="text-slate-400 text-[10px]">
                    Clues Found: {team.completedClueIds?.length || 0}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 4. Player Current GPS Beacon */}
        {playerCoords && (
          <>
            <Circle
              center={[playerCoords.latitude, playerCoords.longitude]}
              radius={playerCoords.accuracy || 20}
              pathOptions={{
                color: '#3B82F6',
                fillColor: '#60A5FA',
                fillOpacity: 0.15,
                weight: 1,
              }}
            />
            <Marker
              position={[playerCoords.latitude, playerCoords.longitude]}
              icon={L.divIcon({
                className: 'player-gps-dot',
                html: `
                  <div style="
                    background: #2563EB;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    border: 3px solid #ffffff;
                    box-shadow: 0 0 10px #3b82f6;
                  "></div>
                `,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            />
          </>
        )}
      </MapContainer>

      {/* Map Recenter Buttons */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
        {playerCoords && (
          <button
            onClick={() => setTargetRecenter(playerCoords)}
            title="Recenter on My Location"
            className="bg-slate-900/90 hover:bg-slate-800 text-blue-400 hover:text-blue-300 p-2.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md transition-all cursor-pointer"
          >
            <Navigation className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={() => setTargetRecenter(MELAKA_MAP_CENTER)}
          title="Recenter on Melaka Historic Core"
          className="bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white p-2.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md transition-all cursor-pointer"
        >
          <Crosshair className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
