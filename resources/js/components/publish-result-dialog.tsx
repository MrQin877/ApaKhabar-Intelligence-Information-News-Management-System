import { router, usePage } from '@inertiajs/react';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { PublishResult } from '@/lib/manual-publish';

export function PublishResultDialog({
    result,
    videoMode = false,
    onRetry,
    retrying = false,
    onDismiss,
}: {
    result?: PublishResult;
    videoMode?: boolean;
    onRetry?: (platform: string) => void;
    retrying?: boolean;
    onDismiss?: () => void;
}) {
    const { publishResult: sharedResult } = usePage<{
        publishResult?: PublishResult | null;
    }>().props;
    const publishResult = result ?? sharedResult;
    const [dismissed, setDismissed] = useState<string | null>(null);

    if (!publishResult) {
        return null;
    }

    const entries = Object.entries(publishResult.results);
    const anySuccess = entries.some(([, result]) => result.success);
    const names: Record<string, string> = {
        application: 'Aplikasi',
        website: 'ApaKhabar',
        instagram: 'Instagram',
        facebook: 'Facebook',
    };
    const close = () => {
        setDismissed(publishResult.attempt_id);
        onDismiss?.();

        if (publishResult.completion_url) {
            router.visit(publishResult.completion_url);
        }
    };

    return (
        <Dialog
            open={dismissed !== publishResult.attempt_id}
            onOpenChange={(open) => {
                if (!open) {
                    close();
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {videoMode
                            ? 'Status Publikasi Video'
                            : publishResult.success
                              ? 'Publikasi Berhasil'
                              : anySuccess
                                ? 'Publikasi Sebagian Berhasil'
                                : 'Publikasi Gagal'}
                    </DialogTitle>
                    <DialogDescription>
                        {videoMode
                            ? 'Status diperbarui otomatis. Kegagalan sosial tidak memengaruhi publikasi ApaKhabar.'
                            : publishResult.success
                              ? 'Berita berhasil diterbitkan ke semua platform yang dipilih.'
                              : 'Periksa hasil publikasi untuk setiap platform di bawah ini.'}
                    </DialogDescription>
                </DialogHeader>
                <ul className="space-y-3">
                    {entries.map(([platform, result]) => (
                        <li key={platform} className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 font-medium">
                                {result.success ? (
                                    <Check
                                        className="size-4 text-emerald-600"
                                        aria-hidden="true"
                                    />
                                ) : videoMode &&
                                  [
                                      'queued',
                                      'processing',
                                      'not_selected',
                                      'uncertain',
                                  ].includes(result.status ?? '') ? (
                                    <span className="size-2 rounded-full bg-muted-foreground" />
                                ) : (
                                    <X
                                        className="size-4 text-destructive"
                                        aria-hidden="true"
                                    />
                                )}
                                {names[platform] ?? platform} —{' '}
                                {videoMode && result.status
                                    ? {
                                          published: 'Berhasil',
                                          failed: 'Gagal',
                                          processing: 'Diproses',
                                          queued: 'Menunggu',
                                          uncertain: 'Belum pasti',
                                          not_selected: 'Tidak Dipilih',
                                      }[result.status]
                                    : result.success
                                      ? 'Berhasil diterbitkan'
                                      : 'Gagal'}
                            </div>
                            {videoMode &&
                                ['failed', 'uncertain'].includes(
                                    result.status ?? '',
                                ) &&
                                onRetry && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={retrying}
                                        onClick={() => onRetry(platform)}
                                    >
                                        {result.status === 'uncertain'
                                            ? 'Periksa Status'
                                            : 'Coba Lagi'}
                                    </Button>
                                )}
                            {videoMode && result.account && (
                                <p className="text-muted-foreground">
                                    {result.account}
                                </p>
                            )}
                            {videoMode &&
                                result.permalink &&
                                /^https:\/\//.test(result.permalink) && (
                                    <a
                                        href={result.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                    >
                                        Lihat publikasi
                                    </a>
                                )}
                            {!result.success && (
                                <p className="text-muted-foreground">
                                    {result.message}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
                <DialogFooter>
                    {!videoMode &&
                        !publishResult.success &&
                        !publishResult.completion_url && (
                            <Button
                                onClick={() => {
                                    close();

                                    if (publishResult.retry_url) {
                                        router.visit(publishResult.retry_url);
                                    }
                                }}
                            >
                                Coba Lagi
                            </Button>
                        )}
                    <Button
                        variant={publishResult.success ? 'default' : 'outline'}
                        onClick={close}
                    >
                        {publishResult.completion_url
                            ? 'Daftar Berita'
                            : 'Selesai'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
