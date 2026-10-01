import { router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SessionMessage } from './types';

export function CategoryProposalCard({
    message,
    categories,
    readOnly = false,
}: {
    readOnly?: boolean;
    message: SessionMessage;
    categories: { categoryID: number; name: string }[];
}) {
    const proposal = message.payload?.category_proposal as
        | { name: string; reason: string; status: string }
        | undefined;
    const [selected, setSelected] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    if (!proposal) {
return null;
}

    const decide = (decision: string) => {
        setBusy(true);
        setError('');
        router.post(
            `/admin/ai-assistant/category-proposals/${message.id}`,
            { decision, category_id: selected || null },
            {
                preserveScroll: true,
                onError: (errors) => setError(Object.values(errors).join(' ')),
                onFinish: () => setBusy(false),
            },
        );
    };

    return (
        <section
            className="space-y-3 rounded-xl border bg-card p-4"
            aria-label="Usulan kategori"
        >
            <p className="font-medium">Usulan kategori: {proposal.name}</p>
            <p className="text-sm text-muted-foreground">{proposal.reason}</p>
            {proposal.status === 'pending' && !readOnly ? (
                <>
                    <p className="text-xs text-muted-foreground">
                        Kategori belum dibuat. Draf menggunakan kategori
                        sementara sampai Anda memilih.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            disabled={busy}
                            onClick={() => decide('approve')}
                        >
                            Setujui kategori baru
                        </Button>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => decide('cancel')}
                        >
                            Batalkan usulan
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            aria-label="Kategori yang tersedia"
                            className="max-w-full rounded-md border bg-background p-2 text-sm"
                            value={selected}
                            onChange={(e) => setSelected(e.target.value)}
                        >
                            <option value="">
                                Pilih kategori yang sudah ada
                            </option>
                            {categories.map((c) => (
                                <option key={c.categoryID} value={c.categoryID}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                        <Button
                            variant="outline"
                            disabled={busy || !selected}
                            onClick={() => decide('existing')}
                        >
                            Gunakan kategori ini
                        </Button>
                    </div>
                </>
            ) : (
                <p className="text-sm">
                    {proposal.status === 'cancel'
                        ? 'Usulan dibatalkan.'
                        : 'Keputusan kategori telah disimpan.'}
                </p>
            )}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </section>
    );
}
