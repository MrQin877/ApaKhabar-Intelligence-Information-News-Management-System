// resources/js/pages/dashboard.tsx
import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import type { SharedData } from '@/types';

export default function Dashboard() {
    const { auth } = usePage<SharedData>().props;

    useEffect(() => {
        if (!auth.user) {
            router.visit('/', { replace: true });

            return;
        }

        if (auth.user.role === 'admin' || auth.user.role === 'moderator') {
            router.visit('/admin/dashboard', { replace: true });
        } else {
            router.visit('/', { replace: true });
        }
    }, [auth.user]);

    return null;
}