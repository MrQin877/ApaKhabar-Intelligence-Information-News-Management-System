// broadcasting/index.tsx
import { Head } from '@inertiajs/react';
import { router } from '@inertiajs/react'
import { Radio} from 'lucide-react'; 
import { AnalyticsSidebar } from "@/components/broadcast-analytics";
import type { Broadcast} from '@/components/broadcast-column';
import { columns } from '@/components/broadcast-column';
import { DataTable } from '@/components/broadcast-datatable';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Pesan', href: '/admin/broadcasting' },
];

type BroadcastRow = {
    id: string
    type: string
    title: string
    audience: string
    status: string
    sent_time: string
}

type Props = {
    broadcasts: BroadcastRow[]
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
    return (
        <>
            <Head title="Manajemen Siaran" />
            <div className="flex h-full flex-1 overflow-auto p-4 gap-4 flex-col lg:flex-row">

                {/* ── Left: Main content ── */}
                <div className="flex flex-1 flex-col gap-4 min-w-0">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900">
                                <Radio />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                                    Manajemen Pesan
                                </h1>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                    Kirim pengumuman dan peringatan darurat kepada pengguna Anda.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.visit('/admin/broadcasting/create')} 
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors">
                            + Pesan Baru
                        </button>
                    </div>

                    {/* Table — DataTable now owns filtering, sorting, and pagination */}
                    <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900 p-4">
                        <DataTable columns={columns} data={broadcasts} />
                    </div>
                </div>

                {/* ── Right: Analytics sidebar ── */}
                <div className="w-full lg:w-64 lg:shrink-0">
                        <AnalyticsSidebar analytics={analytics} />
                
                </div>
            </div>
        </>
    );
}

BroadcastPage.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);