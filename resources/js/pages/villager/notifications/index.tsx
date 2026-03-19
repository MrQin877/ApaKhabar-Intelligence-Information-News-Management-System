import { Head } from '@inertiajs/react'
import { useState } from 'react'
import {
    Bell, Siren, Megaphone, CheckCheck,
    Check, Clock, Filter, BellOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import AppLayout from '@/layouts/app-layout'
import type { BreadcrumbItem } from '@/types'

// ── Types ─────────────────────────────────────────────────
type NotifType = 'darurat' | 'pengumuman'
type FilterTab = 'semua' | 'darurat' | 'pengumuman' | 'belum-dibaca'

export type Notification = {
    id: string
    type: NotifType
    title: string
    message: string
    sent_at: string        // e.g. "2 jam lalu"
    sent_at_full: string   // e.g. "19 Mac 2026, 10:30 PG"
    channel: string        // e.g. "Aplikasi", "WhatsApp"
    is_read: boolean
}

// ── Dummy data ─────────────────────────────────────────────
const initialNotifications: Notification[] = [
    {
        id: '1',
        type: 'darurat',
        title: 'Peringatan Cuaca Ekstrem',
        message: 'Badai dahsyat diperkirakan akan mempengaruhi daerah pesisir dalam 24 jam ke depan. Pengguna diimbau untuk tetap waspada dan mengikuti pembaruan cuaca terkini dari pihak berwenang.',
        sent_at: '10 minit lalu',
        sent_at_full: '19 Mac 2026, 10:20 PG',
        channel: 'Aplikasi',
        is_read: false,
    },
    {
        id: '2',
        type: 'pengumuman',
        title: 'Penutupan Jalan Desa Punggul',
        message: 'Jalan utama Desa Punggul akan ditutup sementara pada 22 Mac 2026 dari pukul 08:00 hingga 17:00 untuk kerja-kerja penyelenggaraan paip air. Penduduk diminta menggunakan laluan alternatif.',
        sent_at: '2 jam lalu',
        sent_at_full: '19 Mac 2026, 08:30 PG',
        channel: 'WhatsApp',
        is_read: false,
    },
    {
        id: '3',
        type: 'pengumuman',
        title: 'Gotong-Royong Perdana 2026',
        message: 'Majlis Desa Punggul menjemput seluruh penduduk untuk menyertai program gotong-royong yang akan diadakan pada 25 Mac 2026. Kehadiran anda amat diharapkan demi menjaga kebersihan kawasan kita.',
        sent_at: '5 jam lalu',
        sent_at_full: '19 Mac 2026, 05:15 PG',
        channel: 'SMS',
        is_read: true,
    },
    {
        id: '4',
        type: 'darurat',
        title: 'Gangguan Bekalan Air',
        message: 'Bekalan air bersih di kawasan Blok A dan B akan terganggu pada 20 Mac 2026 dari pukul 09:00 hingga 15:00 akibat kerja-kerja pembaikan mendesak. Sila simpan bekalan secukupnya.',
        sent_at: '1 hari lalu',
        sent_at_full: '18 Mac 2026, 11:00 PG',
        channel: 'Aplikasi',
        is_read: true,
    },
    {
        id: '5',
        type: 'pengumuman',
        title: 'Mesyuarat Penduduk Bulan Mac',
        message: 'Mesyuarat penduduk bulanan akan diadakan pada 21 Mac 2026, jam 8:00 malam di Dewan Serbaguna Desa Punggul. Agenda utama termasuk perbincangan mengenai projek pembangunan infrastruktur terbaru.',
        sent_at: '2 hari lalu',
        sent_at_full: '17 Mac 2026, 03:00 PTG',
        channel: 'Aplikasi',
        is_read: true,
    },
    {
        id: '6',
        type: 'pengumuman',
        title: 'Rilis Fitur Baru: Portal Warga',
        message: 'Portal Warga Desa Punggul kini telah dinaik taraf dengan pelbagai ciri baharu termasuk permohonan online, semakan status aduan, dan papan pemuka maklumat komuniti. Cuba sekarang!',
        sent_at: '3 hari lalu',
        sent_at_full: '16 Mac 2026, 09:00 PG',
        channel: 'Aplikasi',
        is_read: true,
    },
]

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Notifikasi', href: '/notifications' },
]

// ── Notification Item ──────────────────────────────────────
function NotificationItem({
    notif,
    onMarkRead,
}: {
    notif: Notification
    onMarkRead: (id: string) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const isLong = notif.message.length > 120

    return (
        <div
            className={cn(
                "group relative flex gap-4 px-5 py-4 transition-colors duration-150 cursor-pointer",
                !notif.is_read
                    ? "bg-white dark:bg-neutral-900"
                    : "bg-neutral-50/60 dark:bg-neutral-900/40",
                "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            )}
            onClick={() => {
                if (!notif.is_read) onMarkRead(notif.id)
                if (isLong) setExpanded(e => !e)
            }}
        >
            {/* Unread dot */}
            {!notif.is_read && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-green-500" />
            )}

            {/* Type icon */}
            <div className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                notif.type === 'darurat'
                    ? "bg-red-100 dark:bg-red-900/30"
                    : "bg-green-100 dark:bg-green-900/30"
            )}>
                {notif.type === 'darurat'
                    ? <Siren className="h-4 w-4 text-red-500" />
                    : <Megaphone className="h-4 w-4 text-green-600" />
                }
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn(
                            "text-sm leading-snug",
                            !notif.is_read
                                ? "font-semibold text-neutral-900 dark:text-neutral-100"
                                : "font-medium text-neutral-700 dark:text-neutral-300"
                        )}>
                            {notif.title}
                        </p>
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-[10px] px-1.5 py-0 h-4 font-medium",
                                notif.type === 'darurat'
                                    ? "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                                    : "border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                            )}
                        >
                            {notif.type === 'darurat' ? 'Darurat' : 'Pengumuman'}
                        </Badge>
                    </div>

                    {/* Mark read button */}
                    {!notif.is_read && (
                        <button
                            onClick={e => { e.stopPropagation(); onMarkRead(notif.id) }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Tandai sebagai dibaca"
                        >
                            <Check className="h-4 w-4 text-neutral-400 hover:text-green-500 transition-colors" />
                        </button>
                    )}
                </div>

                <p className={cn(
                    "text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed",
                    !expanded && isLong && "line-clamp-2"
                )}>
                    {notif.message}
                </p>

                {isLong && (
                    <button className="text-xs text-green-600 dark:text-green-400 hover:underline mt-0.5">
                        {expanded ? 'Sembunyikan' : 'Baca selengkapnya'}
                    </button>
                )}

                <div className="flex items-center gap-2 pt-0.5">
                    <Clock className="h-3 w-3 text-neutral-300 dark:text-neutral-600" />
                    <span className="text-xs text-neutral-400" title={notif.sent_at_full}>
                        {notif.sent_at}
                    </span>
                    <span className="text-neutral-200 dark:text-neutral-700">·</span>
                    <span className="text-xs text-neutral-400">
                        via {notif.channel}
                    </span>
                    {notif.is_read && (
                        <>
                            <span className="text-neutral-200 dark:text-neutral-700">·</span>
                            <span className="flex items-center gap-1 text-xs text-neutral-300 dark:text-neutral-600">
                                <CheckCheck className="h-3 w-3" /> Dibaca
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Main Page ──────────────────────────────────────────────
export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
    const [activeFilter, setActiveFilter] = useState<FilterTab>('semua')

    const unreadCount = notifications.filter(n => !n.is_read).length

    function markRead(id: string) {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        )
    }

    function markAllRead() {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }

    const filtered = notifications.filter(n => {
        if (activeFilter === 'darurat')      return n.type === 'darurat'
        if (activeFilter === 'pengumuman')   return n.type === 'pengumuman'
        if (activeFilter === 'belum-dibaca') return !n.is_read
        return true
    })

    const tabs: { key: FilterTab; label: string; count?: number }[] = [
        { key: 'semua',        label: 'Semua',        count: notifications.length },
        { key: 'belum-dibaca', label: 'Belum Dibaca',  count: unreadCount || undefined },
        { key: 'darurat',      label: 'Darurat',       count: notifications.filter(n => n.type === 'darurat').length },
        { key: 'pengumuman',   label: 'Pengumuman',    count: notifications.filter(n => n.type === 'pengumuman').length },
    ]

    return (
        <>
            <Head title="Notifikasi" />
            <div className="flex flex-1 flex-col p-4 max-w-2xl mx-auto w-full gap-4">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                            <Bell className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">
                                    {unreadCount}
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
                                    : 'Semua notifikasi telah dibaca'}
                            </p>
                        </div>
                    </div>

                    {unreadCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={markAllRead}
                            className="gap-1.5 text-sm h-8"
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Tandai Semua Dibaca
                        </Button>
                    )}
                </div>

                {/* ── Filter Tabs ── */}
                <div className="flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveFilter(tab.key)}
                            className={cn(
                                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                                activeFilter === tab.key
                                    ? "bg-green-600 text-white shadow-sm"
                                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            )}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={cn(
                                    "rounded-full px-1.5 py-0 text-[10px] font-semibold leading-4",
                                    activeFilter === tab.key
                                        ? "bg-white/20 text-white"
                                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                                )}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Feed ── */}
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-neutral-400">
                            <BellOff className="h-8 w-8 opacity-40" />
                            <p className="text-sm">Tiada notifikasi ditemukan.</p>
                        </div>
                    ) : (
                        filtered.map((notif, i) => (
                            <div key={notif.id}>
                                <NotificationItem notif={notif} onMarkRead={markRead} />
                                {i < filtered.length - 1 && (
                                    <Separator className="dark:bg-neutral-800" />
                                )}
                            </div>
                        ))
                    )}
                </div>

            </div>
        </>
    )
}

NotificationsPage.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
)