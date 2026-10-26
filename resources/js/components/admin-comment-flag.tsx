import { useEffect, useState } from 'react';
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
    status: string;
}

export default function AdminCommentFlag({
    newsId,
    selectedId,
    onSelect,
}: {
    newsId: number;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}) {
    const base = `/admin/news/${newsId}/moderation-comments`;
    const [comment, setComment] = useState<ReviewComment | null>(null);
    const [category, setCategory] = useState('');
    const [explanation, setExplanation] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        setComment(null);
        setCategory('');
        setExplanation('');
        setError('');
        if (!selectedId) return;
        const controller = new AbortController();
        fetch(`${base}/${selectedId}`, {
            credentials: 'same-origin',
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok)
                    throw new Error('Komentar tidak dapat dimuat.');
                return response.json();
            })
            .then(setComment)
            .catch(() => {
                if (!controller.signal.aborted)
                    setError('Komentar tidak dapat dimuat.');
            });
        return () => controller.abort();
    }, [base, selectedId]);

    async function submit() {
        if (!selectedId || !category || busy) return;
        setBusy(true);
        setError('');
        try {
            const response = await csrfPost(`${base}/${selectedId}/flag`, {
                category,
                explanation: explanation.trim() || null,
            });
            const body = await response.json();
            if (!response.ok)
                throw new Error(
                    Object.values(body.errors ?? {})
                        .flat()
                        .join(' ') ||
                        body.message ||
                        'Gagal menandai komentar.',
                );
            setMessage(body.message);
            onSelect(null);
        } catch (failure) {
            setError(
                failure instanceof Error
                    ? failure.message
                    : 'Gagal menandai komentar.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            {message && (
                <p
                    role="status"
                    className="rounded-lg bg-secondary p-3 text-sm"
                >
                    {message}
                </p>
            )}
            <Dialog
                open={selectedId !== null}
                onOpenChange={(open) => {
                    if (!open && !busy) onSelect(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Tandai komentar untuk moderasi
                        </DialogTitle>
                        <DialogDescription>
                            Komentar yang sudah terbit tetap terlihat sampai
                            reviewer memilih Sembunyikan.
                        </DialogDescription>
                    </DialogHeader>
                    {comment && (
                        <div className="space-y-1 rounded-lg border p-3 text-sm">
                            <p className="break-words whitespace-pre-wrap">
                                {comment.content}
                            </p>
                            <p className="text-muted-foreground">
                                Status:{' '}
                                {comment.status === 'published'
                                    ? 'Diterbitkan'
                                    : 'Menunggu peninjauan'}
                            </p>
                        </div>
                    )}
                    <Label htmlFor="flag-category">Kategori tanda</Label>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger id="flag-category">
                            <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                        <SelectContent>
                            {adminFlagReasons.map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Label htmlFor="flag-explanation">
                        Penjelasan (opsional)
                    </Label>
                    <Textarea
                        id="flag-explanation"
                        value={explanation}
                        maxLength={1000}
                        onChange={(event) => setExplanation(event.target.value)}
                    />
                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                    <Button
                        disabled={!comment || !category || busy}
                        onClick={() => void submit()}
                    >
                        {busy ? 'Menyimpan...' : 'Tandai Komentar'}
                    </Button>
                </DialogContent>
            </Dialog>
        </>
    );
}
