export interface User {
    firstLogin?: string;
    lastLogin?: string;
    logins?: number;
    role?: string;
    name?: string;
    [key: string]: any;
}

export interface VaultMemberDetails {
    did: string;
    name: string;
    role: 'Admin' | 'Moderator' | 'Member';
    dateAdded: string;
}

export interface Vault {
    did: string;
    name: string;
    controller: string;
    createdDate: string;
    members: Record<string, Omit<VaultMemberDetails, 'did'>>;
}

export interface DatabaseStructure {
    users?: Record<string, User>;
    groupVaults?: Record<string, Omit<Vault, 'did'>>;
}

export interface DatabaseInterface {
    init?(): void;
    loadDb(): DatabaseStructure;
    writeDb(data: DatabaseStructure): void;

    addVault(vaultDID: string, vaultInfo: Omit<Vault, 'did' | 'members'>): Promise<void>;
    getVault(vaultDID: string): Promise<Omit<Vault, 'did' | 'members'> | null>;
    getAllVaults(): Promise<Record<string, Omit<Vault, 'did' | 'members'>>>;

    addVaultMember(vaultDID: string, memberDID: string, memberDetails: Omit<VaultMemberDetails, 'did'>): Promise<void>;
    getVaultMember(vaultDID: string, memberDID: string): Promise<Omit<VaultMemberDetails, 'did'> | null>;
    getAllVaultMembers(vaultDID: string): Promise<Record<string, Omit<VaultMemberDetails, 'did'>>>;
    updateVaultMember(vaultDID: string, memberDID: string, memberDetailsUpdate: Partial<Omit<VaultMemberDetails, 'did'>>): Promise<void>;
    removeVaultMember(vaultDID: string, memberDID: string): Promise<void>;
}
