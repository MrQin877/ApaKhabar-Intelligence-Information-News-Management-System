import { Head, Link, router } from '@inertiajs/react';
import { ArchiveRestore, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { columns as messageColumns } from '@/components/broadcast-column';
import type { Broadcast } from '@/components/broadcast-column';
import { DataTable } from '@/components/broadcast-datatable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type ArchivedBroadcast = Broadcast & { archived_at: string };
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Pesan', href: '/admin/broadcasting' },
    { title: 'Arsip', href: '/admin/broadcasting/archived' },
];

export default function ArchivedBroadcastPage({
    broadcasts,
}: {
    broadcasts: ArchivedBroadcast[];
}) {
    const [restoring, setRestoring] = useState<string | null>(null);
    const [feedback, setFeedback] = useState('');

    function restore(id: string) {
        setRestoring(id);
        setFeedback('');
        router.post(
            `/admin/broadcasting/${id}/restore`,
            {},
            {
                preserveScroll: true,
                onSuccess: () =>
                    setFeedback(
                        'Pesan diaktifkan dan dikembalikan ke Semua Pesan.',
                    ),
                onError: () =>
                    setFeedback('Pesan gagal diaktifkan. Silakan coba lagi.'),
                onFinish: () => setRestoring(null),
            },
        );
    }

    const columns = [
        ...messageColumns.filter(
            (column) =>
                column.id !== 'select' &&
                column.id !== 'actions' &&
                column.accessorKey !== 'sent_time',
        ),
        {
            accessorKey: 'archived_at',
            header: ({ column }: { column: any }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8 px-3 text-xs font-semibold tracking-wider text-neutral-500 uppercase"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Diarsipkan
                    <ArrowUpDown className="ml-1.5 size-3" />
                </Button>
            ),
            // Use the server's newest-first order, not localized date strings.
            sortingFn: (
                a: { original: ArchivedBroadcast },
                b: { original: ArchivedBroadcast },
            ) =>
                broadcasts.indexOf(b.original) - broadcasts.indexOf(a.original),
            cell: ({ row }: { row: { original: ArchivedBroadcast } }) => (
                <span className="font-mono text-sm text-neutral-500 dark:text-neutral-400">
                    {row.original.archived_at}
                </span>
            ),
        },
        {
            id: 'actions',
            header: () => (
                <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                    Aksi
                </span>
            ),
            cell: ({ row }: { row: { original: ArchivedBroadcast } }) => (
                <div className="flex justify-end gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="h-8 text-xs"
                    >
                        <Link href={`/admin/broadcasting/${row.original.id}`}>
                            Lihat
                        </Link>
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={restoring !== null}
                        onClick={() => restore(row.original.id)}
                        className="h-8 gap-1.5 border-green-200 text-xs text-green-600 hover:bg-green-50 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950"
                    >
                        <ArchiveRestore className="size-3.5" />
                        {restoring === row.original.id
                            ? 'Mengaktifkan…'
                            : 'Aktifkan'}
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <>
            <Head title="Arsip pesan" />
            <div className="flex w-full flex-col gap-6 p-4 sm:p-6">
                <header>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Arsip pesan
                        </h1>
                        <Badge variant="outline">{broadcasts.length}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Cari, tinjau, dan aktifkan pesan yang diarsipkan.
                    </p>
                </header>
                <div className="overflow-auto rounded-xl border border-border bg-card">
                    <DataTable columns={columns} data={broadcasts} />
                </div>
                {feedback && (
                    <p
                        role="status"
                        className="rounded-md border bg-muted/40 p-3 text-sm"
                    >
                        {feedback}
                    </p>
                )}
            </div>
        </>
    );
}
ArchivedBroadcastPage.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);
