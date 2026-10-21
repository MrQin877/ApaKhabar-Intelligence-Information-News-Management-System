import { Check, Clock, Minus, TriangleAlert, X } from 'lucide-react';

export function VideoPublicationRing() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="size-4 shrink-0 -rotate-90"
            fill="none"
        >
            <circle
                cx="10"
                cy="10"
                r="7"
                strokeWidth="2.5"
                className="stroke-muted-foreground/40"
            />
            <circle
                cx="10"
                cy="10"
                r="7"
                pathLength="100"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="video-publication-ring-fill stroke-primary"
            />
        </svg>
    );
}

export function VideoPublicationIndicator({
    status = 'queued',
}: {
    status?: string;
}) {
    const labels: Record<string, string> = {
        published: 'Berhasil',
        failed: 'Gagal',
        queued: 'Menunggu',
        uploading: 'Mengunggah',
        processing: 'Diproses',
        uncertain: 'Memeriksa Status',
        not_selected: 'Tidak Dipilih',
    };
    const active = status === 'uploading' || status === 'processing';
    const Icon =
        {
            published: Check,
            failed: X,
            queued: Clock,
            uncertain: TriangleAlert,
        }[status] ?? Minus;

    return (
        <span className="inline-flex items-center gap-1.5" role="status">
            {active ? (
                <VideoPublicationRing />
            ) : (
                <Icon
                    aria-hidden="true"
                    className={`size-4 shrink-0 ${status === 'published' ? 'text-primary' : status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}
                />
            )}
            {labels[status] ?? 'Status belum tersedia'}
        </span>
    );
}
