/**
 * Melaka Heritage Hunt - Dialog Context & useDialog Hook
 * Path: src/context/DialogContext.tsx
 *
 * Provides a unified async modal pop-up manager across the entire web app,
 * completely replacing browser native window.alert and window.confirm.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { ActionModal, type ActionModalVariant } from '../components/Common/ActionModal.tsx';
import { useLanguage } from './LanguageContext.tsx';

export interface DialogAlertOptions {
  title?: string;
  message: string | React.ReactNode;
  variant?: ActionModalVariant;
  confirmText?: string;
}

export interface DialogConfirmOptions {
  title?: string;
  message: string | React.ReactNode;
  variant?: ActionModalVariant;
  confirmText?: string;
  cancelText?: string;
}

export interface DialogContextValue {
  showAlert: (options: string | DialogAlertOptions) => Promise<void>;
  showConfirm: (options: DialogConfirmOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

interface ActiveDialogState {
  isOpen: boolean;
  title?: string;
  message: string | React.ReactNode;
  variant: ActionModalVariant;
  confirmText: string;
  cancelText?: string;
  resolve: (value: any) => void;
}

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDialog, setActiveDialog] = useState<ActiveDialogState | null>(null);
  const { language } = useLanguage();

  const isZh = language === 'zh';

  const showAlert = useCallback((options: string | DialogAlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      let title = isZh ? '系统提示' : 'Notice';
      let message: string | React.ReactNode = '';
      let variant: ActionModalVariant = 'info';
      let confirmText = isZh ? '知道了' : 'OK';

      if (typeof options === 'string') {
        message = options;
        const lower = options.toLowerCase();
        if (lower.includes('error') || lower.includes('fail') || lower.includes('失败') || lower.includes('错误')) {
          variant = 'danger';
          title = isZh ? '操作失败' : 'Action Failed';
        } else if (lower.includes('success') || lower.includes('created') || lower.includes('approved') || lower.includes('成功')) {
          variant = 'success';
          title = isZh ? '操作成功' : 'Success';
        } else if (lower.includes('warning') || lower.includes('must') || lower.includes('cannot') || lower.includes('please') || lower.includes('警告') || lower.includes('请')) {
          variant = 'warning';
          title = isZh ? '特别提醒' : 'Notice';
        }
      } else {
        message = options.message;
        title = options.title || (
          options.variant === 'danger'
            ? (isZh ? '操作失败' : 'Error')
            : options.variant === 'success'
            ? (isZh ? '操作成功' : 'Success')
            : (isZh ? '系统提示' : 'Notice')
        );
        variant = options.variant || 'info';
        confirmText = options.confirmText || (isZh ? '知道了' : 'OK');
      }

      setActiveDialog({
        isOpen: true,
        title,
        message,
        variant,
        confirmText,
        cancelText: undefined,
        resolve: () => resolve(),
      });
    });
  }, [isZh]);

  const showConfirm = useCallback((options: DialogConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setActiveDialog({
        isOpen: true,
        title: options.title || (isZh ? '请确认操作' : 'Please Confirm'),
        message: options.message,
        variant: options.variant || 'warning',
        confirmText: options.confirmText || (isZh ? '确定' : 'Confirm'),
        cancelText: options.cancelText || (isZh ? '取消' : 'Cancel'),
        resolve: (confirmed: boolean) => resolve(confirmed),
      });
    });
  }, [isZh]);

  // Intercept window.alert as a global fallback so native browser popups never show
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      showAlert(String(msg ?? ''));
    };
    return () => {
      window.alert = originalAlert;
    };
  }, [showAlert]);

  const handleClose = useCallback(() => {
    if (activeDialog) {
      activeDialog.resolve(false);
      setActiveDialog(null);
    }
  }, [activeDialog]);

  const handleConfirm = useCallback(() => {
    if (activeDialog) {
      activeDialog.resolve(true);
      setActiveDialog(null);
    }
  }, [activeDialog]);

  const handleCancel = useCallback(() => {
    if (activeDialog) {
      activeDialog.resolve(false);
      setActiveDialog(null);
    }
  }, [activeDialog]);

  const contextValue = useMemo<DialogContextValue>(
    () => ({
      showAlert,
      showConfirm,
    }),
    [showAlert, showConfirm]
  );

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      {activeDialog && (
        <ActionModal
          isOpen={activeDialog.isOpen}
          onClose={handleClose}
          title={activeDialog.title}
          message={activeDialog.message}
          variant={activeDialog.variant}
          confirmText={activeDialog.confirmText}
          cancelText={activeDialog.cancelText}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextValue => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
