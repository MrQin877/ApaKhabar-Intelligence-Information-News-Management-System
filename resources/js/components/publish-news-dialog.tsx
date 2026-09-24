import { CircleUserRound, Globe2, LoaderCircle, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    FacebookLoginControl,
    InstagramLoginControl,
} from '@/components/meta-auth-controls';
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
}

const icons = {
    website: Globe2,
    facebook: CircleUserRound,
    instagram: CircleUserRound,
};
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
    error,
    onPublish,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    platforms: PublishPlatform[];
    metaAuth: MetaAuthConfig;
    selected: PublishPlatformId[];
    onSelectionChange: (selected: PublishPlatformId[]) => void;
    processing: boolean;
    error?: string;
    onPublish: () => void;
}) {
    const [livePlatforms, setLivePlatforms] = useState<
        PublishPlatform[] | null
    >(null);
    const [confirmWebsite, setConfirmWebsite] = useState(false);
    const platforms = livePlatforms ?? initialPlatforms;
    useEffect(() => {
        if (!open) {
            return;
        }

        let disposed = false;
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

        return () => {
            disposed = true;
        };
    }, [open]);
    const available = platforms
        .filter((platform) => platform.status === 'connected')
        .map((platform) => platform.id);
    const selection = selected.filter((id) => available.includes(id));
    const allSelected =
        available.length > 0 && selection.length === available.length;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!processing) {
                    setConfirmWebsite(false);
                    onOpenChange(next);
                }
            }}
        >
            <DialogContent
                closeDisabled={processing}
                className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-xl"
                overlayClassName="bg-black/45 backdrop-blur-sm"
            >
                <DialogHeader className="px-6 pt-7 pb-5 text-left sm:px-7">
                    <DialogTitle className="pr-6 text-xl">
                        {confirmWebsite
                            ? 'Konfirmasi penerbitan'
                            : 'Terbitkan Berita'}
                    </DialogTitle>
                    <DialogDescription className="leading-6">
                        {confirmWebsite
                            ? 'Berita akan diterbitkan di website dan aplikasi ApaKhabar.'
                            : 'Pilih platform tempat berita ini akan diterbitkan.'}
                    </DialogDescription>
                </DialogHeader>
                {confirmWebsite ? (
                    <div className="space-y-3 px-6 pb-6 sm:px-7">
                        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
                            Pastikan konten sudah benar sebelum diterbitkan.
                        </p>
                        {error && (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {error}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3 px-6 pb-6 sm:px-7">
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
                                disabled={processing || !available.length}
                                onCheckedChange={(checked) =>
                                    onSelectionChange(
                                        checked === true ? available : [],
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
                            const Icon = icons[platform.id];
                            const connected = platform.status === 'connected';
                            const expired = platform.status === 'expired';
                            const checked = selection.includes(platform.id);
                            const title =
                                platform.id === 'website'
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
                                    className={`rounded-xl border p-4 transition-colors ${checked ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span
                                            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${platform.id === 'website' ? 'bg-primary/10 text-primary' : platform.id === 'facebook' ? 'bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground'}`}
                                        >
                                            {platform.id === 'instagram' ? (
                                                <img
                                                    src="/images/brands/instagram.png"
                                                    alt=""
                                                    className="size-6"
                                                />
                                            ) : (
                                                <Icon className="size-5" />
                                            )}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                {connected ? (
                                                    <Label
                                                        htmlFor={`publish-${platform.id}`}
                                                        className="cursor-pointer leading-6"
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
                                                            ? 'Berita akan diterbitkan di website dan aplikasi ApaKhabar.'
                                                            : 'Terhubung'
                                                        : expired
                                                          ? 'Koneksi perlu diperbarui'
                                                          : 'Belum terhubung'}
                                                </p>
                                            )}
                                        </div>
                                        {connected && (
                                            <Checkbox
                                                id={`publish-${platform.id}`}
                                                className="mt-1"
                                                checked={checked}
                                                disabled={processing}
                                                onCheckedChange={(value) =>
                                                    onSelectionChange(
                                                        value === true
                                                            ? [
                                                                  ...selection,
                                                                  platform.id,
                                                              ]
                                                            : selection.filter(
                                                                  (id) =>
                                                                      id !==
                                                                      platform.id,
                                                              ),
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                    {!connected &&
                                        platform.id !== 'website' && (
                                            <div className="mt-2.5 sm:ml-14">
                                                {platform.id === 'facebook' ? (
                                                    <FacebookLoginControl
                                                        config={metaAuth}
                                                        disabled={processing}
                                                        onConnected={
                                                            setLivePlatforms
                                                        }
                                                    />
                                                ) : (
                                                    <InstagramLoginControl
                                                        config={metaAuth}
                                                        disabled={processing}
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
                                Pilih setidaknya satu platform untuk menerbitkan
                                berita.
                            </p>
                        )}
                    </div>
                )}
                <DialogFooter className="border-t bg-muted/20 px-6 py-4 sm:px-7">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={processing}
                        onClick={() => {
                            if (confirmWebsite) {
                                setConfirmWebsite(false);
                            } else {
                                setConfirmWebsite(false);
                                onOpenChange(false);
                            }
                        }}
                    >
                        {confirmWebsite ? 'Kembali' : 'Batal'}
                    </Button>
                    <Button
                        type="button"
                        disabled={processing || !selection.length}
                        onClick={() => {
                            if (processing || !selection.length) {
                                return;
                            }

                            if (
                                selection.includes('website') &&
                                !confirmWebsite
                            ) {
                                setConfirmWebsite(true);

                                return;
                            }

                            setConfirmWebsite(false);
                            onPublish();
                        }}
                        className="h-auto min-h-9 bg-brand-600 whitespace-normal text-white hover:bg-brand-700"
                    >
                        {processing ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <Send />
                        )}
                        {processing
                            ? 'Menerbitkan...'
                            : confirmWebsite
                              ? 'Ya, Terbitkan'
                              : selection.includes('website')
                                ? 'Konfirmasi penerbitan'
                                : publishLabel(selection)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
