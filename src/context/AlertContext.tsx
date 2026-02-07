import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AlertModal } from '../components/common/AlertModal';

type AlertVariant = 'info' | 'warning' | 'danger';

interface AlertConfig {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: AlertVariant;
}

interface AlertState extends AlertConfig {
  isConfirm: boolean;
  resolve: (result: boolean) => void;
}

interface AlertContextValue {
  alert: (message: string | AlertConfig) => Promise<void>;
  confirm: (message: string | AlertConfig) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  const showAlert = useCallback((config: string | AlertConfig, isConfirm: boolean): Promise<boolean> => {
    return new Promise((resolve) => {
      const normalizedConfig = typeof config === 'string' ? { message: config } : config;
      setAlertState({
        ...normalizedConfig,
        isConfirm,
        resolve,
      });
    });
  }, []);

  const alert = useCallback(
    (config: string | AlertConfig): Promise<void> => {
      return showAlert(config, false).then(() => undefined);
    },
    [showAlert]
  );

  const confirm = useCallback(
    (config: string | AlertConfig): Promise<boolean> => {
      return showAlert(config, true);
    },
    [showAlert]
  );

  const handleClose = useCallback((result: boolean) => {
    if (alertState) {
      alertState.resolve(result);
      setAlertState(null);
    }
  }, [alertState]);

  return (
    <AlertContext.Provider value={{ alert, confirm }}>
      {children}
      {alertState && (
        <AlertModal
          title={alertState.title}
          message={alertState.message}
          confirmText={alertState.confirmText}
          cancelText={alertState.cancelText}
          variant={alertState.variant}
          isConfirm={alertState.isConfirm}
          onConfirm={() => handleClose(true)}
          onCancel={() => handleClose(false)}
        />
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
