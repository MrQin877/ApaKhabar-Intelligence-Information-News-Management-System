import { Check, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DocumentItem } from './types';

type Progress = {
    stage: string;
    label: string;
    completed_chunks?: number;
    total_chunks?: number;
};

export function DocumentProcessingStatus({
    documents,
}: {
    documents: DocumentItem[];
}) {
    const [progress, setProgress] = useState<Record<number, Progress>>({});
    const ids = documents.map((document) => document.id).join(',');
    useEffect(() => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        const poll = async () => {
            await Promise.all(
                ids
                    .split(',')
                    .filter(Boolean)
                    .map(async (id) => {
                        try {
                            const response = await fetch(
                                `/admin/ai-assistant/documents/${id}/progress`,
                                {
                                    headers: { Accept: 'application/json' },
                                    signal: controller.signal,
                                },
                            );

                            if (!response.ok) {
                                throw new Error('Unavailable');
                            }

                            const data = await response.json();
                            setProgress((previous) => ({
                                ...previous,
                                [id]: data,
                            }));
                        } catch {
                            if (!controller.signal.aborted) {
                                setProgress((previous) => ({
                                    ...previous,
                                    [id]: {
                                        stage: 'unavailable',
                                        label: 'Pembaruan terputus; mencoba lagi…',
                                    },
                                }));
                            }
                        }
                    }),
            );

            if (!controller.signal.aborted) {
                timer = setTimeout(poll, 2500);
            }
        };
        void poll();

        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [ids]);

    return (
        <div
            className="max-w-2xl space-y-3 text-sm leading-7 text-foreground"
            aria-live="polite"
        >
            <div className="flex items-center gap-2 font-medium">
                <LoaderCircle className="size-4 animate-spin text-primary" />
                Dokumen sedang diproses
            </div>
            {documents.map((document) => {
                const item = progress[document.id];

                return (
                    <div key={document.id} className="rounded-lg border p-3">
                        <p className="font-medium">{document.original_name}</p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            {item?.stage === 'failed' ? (
                                <span className="size-2 rounded-full bg-destructive" />
                            ) : item?.stage === 'ready' ? (
                                <Check className="size-4" />
                            ) : (
                                <LoaderCircle className="size-4 animate-spin" />
                            )}
                            {item?.label ?? 'Menunggu pembaruan antrean…'}
                        </p>
                        {!!item?.total_chunks && (
                            <div className="mt-2">
                                <progress
                                    className="h-2 w-full"
                                    max={item.total_chunks}
                                    value={item.completed_chunks ?? 0}
                                    aria-label="Bagian dokumen selesai"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {item.completed_chunks ?? 0}/
                                    {item.total_chunks} bagian selesai
                                </p>
                            </div>
                        )}
                    </div>
                );
            })}
            <p className="text-muted-foreground">
                Pemrosesan berlanjut di latar belakang. Dokumen besar dan OCR
                memerlukan waktu lebih lama. Anda boleh membuka kembali
                percakapan dari riwayat.
            </p>
        </div>
    );
}
