import React, { useEffect, useState } from "react";
import {
    useNavigate,
    BrowserRouter as Router,
    Routes,
    Route,
} from "react-router-dom";
import { Box, Button, Grid, MenuItem, Select, Tab, Tabs } from '@mui/material';
import { Table, TableBody, TableRow, TableCell, TextField, Typography } from '@mui/material';
import axios from 'axios';

import './App.css';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<ViewLogin />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Router>
    );
}

function Home() {
    return (
        <div className="App">
            <h1>Home</h1>
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
            const getAuth = await axios.post(`/api/authenticate`, { challenge: challengeDID, response: responseDID });

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
        window.alert(text);
    }

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

function NotFound() {
    const navigate = useNavigate();

    useEffect(() => {
        navigate("/");
    });
}

export default App;
