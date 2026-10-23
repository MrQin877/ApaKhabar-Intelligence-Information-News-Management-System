import { Link, router } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    Clock,
    LoaderCircle,
    Minus,
    MoreHorizontal,
    Search,
    TriangleAlert,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { PlatformIcon } from '@/components/publication-preview';
import type { PublishPlatformId } from '@/components/publish-news-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { metaRequest } from '@/lib/meta-auth';

export type ListedVideo = {
    id: number;
    title: string;
    description: string;
    video_url: string;
    thumbnail_url: string;
    status: string;
    created_at?: string;
    published_at?: string | null;
    publications?: {
        platform: string;
        status: string;
        account_name: string | null;
        permalink?: string | null;
        error_summary?: string | null;
        can_retry?: boolean;
    }[];
};
const platforms: PublishPlatformId[] = ['website', 'instagram', 'facebook'];
const names = {
    website: 'ApaKhabar',
    instagram: 'Instagram Reels',
    facebook: 'Facebook Reels',
};
const statuses: Record<string, string> = {
    published: 'Berhasil',
    processing: 'Diproses',
    queued: 'Menunggu',
    failed: 'Gagal',
    uncertain: 'Status belum pasti',
    not_selected: 'Tidak dipilih',
};
const overall: Record<string, string> = {
    published: 'Terbit',
    draft: 'Draf',
    archived: 'Diarsipkan',
};
export function publicationUrl(
    platform: string,
    status: string,
    permalink?: string | null,
    archived = false,
    videoId?: number,
) {
    if (status !== 'published') {
        return null;
    }

    if (platform === 'website') {
        return archived || !videoId ? null : `/shorts/${videoId}`;
    }

    try {
        const url = new URL(permalink ?? '');
        const host = url.hostname.toLowerCase();
        const domain =
            platform === 'instagram' ? 'instagram.com' : 'facebook.com';

        return url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            (host === domain || host.endsWith(`.${domain}`))
            ? url.href
            : null;
    } catch {
        return null;
    }
}
export function VideoPlatformStatus({
    platform,
    status = 'not_selected',
}: {
    platform: PublishPlatformId;
    status?: string;
}) {
    const Icon =
        {
            published: Check,
            processing: LoaderCircle,
            queued: Clock,
            failed: X,
            uncertain: TriangleAlert,
        }[status] ?? Minus;

    return (
        <span
            className="inline-flex items-center gap-1.5 text-xs"
            title={`${names[platform]}: ${statuses[status] ?? status}`}
            aria-label={`${names[platform]}: ${statuses[status] ?? status}`}
        >
            <PlatformIcon platform={platform} />
            <Icon
                aria-hidden="true"
                className={`size-3.5 ${status === 'published' ? 'text-primary' : status === 'failed' ? 'text-destructive' : 'text-muted-foreground'} ${status === 'processing' ? 'animate-spin' : ''}`}
            />
            <span className="sr-only">{statuses[status] ?? status}</span>
        </span>
    );
}
function date(value?: string | null) {
    return value
        ? new Date(value).toLocaleString('id-ID', {
              dateStyle: 'medium',
              timeStyle: 'short',
          })
        : '—';
}
export function ShortVideoList({
    videos,
    filters = { search: '', status: 'all' },
    onStatus,
    onAction,
    busy,
}: {
    videos: { data: ListedVideo[]; current_page: number; last_page: number };
    filters?: { search: string; status: string };
    onStatus: (video: ListedVideo) => void;
    onAction: (
        video: ListedVideo,
        action: 'archive' | 'delete' | 'restore',
    ) => void;
    busy: boolean;
}) {
    const [search, setSearch] = useState(filters.search);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [retryVideo, setRetryVideo] = useState<ListedVideo | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    const [retrying, setRetrying] = useState(false);
    const [retryError, setRetryError] = useState('');
    const [detail, setDetail] = useState<number | null>(null);
    const video = videos.data.find((item) => item.id === detail);
    const visit = (status = filters.status, page = 1) => {
        setError('');
        router.get(
            '/admin/short-videos',
            { search, status, page },
            {
                preserveState: true,
                preserveScroll: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
                onError: () =>
                    setError('Daftar video gagal dimuat. Silakan coba lagi.'),
            },
        );
    };

    return (
        <section className="space-y-5" aria-busy={loading}>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    visit();
                }}
                className="flex max-w-lg gap-2"
            >
                <Input
                    aria-label="Cari judul video"
                    placeholder="Cari judul video…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                <Button type="submit" variant="outline" disabled={loading}>
                    <Search className="size-4" />
                    <span className="sr-only">Cari</span>
                </Button>
            </form>
            <Tabs
                value={filters.status}
                onValueChange={(status) => visit(status)}
            >
                <TabsList className="max-w-full">
                    {[
                        ['all', 'Semua'],
                        ['published', 'Terbit'],
                        ['draft', 'Draf'],
                        ['archived', 'Arsip'],
                    ].map(([value, label]) => (
                        <TabsTrigger
                            key={value}
                            value={value}
                            disabled={loading}
                        >
                            {label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            {loading && (
                <p
                    role="status"
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                    <LoaderCircle className="size-4 animate-spin" />
                    Memuat video…
                </p>
            )}
            {!videos.data.length && !loading && (
                <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                    {filters.search || filters.status !== 'all'
                        ? 'Tidak ada video yang sesuai dengan pencarian atau filter.'
                        : 'Belum ada video. Mulai dengan membuat video baru.'}
                </div>
            )}
            <div className="space-y-3">
                {videos.data.map((item) => (
                    <article
                        key={item.id}
                        className="relative flex gap-3 rounded-xl border bg-card p-3 sm:gap-5 sm:p-4"
                    >
                        <img
                            src={item.thumbnail_url}
                            alt={`Sampul ${item.title || 'video'}`}
                            loading="lazy"
                            className="aspect-[9/16] w-20 shrink-0 self-start rounded-lg object-cover sm:w-24"
                        />
                        <div className="min-w-0 flex-1 space-y-3">
                            <div className="space-y-1 pr-8">
                                <h2 className="font-semibold break-words">
                                    {item.title || 'Draf tanpa judul'}
                                </h2>
                                <p className="line-clamp-2 text-sm break-words text-muted-foreground">
                                    {item.description || 'Belum ada deskripsi.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="secondary">
                                    {overall[item.status] ?? item.status}
                                </Badge>
                                <span>
                                    {item.published_at ? 'Terbit' : 'Dibuat'}{' '}
                                    {date(item.published_at ?? item.created_at)}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                {platforms.map((platform) => (
                                    <VideoPlatformStatus
                                        key={platform}
                                        platform={platform}
                                        status={
                                            item.publications?.find(
                                                (p) => p.platform === platform,
                                            )?.status
                                        }
                                    />
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {item.status === 'draft' && (
                                    <Button asChild size="sm">
                                        <Link
                                            href={`/admin/short-videos/create?draft=${item.id}`}
                                        >
                                            Edit Draf
                                        </Link>
                                    </Button>
                                )}
                                {item.status === 'published' && (
                                    <Button asChild size="sm">
                                        <Link href={`/shorts/${item.id}`}>
                                            Lihat Video
                                        </Link>
                                    </Button>
                                )}
                                {item.status === 'processing' && (
                                    <Button size="sm" onClick={() => onStatus(item)}>
                                        Lihat Progres
                                    </Button>
                                )}
                                {item.status === 'failed' && (
                                    <Button size="sm" onClick={() => setDetail(item.id)}>
                                        Lihat Status
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDetail(item.id)}
                                >
                                    Detail Video
                                </Button>
                                {item.status !== 'draft' && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                Lihat Publikasi
                                                <ChevronDown className="size-3" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {platforms.map((platform) => {
                                                const publication =
                                                    item.publications?.find(
                                                        (p) =>
                                                            p.platform ===
                                                            platform,
                                                    );
                                                const url = publicationUrl(
                                                    platform,
                                                    publication?.status ??
                                                        'not_selected',
                                                    publication?.permalink,
                                                    item.status === 'archived',
                                                    item.id,
                                                );

                                                return url ? (
                                                    <DropdownMenuItem
                                                        key={platform}
                                                        asChild
                                                    >
                                                        <a
                                                            href={url}
                                                            target={
                                                                platform ===
                                                                'website'
                                                                    ? undefined
                                                                    : '_blank'
                                                            }
                                                            rel="noopener noreferrer"
                                                        >
                                                            <PlatformIcon
                                                                platform={
                                                                    platform
                                                                }
                                                            />
                                                            {names[platform]}
                                                        </a>
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem
                                                        key={platform}
                                                        disabled
                                                    >
                                                        <PlatformIcon
                                                            platform={platform}
                                                        />
                                                        {names[platform]}
                                                        {' \u2014 '}
                                                        {publication?.status ===
                                                        'published'
                                                            ? 'Tautan belum tersedia'
                                                            : statuses[
                                                                  publication?.status ??
                                                                      'not_selected'
                                                              ]}
                                                        {platform ===
                                                            'website' &&
                                                        item.status ===
                                                            'archived'
                                                            ? ' (Diarsipkan)'
                                                            : ''}
                                                    </DropdownMenuItem>
                                                );
                                            })}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </div>
                        <div className="absolute top-3 right-3">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Menu video ${item.title}`}
                                    >
                                        <MoreHorizontal className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {item.status === 'published' &&
                                        item.publications?.some(
                                            (p) => p.can_retry,
                                        ) && (
                                            <DropdownMenuItem
                                                onSelect={() => {
                                                    setRetryVideo(item);
                                                    setSelected([]);
                                                    setRetryError('');
                                                }}
                                            >
                                                Coba Publikasikan Lagi
                                            </DropdownMenuItem>
                                        )}
                                    {item.status === 'draft' && (
                                        <DropdownMenuItem asChild>
                                            <Link
                                                href={`/admin/short-videos/create?draft=${item.id}`}
                                            >
                                                Edit Draf
                                            </Link>
                                        </DropdownMenuItem>
                                    )}
                                    {item.status === 'archived' && (
                                        <DropdownMenuItem
                                            disabled={busy}
                                            onSelect={() =>
                                                onAction(item, 'restore')
                                            }
                                        >
                                            Pulihkan Video
                                        </DropdownMenuItem>
                                    )}
                                    {item.status === 'published' && (
                                        <DropdownMenuItem
                                            disabled={busy}
                                            onSelect={() =>
                                                onAction(item, 'archive')
                                            }
                                        >
                                            Arsipkan Video
                                        </DropdownMenuItem>
                                    )}
                                    {item.status === 'draft' && (
                                        <DropdownMenuItem
                                            disabled={busy}
                                            className="text-destructive"
                                            onSelect={() =>
                                                onAction(item, 'delete')
                                            }
                                        >
                                            Hapus Draf
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </article>
                ))}
            </div>
            {videos.last_page > 1 && (
                <div className="flex items-center justify-between gap-2">
                    <Button
                        variant="outline"
                        disabled={loading || videos.current_page <= 1}
                        onClick={() =>
                            visit(filters.status, videos.current_page - 1)
                        }
                    >
                        Sebelumnya
                    </Button>
                    <span className="text-sm">
                        {videos.current_page} / {videos.last_page}
                    </span>
                    <Button
                        variant="outline"
                        disabled={
                            loading || videos.current_page >= videos.last_page
                        }
                        onClick={() =>
                            visit(filters.status, videos.current_page + 1)
                        }
                    >
                        Berikutnya
                    </Button>
                </div>
            )}
            <Dialog
                open={!!retryVideo}
                onOpenChange={(open) => {
                    if (!open && !retrying) {
                        setRetryVideo(null);
                    }
                }}
            >
                <DialogContent closeDisabled={retrying}>
                    <DialogTitle>Coba Publikasikan Lagi</DialogTitle>
                    <DialogDescription>
                        Pilih platform yang ingin dicoba kembali.
                    </DialogDescription>
                    {platforms.map((platform) => {
                        const p = retryVideo?.publications?.find(
                            (item) => item.platform === platform,
                        );
                        const eligible =
                            platform !== 'website' &&
                            p?.status === 'failed' &&
                            p.can_retry === true;

                        return (
                            <label
                                key={platform}
                                className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.includes(platform)}
                                    disabled={!eligible || retrying}
                                    onChange={(event) =>
                                        setSelected((previous) =>
                                            event.target.checked
                                                ? [...previous, platform]
                                                : previous.filter(
                                                      (value) =>
                                                          value !== platform,
                                                  ),
                                        )
                                    }
                                    className="size-4 accent-primary"
                                />
                                <VideoPlatformStatus
                                    platform={platform}
                                    status={p?.status}
                                />
                                <span>
                                    {names[platform]}
                                    <span className="block text-xs text-muted-foreground">
                                        {statuses[p?.status ?? 'not_selected']}
                                        {p?.account_name
                                            ? ` ? ${p.account_name}`
                                            : ''}
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                    {retryError && (
                        <p role="alert" className="text-sm text-destructive">
                            {retryError}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            disabled={retrying}
                            onClick={() => setRetryVideo(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            disabled={retrying || !selected.length}
                            onClick={async () => {
                                if (!retryVideo || retrying) {
                                    return;
                                }

                                setRetrying(true);
                                setRetryError('');

                                try {
                                    await metaRequest(
                                        `/admin/short-videos/${retryVideo.id}/retry-selected`,
                                        { platforms: selected },
                                    );
                                    window.dispatchEvent(
                                        new CustomEvent('short-publication', {
                                            detail: {
                                                id: retryVideo.id,
                                                title: retryVideo.title,
                                            },
                                        }),
                                    );
                                    setRetryVideo(null);
                                    router.reload({ only: ['videos'] });
                                } catch (failure) {
                                    setRetryError((failure as Error).message);
                                } finally {
                                    setRetrying(false);
                                }
                            }}
                        >
                            {retrying && (
                                <LoaderCircle className="size-4 animate-spin" />
                            )}
                            Coba Lagi ({selected.length})
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog
                open={!!video}
                onOpenChange={(open) => {
                    if (!open) {
                        setDetail(null);
                    }
                }}
            >
                <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                    <DialogTitle>Detail Video</DialogTitle>
                    <DialogDescription>
                        Informasi video dan publikasi pada setiap platform.
                    </DialogDescription>
                    {video && (
                        <div className="space-y-4">
                            <video
                                key={video.video_url}
                                src={video.video_url}
                                poster={video.thumbnail_url}
                                controls
                                playsInline
                                preload="metadata"
                                className="max-h-80 w-full rounded-lg bg-secondary"
                            />
                            <div className="flex gap-3">
                                <img
                                    src={video.thumbnail_url}
                                    alt="Sampul terpilih"
                                    className="aspect-[9/16] w-16 self-start rounded object-cover"
                                />
                                <div className="min-w-0">
                                    <h3 className="font-semibold break-words">
                                        {video.title || 'Draf tanpa judul'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Dibuat: {date(video.created_at)}
                                        <br />
                                        Terbit: {date(video.published_at)}
                                    </p>
                                    <Badge variant="secondary">
                                        {overall[video.status]}
                                    </Badge>
                                </div>
                            </div>
                            <p className="text-sm break-words whitespace-pre-wrap">
                                {video.description || 'Belum ada deskripsi.'}
                            </p>
                            {platforms.map((platform) => {
                                const p = video.publications?.find(
                                    (item) => item.platform === platform,
                                );

                                return (
                                    <div
                                        key={platform}
                                        className="rounded-lg border p-3 text-sm"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <VideoPlatformStatus
                                                platform={platform}
                                                status={p?.status}
                                            />
                                            <span>
                                                {names[platform]} ·{' '}
                                                {
                                                    statuses[
                                                        p?.status ??
                                                            'not_selected'
                                                    ]
                                                }
                                            </span>
                                        </div>
                                        {p?.account_name && (
                                            <p className="mt-1 text-muted-foreground">
                                                Akun: {p.account_name}
                                            </p>
                                        )}
                                        {p?.error_summary && (
                                            <p className="mt-1 text-destructive">
                                                {p.error_summary}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setDetail(null);
                                    onStatus(video);
                                }}
                            >
                                Lihat Status Publikasi
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}
