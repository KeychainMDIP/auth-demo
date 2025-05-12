import express from 'express';
import session from 'express-session';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import CipherNode from '@mdip/cipher/node';
import GatekeeperClient from '@mdip/gatekeeper/client';
import Keymaster from '@mdip/keymaster';
import KeymasterClient from '@mdip/keymaster/client';
import WalletJson from '@mdip/keymaster/wallet/json';
let keymaster;
dotenv.config();
const HOST_PORT = Number(process.env.AD_HOST_PORT) || 3000;
const HOST_URL = process.env.AD_HOST_URL || 'http://localhost:3000';
const GATEKEEPER_URL = process.env.AD_GATEKEEPER_URL || 'http://localhost:4224';
const WALLET_URL = process.env.AD_WALLET_URL || 'http://localhost:4224';
const app = express();
const dbName = 'data/db.json';
const logins = {};
const roles = {
    owner: 'auth-demo-owner',
    admin: 'auth-demo-admin',
    moderator: 'auth-demo-moderator',
    member: 'auth-demo-member',
};
app.use(morgan('dev'));
app.use(express.json());
// Session setup
app.use(session({
    secret: 'MDIP',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));
function loadDb() {
    if (fs.existsSync(dbName)) {
        return JSON.parse(fs.readFileSync(dbName, 'utf-8'));
    }
    else {
        return {};
    }
}
function writeDb(db) {
    fs.writeFileSync(dbName, JSON.stringify(db, null, 4));
}
let ownerDID = '';
async function verifyRoles() {
    const currentId = await keymaster.getCurrentId();
    try {
        const docs = await keymaster.resolveDID(roles.owner);
        if (docs.didDocument?.id) {
            ownerDID = docs.didDocument.id;
            console.log(`${roles.owner}: ${ownerDID}`);
        }
    }
    catch (error) {
        console.log(`Creating ID ${roles.owner}`);
        ownerDID = await keymaster.createId(roles.owner);
    }
    await keymaster.setCurrentId(roles.owner);
    try {
        const docs = await keymaster.resolveDID(roles.admin);
        console.log(`${roles.admin}: ${docs.didDocument?.id}`);
    }
    catch (error) {
        console.log(`Creating group ${roles.admin}`);
        const did = await keymaster.createGroup(roles.admin);
        await keymaster.addName(roles.admin, did);
        await keymaster.addGroupMember(roles.admin, roles.owner);
    }
    try {
        const docs = await keymaster.resolveDID(roles.moderator);
        console.log(`${roles.moderator}: ${docs.didDocument?.id}`);
    }
    catch (error) {
        console.log(`Creating group ${roles.moderator}`);
        const did = await keymaster.createGroup(roles.moderator);
        await keymaster.addName(roles.moderator, did);
        await keymaster.addGroupMember(roles.moderator, roles.admin);
    }
    try {
        const docs = await keymaster.resolveDID(roles.member);
        console.log(`${roles.member}: ${docs.didDocument?.id}`);
    }
    catch (error) {
        console.log(`Creating group ${roles.member}`);
        const did = await keymaster.createGroup(roles.member);
        await keymaster.addName(roles.member, did);
        await keymaster.addGroupMember(roles.member, roles.moderator);
    }
    if (currentId) {
        await keymaster.setCurrentId(currentId);
    }
}
async function getRole(user) {
    try {
        if (user === ownerDID) {
            return 'Owner';
        }
        const isAdmin = await keymaster.testGroup(roles.admin, user);
        if (isAdmin) {
            return 'Admin';
        }
        const isModerator = await keymaster.testGroup(roles.moderator, user);
        if (isModerator) {
            return 'Moderator';
        }
        const isMember = await keymaster.testGroup(roles.member, user);
        if (isMember) {
            return 'Member';
        }
        return null;
    }
    catch (error) {
        console.log(error);
        return null;
    }
}
async function setRole(user, role) {
    try {
        const currentRole = await getRole(user);
        if (currentRole === 'Owner' || role === currentRole) {
            return currentRole;
        }
        if (currentRole === 'Admin') {
            await keymaster.removeGroupMember(roles.admin, user);
        }
        if (currentRole === 'Moderator') {
            await keymaster.removeGroupMember(roles.moderator, user);
        }
        if (currentRole === 'Member') {
            await keymaster.removeGroupMember(roles.member, user);
        }
        if (role === 'Admin') {
            await keymaster.addGroupMember(roles.admin, user);
        }
        if (role === 'Moderator') {
            await keymaster.addGroupMember(roles.moderator, user);
        }
        if (role === 'Member') {
            await keymaster.addGroupMember(roles.member, user);
        }
    }
    catch (error) {
        console.log(error);
    }
    return await getRole(user);
}
async function addMember(userDID) {
    await keymaster.addGroupMember(roles.member, userDID);
    return await getRole(userDID);
}
async function userInRole(user, role) {
    try {
        return await keymaster.testGroup(role, user);
    }
    catch {
        return false;
    }
}
async function verifyDb() {
    console.log('verifying db...');
    const db = loadDb();
    if (db.users) {
        for (const userDID of Object.keys(db.users)) {
            let role = await getRole(userDID);
            if (role) {
                console.log(`User ${userDID} verified in role ${role}`);
            }
            else {
                console.log(`Adding user ${userDID} to ${roles.member}...`);
                role = await addMember(userDID);
            }
            if (role) {
                db.users[userDID].role = role;
            }
            if (role === 'Owner') {
                db.users[userDID].name = roles.owner;
            }
        }
        writeDb(db);
    }
}
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.status(401).send('You need to log in first');
}
function isAdmin(req, res, next) {
    isAuthenticated(req, res, async () => {
        const userDid = req.session.user?.did;
        if (!userDid) {
            res.status(403).send('Admin access required');
            return;
        }
        const inAdminRole = await userInRole(userDid, roles.admin);
        if (inAdminRole) {
            return next();
        }
        res.status(403).send('Admin access required');
    });
}
async function loginUser(response) {
    const verify = await keymaster.verifyResponse(response, { retries: 10 });
    if (verify.match) {
        const challenge = verify.challenge;
        const did = verify.responder;
        const db = loadDb();
        if (!db.users) {
            db.users = {};
        }
        const now = new Date().toISOString();
        if (db.users[did]) {
            db.users[did].lastLogin = now;
            db.users[did].logins = (db.users[did].logins || 0) + 1;
        }
        else {
            const role = await getRole(did) || await addMember(did);
            db.users[did] = {
                firstLogin: now,
                lastLogin: now,
                logins: 1,
                role: role,
            };
        }
        writeDb(db);
        logins[challenge] = {
            response,
            challenge,
            did,
            verify,
        };
    }
    return verify;
}
const corsOptions = {
    origin: process.env.AD_CORS_SITE_ORIGIN || 'http://localhost:3001', // Origin needs to be specified with credentials true
    methods: ['GET', 'POST'], // Specify which methods are allowed (e.g., GET, POST)
    credentials: true, // Enable if you need to send cookies or authorization headers
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};
app.use(cors(corsOptions));
app.options('/api/{*path}', cors(corsOptions));
app.get('/api/version', async (_, res) => {
    try {
        res.json(1);
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.get('/api/challenge', async (req, res) => {
    try {
        const challenge = await keymaster.createChallenge({
            // @ts-ignore
            callback: `${HOST_URL}/api/login`
        });
        req.session.challenge = challenge;
        const challengeURL = `${WALLET_URL}?challenge=${challenge}`;
        const doc = await keymaster.resolveDID(challenge);
        console.log(JSON.stringify(doc, null, 4));
        res.json({ challenge, challengeURL });
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.get('/api/login', cors(corsOptions), async (req, res) => {
    try {
        const { response } = req.query;
        if (typeof response !== 'string') {
            res.status(400).json({ error: 'Missing or invalid response param' });
            return;
        }
        const verify = await loginUser(response);
        if (!verify.challenge) {
            res.json({ authenticated: false });
            return;
        }
        req.session.user = {
            did: verify.responder
        };
        res.json({ authenticated: verify.match });
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.post('/api/login', cors(corsOptions), async (req, res) => {
    try {
        const { response } = req.body;
        const verify = await loginUser(response);
        if (!verify.challenge) {
            res.json({ authenticated: false });
            return;
        }
        req.session.user = {
            did: verify.responder
        };
        res.json({ authenticated: verify.match });
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.post('/api/logout', async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log(err);
            }
        });
        res.redirect('/login');
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.get('/api/check-auth', async (req, res) => {
    try {
        if (!req.session.user && req.session.challenge) {
            const challengeData = logins[req.session.challenge];
            if (challengeData) {
                req.session.user = { did: challengeData.did };
            }
        }
        const isAuthenticated = !!req.session.user;
        const userDID = isAuthenticated ? req.session.user?.did : null;
        const db = loadDb();
        let isOwner = false;
        let isAdmin = false;
        let isModerator = false;
        let isMember = false;
        let profile = null;
        if (isAuthenticated && userDID && db.users) {
            profile = db.users[userDID] || null;
            if (userDID === ownerDID) {
                isOwner = true;
            }
            isAdmin = await userInRole(userDID, roles.admin);
            isModerator = await userInRole(userDID, roles.moderator);
            isMember = await userInRole(userDID, roles.member);
        }
        const auth = {
            isAuthenticated,
            userDID,
            isOwner,
            isAdmin,
            isModerator,
            isMember,
            profile,
        };
        res.json(auth);
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.get('/api/users', isAuthenticated, async (_, res) => {
    try {
        const db = loadDb();
        const users = db.users ? Object.keys(db.users) : [];
        res.json(users);
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.get('/api/admin', isAdmin, async (_, res) => {
    try {
        res.json(loadDb());
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.get('/api/profile/:did', isAuthenticated, async (req, res) => {
    try {
        const did = req.params.did;
        const db = loadDb();
        if (!db.users || !db.users[did]) {
            res.status(404).send('Not found');
            return;
        }
        const profile = db.users[did];
        profile.did = did;
        profile.role = (await getRole(did));
        profile.isUser = (req.session?.user?.did === did);
        res.json(profile);
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.get('/api/profile/:did/name', isAuthenticated, async (req, res) => {
    try {
        const did = req.params.did;
        const db = loadDb();
        if (!db.users || !db.users[did]) {
            res.status(404).send('Not found');
            return;
        }
        const profile = db.users[did];
        res.json({ name: profile.name });
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.put('/api/profile/:did/name', isAuthenticated, async (req, res) => {
    try {
        const did = req.params.did;
        const { name } = req.body;
        if (!req.session.user || req.session.user.did !== did) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }
        const db = loadDb();
        if (!db.users || !db.users[did]) {
            res.status(404).send('Not found');
            return;
        }
        db.users[did].name = name;
        writeDb(db);
        res.json({ ok: true, message: `name set to ${name}` });
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
const validRoles = ['Admin', 'Moderator', 'Member'];
app.get('/api/roles', async (_, res) => {
    try {
        res.json(validRoles);
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.get('/api/profile/:did/role', isAuthenticated, async (req, res) => {
    try {
        const did = req.params.did;
        const db = loadDb();
        if (!db.users || !db.users[did]) {
            res.status(404).send('Not found');
            return;
        }
        const profile = db.users[did];
        res.json({ role: profile.role });
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
app.put('/api/profile/:did/role', isAdmin, async (req, res) => {
    try {
        const did = req.params.did;
        const { role } = req.body;
        if (!validRoles.includes(role)) {
            res.status(400).send(`valid roles include ${validRoles}`);
            return;
        }
        const db = loadDb();
        if (!db.users || !db.users[did]) {
            res.status(404).send('Not found');
            return;
        }
        db.users[did].role = (await setRole(did, role));
        writeDb(db);
        res.json({ ok: true, message: `role set to ${role}` });
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});
if (process.env.AD_SERVE_CLIENT !== 'false') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientBuildPath = path.join(__dirname, '../../client/build');
    app.use(express.static(clientBuildPath));
    app.use((req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(clientBuildPath, 'index.html'));
        }
        else {
            console.warn(`Warning: Unhandled API endpoint - ${req.method} ${req.originalUrl}`);
            res.status(404).json({ message: 'Endpoint not found' });
        }
    });
}
process.on('uncaughtException', (error) => {
    console.error('Unhandled exception caught', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
app.listen(HOST_PORT, '0.0.0.0', async () => {
    if (process.env.AD_KEYMASTER_URL) {
        keymaster = new KeymasterClient();
        await keymaster.connect({
            url: process.env.AD_KEYMASTER_URL,
            waitUntilReady: true,
            intervalSeconds: 5,
            chatty: true,
        });
        console.log(`auth-demo using keymaster at ${process.env.AD_KEYMASTER_URL}`);
    }
    else {
        const gatekeeper = new GatekeeperClient();
        await gatekeeper.connect({
            url: GATEKEEPER_URL,
            waitUntilReady: true,
            intervalSeconds: 5,
            chatty: true,
        });
        const wallet = new WalletJson();
        const cipher = new CipherNode();
        keymaster = new Keymaster({
            gatekeeper,
            wallet,
            cipher
        });
        console.log(`auth-demo using gatekeeper at ${GATEKEEPER_URL}`);
    }
    await verifyRoles();
    await verifyDb();
    console.log(`auth-demo using wallet at ${WALLET_URL}`);
    console.log(`auth-demo listening at ${HOST_URL}`);
});
