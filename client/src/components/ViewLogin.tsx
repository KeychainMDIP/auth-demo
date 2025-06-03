import React, {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useSnackbar} from "../contexts/SnackbarContext.js";
import {AuthState} from "../types.js";
import {Box, Button, TextField, Typography} from "@mui/material";
import {QRCodeSVG} from "qrcode.react";
import {AxiosInstance} from "axios";

function ViewLogin({ api } : { api: AxiosInstance }) {
    const [challengeDID, setChallengeDID] = useState<string>('');
    const [responseDID, setResponseDID] = useState<string>('');
    const [loggingIn, setLoggingIn] = useState<boolean>(false);
    const [challengeURL, setChallengeURL] = useState<string | null>(null);
    const [extensionURL, setExtensionURL] = useState<string>('');

    const navigate = useNavigate();
    const { showSnackbar } = useSnackbar();
    const intervalIdRef = useRef<number | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                intervalIdRef.current = window.setInterval(async () => {
                    try {
                        const response = await api.get<AuthState>(`/check-auth`);
                        if (response.data.isAuthenticated) {
                            if (intervalIdRef.current) {
                                clearInterval(intervalIdRef.current);
                            }
                            navigate('/');
                        }
                    } catch (error: any) {
                        showSnackbar('Failed to check auth status', 'error');
                    }
                }, 1000); // Check every second

                const response = await api.get(`/challenge`);
                const { challenge, challengeURL } = response.data;
                setChallengeDID(challenge);
                setExtensionURL(`mdip://auth?challenge=${challenge}`);
                setChallengeURL(encodeURI(challengeURL));
            }
            catch (error: any) {
                showSnackbar('Failed to get login challenge', 'error');
            }
        };

        init();

        return () => {
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
            }
        }
    }, [navigate, showSnackbar]);

    async function login() {
        setLoggingIn(true);

        try {
            const getAuth = await api.post(`/login`, { challenge: challengeDID, response: responseDID });

            if (getAuth.data.authenticated) {
                navigate('/');
            } else {
                showSnackbar('Login failed', 'error');
            }
        }
        catch (error: any) {
            showSnackbar('Login request failed', 'error');
        }

        setLoggingIn(false);
    }

    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            showSnackbar('Challenge DID copied to clipboard', 'success');
        } catch (error: any) {
            showSnackbar("Failed to copy text", 'error');
        }
    }

    return (
        <Box
            sx={{
                width: '100%',
                maxWidth: '800px',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                p: 2,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                }}
            >
                <Typography
                    variant="body1"
                    sx={{
                        fontWeight: 'bold',
                        pt: challengeURL ? '4px' : '8px',
                    }}
                >
                    Challenge:
                </Typography>

                <Box
                    sx={{
                        flexGrow: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                    }}
                >
                    {challengeURL && (
                        <a href={challengeURL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-block' }}>
                            <QRCodeSVG value={challengeURL} />
                        </a>
                    )}
                    <Typography
                        component="a"
                        href={extensionURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                            fontFamily: 'Courier, monospace',
                            wordBreak: 'break-all',
                            textDecoration: 'underline',
                            color: 'primary.main',
                            '&:hover': {
                                textDecoration: 'none',
                            }
                        }}
                    >
                        {challengeDID}
                    </Typography>
                </Box>

                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => copyToClipboard(challengeDID)}
                    sx={{ whiteSpace: 'nowrap', height: 'fit-content', alignSelf: 'center' }}
                >
                    Copy
                </Button>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                }}
            >
                <Typography
                    sx={{
                        fontWeight: 'bold',
                    }}
                >
                    Response:
                </Typography>

                <Box sx={{ flexGrow: 1 }}>
                    <TextField
                        label="Response DID"
                        value={responseDID}
                        onChange={(e) => setResponseDID(e.target.value)}
                        fullWidth
                        variant="outlined"
                        slotProps={{
                            htmlInput: {
                                maxLength: 80,
                            },
                        }}
                    />
                </Box>

                <Button
                    variant="contained"
                    color="primary"
                    onClick={login}
                    disabled={!responseDID || loggingIn}
                    sx={{ whiteSpace: 'nowrap' }}
                >
                    {loggingIn ? 'Logging in...' : 'Login'}
                </Button>
            </Box>
        </Box>
    );
}

export default ViewLogin;
