import React, { useEffect, useState, useRef } from "react";
import {
    useNavigate,
    useParams,
    BrowserRouter as Router,
    Link,
    Routes,
    Route,
} from "react-router-dom";
import { Box, Button, Select, MenuItem, TextField, Typography } from '@mui/material';
import { Table, TableBody, TableRow, TableCell } from '@mui/material';
import axios from 'axios';
import { format, differenceInDays } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';

import './App.css';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    withCredentials: true,
});

interface AuthState {
    isAuthenticated: boolean;
    userDID: string;
    isOwner: boolean;
    isAdmin: boolean;
    isModerator: boolean;
    isMember: boolean;
    profile?: {
        logins?: number;
        name?: string;
        [key: string]: any;
    }
    [key: string]: any;
}

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<ViewLogin />} />
                <Route path="/logout" element={<ViewLogout />} />
                <Route path="/members" element={<ViewMembers />} />
                <Route path="/moderators" element={<ViewModerators />} />
                <Route path="/admins" element={<ViewAdmins />} />
                <Route path="/owner" element={<ViewOwner />} />
                <Route path="/profile/:did" element={<ViewProfile />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Router>
    );
}

function Header({ title } : { title: string }) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
            }}
        >
            <Link to="/">
                <img src="/demo.png" alt="home" />
            </Link>
            <Typography variant="h4" component="h1">
                {title}
            </Typography>
        </Box>
    )
}

function Home() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [auth, setAuth] = useState<AuthState | null>(null);
    const [userDID, setUserDID] = useState<string>('');
    const [userName, setUserName] = useState<string>('');
    const [logins, setLogins] = useState<number>(0);

    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await api.get(`/check-auth`);
                const auth: AuthState = response.data;
                setAuth(auth);
                setIsAuthenticated(auth.isAuthenticated);
                setUserDID(auth.userDID);

                if (auth.profile) {
                    setLogins(auth.profile.logins || 0);

                    if (auth.profile.name) {
                        setUserName(auth.profile.name);
                    }
                }
            }
            catch (error: any) {
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

    if (!auth) {
        return (
            <div className="App">
                <Header title="Home" />
                <p>Loading...</p>
            </div>
        )
    }

    return (
        <div className="App">
            <Header title="Home" />
            <Box sx={{ mb:2, width: 400, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5">MDIP auth demo</Typography>

                {isAuthenticated ? (
                    <Button variant="contained" color="primary" onClick={logout} sx={{ mt: 2 }}>
                        Logout
                    </Button>
                ) : (
                    <Button variant="contained" color="primary" onClick={login} sx={{ mt: 2 }}>
                        Login
                    </Button>
                )}
            </Box>

            {isAuthenticated ? (
                <Box>
                    {logins > 1 ? (
                        `Welcome back, ${userName || userDID}`
                    ) : (
                        `Welcome, ${userDID}`
                    )}
                    <br />
                    You have access to the following pages:
                    <ul>
                        <li><Link to={`/profile/${userDID}`}>Profile</Link></li>
                        {auth.isMember &&
                            <li><Link to='/members'>Members Area</Link></li>
                        }
                        {auth.isModerator &&
                            <li><Link to='/moderators'>Moderators Area</Link></li>
                        }
                        {auth.isAdmin &&
                            <li><Link to='/admins'>Admins Area</Link></li>
                        }
                        {auth.isOwner &&
                            <li><Link to='/owner'>Owner Area</Link></li>
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
    const [challengeDID, setChallengeDID] = useState<string>('');
    const [responseDID, setResponseDID] = useState<string>('');
    const [loggingIn, setLoggingIn] = useState<boolean>(false);
    const [challengeURL, setChallengeURL] = useState<string | null>(null);
    const [extensionURL, setExtensionURL] = useState<string>('');
    const [challengeCopied, setChallengeCopied] = useState<boolean>(false);

    const navigate = useNavigate();
    const intervalIdRef = useRef<number | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                intervalIdRef.current = window.setInterval(async () => {
                    try {
                        const response = await api.get(`/check-auth`);
                        if (response.data.isAuthenticated) {
                            if (intervalIdRef.current) {
                                clearInterval(intervalIdRef.current);
                            }
                            navigate('/');
                        }
                    } catch (error: any) {
                        console.error('Failed to check authentication:', error);
                    }
                }, 1000); // Check every second

                const response = await api.get(`/challenge`);
                const { challenge, challengeURL } = response.data;
                setChallengeDID(challenge);
                setExtensionURL(`mdip://auth?challenge=${challenge}`);
                setChallengeURL(encodeURI(challengeURL));
            }
            catch (error: any) {
                window.alert(error);
            }
        };

        init();
        // Clear the interval when the component is unmounted
        return () => {
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
            }
        }
    }, []);

    async function login() {
        setLoggingIn(true);

        try {
            const getAuth = await api.post(`/login`, { challenge: challengeDID, response: responseDID });

            if (getAuth.data.authenticated) {
                navigate('/');
            }
            else {
                alert('login failed');
            }
        }
        catch (error: any) {
            window.alert(error);
        }

        setLoggingIn(false);
    }

    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            setChallengeCopied(true);
        }
        catch (error: any) {
            window.alert('Failed to copy text: ' + error);
        }
    }

    return (
        <div className="App">
            <Header title="Login" />
            <Table style={{ width: '800px' }}>
                <TableBody>
                    <TableRow>
                        <TableCell>Challenge:</TableCell>
                        <TableCell>
                            {challengeURL &&
                                <a href={challengeURL} target="_blank" rel="noopener noreferrer">
                                    <QRCodeSVG value={challengeURL} />
                                </a>
                            }
                            <Typography
                                component="a"
                                href={extensionURL}
                                style={{ fontFamily: 'Courier' }}
                            >
                                {challengeDID}
                            </Typography>
                        </TableCell>
                        <TableCell>
                            <Button variant="contained" color="primary" onClick={() => copyToClipboard(challengeDID)} disabled={challengeCopied}>
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
                                slotProps={{
                                    htmlInput: {
                                        maxLength: 80,
                                    },
                                }}
                            />
                        </TableCell>
                        <TableCell>
                            <Button variant="contained" color="primary" onClick={login} disabled={!responseDID || loggingIn}>
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
                await api.post(`/logout`);
                navigate('/');
            }
            catch (error: any) {
                window.alert('Failed to logout: ' + error);
            }
        };

        init();
    }, [navigate]);

    return null;
}

function ViewMembers() {
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await api.get(`/check-auth`);
                const auth = response.data;

                if (!auth.isMember) {
                    navigate('/');
                }
            }
            catch (error: any) {
                navigate('/');
            }
        };

        init();
    }, [navigate]);

    return (
        <div className="App">
            <Header title="Members Area" />
            <p>Members Area TBD</p>
        </div>
    )
}

function ViewModerators() {
    const [users, setUsers] = useState<string[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await api.get(`/users`);
                setUsers(response.data);
            }
            catch (error: any) {
                navigate('/');
            }
        };

        init();
    }, [navigate]);

    return (
        <div className="App">
            <Header title="Moderators Area" />
            <h2>Users</h2>
            <Table style={{ width: '800px' }}>
                <TableBody>
                    {users.map((did, index) => (
                        <TableRow key={index}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell><Link to={`/profile/${did}`}>{did}</Link></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function ViewAdmins() {
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await api.get(`/check-auth`);
                const auth = response.data;

                if (!auth.isAdmin) {
                    navigate('/');
                }
            }
            catch (error: any) {
                navigate('/');
            }
        };

        init();
    }, [navigate]);

    return (
        <div className="App">
            <Header title="Admins Area" />
            <p>Admins have the ability to set roles for other users</p>
        </div>
    )
}

function ViewOwner() {
    const [adminInfo, setAdminInfo] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await api.get(`/admin`);
                setAdminInfo(response.data);
            }
            catch (error: any) {
                navigate('/');
            }
        };

        init();
    }, [navigate]);

    return (
        <div className="App">
            <Header title="Owner Area" />
            <h2>database</h2>
            <pre>{JSON.stringify(adminInfo, null, 4)}</pre>
        </div>
    )
}

function ViewProfile() {
    const { did } = useParams();
    const navigate = useNavigate();
    const [auth, setAuth] = useState<AuthState | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [currentName, setCurrentName] = useState<string>("");
    const [newName, setNewName] = useState<string>("");
    const [roleList, setRoleList] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState<string>("");
    const [newRole, setNewRole] = useState<string>("");

    useEffect(() => {
        const init = async () => {
            try {
                const getAuth = await api.get(`/check-auth`);
                const auth: AuthState = getAuth.data;

                setAuth(auth);

                const getProfile = await api.get(`/profile/${did}`);
                const profile = getProfile.data;

                setProfile(profile);

                if (profile.name) {
                    setCurrentName(profile.name);
                    setNewName(profile.name);
                }

                if (profile.role) {
                    setCurrentRole(profile.role);
                    setNewRole(profile.role);
                }

                setRoleList(['Admin', 'Moderator', 'Member']);
            }
            catch (error: any) {
                navigate('/');
            }
        };

        init();
    }, [did, navigate]);

    async function saveName() {
        try {
            const name = newName.trim();
            await api.put(`/profile/${profile.did}/name`, { name });
            setNewName(name);
            setCurrentName(name);
            profile.name = name;
        }
        catch (error: any) {
            window.alert(error);
        }
    }

    async function saveRole() {
        try {
            const role = newRole;
            await api.put(`/profile/${profile.did}/role`, { role });
            setNewRole(role);
            setCurrentRole(role);
            profile.role = role;
        }
        catch (error: any) {
            window.alert(error);
        }
    }

    function formatDate(time: string) {
        const date = new Date(time);
        const now = new Date();
        const days = differenceInDays(now, date);

        return `${format(date, 'yyyy-MM-dd HH:mm:ss')} (${days} days ago)`;
    }

    if (!profile) {
        return (
            <div className="App">
                <Header title="Profile" />
                <p>Loading...</p>
            </div>
        )
    }

    return (
        <div className="App">
            <Header title="Profile" />
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
                            {profile.isUser && currentRole !== 'Owner' ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <TextField
                                        label=""
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        slotProps={{
                                            htmlInput: {
                                                maxLength: 20,
                                            },
                                        }}
                                        sx={{ width: 300 }}
                                        margin="normal"
                                        fullWidth
                                    />
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={saveName}
                                        disabled={newName === currentName}
                                    >
                                        Save
                                    </Button>
                                </Box>
                            ) : (
                                currentName
                            )}
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Role:</TableCell>
                        <TableCell>
                            {auth?.isAdmin && currentRole !== 'Owner' ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Select
                                        value={newRole}
                                        displayEmpty
                                        onChange={(event) => setNewRole(event.target.value)}
                                        sx={{ width: 300 }}
                                        fullWidth
                                    >
                                        <MenuItem value="" disabled>
                                            Select role
                                        </MenuItem>
                                        {roleList.map((role, index) => (
                                            <MenuItem value={role} key={index}>
                                                {role}
                                            </MenuItem>
                                        ))}
                                    </Select>

                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={saveRole}
                                        disabled={newRole === currentRole}
                                    >
                                        Save
                                    </Button>
                                </Box>
                            ) : (
                                currentRole
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

    return null;
}

export default App;
