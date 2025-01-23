import React, { useEffect, useState, useRef } from "react";
import {
    useNavigate,
    useParams,
    BrowserRouter as Router,
    Link,
    Routes,
    Route,
} from "react-router-dom";
import { Box, Button, Grid, Select, MenuItem, TextField, Typography } from '@mui/material';
import { Table, TableBody, TableRow, TableCell } from '@mui/material';
import axios from 'axios';
import { format, differenceInDays } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';

import './App.css';

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

function Header({ title }) {
    return (
        <Grid container direction="row" justifyContent="flex-start" alignItems="center" spacing={3}>
            <Grid item>
                <Link to="/">
                    <img src="/demo.png" alt="home" />
                </Link>
            </Grid>
            <Grid item>
                <h1>{title}</h1>
            </Grid>
        </Grid>
    )
}

function Home() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [auth, setAuth] = useState(null);
    const [userDID, setUserDID] = useState('');
    const [userName, setUserName] = useState('');
    const [logins, setLogins] = useState(0);

    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await axios.get(`/api/check-auth`);
                const auth = response.data;
                setAuth(auth);
                setIsAuthenticated(auth.isAuthenticated);
                setUserDID(auth.userDID);

                if (auth.profile) {
                    setLogins(auth.profile.logins);

                    if (auth.profile.name) {
                        setUserName(auth.profile.name);
                    }
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
            <Grid container style={{ width: '400px' }}>
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
    const [challengeDID, setChallengeDID] = useState('');
    const [responseDID, setResponseDID] = useState('');
    const [loggingIn, setLoggingIn] = useState(false);
    const [challengeURL, setChallengeURL] = useState(null);
    const [extensionURL, setExtensionURL] = useState('');
    const [challengeCopied, setChallengeCopied] = useState(false);

    const navigate = useNavigate();
    const intervalIdRef = useRef();

    useEffect(() => {
        const init = async () => {
            try {
                intervalIdRef.current = setInterval(async () => {
                    try {
                        const response = await axios.get('/api/check-auth');
                        if (response.data.isAuthenticated) {
                            clearInterval(intervalIdRef.current);
                            navigate('/');
                        }
                    } catch (error) {
                        console.error('Failed to check authentication:', error);
                    }
                }, 1000); // Check every second

                const response = await axios.get(`/api/challenge`);
                const { challenge, challengeURL } = response.data;
                setChallengeDID(challenge);
                setExtensionURL(`mdip://auth?challenge=${challenge}`);
                setChallengeURL(encodeURI(challengeURL));
            }
            catch (error) {
                window.alert(error);
            }
        };

        init();
        // Clear the interval when the component is unmounted
        return () => clearInterval(intervalIdRef.current);
    }, []);

    async function login() {
        setLoggingIn(true);

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

        setLoggingIn(false);
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            setChallengeCopied(true);
        }
        catch (error) {
            window.alert('Failed to copy text: ', error);
        }
    };

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
                                inputProps={{ maxLength: 80 }}
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

function ViewMembers() {
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await axios.get(`/api/check-auth`);
                const auth = response.data;

                if (!auth.isMember) {
                    navigate('/');
                }
            }
            catch (error) {
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
    const [users, setUsers] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const response = await axios.get(`/api/users`);
                setUsers(response.data);
            }
            catch (error) {
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
                const response = await axios.get(`/api/check-auth`);
                const auth = response.data;

                if (!auth.isAdmin) {
                    navigate('/');
                }
            }
            catch (error) {
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
            <Header title="Owner Area" />
            <h2>database</h2>
            <pre>{JSON.stringify(adminInfo, null, 4)}</pre>
        </div>
    )
}

function ViewProfile() {
    const { did } = useParams();
    const navigate = useNavigate();
    const [auth, setAuth] = useState(null);
    const [profile, setProfile] = useState(null);
    const [currentName, setCurrentName] = useState("");
    const [newName, setNewName] = useState("");
    const [roleList, setRoleList] = useState([]);
    const [currentRole, setCurrentRole] = useState("");
    const [newRole, setNewRole] = useState("");

    useEffect(() => {
        const init = async () => {
            try {
                const getAuth = await axios.get(`/api/check-auth`);
                const auth = getAuth.data;

                setAuth(auth);

                const getProfile = await axios.get(`/api/profile/${did}`);
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
            catch (error) {
                navigate('/');
            }
        };

        init();
    }, [did, navigate]);

    async function saveName() {
        try {
            const name = newName.trim();
            await axios.put(`/api/profile/${profile.did}/name`, { name });
            setNewName(name);
            setCurrentName(name);
            profile.name = name;
        }
        catch (error) {
            window.alert(error);
        }
    }

    async function saveRole() {
        try {
            const role = newRole;
            await axios.put(`/api/profile/${profile.did}/role`, { role });
            setNewRole(role);
            setCurrentRole(role);
            profile.role = role;
        }
        catch (error) {
            window.alert(error);
        }
    }

    function formatDate(time) {
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
                                <Grid container direction="row" justifyContent="flex-start" alignItems="center" spacing={3}>
                                    <Grid item>
                                        <TextField
                                            label=""
                                            style={{ width: '300px' }}
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            fullWidth
                                            margin="normal"
                                            inputProps={{ maxLength: 20 }}
                                        />
                                    </Grid>
                                    <Grid item>
                                        <Button variant="contained" color="primary" onClick={saveName} disabled={newName === currentName}>
                                            Save
                                        </Button>
                                    </Grid>
                                </Grid>
                            ) : (
                                currentName
                            )}
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Role:</TableCell>
                        <TableCell>
                            {auth.isAdmin && currentRole !== 'Owner' ? (
                                <Grid container direction="row" justifyContent="flex-start" alignItems="center" spacing={3}>
                                    <Grid item>
                                        <Select
                                            style={{ width: '300px' }}
                                            value={newRole}
                                            fullWidth
                                            displayEmpty
                                            onChange={(event) => setNewRole(event.target.value)}
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
                                    </Grid>
                                    <Grid item>
                                        <Button variant="contained" color="primary" onClick={saveRole} disabled={newRole === currentRole}>
                                            Save
                                        </Button>
                                    </Grid>
                                </Grid>
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
}

export default App;
