export type User = {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'moderator' | 'villager';
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User | null;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};

export interface SharedData {
    name: string;
    auth: Auth;
    sidebarOpen: boolean;
    categories: string[];
    [key: string]: unknown;
}
