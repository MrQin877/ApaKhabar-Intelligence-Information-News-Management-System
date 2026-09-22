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
            <div className="flex flex-1 p-4">
                <div className="flex w-full min-h-0 flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card">
                                <Radio />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-foreground">
                                    Pesan
                                </h1>

                            </div>
                        </div>
                        <button
                            onClick={() => router.visit('/admin/broadcasting/create')}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-700"
                        >
                            + Pesan Baru
                        </button>
                    </div>

                    <div className="w-full">
                        {loading ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <Skeleton className="h-28 w-full rounded-xl" />
                                <Skeleton className="h-28 w-full rounded-xl" />
                                <Skeleton className="h-28 w-full rounded-xl" />
                            </div>
                        ) : (
                            <AnalyticsSidebar analytics={analytics} />
                        )}
                    </div>

                    <div className="overflow-auto rounded-xl border border-border bg-card">
                        {loading ? (
                            <BroadcastSkeleton />
                        ) : (
                            <DataTable columns={columns} data={broadcasts} />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

BroadcastPage.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);
//<p className="text-sm text-muted-foreground">Kirim pengumuman dan peringatan darurat kepada pengguna Anda. </p>
//Manajemen 