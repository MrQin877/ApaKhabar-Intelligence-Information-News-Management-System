import { Link } from '@inertiajs/react';
import { LayoutGrid, Newspaper, Radio, ChartNoAxesCombined, Bell, Archive } from 'lucide-react';
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
import type { NavItem } from '@/types';
import creatorRoutes from '@/routes/admin/creator';

const mainNavItems: NavItem[] = [
    {
        title: 'Dasbor',
        href: dashboard(),
        icon: LayoutGrid,
    },
    
    {
        title: 'Pembuat Berita',
        href: creatorRoutes.create(),
        icon: Newspaper,
    },

    {
        title: 'Pesan',
        icon: Radio,
        items: [
            {
                title: 'Semua Pesan',
                icon: Radio,
                href: adminRoutes.broadcasting.index(),
            },
            {
                title: 'Arsip',
                icon: Archive,
                href: adminRoutes.broadcasting.archived(),  // ← use route helper
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
        title: 'Notifikasi',
        href: notifications.index(),
        icon: Bell,
    },
];

export function AppSidebar() {
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
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
