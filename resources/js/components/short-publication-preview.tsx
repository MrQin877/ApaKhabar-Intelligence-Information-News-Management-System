import {
    ArrowLeft,
    Bookmark,
    ChevronDown,
    ChevronUp,
    Globe,
    Heart,
    MessageCircle,
    Pause,
    Play,
    Send,
    Share2,
    ThumbsUp,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PlatformIcon } from '@/components/publication-preview';
import type { PublicationPreviewData } from '@/components/publication-preview';
import type {
    PublishPlatform,
    PublishPlatformId,
} from '@/components/publish-news-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const labels = {
    website: 'ApaKhabar',
    instagram: 'Instagram',
    facebook: 'Facebook',
};
const clock = (value: number) =>
    `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

export function ShortPlatformPreview({
    data,
    platform,
    accountName,
    playingPlatform,
    onPlay,
}: {
    data: PublicationPreviewData;
    platform: PublishPlatformId;
    accountName?: string | null;
    playingPlatform: PublishPlatformId | null;
    onPlay: (platform: PublishPlatformId) => void;
}) {
    const player = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const [duration, setDuration] = useState(0);
    const [time, setTime] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState('');
    const account = accountName?.trim();
    const name =
        platform === 'website'
            ? 'ApaKhabar'
            : account
              ? platform === 'instagram'
                  ? `@${account.replace(/^@/, '')}`
                  : account
              : 'Akun belum tersedia';
    const caption = platform === 'website' ? data.content : data.caption;

    useEffect(() => {
        if (playingPlatform !== platform) {
            player.current?.pause();
        }
    }, [playingPlatform, platform]);
    useEffect(() => {
        const video = player.current;

        return () => video?.pause();
    }, []);

    async function togglePlayback() {
        const video = player.current;

        if (!video || !data.video_url) {
            return;
        }

        if (!video.paused) {
            video.pause();

            return;
        }

        try {
            if (video.error) {
                video.load();
            }

            await video.play();
            setError('');
        } catch {
            setError('Video belum dapat diputar. Coba kembali.');
        }
    }
    const interactionIcons = [
        { icon: platform === 'facebook' ? ThumbsUp : Heart, label: 'Suka' },
        { icon: MessageCircle, label: 'Komentar' },
        { icon: platform === 'instagram' ? Send : Share2, label: 'Bagikan' },
        ...(platform === 'instagram'
            ? [{ icon: Bookmark, label: 'Simpan' }]
            : []),
    ];

    return (
        <article
            aria-label={`Pratinjau ${labels[platform]}`}
            className="mx-auto w-[min(100%,22.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 text-white sm:w-[min(100%,clamp(12rem,calc(56.25dvh-14.0625rem),22.5rem))]"
        >
            <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <span className="[&_img]:size-8 [&_svg]:size-8">
                    <PlatformIcon platform={platform} />
                </span>
                <div>
                    <h3 className="text-sm font-semibold">
                        {labels[platform]}
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-400">
                        {platform === 'website'
                            ? 'Halaman Shorts'
                            : 'Pratinjau Reels'}
                    </p>
                </div>
            </header>
            <div className="p-2.5">
                <div className="relative isolate aspect-[9/16] overflow-hidden rounded-xl bg-black">
                    <video
                        ref={player}
                        src={data.video_url}
                        poster={data.thumbnail_url}
                        preload="auto"
                        playsInline
                        muted={muted}
                        aria-label={`Video ${labels[platform]}: ${data.title}`}
                        className="absolute inset-0 h-full w-full object-contain"
                        onLoadedMetadata={(event) =>
                            setDuration(
                                Number.isFinite(event.currentTarget.duration)
                                    ? event.currentTarget.duration
                                    : 0,
                            )
                        }
                        onTimeUpdate={(event) =>
                            setTime(event.currentTarget.currentTime)
                        }
                        onPlay={() => {
                            setPlaying(true);
                            onPlay(platform);
                        }}
                        onPause={() => setPlaying(false)}
                        onEnded={() => setPlaying(false)}
                        onError={(event) => {
                            setPlaying(false);
                            const code = event.currentTarget.error?.code;
                            setError(
                                code === 2
                                    ? 'Video gagal dimuat dari penyimpanan. Periksa koneksi lalu coba putar kembali.'
                                    : code === 3 || code === 4
                                      ? 'Video tidak dapat diputar oleh browser. Periksa berkas video yang dipilih.'
                                      : 'Video tidak dapat dimuat. Coba putar kembali.',
                            );
                        }}
                        onCanPlay={() => setError('')}
                    />
                    <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-3 pt-3 pb-12">
                        {platform === 'website' ? (
                            <span className="flex items-center gap-2 text-xs">
                                <ArrowLeft className="size-4" /> Kembali ke
                                Shorts
                            </span>
                        ) : platform === 'facebook' ? (
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 font-semibold">
                                    {account?.charAt(0).toUpperCase() || (
                                        <Globe className="size-4" />
                                    )}
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold">
                                        {name}
                                    </p>
                                    <p className="flex items-center gap-1 text-[10px] text-zinc-300">
                                        Reels <Globe className="size-3" />
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <span className="text-sm font-semibold">Reels</span>
                        )}
                    </div>
                    {!playing && (
                        <button
                            type="button"
                            onClick={() => void togglePlayback()}
                            aria-label={`Putar video ${labels[platform]}`}
                            className="absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/35 backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-emerald-400"
                        >
                            <Play className="ml-0.5 size-6" />
                        </button>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
                    <div
                        aria-label="Ilustrasi tombol interaksi"
                        className="absolute right-2 bottom-20 flex flex-col items-center gap-3"
                    >
                        {interactionIcons.map(({ icon: Icon, label }) => (
                            <span
                                key={label}
                                role="img"
                                aria-label={label}
                                title={`${label} (ilustrasi)`}
                                className={`flex size-9 items-center justify-center ${platform === 'website' ? 'rounded-full border border-white/10 bg-white/10 backdrop-blur-sm' : 'drop-shadow-md'}`}
                            >
                                <Icon className="size-6" />
                            </span>
                        ))}
                    </div>
                    <div className="absolute right-14 bottom-16 left-3 space-y-2 text-xs drop-shadow-sm">
                        {platform !== 'facebook' && (
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20">
                                    {platform === 'website' ? (
                                        <PlatformIcon platform="website" />
                                    ) : (
                                        account?.charAt(0).toUpperCase() || '@'
                                    )}
                                </span>
                                <span className="truncate font-semibold">
                                    {name}
                                </span>
                            </div>
                        )}
                        {platform === 'website' && (
                            <h4 className="line-clamp-2 font-semibold">
                                {data.title}
                            </h4>
                        )}
                        <p
                            id={`short-caption-${platform}`}
                            className={`${expanded ? 'max-h-36 overflow-y-auto overscroll-contain rounded-md bg-black/70 p-2' : 'line-clamp-2'} leading-relaxed break-words whitespace-pre-wrap`}
                        >
                            {caption}
                        </p>
                        {caption && (
                            <button
                                type="button"
                                aria-expanded={expanded}
                                aria-controls={`short-caption-${platform}`}
                                onClick={() => setExpanded(!expanded)}
                                className="flex min-h-7 items-center gap-1 text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-emerald-400"
                            >
                                {expanded
                                    ? 'Lihat lebih sedikit'
                                    : 'Lihat selengkapnya'}
                                {expanded ? (
                                    <ChevronUp className="size-3" />
                                ) : (
                                    <ChevronDown className="size-3" />
                                )}
                            </button>
                        )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 space-y-1 bg-black/60 px-3 pt-1 pb-2">
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-white hover:bg-white/15 hover:text-white"
                                aria-label={`${playing ? 'Jeda' : 'Putar'} ${labels[platform]}`}
                                onClick={() => void togglePlayback()}
                            >
                                {playing ? (
                                    <Pause className="size-4" />
                                ) : (
                                    <Play className="size-4" />
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-white hover:bg-white/15 hover:text-white"
                                aria-label={`${muted ? 'Bunyikan' : 'Bisukan'} ${labels[platform]}`}
                                onClick={() => setMuted(!muted)}
                            >
                                {muted ? (
                                    <VolumeX className="size-4" />
                                ) : (
                                    <Volume2 className="size-4" />
                                )}
                            </Button>
                            <span className="ml-auto text-[10px] text-zinc-300 tabular-nums">
                                {clock(time)} / {clock(duration)}
                            </span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={duration || 1}
                            step={0.1}
                            value={Math.min(time, duration || 0)}
                            disabled={!duration}
                            aria-label={`Posisi video ${labels[platform]}`}
                            className="block h-2 w-full accent-emerald-500"
                            onChange={(event) => {
                                const next = Number(event.target.value);

                                if (player.current) {
                                    player.current.currentTime = next;
                                }

                                setTime(next);
                            }}
                        />
                    </div>
                </div>
                {error && (
                    <p role="alert" className="mt-2 text-xs text-red-300">
                        {error}
                    </p>
                )}
            </div>
        </article>
    );
}

export function ShortPublicationPreview({
    data,
    selected,
    platforms,
}: {
    data: PublicationPreviewData;
    selected: PublishPlatformId[];
    platforms: PublishPlatform[];
}) {
    const [active, setActive] = useState<PublishPlatformId>('website');
    const [playingPlatform, setPlayingPlatform] =
        useState<PublishPlatformId | null>(null);
    const selection = (['website', 'instagram', 'facebook'] as const).filter(
        (id) => id === 'website' || selected.includes(id),
    );
    const current = selection.includes(active) ? active : 'website';

    return (
        <section
            aria-label="Pratinjau platform video"
            className="min-h-0 shrink-0 space-y-2 px-4 pb-2 sm:px-7"
        >
            <p className="text-sm text-zinc-300">Akan diterbitkan ke:</p>
            <Tabs
                value={current}
                onValueChange={(value) => {
                    setActive(value as PublishPlatformId);
                    setPlayingPlatform(null);
                }}
            >
                <TabsList className="mb-1 h-auto w-full gap-1 bg-transparent p-0">
                    {selection.map((id) => (
                        <TabsTrigger
                            key={id}
                            value={id}
                            className="min-h-11 gap-2 rounded-lg border border-white/15 px-2 text-xs data-[state=active]:border-emerald-500 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400"
                        >
                            <PlatformIcon platform={id} />
                            {labels[id]}
                        </TabsTrigger>
                    ))}
                </TabsList>
                {selection.map((id) => (
                    <TabsContent key={id} value={id}>
                        {current === id && (
                            <ShortPlatformPreview
                                key={`${id}:${data.video_url}:${data.thumbnail_url}`}
                                data={data}
                                platform={id}
                                accountName={
                                    platforms.find((p) => p.id === id)?.account
                                }
                                playingPlatform={playingPlatform}
                                onPlay={setPlayingPlatform}
                            />
                        )}
                    </TabsContent>
                ))}
            </Tabs>
            <p className="text-xs leading-relaxed text-zinc-400">
                Ilustrasi tampilan, bukan pratinjau langsung dari platform.
                Tampilan akhir dapat berbeda.{' '}
                {selection.includes('facebook') &&
                    'Facebook memilih sampul secara otomatis.'}
            </p>
        </section>
    );
}
