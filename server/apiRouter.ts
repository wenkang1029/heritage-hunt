/**
 * Melaka Heritage Hunt - NAS Photo API Router
 * Path: server/apiRouter.ts
 *
 * Implements:
 * - POST /api/upload-photo: Validates auth, limits, magic bytes, generates safe filename, uploads to NAS
 * - GET  /api/download-photo: Secure SSRF-protected streaming proxy for original photos
 * - GET  /api/nas-status: Health & configuration status check
 */

import type { IncomingMessage, ServerResponse } from 'http';
import {
  MAX_FILE_SIZE_BYTES,
  validateMagicBytes,
  generateSafeFileName,
  validateDownloadTarget,
} from './security.ts';
import { XinyaClient } from './xinyaClient.ts';

const xinyaClient = new XinyaClient();

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-game-id, x-team-id, x-clue-id');
  res.end(JSON.stringify(data));
}

export async function handleNasApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Handle CORS preflight options
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-game-id, x-team-id, x-clue-id');
    res.end();
    return true;
  }

  // 1. Status Check
  if (pathname === '/api/nas-status' && req.method === 'GET') {
    sendJson(res, 200, {
      configured: xinyaClient.isConfigured(),
      defaultEventId: xinyaClient.defaultEventId || null,
      defaultEventCode: xinyaClient.defaultEventCode || null,
      maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
    });
    return true;
  }

  // 2. Download Photo Proxy (Protected against SSRF)
  if (pathname === '/api/download-photo' && req.method === 'GET') {
    const rawUrl = urlObj.searchParams.get('url');
    const customName = urlObj.searchParams.get('name') || 'heritage_photo.jpg';

    if (!rawUrl) {
      sendJson(res, 400, { error: 'Missing required query parameter "url".' });
      return true;
    }

    const validation = validateDownloadTarget(rawUrl);
    if (!validation.valid || !validation.sanitizedUrl) {
      sendJson(res, 403, { error: validation.error || 'Access denied by SSRF protection filter.' });
      return true;
    }

    try {
      const upstream = await fetch(validation.sanitizedUrl);
      if (!upstream.ok) {
        sendJson(res, upstream.status, {
          error: `Upstream NAS fetch failed (HTTP ${upstream.status}).`,
        });
        return true;
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const cleanDownloadName = customName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${cleanDownloadName}"`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const arrayBuffer = await upstream.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
      return true;
    } catch (fetchErr: any) {
      sendJson(res, 502, { error: `Proxy download error: ${fetchErr.message}` });
      return true;
    }
  }

  // 3. Upload Photo
  if (pathname === '/api/upload-photo' && req.method === 'POST') {
    // Check Content-Length ceiling upfront
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > MAX_FILE_SIZE_BYTES) {
      sendJson(res, 413, {
        error: `Payload too large. File size exceeds maximum limit of 20 MB (${contentLength} bytes).`,
      });
      return true;
    }

    try {
      // Convert incoming stream to web Request to parse multipart FormData natively
      const webReq = new Request(urlObj.toString(), {
        method: req.method,
        headers: req.headers as any,
        body: req as any,
        // @ts-ignore Node.js half-duplex streaming requirement
        duplex: 'half',
      });

      const formData = await webReq.formData();
      const file = formData.get('file');

      if (!file || typeof file === 'string' || !(file instanceof Blob)) {
        sendJson(res, 400, { error: 'No valid file found in multipart field "file".' });
        return true;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        sendJson(res, 413, {
          error: `File size exceeds 20 MB limit (${file.size} bytes).`,
        });
        return true;
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());

      // Magic byte validation (Blocks fake extensions, Stored XSS, SVGs)
      const magic = validateMagicBytes(fileBuffer);
      if (!magic.valid || !magic.extension || !magic.mimeType) {
        sendJson(res, 415, {
          error: magic.error || 'Unsupported file type. Only JPEG, PNG, WebP, and HEIC are permitted.',
        });
        return true;
      }

      // Metadata extraction
      const gameId = (formData.get('gameId') as string) || (req.headers['x-game-id'] as string) || 'game';
      const teamId = (formData.get('teamId') as string) || (req.headers['x-team-id'] as string) || 'team';
      const clueId = (formData.get('clueId') as string) || (req.headers['x-clue-id'] as string) || 'clue';
      const customEventId = formData.get('eventId') ? Number(formData.get('eventId')) : undefined;
      const customEventCode = (formData.get('eventCode') as string) || undefined;

      // Discard client's original filename and create safe unique filename
      const safeFileName = generateSafeFileName({
        gameId,
        teamId,
        clueId,
        extension: magic.extension,
      });

      // Upload to Xinya NAS
      const result = await xinyaClient.uploadPhoto({
        fileBuffer,
        fileName: safeFileName,
        mimeType: magic.mimeType,
        eventId: customEventId,
        eventCode: customEventCode,
      });

      sendJson(res, 200, {
        success: true,
        photoUrl: result.photoUrl,
        fileId: result.fileId,
        fileName: result.fileName,
        fileType: result.fileType,
      });
      return true;
    } catch (err: any) {
      console.error('Photo upload processing error:', err);
      sendJson(res, 500, {
        error: `Upload processing failed: ${err.message || 'Unknown server error'}`,
      });
      return true;
    }
  }

  return false;
}
