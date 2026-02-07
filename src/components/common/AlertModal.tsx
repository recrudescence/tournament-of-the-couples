import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  modalBackdrop,
  slideInUp,
  springDefault,
  springStiff,
  buttonHover,
  buttonTap,
  nervousHover,
} from '../../styles/motion';

type AlertVariant = 'info' | 'warning' | 'danger';

interface AlertModalProps {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: AlertVariant;
  isConfirm: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles: Record<AlertVariant, { icon: string; buttonClass: string }> = {
  info: { icon: 'ℹ️', buttonClass: 'is-info' },
  warning: { icon: '⚠️', buttonClass: 'is-warning' },
  danger: { icon: '🚨', buttonClass: 'is-danger' },
};

export function AlertModal({
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  variant = 'info',
  isConfirm,
  onConfirm,
  onCancel,
}: AlertModalProps) {
  const [isExiting, setIsExiting] = useState(false);
  const { icon, buttonClass } = variantStyles[variant];

  const handleCancel = useCallback(() => {
    setIsExiting(true);
    setTimeout(onCancel, 200);
  }, [onCancel]);

  const handleConfirm = useCallback(() => {
    setIsExiting(true);
    setTimeout(onConfirm, 200);
  }, [onConfirm]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleCancel]);

  const handleExitComplete = () => {
    // Animation cleanup handled by parent
  };

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {!isExiting && (
        <div className="modal is-active">
          {/* Backdrop */}
          <motion.div
            className="modal-background"
            variants={modalBackdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            onClick={handleCancel}
          />

          {/* Modal Card */}
          <motion.div
            className="modal-card"
            style={{ maxWidth: '400px' }}
            variants={slideInUp}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={springDefault}
          >
            <header className="modal-card-head">
              <p className="modal-card-title">
                <span className="mr-2">{icon}</span>
                {title || (variant === 'danger' ? 'Confirm' : 'Notice')}
              </p>
            </header>

            <section className="modal-card-body">
              <p className="is-size-5">{message}</p>
            </section>

            <footer className="modal-card-foot is-justify-content-flex-end" style={{ gap: '0.5rem' }}>
              {isConfirm && (
                <motion.button
                  className="button"
                  onClick={handleCancel}
                  transition={springStiff}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                >
                  {cancelText}
                </motion.button>
              )}
              <motion.button
                className={`button ${buttonClass}`}
                onClick={handleConfirm}
                transition={springStiff}
                whileHover={variant === 'danger' ? nervousHover : buttonHover}
                whileTap={buttonTap}
                autoFocus
              >
                {confirmText}
              </motion.button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
