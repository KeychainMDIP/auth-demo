export interface ClientVault {
    did: string;
    name: string;
}

export interface ClientVaultMember {
    did: string;
    name: string;
    role: 'Admin' | 'Moderator' | 'Member';
    dateAdded: string;
}

export interface ClientVaultItem {
    name: string;
    originalName: string;
    isLogin: boolean;
    metadata: {
        cid: string;
        sha256: string;
        bytes: number;
        type: string;
        added: string;
    };
}

export interface AuthState {
    isAuthenticated: boolean;
    userDID: string | null;
    isOwner: boolean;
    profile?: {
        logins?: number;
        name?: string;
        [key: string]: any;
    } | null;
    vaultMemberFor?: string[];
    vaultModeratorFor?: string[];
    vaultAdminFor?: string[];
    error?: string;
    [key: string]: any;
}
