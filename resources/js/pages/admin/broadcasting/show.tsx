import { Head, router } from '@inertiajs/react'
import {
    ArrowLeft, Megaphone, Siren, Send, Archive,
    Clock, Users, User, MessageSquare, Smartphone,
    Radio, CalendarDays, CheckCheck, BarChart2,
    MailOpen, AlertTriangle,
} from 'lucide-react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import AppLayout from '@/layouts/app-layout'
import { cn } from '@/lib/utils'
import type { BreadcrumbItem } from '@/types'
 
// ── Types ──────────────────────────────────────────────────
export type BroadcastDetail = {
    id: number
    title: string
    message: string
    category: 'pengumuman' | 'darurat'
    channels: string[]
    audience: 'semua' | 'karyawan'
    status: 'dikirim' | 'terjadwal' | 'tertunda'
    send_mode: 'now' | 'scheduled'
    scheduled_at: string | null
    sent_at: string | null
    archived_at: string | null
    created_at: string
    creator: { id: string | null; name: string }
    stats: {
        total_sent: number
        total_read: number
        read_rate: number
    }
}
 
type Props = {
    broadcast: BroadcastDetail
}
 
// ── Helpers ────────────────────────────────────────────────
const statusMap = {
    dikirim:   { label: 'Dikirim',   className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200', dot: 'bg-green-500' },
    terjadwal: { label: 'Terjadwal', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200', dot: 'bg-yellow-500' },
    tertunda:  { label: 'Tertunda',  className: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-red-200', dot: 'bg-red-400' },
}
 
const channelMap: Record<string, { icon: React.ReactNode; label: string }> = {
    whatsapp: { icon: <MessageSquare className="h-4 w-4" />, label: 'WhatsApp' },
    sms:      { icon: <Smartphone className="h-4 w-4" />,    label: 'SMS'      },
    aplikasi: { icon: <Radio className="h-4 w-4" />,          label: 'Aplikasi' },
}
 
// ── Main Page ──────────────────────────────────────────────
export default function BroadcastShowPage({ broadcast }: Props) {

 
    const status = statusMap[broadcast.status]
    const isDarurat = broadcast.category === 'darurat'
    const canResend = broadcast.status === 'dikirim'
    const canEdit   = broadcast.status === 'tertunda' || broadcast.status === 'terjadwal'
    const isArchived = !!broadcast.archived_at
 
    function handleResend() {
        router.post(`/admin/broadcasting/${broadcast.id}/resend`, {}, {
            preserveScroll: true,
        })
    }
 
    function handleArchive() {
        router.post(`/admin/broadcasting/${broadcast.id}/archive`, {}, {
            onSuccess: () => router.visit('/admin/broadcasting'),
        })
    }
 
    function handleRestore() {
        router.post(`/admin/broadcasting/${broadcast.id}/restore`, {}, {
            preserveScroll: true,
        })
    }
 
    return (
        <>
            <Head title={broadcast.title} />
            <div className="flex flex-1 flex-col gap-4 p-4 max-w-3xl mx-auto w-full">
 
                {/* ── Top bar ── */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.visit('/admin/broadcasting')}
                        className="gap-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 -ml-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Kembali ke Daftar
                    </Button>
 
                    <div className="flex items-center gap-2">
                        {canResend && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleResend}
                                className="gap-1.5 text-sm"
                            >
                                <Send className="h-3.5 w-3.5" />
                                Kirim Ulang
                            </Button>
                        )}
 
                        {canEdit && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.visit(`/admin/broadcasting/${broadcast.id}/edit`)}
                                className="gap-1.5 text-sm"
                            >
                                Edit
                            </Button>
                        )}
 
                        {!isArchived ? (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="gap-1.5 text-sm text-neutral-600">
                                        <Archive className="h-3.5 w-3.5" />
                                        Arsipkan
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Arsipkan siaran ini?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Siaran yang diarsipkan tidak akan ditampilkan dalam senarai utama,
                                            tetapi masih boleh dipulihkan dari halaman Arsip.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleArchive}
                                            className="bg-neutral-700 hover:bg-neutral-800 text-white"
                                        >
                                            <Archive className="h-3.5 w-3.5 mr-1.5" />
                                            Ya, Arsipkan
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleRestore}
                                className="gap-1.5 text-sm text-green-600"
                            >
                                Pulihkan
                            </Button>
                        )}
                    </div>
                </div>
 
                {/* ── Main card ── */}
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
 
                    {/* Header band */}
                    <div className={cn(
                        "px-6 py-5 border-b border-neutral-100 dark:border-neutral-800",
                        isDarurat ? "bg-red-50/50 dark:bg-red-950/20" : "bg-green-50/50 dark:bg-green-950/20"
                    )}>
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                                isDarurat
                                    ? "bg-red-100 dark:bg-red-900/40"
                                    : "bg-green-100 dark:bg-green-900/40"
                            )}>
                                {isDarurat
                                    ? <Siren className="h-5 w-5 text-red-500" />
                                    : <Megaphone className="h-5 w-5 text-green-600" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
                                        {broadcast.title}
                                    </h1>
                                    {isDarurat && (
                                        <Badge variant="destructive" className="gap-1 text-xs shrink-0">
                                            <AlertTriangle className="h-3 w-3" /> Darurat
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                                        status.className
                                    )}>
                                        <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                                        {status.label}
                                    </span>
                                    <span className="text-xs text-neutral-400">
                                        Dibuat oleh {broadcast.creator.name}
                                    </span>
                                    <span className="text-xs text-neutral-400">
                                        {broadcast.created_at}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
 
                    {/* Message body */}
                    <div className="px-6 py-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                            Isi Pesan
                        </p>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                            {broadcast.message}
                        </p>
                    </div>
 
                    <Separator className="dark:bg-neutral-800" />
 
                    {/* Meta grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-neutral-100 dark:divide-neutral-800">
 
                        {/* Audience */}
                        <div className="px-6 py-4 space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Penerima</p>
                            <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                                {broadcast.audience === 'semua'
                                    ? <><Users className="h-4 w-4 text-neutral-400" /> Semua Pengguna</>
                                    : <><User className="h-4 w-4 text-neutral-400" /> Karyawan</>
                                }
                            </div>
                        </div>
 
                        {/* Channels */}
                        <div className="px-6 py-4 space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Saluran</p>
                            <div className="flex items-center gap-2 flex-wrap">
                                {broadcast.channels.map(ch => (
                                    <span key={ch} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400">
                                        {channelMap[ch]?.icon}
                                        {channelMap[ch]?.label ?? ch}
                                    </span>
                                ))}
                            </div>
                        </div>
 
                        {/* Sent time */}
                        <div className="px-6 py-4 space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                                {broadcast.send_mode === 'scheduled' ? 'Dijadwalkan' : 'Waktu Terkirim'}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                                {broadcast.send_mode === 'scheduled'
                                    ? <><CalendarDays className="h-4 w-4 text-neutral-400" /> {broadcast.scheduled_at ?? '—'}</>
                                    : <><Clock className="h-4 w-4 text-neutral-400" /> {broadcast.sent_at ?? '—'}</>
                                }
                            </div>
                        </div>
 
                        {/* Category */}
                        <div className="px-6 py-4 space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Kategori</p>
                            <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                                {isDarurat
                                    ? <><Siren className="h-4 w-4 text-red-400" /> Darurat</>
                                    : <><Megaphone className="h-4 w-4 text-green-500" /> Pengumuman</>
                                }
                            </div>
                        </div>
                    </div>
 
                    <Separator className="dark:bg-neutral-800" />
 
                    {/* Stats */}
                    <div className="px-6 py-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-4">
                            Statistik Pengiriman
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 p-4 text-center">
                                <div className="flex justify-center mb-2">
                                    <Send className="h-5 w-5 text-neutral-400" />
                                </div>
                                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                    {broadcast.stats.total_sent}
                                </p>
                                <p className="text-xs text-neutral-400 mt-0.5">Total Terkirim</p>
                            </div>
                            <div className="rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 p-4 text-center">
                                <div className="flex justify-center mb-2">
                                    <MailOpen className="h-5 w-5 text-neutral-400" />
                                </div>
                                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                    {broadcast.stats.total_read}
                                </p>
                                <p className="text-xs text-neutral-400 mt-0.5">Telah Dibaca</p>
                            </div>
                            <div className="rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 p-4 text-center">
                                <div className="flex justify-center mb-2">
                                    <BarChart2 className="h-5 w-5 text-neutral-400" />
                                </div>
                                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                    {broadcast.stats.read_rate}%
                                </p>
                                <p className="text-xs text-neutral-400 mt-0.5">Rate Diakses</p>
                            </div>
                        </div>
 
                        {/* Read rate bar */}
                        {broadcast.stats.total_sent > 0 && (
                            <div className="mt-4">
                                <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
                                    <span className="flex items-center gap-1">
                                        <CheckCheck className="h-3 w-3" /> Rate diakses keseluruhan
                                    </span>
                                    <span>{broadcast.stats.read_rate}%</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-green-500 transition-all duration-500"
                                        style={{ width: `${broadcast.stats.read_rate}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
 
BroadcastShowPage.layout = (page: React.ReactElement) => {
    const { broadcast } = page.props as Props

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Pesan',           href: '/admin/broadcasting' },
        { title: broadcast.title,   href: '#' },
    ]

    return <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
}