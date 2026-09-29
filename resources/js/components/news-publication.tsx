import { Link, router } from '@inertiajs/react';
import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
    PublishPlatform,
    PublishPlatformId,
} from '@/components/publish-news-dialog';
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
import { metaRequest } from '@/lib/meta-auth';

export type PublicationResults = Partial<
    Record<'application' | 'facebook' | 'instagram', { success: boolean }>
>;
const platforms = [
    {
        id: 'instagram',
        key: 'instagram',
        name: 'Instagram',
        icon: '/images/integrations/instagram.svg',
    },
    {
        id: 'facebook',
        key: 'facebook',
        name: 'Facebook',
        icon: '/images/integrations/facebook.png',
    },
    {
        id: 'website',
        key: 'application',
        name: 'Aplikasi',
        icon: '/images/brands/aplikasi-white.svg',
    },
] as const;

export function PublicationIndicators({
    results,
}: {
    results: PublicationResults;
}) {
    return (
        <div className="flex items-center gap-3" aria-label="Status penerbitan">
            {platforms.map((platform) => {
                const result = results[platform.key];

                if (typeof result?.success !== 'boolean') {
                    return null;
                }

                const label = `${platform.name}: ${result.success ? 'Berhasil' : 'Gagal'}`;

                return (
                    <span
                        key={platform.id}
                        className="inline-flex items-center gap-1"
                        title={label}
                        aria-label={label}
                    >
                        <img
                            src={platform.icon}
                            alt=""
                            className={`size-5 object-contain ${platform.id === 'website' ? 'rounded bg-primary p-0.5' : ''}`}
                        />
                        {result.success ? (
                            <Check
                                className="size-3 text-green-600 dark:text-green-400"
                                aria-hidden
                            />
                        ) : (
                            <X
                                className="size-3 text-destructive"
                                aria-hidden
                            />
                        )}
                    </span>
                );
            })}
        </div>
    );
}

export function RetryPublicationDialog({
    open,
    onOpenChange,
    url,
    results,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    url: string;
    results: PublicationResults;
}) {
    const [connections, setConnections] = useState<PublishPlatform[]>([]);
    const [selected, setSelected] = useState<PublishPlatformId[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const failed = platforms.filter(
        (platform) => results[platform.key]?.success === false,
    );
    useEffect(() => {
        if (!open) {
            return;
        }

        let disposed = false;
        const refresh = () => {
            setLoading(true);
            void metaRequest<{ platforms: PublishPlatform[] }>(
                '/admin/social/connections',
            )
                .then((data) => {
                    if (!disposed) {
                        setConnections(data.platforms);
                        setError(null);
                    }
                })
                .catch(() => {
                    if (!disposed) {
                        setConnections([]);
                        setError(
                            'Status koneksi tidak dapat dimuat. Silakan coba lagi.',
                        );
                    }
                })
                .finally(() => {
                    if (!disposed) {
                        setLoading(false);
                    }
                });
        };
        setSelected([]);
        refresh();
        window.addEventListener('focus', refresh);

        return () => {
            disposed = true;
            window.removeEventListener('focus', refresh);
        };
    }, [open]);
    const connected = (id: PublishPlatformId) =>
        id === 'website' ||
        connections.some((p) => p.id === id && p.status === 'connected');
    const eligible = selected.filter(connected);
    async function retry() {
        setBusy(true);
        setError(null);

        try {
            const response = await metaRequest<{ success: boolean }>(url, {
                platforms: eligible,
            });

            if (response.success) {
                onOpenChange(false);
            } else {
                setError(
                    'Sebagian platform masih gagal. Status penerbitan telah diperbarui.',
                );
            }

            router.reload({ only: ['items', 'counts', 'publishPlatforms'] });
            setSelected([]);
        } catch {
            setError(
                'Penerbitan ulang gagal. Periksa koneksi akun dan coba lagi.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!busy) {
                    onOpenChange(value);
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ulangi Penerbitan</DialogTitle>
                    <DialogDescription>
                        Pilih platform yang gagal untuk diterbitkan ulang.
                        Platform yang berhasil tidak akan diulangi.
                    </DialogDescription>
                </DialogHeader>
                {loading && (
                    <p role="status" className="text-sm text-muted-foreground">
                        Memeriksa koneksi akun…
                    </p>
                )}
                <div className="space-y-3">
                    {failed.map((platform) => (
                        <div
                            key={platform.id}
                            className="space-y-2 rounded-lg border p-3"
                        >
                            <label className="flex items-center gap-3 text-sm font-medium">
                                <Checkbox
                                    disabled={
                                        busy ||
                                        loading ||
                                        !connected(platform.id)
                                    }
                                    checked={eligible.includes(platform.id)}
                                    onCheckedChange={(checked) =>
                                        setSelected((current) =>
                                            checked
                                                ? [...current, platform.id]
                                                : current.filter(
                                                      (id) =>
                                                          id !== platform.id,
                                                  ),
                                        )
                                    }
                                />
                                <img
                                    src={platform.icon}
                                    alt=""
                                    className={`size-5 object-contain ${platform.id === 'website' ? 'rounded bg-primary p-0.5' : ''}`}
                                />
                                {platform.name}
                            </label>
                            {!loading && !connected(platform.id) && (
                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                    Akun media sosial belum terhubung.{' '}
                                    <Link
                                        href="/settings/integration"
                                        className="underline underline-offset-2"
                                    >
                                        Klik di sini
                                    </Link>{' '}
                                    untuk menghubungkan akun.
                                </p>
                            )}
                        </div>
                    ))}
                </div>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => onOpenChange(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        disabled={busy || loading || !eligible.length}
                        onClick={() => void retry()}
                    >
                        {busy ? 'Menerbitkan…' : 'Ulangi Penerbitan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
