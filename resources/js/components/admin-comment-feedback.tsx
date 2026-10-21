import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { adminFlagReasons } from '@/lib/comment-moderation-options';
import { csrfPost } from '@/lib/csrf-request';

interface ReviewComment {
    id: string;
    content: string;
    status: 'published' | 'pending_review' | 'removed' | 'rejected';
    revision: number;
    ai_flagged: boolean | null;
}

interface ReviewPage {
    data: ReviewComment[];
    current_page: number;
    last_page: number;
}

const reasons: readonly (readonly [string, string])[] = adminFlagReasons;

async function readResponse(response: Response) {
    const body = await response.json();

    if (!response.ok) {
        throw new Error(
            Object.values(body.errors ?? {})
                .flat()
                .join(' ') ||
                body.message ||
                'Permintaan gagal. Silakan coba lagi.',
        );
    }

    return body;
}

function requestId() {
    // getRandomValues also works on local HTTP installations without randomUUID.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
        '',
    );

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function AdminCommentFeedback({
    newsId,
    selectedId,
    onSelect,
}: {
    newsId: number;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}) {
    const base = `/admin/news/${newsId}/moderation-comments`;
    const [reviewOpen, setReviewOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [review, setReview] = useState<ReviewPage | null>(null);
    const [reviewError, setReviewError] = useState('');
    const [comment, setComment] = useState<ReviewComment | null>(null);
    const [category, setCategory] = useState('');
    const [explanation, setExplanation] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const submitting = useRef(false);
    const lastRequest = useRef<{ payload: string; id: string } | null>(null);

    useEffect(() => {
        if (!reviewOpen) {
            return;
        }

        const controller = new AbortController();
        setReview(null);
        setReviewError('');
        fetch(`${base}?page=${page}`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(readResponse)
            .then(setReview)
            .catch(() => {
                if (!controller.signal.aborted) {
                    setReviewError(
                        'Tidak dapat memuat komentar. Tutup panel dan coba lagi.',
                    );
                }
            });

        return () => controller.abort();
    }, [base, page, reviewOpen]);

    useEffect(() => {
        setComment(null);
        setError('');
        setCategory('');
        setExplanation('');
        lastRequest.current = null;

        if (!selectedId) {
            return;
        }

        const controller = new AbortController();
        fetch(`${base}/${selectedId}`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(readResponse)
            .then((data: ReviewComment) => {
                if (controller.signal.aborted) {
                    return;
                }

                setComment(data);
                setCategory(
                    data.status === 'published' ? '' : 'harmless_criticism',
                );
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setError(
                        'Tidak dapat memuat komentar. Tutup dialog dan coba lagi.',
                    );
                }
            });

        return () => controller.abort();
    }, [base, selectedId]);

    const flagging = comment?.status === 'published';
    const allowed =
        comment &&
        ['published', 'pending_review', 'removed'].includes(comment.status);

    async function submit() {
        if (!comment || !category || !allowed || submitting.current) {
            return;
        }

        submitting.current = true;
        setBusy(true);
        setError('');
        const data = {
            classification: flagging ? 'inappropriate' : 'appropriate',
            category,
            explanation: explanation.trim() || null,
            expected_revision: comment.revision,
        };
        const payload = JSON.stringify({ comment: comment.id, ...data });

        if (lastRequest.current?.payload !== payload) {
            lastRequest.current = { payload, id: requestId() };
        }

        try {
            const result = await readResponse(
                await csrfPost(`${base}/${comment.id}/feedback`, {
                    ...data,
                    request_id: lastRequest.current.id,
                }),
            );
            setMessage(result.message);
            onSelect(null);
            router.reload({ only: ['comments'] });
        } catch (failure) {
            setError(
                failure instanceof Error
                    ? failure.message
                    : 'Koreksi gagal disimpan. Silakan coba lagi.',
            );
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                    setPage(1);
                    setReviewOpen(true);
                }}
            >
                Tinjau komentar tersembunyi
            </Button>
            {message && (
                <p
                    role="status"
                    className="rounded-lg bg-secondary p-3 text-sm"
                >
                    {message}
                </p>
            )}
            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Tinjau komentar artikel</DialogTitle>
                        <DialogDescription>
                            Khusus administrator. Komentar berikut belum
                            diterbitkan atau telah dihapus dari tampilan publik.
                        </DialogDescription>
                    </DialogHeader>
                    {reviewError && (
                        <p role="alert" className="text-sm text-destructive">
                            {reviewError}
                        </p>
                    )}
                    {!review && !reviewError && (
                        <p role="status">Memuat komentar...</p>
                    )}
                    {review?.data.length === 0 && (
                        <p>Tidak ada komentar yang perlu ditinjau.</p>
                    )}
                    {review?.data.map((item) => (
                        <article
                            key={item.id}
                            className="space-y-2 rounded-lg border p-3"
                        >
                            <p className="text-xs text-muted-foreground">
                                {item.status === 'removed'
                                    ? 'Dihapus'
                                    : 'Menunggu peninjauan'}
                            </p>
                            <p className="text-sm break-words whitespace-pre-wrap">
                                {item.content}
                            </p>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setReviewOpen(false);
                                    onSelect(item.id);
                                }}
                            >
                                Setujui sebagai pantas
                            </Button>
                        </article>
                    ))}
                    {review && review.last_page > 1 && (
                        <div className="flex items-center justify-between gap-2">
                            <Button
                                variant="outline"
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Sebelumnya
                            </Button>
                            <span className="text-xs">
                                {page} / {review.last_page}
                            </span>
                            <Button
                                variant="outline"
                                disabled={page >= review.last_page}
                                onClick={() => setPage(page + 1)}
                            >
                                Berikutnya
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog
                open={selectedId !== null}
                onOpenChange={(open) => {
                    if (!open && !busy) {
                        onSelect(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {comment
                                ? flagging
                                    ? 'Tandai komentar tidak pantas'
                                    : 'Setujui komentar sebagai pantas'
                                : 'Koreksi moderasi komentar'}
                        </DialogTitle>
                        <DialogDescription>
                            {flagging
                                ? 'Komentar akan dihapus dari tampilan publik.'
                                : 'Persetujuan akan menerbitkan atau memulihkan komentar. Balasan tetap tersembunyi jika komentar induknya belum diterbitkan.'}{' '}
                            Koreksi disimpan sebagai umpan balik yang belum
                            diverifikasi.
                        </DialogDescription>
                    </DialogHeader>
                    {!comment && !error && (
                        <p role="status">Memuat komentar...</p>
                    )}
                    {comment && (
                        <>
                            <blockquote className="max-h-48 overflow-y-auto rounded-lg bg-secondary p-3 text-sm break-words whitespace-pre-wrap">
                                {comment.content}
                            </blockquote>
                            <p className="text-xs text-muted-foreground">
                                Hasil AI awal:{' '}
                                {comment.ai_flagged === null
                                    ? 'Tidak tersedia'
                                    : comment.ai_flagged
                                      ? 'Ditandai'
                                      : 'Tidak ditandai'}
                            </p>
                            {!allowed && (
                                <p role="alert">
                                    Status komentar ini tidak dapat dikoreksi
                                    dari halaman artikel.
                                </p>
                            )}
                            {allowed && (
                                <>
                                    <Label htmlFor="moderation-category">
                                        Alasan moderasi (wajib)
                                    </Label>
                                    <Select
                                        value={category}
                                        onValueChange={setCategory}
                                        disabled={busy}
                                    >
                                        <SelectTrigger
                                            id="moderation-category"
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Pilih alasan moderasi" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(flagging
                                                ? reasons
                                                : [
                                                      [
                                                          'harmless_criticism',
                                                          'Kritik wajar / salah deteksi AI',
                                                      ],
                                                      ['other', 'Lainnya'],
                                                  ]
                                            ).map(([value, label]) => (
                                                <SelectItem
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Label htmlFor="moderation-explanation">
                                        Penjelasan (opsional)
                                    </Label>
                                    <Textarea
                                        id="moderation-explanation"
                                        maxLength={1000}
                                        value={explanation}
                                        onChange={(event) =>
                                            setExplanation(event.target.value)
                                        }
                                        disabled={busy}
                                    />
                                </>
                            )}
                        </>
                    )}
                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => onSelect(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            className="border border-green-600 bg-green-600 text-white enabled:hover:border-green-700 enabled:hover:bg-green-700 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:border-gray-700 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
                            disabled={busy || !allowed || !category}
                            onClick={() => void submit()}
                        >
                            {busy ? 'Menyimpan...' : 'Konfirmasi'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
