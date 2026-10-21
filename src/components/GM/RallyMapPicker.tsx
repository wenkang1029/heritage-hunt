import React, { useEffect, useState, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { GeoCoordinate } from '../../types/index.ts';
import { createRallyFlagIcon } from '../Map/mapIcons.ts';
import { Crosshair, ExternalLink, Loader2, Sparkles, MapPin } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface RallyMapPickerProps {
  selectedCoords: GeoCoordinate;
  onCoordsChange: (coords: GeoCoordinate) => void;
  onCustomSelect: () => void;
  flyTrigger?: number;
}

// 1. Ensures Leaflet tiles calculate correctly inside modal flex containers
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// 2. Smoothly pans to coordinate changes only when triggered (presets or Locate Me)
function MapFlyToHandler({ coords, trigger }: { coords: GeoCoordinate; trigger: number }) {
  const map = useMap();
  const prevTrigger = useRef(trigger);

  useEffect(() => {
    if (trigger !== prevTrigger.current) {
      prevTrigger.current = trigger;
      map.flyTo([coords.latitude, coords.longitude], Math.max(map.getZoom(), 17), {
        duration: 0.6,
      });
    }
  }, [map, coords, trigger]);
  return null;
}

// 3. Click-to-pinpoint handler
function MapClickHandler({
  onPick,
}: {
  onPick: (coords: GeoCoordinate) => void;
}) {
  useMapEvents({
    click(e) {
      onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

export const RallyMapPicker: React.FC<RallyMapPickerProps> = ({
  selectedCoords,
  onCoordsChange,
  onCustomSelect,
  flyTrigger = 0,
}) => {
  const { t, language } = useLanguage();
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [internalFlyTrigger, setInternalFlyTrigger] = useState<number>(flyTrigger);
  const [justPicked, setJustPicked] = useState<boolean>(false);

  useEffect(() => {
    setInternalFlyTrigger(flyTrigger);
  }, [flyTrigger]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation not supported on this device');
      return;
    }
    setIsLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const newCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        onCoordsChange(newCoords);
        onCustomSelect();
        setInternalFlyTrigger((prev) => prev + 1);
        setJustPicked(true);
        setTimeout(() => setJustPicked(false), 2000);
      },
      (_err) => {
        setIsLocating(false);
        setLocateError(t('gm.locationPermissionError'));
        setTimeout(() => setLocateError(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleMarkerDragEnd = (e: any) => {
    const latlng = e.target.getLatLng();
    onCoordsChange({
      latitude: latlng.lat,
      longitude: latlng.lng,
    });
    onCustomSelect();
    setJustPicked(true);
    setTimeout(() => setJustPicked(false), 2000);
  };

  const handleMapClick = (coords: GeoCoordinate) => {
    onCoordsChange(coords);
    onCustomSelect();
    setJustPicked(true);
    setTimeout(() => setJustPicked(false), 2000);
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/80 shadow-inner bg-slate-950">
      {/* Map Container */}
      <div className="h-64 sm:h-72 w-full">
        <MapContainer
          center={[selectedCoords.latitude, selectedCoords.longitude]}
          zoom={17}
          zoomControl={true}
          scrollWheelZoom={true}
          className="h-full w-full z-0 cursor-crosshair"
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapResizeHandler />
          <MapFlyToHandler coords={selectedCoords} trigger={internalFlyTrigger} />
          <MapClickHandler onPick={handleMapClick} />

          {/* Visual Ripple Circle around the Rally Flag */}
          <Circle
            center={[selectedCoords.latitude, selectedCoords.longitude]}
            radius={15}
            pathOptions={{
              color: '#F59E0B',
              fillColor: '#F59E0B',
              fillOpacity: 0.15,
              weight: 2,
              dashArray: '3, 6',
            }}
          />

          <Marker
            position={[selectedCoords.latitude, selectedCoords.longitude]}
            icon={createRallyFlagIcon()}
            draggable={true}
            eventHandlers={{
              dragend: handleMarkerDragEnd,
            }}
          />
        </MapContainer>
      </div>

      {/* Top Banner Hint */}
      <div className="absolute top-2 left-2 right-14 z-[400] pointer-events-none">
        <div className={`backdrop-blur-md border text-[10px] font-bold py-1 px-2.5 rounded-lg shadow-md flex items-center gap-1.5 w-fit transition-all ${
          justPicked
            ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300 scale-105'
            : 'bg-slate-900/90 border-slate-700/80 text-amber-300'
        }`}>
          {justPicked ? (
            <>
              <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>{language === 'zh' ? '✓ 已落点！可继续拖动或点击调整' : '✓ Pinned! Drag or tap to adjust'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{t('gm.rallyMapTapHint')}</span>
            </>
          )}
        </div>
      </div>

      {/* Floating GPS Button */}
      <div className="absolute top-2 right-2 z-[400]">
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          className="p-2 bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer flex items-center justify-center disabled:opacity-50"
          title={t('gm.useMyLocation')}
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          ) : (
            <Crosshair className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Bottom Coordinates & External Map Pill */}
      <div className="absolute bottom-2 left-2 right-2 z-[400] flex items-center justify-between gap-1 pointer-events-none">
        <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 px-2.5 py-1 rounded-lg text-[10px] text-slate-300 font-mono shadow pointer-events-auto">
          {selectedCoords.latitude.toFixed(5)}°, {selectedCoords.longitude.toFixed(5)}°
        </div>

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${selectedCoords.latitude},${selectedCoords.longitude}&travelmode=walking`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-slate-900/90 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow flex items-center gap-1 transition-colors pointer-events-auto cursor-pointer"
        >
          <span>Google Maps</span>
          <ExternalLink className="w-2.5 h-2.5 text-emerald-400" />
        </a>
      </div>

      {/* Temporary Error Notice if Geolocation fails */}
      {locateError && (
        <div className="absolute bottom-10 left-2 right-2 z-[500] bg-rose-950/90 border border-rose-500/50 text-rose-200 text-[10px] p-2 rounded-lg text-center backdrop-blur-md">
          {locateError}
        </div>
      )}
    </div>
  );
};
