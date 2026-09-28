import { router } from '@inertiajs/react';
import { CheckCircle2, FileText, ShieldCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { PendingInformationItem } from '@/components/intelligent-news/types';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

type ReviewTarget = {
    items: PendingInformationItem[];
    decision: 'approved' | 'rejected';
};

export function ExtractedInformationReview({
    items,
    onFinished,
}: {
    items: PendingInformationItem[];
    onFinished: (newlyApprovedIds: number[]) => void;
}) {
    const [remainingIds, setRemainingIds] = useState(
        items.map((item) => item.id),
    );
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [approvedIds, setApprovedIds] = useState<number[]>([]);
    const [target, setTarget] = useState<ReviewTarget | null>(null);
    const [processing, setProcessing] = useState(false);
    const visibleItems = items.filter((item) => remainingIds.includes(item.id));
    const allSelected =
        visibleItems.length > 0 &&
        visibleItems.every((item) => selectedIds.includes(item.id));

    function submitReview() {
        if (!target || target.items.length === 0) {
            return;
        }

        const ids = target.items.map((item) => item.id);
        const url =
            ids.length === 1
                ? `/admin/information/${ids[0]}/review`
                : '/admin/information/review/bulk';
        const payload =
            ids.length === 1
                ? { decision: target.decision }
                : { decision: target.decision, information_ids: ids };

        setProcessing(true);
        router.post(url, payload, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                const nextApproved =
                    target.decision === 'approved'
                        ? Array.from(new Set([...approvedIds, ...ids]))
                        : approvedIds;
                const nextRemaining = remainingIds.filter(
                    (id) => !ids.includes(id),
                );
                setRemainingIds(nextRemaining);
                setSelectedIds((current) =>
                    current.filter((id) => !ids.includes(id)),
                );
                setTarget(null);
                setApprovedIds(nextApproved);

                if (nextRemaining.length === 0) {
                    window.setTimeout(() => onFinished(nextApproved), 0);
                }
            },
            onFinish: () => setProcessing(false),
        });
    }

    if (visibleItems.length === 0) {
        return null;
    }

    return (
        <>
            <Card className="max-w-2xl gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
                <CardHeader className="border-b px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle className="text-base">
                                Tinjau informasi hasil ekstraksi
                            </CardTitle>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                Setujui fakta yang boleh digunakan. Setelah
                                semua ditinjau, AI akan melanjutkan permintaan
                                berita.
                            </p>
                        </div>
                        <Badge variant="secondary">
                            {visibleItems.length} menunggu
                        </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={(checked) =>
                                    setSelectedIds(
                                        checked
                                            ? visibleItems.map(
                                                  (item) => item.id,
                                              )
                                            : [],
                                    )
                                }
                            />
                            Pilih semua
                        </label>
                        <Button
                            size="sm"
                            disabled={selectedIds.length === 0 || processing}
                            onClick={() =>
                                setTarget({
                                    items: visibleItems.filter((item) =>
                                        selectedIds.includes(item.id),
                                    ),
                                    decision: 'approved',
                                })
                            }
                        >
                            <ShieldCheck /> Setujui terpilih (
                            {selectedIds.length})
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="max-h-[32rem] space-y-3 overflow-y-auto p-4">
                    {visibleItems.map((item) => (
                        <div
                            key={item.id}
                            className="rounded-xl border bg-background p-4"
                        >
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    className="mt-1"
                                    checked={selectedIds.includes(item.id)}
                                    onCheckedChange={(checked) =>
                                        setSelectedIds((current) =>
                                            checked
                                                ? [...current, item.id]
                                                : current.filter(
                                                      (id) => id !== item.id,
                                                  ),
                                        )
                                    }
                                    aria-label={`Pilih ${item.title}`}
                                />
                                <div className="min-w-0 flex-1">
                                    <h3 className="leading-6 font-medium">
                                        {item.title}
                                    </h3>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        {item.summary}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <Badge variant="outline">
                                            <FileText />
                                            {item.document.original_name}
                                        </Badge>
                                        <Badge variant="outline">
                                            Kualitas{' '}
                                            {item.quality_score == null
                                                ? '–'
                                                : `${item.quality_score.toFixed(1)}%`}
                                        </Badge>
                                    </div>
                                    {item.evidence[0]?.quote && (
                                        <blockquote className="mt-3 border-l-2 pl-3 text-xs leading-5 text-muted-foreground">
                                            “{item.evidence[0].quote}”
                                        </blockquote>
                                    )}
                                    <div className="mt-4 flex gap-2 border-t pt-3">
                                        <Button
                                            size="sm"
                                            disabled={processing}
                                            onClick={() =>
                                                setTarget({
                                                    items: [item],
                                                    decision: 'approved',
                                                })
                                            }
                                        >
                                            <CheckCircle2 /> Setujui
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={processing}
                                            onClick={() =>
                                                setTarget({
                                                    items: [item],
                                                    decision: 'rejected',
                                                })
                                            }
                                        >
                                            <XCircle /> Tolak
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <AlertDialog
                open={Boolean(target)}
                onOpenChange={(open) => !open && setTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {target?.decision === 'approved'
                                ? 'Setujui informasi ini?'
                                : 'Tolak informasi ini?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {target?.decision === 'approved'
                                ? `${target.items.length} informasi akan tersedia untuk pencarian dan pembuatan berita.`
                                : 'Informasi akan dihapus secara lunak dari pustaka aktif dan tidak digunakan oleh AI.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>
                            Batal
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={processing}
                            className={
                                target?.decision === 'rejected'
                                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                    : undefined
                            }
                            onClick={submitReview}
                        >
                            {target?.decision === 'approved'
                                ? 'Ya, setujui'
                                : 'Ya, tolak'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
