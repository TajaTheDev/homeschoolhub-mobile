import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Snackbar } from '@/components/ui/Snackbar';

interface SnackbarState {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface SnackbarContextType {
  showSnackbar: (message: string, type?: 'success' | 'error' | 'info', action?: { label: string; onPress: () => void }) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const SnackbarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showSnackbar = (
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    action?: { label: string; onPress: () => void }
  ) => {
    setSnackbar({
      visible: true,
      message,
      type,
      action,
    });
  };

  const hideSnackbar = () => {
    setSnackbar(prev => ({ ...prev, visible: false }));
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <Snackbar
        visible={snackbar.visible}
        message={snackbar.message}
        type={snackbar.type}
        action={snackbar.action}
        onDismiss={hideSnackbar}
      />
    </SnackbarContext.Provider>
  );
};

export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within SnackbarProvider');
  }
  return context;
};
