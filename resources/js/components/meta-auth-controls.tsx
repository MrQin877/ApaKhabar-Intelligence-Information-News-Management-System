import { useEffect, useRef, useState } from 'react';
import type { PublishPlatform } from '@/components/publish-news-dialog';
import { loadFacebookSdk, metaRequest } from '@/lib/meta-auth';
import type { MetaAuthConfig } from '@/lib/meta-auth';

interface ConnectionResult {
    platforms: PublishPlatform[];
}
interface Props {
    config: MetaAuthConfig;
    disabled: boolean;
    onConnected: (platforms: PublishPlatform[]) => void;
}

export function FacebookLoginControl({ config, disabled, onConnected }: Props) {
    const container = useRef<HTMLDivElement>(null);
    const connected = useRef(onConnected);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [pages, setPages] = useState<{ id: string; name: string }[]>([]);
    const [ticket, setTicket] = useState('');
    const pending = useRef(false);
    useEffect(() => {
        connected.current = onConnected;
    }, [onConnected]);

    useEffect(() => {
        if (!config.facebookAppId) {
            return;
        }

        let disposed = false;
        // This callback is invoked only by Meta's onlogin handler, never on mount.
        window.apakhabarFacebookLogin = () => {
            if (pending.current) {
                return;
            }

            window.FB?.getLoginStatus(async (response) => {
                if (disposed || !response.authResponse?.accessToken) {
                    if (!disposed) {
                        setError('Otorisasi Facebook dibatalkan.');
                    }

                    return;
                }

                pending.current = true;
                setBusy(true);
                setError('');

                try {
                    const result = await metaRequest<{
                        ticket: string;
                        pages: { id: string; name: string }[];
                    }>('/admin/social/facebook/authorize', {
                        access_token: response.authResponse.accessToken,
                    });

                    if (!disposed) {
                        setPages(result.pages);
                        setTicket(result.ticket);
                    }
                } catch (exception) {
                    if (!disposed) {
                        setError(
                            exception instanceof Error
                                ? exception.message
                                : 'Facebook tidak dapat dihubungkan.',
                        );
                    }
                } finally {
                    pending.current = false;

                    if (!disposed) {
                        setBusy(false);
                    }
                }
            });
        };
        void loadFacebookSdk(config)
            .then((sdk) => {
                if (!disposed && container.current) {
                    sdk.XFBML.parse(container.current);
                }
            })
            .catch((exception: Error) => {
                if (!disposed) {
                    setError(exception.message);
                }
            });

        return () => {
            disposed = true;
            delete window.apakhabarFacebookLogin;
        };
    }, [config]);

    async function choosePage(id: string) {
        if (pending.current) {
            return;
        }

        pending.current = true;
        setBusy(true);
        setError('');

        try {
            const result = await metaRequest<ConnectionResult>(
                '/admin/social/facebook/page',
                { ticket, page_id: id },
            );
            connected.current(result.platforms);
        } catch (exception) {
            setError(
                exception instanceof Error
                    ? exception.message
                    : 'Halaman tidak dapat dihubungkan.',
            );
        } finally {
            pending.current = false;
            setBusy(false);
        }
    }

    return (
        <div className="space-y-3">
            {config.facebookAppId ? (
                <>
                    {/* The SDK owns all Facebook button styling, text, logo and loading states. */}
                    <div
                        ref={container}
                        inert={disabled || busy}
                        aria-busy={busy}
                        className="min-h-10"
                    >
                        <div
                            className="fb-login-button"
                            data-button-type="continue_with"
                            data-size="large"
                            data-use-continue-as="true"
                            data-auto-logout-link="false"
                            data-scope="pages_show_list,pages_read_engagement,pages_manage_posts"
                            data-onlogin="apakhabarFacebookLogin()"
                        />
                    </div>
                    {pages.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium">
                                Pilih Halaman Facebook untuk dihubungkan:
                            </p>
                            {pages.map((page) => (
                                <button
                                    key={page.id}
                                    type="button"
                                    disabled={disabled || busy}
                                    onClick={() => void choosePage(page.id)}
                                    className="block w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                                >
                                    {page.name}
                                </button>
                            ))}
                        </div>
                    )}
                    {busy && (
                        <p
                            role="status"
                            className="text-xs text-muted-foreground"
                        >
                            Memverifikasi Halaman Facebook...
                        </p>
                    )}
                </>
            ) : (
                <p className="rounded-lg border border-dashed p-3 text-xs leading-5 text-muted-foreground">
                    Facebook Login belum dikonfigurasi. Tombol resmi Meta akan
                    muncul setelah App ID dan App Secret diatur.
                </p>
            )}
            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}

export function InstagramLoginControl({
    config,
    disabled,
    onConnected,
}: Props) {
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const popup = useRef<Window | null>(null);
    const cleanup = useRef<(() => void) | null>(null);
    useEffect(
        () => () => {
            cleanup.current?.();
        },
        [],
    );

    function authorize() {
        if (!config.instagramConfigured || disabled || busy) {
            return;
        }

        setError('');
        const child = window.open(
            '/admin/social/instagram/connect',
            'apakhabar-instagram',
            'popup,width=600,height=740',
        );

        if (!child) {
            setError('Izinkan jendela pop-up untuk menghubungkan Instagram.');

            return;
        }

        popup.current = child;
        setBusy(true);
        let finished = false;
        async function finish(success?: boolean) {
            if (finished) {
                return;
            }

            finished = true;
            cleanup.current?.();

            try {
                const result = await metaRequest<ConnectionResult>(
                    '/admin/social/connections',
                );
                onConnected(result.platforms);

                if (
                    success === false ||
                    !result.platforms.some(
                        (platform) =>
                            platform.id === 'instagram' &&
                            platform.status === 'connected',
                    )
                ) {
                    setError(
                        'Instagram belum terhubung. Otorisasi mungkin dibatalkan atau izin belum lengkap.',
                    );
                }
            } catch (exception) {
                setError(
                    exception instanceof Error
                        ? exception.message
                        : 'Status Instagram tidak dapat diperbarui.',
                );
            } finally {
                setBusy(false);
            }
        }
        const receive = (event: MessageEvent) => {
            if (
                event.origin === window.location.origin &&
                event.source === popup.current &&
                event.data?.type === 'apakhabar:instagram-auth'
            ) {
                void finish(event.data.success === true);
            }
        };
        window.addEventListener('message', receive);
        const interval = window.setInterval(() => {
            if (child.closed) {
                void finish();
            }
        }, 750);
        cleanup.current = () => {
            window.clearInterval(interval);
            window.removeEventListener('message', receive);
        };
    }

    return (
        <div className="space-y-2">
            {/* Instagram business authorization has no SDK-rendered login button. Keep this neutral, branded control independent of theme tokens. */}
            <button
                type="button"
                onClick={authorize}
                disabled={disabled || busy || !config.instagramConfigured}
                style={{
                    backgroundColor: '#fff',
                    color: '#262626',
                    borderColor: '#dbdbdb',
                    fontFamily: 'Arial, Helvetica, sans-serif',
                }}
                className="inline-flex min-h-10 max-w-full items-center justify-center gap-3 rounded border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#262626] disabled:cursor-not-allowed"
            >
                <img
                    src="/images/brands/instagram.png"
                    alt=""
                    className="size-6 shrink-0"
                />
                {busy
                    ? 'Menunggu otorisasi Instagram...'
                    : 'Lanjutkan dengan Instagram'}
            </button>
            {!config.instagramConfigured}
            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
