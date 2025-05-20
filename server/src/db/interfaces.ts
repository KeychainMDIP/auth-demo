export interface User {
    firstLogin?: string;
    lastLogin?: string;
    logins?: number;
    role?: string;
    name?: string;
    [key: string]: any;
}

export interface DatabaseStructure {
    users?: Record<string, User>;
}

export interface DatabaseInterface {
    init?(): void;
    loadDb(): DatabaseStructure;
    writeDb(data: DatabaseStructure): void;
}
