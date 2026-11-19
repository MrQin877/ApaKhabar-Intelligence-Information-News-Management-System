import { useEffect, useState } from 'react';

const FRAME_COUNT = 12;
const frameCache = new Map<string, string[]>();

function waitForVideo(
    video: HTMLVideoElement,
    event: 'loadeddata' | 'seeked',
    timeout: number,
    cancelled: () => boolean,
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (cancelled()) return reject(new Error('cancelled'));
        const timer = window.setTimeout(() => finish(false), timeout);
        const finish = (ready: boolean) => {
            window.clearTimeout(timer);
            video.removeEventListener(event, onReady);
            video.removeEventListener('error', onError);
            if (ready) {
                resolve();
            } else {
                reject(new Error('Video frame timed out or failed'));
            }
        };
        const onReady = () => finish(true);
        const onError = () => finish(false);
        video.addEventListener(event, onReady, { once: true });
        video.addEventListener('error', onError, { once: true });
    });
}

export function formatFrameTime(time: number): string {
    const tenths = Math.max(0, Math.round(time * 10));
    return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
}

export function useVideoFrames(source: string, duration: number) {
    const [frames, setFrames] = useState<{
        source: string;
        images: string[];
        loading: boolean;
        failed: boolean;
    }>({
        source: '',
        images: [],
        loading: false,
        failed: false,
    });
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!source || !duration) return;
        const key = `${source}|${duration}`;
        const cached = frameCache.get(key) ?? Array(FRAME_COUNT).fill('');
        setFrames({
            source,
            images: [...cached],
            loading: cached.some((image) => !image),
            failed: false,
        });
        if (cached.every(Boolean)) return;
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        const canvas = document.createElement('canvas');
        canvas.width = 90;
        canvas.height = 160;
        const images = [...cached];
        let cancelled = false;
        const capture = async (index: number) => {
            const time =
                (index / (FRAME_COUNT - 1)) * Math.max(0, duration - 0.1);
            for (let retry = 0; retry < 2 && !cancelled; retry++) {
                try {
                    if (
                        Math.abs(video.currentTime - time) > 0.001 ||
                        video.readyState < 2
                    ) {
                        const ready = waitForVideo(
                            video,
                            'seeked',
                            4500,
                            () => cancelled,
                        );
                        video.currentTime = time;
                        await ready;
                    }
                    if (
                        video.readyState < 2 ||
                        !video.videoWidth ||
                        !video.videoHeight
                    )
                        throw new Error('Frame unavailable');
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error('Canvas unavailable');
                    context.fillStyle = '#09090b';
                    context.fillRect(0, 0, 90, 160);
                    const scale = Math.min(
                        90 / video.videoWidth,
                        160 / video.videoHeight,
                    );
                    const w = video.videoWidth * scale;
                    const h = video.videoHeight * scale;
                    context.drawImage(video, (90 - w) / 2, (160 - h) / 2, w, h);
                    const image = canvas.toDataURL('image/jpeg', 0.7);
                    if (!image || image === 'data:,')
                        throw new Error('Empty frame');
                    if (cancelled) return false;
                    images[index] = image;
                    frameCache.set(key, [...images]);
                    if (frameCache.size > 3)
                        frameCache.delete(frameCache.keys().next().value!);
                    setFrames({
                        source,
                        images: [...images],
                        loading: true,
                        failed: false,
                    });
                    return true;
                } catch {
                    // A failed seek or canvas frame must not block the remaining positions.
                }
            }
            return false;
        };
        const run = async () => {
            try {
                if (video.readyState < 2)
                    await waitForVideo(
                        video,
                        'loadeddata',
                        8000,
                        () => cancelled,
                    );
                let failures = 0;
                for (const index of [0, 3, 6, 9, 1, 2, 4, 5, 7, 8, 10, 11]) {
                    if (cancelled) return;
                    if (!images[index] && !(await capture(index))) failures++;
                }
                if (!cancelled)
                    setFrames({
                        source,
                        images: [...images],
                        loading: false,
                        failed: failures > 0,
                    });
            } catch {
                if (!cancelled)
                    setFrames({
                        source,
                        images: [...images],
                        loading: false,
                        failed: true,
                    });
            }
        };
        video.src = source;
        void run();
        return () => {
            cancelled = true;
            video.removeAttribute('src');
            video.load();
        };
    }, [source, duration, attempt]);
    return {
        images: frames.source === source ? frames.images : [],
        loading: frames.source === source && frames.loading,
        failed: frames.source === source && frames.failed,
        retry: () => setAttempt((value) => value + 1),
    };
}

export function VideoFrameTimeline({
    source,
    duration,
    offset,
    playbackTime = 0,
    disabled,
    onSelect,
}: {
    source: string;
    duration: number;
    offset: number;
    playbackTime?: number;
    disabled: boolean;
    onSelect: (time: number) => void;
}) {
    const { images, loading, failed, retry } = useVideoFrames(source, duration);
    const max = Math.max(0, duration - 0.1);
    const coverPosition = max ? (Math.min(offset, max) / max) * 100 : 0;
    const playbackPosition = max
        ? (Math.min(playbackTime, max) / max) * 100
        : 0;

    return (
        <div className="space-y-3">
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                <span>
                    <span className="mr-2 inline-block h-3 w-0.5 bg-zinc-400 align-middle" />
                    Posisi putar {formatFrameTime(playbackTime)}
                </span>
                <span className="text-emerald-400">
                    Sampul {formatFrameTime(offset)}
                </span>
            </div>
            <div className="relative rounded-lg border border-zinc-700 bg-zinc-950 p-1">
                <div className="relative h-24 overflow-hidden rounded bg-zinc-900 sm:h-28">
                    <div className="flex h-full w-full" aria-hidden="true">
                        {Array.from({ length: 12 }, (_, index) =>
                            images[index] ? (
                                <img
                                    key={index}
                                    src={images[index]}
                                    alt=""
                                    className="h-full min-w-0 flex-1 border-r border-zinc-950 object-cover last:border-r-0"
                                />
                            ) : (
                                <div
                                    key={index}
                                    className={`h-full min-w-0 flex-1 border-r border-zinc-800 bg-zinc-900 last:border-r-0 ${loading ? 'animate-pulse' : ''}`}
                                />
                            ),
                        )}
                    </div>
                    <span
                        data-playback-indicator
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-zinc-300 shadow-[0_0_4px_#fff]"
                        style={{ left: `${playbackPosition}%` }}
                    />
                    <span
                        data-cover-indicator
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-emerald-400 shadow-[0_0_6px_#34d399]"
                        style={{ left: `${coverPosition}%` }}
                    >
                        <span className="absolute top-0 left-1/2 h-4 w-4 -translate-x-1/2 rounded-b-md bg-emerald-400" />
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={max}
                        step={0.001}
                        value={Math.min(offset, max)}
                        disabled={disabled || max === 0}
                        aria-label="Posisi sampul video"
                        aria-valuetext={formatFrameTime(offset)}
                        className="absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0 disabled:cursor-not-allowed"
                        onChange={(event) =>
                            onSelect(Number(event.currentTarget.value))
                        }
                    />
                </div>
            </div>
            {failed && (
                <div
                    className="flex items-center justify-between gap-2 text-xs text-amber-400"
                    role="status"
                >
                    <span>Beberapa bingkai tidak dapat dimuat.</span>
                    <button
                        type="button"
                        className="rounded border border-amber-400/50 px-2 py-1 hover:bg-amber-400/10"
                        onClick={retry}
                    >
                        Coba Lagi
                    </button>
                </div>
            )}
            <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{formatFrameTime(0)}</span>
                <span>{formatFrameTime(duration)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
                Seret garis hijau untuk memilih sampul. Garis putih menunjukkan
                posisi putar video.
            </p>
        </div>
    );
}
