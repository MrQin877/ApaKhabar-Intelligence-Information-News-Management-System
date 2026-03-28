import { Head, router } from '@inertiajs/react'
import { Archive, ArrowLeft, ArchiveRestore } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import AppLayout from '@/layouts/app-layout'
import type { BreadcrumbItem } from '@/types'

type Broadcast = {
    id: string
    type: string
    title: string
    audience: string
    status: string
    sent_time: string
    archived_at: string
}

type Props = {
    broadcasts: Broadcast[]
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Pesan',   href: '/admin/broadcasting' },
    { title: 'Arkib',   href: '/admin/broadcasting/archived' },
]

export default function ArchivedBroadcastPage({ broadcasts }: Props) {

    function handleRestore(id: string) {
        router.post(`/admin/broadcasting/${id}/restore`, {}, {
            preserveScroll: true,
        })
    }

    return (
        <>
            <Head title="Arkib Siaran" />
            <div className="flex flex-1 flex-col gap-4 p-4 max-w-4xl mx-auto w-full">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.visit('/admin/broadcasting')}
                            className="gap-1.5 text-neutral-500 -ml-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Kembali
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                        <Archive className="h-4 w-4 text-neutral-500" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                            Arkib Siaran
                        </h1>
                        <p className="text-sm text-neutral-500">
                            {broadcasts.length} siaran diarkibkan
                        </p>
                    </div>
                </div>

                {/* ── List ── */}
                {broadcasts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-neutral-400">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                            <Archive className="h-6 w-6 opacity-50" />
                        </div>
                        <p className="text-sm text-neutral-500">Tiada siaran diarkibkan</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {broadcasts.map(broadcast => (
                            <div
                                key={broadcast.id}
                                className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-5 py-4"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                            {broadcast.title}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className={
                                                broadcast.type === 'darurat'
                                                    ? 'border-red-200 text-red-600 text-xs'
                                                    : 'border-green-200 text-green-600 text-xs'
                                            }
                                        >
                                            {broadcast.type}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-neutral-400 flex-wrap">
                                        <span>{broadcast.audience}</span>
                                        <span>•</span>
                                        <span>{broadcast.status}</span>
                                        <span>•</span>
                                        <span>Diarkib: {broadcast.archived_at}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => router.visit(`/admin/broadcasting/${broadcast.id}`)}
                                        className="text-xs h-8"
                                    >
                                        Lihat
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRestore(broadcast.id)}
                                        className="text-xs h-8 gap-1.5 text-green-600 border-green-200 hover:bg-green-50"
                                    >
                                        <ArchiveRestore className="h-3.5 w-3.5" />
                                        Pulihkan
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}

ArchivedBroadcastPage.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
)