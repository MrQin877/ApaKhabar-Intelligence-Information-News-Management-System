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

const broadcastData: Broadcast[] = [
    { id: '1', type: 'daurat',     title: 'Pemeliharaan Sistem Mendesak',    audience: 'Semua Pengguna', status: 'Dikirim',   sent_time: '12:30 PM' },
    { id: '2', type: 'pengumuman', title: 'Rilis Fitur Baru: Mode Gelap',     audience: 'Semua Pengguna', status: 'Terjadwal', sent_time: '7:00 PM'  },
    { id: '3', type: 'pengumuman', title: 'Penutupan Kantor Libur',           audience: 'Semua Pengguna', status: 'Tertunda',  sent_time: '10:30 AM' },
    { id: '4', type: 'daurat',     title: 'Peringatan Cuaca Ekstrem',         audience: 'Karyawan',       status: 'Tertunda',  sent_time: '8:20 AM'  },
    { id: '5', type: 'pengumuman', title: 'Pembaruan Database Terjadwal',     audience: 'Semua Pengguna', status: 'Tertunda',  sent_time: '7:00 PM'  },
];

export default function BroadcastPage(/* { broadcasts }: { broadcasts: Broadcast[] }*/) {
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

                    {/* ✅ Table — DataTable now owns filtering, sorting, and pagination */}
                    <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900 p-4">
                        <DataTable columns={columns} data={broadcastData} />
                        {/* <DataTable columns={columns} data={broadcasts} /> */}
                    </div>
                </div>

                {/* ── Right: Analytics sidebar ── */}
                <div className="w-full lg:w-64 lg:shrink-0">
                        <AnalyticsSidebar />
                
                </div>
            </div>
        </>
    );
}

BroadcastPage.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);