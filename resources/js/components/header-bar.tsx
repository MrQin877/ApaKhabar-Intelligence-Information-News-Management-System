import { Link, usePage } from '@inertiajs/react';
import {
    Bell,
    LayoutDashboard,
    LogIn,
    LogOut,
    Menu,
    Palette,
    Shield,
    UserPlus,
    UserCircle,
} from 'lucide-react';
import ProfileCompletionBanner from '@/components/profile-completion-banner';
import { WebsiteLanguage } from '@/components/website-language';
import { useInitials } from '@/hooks/use-initials';
import { login, register } from '@/routes';
import adminRoutes from '@/routes/admin';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editProfile } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import type { SharedData } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from './ui/sheet';
import { VillagerUserMenuContent } from './villager-user-menu-content';

export function HeaderBar() {
    const getInitials = useInitials();
    const {
        auth,
        categories = [],
        unreadNotifications,
    } = usePage<SharedData>().props;
    const canAccessAdmin =
        auth.user?.role === 'admin' || auth.user?.role === 'moderator';

    return (
        <>
            <ProfileCompletionBanner />
            <nav className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    {/*  Logo  */}
                    <div className="flex items-center">
                        <Link
                            href="/"
                            className="inline-block transition-transform duration-200 hover:scale-105"
                        >
                            <img
                                src="/logo_w_name.svg"
                                alt="ApaKhabar"
                                className="h-10 w-auto"
                            />
                        </Link>
                    </div>

                    {/*  Nav links  */}
                    <div className="hidden items-center space-x-6 text-sm font-medium text-foreground lg:flex">
                        <Link
                            href="/"
                            className="relative text-foreground transition-colors duration-200 after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-0 after:bg-green-600 after:transition-[width] after:duration-300 hover:text-primary hover:after:w-full"
                        >
                            Beranda
                        </Link>
                        {(categories as string[]).map((category) => (
                            <Link
                                key={category}
                                href={`/news?category=${encodeURIComponent(category)}`}
                                className="relative text-foreground transition-colors duration-200 after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-0 after:bg-green-600 after:transition-[width] after:duration-300 hover:text-primary hover:after:w-full"
                            >
                                {category}
                            </Link>
                        ))}
                    </div>

                    {/* Auth Buttons */}
                    <div className="hidden items-center space-x-2 lg:flex">
                        <WebsiteLanguage />
                        {auth.user ? (
                            <>
                                {canAccessAdmin && (
                                    <Link href={adminRoutes.dashboard()}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="relative h-9 w-9"
                                        >
                                            <LayoutDashboard data-icon="inline-start" />
                                        </Button>
                                    </Link>
                                )}

                                {/*  Bell  */}
                                <Link href="/notifications">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="relative h-9 w-9"
                                    >
                                        <Bell
                                            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 hover:scale-110 ${unreadNotifications > 0 ? '[animation:bellWobble_1.2s_ease_2]' : ''}`}
                                        />
                                        {unreadNotifications > 0 && (
                                            // 5️⃣ Badge pulses to draw attention
                                            <span className="absolute -top-1 -right-1 flex h-4 w-4 animate-pulse items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white ring-2 ring-background">
                                                {unreadNotifications > 9
                                                    ? '9+'
                                                    : unreadNotifications}
                                            </span>
                                        )}
                                    </Button>
                                </Link>

                                {/*  Avatar  */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="size-10 rounded-full p-1 transition-all duration-200 hover:ring-2 hover:ring-green-400 hover:ring-offset-1"
                                        >
                                            <Avatar className="size-8 overflow-hidden rounded-full">
                                                <AvatarImage
                                                    src={auth.user.avatar}
                                                    alt={auth.user.name}
                                                />
                                                <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                                    {getInitials(
                                                        auth.user.name,
                                                    )}
                                                </AvatarFallback>
                                            </Avatar>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        className="w-56"
                                        align="end"
                                        //  Dropdown slides down from top
                                        style={{
                                            animation:
                                                'fadeSlideUp 0.2s ease both',
                                        }}
                                    >
                                        <VillagerUserMenuContent
                                            user={auth.user}
                                        />
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Logout */}
                                <Link
                                    href="/logout"
                                    method="post"
                                    as="button"
                                    className="rounded-sm border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-100 dark:border-neutral-700 dark:text-gray-300 dark:hover:bg-neutral-800"
                                >
                                    Keluar
                                </Link>
                            </>
                        ) : (
                            <>
                                {/* 9️⃣ Masuk — color transition */}
                                <Link
                                    href={login()}
                                    className="text-sm font-medium text-gray-700 transition-colors duration-200 hover:text-black dark:text-gray-300 dark:hover:text-white"
                                >
                                    Masuk
                                </Link>

                                {/* 🔟 Daftar — scale press on click */}
                                <Link
                                    href={register()}
                                    className="rounded-sm bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition-all duration-150 hover:bg-green-700 active:scale-95"
                                >
                                    Daftar
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="mr-3 ml-auto lg:hidden">
                        <WebsiteLanguage />
                    </div>
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="lg:hidden"
                                aria-label="Buka menu navigasi"
                            >
                                <Menu className="size-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent
                            side="right"
                            className="w-[min(22rem,calc(100vw-2rem))]"
                        >
                            <SheetHeader className="border-b border-border px-6 py-5">
                                <SheetTitle className="text-left">
                                    Menu ApaKhabar
                                </SheetTitle>
                            </SheetHeader>

                            <div className="flex flex-1 flex-col overflow-y-auto px-4 py-2">
                                <div className="flex flex-col gap-1">
                                    <SheetClose asChild>
                                        <Link
                                            href="/"
                                            className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                                        >
                                            Beranda
                                        </Link>
                                    </SheetClose>
                                    {(categories as string[]).map(
                                        (category) => (
                                            <SheetClose asChild key={category}>
                                                <Link
                                                    href={`/news?category=${encodeURIComponent(category)}`}
                                                    className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                                                >
                                                    {category}
                                                </Link>
                                            </SheetClose>
                                        ),
                                    )}
                                </div>

                                <div className="my-4 border-t border-border" />

                                {auth.user ? (
                                    <div className="flex flex-col gap-1">
                                        {canAccessAdmin && (
                                            <SheetClose asChild>
                                                <Link
                                                    href={adminRoutes.dashboard()}
                                                    className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                                                >
                                                    <LayoutDashboard className="size-4" />
                                                    Dasbor
                                                </Link>
                                            </SheetClose>
                                        )}
                                        <SheetClose asChild>
                                            <Link
                                                href="/notifications"
                                                className="flex min-h-11 items-center justify-between rounded-md px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                                            >
                                                <span className="flex items-center gap-3">
                                                    <Bell className="size-4" />
                                                    Notifikasi
                                                </span>
                                                {unreadNotifications > 0 && (
                                                    <span className="rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                                                        {unreadNotifications > 9
                                                            ? '9+'
                                                            : unreadNotifications}
                                                    </span>
                                                )}
                                            </Link>
                                        </SheetClose>
                                        <SheetClose asChild>
                                            <Link
                                                href={editProfile()}
                                                className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                                            >
                                                <UserCircle className="mr-2 h-4 w-4" />
                                                Profil
                                            </Link>
                                        </SheetClose>
                                        <SheetClose asChild>
                                            <Link
                                                href={editSecurity()}
                                                className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                                            >
                                                <Shield className="mr-2 h-4 w-4" />
                                                Keselamatan
                                            </Link>
                                        </SheetClose>
                                        <SheetClose asChild>
                                            <Link
                                                href={editAppearance()}
                                                className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                                            >
                                                <Palette className="mr-2 h-4 w-4" />
                                                Penampilan
                                            </Link>
                                        </SheetClose>
                                        <SheetClose asChild>
                                            <Link
                                                href="/logout"
                                                method="post"
                                                as="button"
                                                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                                            >
                                                <LogOut className="size-4" />
                                                Keluar
                                            </Link>
                                        </SheetClose>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        <SheetClose asChild>
                                            <Link
                                                href={login()}
                                                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                                            >
                                                <LogIn className="size-4" />
                                                Masuk
                                            </Link>
                                        </SheetClose>
                                        <SheetClose asChild>
                                            <Link
                                                href={register()}
                                                className="flex min-h-11 items-center gap-3 rounded-md bg-green-600 px-3 text-sm font-medium text-white hover:bg-green-700"
                                            >
                                                <UserPlus className="size-4" />
                                                Daftar
                                            </Link>
                                        </SheetClose>
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </nav>
        </>
    );
}
