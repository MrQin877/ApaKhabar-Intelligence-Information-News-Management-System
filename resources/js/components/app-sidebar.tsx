import { Link, usePage } from '@inertiajs/react';
import {
    LayoutGrid,
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

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;
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
        ...(auth.user?.role === 'admin'
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
        ...mainNavItems.slice(1),
    ];

    return (
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
    );
}
