import Database from 'better-sqlite3';
import { DatabaseInterface, DatabaseStructure, User, Vault, VaultMemberDetails } from './interfaces.js';
import fs from "fs";
import path from "path";

export class DbSqlite implements DatabaseInterface {
    private db: Database.Database;
    private readonly dbPath: string;

    constructor(dbPath: string = 'data/db.sqlite') {
        this.dbPath = dbPath;
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created SQLite directory: ${dir}`);
        }
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
    }

    init(): void {
        const createUserTable = `
            CREATE TABLE IF NOT EXISTS users (
                did TEXT PRIMARY KEY,
                firstLogin TEXT,
                lastLogin TEXT,
                logins INTEGER,
                role TEXT,       -- Main application role
                name TEXT        -- User's display name
            );
        `;
        this.db.exec(createUserTable);

        const createGroupVaultsTable = `
            CREATE TABLE IF NOT EXISTS group_vaults (
                vault_did TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                controller TEXT NOT NULL, -- Stores the controller's DID
                created_date TEXT NOT NULL
                -- created_by TEXT NOT NULL -- 'createdBy' was removed from your latest Vault interface
            );
        `;
        this.db.exec(createGroupVaultsTable);

        const createVaultMembersTable = `
            CREATE TABLE IF NOT EXISTS vault_members (
                vault_did TEXT NOT NULL,
                member_did TEXT NOT NULL,
                name TEXT NOT NULL,      -- Friendly name for this member in this vault context
                role TEXT NOT NULL,      -- Role ('Admin', 'Moderator', 'Member') for this vault
                date_added TEXT NOT NULL,
                -- added_by TEXT NOT NULL, -- 'addedBy' was removed from your VaultMemberDetails interface
                PRIMARY KEY (vault_did, member_did),
                FOREIGN KEY (vault_did) REFERENCES group_vaults(vault_did) ON DELETE CASCADE
            );
        `;
        this.db.exec(createVaultMembersTable);
    }

    loadDb(): DatabaseStructure {
        const users: Record<string, User> = {};
        const groupVaults: Record<string, Omit<Vault, 'did'>> = {};

        const userRows = this.db.prepare('SELECT * FROM users').all() as any[];
        for (const row of userRows) {
            users[row.did] = {
                firstLogin: row.firstLogin,
                lastLogin: row.lastLogin,
                logins: row.logins,
                role: row.role,
                name: row.name,
            };
        }

        const vaultRows = this.db.prepare('SELECT * FROM group_vaults').all() as any[];
        for (const vaultRow of vaultRows) {
            const members: Record<string, Omit<VaultMemberDetails, 'did'>> = {};
            const memberRows = this.db.prepare('SELECT * FROM vault_members WHERE vault_did = ?').all(vaultRow.vault_did) as any[];
            for (const memberRow of memberRows) {
                members[memberRow.member_did] = {
                    name: memberRow.name,
                    role: memberRow.role as 'Admin' | 'Moderator' | 'Member',
                    dateAdded: memberRow.date_added,
                };
            }
            groupVaults[vaultRow.vault_did] = {
                name: vaultRow.name,
                controller: vaultRow.controller,
                createdDate: vaultRow.created_date,
                members,
            };
        }
        return { users, groupVaults };
    }

    writeDb(data: DatabaseStructure): void {
        const transaction = this.db.transaction(() => {
            this.db.exec('DELETE FROM vault_members;');
            this.db.exec('DELETE FROM group_vaults;');
            this.db.exec('DELETE FROM users;');

            if (data.users) {
                const insertUser = this.db.prepare(`
                    INSERT INTO users (did, firstLogin, lastLogin, logins, role, name)
                    VALUES (@did, @firstLogin, @lastLogin, @logins, @role, @name)
                `);
                for (const did in data.users) {
                    const user = data.users[did];
                    insertUser.run({
                        did,
                        firstLogin: user.firstLogin || null,
                        lastLogin: user.lastLogin || null,
                        logins: user.logins || null,
                        role: user.role || null,
                        name: user.name || null,
                    });
                }
            }

            if (data.groupVaults) {
                const insertVault = this.db.prepare(`
                    INSERT INTO group_vaults (vault_did, name, controller, created_date)
                    VALUES (@vault_did, @name, @controller, @created_date)
                `);
                const insertVaultMember = this.db.prepare(`
                    INSERT INTO vault_members (vault_did, member_did, name, role, date_added)
                    VALUES (@vault_did, @member_did, @name, @role, @date_added)
                `);

                for (const vaultDID in data.groupVaults) {
                    const vault = data.groupVaults[vaultDID];
                    insertVault.run({
                        vault_did: vaultDID,
                        name: vault.name,
                        controller: vault.controller,
                        created_date: vault.createdDate,
                    });

                    if (vault.members) {
                        for (const memberDID in vault.members) {
                            const member = vault.members[memberDID];
                            insertVaultMember.run({
                                vault_did: vaultDID,
                                member_did: memberDID,
                                name: member.name,
                                role: member.role,
                                date_added: member.dateAdded,
                            });
                        }
                    }
                }
            }
        });

        try {
            transaction();
            console.log("SQLite DB written successfully.");
        } catch (error) {
            console.error('SQLite writeDb transaction failed:', error);
        }
    }

    async addVault(vaultDID: string, vaultInfo: Omit<Vault, 'did' | 'members'>): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO group_vaults (vault_did, name, controller, created_date)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(vaultDID, vaultInfo.name, vaultInfo.controller, vaultInfo.createdDate);
    }

    async getVault(vaultDID: string): Promise<Omit<Vault, 'did' | 'members'> | null> {
        const stmt = this.db.prepare('SELECT name, controller, created_date FROM group_vaults WHERE vault_did = ?');
        const row = stmt.get(vaultDID) as any;
        if (row) {
            return { name: row.name, controller: row.controller, createdDate: row.created_date };
        }
        return null;
    }

    async getAllVaults(): Promise<Record<string, Omit<Vault, 'did' | 'members'>>> {
        const stmt = this.db.prepare('SELECT vault_did, name, controller, created_date FROM group_vaults');
        const rows = stmt.all() as any[];
        const vaultsToReturn: Record<string, Omit<Vault, 'did' | 'members'>> = {};
        for (const row of rows) {
            vaultsToReturn[row.vault_did] = {
                name: row.name,
                controller: row.controller,
                createdDate: row.created_date,
            };
        }
        return vaultsToReturn;
    }

    async addVaultMember(vaultDID: string, memberDID: string, memberDetails: Omit<VaultMemberDetails, 'did'>): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO vault_members (vault_did, member_did, name, role, date_added)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(vaultDID, memberDID, memberDetails.name, memberDetails.role, memberDetails.dateAdded);
    }

    async getVaultMember(vaultDID: string, memberDID: string): Promise<Omit<VaultMemberDetails, 'did'> | null> {
        const stmt = this.db.prepare('SELECT name, role, date_added FROM vault_members WHERE vault_did = ? AND member_did = ?');
        const row = stmt.get(vaultDID, memberDID) as any;
        if (row) {
            return { name: row.name, role: row.role as 'Admin' | 'Moderator' | 'Member', dateAdded: row.date_added };
        }
        return null;
    }

    async getAllVaultMembers(vaultDID: string): Promise<Record<string, Omit<VaultMemberDetails, 'did'>>> {
        const stmt = this.db.prepare('SELECT member_did, name, role, date_added FROM vault_members WHERE vault_did = ?');
        const rows = stmt.all(vaultDID) as any[];
        const members: Record<string, Omit<VaultMemberDetails, 'did'>> = {};
        for (const row of rows) {
            members[row.member_did] = {
                name: row.name,
                role: row.role as 'Admin' | 'Moderator' | 'Member',
                dateAdded: row.date_added,
            };
        }
        return members;
    }

    async updateVaultMember(vaultDID: string, memberDID: string, memberDetailsUpdate: Partial<Omit<VaultMemberDetails, 'did'>>): Promise<void> {
        const fieldsToUpdate: string[] = [];
        const values: any[] = [];

        if (memberDetailsUpdate.name !== undefined) {
            fieldsToUpdate.push('name = ?');
            values.push(memberDetailsUpdate.name);
        }
        if (memberDetailsUpdate.role !== undefined) {
            fieldsToUpdate.push('role = ?');
            values.push(memberDetailsUpdate.role);
        }
        if (memberDetailsUpdate.dateAdded !== undefined) {
            fieldsToUpdate.push('date_added = ?');
            values.push(memberDetailsUpdate.dateAdded);
        }

        if (fieldsToUpdate.length === 0) {
            return;
        }

        values.push(vaultDID);
        values.push(memberDID);

        const sql = `UPDATE vault_members SET ${fieldsToUpdate.join(', ')} WHERE vault_did = ? AND member_did = ?`;
        const stmt = this.db.prepare(sql);
        const info = stmt.run(...values);

        if (info.changes === 0) {
            throw new Error(`Member ${memberDID} in vault ${vaultDID} not found for update, or no changes made.`);
        }
    }

    async removeVaultMember(vaultDID: string, memberDID: string): Promise<void> {
        const stmt = this.db.prepare('DELETE FROM vault_members WHERE vault_did = ? AND member_did = ?');
        stmt.run(vaultDID, memberDID);
    }
}
