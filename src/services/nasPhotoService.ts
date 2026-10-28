/**
 * Melaka Heritage Hunt - Client Service for NAS Photo Upload & Download
 * Path: src/services/nasPhotoService.ts
 */

export interface NasUploadResult {
  success: boolean;
  photoUrl: string;
  fileId: number;
  fileName: string;
}

export interface NasStatusResult {
  configured: boolean;
  defaultEventId: number | null;
  defaultEventCode: string | null;
  maxFileSizeBytes: number;
}

/**
 * Checks whether the backend has Xinya NAS credentials configured.
 */
export async function checkNasStatus(): Promise<NasStatusResult> {
  try {
    const res = await fetch('/api/nas-status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return {
      configured: false,
      defaultEventId: null,
      defaultEventCode: null,
      maxFileSizeBytes: 20 * 1024 * 1024,
    };
  }
}

/**
 * Uploads an uncompressed photo directly to the NAS via the secure backend proxy.
 */
export async function uploadPhotoToNas(
  file: File,
  metadata: {
    gameId: string;
    teamId: string;
    clueId: string;
    eventId?: number;
    eventCode?: string;
  }
): Promise<NasUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('gameId', metadata.gameId);
  formData.append('teamId', metadata.teamId);
  formData.append('clueId', metadata.clueId);
  if (metadata.eventId) formData.append('eventId', String(metadata.eventId));
  if (metadata.eventCode) formData.append('eventCode', metadata.eventCode);

  const response = await fetch('/api/upload-photo', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMsg = `Upload failed with HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return await response.json();
}

/**
 * Triggers a secure download of the photo.
 * - For Base64 Data URLs: converts to Blob and downloads locally.
 * - For NAS URLs: proxies through /api/download-photo to enforce safe filename and prevent CORS blocks.
 */
export async function downloadPhoto(url: string, suggestedFileName: string = 'heritage_photo.jpg'): Promise<void> {
  if (!url) return;

  // Clean filename
  const cleanName = suggestedFileName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

  // Handle Base64 Data URL directly
  if (url.startsWith('data:image/')) {
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Handle remote URL via backend proxy
  try {
    const downloadUrl = `/api/download-photo?url=${encodeURIComponent(url)}&name=${encodeURIComponent(cleanName)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = cleanName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.warn('Proxy download failed, opening direct URL:', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
