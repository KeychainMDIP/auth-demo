import React, { useEffect, useState } from "react";
import {
    BrowserRouter as Router,
    Routes,
    Route,
    useLocation
} from "react-router-dom";
import {
    Box,
} from '@mui/material';
import axios from 'axios';
import { SnackbarProvider, useSnackbar } from './contexts/SnackbarContext.js';
import {AuthState} from './types.js';
import Header from './components/Header.js';
import Sidebar from './components/Sidebar.js';
import Home from './components/Home.js';
import ViewLogin from './components/ViewLogin.js';
import ViewLogout from './components/ViewLogout.js';
import ViewProfile from './components/ViewProfile.js';
import ViewCreateVault from "./components/ViewCreateVault.js";
import ViewManageVaultMembers from "./components/ViewManageVaultMembers.js";
import ViewManageVaultItems from "./components/ViewManageVaultItems.js";
import ViewVaultItemsPage from "./components/ViewVaultItemsPage.js";
import NotFound from './components/NotFound.js';
import JsonViewer from "./components/JsonViewer.js";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    withCredentials: true,
});

function AppLayout() {
    const [auth, setAuth] = useState<boolean | null>(null);
    const location = useLocation();
    const { showSnackbar } = useSnackbar();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await api.get<AuthState>('/check-auth');
                setAuth(response.data.isAuthenticated);
            } catch (error) {
                showSnackbar("Failed to check auth status for layout", 'error');
                setAuth(false);
            }
        };
        checkAuth();
    }, [location, showSnackbar]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', maxWidth: '900px' }}>
            <Header api={api} />
            <Box sx={{ display: 'flex', flexGrow: 1, width: '100%' }}>
                {auth && <Sidebar api={api} />}

                <Box
                    sx={{
                        width: '100%',
                        margin: '0 auto',
                        minHeight: '100vh'
                    }}
                >
                    <Routes>
                        <Route path="/" element={<Home api={api}/>} />
                        <Route path="/login" element={<ViewLogin api={api} />} />
                        <Route path="/logout" element={<ViewLogout api={api} />} />
                        <Route path="/profile/:did" element={<ViewProfile api={api} />} />
                        <Route path="/create-vault" element={<ViewCreateVault api={api} />} />
                        <Route path="/vaults/:vaultDID/view" element={<ViewVaultItemsPage api={api} />} />
                        <Route path="/vaults/:vaultDID/manage-members" element={<ViewManageVaultMembers api={api} />} />
                        <Route path="/vaults/:vaultDID/manage-items" element={<ViewManageVaultItems api={api} />} />
                        <Route path="/search" element={<JsonViewer api={api} />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Box>
            </Box>
        </Box>
    );
}

function App() {
    return (
        <SnackbarProvider>
            <Router>
                <AppLayout />
            </Router>
        </SnackbarProvider>
    );
}

export default App;
