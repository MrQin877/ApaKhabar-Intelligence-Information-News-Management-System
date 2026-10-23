import { router, usePage } from '@inertiajs/react';
import { Check, ExternalLink, Video, X } from 'lucide-react';
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
import { PlatformIcon } from '@/components/publication-preview';
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
    video,
}: {
    result?: PublishResult;
    videoMode?: boolean;
    onRetry?: (platform: string) => void;
    retrying?: boolean;
    onDismiss?: () => void;
    statusError?: string;
    onRefreshStatus?: () => void;
    video?: {
        id?: number;
        title: string;
        thumbnail_url?: string | null;
        duration?: number;
    };
}) {
    const { publishResult: sharedResult } = usePage<{
        publishResult?: PublishResult | null;
    }>().props;
    const publishResult = result ?? sharedResult;
    const [dismissed, setDismissed] = useState<string | null>(null);

    if (!publishResult) {
        return null;
    }

    const entries = Object.entries(publishResult.results).filter(
        ([, value]) => !videoMode || value.status !== 'not_selected',
    );
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
            <DialogContent
                className={
                    videoMode
                        ? 'max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl'
                        : undefined
                }
            >
                <DialogHeader>
                    <DialogTitle>
                        {videoMode
                            ? 'Status Publikasi Video'
                            : 'Status Publikasi Berita'}
                    </DialogTitle>
                    <DialogDescription>
                        {videoMode
                            ? 'Status diperbarui otomatis. Kegagalan sosial tidak memengaruhi publikasi ApaKhabar.'
                            : publishResult.success
                              ? 'Berita berhasil diterbitkan ke semua platform yang dipilih.'
                              : 'Periksa hasil publikasi untuk setiap platform di bawah ini.'}
                    </DialogDescription>
                </DialogHeader>
                {videoMode && video && (
                    <div className="flex items-center gap-4 border-t border-border/70 pt-4">
                        {video.thumbnail_url ? (
                            <img
                                src={video.thumbnail_url}
                                alt=""
                                className="h-20 w-14 shrink-0 rounded-lg object-cover"
                            />
                        ) : (
                            <span className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                <Video aria-hidden="true" />
                            </span>
                        )}
                        <div className="min-w-0">
                            <p className="line-clamp-2 font-semibold">
                                {video.title}
                            </p>
                            {typeof video.duration === 'number' &&
                                Number.isFinite(video.duration) && (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Durasi {Math.floor(video.duration / 60)}
                                        :
                                        {String(
                                            Math.floor(video.duration % 60),
                                        ).padStart(2, '0')}
                                    </p>
                                )}
                        </div>
                    </div>
                )}
                <ul
                    className={
                        videoMode
                            ? 'divide-y divide-border/70 border-y border-border/70'
                            : 'space-y-3'
                    }
                >
                    {entries.map(([platform, result]) => (
                        <li
                            key={platform}
                            className={
                                videoMode ? 'py-4 text-sm' : 'space-y-1 text-sm'
                            }
                        >
                            {videoMode ? (
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-start gap-3">
                                        {[
                                            'website',
                                            'instagram',
                                            'facebook',
                                        ].includes(platform) && (
                                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center [&_img]:size-5 [&_svg]:size-5">
                                                <PlatformIcon
                                                    platform={
                                                        platform as
                                                            | 'website'
                                                            | 'instagram'
                                                            | 'facebook'
                                                    }
                                                />
                                            </span>
                                        )}
                                        <div className="min-w-0 space-y-1">
                                            <p className="font-medium">
                                                {names[platform] ?? platform}
                                            </p>
                                            {result.account && (
                                                <p className="truncate text-muted-foreground">
                                                    {result.account}
                                                </p>
                                            )}
                                            {publicationUrl(
                                                platform,
                                                result.status,
                                                result.permalink,
                                                video?.id,
                                            ) && (
                                                <a
                                                    href={
                                                        publicationUrl(
                                                            platform,
                                                            result.status,
                                                            result.permalink,
                                                            video?.id,
                                                        )!
                                                    }
                                                    target={
                                                        platform === 'website'
                                                            ? undefined
                                                            : '_blank'
                                                    }
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                                                >
                                                    Lihat Publikasi{' '}
                                                    <ExternalLink
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <span className="shrink-0">
                                        <VideoPublicationIndicator
                                            status={result.status}
                                        />
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 font-medium">
                                    {names[platform] ?? platform}:{' '}
                                    {result.success ? (
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
                            )}
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
                            {!result.success &&
                                (!videoMode ||
                                    ['failed', 'uncertain'].includes(
                                        result.status ?? '',
                                    )) && (
                                    <p className="mt-2 text-muted-foreground">
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
                        variant={
                            videoMode
                                ? 'outline'
                                : publishResult.success
                                  ? 'default'
                                  : 'outline'
                        }
                        className={
                            videoMode
                                ? 'border-primary text-foreground hover:bg-primary/10'
                                : undefined
                        }
                        onClick={() => {
                            close();

                            if (videoMode) {
                                router.visit('/admin/short-videos');
                            } else if (!publishResult.completion_url) {
                                router.visit('/admin/news');
                            }
                        }}
                    >
                        {videoMode ? 'Daftar Video' : 'Daftar Berita'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
