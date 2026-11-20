import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';

type Snapshot = Record<string, unknown> | null;
interface Feedback {
    id: number;
    comment_id: number;
    assessment_id: number;
    history_id: number;
    administrator_id: number | null;
    classification: string;
    category: string;
    explanation: string | null;
    verification_status: string;
    request_id: string;
    expected_revision: number;
    created_at: string;
    history_snapshot: Snapshot;
    administrator_snapshot: Snapshot;
}
interface Assessment {
    id: number;
    comment_id: number;
    classification: string;
    categories: Record<string, boolean> | null;
    category_scores: Record<string, number> | null;
    reason: string | null;
    initial_status: string | null;
    requested_model: string | null;
    returned_model: string | null;
    source: string;
    assessed_at: string | null;
    created_at: string;
    comment_snapshot: Snapshot;
    feedback: Feedback[];
}
interface Props {
    assessments: {
        data: Assessment[];
        total: number;
        prev_page_url: string | null;
        next_page_url: string | null;
    };
    filters: { comment_id: number | string };
}

function date(value: string | null) {
    return value
        ? new Intl.DateTimeFormat('id-ID', {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(value))
        : '-';
}

export default function CommentLegacyHistory({ assessments, filters }: Props) {
    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Moderasi Komentar', href: '/admin/comments' },
                {
                    title: 'Arsip Moderasi Lama',
                    href: '/admin/comments/legacy-history',
                },
            ]}
        >
            <Head title="Arsip Moderasi Lama" />
            <main className="mx-auto w-full max-w-4xl space-y-5 p-4 md:p-6">
                <header>
                    <h1 className="text-2xl font-semibold">
                        Arsip Moderasi Lama
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Salinan riwayat penilaian dan koreksi lama. Arsip ini
                        tetap tersedia jika komentar asli dihapus.
                    </p>
                    <Link
                        href="/admin/comments"
                        className="mt-2 inline-block text-sm text-primary hover:underline"
                    >
                        Kembali ke Moderasi Komentar
                    </Link>
                </header>
                <form method="get" className="flex flex-wrap items-end gap-2">
                    <label className="text-sm">
                        ID komentar
                        <input
                            name="comment_id"
                            type="number"
                            min="1"
                            defaultValue={filters.comment_id}
                            className="mt-1 block rounded-md border bg-background px-3 py-2"
                        />
                    </label>
                    <button
                        type="submit"
                        className="rounded-md border px-4 py-2 text-sm"
                    >
                        Cari
                    </button>
                </form>
                <p className="text-sm text-muted-foreground">
                    {assessments.total} penilaian tersimpan
                </p>
                {assessments.data.map((item) => (
                    <article
                        key={item.id}
                        className="space-y-3 rounded-xl border bg-card p-4"
                    >
                        <div className="flex flex-wrap justify-between gap-2">
                            <h2 className="font-semibold">
                                Penilaian #{item.id} · Komentar #
                                {item.comment_id}
                            </h2>
                            <span className="text-sm text-muted-foreground">
                                {date(item.created_at)}
                            </span>
                        </div>
                        <p className="text-sm break-words whitespace-pre-wrap">
                            {String(
                                item.comment_snapshot?.content ??
                                    'Konten komentar tidak tersedia dalam arsip.',
                            )}
                        </p>
                        <dl className="grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-muted-foreground">
                                    Klasifikasi historis
                                </dt>
                                <dd>{item.classification}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    Status awal
                                </dt>
                                <dd>{item.initial_status ?? '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    Sumber
                                </dt>
                                <dd>{item.source}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    Tanggal penilaian
                                </dt>
                                <dd>{date(item.assessed_at)}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    Model diminta
                                </dt>
                                <dd>{item.requested_model ?? '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    Model digunakan
                                </dt>
                                <dd>{item.returned_model ?? '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    Alasan
                                </dt>
                                <dd>{item.reason ?? '-'}</dd>
                            </div>
                        </dl>
                        <details className="text-sm">
                            <summary className="cursor-pointer">
                                Kategori dan skor historis
                            </summary>
                            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                                {JSON.stringify(
                                    {
                                        categories: item.categories,
                                        category_scores: item.category_scores,
                                    },
                                    null,
                                    2,
                                )}
                            </pre>
                        </details>
                        {item.feedback.map((feedback) => (
                            <div
                                key={feedback.id}
                                className="space-y-1 rounded-lg border p-3 text-sm"
                            >
                                <h3 className="font-medium">
                                    Koreksi #{feedback.id} · Keputusan #
                                    {feedback.history_id}
                                </h3>
                                <p>
                                    {feedback.classification} ·{' '}
                                    {feedback.category}
                                    {feedback.explanation
                                        ? `: ${feedback.explanation}`
                                        : ''}
                                </p>
                                <p>
                                    Oleh{' '}
                                    {String(
                                        feedback.administrator_snapshot?.name ??
                                            `Pengguna #${feedback.administrator_id ?? '-'}`,
                                    )}{' '}
                                    · {date(feedback.created_at)}
                                </p>
                                <p>
                                    Status verifikasi lama:{' '}
                                    {feedback.verification_status} · Revisi:{' '}
                                    {feedback.expected_revision}
                                </p>
                                <p>
                                    Transisi:{' '}
                                    {String(
                                        feedback.history_snapshot
                                            ?.from_status ?? '-',
                                    )}{' '}
                                    →{' '}
                                    {String(
                                        feedback.history_snapshot?.to_status ??
                                            '-',
                                    )}
                                </p>
                                <details>
                                    <summary className="cursor-pointer">
                                        ID permintaan dan alasan keputusan
                                    </summary>
                                    <p className="mt-1 break-all">
                                        {feedback.request_id}
                                    </p>
                                    <p>
                                        {String(
                                            feedback.history_snapshot?.reason ??
                                                '-',
                                        )}
                                    </p>
                                </details>
                            </div>
                        ))}
                    </article>
                ))}
                <nav
                    className="flex justify-between text-sm"
                    aria-label="Halaman arsip"
                >
                    {assessments.prev_page_url ? (
                        <Link href={assessments.prev_page_url}>Sebelumnya</Link>
                    ) : (
                        <span />
                    )}
                    {assessments.next_page_url ? (
                        <Link href={assessments.next_page_url}>Berikutnya</Link>
                    ) : (
                        <span />
                    )}
                </nav>
            </main>
        </AppLayout>
    );
}
