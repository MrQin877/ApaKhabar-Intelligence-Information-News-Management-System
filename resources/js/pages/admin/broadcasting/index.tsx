// resources/js/pages/admin/broadcasting/broadcast.tsx
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { useState } from 'react';
import { Megaphone, Siren, Search, Radio, Send, MailOpen } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Penyiaran', href: '/admin/broadcasting' },
];

// --- Types ---
type BroadcastStatus = 'Dikirim' | 'Terjadwal' | 'Tertunda';
type BroadcastType = 'daurat' | 'pengumuman';

interface Broadcast {
    id: number;
    type: BroadcastType;
    title: string;
    audience: string;
    status: BroadcastStatus;
    sentTime: string;
}

// --- Mock Data ---
const broadcasts: Broadcast[] = [
    { id: 1, type: 'daurat',     title: 'Pemeliharaan Sistem Mendesak',      audience: 'Semua Pengguna',      status: 'Dikirim',      sentTime: '12:30 PM' },
    { id: 2, type: 'pengumuman',  title: 'Rilis Fitur Baru: Mode Gelap', audience: 'Semua Pengguna',      status: 'Terjadwal', sentTime: '7:00 PM'  },
    { id: 3, type: 'pengumuman',  title: 'Penutupan Kantor Libur',         audience: 'Semua Pengguna',      status: 'Tertunda',     sentTime: '10:30 AM' },
    { id: 4, type: 'daurat',     title: 'Peringatan Cuaca Ekstrem',           audience: 'Karyawan',      status: 'Tertunda',     sentTime: '8:20 AM'  },
    { id: 5, type: 'pengumuman',  title: 'Pembaruan Database Terjadwal',     audience: 'Semua Pengguna',      status: 'Tertunda',     sentTime: '7:00 PM'  },
];

// --- Sub-components ---

function TypeIcon({ type }: { type: BroadcastType }) {
    if (type === 'daurat') {
        return (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-200 text-white text-sm font-bold">
                <Siren color='red'/>
            </div>
        );
    }
    return (
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-200 text-white text-sm">
            <Megaphone color='green'/>
        </div>
    );
}

function StatusBadge({ status }: { status: BroadcastStatus }) {
    const styles: Record<BroadcastStatus, string> = {
        Dikirim:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        Terjadwal: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        Tertunda:     'bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-400',
    };
    const dots: Record<BroadcastStatus, string> = {
        Dikirim:      'bg-green-500',
        Terjadwal: 'bg-yellow-500',
        Tertunda:     'bg-red-300',
    };
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dots[status]}`} />
            {status}
        </span>
    );
}

// --- Main Page ---
export default function BroadcastPage() {
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('Semua Jenis');
    const [statusFilter, setStatusFilter] = useState('Status');

    const filtered = broadcasts.filter(b => {
        const matchSearch = b.title.toLowerCase().includes(search.toLowerCase());
        const matchType =
            typeFilter === 'Semua Jenis' ||
            (typeFilter === 'Daurat' && b.type === 'daurat') ||
            (typeFilter === 'Pengumuman' && b.type === 'pengumuman');
        const matchStatus = statusFilter === 'Status' || b.status === statusFilter;
        return matchSearch && matchType && matchStatus;
    });

    return (
        <>
            <Head title="Manajemen Siaran" />
            <div className="flex h-full flex-1 overflow-hidden p-4 gap-4">

                {/* ── Left: Main content ── */}
                <div className="flex flex-1 flex-col gap-4 min-w-0">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900 text-lg">
                                <Radio />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                                    Manajemen Siaran
                                </h1>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                    Kirim pengumuman dan peringatan darurat kepada pengguna Anda.
                                </p>
                            </div>
                        </div>
                        <button className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors">
                            + Siaran Baru
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-[180px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm"><Search size = {15}/></span>
                            <input
                                type="text"
                                placeholder="Siaran pencarian..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900 pl-9 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none focus:ring-2 focus:ring-green-500/40"
                            />
                        </div>
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value)}
                            className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-green-500/40"
                        >
                            <option>Semua Jenis</option>
                            <option>Darurat</option>
                            <option>Pengumuman</option>
                        </select>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-green-500/40"
                        >
                            <option>Status</option>
                            <option>Kirim</option>
                            <option>Terjadwal</option>
                            <option>Draf</option>
                        </select>
                        <select className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-green-500/40">
                            <option>Penonton</option>
                            <option>Semua Pengguna</option>
                            <option>Karyawan</option>
                        </select>
                    </div>

                    {/* Table */}
                    <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-sidebar-border/70 dark:border-sidebar-border text-neutral-500 dark:text-neutral-400">
                                    <th className="px-4 py-3 text-left font-medium w-10">Jenis</th>
                                    <th className="px-4 py-3 text-left font-medium">Judul</th>
                                    <th className="px-4 py-3 text-left font-medium">Penonton</th>
                                    <th className="px-4 py-3 text-left font-medium">Status</th>
                                    <th className="px-4 py-3 text-left font-medium">Waktu Terkirim</th>
                                    <th className="px-4 py-3 w-8" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/40 dark:divide-sidebar-border/40">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                                            Tidak ada siaran yang ditemukan.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(b => (
                                        <tr key={b.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <TypeIcon type={b.type} />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                                                {b.title}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                                                {b.audience}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={b.status} />
                                            </td>
                                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                                                {b.sentTime}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-400 cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-200">
                                                ···
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t border-sidebar-border/70 dark:border-sidebar-border px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
                            <span>Menampilkan 1–{filtered.length} of {broadcasts.length} hasil</span>
                            <div className="flex items-center gap-1">
                                <button className="rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">‹</button>
                                {[1, 2, 3].map(n => (
                                    <button
                                        key={n}
                                        className={`rounded px-2.5 py-1 text-sm ${n === 1 ? 'bg-green-600 text-white' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                                    >
                                        {n}
                                    </button>
                                ))}
                                <button className="rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">›</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right: Analytics sidebar ── */}
                <div className="w-64 shrink-0 flex flex-col gap-4">

                    {/* Analytics stats */}
                    <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900 p-4">
                        <h2 className="mb-3 font-semibold text-neutral-900 dark:text-neutral-100">Analisis</h2>
                        <div className="space-y-3">
                            {[
                                { label: 'Total Siaran', value: '53', icon: <Radio /> },
                                { label: 'Dikirim Hari Ini', value: '7', icon: <Send /> },
                                { label: 'Rate Terbuka', value: '68%', icon: <MailOpen /> },
                            ].map(stat => (
                                <div key={stat.label} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                                        <span>{stat.icon}</span>
                                        {stat.label}
                                    </div>
                                    <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                                        {stat.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Broadcast Overview chart placeholder */}
                    <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Tinjauan Siaran</h2>
                            <div className="flex gap-1 text-neutral-400">
                                <button className="hover:text-neutral-600 dark:hover:text-neutral-200">‹</button>
                                <button className="hover:text-neutral-600 dark:hover:text-neutral-200">›</button>
                            </div>
                        </div>
                        {/* Simple bar chart mockup */}
                        <div className="flex items-end gap-1 h-20">
                            {[40, 65, 30, 80, 50, 70, 45, 90, 60, 75, 55, 85].map((h, i) => (
                                <div key={i} className="flex-1 flex flex-col gap-0.5 items-center">
                                    <div
                                        style={{ height: `${h}%` }}
                                        className={`w-full rounded-sm ${i % 2 === 0 ? 'bg-green-400' : 'bg-blue-400'}`}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-400 inline-block" />Pengumuman</span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-400 inline-block" />Alert Darurat</span>
                        </div>
                    </div>

                    {/* Recent Broadcast */}
                    <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-neutral-900 p-4">
                        <h2 className="mb-3 font-semibold text-neutral-900 dark:text-neutral-100">Siaran Terbaru</h2>
                        <div className="flex items-start gap-2">
                            <span className="rounded bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white shrink-0">MARA</span>
                            <div>
                                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Peringatan Cuaca Buruk</p>
                                <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">
                                    Badai dahsyat diperkirakan akan mempengaruhi daerah pesisir dalam 24 jam ke depan. Pengguna diimbau untuk tetap waspada dan mengikuti pembaruan cuaca.
                                </p>
                                <p className="text-xs text-neutral-400 mt-1">
                                    Dikirim 09:10 ke Semua Pengguna · <span className="text-green-500">1.282 dibuka 75%</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
}

BroadcastPage.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);