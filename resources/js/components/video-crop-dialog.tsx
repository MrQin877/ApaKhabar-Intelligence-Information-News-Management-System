import {
    LoaderCircle,
    Pause,
    Play,
    RotateCcw,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { VideoTrimTimeline } from '@/components/video-trim-timeline';
import { cropChanged, cropRectangle } from '@/lib/video-crop';
import type { VideoCrop } from '@/lib/video-crop';

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));
const clock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function VideoCropDialog({
    source,
    initial,
    onClose,
    onSave,
}: {
    source: string;
    initial?: VideoCrop;
    onClose: () => void;
    onSave: (crop: VideoCrop) => Promise<void>;
}) {
    const background = useRef<HTMLVideoElement>(null);
    const video = useRef<HTMLVideoElement>(null);
    const drag = useRef<{ x: number; y: number; crop: VideoCrop } | null>(null);
    const [size, setSize] = useState({ width: 0, height: 0, duration: 0 });
    const [crop, setCrop] = useState<VideoCrop>(
        initial ?? { mode: 'fit', x: 0.5, y: 0.5, zoom: 1, start: 0, end: 0 },
    );
    const [time, setTime] = useState(initial?.start ?? 0);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const rect = cropRectangle(size.width, size.height, crop);
    const ready = size.duration > 0 && rect.width > 0 && crop.end > crop.start;
    const changed =
        ready &&
        cropChanged(size.width, size.height, size.duration, crop, initial);
    const seek = (value: number) => {
        if (video.current) {
            video.current.currentTime = value;
        }

        setTime(value);
    };

    async function save() {
        if (!changed || saving) {
            return;
        }

        video.current?.pause();
        setSaving(true);
        setError('');

        try {
            await onSave(crop);
            onClose();
        } catch (failure) {
            setError(
                failure instanceof Error
                    ? failure.message
                    : 'Video gagal disimpan. Coba lagi.',
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !saving) {
                    onClose();
                }
            }}
        >
            <DialogContent
                className="max-h-[95dvh] overflow-y-auto sm:max-w-3xl"
                closeDisabled={saving}
                onInteractOutside={(event) => event.preventDefault()}
                onEscapeKeyDown={(event) => {
                    if (saving) {
                        event.preventDefault();
                    }
                }}
            >
                <DialogTitle>Sesuaikan / Pangkas Video</DialogTitle>
                <DialogDescription>
                    Geser dan zoom video untuk menyesuaikan area dalam rasio
                    9:16 (Reels). Video asli tetap tersimpan.
                </DialogDescription>
                <div className="flex gap-2">
                    <Button
                        variant={crop.mode === 'fit' ? 'default' : 'outline'}
                        className={
                            crop.mode === 'fit'
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : ''
                        }
                        disabled={saving}
                        onClick={() => setCrop({ ...crop, mode: 'fit' })}
                    >
                        Sesuaikan (Fit)
                    </Button>
                    <Button
                        variant={crop.mode !== 'fit' ? 'default' : 'outline'}
                        className={
                            crop.mode !== 'fit'
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : ''
                        }
                        disabled={saving}
                        onClick={() => setCrop({ ...crop, mode: 'crop' })}
                    >
                        Pangkas (Crop)
                    </Button>
                </div>
                <div className="rounded-xl bg-zinc-950 p-3">
                    <div
                        role="group"
                        aria-label="Area crop 9:16. Gunakan tombol panah untuk menggeser video."
                        tabIndex={saving ? -1 : 0}
                        className="relative mx-auto aspect-[9/16] h-[min(46dvh,420px)] max-w-full touch-none overflow-hidden rounded-md border-2 border-emerald-400 bg-black outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        onPointerDown={(event) => {
                            if (!ready || saving || crop.mode === 'fit') {
                                return;
                            }

                            event.currentTarget.setPointerCapture(
                                event.pointerId,
                            );
                            drag.current = {
                                x: event.clientX,
                                y: event.clientY,
                                crop,
                            };
                        }}
                        onPointerMove={(event) => {
                            if (
                                !drag.current ||
                                saving ||
                                crop.mode === 'fit'
                            ) {
                                return;
                            }

                            const scale =
                                event.currentTarget.getBoundingClientRect()
                                    .width / rect.width;
                            const dx = size.width - rect.width;
                            const dy = size.height - rect.height;
                            setCrop({
                                ...drag.current.crop,
                                x:
                                    dx > 0
                                        ? clamp(
                                              drag.current.crop.x -
                                                  (event.clientX -
                                                      drag.current.x) /
                                                      scale /
                                                      dx,
                                              0,
                                              1,
                                          )
                                        : 0.5,
                                y:
                                    dy > 0
                                        ? clamp(
                                              drag.current.crop.y -
                                                  (event.clientY -
                                                      drag.current.y) /
                                                      scale /
                                                      dy,
                                              0,
                                              1,
                                          )
                                        : 0.5,
                            });
                        }}
                        onPointerUp={() => {
                            drag.current = null;
                        }}
                        onPointerCancel={() => {
                            drag.current = null;
                        }}
                        onLostPointerCapture={() => {
                            drag.current = null;
                        }}
                        onKeyDown={(event) => {
                            if (
                                saving ||
                                crop.mode === 'fit' ||
                                ![
                                    'ArrowLeft',
                                    'ArrowRight',
                                    'ArrowUp',
                                    'ArrowDown',
                                ].includes(event.key)
                            ) {
                                return;
                            }

                            event.preventDefault();
                            setCrop({
                                ...crop,
                                x: clamp(
                                    crop.x +
                                        (event.key === 'ArrowLeft'
                                            ? 0.02
                                            : event.key === 'ArrowRight'
                                              ? -0.02
                                              : 0),
                                    0,
                                    1,
                                ),
                                y: clamp(
                                    crop.y +
                                        (event.key === 'ArrowUp'
                                            ? 0.02
                                            : event.key === 'ArrowDown'
                                              ? -0.02
                                              : 0),
                                    0,
                                    1,
                                ),
                            });
                        }}
                    >
                        <video
                            ref={video}
                            src={source}
                            playsInline
                            muted={muted}
                            preload="metadata"
                            className="pointer-events-none absolute z-10 max-w-none"
                            style={
                                ready && crop.mode !== 'fit'
                                    ? {
                                          width: `${(size.width / rect.width) * 100}%`,
                                          height: `${(size.height / rect.height) * 100}%`,
                                          left: `${(-rect.x / rect.width) * 100}%`,
                                          top: `${(-rect.y / rect.height) * 100}%`,
                                      }
                                    : {
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'contain',
                                      }
                            }
                            onLoadedMetadata={(event) => {
                                const v = event.currentTarget;
                                setSize({
                                    width: v.videoWidth,
                                    height: v.videoHeight,
                                    duration: v.duration,
                                });
                                setCrop((previous) =>
                                    previous.end > 0
                                        ? previous
                                        : (initial ?? {
                                              mode: 'fit',
                                              x: 0.5,
                                              y: 0.5,
                                              zoom: 1,
                                              start: 0,
                                              end: v.duration,
                                          }),
                                );
                                v.currentTime = initial?.start ?? 0;
                            }}
                            onTimeUpdate={(event) => {
                                const v = event.currentTarget;

                                if (v.currentTime >= crop.end && crop.end > 0) {
                                    v.pause();

                                    if (v.currentTime > crop.end) {
                                        v.currentTime = crop.end;
                                    }

                                    setTime(crop.end);

                                    return;
                                }

                                setTime(v.currentTime);
                            }}
                            onSeeked={() => {
                                if (background.current && video.current) {
                                    background.current.currentTime =
                                        video.current.currentTime;
                                }
                            }}
                            onPlay={() => {
                                setPlaying(true);

                                if (background.current && video.current) {
                                    background.current.currentTime =
                                        video.current.currentTime;
                                    void background.current
                                        .play()
                                        .catch(() => {});
                                }
                            }}
                            onPause={() => {
                                setPlaying(false);
                                background.current?.pause();
                            }}
                            onEnded={() => setPlaying(false)}
                            onError={() => {
                                setError(
                                    'Video tidak dapat dimuat. Tutup dan coba lagi.',
                                );
                                setSize({ width: 0, height: 0, duration: 0 });
                            }}
                        />
                        {crop.mode === 'fit' && (
                            <video
                                ref={background}
                                src={source}
                                muted
                                playsInline
                                aria-hidden="true"
                                onLoadedData={(event) => {
                                    event.currentTarget.currentTime =
                                        video.current?.currentTime ??
                                        crop.start;

                                    if (
                                        video.current &&
                                        !video.current.paused
                                    ) {
                                        void event.currentTarget
                                            .play()
                                            .catch(() => {});
                                    }
                                }}
                                className="pointer-events-none absolute inset-0 -z-0 h-full w-full scale-110 object-cover blur-xl"
                                style={{ zIndex: 0 }}
                            />
                        )}
                        <div
                            className="pointer-events-none absolute inset-0 z-20 grid grid-cols-3 grid-rows-3 opacity-40"
                            aria-hidden="true"
                        >
                            {Array.from({ length: 9 }, (_, index) => (
                                <span
                                    key={index}
                                    className="border border-white/30"
                                />
                            ))}
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-white">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={!ready || saving}
                            aria-label={playing ? 'Jeda video' : 'Putar video'}
                            onClick={() => {
                                if (playing) {
                                    video.current?.pause();
                                } else {
                                    if (time < crop.start || time >= crop.end) {
                                        seek(crop.start);
                                    }

                                    void video.current
                                        ?.play()
                                        .catch(() =>
                                            setError(
                                                'Pemutaran gagal. Coba putar kembali.',
                                            ),
                                        );
                                }
                            }}
                        >
                            {playing ? <Pause /> : <Play />}
                        </Button>
                        <span className="min-w-20 text-xs tabular-nums">
                            {clock(time)} / {clock(size.duration)}
                        </span>
                        <input
                            aria-label="Timeline video"
                            type="range"
                            min={crop.start}
                            max={crop.end || 1}
                            step="0.01"
                            value={clamp(time, crop.start, crop.end || 1)}
                            disabled={!ready || saving}
                            onChange={(event) =>
                                seek(Number(event.target.value))
                            }
                            className="min-w-0 flex-1 accent-emerald-500"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={
                                muted ? 'Aktifkan suara' : 'Bisukan video'
                            }
                            onClick={() => setMuted(!muted)}
                        >
                            {muted ? <VolumeX /> : <Volume2 />}
                        </Button>
                    </div>
                </div>
                <VideoTrimTimeline
                    source={source}
                    duration={size.duration}
                    start={crop.start}
                    end={crop.end}
                    currentTime={time}
                    disabled={!ready || saving}
                    onStart={(start) => {
                        setCrop((value) => ({ ...value, start }));
                        seek(start);
                    }}
                    onEnd={(end) => {
                        setCrop((value) => ({ ...value, end }));

                        if (time > end) {
                            seek(end);
                        }
                    }}
                    onSeek={seek}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm">
                        Zoom{' '}
                        <span className="text-muted-foreground">
                            {crop.zoom.toFixed(2)}×
                        </span>
                        <input
                            aria-label="Zoom video"
                            type="range"
                            min="1"
                            max="4"
                            step="0.01"
                            value={crop.zoom}
                            disabled={!ready || saving}
                            onChange={(event) =>
                                setCrop({
                                    ...crop,
                                    mode: 'crop',
                                    zoom: Number(event.target.value),
                                })
                            }
                            className="block w-full accent-emerald-500"
                        />
                    </label>
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>
                            9:16 · 1080 × 1920
                            <br />
                            Durasi hasil: {clock(crop.end - crop.start)}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!ready || saving}
                            onClick={() => {
                                setCrop({
                                    mode: 'fit',
                                    x: 0.5,
                                    y: 0.5,
                                    zoom: 1,
                                    start: 0,
                                    end: size.duration,
                                });
                                seek(0);
                            }}
                        >
                            <RotateCcw className="size-4" />
                            Reset
                        </Button>
                    </div>
                </div>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                {saving && (
                    <p role="status" className="text-sm text-muted-foreground">
                        Mengekspor dan menyimpan video. Mohon tunggu…
                    </p>
                )}
                <div className="flex justify-end gap-3 border-t pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={onClose}
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        disabled={!changed || saving}
                        onClick={() => void save()}
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                        {saving && (
                            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                        )}
                        Terapkan
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
