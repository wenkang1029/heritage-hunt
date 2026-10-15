/**
 * Melaka Heritage Hunt - Fullscreen Uncropped Image Lightbox Modal
 * Path: src/components/Common/ImageLightboxModal.tsx
 *
 * Displays full, uncropped original photos for Game Masters and Players with
 * high visual fidelity, natural aspect ratio, and tap-outside-to-dismiss.
 */

import React, { useEffect } from 'react';
import { X, ZoomIn } from 'lucide-react';

export interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
  subtitle?: string;
  badge?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  subtitle,
  badge,
}) => {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full flex flex-col items-center max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="w-full flex items-center justify-between pb-3 text-white border-b border-slate-800/80 mb-3 px-1">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-0.5">
              {badge && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {badge}
                </span>
              )}
              {title && (
                <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                  {title}
                </h3>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-400 truncate">{subtitle}</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700 shrink-0"
            aria-label="Close original photo"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Uncropped Full Image Container */}
        <div className="relative w-full flex items-center justify-center overflow-auto max-h-[82vh] rounded-2xl bg-black/50 p-1 sm:p-2 border border-slate-800/60 shadow-2xl">
          <img
            src={imageUrl}
            alt={title || 'Full original photo'}
            className="max-h-[78vh] max-w-full w-auto h-auto object-contain rounded-xl shadow-2xl transition-transform"
          />
        </div>

        {/* Footer Hint */}
        <div className="mt-2 text-center text-[11px] text-slate-400 flex items-center gap-1.5">
          <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
          <span>Full Uncropped Original Photo — Tap anywhere outside or press Esc to close</span>
        </div>
      </div>
    </div>
  );
};
