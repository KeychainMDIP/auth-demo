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
const dbName = 'data/db.json';

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

let ownerDID = null;

async function verifyRoles() {
    const currentId = await keymaster.getCurrentId();

    try {
        const docs = await keymaster.resolveDID(roles.owner);
        ownerDID = docs.didDocument.id;
        console.log(`${roles.owner}: ${ownerDID}`);
    }
    catch (error) {
        console.log(`Creating ID ${roles.owner}`);
        ownerDID = await keymaster.createId(roles.owner);
    }

    await keymaster.setCurrentId(roles.owner);

    try {
        const docs = await keymaster.resolveDID(roles.admin);
        console.log(`${roles.admin}: ${docs.didDocument.id}`);
    }
    catch (error) {
        console.log(`Creating group ${roles.admin}`);
        const did = await keymaster.createGroup(roles.admin);
        await keymaster.addName(roles.admin, did);
        await keymaster.groupAdd(roles.admin, roles.owner);
    }

    try {
        const docs = await keymaster.resolveDID(roles.moderator);
        console.log(`${roles.moderator}: ${docs.didDocument.id}`);
    }
    catch (error) {
        console.log(`Creating group ${roles.moderator}`);
        const did = await keymaster.createGroup(roles.moderator);
        await keymaster.addName(roles.moderator, did);
        await keymaster.groupAdd(roles.moderator, roles.admin);
    }

    try {
        const docs = await keymaster.resolveDID(roles.member);
        console.log(`${roles.member}: ${docs.didDocument.id}`);
    }
    catch (error) {
        console.log(`Creating group ${roles.member}`);
        const did = await keymaster.createGroup(roles.member);
        await keymaster.addName(roles.member, did);
        await keymaster.groupAdd(roles.member, roles.moderator);
    }

    await keymaster.setCurrentId(currentId);
}

async function getRole(user) {
    try {
        if (user === ownerDID) {
            return 'Owner';
        }

        const isAdmin = await keymaster.groupTest(roles.admin, user);

        if (isAdmin) {
            return 'Admin';
        }

        const isModerator = await keymaster.groupTest(roles.moderator, user);

        if (isModerator) {
            return 'Moderator';
        }

        const isMember = await keymaster.groupTest(roles.member, user);

        if (isMember) {
            return 'Member';
        }

        return null;
    }
    catch {
        return null;
    }
}

async function setRole(user, role) {
    const currentId = await keymaster.getCurrentId();
    await keymaster.setCurrentId(roles.owner);

    try {
        const currentRole = await getRole(user);

        if (currentRole === 'Owner' || role === currentRole) {
            return currentRole;
        }

        if (currentRole === 'Admin') {
            await keymaster.groupRemove(roles.admin, user);
        }

        if (currentRole === 'Moderator') {
            await keymaster.groupRemove(roles.moderator, user);
        }

        if (currentRole === 'Member') {
            await keymaster.groupRemove(roles.member, user);
        }

        if (role === 'Admin') {
            await keymaster.groupAdd(roles.admin, user);
        }

        if (role === 'Moderator') {
            await keymaster.groupAdd(roles.moderator, user);
        }

        if (role === 'Member') {
            await keymaster.groupAdd(roles.member, user);
        }
    }
    catch (error) {
        console.log(error);
    }

    await keymaster.setCurrentId(currentId);
    return await getRole(user);
}

async function addMember(userDID) {
    // TBD We have to cache the current id only until we fix groupAdd to not use the current id
    const currentId = await keymaster.getCurrentId();
    await keymaster.setCurrentId(roles.owner);
    await keymaster.groupAdd(roles.member, userDID);
    await keymaster.setCurrentId(currentId);

    return await getRole(userDID);
}

async function userInRole(user, role) {
    try {
        const isMember = await keymaster.groupTest(role, user);
        return isMember;
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
            db.users[userDID].role = role;
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
    isAuthenticated(req, res, () => {
        const db = loadDb();

        if (userInRole(req.session.user.did, roles.admin)) {
            return next();
        }
        res.status(403).send('Admin access required');
    });
}

app.get('/api/version', async (req, res) => {
    try {
        res.json(1);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
});

app.get('/api/challenge', async (req, res) => {
    try {
        const challenge = await keymaster.createChallenge();
        res.json(challenge);
    } catch (error) {
        console.log(error);
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
            req.session.user = {
                response,
                challenge,
                did,
                docs,
                verify,
            };

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
                const role = await getRole(did) || await addMember(did);

                db.users[did] = {
                    firstLogin: now,
                    lastLogin: now,
                    logins: 1,
                    role: role,
                }
            }

            writeDb(db);
        }

        res.json({ authenticated: verify.match });
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        req.session.destroy();
        res.redirect('/login');
    }
    catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
});

app.get('/api/check-auth', async (req, res) => {
    try {
        const isAuthenticated = req.session.user ? true : false;
        const userDID = isAuthenticated ? req.session.user.did : null;
        const db = loadDb();

        let isOwner = false;
        let isAdmin = false;
        let isModerator = false;
        let isMember = false;

        const profile = isAuthenticated ? db.users[userDID] : null;

        if (profile) {
            isOwner = (userDID === ownerDID);
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
        res.status(500).send(error.toString());
    }
});

app.get('/api/users', isAuthenticated, async (req, res) => {
    try {
        const db = loadDb();
        const users = Object.keys(db.users);
        res.json(users);
    }
    catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
});

app.get('/api/admin', isAdmin, async (req, res) => {
    try {
        res.json(loadDb());
    }
    catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
});

app.get('/api/profile/:did', isAuthenticated, async (req, res) => {
    try {
        const did = req.params.did;
        const db = loadDb();

        if (!Object.keys(db.users).includes(did)) {
            return res.status(404).send("Not found");
        }

        const profile = db.users[did];

        profile.did = did;
        profile.role = await getRole(did);
        profile.isUser = (req.session?.user?.did === did);

        res.json(profile);
    }
    catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
});

app.get('/api/profile/:did/name', isAuthenticated, async (req, res) => {
    try {
        const did = req.params.did;
        const db = loadDb();

        if (!Object.keys(db.users).includes(did)) {
            return res.status(404).send("Not found");
        }

        const profile = db.users[did];
        res.json({ name: profile.name });
    }
    catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
});

app.put('/api/profile/:did/name', isAuthenticated, async (req, res) => {
    try {
        const did = req.params.did;
        const { name } = req.body;

        if (req.session.user.did !== did) {
            return res.status(403).json({ message: 'Forbidden' });;
        }

        const db = loadDb();
        db.users[did].name = name;
        writeDb(db);

        res.json({ ok: true, message: `name set to ${name}` });
    }
    catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
});

const validRoles = ['Admin', 'Moderator', 'Member'];

app.get('/api/roles', async (req, res) => {
    try {
        res.json(validRoles);
    }
    catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
});

app.get('/api/profile/:did/role', isAuthenticated, async (req, res) => {
    try {
        const did = req.params.did;
        const db = loadDb();

        if (!Object.keys(db.users).includes(did)) {
            return res.status(404).send("Not found");
        }

        const profile = db.users[did];
        res.json({ role: profile.role });
    }
    catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
});

app.put('/api/profile/:did/role', isAdmin, async (req, res) => {
    try {
        const did = req.params.did;
        const { role } = req.body;

        if (!validRoles.includes(role)) {
            return res.status(400).send(`valid roles include ${validRoles}`);
        }

        const db = loadDb();
        db.users[did].role = setRole(did, role);
        writeDb(db);

        res.json({ ok: true, message: `role set to ${role}` });
    }
    catch (error) {
        console.log(error);
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

https.createServer(options, app).listen(port, async () => {
    await keymaster.waitUntilReady();
    await verifyRoles();
    await verifyDb();
    console.log(`auth-demo listening at https://${domain}:${port}`);
});
