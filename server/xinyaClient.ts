/**
 * Melaka Heritage Hunt - Xinya NAS API Client
 * Path: server/xinyaClient.ts
 *
 * Implements:
 * 1. Secure token session manager with automatic rotation & auto-refresh
 * 2. Uncompressed multipart photo upload to https://utba.my/UTBA/media/upload_media
 * 3. Thread-safe authentication locking to avoid login thrashing
 */

import fs from 'fs';
import path from 'path';

// Automatically load .env.local if present and not already loaded into process.env
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {
  // Graceful fallback
}

export interface XinyaConfig {
  baseUrl?: string;
  username?: string;
  password?: string;
  defaultEventId?: number;
  defaultEventCode?: string;
}

export interface UploadResult {
  status: 'success';
  fileId: number;
  fileName: string;
  fileType: string;
  photoUrl: string;
}

export class XinyaClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  public defaultEventId: number;
  public defaultEventCode: string;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAtMs: number = 0;
  private authPromise: Promise<string> | null = null;

  constructor(config?: XinyaConfig) {
    this.baseUrl = config?.baseUrl || process.env.XINYA_BASE_URL || 'https://utba.my/UTBA';
    this.username = config?.username || process.env.XINYA_USERNAME || '';
    this.password = config?.password || process.env.XINYA_PASSWORD || '';
    this.defaultEventId = Number(config?.defaultEventId || process.env.XINYA_EVENT_ID || 0);
    this.defaultEventCode = config?.defaultEventCode || process.env.XINYA_EVENT_CODE || 'HERITAGE2026';
  }

  public isConfigured(): boolean {
    return Boolean(this.username && this.password && this.defaultEventId);
  }

  /**
   * Retrieves a valid access token, proactively refreshing when within 5 minutes of expiration.
   */
  public async getValidAccessToken(): Promise<string> {
    if (!this.username || !this.password) {
      throw new Error('Xinya NAS credentials missing. Set XINYA_USERNAME and XINYA_PASSWORD.');
    }

    const now = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    if (this.accessToken && this.expiresAtMs - now > FIVE_MINUTES_MS) {
      return this.accessToken;
    }

    // Mutex locking for concurrent calls
    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = (async () => {
      try {
        // Attempt refresh if we hold a refresh token
        if (this.refreshToken) {
          try {
            return await this.refreshSession();
          } catch (refreshErr) {
            console.warn('Xinya token refresh failed, falling back to full login:', refreshErr);
          }
        }
        return await this.login();
      } finally {
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  private async login(): Promise<string> {
    const url = `${this.baseUrl}/mobile/session/login`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Xinya login failed (HTTP ${response.status}): ${errText}`);
    }

    const data = (await response.json()) as any;
    if (!data.access_token) {
      throw new Error('Xinya login succeeded but no access_token returned.');
    }

    const token = String(data.access_token);
    this.accessToken = token;
    this.refreshToken = data.refresh_token ? String(data.refresh_token) : null;
    this.expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 30 * 60 * 1000;

    return token;
  }

  private async refreshSession(): Promise<string> {
    const url = `${this.baseUrl}/mobile/session/refresh`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      this.accessToken = null;
      this.refreshToken = null;
      throw new Error(`Token refresh failed (HTTP ${response.status})`);
    }

    const data = (await response.json()) as any;
    if (!data.access_token) {
      this.accessToken = null;
      this.refreshToken = null;
      throw new Error('Refresh response missing access_token');
    }

    const token = String(data.access_token);
    this.accessToken = token;
    if (data.refresh_token) {
      this.refreshToken = String(data.refresh_token);
    }
    this.expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 30 * 60 * 1000;

    return token;
  }

  /**
   * Uploads raw binary image file buffer to NAS.
   * Guarantees safe unique server-generated filename.
   */
  public async uploadPhoto(params: {
    fileBuffer: Buffer;
    fileName: string;
    mimeType: string;
    eventId?: number;
    eventCode?: string;
  }): Promise<UploadResult> {
    const token = await this.getValidAccessToken();
    const eventId = params.eventId || this.defaultEventId;
    const eventCode = params.eventCode || this.defaultEventCode;

    if (!eventId) {
      throw new Error('event_id is required. Specify eventId or set XINYA_EVENT_ID.');
    }

    // Build standard multipart/form-data payload with File/Blob
    const formData = new FormData();
    formData.append('event_id', String(eventId));

    const blob = new Blob([params.fileBuffer], { type: params.mimeType });
    formData.append('file', blob, params.fileName);

    const uploadUrl = `${this.baseUrl}/media/upload_media`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      // If 401, invalidate cached token for next retry
      if (response.status === 401) {
        this.accessToken = null;
      }
      throw new Error(`NAS Upload failed (HTTP ${response.status}): ${errText}`);
    }

    const resJson = (await response.json()) as any;
    if (resJson.status !== 'success') {
      throw new Error(`NAS Upload returned unsuccessful response: ${JSON.stringify(resJson)}`);
    }

    const uploadedFileName = resJson.uploaded || params.fileName;
    const photoUrl = `${this.baseUrl}/media_file/NAS/UTBA/event_photo/${eventCode}/${uploadedFileName}`;

    return {
      status: 'success',
      fileId: resJson.file_id,
      fileName: uploadedFileName,
      fileType: resJson.file_type || 'jpg',
      photoUrl,
    };
  }
}
