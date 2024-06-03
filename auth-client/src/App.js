import React, { useEffect, useState } from "react";
import { useParams } from 'react-router-dom';
import {
    useNavigate,
    BrowserRouter as Router,
    Routes,
    Route,
} from "react-router-dom";
import { Box, Button, Grid, TextField, Typography } from '@mui/material';
import { Table, TableBody, TableRow, TableCell } from '@mui/material';
import axios from 'axios';
import { format, differenceInDays } from 'date-fns';

import './App.css';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<ViewLogin />} />
                <Route path="/logout" element={<ViewLogout />} />
                <Route path="/forum" element={<ViewForum />} />
                <Route path="/admin" element={<ViewAdmin />} />
                <Route path="/profile/:did" element={<ViewProfile />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Router>
    );
}

function Home() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userDID, setUserDID] = useState('');
    const [userName, setUserName] = useState('');
    const [logins, setLogins] = useState(0);

    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await axios.get(`/api/check-auth`);
                const auth = response.data;
                setIsAuthenticated(auth.isAuthenticated);
                setIsAdmin(auth.isAdmin);
                setUserDID(auth.userDID);

                if (auth.profile) {
                    setLogins(auth.profile.logins);
                }
            }
            catch (error) {
                window.alert(error);
            }
        };

        init();
    }, []);

    async function login() {
        navigate('/login');
    }

    async function logout() {
        navigate('/logout');
    }

    return (
        <div className="App">
            <h1>Home</h1>

            <Grid container style={{ width: '800px' }}>
                <Grid item xs={true}>
                    <h2>MDIP auth demo</h2>
                </Grid>
                <Grid item xs={true} style={{ textAlign: 'right' }}>
                    {isAuthenticated ? (
                        <Button variant="contained" color="primary" onClick={logout}>
                            Logout
                        </Button>
                    ) : (
                        <Button variant="contained" color="primary" onClick={login}>
                            Login
                        </Button>
                    )}
                </Grid>
            </Grid>

            {isAuthenticated ? (
                <Box>
                    {logins > 1 ? (
                        `Welcome back, ${userDID}`
                    ) : (
                        `Welcome, ${userDID}`
                    )}
                    <br />
                    You have access to the following pages:
                    <ul>
                        <li><a href={`/profile/${userDID}`}>Profile</a></li>
                        <li><a href='/forum'>Forum</a></li>
                        {isAdmin &&
                            <li><a href='/admin'>Admin</a></li>
                        }
                    </ul>
                </Box>
            ) : (
                <Box>
                    Please login to continue
                </Box>
            )}
        </div>
    )
}

function ViewLogin() {
    const [challengeDID, setChallengeDID] = useState('');
    const [responseDID, setResponseDID] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await axios.get(`/api/challenge`);
                setChallengeDID(response.data);
            }
            catch (error) {
                window.alert(error);
            }
        };

        init();
    }, []);

    async function login() {
        try {
            const getAuth = await axios.post(`/api/login`, { challenge: challengeDID, response: responseDID });

            if (getAuth.data.authenticated) {
                navigate('/');
            }
            else {
                alert('login failed');
            }
        }
        catch (error) {
            window.alert(error);
        }
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            window.alert(`"${text}" copied to clipboard`);
        }
        catch (error) {
            window.alert('Failed to copy text: ', error);
        }
    };

    return (
        <div className="App">
            <h1>Login</h1>
            <Table style={{ width: '800px' }}>
                <TableBody>
                    <TableRow>
                        <TableCell>Challenge:</TableCell>
                        <TableCell>
                            <Typography style={{ fontFamily: 'Courier' }}>
                                {challengeDID}
                            </Typography>
                        </TableCell>
                        <TableCell>
                            <Button variant="contained" color="primary" onClick={() => copyToClipboard(challengeDID)}>
                                Copy
                            </Button>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Response:</TableCell>
                        <TableCell>
                            <TextField
                                label="Response DID"
                                style={{ width: '600px', fontFamily: 'Courier' }}
                                value={responseDID}
                                onChange={(e) => setResponseDID(e.target.value)}
                                fullWidth
                                margin="normal"
                                inputProps={{ maxLength: 80 }}
                            />
                        </TableCell>
                        <TableCell>
                            <Button variant="contained" color="primary" onClick={login} disabled={!responseDID}>
                                Login
                            </Button>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    )
}

function ViewLogout() {
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                await axios.post(`/api/logout`);
                navigate('/');
            }
            catch (error) {
                window.alert('Failed to logout: ', error);
            }
        };

        init();
    });
}

function ViewForum() {
    const [forumInfo, setForumInfo] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await axios.get(`/api/forum`);
                setForumInfo(response.data);
            }
            catch (error) {
                navigate('/');
            }
        };

        init();
    }, [navigate]);

    return (
        <div className="App">
            <h1>Forum</h1>
            <p>{forumInfo}</p>
        </div>
    )
}

function ViewAdmin() {
    const [adminInfo, setAdminInfo] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await axios.get(`/api/admin`);
                setAdminInfo(response.data);
            }
            catch (error) {
                navigate('/');
            }
        };

        init();
    }, [navigate]);

    return (
        <div className="App">
            <h1>Admin</h1>
            <pre>{JSON.stringify(adminInfo, null, 4)}</pre>
        </div>
    )
}

function ViewProfile() {
    const { did } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [userName, setUserName] = useState("");

    useEffect(() => {
        const init = async () => {
            try {
                const response = await axios.get(`/api/profile/${did}`);
                const profile = response.data;

                setProfile(profile);

                if (profile.name) {
                    setUserName(profile.name);
                }
            }
            catch (error) {
                navigate('/');
            }
        };

        init();
    }, [navigate]);

    function formatDate(time) {
        const date = new Date(time);
        const now = new Date();
        const days = differenceInDays(now, date);

        return `${format(date, 'yyyy-MM-dd HH:mm:ss')} (${days} days ago)`;
    }

    if (!profile) {
        return <p></p>;
    }

    return (
        <div className="App">
            <h1>Profile</h1>
            <pre>{JSON.stringify(profile, null, 4)}</pre>
            <Table style={{ width: '800px' }}>
                <TableBody>
                    <TableRow>
                        <TableCell>DID:</TableCell>
                        <TableCell>
                            <Typography style={{ fontFamily: 'Courier' }}>
                                {profile.did}
                            </Typography>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>First login:</TableCell>
                        <TableCell>{formatDate(profile.firstLogin)}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Last login:</TableCell>
                        <TableCell>{formatDate(profile.lastLogin)}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Login count:</TableCell>
                        <TableCell>{profile.logins}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Name:</TableCell>
                        <TableCell>
                            {profile.isUser ? (
                                <TextField
                                    label=""
                                    style={{ width: '300px' }}
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    fullWidth
                                    margin="normal"
                                    inputProps={{ maxLength: 20 }}
                                />
                            ) : (
                                userName
                            )}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    )
}

function NotFound() {
    const navigate = useNavigate();

    useEffect(() => {
        navigate("/");
    });
}

export default App;
