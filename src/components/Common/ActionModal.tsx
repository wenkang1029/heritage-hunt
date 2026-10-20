/**
 * Melaka Heritage Hunt - Reusable Action & Dialog Modal
 * Path: src/components/Common/ActionModal.tsx
 *
 * Provides a modern, responsive, themed modal popup for alerts, confirmations,
 * and user actions to replace native browser popups (alert/confirm).
 */

import React, { useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Trash2,
} from 'lucide-react';

export type ActionModalVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string | React.ReactNode;
  variant?: ActionModalVariant;
  confirmText?: string;
  cancelText?: string; // If provided, shows Cancel button (Confirm mode)
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info',
  confirmText = 'OK',
  cancelText,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  // Dismiss on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCancel) onCancel();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onCancel]);

  if (!isOpen) return null;

  const isConfirmMode = Boolean(cancelText);

  // Variant Styling & Icons
  let iconNode: React.ReactNode = <Info className="w-6 h-6" />;
  let iconWrapperClass = 'bg-sky-500/15 text-sky-400 border-sky-500/30';
  let defaultTitle = 'Information';
  let confirmBtnClass =
    'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50';

  if (variant === 'danger') {
    iconNode = isConfirmMode ? <Trash2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />;
    iconWrapperClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    defaultTitle = isConfirmMode ? 'Confirm Action' : 'Action Failed';
    confirmBtnClass = 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50';
  } else if (variant === 'warning') {
    iconNode = <AlertTriangle className="w-6 h-6" />;
    iconWrapperClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    defaultTitle = 'Warning';
    confirmBtnClass = 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-amber-950/50';
  } else if (variant === 'success') {
    iconNode = <CheckCircle2 className="w-6 h-6" />;
    iconWrapperClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    defaultTitle = 'Success';
    confirmBtnClass = 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50';
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      if (onCancel) onCancel();
      onClose();
    }
  };

  const handleConfirmClick = async () => {
    if (isLoading) return;
    if (onConfirm) {
      await onConfirm();
    }
    onClose();
  };

  const handleCancelClick = () => {
    if (isLoading) return;
    if (onCancel) onCancel();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl relative text-left max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button in corner */}
        <button
          type="button"
          onClick={handleCancelClick}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Icon and Title */}
        <div className="flex items-start gap-3.5 mb-3.5 pr-6">
          <div
            className={`p-2.5 rounded-2xl border shrink-0 shadow-inner flex items-center justify-center ${iconWrapperClass}`}
          >
            {iconNode}
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
              {title || defaultTitle}
            </h3>
            {variant === 'danger' && isConfirmMode && (
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mt-0.5">
                Careful: Irreversible Action
              </span>
            )}
          </div>
        </div>

        {/* Message Body */}
        <div className="text-xs sm:text-sm text-slate-300 leading-relaxed my-3 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80 break-words whitespace-pre-line">
          {message}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 mt-5 pt-2">
          {isConfirmMode && (
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isLoading}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isLoading}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50 text-center ${confirmBtnClass}`}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
