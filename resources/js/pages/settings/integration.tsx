import { Head } from '@inertiajs/react';
import { Info, LoaderCircle } from 'lucide-react';
import { useCallback, useState } from 'react';
import { FeedbackToast } from '@/components/feedback-toast';
import type { Feedback } from '@/components/feedback-toast';
import Heading from '@/components/heading';
import type { PublishPlatform } from '@/components/publish-news-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SettingsWrapper } from '@/layouts/settings/setting-wrapper';
import { metaRequest } from '@/lib/meta-auth';

type Selection = {
    ticket: string;
    platform: 'facebook' | 'instagram';
    pages: { id: string; name: string; account_name: string }[];
} | null;

function connectionFailure(error: unknown): string {
    const message = error instanceof Error ? error.message : '';

    if (/kedaluwarsa|expired|csrf|419/i.test(message)) {
        return 'Sesi atau pilihan akun sudah kedaluwarsa. Muat ulang halaman, lalu hubungkan kembali akun Anda.';
    }

    if (/belum dikonfigurasi/i.test(message)) {
        return 'Pengaturan koneksi belum lengkap. Silakan hubungi administrator.';
    }

    if (/tidak tersedia|izin/i.test(message)) {
        return 'Akun atau Halaman tidak tersedia, atau izin aksesnya sudah berakhir. Pastikan Anda memiliki akses, lalu hubungkan kembali.';
    }

    if (error instanceof TypeError) {
        return 'Tidak dapat menghubungi server. Periksa koneksi internet Anda, lalu coba lagi.';
    }

    return 'Koneksi belum dapat diperbarui. Silakan coba lagi. Jika masalah berlanjut, hubungi administrator.';
}

export default function Integration({
    platforms: initialPlatforms,
    selection: initialSelection,
    connectionMessage,
    connectionPlatform,
}: {
    platforms: PublishPlatform[];
    selection: Selection;
    connectionMessage: string | null;
    connectionPlatform: 'facebook' | 'instagram' | null;
}) {
    const [platforms, setPlatforms] = useState(initialPlatforms);
    const [selection, setSelection] = useState(initialSelection);
    const [pageId, setPageId] = useState('');
    const [disconnect, setDisconnect] = useState<PublishPlatform | null>(null);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<
        (Feedback & { platform: string }) | null
    >(() =>
        connectionMessage
            ? {
                  message: connectionMessage,
                  platform:
                      connectionPlatform ??
                      initialSelection?.platform ??
                      'facebook',
                  variant: initialSelection ? 'info' : 'error',
              }
            : null,
    );
    const dismissFeedback = useCallback(() => setFeedback(null), []);

    async function update(
        path: string,
        payload: Record<string, string>,
        failure: string,
        platform: string,
    ) {
        setBusy(true);
        setFeedback(null);

        try {
            const result = await metaRequest<{ platforms: PublishPlatform[] }>(
                path,
                payload,
            );
            setPlatforms(result.platforms.filter((p) => p.id !== 'website'));
            setDisconnect(null);
            setSelection(null);
        } catch (error) {
            setFeedback({
                message: `${failure} ${connectionFailure(error)}`,
                variant: 'error',
                platform,
            });
        } finally {
            setBusy(false);
        }
    }

    async function cancelSelection() {
        const platform = selection?.platform ?? 'facebook';
        setBusy(true);
        setFeedback(null);

        try {
            await metaRequest('/admin/social/meta/cancel', {});
            setSelection(null);
            setFeedback({
                message:
                    'Pemilihan dibatalkan. Koneksi sebelumnya tidak berubah.',
                variant: 'info',
                platform,
            });
        } catch {
            setFeedback({
                message: 'Pemilihan tidak dapat dibatalkan. Silakan coba lagi.',
                variant: 'error',
                platform,
            });
        } finally {
            setBusy(false);
        }
    }

    return (
        <SettingsWrapper
            title="Integrasi Media Sosial"
            breadcrumbs={[
                {
                    title: 'Integrasi Media Sosial',
                    href: '/settings/integration',
                },
            ]}
        >
            <Head title="Integrasi Media Sosial" />
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Integrasi Media Sosial"
                    description="Hubungkan akun melalui Meta. Kata sandi Facebook dan Instagram hanya dimasukkan di situs resmi Meta."
                />
                <aside
                    aria-label="Persyaratan akun media sosial"
                    className="flex gap-3 rounded-lg border border-info-border bg-info-bg p-4 text-sm text-info-text"
                >
                    <Info
                        className="mt-0.5 size-4 shrink-0 text-info-text"
                        aria-hidden="true"
                    />
                    <div className="space-y-3 leading-relaxed">
                        <div className="space-y-2">
                            <p className="font-medium text-foreground">
                                Sebelum menghubungkan akun:
                            </p>
                            <ul className="list-disc space-y-1.5 pl-5 text-foreground">
                                <li>
                                    Pastikan akun Facebook memiliki akses ke
                                    Halaman Facebook yang dikelola.
                                </li>
                                <li>
                                    Untuk Instagram, gunakan akun Profesional
                                    (Bisnis atau Kreator) yang terhubung ke
                                    Halaman Facebook tersebut.
                                </li>
                            </ul>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Jika persyaratan belum terpenuhi, proses koneksi
                            atau penerbitan mungkin tidak berhasil.
                        </p>
                    </div>
                </aside>
                {platforms.map((platform) => {
                    const connected = platform.status === 'connected';

                    return (
                        <section
                            key={platform.id}
                            aria-label={platform.name}
                            className="space-y-4 rounded-xl border bg-card p-5"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="flex items-center gap-3 font-semibold">
                                    <img
                                        src={
                                            platform.id === 'facebook'
                                                ? '/images/integrations/facebook.png'
                                                : '/images/integrations/instagram.svg'
                                        }
                                        alt=""
                                        width={24}
                                        height={24}
                                        className="size-6 shrink-0 object-contain"
                                        aria-hidden="true"
                                    />
                                    {platform.name}
                                </h2>
                                <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${connected ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}
                                >
                                    {connected ? 'Connected' : 'Not connected'}
                                </span>
                            </div>
                            {platform.account && (
                                <p className="text-sm">{platform.account}</p>
                            )}
                            {platform.updated_at && (
                                <p className="text-xs text-muted-foreground">
                                    Terakhir diperbarui:{' '}
                                    <time dateTime={platform.updated_at}>
                                        {new Date(
                                            platform.updated_at,
                                        ).toLocaleString()}
                                    </time>
                                </p>
                            )}
                            {platform.status === 'expired' && (
                                <p className="text-sm text-destructive">
                                    Koneksi kedaluwarsa atau dicabut. Hubungkan
                                    kembali untuk menerbitkan.
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {connected ? (
                                    <>
                                        <Button
                                            disabled={
                                                busy || !platform.connect_url
                                            }
                                            variant="outline"
                                            onClick={() => {
                                                window.location.assign(
                                                    platform.connect_url!,
                                                );
                                            }}
                                        >
                                            Switch account
                                        </Button>
                                        <Button
                                            disabled={
                                                busy || !platform.connect_url
                                            }
                                            variant="outline"
                                            onClick={() => {
                                                window.location.assign(
                                                    platform.connect_url!,
                                                );
                                            }}
                                        >
                                            Reconnect
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        disabled={busy || !platform.connect_url}
                                        onClick={() => {
                                            window.location.assign(
                                                platform.connect_url!,
                                            );
                                        }}
                                    >
                                        Connect {platform.name}
                                    </Button>
                                )}
                                {(connected ||
                                    platform.status === 'expired') && (
                                    <Button
                                        variant="destructive"
                                        disabled={busy}
                                        onClick={() => {
                                            setFeedback(null);
                                            setDisconnect(platform);
                                        }}
                                    >
                                        Disconnect
                                    </Button>
                                )}
                            </div>
                            <FeedbackToast
                                inline
                                feedback={
                                    feedback?.platform === platform.id
                                        ? feedback
                                        : null
                                }
                                onDismiss={dismissFeedback}
                            />
                            {!platform.connect_url && (
                                <p className="text-xs text-muted-foreground">
                                    Login Meta belum dikonfigurasi. Hubungi
                                    administrator.
                                </p>
                            )}
                        </section>
                    );
                })}
            </div>
            <Dialog
                open={selection !== null}
                onOpenChange={(open) => {
                    if (!open && !busy) {
                        void cancelSelection();
                    }
                }}
            >
                <DialogContent closeDisabled={busy}>
                    <DialogHeader>
                        <DialogTitle>
                            {selection?.platform === 'instagram'
                                ? 'Pilih akun Instagram'
                                : 'Pilih Halaman Facebook'}
                        </DialogTitle>
                        <DialogDescription>
                            Koneksi saat ini diganti hanya setelah Anda
                            menyimpan pilihan baru.
                        </DialogDescription>
                    </DialogHeader>
                    <label
                        htmlFor="facebook-page"
                        className="text-sm font-medium"
                    >
                        {selection?.platform === 'instagram'
                            ? 'Akun Instagram dan Halaman tertaut'
                            : 'Halaman'}
                    </label>
                    <select
                        id="facebook-page"
                        className="w-full rounded-md border bg-background p-2"
                        value={pageId}
                        onChange={(e) => setPageId(e.target.value)}
                        disabled={busy}
                    >
                        <option value="">Pilih akun</option>
                        {selection?.pages.map((page) => (
                            <option key={page.id} value={page.id}>
                                {selection?.platform === 'instagram'
                                    ? `${page.account_name} (${page.name})`
                                    : page.name}
                            </option>
                        ))}
                    </select>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => void cancelSelection()}
                        >
                            Batal
                        </Button>
                        <Button
                            disabled={busy || !pageId}
                            onClick={() => {
                                if (selection) {
                                    void update(
                                        '/admin/social/meta/account',
                                        {
                                            ticket: selection.ticket,
                                            page_id: pageId,
                                        },
                                        selection.platform === 'instagram'
                                            ? 'Gagal menghubungkan Instagram.'
                                            : 'Gagal menghubungkan Facebook.',
                                        selection.platform,
                                    );
                                }
                            }}
                        >
                            {busy && <LoaderCircle className="animate-spin" />}
                            Simpan pilihan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={disconnect !== null}
                onOpenChange={(open) => {
                    if (!open && !busy) {
                        setDisconnect(null);
                    }
                }}
            >
                <DialogContent closeDisabled={busy}>
                    <DialogHeader>
                        <DialogTitle>
                            Disconnect {disconnect?.name}?
                        </DialogTitle>
                        <DialogDescription>
                            Kredensial tersimpan akan dihapus dan platform ini
                            tidak dapat dipilih untuk penerbitan sampai
                            dihubungkan kembali.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setDisconnect(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={() => {
                                if (disconnect) {
                                    void update(
                                        `/admin/social/${disconnect.id}/disconnect`,
                                        { confirmed: '1' },
                                        `Gagal memutuskan koneksi ${disconnect.name}.`,
                                        disconnect.id,
                                    );
                                }
                            }}
                        >
                            {busy && <LoaderCircle className="animate-spin" />}
                            Disconnect
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SettingsWrapper>
    );
}
