import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo } from 'react';
import { Alert, AlertColor, Snackbar } from '@mui/material';

interface SnackbarState {
    open: boolean;
    message: string;
    severity: AlertColor;
    autoHideDuration: number | null;
}

interface SnackbarContextType {
    showSnackbar: (message: string, severity: AlertColor, autoHideDuration?: number | null) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const SnackbarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [snackbar, setSnackbar] = useState<SnackbarState>({
        open: false,
        message: '',
        severity: 'info',
        autoHideDuration: 6000,
    });

    const showSnackbarInstance = useCallback((
        message: string,
        severity: AlertColor,
        autoHideDuration: number | null = 6000
    ) => {
        setSnackbar({ open: true, message, severity, autoHideDuration });
    }, []);

    const handleClose = useCallback((_?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar((prev) => ({ ...prev, open: false }));
    }, []);

    const contextValue = useMemo(() => ({
        showSnackbar: showSnackbarInstance
    }), [showSnackbarInstance]);

    return (
        <SnackbarContext.Provider value={contextValue}>
            {children}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={snackbar.autoHideDuration}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert onClose={handleClose} severity={snackbar.severity} sx={{ width: '100%' }} variant="filled">
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </SnackbarContext.Provider>
    );
};

export const useSnackbar = (): SnackbarContextType => {
    const context = useContext(SnackbarContext);
    if (context === undefined) {
        throw new Error('useSnackbar must be used within a SnackbarProvider');
    }
    return context;
};