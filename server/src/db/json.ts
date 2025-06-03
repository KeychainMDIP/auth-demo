import fs from 'fs';
import path from 'path';
import { DatabaseInterface, DatabaseStructure, Vault, VaultMemberDetails } from './interfaces.js';

export class DbJson implements DatabaseInterface {
    private readonly dbPath: string;

    constructor(dbPath: string = 'data/db.json') {
        this.dbPath = dbPath;
    }

    init(): void {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
        if (!fs.existsSync(this.dbPath)) {
            this.writeDb({ users: {}, groupVaults: {} });
        } else {
            const currentData = this.loadDb();
            if (!currentData.groupVaults) {
                currentData.groupVaults = {};
            }
            if (!currentData.users) {
                currentData.users = {};
            }
            this.writeDb(currentData);
        }
    }

    loadDb(): DatabaseStructure {
        if (fs.existsSync(this.dbPath)) {
            try {
                return JSON.parse(fs.readFileSync(this.dbPath, 'utf-8')) as DatabaseStructure;
            } catch (error) {
                console.error(`Error parsing JSON from ${this.dbPath}:`, error);
            }
        }
        return { users: {}, groupVaults: {} };
    }

    writeDb(data: DatabaseStructure): void {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 4));
        } catch (error) {
            console.error(`Error writing JSON to ${this.dbPath}:`, error);
        }
    }

    async addVault(vaultDID: string, vaultInfo: Omit<Vault, 'did' | 'members'>): Promise<void> {
        const dbData = this.loadDb();
        if (!dbData.groupVaults) {
            dbData.groupVaults = {};
        }
        dbData.groupVaults[vaultDID] = { ...vaultInfo, members: {} };
        this.writeDb(dbData);
    }

    async getVault(vaultDID: string): Promise<Omit<Vault, 'did' | 'members'> | null> {
        const dbData = this.loadDb();
        const vault = dbData.groupVaults?.[vaultDID];
        if (vault) {
            const { members, ...vaultWithoutMembers } = vault;
            return vaultWithoutMembers;
        }
        return null;
    }

    async getAllVaults(): Promise<Record<string, Omit<Vault, 'did' | 'members'>>> {
        const dbData = this.loadDb();
        const vaultsToReturn: Record<string, Omit<Vault, 'did' | 'members'>> = {};
        if (dbData.groupVaults) {
            for (const did in dbData.groupVaults) {
                const { members, ...vaultWithoutMembers } = dbData.groupVaults[did];
                vaultsToReturn[did] = vaultWithoutMembers;
            }
        }
        return vaultsToReturn;
    }

    async addVaultMember(vaultDID: string, memberDID: string, memberDetails: Omit<VaultMemberDetails, 'did'>): Promise<void> {
        const dbData = this.loadDb();
        if (dbData.groupVaults?.[vaultDID]) {
            dbData.groupVaults[vaultDID].members[memberDID] = memberDetails;
            this.writeDb(dbData);
        } else {
            throw new Error(`Vault with DID ${vaultDID} not found for adding member.`);
        }
    }

    async getVaultMember(vaultDID: string, memberDID: string): Promise<Omit<VaultMemberDetails, 'did'> | null> {
        const dbData = this.loadDb();
        return dbData.groupVaults?.[vaultDID]?.members?.[memberDID] || null;
    }

    async getAllVaultMembers(vaultDID: string): Promise<Record<string, Omit<VaultMemberDetails, 'did'>>> {
        const dbData = this.loadDb();
        return dbData.groupVaults?.[vaultDID]?.members || {};
    }

    async updateVaultMember(vaultDID: string, memberDID: string, memberDetailsUpdate: Partial<Omit<VaultMemberDetails, 'did'>>): Promise<void> {
        const dbData = this.loadDb();
        const vault = dbData.groupVaults?.[vaultDID];
        if (vault?.members?.[memberDID]) {
            vault.members[memberDID] = {
                ...vault.members[memberDID],
                ...memberDetailsUpdate
            };
            this.writeDb(dbData);
        } else {
            throw new Error(`Member ${memberDID} in vault ${vaultDID} not found for update.`);
        }
    }

    async removeVaultMember(vaultDID: string, memberDID: string): Promise<void> {
        const dbData = this.loadDb();
        if (dbData.groupVaults?.[vaultDID]?.members) {
            delete dbData.groupVaults[vaultDID].members[memberDID];
            this.writeDb(dbData);
        }
    }
}
