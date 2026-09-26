import { Link } from '@inertiajs/react';
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
    draft_generated: 'Draf siap',
    ready_to_generate: 'Siap membuat draf',
    collecting_sources: 'Percakapan tersimpan',
};
export function SessionPanel({
    sessions,
    current,
}: {
    sessions: AssistantSessionSummary[];
    current?: number;
}) {
    return (
        <aside
            className="z-10 max-h-40 shrink-0 overflow-y-auto border-b bg-card p-3 lg:mt-16 lg:max-h-none lg:w-56 lg:border-r lg:border-b-0"
            aria-label="Percakapan tersimpan"
        >
            <Link
                href="/admin/ai-assistant"
                preserveState={false}
                className="mb-3 block rounded-lg border p-2 text-sm font-medium"
            >
                + Percakapan baru
            </Link>
            <p className="mb-2 text-xs text-muted-foreground">
                Percakapan terbaru · tersimpan otomatis
            </p>
            <nav className="space-y-1">
                {sessions.map((s) => (
                    <Link
                        key={s.id}
                        href={`/admin/ai-assistant?session=${s.id}`}
                        preserveState={false}
                        aria-current={s.id === current ? 'page' : undefined}
                        className={`block rounded-lg p-2 text-sm ${s.id === current ? 'bg-accent' : 'hover:bg-muted'}`}
                    >
                        <span className="block truncate">{s.title}</span>
                        <span className="text-xs text-muted-foreground">
                            {labels[s.status] ?? s.status}
                        </span>
                    </Link>
                ))}
            </nav>
        </aside>
    );
}
