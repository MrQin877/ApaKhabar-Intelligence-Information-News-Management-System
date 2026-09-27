import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
export interface AssistantSessionSummary {
    id: number;
    title: string;
    status: string;
    request_id: string | null;
}
const labels: Record<string, string> = {
    processing_files: 'Mengekstrak dokumen',
    queued: 'Dalam antrean',
    running: 'AI sedang bekerja',
    failed: 'Perlu dicoba ulang',
    awaiting_answers: 'Menunggu jawaban',
    awaiting_approval: 'Menunggu persetujuan',
    ready_to_generate: 'Siap membuat draf',
    collecting_sources: 'Percakapan sementara',
};
const activeStatuses = [
    'processing_files',
    'queued',
    'running',
    'awaiting_answers',
    'awaiting_approval',
    'ready_to_generate',
];
export function SessionPanel({
    sessions,
    current,
}: {
    sessions: AssistantSessionSummary[];
    current?: number;
}) {
    const [open, setOpen] = useState(false);
    const active = sessions.filter((s) => activeStatuses.includes(s.status));
    const temporary = sessions.filter(
        (s) => !activeStatuses.includes(s.status),
    );
    const links = (items: AssistantSessionSummary[]) =>
        items.map((s) => (
            <Link
                key={s.id}
                href={`/admin/ai-assistant?session=${s.id}`}
                preserveState={false}
                onClick={() => setOpen(false)}
                aria-current={s.id === current ? 'page' : undefined}
                className={`block rounded-lg border p-3 ${s.id === current ? 'bg-accent' : 'hover:bg-muted'}`}
            >
                <span className="block truncate text-sm">{s.title}</span>
                <span className="text-xs text-muted-foreground">
                    {labels[s.status] ?? s.status} · Lanjutkan
                </span>
            </Link>
        ));

    return (
        <>
            <div className="absolute top-20 left-4 z-30 flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(true)}
                >
                    Riwayat
                    {active.length ? ` · ${active.length} tugas aktif` : ''}
                </Button>
            </div>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side="left" className="overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>Riwayat percakapan</SheetTitle>
                        <SheetDescription>
                            Percakapan tanpa draf ditampilkan selama 7 hari
                            sejak aktivitas terakhir. Percakapan draf tersedia
                            melalui Berita. Riwayat tidak dihapus.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-4 p-4">
                        <Button asChild variant="outline">
                            <Link
                                href="/admin/ai-assistant"
                                preserveState={false}
                                onClick={() => setOpen(false)}
                            >
                                Percakapan baru
                            </Link>
                        </Button>
                        <section className="space-y-2">
                            <h2 className="text-sm font-medium">
                                Tugas aktif ({active.length})
                            </h2>
                            {links(active)}
                            {!active.length && (
                                <p className="text-sm text-muted-foreground">
                                    Tidak ada tugas aktif.
                                </p>
                            )}
                        </section>
                        <section className="space-y-2">
                            <h2 className="text-sm font-medium">
                                Percakapan sementara
                            </h2>
                            {links(temporary)}
                            {!temporary.length && (
                                <p className="text-sm text-muted-foreground">
                                    Belum ada percakapan sementara.
                                </p>
                            )}
                        </section>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
