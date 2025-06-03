import express, {
    Request,
    Response,
    NextFunction
} from 'express';
import session from 'express-session';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';

import CipherNode from '@mdip/cipher/node';
import GatekeeperClient from '@mdip/gatekeeper/client';
import Keymaster from '@mdip/keymaster';
import KeymasterClient from '@mdip/keymaster/client';
import WalletJson from '@mdip/keymaster/wallet/json';
import { DatabaseInterface, User, Vault, VaultMemberDetails } from './db/interfaces.js';
import { DbJson } from './db/json.js';
import { DbSqlite } from './db/sqlite.js';

let keymaster: Keymaster | KeymasterClient;
let db: DatabaseInterface;

dotenv.config();

const HOST_PORT = Number(process.env.AD_HOST_PORT) || 3000;
const HOST_URL = process.env.AD_HOST_URL || 'http://localhost:3000';
const GATEKEEPER_URL = process.env.AD_GATEKEEPER_URL || 'http://localhost:4224';
const WALLET_URL = process.env.AD_WALLET_URL || 'http://localhost:4224';
const AD_DATABASE_TYPE = process.env.AD_DATABASE || 'json';

const app = express();
const logins: Record<string, {
    response: string;
    challenge: string;
    did: string;
    verify: any;
}> = {};

const ownerName = 'group-vault-owner';

export interface ClientVaultMember {
    did: string;
    name: string;
    role: 'Admin' | 'Moderator' | 'Member';
    dateAdded: string;
}

app.use(morgan('dev'));
app.use(express.json());

// Session setup
app.use(session({
    secret: 'MDIP',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

let ownerDID = '';

async function verifyOwner(): Promise<void> {
    try {
        const docs = await keymaster.resolveDID(ownerName);
        if (!docs.didDocument?.id) {
            throw new Error('No DID found');
        }
        ownerDID = docs.didDocument.id;
        console.log(`${ownerName}: ${ownerDID}`);
    }
    catch (error) {
        console.log(`Creating ID ${ownerName}`);
        ownerDID = await keymaster.createId(ownerName);
    }

    await keymaster.setCurrentId(ownerName);
}

function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
    if (req.session.user) {
        return next();
    }
    res.status(401).send('You need to log in first');
}

function isSuperAdmin(req: Request, res: Response, next: NextFunction): void {
    isAuthenticated(req, res, async () => {
        const userDid = req.session.user?.did;
        if (userDid === ownerDID) {
            return next();
        }
        res.status(403).send('Super admin access required');
    });
}

async function loginUser(response: string): Promise<any> {
    const verify = await keymaster.verifyResponse(response, { retries: 10 });

    if (verify.match) {
        const challenge = verify.challenge;
        const did = verify.responder!;
        const currentDb = db.loadDb();

        if (!currentDb.users) {
            currentDb.users = {};
        }

        const now = new Date().toISOString();

        if (currentDb.users[did]) {
            currentDb.users[did].lastLogin = now;
            currentDb.users[did].logins = (currentDb.users[did].logins || 0) + 1;
        } else {
            currentDb.users[did] = {
                firstLogin: now,
                lastLogin: now,
                logins: 1
            }
        }

        db.writeDb(currentDb);

        logins[challenge] = {
            response,
            challenge,
            did,
            verify,
        };
    }

    return verify;
}

const getVaultRoleGroupName = (vaultDID: string, role: 'Admin' | 'Moderator' | 'Member'): string => {
    const didSuffix = vaultDID.slice(-16);
    const roleString = role.toLowerCase();
    return `vault-${didSuffix}-${roleString}`;
};

async function isUserVaultAdmin(vaultDID: string, userDID: string): Promise<boolean> {
    if (userDID === ownerDID) {
        return true;
    }
    const vaultAdminGroupName = getVaultRoleGroupName(vaultDID, 'Admin');
    try {
        return await keymaster.testGroup(vaultAdminGroupName, userDID);
    } catch (error) {
        console.warn(`Error testing group membership for ${vaultAdminGroupName}:`, error);
        return false;
    }
}

async function isUserVaultModerator(vaultDID: string, userDID: string): Promise<boolean> {
    if (await isUserVaultAdmin(vaultDID, userDID)) {
        return true;
    }
    const vaultModeratorGroupName = getVaultRoleGroupName(vaultDID, 'Moderator');
    try {
        return await keymaster.testGroup(vaultModeratorGroupName, userDID);
    } catch (error) {
        console.warn(`Error testing group membership for ${vaultModeratorGroupName} (Moderator role):`, error);
        return false;
    }
}

async function isUserVaultMember(vaultDID: string, userDID: string): Promise<boolean> {
    if (await isUserVaultModerator(vaultDID, userDID)) {
        return true;
    }
    const vaultMemberGroupName = getVaultRoleGroupName(vaultDID, 'Member');
    try {
        return await keymaster.testGroup(vaultMemberGroupName, userDID);
    } catch (error) {
        console.warn(`Error testing group membership for ${vaultMemberGroupName} (Member role):`, error);
        return false;
    }
}

const corsOptions = {
    origin: process.env.AD_CORS_SITE_ORIGIN || 'http://localhost:3001', // Origin needs to be specified with credentials true
    methods: ['DELETE', 'GET', 'POST', 'PUT'],  // Specify which methods are allowed (e.g., GET, POST)
    credentials: true,         // Enable if you need to send cookies or authorization headers
    optionsSuccessStatus: 200  // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

app.options('/api/{*path}', cors(corsOptions));

app.get('/api/version', async (_: Request, res: Response) => {
    try {
        res.json(1);
    } catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});

app.get('/api/challenge', async (req: Request, res: Response) => {
    try {
        const challenge = await keymaster.createChallenge({
            callback: `${HOST_URL}/api/login`
        });
        req.session.challenge = challenge;
        const challengeURL = `${WALLET_URL}?challenge=${challenge}`;

        const doc = await keymaster.resolveDID(challenge);
        console.log(JSON.stringify(doc, null, 4));
        res.json({ challenge, challengeURL });
    } catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});

app.get('/api/login', cors(corsOptions), async (req: Request, res: Response) => {
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
    } catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});

app.post('/api/login', cors(corsOptions), async (req: Request, res: Response) => {
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
    } catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});

app.post('/api/logout', async (req: Request, res: Response) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log(err);
            }
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});

app.get('/api/check-auth', async (req: Request, res: Response) => {
    try {
        if (!req.session.user && req.session.challenge) {
            const challengeData = logins[req.session.challenge];
            if (challengeData) {
                req.session.user = { did: challengeData.did };
            }
        }

        const isAuthenticated = !!req.session.user;
        const userDID = isAuthenticated ? req.session.user?.did : null;
        const currentDb = db.loadDb();

        let isOwner = false;
        let profile: User | null = null;
        let vaultMemberFor: string[] = [];
        let vaultModeratorFor: string[] = [];
        let vaultAdminFor: string[] = [];

        if (isAuthenticated && userDID) {
            profile = currentDb.users?.[userDID] || null;
            if (userDID === ownerDID) {
                isOwner = true;
            }

            const allVaultsInSystem = await db.getAllVaults();
            for (const vaultDID in allVaultsInSystem) {
                const vaultMemberGroupName = getVaultRoleGroupName(vaultDID, 'Member');
                const vaultModeratorGroupName = getVaultRoleGroupName(vaultDID, 'Moderator');
                const vaultAdminGroupName = getVaultRoleGroupName(vaultDID, 'Admin');
                try {
                    if (await keymaster.testGroup(vaultMemberGroupName, userDID)) {
                        vaultMemberFor.push(vaultDID);
                    }
                    if (await keymaster.testGroup(vaultModeratorGroupName, userDID)) {
                        vaultModeratorFor.push(vaultDID);
                    }
                    if (await keymaster.testGroup(vaultAdminGroupName, userDID)) {
                        vaultAdminFor.push(vaultDID);
                    }
                } catch (error) {
                    console.warn(`Could not test membership for user ${userDID} in vault admin group ${vaultAdminGroupName} for vault ${vaultDID}`);
                }
            }
        }

        const auth = {
            isAuthenticated,
            userDID,
            isOwner,
            profile,
            vaultMemberFor,
            vaultModeratorFor,
            vaultAdminFor
        };

        res.json(auth);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            isAuthenticated: false,
            userDID: null,
            isOwner: false,
            profile: null,
            vaultMemberFor: [],
            vaultModeratorFor: [],
            vaultAdminFor: [],
            error: "Failed to check authentication status",
        });
    }
});

app.get('/api/profile/:did', isAuthenticated, async (req: Request, res: Response) => {
    try {
        const did = req.params.did;
        const currentDb = db.loadDb();

        if (!currentDb.users || !currentDb.users[did]) {
            res.status(404).send('Not found');
            return;
        }

        const profile: User = { ...currentDb.users[did] };

        profile.did = did;
        profile.isUser = (req.session?.user?.did === did);

        res.json(profile);
    }
    catch (error) {
        console.log(error);
        res.status(500).send(String(error));
    }
});

app.get('/api/did/:id', async (req, res) => {
    try {
        const docs = await keymaster.resolveDID(req.params.id, req.query);
        res.json({ docs });
    } catch (error: any) {
        res.status(404).send("DID not found");
    }
});

app.post('/api/vaults', isSuperAdmin, async (req: Request, res: Response) => {
    try {
        const { vaultName } = req.body;
        if (!vaultName || typeof vaultName !== 'string' || vaultName.trim() === '') {
            res.status(400).json({ message: 'Vault name is required.' });
            return;
        }

        if (vaultName.length > 32) {
            res.status(400).json({ message: 'Vault name too long, max 32 chars.' });
            return;
        }

        const newVaultDID = await keymaster.createGroupVault();

        const vaultInfo: Omit<Vault, 'did' | 'members'> = {
            name: vaultName.trim(),
            controller: ownerDID,
            createdDate: new Date().toISOString(),
        };
        await db.addVault(newVaultDID, vaultInfo);

        const vaultAdminGroupName = getVaultRoleGroupName(newVaultDID, 'Admin');
        const vaultModeratorGroupName = getVaultRoleGroupName(newVaultDID, 'Moderator');
        const vaultMemberGroupName = getVaultRoleGroupName(newVaultDID, 'Member');

        try {
            const did = await keymaster.createGroup(vaultAdminGroupName);
            await keymaster.addName(vaultAdminGroupName, did);
            await keymaster.addGroupMember(did, ownerDID);
            console.log(`Created vault admin group: ${vaultAdminGroupName}`);
        } catch (e) {
            console.error(`Error creating/joining admin group for ${newVaultDID}:`, e);
        }

        try {
            const did = await keymaster.createGroup(vaultModeratorGroupName);
            await keymaster.addName(vaultModeratorGroupName, did);
            await keymaster.addGroupMember(did, vaultAdminGroupName);
            console.log(`Created vault moderator group: ${vaultModeratorGroupName}`);
        } catch (e) {
            console.error(`Error creating moderator group for ${newVaultDID}:`, e);
        }

        try {
            const did = await keymaster.createGroup(vaultMemberGroupName);
            await keymaster.addName(vaultMemberGroupName, did);
            await keymaster.addGroupMember(did, vaultModeratorGroupName);
            console.log(`Created vault member group: ${vaultMemberGroupName}`);
        } catch (e) {
            console.error(`Error creating member group for ${newVaultDID}:`, e);
        }

        res.status(201).json({ did: newVaultDID, name: vaultInfo.name });
    } catch (error) {
        console.error('Error creating vault:', error);
        res.status(500).json({ message: 'Failed to create vault', error: String(error) });
    }
});

app.get('/api/vaults', isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userDID = req.session.user!.did;
        const allVaultsFromDb = await db.getAllVaults();
        const accessibleVaultsList: { did: string, name: string }[] = [];

        if (userDID === ownerDID) {
            for (const did in allVaultsFromDb) {
                accessibleVaultsList.push({ did, name: allVaultsFromDb[did].name });
            }
        } else {
            for (const vaultDID in allVaultsFromDb) {
                const vault = allVaultsFromDb[vaultDID];
                const vaultBaseMemberGroupName = getVaultRoleGroupName(vaultDID, 'Member');

                try {
                    const isMember = await keymaster.testGroup(vaultBaseMemberGroupName, userDID);
                    if (isMember) {
                        accessibleVaultsList.push({ did: vaultDID, name: vault.name });
                    }
                } catch (error: any) {
                    console.warn(`Could not test membership for user ${userDID} in group ${vaultBaseMemberGroupName} for vault ${vaultDID}. Group might not exist. Error: ${error.message}`);
                }
            }
        }

        res.json(accessibleVaultsList);
    } catch (error) {
        console.error('Error listing vaults:', error);
        res.status(500).json({ message: 'Failed to list vaults', error: String(error) });
    }
});

app.get('/api/vaults/:vaultDID/members', isAuthenticated, async (req: Request, res: Response) => {
    const { vaultDID } = req.params;
    const requestingUserDID = req.session.user!.did;

    try {
        const userCanViewMembers = await isUserVaultAdmin(vaultDID, requestingUserDID);
        if (!userCanViewMembers) {
            res.status(403).json({ message: 'Access Denied. Owner or Vault Admin rights required to view vault members.' });
            return;
        }

        let actualVaultMembersMap: Record<string, { added: string }>;
        try {
            actualVaultMembersMap = await keymaster.listGroupVaultMembers(vaultDID);
        } catch (error: any) {
            console.error(`Keymaster error calling listGroupVaultMembers for vault ${vaultDID}:`, error);
            res.status(500).json({
                message: `Failed to retrieve core member list from Keymaster for vault ${vaultDID}.`,
                error: error.message || String(error)
            });
            return;
        }

        const enrichedMembersList: ClientVaultMember[] = [];

        for (const memberDID in actualVaultMembersMap) {
            const vaultAssetMemberData = actualVaultMembersMap[memberDID];

            let roleInVault: ClientVaultMember['role'] = 'Member';
            try {
                if (await keymaster.testGroup(getVaultRoleGroupName(vaultDID, 'Admin'), memberDID)) {
                    roleInVault = 'Admin';
                } else if (await keymaster.testGroup(getVaultRoleGroupName(vaultDID, 'Moderator'), memberDID)) {
                    roleInVault = 'Moderator';
                }
            } catch (roleError: any) {
                console.warn(`Error checking role for ${memberDID} in vault ${vaultDID}: ${roleError.message}. Defaulting to 'Member'.`);
            }

            const dbVaultMemberRecord = await db.getVaultMember(vaultDID, memberDID);
            const friendlyName = dbVaultMemberRecord?.name || memberDID;

            enrichedMembersList.push({
                did: memberDID,
                name: friendlyName,
                role: roleInVault,
                dateAdded: vaultAssetMemberData.added,
            });
        }
        res.json(enrichedMembersList);

    } catch (error: any) {
        console.error(`Error listing members for vault ${vaultDID}:`, error);
        res.status(500).json({ message: `Failed to list members for vault ${vaultDID}`, error: String(error.message || error) });
    }
});

app.post('/api/vaults/:vaultDID/members', isAuthenticated, async (req: Request, res: Response) => {
    const { vaultDID } = req.params;
    const { memberDID, memberName, role } = req.body as { memberDID: string, memberName: string, role: 'Admin' | 'Moderator' | 'Member' };
    const requestingUserDID = req.session.user!.did;

    if (!memberDID || !memberName || !role || !['Admin', 'Moderator', 'Member'].includes(role)) {
        res.status(400).json({ message: 'Missing or invalid parameters: memberDID, memberName, role (Admin, Moderator, Member) are required.' });
        return;
    }

    if (memberName.length > 32) {
        res.status(400).json({ message: 'Member name too long, max 32 chars.' });
        return;
    }

    try {
        const isSuperAdminUser = requestingUserDID === ownerDID;
        const userIsVaultAdmin = isUserVaultAdmin(vaultDID, requestingUserDID);
        if (!userIsVaultAdmin) {
            res.status(403).json({ message: 'Access denied. Owner or Vault Admin rights required.' });
            return;
        }

        if (!isSuperAdminUser && role === 'Admin') {
            res.status(403).json({ message: 'Vault Admins cannot add other Admins.' });
            return;
        }

        const targetRoleGroupName = getVaultRoleGroupName(vaultDID, role);
        await keymaster.addGroupMember(targetRoleGroupName, memberDID);
        await keymaster.addGroupVaultMember(vaultDID, memberDID);

        const memberDetails: Omit<VaultMemberDetails, 'did'> = {
            name: memberName,
            role,
            dateAdded: new Date().toISOString(),
        };
        await db.addVaultMember(vaultDID, memberDID, memberDetails);

        res.status(201).json({ did: memberDID, ...memberDetails });

    } catch (error: any) {
        console.error(`Error adding member ${memberDID} to vault ${vaultDID}:`, error);
        res.status(500).json({ message: `Failed to add member to vault ${vaultDID}`, error: String(error.message || error) });
    }
});

app.put('/api/vaults/:vaultDID/members/:memberDID', isAuthenticated, async (req: Request, res: Response) => {
    const { vaultDID, memberDID } = req.params;
    const { newName, newRole } = req.body as { newName?: string, newRole?: 'Admin' | 'Moderator' | 'Member' };
    const requestingUserDID = req.session.user!.did;

    if (!newName && !newRole) {
        res.status(400).json({ message: 'No changes provided (newName or newRole).' });
        return;
    }

    if (newRole && !['Admin', 'Moderator', 'Member'].includes(newRole)) {
        res.status(400).json({ message: 'Invalid newRole provided.' });
        return;
    }

    try {
        const isSuperAdminUser = requestingUserDID === ownerDID;
        const userIsVaultAdmin = isUserVaultAdmin(vaultDID, requestingUserDID);
        if (!userIsVaultAdmin) {
            res.status(403).json({ message: 'Access denied. Owner or Vault Admin rights required.' });
            return;
        }

        const currentMemberDetails = await db.getVaultMember(vaultDID, memberDID);
        if (!currentMemberDetails) {
            res.status(404).json({ message: `Member ${memberDID} not found in vault ${vaultDID}.` });
            return;
        }

        if (newRole && newRole !== currentMemberDetails.role) {
            if (!isSuperAdminUser && (newRole === 'Admin' || currentMemberDetails.role === 'Admin')) {
                res.status(403).json({ message: 'Vault Admins cannot change Admin roles. Only Super Admin can.' });
                return;
            }
        }

        const updatedDetails: Partial<Omit<VaultMemberDetails, 'did'>> = {};

        if (newRole && newRole !== currentMemberDetails.role) {
            const oldRoleGroupName = getVaultRoleGroupName(vaultDID, currentMemberDetails.role);
            const newRoleGroupName = getVaultRoleGroupName(vaultDID, newRole);
            await keymaster.removeGroupMember(oldRoleGroupName, memberDID);
            await keymaster.addGroupMember(newRoleGroupName, memberDID);
            updatedDetails.role = newRole;
        }

        if (newName && newName !== currentMemberDetails.name) {
            updatedDetails.name = newName;
        }

        if (Object.keys(updatedDetails).length > 0) {
            await db.updateVaultMember(vaultDID, memberDID, updatedDetails);
        }

        res.json({ message: 'Member updated successfully.', did: memberDID, ...currentMemberDetails, ...updatedDetails });

    } catch (error) {
        console.error(`Error updating member ${memberDID} in vault ${vaultDID}:`, error);
        res.status(500).json({ message: `Failed to update member in vault ${vaultDID}`, error: String(error) });
    }
});

app.delete('/api/vaults/:vaultDID/members/:memberDID', isAuthenticated, async (req: Request, res: Response) => {
    const { vaultDID, memberDID } = req.params;
    const requestingUserDID = req.session.user!.did;

    try {
        const isSuperAdminUser = requestingUserDID === ownerDID;
        const userIsVaultAdmin = isUserVaultAdmin(vaultDID, requestingUserDID);
        if (!userIsVaultAdmin) {
            res.status(403).json({ message: 'Access denied. Owner or Vault Admin rights required.' });
            return;
        }

        const memberToRemove = await db.getVaultMember(vaultDID, memberDID);
        if (!memberToRemove) {
            res.status(404).json({ message: `Member ${memberDID} not found in vault ${vaultDID}.` });
            return;
        }

        if (!isSuperAdminUser && memberToRemove.role === 'Admin') {
            res.status(403).json({ message: 'Vault Admins cannot remove other Admins. Only Super Admin can.' });
            return;
        }

        if (memberDID === ownerDID && memberToRemove.role === 'Admin') {
            res.status(403).json({ message: 'Super Admin cannot be removed from a vault.' });
            return;
        }

        const currentRoleGroupName = getVaultRoleGroupName(vaultDID, memberToRemove.role);
        await keymaster.removeGroupMember(currentRoleGroupName, memberDID);
        await keymaster.removeGroupVaultMember(vaultDID, memberDID);
        await db.removeVaultMember(vaultDID, memberDID);

        res.json({ message: `Member ${memberDID} removed successfully from vault ${vaultDID}.` });

    } catch (error) {
        console.error(`Error removing member ${memberDID} from vault ${vaultDID}:`, error);
        res.status(500).json({ message: `Failed to remove member from vault ${vaultDID}`, error: String(error) });
    }
});

app.get('/api/vaults/:vaultDID/items', isAuthenticated, async (req: Request, res: Response) => {
    const { vaultDID } = req.params;
    const requestingUserDID = req.session.user!.did;

    try {
        const canViewItems = await isUserVaultMember(vaultDID, requestingUserDID);
        if (!canViewItems) {
            res.status(403).json({ message: 'Access Denied. You must be a member of this vault to view items.' });
            return;
        }

        const itemsMap = await keymaster.listGroupVaultItems(vaultDID);
        const formattedItems: Record<string, any> = {};
        for (const name in itemsMap) {
            if (name.startsWith('login:')) {
                formattedItems[name.substring('login:'.length)] = { ...itemsMap[name], originalName: name, isLogin: true };
            } else {
                formattedItems[name] = { ...itemsMap[name], originalName: name, isLogin: false };
            }
        }
        res.json(formattedItems);

    } catch (error: any) {
        console.error(`Error listing items for vault ${vaultDID}:`, error);
        res.status(500).json({ message: `Failed to list items for vault ${vaultDID}`, error: String(error.message || error) });
    }
});

app.post('/api/vaults/:vaultDID/items', isAuthenticated, async (req: Request, res: Response) => {
    const { vaultDID } = req.params;
    const requestingUserDID = req.session.user!.did;
    const { itemType, name, content, service, username, password } = req.body;

    try {
        const canAddItems = await isUserVaultModerator(vaultDID, requestingUserDID);
        if (!canAddItems) {
            res.status(403).json({ message: 'Access Denied. Owner, Vault Admin, or Vault Moderator rights required to add items.' });
            return;
        }

        let itemName: string;
        let itemBuffer: Buffer;

        if (itemType === 'login') {
            if (!service || !username || !password) {
                res.status(400).json({ message: 'For login items, service, username, and password are required.' });
                return;
            }
            itemName = `login:${service.trim()}`;
            const loginData = { login: { site: service.trim(), username, password } };
            itemBuffer = Buffer.from(JSON.stringify(loginData), 'utf-8');
        } else if (itemType === 'file' && name && content) {
            itemName = name;
            itemBuffer = Buffer.from(content, 'base64');
        } else {
            res.status(400).json({ message: 'Invalid item type or missing parameters. Supported types: "login", "file".' });
            return;
        }

        const success = await keymaster.addGroupVaultItem(vaultDID, itemName, itemBuffer);

        if (success) {
            const allItems = await keymaster.listGroupVaultItems(vaultDID);
            const newItemMetadata = allItems[itemName];
            res.status(201).json({
                name: itemName.startsWith('login:') ? itemName.substring('login:'.length) : itemName,
                metadata: newItemMetadata,
                message: 'Item added successfully'
            });
        } else {
            throw new Error('Keymaster failed to add item to group vault.');
        }

    } catch (error: any) {
        console.error(`Error adding item to vault ${vaultDID}:`, error);
        res.status(500).json({ message: `Failed to add item to vault ${vaultDID}`, error: String(error.message || error) });
    }
});

app.delete('/api/vaults/:vaultDID/items/:itemName', isAuthenticated, async (req: Request, res: Response) => {
    const { vaultDID } = req.params;
    let itemName = req.params.itemName;
    const requestingUserDID = req.session.user!.did;

    try {
        const canRemoveItems = await isUserVaultModerator(vaultDID, requestingUserDID);
        if (!canRemoveItems) {
            res.status(403).json({ message: 'Access Denied. Owner, Vault Admin, or Vault Moderator rights required to remove items.' });
            return;
        }

        const success = await keymaster.removeGroupVaultItem(vaultDID, itemName);

        if (success) {
            res.json({ message: `Item "${itemName}" removed successfully.` });
        } else {
            res.status(404).json({ message: `Item "${itemName}" not found or could not be removed.` });
        }

    } catch (error: any) {
        console.error(`Error removing item "${itemName}" from vault ${vaultDID}:`, error);
        res.status(500).json({ message: `Failed to remove item from vault ${vaultDID}`, error: String(error.message || error) });
    }
});

app.get('/api/vaults/:vaultDID/items/:itemName/content', isAuthenticated, async (req: Request, res: Response) => {
    const { vaultDID } = req.params;
    const itemName = req.params.itemName;
    const requestingUserDID = req.session.user!.did;

    try {
        const canViewContent = await isUserVaultMember(vaultDID, requestingUserDID);
        if (!canViewContent) {
            res.status(403).json({ message: 'Access Denied. You must be a member of this vault to view item content.' });
            return;
        }

        const itemBuffer = await keymaster.getGroupVaultItem(vaultDID, itemName);

        if (itemBuffer) {
            if (itemName.startsWith('login:')) {
                try {
                    const itemJson = JSON.parse(itemBuffer.toString('utf-8'));
                    res.json(itemJson);
                } catch (e) {
                    res.status(500).send('Failed to parse login item content.');
                }
            } else {
                const itemMetadata = (await keymaster.listGroupVaultItems(vaultDID))[itemName];
                if (itemMetadata && itemMetadata.type) {
                    res.type(itemMetadata.type);
                    res.send(itemBuffer);
                } else {
                    res.send(itemBuffer);
                }
            }
        } else {
            res.status(404).json({ message: `Item "${itemName}" not found in vault.` });
        }
    } catch (error: any) {
        console.error(`Error getting item content "${itemName}" from vault ${vaultDID}:`, error);
        res.status(500).json({ message: `Failed to get item content from vault ${vaultDID}`, error: String(error.message || error) });
    }
});

if (process.env.AD_SERVE_CLIENT !== 'false') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientBuildPath = path.join(__dirname, '../../client/build');
    app.use(express.static(clientBuildPath));

    app.use((req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(clientBuildPath, 'index.html'));
        } else {
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
    if (AD_DATABASE_TYPE === 'sqlite') {
        db = new DbSqlite();
    } else {
        db = new DbJson();
    }

    if (db.init) {
        try {
            db.init();
        } catch (e: any) {
            console.error(`Error initialising database: ${e.message}`);
            process.exit(1);
        }
    }

    if (process.env.AD_KEYMASTER_URL) {
        keymaster = new KeymasterClient();
        await keymaster.connect({
            url: process.env.AD_KEYMASTER_URL,
            waitUntilReady: true,
            intervalSeconds: 5,
            chatty: true,
        });
        console.log(`group-vault-demo using keymaster at ${process.env.AD_KEYMASTER_URL}`);
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
        console.log(`group-vault-demo using gatekeeper at ${GATEKEEPER_URL}`);
    }

    await verifyOwner();
    console.log(`group-vault-demo using wallet at ${WALLET_URL}`);
    console.log(`group-vault-demo listening at ${HOST_URL}`);
});
