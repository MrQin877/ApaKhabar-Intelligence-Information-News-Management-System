import { CheckCircle2, LoaderCircle, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import {
    FacebookLoginControl,
    InstagramLoginControl,
} from '@/components/meta-auth-controls';
import {
    PublicationPreview,
    PlatformIcon,
    platformNames,
} from '@/components/publication-preview';
import type { PublicationPreviewData } from '@/components/publication-preview';
import { ShortPublicationPreview } from '@/components/short-publication-preview';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { MetaAuthConfig } from '@/lib/meta-auth';
import { metaRequest } from '@/lib/meta-auth';

export type PublishPlatformId = 'website' | 'facebook' | 'instagram';
export interface PublishPlatform {
    id: PublishPlatformId;
    name: string;
    account: string | null;
    status: 'connected' | 'disconnected' | 'expired';
    connect_url: string | null;
    updated_at?: string | null;
    publishable?: boolean;
}

const names = {
    website: 'Aplikasi',
    facebook: 'Facebook',
    instagram: 'Instagram',
};

export function publishLabel(selected: PublishPlatformId[]): string {
    if (selected.length === 3) {
        return 'Terbitkan ke semua platform';
    }

    if (!selected.length) {
        return 'Terbitkan';
    }

    return `Terbitkan ke ${selected.map((id) => names[id]).join(' & ')}`;
}

export function PublishNewsDialog({
    open,
    onOpenChange,
    platforms: initialPlatforms,
    metaAuth,
    selected,
    onSelectionChange,
    processing,
    contentReady = true,
    requireReviewConfirmation = false,
    error,
    onPublish,
    onPreparePreview,
    videoMode = false,
}: {
    videoMode?: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    platforms: PublishPlatform[];
    metaAuth: MetaAuthConfig;
    selected: PublishPlatformId[];
    onSelectionChange: (selected: PublishPlatformId[]) => void;
    processing: boolean;
    contentReady?: boolean;
    requireReviewConfirmation?: boolean;
    error?: string;
    onPublish: (token: string) => void;
    onPreparePreview: () => Promise<PublicationPreviewData>;
}) {
    const [livePlatforms, setLivePlatforms] = useState<
        PublishPlatform[] | null
    >(null);
    const [showPreview, setShowPreview] = useState(false);
    const [reviewConfirmation, setReviewConfirmation] = useState<string | null>(
        null,
    );
    const [preview, setPreview] = useState<PublicationPreviewData | null>(null);
    const [preparing, setPreparing] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [active, setActive] = useState<PublishPlatformId>('website');
    const [imageStates, setImageStates] = useState<
        Partial<Record<PublishPlatformId, 'ready' | 'failed'>>
    >({});
    const displayNames = videoMode
        ? {
              website: 'ApaKhabar',
              instagram: 'Instagram',
              facebook: 'Halaman Facebook',
          }
        : platformNames;
    const locked = processing || preparing;
    const platforms = livePlatforms ?? initialPlatforms;
    useEffect(() => {
        if (!open) {
            return;
        }

        let disposed = false;
        const refresh = () => {
            void metaRequest<{ platforms: PublishPlatform[] }>(
                '/admin/social/connections',
            )
                .then((result) => {
                    if (!disposed) {
                        setLivePlatforms(result.platforms);
                    }
                })
                .catch(() => {
                    /* Keep the last server-provided state on temporary network failures. */
                });
        };
        refresh();
        window.addEventListener('focus', refresh);

        return () => {
            window.removeEventListener('focus', refresh);
            disposed = true;
        };
    }, [open]);
    const available = platforms
        .filter(
            (platform) =>
                platform.status === 'connected' &&
                platform.publishable !== false,
        )
        .map((platform) => platform.id);
    const selection = videoMode
        ? (['website', 'instagram', 'facebook'] as const).filter(
              (id) => id === 'website' || selected.includes(id),
          )
        : selected;
    const reviewKey = preview?.token
        ? `${preview.token}:${selection.join(',')}`
        : null;
    const confirmingReview =
        requireReviewConfirmation &&
        showPreview &&
        reviewKey !== null &&
        reviewConfirmation === reviewKey;
    const issues = selection.flatMap((id) => {
        const platform = platforms.find((item) => item.id === id);

        return [
            ...(platform?.status !== 'connected'
                ? [`${displayNames[id]} belum terhubung.`]
                : platform.publishable === false
                  ? [`${displayNames[id]} belum siap. Hubungi administrator.`]
                  : []),
            ...(preview?.issues[id] ?? []),
            ...(preview?.images[id] && imageStates[id] !== 'ready'
                ? [
                      `Gambar ${displayNames[id]} ${imageStates[id] === 'failed' ? 'belum siap. Kembali dan periksa gambar.' : 'sedang disiapkan.'}`,
                  ]
                : []),
        ];
    });
    async function prepare() {
        setReviewConfirmation(null);
        setPreparing(true);
        setPreviewError('');
        setPreview(null);
        setImageStates({});

        try {
            const data = await onPreparePreview();

            if (typeof data.token !== 'string' || !data.token.trim()) {
                throw new Error('Pratinjau belum siap. Silakan coba lagi.');
            }

            setPreview(data);
            setActive(selection[0]);
            setShowPreview(true);
        } catch (error) {
            setPreviewError(
                error instanceof Error
                    ? error.message
                    : 'Pratinjau belum siap. Silakan coba lagi.',
            );
        } finally {
            setPreparing(false);
        }
    }
    const allSelected =
        available.length > 0 && selection.length === available.length;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!locked) {
                    setShowPreview(false);
                    setReviewConfirmation(null);
                    onOpenChange(next);
                }
            }}
        >
            <DialogContent
                closeDisabled={locked}
                className={`flex flex-col gap-0 rounded-2xl p-0 ${showPreview && videoMode ? 'dark max-h-[calc(100dvh-1.5rem)] overflow-hidden border-white/15 bg-zinc-950 text-white sm:max-h-[94dvh] sm:max-w-[760px]' : showPreview ? 'max-h-[90dvh] overflow-y-auto [scrollbar-gutter:stable_both-edges] sm:max-w-[900px]' : 'max-h-[calc(100dvh-2rem)] overflow-hidden sm:max-w-xl'}`}
                overlayClassName="bg-black/45 backdrop-blur-sm"
            >
                <DialogHeader
                    className={`shrink-0 px-6 text-left sm:px-7 ${showPreview ? 'pt-4 pb-2' : 'pt-7 pb-5'}`}
                >
                    <DialogTitle className="pr-6 text-xl">
                        {showPreview
                            ? 'Pratinjau Publikasi'
                            : videoMode
                              ? 'Publikasikan Video Pendek'
                              : 'Terbitkan Berita'}
                    </DialogTitle>
                    <DialogDescription className="leading-6">
                        {showPreview
                            ? videoMode
                                ? 'Periksa tampilan video sebelum diterbitkan.'
                                : 'Periksa tampilan berita sebelum diterbitkan.'
                            : videoMode
                              ? 'Pilih platform tempat video ini akan diterbitkan.'
                              : 'Pilih platform tempat berita ini akan diterbitkan.'}
                    </DialogDescription>
                </DialogHeader>
                <div
                    className={
                        showPreview && videoMode
                            ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain'
                            : 'contents'
                    }
                >
                    {showPreview && preview ? (
                        <>
                            {videoMode ? (
                                <ShortPublicationPreview
                                    data={preview}
                                    selected={selection}
                                    platforms={platforms}
                                />
                            ) : (
                                <>
                                    <div className="shrink-0 space-y-2 border-b px-6 pb-2 sm:px-7">
                                        <p className="text-sm">
                                            Akan diterbitkan ke:{' '}
                                            <strong>
                                                {selection
                                                    .map(
                                                        (id) =>
                                                            displayNames[id],
                                                    )
                                                    .join(' / ')}
                                            </strong>
                                        </p>
                                        <div
                                            role="tablist"
                                            aria-label="Platform publikasi"
                                            className="flex gap-2 overflow-x-auto"
                                        >
                                            {selection.map((id) => (
                                                <Button
                                                    key={id}
                                                    type="button"
                                                    role="tab"
                                                    id={`preview-tab-${id}`}
                                                    aria-controls={`preview-panel-${id}`}
                                                    aria-selected={
                                                        active === id
                                                    }
                                                    variant={
                                                        active === id
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    className="min-h-11 shrink-0"
                                                    onClick={() =>
                                                        setActive(id)
                                                    }
                                                >
                                                    <PlatformIcon
                                                        platform={id}
                                                    />
                                                    {displayNames[id]}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid min-h-[calc(clamp(100px,20dvh,180px)+180px)] shrink-0 items-start bg-muted/20 px-4 py-3">
                                        {selection.map((id) => (
                                            <div
                                                key={id}
                                                role="tabpanel"
                                                id={`preview-panel-${id}`}
                                                aria-labelledby={`preview-tab-${id}`}
                                                className={`col-start-1 row-start-1 min-w-0 ${active !== id ? 'pointer-events-none invisible' : ''}`}
                                                aria-hidden={active !== id}
                                                inert={active !== id}
                                            >
                                                {
                                                    <PublicationPreview
                                                        data={preview}
                                                        platform={id}
                                                        accountName={
                                                            platforms.find(
                                                                (platform) =>
                                                                    platform.id ===
                                                                        id &&
                                                                    platform.status ===
                                                                        'connected',
                                                            )?.account
                                                        }
                                                        onImageLoad={() =>
                                                            setImageStates(
                                                                (states) => ({
                                                                    ...states,
                                                                    [id]: 'ready',
                                                                }),
                                                            )
                                                        }
                                                        onImageError={() =>
                                                            setImageStates(
                                                                (states) => ({
                                                                    ...states,
                                                                    [id]: 'failed',
                                                                }),
                                                            )
                                                        }
                                                    />
                                                }
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                            <div
                                className="shrink-0 bg-background px-6 py-2 text-sm"
                                aria-live="polite"
                            >
                                {issues.length ? (
                                    <ul className="space-y-1 text-destructive">
                                        {issues.map((issue) => (
                                            <li key={issue}>{issue}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                                        <CheckCircle2
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                        Siap diterbitkan
                                    </p>
                                )}
                                {error && (
                                    <p
                                        role="alert"
                                        className="text-destructive"
                                    >
                                        {error}
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="min-h-0 space-y-3 overflow-y-auto px-6 pb-6 sm:px-7">
                            {previewError && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {previewError}
                                </p>
                            )}
                            <div className="mb-4 flex items-center gap-2.5">
                                <Checkbox
                                    id="publish-all"
                                    checked={
                                        allSelected
                                            ? true
                                            : selection.length
                                              ? 'indeterminate'
                                              : false
                                    }
                                    disabled={locked || !available.length}
                                    onCheckedChange={(checked) =>
                                        onSelectionChange(
                                            checked === true
                                                ? available
                                                : videoMode
                                                  ? ['website']
                                                  : [],
                                        )
                                    }
                                />
                                <Label
                                    htmlFor="publish-all"
                                    className="cursor-pointer"
                                >
                                    Pilih semua
                                </Label>
                                <span className="ml-auto text-xs text-muted-foreground">
                                    {selection.length} dipilih
                                </span>
                            </div>
                            {platforms.map((platform) => {
                                const connected =
                                    platform.status === 'connected';
                                const expired = platform.status === 'expired';
                                const checked = selection.includes(platform.id);
                                const unavailable = preparing || processing;
                                const selectable =
                                    !unavailable &&
                                    !(videoMode && platform.id === 'website') &&
                                    (checked ||
                                        (connected &&
                                            platform.publishable !== false)) &&
                                    !processing;
                                const toggleSelection = (value: boolean) => {
                                    if (!selectable) {
                                        return;
                                    }

                                    onSelectionChange(
                                        value
                                            ? [...selection, platform.id]
                                            : selection.filter(
                                                  (id) => id !== platform.id,
                                              ),
                                    );
                                };
                                const title = videoMode
                                    ? displayNames[platform.id]
                                    : platform.id === 'website'
                                      ? 'Aplikasi'
                                      : platform.name;
                                const inlineStatus =
                                    platform.id !== 'website' &&
                                    !connected &&
                                    !expired;

                                return (
                                    <section
                                        key={platform.id}
                                        aria-label={title}
                                        className={`rounded-xl border p-4 transition-colors ${selectable ? 'cursor-pointer' : ''} ${checked ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}
                                        onClick={(event) => {
                                            if (
                                                (
                                                    event.target as HTMLElement
                                                ).closest(
                                                    'button, label, a, input',
                                                )
                                            ) {
                                                return;
                                            }

                                            toggleSelection(!checked);
                                        }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    {platform.id ===
                                                        'website' && (
                                                        <AppLogoIcon
                                                            aria-hidden="true"
                                                            className="size-7 shrink-0"
                                                        />
                                                    )}
                                                    {platform.id ===
                                                        'facebook' && (
                                                        <PlatformIcon platform="facebook" />
                                                    )}
                                                    {platform.id ===
                                                        'instagram' && (
                                                        <PlatformIcon platform="instagram" />
                                                    )}
                                                    {connected ? (
                                                        <Label
                                                            htmlFor={`publish-${platform.id}`}
                                                            className={`${selectable ? 'cursor-pointer' : ''} leading-6`}
                                                        >
                                                            {title}
                                                        </Label>
                                                    ) : (
                                                        <p className="text-sm leading-6 font-medium">
                                                            {title}
                                                        </p>
                                                    )}
                                                    {inlineStatus && (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-normal text-red-700/80 dark:text-red-300/80">
                                                            <span
                                                                aria-hidden="true"
                                                                className="size-1.5 shrink-0 rounded-full bg-current"
                                                            />
                                                            Belum terhubung
                                                        </span>
                                                    )}
                                                </div>
                                                {platform.id !== 'website' &&
                                                    platform.account && (
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {platform.account}
                                                        </p>
                                                    )}
                                                {!inlineStatus && (
                                                    <p
                                                        className={`mt-1 flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-700 dark:text-emerald-400' : expired ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}
                                                    >
                                                        <span
                                                            aria-hidden="true"
                                                            className="size-1.5 shrink-0 rounded-full bg-current"
                                                        />
                                                        {connected
                                                            ? platform.id ===
                                                              'website'
                                                                ? videoMode
                                                                    ? 'Periksa tampilan video sebelum diterbitkan.'
                                                                    : 'Periksa tampilan berita sebelum diterbitkan.'
                                                                : 'Terhubung'
                                                            : expired
                                                              ? 'Koneksi perlu diperbarui'
                                                              : 'Belum terhubung'}
                                                    </p>
                                                )}
                                            </div>
                                            {(connected || checked) && (
                                                <Checkbox
                                                    id={`publish-${platform.id}`}
                                                    className="mt-1"
                                                    checked={checked}
                                                    disabled={
                                                        (videoMode &&
                                                            platform.id ===
                                                                'website') ||
                                                        unavailable ||
                                                        processing ||
                                                        (!checked &&
                                                            platform.publishable ===
                                                                false)
                                                    }
                                                    onCheckedChange={(value) =>
                                                        toggleSelection(
                                                            value === true,
                                                        )
                                                    }
                                                />
                                            )}
                                        </div>
                                        {connected &&
                                            platform.publishable === false && (
                                                <p className="mt-2 text-xs text-destructive">
                                                    Konfigurasi media belum
                                                    tersedia. Hubungi
                                                    administrator.
                                                </p>
                                            )}
                                        {!connected &&
                                            platform.id !== 'website' && (
                                                <div className="mt-2.5 sm:ml-14">
                                                    {platform.id ===
                                                    'facebook' ? (
                                                        <FacebookLoginControl
                                                            config={metaAuth}
                                                            disabled={locked}
                                                            onConnected={
                                                                setLivePlatforms
                                                            }
                                                        />
                                                    ) : (
                                                        <InstagramLoginControl
                                                            config={metaAuth}
                                                            disabled={locked}
                                                            onConnected={
                                                                setLivePlatforms
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            )}
                                    </section>
                                );
                            })}
                            {error && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {error}
                                </p>
                            )}
                            {!selection.length && (
                                <p className="text-xs text-muted-foreground">
                                    Pilih setidaknya satu platform untuk
                                    menerbitkan berita.
                                </p>
                            )}
                            {!contentReady && (
                                <p className="text-xs text-muted-foreground">
                                    Lengkapi konten berita sebelum menerbitkan.
                                </p>
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter className="sticky bottom-0 z-10 shrink-0 border-t bg-background px-6 py-3 sm:flex-wrap sm:justify-between sm:px-7">
                    {confirmingReview && (
                        <div role="status" className="w-full basis-full">
                            <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
                                Dengan menerbitkan, Anda menyetujui fakta,
                                sumber, dan versi draf yang telah Anda tinjau.
                                Berita dikirim ke platform yang dipilih.
                            </p>
                        </div>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={locked}
                        onClick={() => {
                            if (confirmingReview) {
                                setReviewConfirmation(null);
                            } else if (showPreview) {
                                setShowPreview(false);
                                setReviewConfirmation(null);
                            } else {
                                setShowPreview(false);
                                setReviewConfirmation(null);
                                onOpenChange(false);
                            }
                        }}
                    >
                        {showPreview ? 'Kembali' : 'Batal'}
                    </Button>
                    <Button
                        type="button"
                        disabled={
                            locked ||
                            !contentReady ||
                            !selection.length ||
                            (showPreview &&
                                (!preview?.token?.trim() || issues.length > 0))
                        }
                        onClick={() => {
                            if (locked || !contentReady || !selection.length) {
                                return;
                            }

                            if (!showPreview) {
                                void prepare();

                                return;
                            }

                            if (!preview?.token?.trim() || issues.length) {
                                return;
                            }

                            if (
                                requireReviewConfirmation &&
                                !confirmingReview
                            ) {
                                setReviewConfirmation(reviewKey);

                                return;
                            }

                            onPublish(preview.token);
                        }}
                        className="h-auto min-h-11 bg-brand-600 whitespace-normal text-white hover:bg-brand-700"
                    >
                        {processing ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <Send />
                        )}
                        {preparing
                            ? 'Menyiapkan pratinjau...'
                            : processing
                              ? 'Menerbitkan...'
                              : confirmingReview
                                ? 'Ya, Terbitkan'
                                : showPreview
                                  ? 'Terbitkan Sekarang'
                                  : 'Lihat Pratinjau'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
