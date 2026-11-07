import { Link, usePage } from '@inertiajs/react';
import { login, register } from '@/routes';
import type { SharedData } from '@/types';

export function HeaderBar() {
    const { auth, categories = [] } = usePage<SharedData>().props;

    return (
        <nav className="border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 sticky top-0 z-40">
            <div className="mx-auto flex max-w-7xl items-center justify-between">

                {/* Logo */}
                <div className="flex items-center">
                    <Link href="/">
                        <img src="/logo_w_name.svg" alt="ApaKhabar" className="h-10 w-auto" />
                    </Link>
                </div>

                {/* Nav Links — Beranda always first, then dynamic categories */}
                <div className="hidden items-center space-x-6 text-sm font-medium text-gray-700 dark:text-gray-300 md:flex">
                    <Link
                        href="/"
                        className="hover:text-green-600 dark:hover:text-green-400"
                    >
                        Beranda
                    </Link>
                    {categories.map((category) => (
                        <Link
                            key={category}
                            href={`/news?category=${encodeURIComponent(category)}`}
                            className="hover:text-green-600 dark:hover:text-green-400"
                        >
                            {category}
                        </Link>
                    ))}
                </div>

                {/* Auth Buttons */}
                <div className="flex items-center space-x-2">
                    {auth.user ? (
                        <>
                            {(auth.user.role === 'admin' || auth.user.role === 'moderator') && (
                                <Link
                                    href="/admin/dashboard"
                                    className="rounded-sm border border-gray-300 dark:border-neutral-700 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                                >
                                    Dashboard
                                </Link>
                            )}
                            <Link
                                href="/logout"
                                method="post"
                                as="button"
                                className="rounded-sm border border-gray-300 dark:border-neutral-700 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                            >
                                Keluar
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                href={login()}
                                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
                            >
                                Masuk
                            </Link>
                            <Link
                                href={register()}
                                className="rounded-sm bg-green-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-800"
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