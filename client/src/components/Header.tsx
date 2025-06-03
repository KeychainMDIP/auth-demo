import React, {useEffect, useState} from "react";
import {useSnackbar} from "../contexts/SnackbarContext.js";
import {Link, useLocation, useNavigate} from "react-router-dom";
import {Box, Button, Typography} from "@mui/material";
import {AxiosInstance} from "axios";
import {AuthState} from '../types.js';

function Header({ api } : { api: AxiosInstance }) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const { showSnackbar } = useSnackbar();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await api.get(`/check-auth`);
                const auth: AuthState = response.data;
                if (isAuthenticated !== auth.isAuthenticated) {
                    setIsAuthenticated(auth.isAuthenticated);
                }
            }
            catch (error: any) {
                showSnackbar('Failed to check auth status', 'error');
            }
        };

        init();
    }, [location, showSnackbar, isAuthenticated]);

    function login() {
        navigate('/login');
    }

    function logout() {
        navigate('/logout');
    }

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 2,
                px: 2,
                width: '100%'
            }}
        >
            <Box>
                <Link to='/' style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" component="h4">
                        MDIP
                    </Typography>
                    <Box
                        component="img"
                        src="/demo.png"
                        alt="MDIP"
                        sx={{ width: 48, height: 48 }}
                    />
                </Link>
            </Box>

            <Typography variant="h4" component="h4">
                GroupVault Demo
            </Typography>

            {isAuthenticated ? (
                <Button
                    variant="contained"
                    color="primary"
                    onClick={logout}
                >
                    Logout
                </Button>
            ) : (
                <Button
                    variant="contained"
                    color="primary"
                    onClick={login}
                >
                    Login
                </Button>
            )}
        </Box>
    )
}

export default Header;
