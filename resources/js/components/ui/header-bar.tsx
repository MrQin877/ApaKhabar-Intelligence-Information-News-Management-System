import { Link, usePage } from '@inertiajs/react';
import { login, register } from '@/routes';
import type { SharedData } from '@/types';

export function HeaderBar() {
    const { auth } = usePage<SharedData>().props;

    return (
        <nav className="border-b border-gray-200 bg-white px-4 py-3 sticky top-0 z-40">
            <div className="mx-auto flex max-w-7xl items-center justify-between">

                {/* Logo */}
                <div className="flex items-center">
                    <Link href="/">
                        <img src="/logo_w_name.svg" alt="ApaKhabar" className="h-10 w-auto" />
                    </Link>
                </div>

                {/* Nav Links */}
                <div className="hidden items-center space-x-6 text-sm font-medium text-gray-700 md:flex">
                    <Link href="/" className="hover:text-green-600">Beranda</Link>
                    <Link href="#" className="hover:text-green-600">Lingkungan</Link>
                    <Link href="#" className="hover:text-green-600">Pengumuman</Link>
                    <Link href="#" className="hover:text-green-600">Kecemasan</Link>
                </div>

                {/* Auth Buttons */}
                <div className="flex items-center space-x-2">
                    {auth.user ? (
                        <>
                            {(auth.user.role === 'admin' || auth.user.role === 'moderator') && (
                                <Link
                                    href="/admin/dashboard"
                                    className="rounded-sm border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-100"
                                >
                                    Dashboard
                                </Link>
                            )}
                            <Link
                                href="/logout"
                                method="post"
                                as="button"
                                className="rounded-sm border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-100"
                            >
                                Keluar
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                href={login()}
                                className="text-sm font-medium text-gray-700 hover:text-black"
                            >
                                Masuk
                            </Link>
                            <Link
                                href={register()}
                                className="rounded-sm bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                            >
                                Daftar
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}