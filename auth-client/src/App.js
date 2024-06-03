import React, { useEffect, useState } from "react";
import {
    useNavigate,
    useParams,
    BrowserRouter as Router,
    Link,
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
                <Route path="/users" element={<ViewUsers />} />
                <Route path="/admin" element={<ViewAdmin />} />
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

    return (
        <div className="App">
            <Header title="Home" />
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
                        `Welcome back, ${userName || userDID}`
                    ) : (
                        `Welcome, ${userDID}`
                    )}
                    <br />
                    You have access to the following pages:
                    <ul>
                        <li><a href={`/profile/${userDID}`}>Profile</a></li>
                        <li><a href='/users'>Users</a></li>
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
            <Header title="Login" />
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

function ViewUsers() {
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
            <Header title="Users" />
            <Table style={{ width: '800px' }}>
                <TableBody>
                    {users.map((did, index) => (
                        <TableRow key={index}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell><a href={`/profile/${did}`}>{did}</a></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
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
            <Header title="Admin" />
            <pre>{JSON.stringify(adminInfo, null, 4)}</pre>
        </div>
    )
}

function ViewProfile() {
    const { did } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [oldName, setOldName] = useState("");
    const [newName, setNewName] = useState("");

    useEffect(() => {
        const init = async () => {
            try {
                const response = await axios.get(`/api/profile/${did}`);
                const profile = response.data;

                setProfile(profile);

                if (profile.name) {
                    setOldName(profile.name);
                    setNewName(profile.name);
                }
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
            setOldName(name);
            profile.name = name;
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
        return <p></p>;
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
                            {profile.isUser ? (
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
                                        <Button variant="contained" color="primary" onClick={saveName} disabled={newName === oldName}>
                                            Save
                                        </Button>
                                    </Grid>
                                </Grid>
                            ) : (
                                oldName
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
