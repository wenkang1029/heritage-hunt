/**
 * Melaka Heritage Hunt - Geolocation Tracking Hook
 * Path: src/hooks/useGeolocation.ts
 *
 * Tracks player GPS position and throttles updates to 15 seconds to conserve battery and bandwidth.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GeoCoordinate } from '../types/index.ts';
import { gameService } from '../services/gameService.ts';

export interface UseGeolocationOptions {
  gameId?: string;
  teamId?: string;
  throttleMs?: number; // Default: 15000ms (15 seconds)
  enabled?: boolean;
}

export interface UseGeolocationResult {
  currentCoords: GeoCoordinate | null;
  error: string | null;
  isTracking: boolean;
  accuracy: number | null;
  requestPermission: () => void;
}

export function useGeolocation({
  gameId,
  teamId,
  throttleMs = 15000,
  enabled = true,
}: UseGeolocationOptions = {}): UseGeolocationResult {
  const [currentCoords, setCurrentCoords] = useState<GeoCoordinate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const lastBroadcastTimeRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const broadcastCoords = useCallback(
    async (coords: GeoCoordinate) => {
      if (!gameId || !teamId) return;

      const now = Date.now();
      if (now - lastBroadcastTimeRef.current >= throttleMs) {
        lastBroadcastTimeRef.current = now;
        try {
          await gameService.updateTeamGps(gameId, teamId, coords);
        } catch (err) {
          console.warn('[useGeolocation] Failed to broadcast GPS:', err);
        }
      }
    },
    [gameId, teamId, throttleMs]
  );

  const handlePositionSuccess = useCallback(
    (position: GeolocationPosition) => {
      const coords: GeoCoordinate = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp,
      };

      setCurrentCoords(coords);
      setAccuracy(position.coords.accuracy);
      setError(null);
      setIsTracking(true);

      broadcastCoords(coords);
    },
    [broadcastCoords]
  );

  const handlePositionError = useCallback((err: GeolocationPositionError) => {
    let message = 'Unable to retrieve location.';
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = 'Location access denied by user. Please enable GPS in browser settings.';
        break;
      case err.POSITION_UNAVAILABLE:
        message = 'GPS signal unavailable. Please ensure location services are enabled.';
        break;
      case err.TIMEOUT:
        message = 'Location request timed out.';
        break;
    }
    setError(message);
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionSuccess,
      handlePositionError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  }, [handlePositionSuccess, handlePositionError]);

  useEffect(() => {
    if (enabled) {
      startTracking();
    } else if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsTracking(false);
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, startTracking]);

  return {
    currentCoords,
    error,
    isTracking,
    accuracy,
    requestPermission: startTracking,
  };
}
