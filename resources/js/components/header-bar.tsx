import { Link, usePage } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import { useInitials } from '@/hooks/use-initials';
import { login, register } from '@/routes';
import type { SharedData } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu';
import { VillagerUserMenuContent } from './villager-user-menu-content';

export function HeaderBar() {
    const getInitials = useInitials();
    const { auth, categories = [], unreadNotifications } = usePage<SharedData>().props;

    return (
        <nav className="border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 sticky top-0 z-40">
            <div className="mx-auto flex max-w-7xl items-center justify-between">

                {/*  Logo  */}
                <div className="flex items-center">
                    <Link
                        href="/"
                        className="transition-transform duration-200 hover:scale-105 inline-block"
                    >
                        <img src="/logo_w_name.svg" alt="ApaKhabar" className="h-10 w-auto" />
                    </Link>
                </div>

                {/*  Nav links  */}
                <div className="hidden items-center space-x-6 text-sm font-medium text-gray-700 dark:text-gray-300 md:flex">
                    <Link
                        href="/"
                        className="relative hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200
                                   after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-0 after:bg-green-600
                                   after:transition-[width] after:duration-300 hover:after:w-full"
                    >
                        Beranda
                    </Link>
                    {(categories as string[]).map((category) => (
                        <Link
                            key={category}
                            href={`/news?category=${encodeURIComponent(category)}`}
                            className="relative hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200
                                       after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-0 after:bg-green-600
                                       after:transition-[width] after:duration-300 hover:after:w-full"
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
                                //  Dashboard button 
                                <Link
                                    href="/admin/dashboard"
                                    className="rounded-sm border border-gray-300 dark:border-neutral-700 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300
                                               hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors duration-200"
                                >
                                    Dashboard
                                </Link>
                            )}

                            {/*  Bell  */}
                            <Link href="/notifications">
                                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                                    <Bell
                                        className={`h-5 w-5 text-gray-600 dark:text-gray-300 transition-transform duration-200
                                                    hover:scale-110
                                                    ${unreadNotifications > 0 ? '[animation:bellWobble_1.2s_ease_2]' : ''}`}
                                    />
                                    {unreadNotifications > 0 && (
                                        // 5️⃣ Badge pulses to draw attention
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-neutral-900 animate-pulse">
                                            {unreadNotifications > 9 ? '9+' : unreadNotifications}
                                        </span>
                                    )}
                                </Button>
                            </Link>

                            {/*  Avatar  */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="size-10 rounded-full p-1 transition-all duration-200
                                                   hover:ring-2 hover:ring-green-400 hover:ring-offset-1"
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
                                <DropdownMenuContent
                                    className="w-56"
                                    align="end"
                                    //  Dropdown slides down from top
                                    style={{ animation: 'fadeSlideUp 0.2s ease both' }}
                                >
                                    <VillagerUserMenuContent user={auth.user} />
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Logout */}
                            <Link
                                href="/logout"
                                method="post"
                                as="button"
                                className="rounded-sm border border-gray-300 dark:border-neutral-700 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300
                                           hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors duration-200"
                            >
                                Keluar
                            </Link>
                        </>
                    ) : (
                        <>
                            {/* 9️⃣ Masuk — color transition */}
                            <Link
                                href={login()}
                                className="text-sm font-medium text-gray-700 dark:text-gray-300
                                           hover:text-black dark:hover:text-white transition-colors duration-200"
                            >
                                Masuk
                            </Link>

                            {/* 🔟 Daftar — scale press on click */}
                            <Link
                                href={register()}
                                className="rounded-sm bg-green-600 px-4 py-1.5 text-sm font-medium text-white
                                           hover:bg-green-700 active:scale-95 transition-all duration-150"
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