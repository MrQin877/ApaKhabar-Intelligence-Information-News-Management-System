import { Link, usePage } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { toUrl } from '@/lib/utils';
import type { NavItem } from '@/types';

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const { url } = usePage();
    const { state, isMobile } = useSidebar();
    const isCollapsed = state === 'collapsed' && !isMobile;
    const isCurrentPage = (href: NonNullable<NavItem['href']>) =>
        url.split(/[?#]/)[0].replace(/\/$/, '') ===
        toUrl(href).split(/[?#]/)[0].replace(/\/$/, '');

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) =>
                    item.items && item.items.length > 0 && isCollapsed ? (
                        <SidebarMenuItem key={item.title}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton
                                        aria-label={item.title}
                                        isActive={item.items.some((sub) =>
                                            url.startsWith(
                                                toUrl(sub.href ?? '#'),
                                            ),
                                        )}
                                    >
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    side="right"
                                    align="start"
                                    sideOffset={8}
                                    className="min-w-48"
                                >
                                    <DropdownMenuLabel>
                                        {item.title}
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {item.items.map((sub) => (
                                        <DropdownMenuItem
                                            key={sub.title}
                                            asChild
                                            className={
                                                isCurrentPage(sub.href ?? '#')
                                                    ? 'bg-accent text-accent-foreground'
                                                    : undefined
                                            }
                                        >
                                            <Link
                                                href={sub.href ?? '#'}
                                                prefetch
                                                aria-current={
                                                    isCurrentPage(
                                                        sub.href ?? '#',
                                                    )
                                                        ? 'page'
                                                        : undefined
                                                }
                                            >
                                                {sub.icon && <sub.icon />}
                                                <span>{sub.title}</span>
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    ) : item.items && item.items.length > 0 ? (
                        <Collapsible
                            key={item.title}
                            asChild
                            defaultOpen={item.items.some((sub) =>
                                url.startsWith(toUrl(sub.href ?? '#')),
                            )}
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton
                                        tooltip={{ children: item.title }}
                                        isActive={item.items.some((sub) =>
                                            url.startsWith(
                                                toUrl(sub.href ?? '#'),
                                            ),
                                        )}
                                    >
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                        <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {item.items.map((sub) => (
                                            <SidebarMenuSubItem key={sub.title}>
                                                <SidebarMenuSubButton
                                                    asChild
                                                    isActive={isCurrentPage(
                                                        sub.href ?? '#',
                                                    )}
                                                >
                                                    <Link
                                                        href={sub.href ?? '#'}
                                                        prefetch
                                                    >
                                                        {sub.icon && (
                                                            <sub.icon />
                                                        )}
                                                        <span>{sub.title}</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    ) : (
                        // ── No sub items → regular item ──
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={isCurrentPage(item.href ?? '#')}
                                tooltip={{ children: item.title }}
                            >
                                <Link
                                    href={item.href ?? '#'}
                                    prefetch
                                    className="relative"
                                >
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                    {item.attention && (
                                        <span
                                            role="status"
                                            aria-label="Komentar menunggu peninjauan"
                                            className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive"
                                        />
                                    )}
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ),
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}
