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
const dbName = 'db.json';

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

function loadDb() {
    if (fs.existsSync(dbName)) {
        return JSON.parse(fs.readFileSync(dbName));
    }
    else {
        return {};
    }
}

function writeDb(db) {
    fs.writeFileSync(dbName, JSON.stringify(db, null, 4));
}

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.status(401).send('You need to log in first');
}

function isAdmin(req, res, next) {
    isAuthenticated(req, res, () => {
        const db = loadDb();

        if (req.session.user.did === db.admin) {
            return next();
        }
        res.status(403).send('Admin access required');
    });
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
            const did = docs.didDocument.controller;
            req.session.user = { did };

            const db = loadDb();

            if (!db.users) {
                db.users = {};
            }

            const now = new Date().toISOString();

            if (Object.keys(db.users).includes(did)) {
                db.users[did].lastLogin = now;
                db.users[did].logins += 1;
            }
            else {
                db.users[did] = {
                    firstLogin: now,
                    lastLogin: now,
                    logins: 1,
                }
            }

            writeDb(db);
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
        const roles = [];
        const db = loadDb();
        let isAdmin = false;

        if (userDID) {
            if (db.admin) {
                isAdmin = userDID === db.admin;
            }
            else {
                // First user to login gets admin status
                db.admin = userDID;
                isAdmin = true;
                writeDb(db);
            }
        }

        const history = isAuthenticated ? db.users[userDID] : null;

        const auth = {
            isAuthenticated,
            userDID,
            isAdmin,
            roles,
            history,
        };

        res.json(auth);
    }
    catch (error) {
        res.status(500).send(error.toString());
    }
});

app.get('/api/forum', isAuthenticated, (req, res) => {
    try {
        res.json('forum info');
    }
    catch (error) {
        res.status(500).send(error.toString());
    }
});

app.get('/api/admin', isAdmin, (req, res) => {
    try {
        res.json(loadDb());
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
