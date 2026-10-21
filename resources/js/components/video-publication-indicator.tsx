import {
    Check,
    Clock,
    LoaderCircle,
    Minus,
    TriangleAlert,
    X,
} from 'lucide-react';

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
    const Icon =
        {
            published: Check,
            failed: X,
            queued: Clock,
            uploading: LoaderCircle,
            processing: LoaderCircle,
            uncertain: TriangleAlert,
        }[status] ?? Minus;

    return (
        <span className="inline-flex items-center gap-1.5" role="status">
            <Icon
                aria-hidden="true"
                className={`size-4 shrink-0 ${['uploading', 'processing'].includes(status) ? 'animate-spin' : ''} ${status === 'published' ? 'text-primary' : status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}
            />
            {labels[status] ?? 'Status belum tersedia'}
        </span>
    );
}
