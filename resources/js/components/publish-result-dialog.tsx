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
import { VideoPublicationIndicator } from '@/components/video-publication-indicator';
import type { PublishResult } from '@/lib/manual-publish';
import { publicationUrl } from '@/lib/short-publication';

export function PublishResultDialog({
    result,
    videoMode = false,
    onRetry,
    retrying = false,
    onDismiss,
    statusError,
    onRefreshStatus,
}: {
    result?: PublishResult;
    videoMode?: boolean;
    onRetry?: (platform: string) => void;
    retrying?: boolean;
    onDismiss?: () => void;
    statusError?: string;
    onRefreshStatus?: () => void;
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
        instagram: videoMode ? 'Instagram Reels' : 'Instagram',
        facebook: videoMode ? 'Facebook Reels' : 'Facebook',
    };
    const close = () => {
        setDismissed(publishResult.attempt_id);
        onDismiss?.();

        if (!videoMode && publishResult.completion_url) {
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
                                {names[platform] ?? platform}:{' '}
                                {videoMode ? (
                                    <VideoPublicationIndicator
                                        status={result.status}
                                    />
                                ) : result.success ? (
                                    <>
                                        <Check
                                            className="size-4 text-primary"
                                            aria-hidden="true"
                                        />
                                        Berhasil diterbitkan
                                    </>
                                ) : (
                                    <>
                                        <X
                                            className="size-4 text-destructive"
                                            aria-hidden="true"
                                        />
                                        Gagal
                                    </>
                                )}
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
                                publicationUrl(
                                    platform,
                                    result.status,
                                    result.permalink,
                                ) && (
                                    <a
                                        href={
                                            publicationUrl(
                                                platform,
                                                result.status,
                                                result.permalink,
                                            )!
                                        }
                                        target={
                                            platform === 'website'
                                                ? undefined
                                                : '_blank'
                                        }
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                    >
                                        Lihat Publikasi
                                    </a>
                                )}
                            {!result.success &&
                                (!videoMode ||
                                    ['failed', 'uncertain'].includes(
                                        result.status ?? '',
                                    )) && (
                                    <p className="text-muted-foreground">
                                        {result.message}
                                    </p>
                                )}
                        </li>
                    ))}
                </ul>
                {videoMode && statusError && (
                    <div
                        role="alert"
                        className="space-y-2 text-sm text-destructive"
                    >
                        <p>{statusError}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRefreshStatus}
                        >
                            Perbarui Status
                        </Button>
                    </div>
                )}
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
                        onClick={() => {
                            close();

                            if (videoMode) {
                                router.visit('/admin/short-videos');
                            }
                        }}
                    >
                        {videoMode
                            ? 'Lihat Daftar Video'
                            : publishResult.completion_url
                              ? 'Daftar Berita'
                              : 'Selesai'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
