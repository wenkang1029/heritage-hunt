import type { Clue } from './contracts.ts';
import { generateSyntheticBase64Image } from './compressionOracle.ts';

export const HIGH_CONTRAST_TEAM_COLORS = [
  { name: 'Crimson Tigers', color: '#EF4444' },
  { name: 'Cobalt Dolphins', color: '#3B82F6' },
  { name: 'Emerald Dragons', color: '#10B981' },
  { name: 'Amber Eagles', color: '#F59E0B' },
  { name: 'Violet Panthers', color: '#8B5CF6' },
];

export const SAMPLE_MELAKA_CLUES: Array<Omit<Clue, 'id' | 'gameId' | 'createdAt'>> = [
  {
    title: 'Jonker Street Stage Red Lanterns',
    zoneId: 'jonker-street',
    points: 100,
    targetPhotoBase64: generateSyntheticBase64Image(50 * 1024),
    location: { lat: 2.1960, lng: 102.2475 },
    hint: 'Look for the open-air cultural performance stage near the river bank.',
  },
  {
    title: 'Tan Beng Swee Clock Tower Red Facade',
    zoneId: 'dutch-square',
    points: 150,
    targetPhotoBase64: generateSyntheticBase64Image(55 * 1024),
    location: { lat: 2.1944, lng: 102.2491 },
    hint: 'Stand directly facing the crimson red tower built in 1886 in front of Stadhuys.',
  },
  {
    title: 'Cheng Hoon Teng Carved Dragon Eaves',
    zoneId: 'jalan-tokong',
    points: 120,
    targetPhotoBase64: generateSyntheticBase64Image(48 * 1024),
    location: { lat: 2.1978, lng: 102.2465 },
    hint: 'Malaysia’s oldest functioning temple along Harmony Street.',
  },
  {
    title: 'Porta de Santiago Bas-Relief Crest',
    zoneId: 'a-famosa',
    points: 180,
    targetPhotoBase64: generateSyntheticBase64Image(60 * 1024),
    location: { lat: 2.1918, lng: 102.2505 },
    hint: 'The stone relief of the Dutch East India Company coat-of-arms above the arch.',
  },
  {
    title: 'St. Francis Xavier Armless Statue',
    zoneId: 'st-pauls-hill',
    points: 200,
    targetPhotoBase64: generateSyntheticBase64Image(65 * 1024),
    location: { lat: 2.1927, lng: 102.2498 },
    hint: 'High atop Bukit St. Paul overlooking the Malacca Straits.',
  },
];

/**
 * Creates a unique 4-digit PIN string.
 */
export function generateRandomPin(): string {
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  return pin;
}

/**
 * Helper to sleep for simulated asynchronous delays in tests.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
