import { Link, usePage } from '@inertiajs/react';
import { login, register } from '@/routes';
import type { SharedData } from '@/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu';
import { UserMenuContent } from './user-menu-content';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { Bell } from 'lucide-react';
import { VillagerUserMenuContent } from './villager-user-menu-content';

export function HeaderBar() {
    const getInitials = useInitials();
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

                {/* Nav Links — Beranda always first, then dynamic categories from DB */}
                <div className="hidden items-center space-x-6 text-sm font-medium text-gray-700 dark:text-gray-300 md:flex">
                    <Link href="/" className="hover:text-green-600 dark:hover:text-green-400">
                        Beranda
                    </Link>
                    {(categories as string[]).map((category) => (
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

                            <Link href="/notifications">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="relative h-9 w-9"
                                    >
                                        <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                                        {/* Unread dot — replace hardcoded true with real unread count later */}
                                    </Button>
                                </Link>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="size-10 rounded-full p-1"
                                    >
                                        <Avatar className="size-8 overflow-hidden rounded-full">
                                            <AvatarImage
                                                src={auth.user.avatar}
                                                alt={auth.user.name}
                                            />
                                            <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                                {getInitials(auth.user.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56" align="end">
                                        <VillagerUserMenuContent user={auth.user} />  {/* ← change this */}
                                    </DropdownMenuContent>
                            </DropdownMenu>
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