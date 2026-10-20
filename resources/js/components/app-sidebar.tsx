import { Link, usePage, usePoll } from '@inertiajs/react';
import {
    LayoutGrid,
    MessageSquare,
    Newspaper,
    Radio,
    ChartNoAxesCombined,
    Bell,
    Archive,
    Bot,
    ExternalLink,
    FolderArchive,
    Tags,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import adminRoutes from '@/routes/admin';
import notifications from '@/routes/notifications';
import type { NavItem, SharedData } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dasbor',
        href: dashboard(),
        icon: LayoutGrid,
    },

    {
        title: 'Pesan',
        icon: Radio,
        items: [
            {
                title: 'Daftar Pesan',
                icon: Radio,
                href: adminRoutes.broadcasting.index(),
            },
            {
                title: 'Arsip',
                icon: Archive,
                href: adminRoutes.broadcasting.archived(), // ← use route helper
            },
        ],
    },

    {
        title: 'Analisis',
        href: dashboard(),
        icon: ChartNoAxesCombined,
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Lihat Website',
        href: '/',
        icon: ExternalLink,
    },

    {
        title: 'Notifikasi',
        href: notifications.index(),
        icon: Bell,
    },
];

function ModerationCountPolling() {
    usePoll(15000, { only: ['moderationPendingCount'] });

    return null;
}

export function AppSidebar() {
    const { auth, moderationPendingCount = 0 } = usePage<SharedData>().props;
    const newsItems: NavItem[] = [
        {
            title: 'Daftar Berita',
            href: '/admin/news',
            icon: Newspaper,
        },
        {
            title: 'Tulis Manual',
            href: '/admin/news/manual/create',
            icon: Newspaper,
        },
        ...(['admin', 'moderator'].includes(auth.user?.role ?? '')
            ? [
                  {
                      title: 'Kategori Berita',
                      href: '/admin/categories',
                      icon: Tags,
                  },
              ]
            : []),
    ];
    const visibleMainNavItems: NavItem[] = [
        mainNavItems[0],
        {
            title: 'Asisten AI',
            href: '/admin/ai-assistant',
            icon: Bot,
        },
        {
            title: 'Dokumen',
            href: '/admin/documents',
            icon: FolderArchive,
        },
        {
            title: 'Berita',
            icon: Newspaper,
            items: newsItems,
        },
        {
            title: 'Moderasi Komentar',
            href: '/admin/comments',
            attention: moderationPendingCount > 0,
            icon: MessageSquare,
        },
        ...mainNavItems.slice(1),
    ];

    return (
        <>
            {['admin', 'moderator'].includes(auth.user?.role ?? '') && (
                <ModerationCountPolling />
            )}
            <Sidebar collapsible="icon" variant="inset">
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" asChild>
                                <Link href={dashboard()} prefetch>
                                    <AppLogo />
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>

                <SidebarContent>
                    <NavMain items={visibleMainNavItems} />
                </SidebarContent>

                <SidebarFooter>
                    <NavFooter items={footerNavItems} className="mt-auto" />
                    <NavUser />
                </SidebarFooter>
            </Sidebar>
        </>
    );
}
