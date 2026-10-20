export type * from './auth';
export type * from './navigation';
export type * from './ui';

export interface SharedData {
    name: string;
    auth: Auth;
    sidebarOpen: boolean;
    categories: string[];
    moderationPendingCount?: number;
    unreadNotifications: number;
    [key: string]: unknown;
}

import type { Auth } from './auth';
