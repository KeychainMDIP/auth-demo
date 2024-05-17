import React, { useEffect } from "react";
import {
    useNavigate,
    BrowserRouter as Router,
    Routes,
    Route,
} from "react-router-dom";

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
        <h1>Home</h1>
    )
}

function ViewLogin() {
    return (
        <h1>Login</h1>
    )
}

function NotFound() {
    const navigate = useNavigate();

    useEffect(() => {
        navigate("/");
    });
}

export default App;
