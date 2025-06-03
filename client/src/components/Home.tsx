import React, {useEffect, useState} from "react";
import {AuthState, ClientVault} from "../types.js";
import {useNavigate} from "react-router-dom";
import {useSnackbar} from "../contexts/SnackbarContext.js";
import {Box, Typography} from "@mui/material";
import {AxiosInstance} from "axios";

function Home({ api } : { api: AxiosInstance }) {
    const [authData, setAuthData] = useState<AuthState | null>(null);
    const [vaultsData, setVaultsData] = useState<ClientVault[]>([]);
    const navigate = useNavigate();
    const { showSnackbar } = useSnackbar();

    useEffect(() => {
        const determineInitialView = async () => {
            try {
                const authResponse = await api.get<AuthState>('/check-auth');
                const currentAuth = authResponse.data;
                setAuthData(currentAuth);

                if (currentAuth && currentAuth.isAuthenticated) {
                    const vaultsResponse = await api.get<ClientVault[]>('/vaults');
                    const currentVaults = vaultsResponse.data;
                    setVaultsData(currentVaults);

                    if (currentAuth.isOwner) {
                        if (currentVaults.length === 0) {
                            navigate('/create-vault', { replace: true });
                        } else {
                            navigate(`/vaults/${currentVaults[0].did}/view`, { replace: true });
                        }
                    } else {
                        if (currentVaults.length > 0) {
                            navigate(`/vaults/${currentVaults[0].did}/view`, { replace: true });
                        }
                    }
                }
            } catch (error: any) {
                showSnackbar('Error determining initial view', 'error');
                setAuthData({isAuthenticated: false, userDID:'', isOwner:false, isAdmin:false, isModerator:false, isMember:false });
            }
        };

        determineInitialView();
    }, [navigate, showSnackbar]);

    if (authData) {
        if (authData.isAuthenticated) {
            if (vaultsData.length === 0 && !authData.isOwner) {
                return (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="h6">Welcome, {authData.profile?.name || authData.userDID?.substring(0,20)}...</Typography>
                        <Typography sx={{ mt: 2 }}>You do not currently have access to any vaults, or no vaults have been created yet.</Typography>
                    </Box>
                );
            }
            return (
                <Box sx={{p:3, textAlign:'center'}}>
                    <Typography variant="h6">Welcome, {authData.profile?.name || authData.userDID?.substring(0,20)}...</Typography>
                </Box>
            );
        } else {
            return (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6">Welcome to the Group Vault Demo</Typography>
                    <Typography sx={{ mt: 2 }}>Please login to access or manage group vaults.</Typography>
                </Box>
            );
        }
    }

    return <Box sx={{ p: 3, textAlign: 'center' }}><Typography>Could not load application state. Please try refreshing.</Typography></Box>;
}

export default Home;
