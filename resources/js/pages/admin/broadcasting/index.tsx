// broadcasting/index.tsx
import { Head, router } from '@inertiajs/react';
import { Radio} from 'lucide-react'; 
import { useEffect, useState } from 'react'
import { AnalyticsSidebar } from "@/components/broadcast-analytics";
import { columns } from '@/components/broadcast-column';
import type { Broadcast } from '@/components/broadcast-column'
import { DataTable } from '@/components/broadcast-datatable';
import { BroadcastSkeleton } from '@/components/broadcast-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';


const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Pesan', href: '/admin/broadcasting' },
];

type Props = {
    broadcasts: Broadcast[]  
    analytics: {
        total_pesan: number
        dikirim_hari_ini: number
        rate_terbuka: number
        chart_data: { month: string; pengumuman: number; darurat: number }[]
        recent: {
            id: string
            title: string
            category: string
            audience: string
            sent_at: string
            sent: number
            read: number
            rate: number
        }[]
    }
}

export default function BroadcastPage({ broadcasts, analytics }: Props) {
    const [loading, setLoading] = useState(false)

    // ← Listen to Inertia navigation events
    useEffect(() => {
        const startLoading  = router.on('start',  () => setLoading(true))
        const stopLoading   = router.on('finish', () => setLoading(false))

        return () => {
            startLoading()
            stopLoading()
        }
    }, [])


    return (
        <>
            <Head title="Manajemen Siaran" />
            <div className="flex h-full flex-1 overflow-auto p-4 gap-4 flex-col lg:flex-row">

                {/* ── Left: Main content ── */}
                <div className="flex flex-1 flex-col gap-4 min-w-0">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card">
                                <Radio />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-foreground">
                                    Manajemen Pesan
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Kirim pengumuman dan peringatan darurat kepada pengguna Anda.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.visit('/admin/broadcasting/create')} 
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-700">
                            + Pesan Baru
                        </button>
                    </div>

                    {/* Table — DataTable now owns filtering, sorting, and pagination */}
                    <div className="overflow-hidden rounded-xl border border-border bg-card p-4">
                        {loading ? (
                            <BroadcastSkeleton /> 
                        ) : (
                            <DataTable columns={columns} data={broadcasts} />
                        )}
                    </div>
                </div>

                {/* ── Right: Analytics sidebar ── */}
                <div className="w-full lg:w-64 lg:shrink-0">
                    {loading ? (
                        // ← Analytics skeleton
                        <div className="space-y-4">
                            <Skeleton className="h-32 w-full rounded-xl" />
                            <Skeleton className="h-48 w-full rounded-xl" />
                            <Skeleton className="h-24 w-full rounded-xl" />
                        </div>
                    ) : (
                        <AnalyticsSidebar analytics={analytics} />
                    )}
                </div>
            </div>
        </>
    );
}

BroadcastPage.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);