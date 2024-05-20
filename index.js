import express from 'express';
import session from 'express-session';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';
import * as keymaster from './keymaster-sdk.js';

const app = express();
const port = 3000;
const domain = 'localhost';

app.use(morgan('dev'));
app.use(express.json());

// Session setup
app.use(session({
    secret: 'MDIP',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true } // Set to true if using HTTPS
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'auth-client/build')));

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.status(401).send('You need to log in first');
}

app.get('/api/version', async (req, res) => {
    try {
        res.json(1);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

app.get('/api/challenge', async (req, res) => {
    try {
        const challenge = await keymaster.createChallenge();
        res.json(challenge);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { response, challenge } = req.body;
        const verify = await keymaster.verifyResponse(response, challenge);

        if (verify.match) {
            const docs = await keymaster.resolveDID(response);
            req.session.user = { did: docs.didDocument.controller };
        }

        res.json({ authenticated: verify.match });
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

app.post('/api/logout', (req, res) => {
    try {
        req.session.destroy();
        res.redirect('/login');
    }
    catch (error) {
        res.status(500).send(error.toString());
    }
});

app.get('/api/check-auth', (req, res) => {
    try {
        const isAuthenticated =  req.session.user ? true : false;
        const userDID = isAuthenticated ? req.session.user.did : null;
        const isAdmin = false;
        const roles = [];

        const auth = {
            isAuthenticated,
            userDID,
            isAdmin,
            roles,
        };

        res.json(auth);
    }
    catch (error) {
        res.status(500).send(error.toString());
    }
});

app.get('/api/protected', isAuthenticated, (req, res) => {
    try {
        req.session.destroy();
        res.redirect('/login');
    }
    catch (error) {
        res.status(500).send(error.toString());
    }
});

app.use((req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'auth-client/build', 'index.html'));
    } else {
        console.warn(`Warning: Unhandled API endpoint - ${req.method} ${req.originalUrl}`);
        res.status(404).json({ message: 'Endpoint not found' });
    }
});

process.on('uncaughtException', (error) => {
    console.error('Unhandled exception caught', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Read the certificate and key
const options = {
    key: fs.readFileSync(`${domain}-key.pem`),
    cert: fs.readFileSync(`${domain}.pem`)
};

https.createServer(options, app).listen(port, () => {
    console.log(`auth-demo listening at https://${domain}:${port}`);
});
