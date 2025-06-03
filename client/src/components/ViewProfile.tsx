import {useNavigate, useParams} from "react-router-dom";
import React, {useEffect, useState} from "react";
import {useSnackbar} from "../contexts/SnackbarContext.js";
import {differenceInDays, format} from "date-fns";
import {Box, Typography} from "@mui/material";
import {AxiosInstance} from "axios";

function ViewProfile({ api } : { api: AxiosInstance }) {
    const { did } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const { showSnackbar } = useSnackbar();

    useEffect(() => {
        if (!did) {
            showSnackbar("No DID provided for profile.", "error");
            navigate('/');
            return;
        }

        const init = async () => {
            try {
                const getProfile = await api.get(`/profile/${did}`);
                const profile = getProfile.data;

                setProfile(profile);
            }
            catch (error: any) {
                showSnackbar("Failed to load profile data", 'error');
                navigate('/');
            }
        };

        init();
    }, [did, navigate, showSnackbar]);

    function formatDate(time: string) {
        const date = new Date(time);
        const now = new Date();
        const days = differenceInDays(now, date);

        return `${format(date, 'yyyy-MM-dd HH:mm:ss')} (${days} days ago)`;
    }

    if (!profile) {
        return <></>;
    }

    return (
        <Box
            sx={{
                width: '100%',
                maxWidth: 650,
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                }}
            >
                <Box
                    component="span"
                    sx={{
                        fontWeight: 'bold',
                        pr: 2
                    }}
                >
                    DID:
                </Box>
                <Box
                    component="span"
                    sx={{
                        flexGrow: 1,
                        wordBreak: 'break-word',
                    }}
                >
                    <Typography sx={{ fontFamily: 'Courier, monospace', fontSize: '0.9rem' }}>
                        {profile.did}
                    </Typography>
                </Box>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                }}
            >
                <Box
                    component="span"
                    sx={{
                        fontWeight: 'bold',
                        pr: 2,
                    }}
                >
                    First login:
                </Box>
                <Box
                    component="span"
                    sx={{
                        flexGrow: 1,
                        wordBreak: 'break-word',
                    }}
                >
                    {formatDate(profile.firstLogin)}
                </Box>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                }}
            >
                <Box
                    component="span"
                    sx={{
                        fontWeight: 'bold',
                        pr: 2,
                    }}
                >
                    Last login:
                </Box>
                <Box
                    component="span"
                    sx={{
                        flexGrow: 1,
                        wordBreak: 'break-word',
                    }}
                >
                    {formatDate(profile.lastLogin)}
                </Box>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                }}
            >
                <Box
                    component="span"
                    sx={{
                        fontWeight: 'bold',
                        pr: 2,
                    }}
                >
                    Login count:
                </Box>
                <Box
                    component="span"
                    sx={{
                        flexGrow: 1,
                        wordBreak: 'break-word',
                        color: '#555',
                    }}
                >
                    {profile.logins}
                </Box>
            </Box>
        </Box>
    )
}

export default ViewProfile;
