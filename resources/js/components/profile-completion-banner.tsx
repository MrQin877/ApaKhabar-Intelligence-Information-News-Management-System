import { Link, usePage } from '@inertiajs/react';
import type { SharedData } from '@/types';
export default function ProfileCompletionBanner() {
    const { auth } = usePage<SharedData>().props;

    if (
        auth.user?.role !== 'villager' ||
        (auth.user.date_of_birth && auth.user.citizenship)
    ) {
        return null;
    }

    return (
        <div className="border-b bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
            Lengkapi tanggal lahir dan kewarganegaraan untuk profil warga Anda.{' '}
            <Link className="font-semibold underline" href="/settings/profile">
                Lengkapi profil
            </Link>
        </div>
    );
}
