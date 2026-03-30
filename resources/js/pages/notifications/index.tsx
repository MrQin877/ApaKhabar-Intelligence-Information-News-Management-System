import { Head, router, usePage } from '@inertiajs/react'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HeaderBar } from '@/components/header-bar'  // your villager header
import { NotificationCard } from '@/components/notifications/notification-card'
import { NotificationSkeleton } from '@/components/notifications/notification-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AppLayout from '@/layouts/app-layout'
import { cn } from '@/lib/utils'
import type { BreadcrumbItem } from '@/types'
import type { Notification, FilterTab } from '@/types/notification'
 
type Props = {
    notifications: Notification[]
}
 
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Notifikasi', href: '/notifications' },
]
 
export default function NotificationsPage({ notifications: initial}: Props) {
    const { auth } = usePage().props as any
    const isAdmin = auth?.user?.role === 'admin' || auth?.user?.role === 'moderator'
    const [notifications, setNotifications] = useState<Notification[]>(initial)
    const [activeFilter, setActiveFilter] = useState<FilterTab>('semua')
    const [isLoading, setIsLoading] = useState(false)  // ← remove const, make stateful

    // ← Wire to Inertia navigation events
    useEffect(() => {
        const startLoading = router.on('start',  () => setIsLoading(true))
        const stopLoading  = router.on('finish', () => setIsLoading(false))

        return () => {
            startLoading()
            stopLoading()
        }
    }, [])
 
    const unreadCount = notifications.filter(n => !n.is_read).length
 
    // ── Mark single as read — saves to backend ─────────────
    function handleMarkRead(id: string) {
        // Optimistic update — instantly show as read in UI
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        )
        // Save to database
        router.patch(`/notifications/${id}/read`, {}, {
            preserveScroll: true,
        })
    }
 
    // ── Mark all as read — saves to backend ────────────────
    function handleMarkAllRead() {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        // Save to database
        router.patch('/notifications/read-all', {}, {
            preserveScroll: true,
        })
    }
 
    // ── Filter notifications ────────────────────────────────
    const filtered = notifications.filter(n => {
        if (activeFilter === 'darurat')      {
return n.type === 'darurat'
}

        if (activeFilter === 'pengumuman')   {
return n.type === 'pengumuman'
}

        if (activeFilter === 'belum-dibaca') {
return !n.is_read
}

        return true
    })
 
    const tabCounts: Record<FilterTab, number> = {
        'semua':        notifications.length,
        'belum-dibaca': unreadCount,
        'darurat':      notifications.filter(n => n.type === 'darurat').length,
        'pengumuman':   notifications.filter(n => n.type === 'pengumuman').length,
    }
 
    const tabs: { key: FilterTab; label: string }[] = [
        { key: 'semua',        label: 'Semua'      },
        { key: 'belum-dibaca', label: 'Belum Baca' },
        { key: 'darurat',      label: 'Darurat'    },
        { key: 'pengumuman',   label: 'Pengumuman' },
    ]
 
    return (
        <>
            <Head title="Notifikasi" />
 
            <div className={cn(
                "flex flex-1 flex-col gap-4 p-4",
                // Villager: centered narrow layout
                // Admin: full width
                !isAdmin && "max-w-2xl mx-auto w-full",
                isAdmin  && "w-full"
            )}>
 
                {/* ── Page Header ── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                            <Bell className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-neutral-900">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                                Notifikasi
                            </h1>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                {unreadCount > 0
                                    ? `${unreadCount} notifikasi belum dibaca`
                                    : 'Semua notifikasi telah dibaca'
                                }
                            </p>
                        </div>
                    </div>
 
                    {unreadCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleMarkAllRead}
                            className="gap-1.5 text-sm h-8"
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Tandai Semua Dibaca
                        </Button>
                    )}
                </div>
 
                {/* ── Filter Tabs ── */}
                <Tabs
                    value={activeFilter}
                    onValueChange={v => setActiveFilter(v as FilterTab)}
                >
                    <TabsList className="w-full h-9 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-1">
                        {tabs.map(tab => (
                            <TabsTrigger
                                key={tab.key}
                                value={tab.key}
                                className={cn(
                                    "flex-1 h-7 text-xs gap-1.5 transition-all",
                                    "data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                                )}
                            >
                                {tab.label}
                                {tabCounts[tab.key] > 0 && (
                                    <Badge
                                        variant="secondary"
                                        className={cn(
                                            "h-4 px-1.5 text-[10px] font-bold leading-none",
                                            activeFilter === tab.key
                                                ? "bg-white/20 text-white"
                                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                                        )}
                                    >
                                        {tabCounts[tab.key]}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
 
                {/* ── Notification Cards ── */}
                {isLoading ? (
                    <NotificationSkeleton count={4} />
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-neutral-400">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                            <BellOff className="h-6 w-6 opacity-50" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                                Tiada notifikasi
                            </p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                                {activeFilter === 'belum-dibaca'
                                    ? 'Semua notifikasi telah dibaca'
                                    : 'Belum ada notifikasi masuk'
                                }
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className={cn(
                        "gap-3",
                        isAdmin
                            ? "grid grid-cols-1 xl:grid-cols-2"
                            : "flex flex-col"
                    )}>
                        {filtered.map(notif => (
                            <NotificationCard
                                key={notif.id}
                                notif={notif}
                                onMarkRead={handleMarkRead}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}
 
NotificationsPage.layout = (page: React.ReactElement) => {
    const role = (page.props as { role?: string }).role ?? 'villager'
    const isAdmin = role === 'admin' || role === 'moderator'

    if (isAdmin) {
        return <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
            <HeaderBar />
            <main className="py-6">
                {page}
            </main>
        </div>
    )
}