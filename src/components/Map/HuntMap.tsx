/**
 * Melaka Heritage Hunt - Interactive Leaflet Map Component
 * Path: src/components/Map/HuntMap.tsx
 *
 * Renders OpenStreetMap base layer, colored zone polygons, clue pins, live pulsing team radar markers,
 * and provides an interactive visual polygon plotting mode for the Game Master.
 */

import React, { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import type {
  Zone,
  Clue,
  Team,
  GeoCoordinate,
  RallyPoint,
} from '../../types/index.ts';
import { MELAKA_MAP_CENTER } from '../../data/melakaZones.ts';
import { calculateHaversineDistance, calculateBearing } from '../../utils/haversine.ts';
import {
  MapPin,
  Navigation,
  Crosshair,
  Undo2,
  Trash2,
  Check,
  X,
  MousePointerClick,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';

// ============================================================================
// Custom Leaflet DivIcons (No broken image asset URLs)
// ============================================================================

function createRallyFlagIcon(): L.DivIcon {
  return L.divIcon({
    className: 'custom-rally-marker',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(245, 158, 11, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="width: 38px; height: 38px; border-radius: 50%; background: #F59E0B; border: 3px solid #FFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(245,158,11,0.6); position: relative; z-index: 2;">
          <span style="font-size: 18px; line-height: 1;">🚩</span>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

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

function createVertexIcon(index: number, color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-vertex-marker',
    html: `
      <div style="
        background: ${color};
        color: #ffffff;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
        font-weight: 800;
        user-select: none;
      ">
        ${index + 1}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createClusterIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: 'custom-cluster-marker',
    html: `
      <div style="
        background: linear-gradient(135deg, #f59e0b, #ea580c);
        color: #ffffff;
        min-width: 32px;
        height: 32px;
        padding: 0 6px;
        border-radius: 9999px;
        border: 2px solid rgba(255, 255, 255, 0.95);
        box-shadow: 0 0 14px rgba(245, 158, 11, 0.65), 0 3px 8px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
        user-select: none;
      ">
        <span style="font-size: 10px;">🔥</span>
        <span>${count}</span>
      </div>
    `,
    iconSize: [38, 32],
    iconAnchor: [19, 16],
    popupAnchor: [0, -18],
  });
}

// Map Controller for Recenter & Target Center changes
function MapController({
  targetCenter,
  recenterTrigger,
}: {
  targetCenter?: GeoCoordinate | null;
  recenterTrigger?: GeoCoordinate | null;
}) {
  const map = useMap();
  useEffect(() => {
    const target = recenterTrigger || targetCenter;
    if (target) {
      map.flyTo([target.latitude, target.longitude], 17, { duration: 1.2 });
    }
  }, [targetCenter, recenterTrigger, map]);
  return null;
}

// Map Plot Click Event Handler for interactive zone drawing
function MapPlotClickHandler({
  enabled,
  onAddPoint,
}: {
  enabled: boolean;
  onAddPoint?: (point: GeoCoordinate) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled || !onAddPoint) return;
      onAddPoint({
        latitude: Number(e.latlng.lat.toFixed(6)),
        longitude: Number(e.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
}

// Map Cursor Modifier during plotting
function MapCursorHandler({ isPlotting }: { isPlotting: boolean }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (isPlotting) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
  }, [map, isPlotting]);
  return null;
}

// Map Dynamic Mobile Viewport Resize Handler
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);

    const onResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [map]);
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

  // Visual Zone Plotting Mode Props
  isPlottingZone?: boolean;
  plottingZoneId?: string | null;
  plottingZoneName?: string;
  plottingZoneColor?: string;
  plottingPoints?: GeoCoordinate[];
  onPlotPointAdd?: (point: GeoCoordinate) => void;
  onUndoPoint?: () => void;
  onClearPoints?: () => void;
  onSavePlot?: () => void;
  onCancelPlot?: () => void;
  isSavingPlot?: boolean;
  targetCenter?: GeoCoordinate | null;
  bottomOffsetClass?: string;

  // Explorer Mode & Tracking Props
  hideCluePins?: boolean;
  trackedClue?: Clue | null;
  rallyPoint?: RallyPoint | null;
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
  isPlottingZone = false,
  plottingZoneId = null,
  plottingZoneName = '',
  plottingZoneColor = '#DC2626',
  plottingPoints = [],
  onPlotPointAdd,
  onUndoPoint,
  onClearPoints,
  onSavePlot,
  onCancelPlot,
  isSavingPlot = false,
  targetCenter = null,
  bottomOffsetClass = 'bottom-4',
  hideCluePins = false,
  trackedClue = null,
  rallyPoint = null,
}) => {
  const [targetRecenter, setTargetRecenter] = React.useState<GeoCoordinate | null>(null);

  const completedSet = useMemo(() => new Set(completedClueIds), [completedClueIds]);

  // Direction ray calculation from player towards tracked clue (when not yet in 20m range)
  const trackedRay = useMemo(() => {
    if (!trackedClue?.location || !playerCoords) return null;
    const distance = calculateHaversineDistance(playerCoords, trackedClue.location);
    const bearing = calculateBearing(playerCoords, trackedClue.location);

    if (distance <= 20) {
      return { distance, bearing, isWithinRange: true, rayEnd: null };
    }

    // Directional ray (35m forward vector)
    const rayDistanceMeters = 35;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const dRad = rayDistanceMeters / 6371000;
    const lat1 = toRad(playerCoords.latitude);
    const lng1 = toRad(playerCoords.longitude);
    const brngRad = toRad(bearing);

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(dRad) + Math.cos(lat1) * Math.sin(dRad) * Math.cos(brngRad)
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(brngRad) * Math.sin(dRad) * Math.cos(lat1),
        Math.cos(dRad) - Math.sin(lat1) * Math.sin(lat2)
      );

    return {
      distance,
      bearing,
      isWithinRange: false,
      rayEnd: [toDeg(lat2), toDeg(lng2)] as [number, number],
    };
  }, [trackedClue, playerCoords]);

  const { t } = useLanguage();

  const uncompletedClues = useMemo(() => {
    return clues.filter((c) => !completedSet.has(c.id) && c.location);
  }, [clues, completedSet]);

  const completedClues = useMemo(() => {
    return clues.filter((c) => completedSet.has(c.id) && c.location);
  }, [clues, completedSet]);

  // Spatial clustering of uncompleted clues for Explorer Mode (Fuzzy Hotspot Bubbles)
  const fuzzyClusters = useMemo(() => {
    if (!hideCluePins) return [];
    const clusters: { id: string; center: [number, number]; clues: Clue[]; count: number }[] = [];
    const visited = new Set<string>();

    for (const clue of uncompletedClues) {
      if (!clue.location || visited.has(clue.id)) continue;
      const group: Clue[] = [clue];
      visited.add(clue.id);

      for (const other of uncompletedClues) {
        if (!other.location || visited.has(other.id)) continue;
        const d = calculateHaversineDistance(clue.location, other.location);
        if (d <= 45) {
          group.push(other);
          visited.add(other.id);
        }
      }

      const avgLat = group.reduce((sum, c) => sum + c.location!.latitude, 0) / group.length;
      const avgLng = group.reduce((sum, c) => sum + c.location!.longitude, 0) / group.length;

      clusters.push({
        id: `cluster-${clue.id}`,
        center: [avgLat, avgLng],
        clues: group,
        count: group.length,
      });
    }
    return clusters;
  }, [uncompletedClues, hideCluePins]);

  // Active clues within <= 20m of player reveal their exact pin & circle dynamically
  const nearbyInHotzoneClues = useMemo(() => {
    if (!hideCluePins || !playerCoords) return [];
    return uncompletedClues.filter(
      (c) => c.location && calculateHaversineDistance(playerCoords, c.location) <= 20
    );
  }, [hideCluePins, playerCoords, uncompletedClues]);

  return (
    <div className={`relative ${className} overflow-hidden bg-slate-950 isolate`}>
      <MapContainer
        center={[MELAKA_MAP_CENTER.latitude, MELAKA_MAP_CENTER.longitude]}
        zoom={16}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapResizeHandler />
        <MapController targetCenter={targetCenter} recenterTrigger={targetRecenter} />
        <MapPlotClickHandler enabled={isPlottingZone} onAddPoint={onPlotPointAdd} />
        <MapCursorHandler isPlotting={isPlottingZone} />

        {/* 1. Zone Polygons */}
        {zones.map((zone) => {
          const positions: [number, number][] = zone.polygon.map((p) => [
            p.latitude,
            p.longitude,
          ]);

          // If this zone is being edited in plotting mode, render a faint ghost reference
          if (isPlottingZone && zone.id === plottingZoneId) {
            return (
              <Polygon
                key={`ghost-${zone.id}`}
                positions={positions}
                interactive={false}
                pathOptions={{
                  color: '#64748B',
                  fillColor: '#64748B',
                  fillOpacity: 0.05,
                  weight: 1.5,
                  dashArray: '3, 6',
                }}
              />
            );
          }

          return (
            <Polygon
              key={zone.id}
              positions={positions}
              interactive={!isPlottingZone}
              pathOptions={{
                color: zone.borderColor || zone.color,
                fillColor: zone.fillColor || zone.color,
                fillOpacity: 0.18,
                weight: 2,
                dashArray: '4, 4',
              }}
            >
              {!isPlottingZone && (
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
              )}
            </Polygon>
          );
        })}

        {/* 2. Live Active Zone Plotting Preview */}
        {isPlottingZone && plottingPoints.length > 0 && (
          <>
            {/* Dashed line if exactly 2 points */}
            {plottingPoints.length === 2 && (
              <Polyline
                positions={plottingPoints.map((p) => [p.latitude, p.longitude])}
                pathOptions={{
                  color: plottingZoneColor || '#DC2626',
                  weight: 3,
                  dashArray: '6, 6',
                }}
              />
            )}

            {/* Closed polygon if 3 or more points */}
            {plottingPoints.length >= 3 && (
              <Polygon
                positions={plottingPoints.map((p) => [p.latitude, p.longitude])}
                pathOptions={{
                  color: plottingZoneColor || '#DC2626',
                  fillColor: plottingZoneColor || '#DC2626',
                  fillOpacity: 0.35,
                  weight: 3,
                  dashArray: '6, 6',
                }}
              />
            )}

            {/* Numbered Vertex Markers */}
            {plottingPoints.map((point, idx) => (
              <Marker
                key={`plot-vertex-${idx}-${point.latitude}-${point.longitude}`}
                position={[point.latitude, point.longitude]}
                icon={createVertexIcon(idx, plottingZoneColor || '#DC2626')}
                interactive={false}
              />
            ))}
          </>
        )}

        {/* 3. Clue Pins / Radar Guidance */}
        {!hideCluePins &&
          clues.map((clue) => {
            if (!clue.location) return null;
            const isDone = completedSet.has(clue.id);

            return (
              <Marker
                key={clue.id}
                position={[clue.location.latitude, clue.location.longitude]}
                icon={createClueIcon(isDone, clue.points)}
                interactive={!isPlottingZone}
              >
                {!isPlottingZone && (
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
                )}
              </Marker>
            );
          })}

        {/* Explorer Mode: Render Fuzzy Hotspot Clusters */}
        {hideCluePins &&
          fuzzyClusters.map((cluster) => (
            <React.Fragment key={cluster.id}>
              <Circle
                center={cluster.center}
                radius={38}
                pathOptions={{
                  color: '#F59E0B',
                  fillColor: '#F59E0B',
                  fillOpacity: 0.12,
                  weight: 1.5,
                  dashArray: '5, 5',
                }}
              />
              <Marker position={cluster.center} icon={createClusterIcon(cluster.count)}>
                <Popup>
                  <div className="w-56 p-1 text-slate-100">
                    <h4 className="font-bold text-sm text-amber-400 flex items-center gap-1.5 mb-1">
                      <span>🔥</span>
                      <span>{t('player.clusterAreaTitle')} ({cluster.count})</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 mb-2 leading-relaxed">
                      {t('player.clusterAreaDesc', { count: cluster.count })}
                    </p>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {cluster.clues.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => onSelectClue?.(c)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs flex items-center justify-between gap-1 cursor-pointer transition-colors"
                        >
                          <span className="font-medium text-slate-200 truncate">{c.title}</span>
                          <span className="text-[10px] font-bold text-amber-400 shrink-0">+{c.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}

        {/* Explorer Mode: Dynamically reveal pins when within <= 20m core search range */}
        {hideCluePins &&
          nearbyInHotzoneClues.map((clue) => {
            if (!clue.location) return null;
            return (
              <React.Fragment key={`hotzone-pin-${clue.id}`}>
                <Circle
                  center={[clue.location.latitude, clue.location.longitude]}
                  radius={20}
                  pathOptions={{
                    color: '#10B981',
                    fillColor: '#34D399',
                    fillOpacity: 0.25,
                    weight: 2,
                    dashArray: '4, 4',
                  }}
                />
                <Marker
                  position={[clue.location.latitude, clue.location.longitude]}
                  icon={createClueIcon(false, clue.points)}
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
                      <h4 className="font-bold text-sm text-slate-100 leading-tight mb-1">
                        {clue.title}
                      </h4>
                      <p className="text-xs text-emerald-400 font-bold mb-2">
                        🎯 已到达搜索范围（&lt;20米）！
                      </p>
                      {onSelectClue && (
                        <button
                          onClick={() => onSelectClue(clue)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          {t('player.snapNowBtn')}
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}

        {/* 5. Exact Pinpoint for Completed Clues in Explorer Mode (Revealed upon GM approval) */}
        {hideCluePins &&
          completedClues.map((clue) => {
            if (!clue.location) return null;
            return (
              <Marker
                key={`completed-exact-${clue.id}`}
                position={[clue.location.latitude, clue.location.longitude]}
                icon={createClueIcon(true, clue.points)}
                interactive={!isPlottingZone}
              >
                {!isPlottingZone && (
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
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                          +{clue.points} pts
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mb-2">
                        {clue.landmarkName || clue.zoneId}
                      </p>
                      <div className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 py-1.5 px-2 rounded-lg border border-emerald-700/50 text-center flex items-center justify-center gap-1 shadow-sm">
                        <span>✓</span>
                        <span>{t('player.foundAndVerified')}</span>
                      </div>
                      <div className="text-[10px] text-emerald-400/80 text-center mt-1.5 font-mono">
                        {t('player.exactPinRevealed')}
                      </div>
                    </div>
                  </Popup>
                )}
              </Marker>
            );
          })}

        {/* 6. Rally Point Marker & Walking Guidance Line */}
        {rallyPoint?.location && (
          <>
            <Marker
              position={[rallyPoint.location.latitude, rallyPoint.location.longitude]}
              icon={createRallyFlagIcon()}
              zIndexOffset={2000}
            >
              <Popup>
                <div className="w-56 p-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase mb-1">
                    <span>🚩</span>
                    <span>{t('player.rallyFlagTitle')}</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-100 leading-tight mb-1">
                    {rallyPoint.name}
                  </h4>
                  {rallyPoint.note && (
                    <p className="text-xs text-amber-200 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 mb-2 leading-relaxed">
                      {rallyPoint.note}
                    </p>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${rallyPoint.location.latitude},${rallyPoint.location.longitude}&travelmode=walking`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{t('player.openInGoogleMaps')}</span>
                    <ExternalLink className="w-3 h-3 text-emerald-200" />
                  </a>
                </div>
              </Popup>
            </Marker>

            {/* Walking Flight Line from player GPS to Rally Point */}
            {playerCoords && (
              <Polyline
                positions={[
                  [playerCoords.latitude, playerCoords.longitude],
                  [rallyPoint.location.latitude, rallyPoint.location.longitude],
                ]}
                pathOptions={{
                  color: '#F59E0B',
                  weight: 3,
                  dashArray: '6, 8',
                  opacity: 0.85,
                }}
              />
            )}
          </>
        )}

        {/* Explorer Mode: Directional Ray from player towards tracked target when > 20m */}
        {hideCluePins && playerCoords && trackedRay && !trackedRay.isWithinRange && trackedRay.rayEnd && (
          <Polyline
            positions={[
              [playerCoords.latitude, playerCoords.longitude],
              trackedRay.rayEnd,
            ]}
            pathOptions={{
              color: '#F59E0B',
              weight: 4,
              opacity: 0.85,
              dashArray: '6, 6',
            }}
          />
        )}

        {/* 4. Live Team Radar Markers */}
        {teams.map((team) => {
          if (!team.currentCoords) return null;
          const isCurrent = team.id === currentTeamId;

          return (
            <Marker
              key={team.id}
              position={[team.currentCoords.latitude, team.currentCoords.longitude]}
              icon={createTeamIcon(team.name, team.color, isCurrent)}
              interactive={!isPlottingZone}
            >
              {!isPlottingZone && (
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
              )}
            </Marker>
          );
        })}

        {/* 5. Player Current GPS Beacon */}
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

      {/* Explorer Mode Badge */}
      {hideCluePins && !isPlottingZone && (
        <div className="absolute top-3 left-3 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-xl text-[11px] font-bold text-slate-200 flex items-center gap-1.5 pointer-events-none">
          <Crosshair className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
          <span>探险家模式：图钉已隐藏 · 跟随雷达探索</span>
        </div>
      )}

      {/* Floating Zone Plotting HUD Toolbar */}
      {isPlottingZone && (
        <div className="absolute top-3 left-3 right-3 sm:left-auto sm:right-3 z-20 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-slate-700/90 shadow-2xl">
          {/* Zone & Live Count Info */}
          <div className="flex items-center gap-2.5 mr-1">
            <div className="relative flex items-center justify-center shrink-0">
              <span
                className="w-3.5 h-3.5 rounded-full animate-ping opacity-75 absolute"
                style={{ background: plottingZoneColor || '#DC2626' }}
              />
              <span
                className="w-3.5 h-3.5 rounded-full relative z-10"
                style={{ background: plottingZoneColor || '#DC2626' }}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-white">
                  {plottingZoneName || 'Zone Boundary'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700 font-mono">
                  {plottingPoints.length} points plotted
                </span>
              </div>
              <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1 mt-0.5">
                <MousePointerClick className="w-3 h-3 inline" />
                Click on map to drop boundary points
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
            <button
              type="button"
              onClick={onUndoPoint}
              disabled={plottingPoints.length === 0}
              title="Undo last plotted point"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Undo Last Point</span>
            </button>

            <button
              type="button"
              onClick={onClearPoints}
              disabled={plottingPoints.length === 0}
              title="Clear all plotted points"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-rose-300 hover:text-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Points</span>
            </button>

            <button
              type="button"
              onClick={onSavePlot}
              disabled={isSavingPlot || plottingPoints.length < 3}
              title={
                plottingPoints.length < 3
                  ? 'At least 3 points required to form a closed polygon'
                  : 'Save new zone boundary to game'
              }
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSavingPlot ? 'Saving...' : 'Save Zone Boundary'}</span>
            </button>

            <button
              type="button"
              onClick={onCancelPlot}
              title="Cancel plotting without saving"
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Map Recenter Buttons */}
      <div className={`absolute ${bottomOffsetClass} right-4 z-20 flex flex-col gap-2`}>
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
