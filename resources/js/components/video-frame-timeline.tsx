import { useEffect, useRef, useState } from 'react';

export function useVideoFrames(source: string, duration: number) {
    const [frames, setFrames] = useState<{ source: string; images: string[] }>({
        source: '',
        images: [],
    });
    useEffect(() => {
        if (!source || !duration) {
            return;
        }

        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'auto';
        const canvas = document.createElement('canvas');
        const images: string[] = [];
        let cancelled = false;
        const capture = () => {
            if (cancelled) {
                return;
            }

            try {
                canvas.width = 90;
                canvas.height = 160;
                const context = canvas.getContext('2d');

                if (!context || !video.videoWidth) {
                    return;
                }

                context.fillStyle = '#09090b';
                context.fillRect(0, 0, 90, 160);
                const scale = Math.min(
                    90 / video.videoWidth,
                    160 / video.videoHeight,
                );
                const w = video.videoWidth * scale;
                const h = video.videoHeight * scale;
                context.drawImage(video, (90 - w) / 2, (160 - h) / 2, w, h);
                images.push(canvas.toDataURL('image/jpeg', 0.7));
                setFrames({ source, images: [...images] });

                if (images.length < 8) {
                    video.currentTime =
                        (images.length / 7) * Math.max(0, duration - 0.1);
                }
            } catch {
                // The filmstrip handle remains usable if a remote server disallows canvas access.
            }
        };
        video.onloadeddata = () => {
            if (!images.length) {
                capture();
            }
        };
        video.onseeked = capture;
        video.src = source;

        return () => {
            cancelled = true;
            video.onloadeddata = null;
            video.onseeked = null;
            video.removeAttribute('src');
            video.load();
        };
    }, [source, duration]);

    return frames.source === source ? frames.images : [];
}

export function VideoFrameTimeline({
    source,
    duration,
    offset,
    disabled,
    onSelect,
}: {
    source: string;
    duration: number;
    offset: number;
    disabled: boolean;
    onSelect: (time: number) => void;
}) {
    const images = useVideoFrames(source, duration);
    const dragging = useRef(false);
    const lastSelected = Math.max(0, duration - 0.1);
    const selectAt = (clientX: number, element: HTMLElement) => {
        const bounds = element.getBoundingClientRect();

        if (bounds.width <= 0) {
            return;
        }

        const fraction = Math.max(
            0,
            Math.min(1, (clientX - bounds.left) / bounds.width),
        );
        onSelect(Math.round(fraction * lastSelected * 10) / 10);
    };

    return (
        <div
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="Pilih bingkai video"
            aria-valuemin={0}
            aria-valuemax={lastSelected}
            aria-valuenow={offset}
            aria-valuetext={`${offset.toFixed(1)} detik`}
            aria-disabled={disabled}
            className="relative flex h-24 cursor-grab touch-none overflow-hidden rounded-lg bg-zinc-950 outline-none select-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:cursor-grabbing"
            onPointerDown={(event) => {
                if (disabled) {
                    return;
                }

                dragging.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                selectAt(event.clientX, event.currentTarget);
            }}
            onPointerMove={(event) => {
                if (dragging.current && !disabled) {
                    selectAt(event.clientX, event.currentTarget);
                }
            }}
            onPointerUp={(event) => {
                if (dragging.current && !disabled) {
                    selectAt(event.clientX, event.currentTarget);
                }

                dragging.current = false;
            }}
            onPointerCancel={() => {
                dragging.current = false;
            }}
            onLostPointerCapture={() => {
                dragging.current = false;
            }}
            onKeyDown={(event) => {
                if (disabled) {
                    return;
                }

                const step = event.shiftKey ? 1 : 0.1;
                const next =
                    event.key === 'ArrowRight' || event.key === 'ArrowUp'
                        ? offset + step
                        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                          ? offset - step
                          : event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? lastSelected
                              : null;

                if (next === null) {
                    return;
                }

                event.preventDefault();
                onSelect(
                    Math.round(Math.max(0, Math.min(lastSelected, next)) * 10) /
                        10,
                );
            }}
        >
            {Array.from({ length: 8 }, (_, index) => {
                const time = (index / 7) * Math.max(0, duration - 0.1);
                const image = images[index];

                return (
                    <div
                        key={index}
                        aria-hidden="true"
                        className="pointer-events-none relative min-w-0 flex-1 border-r border-white/10"
                    >
                        {image ? (
                            <img
                                src={image}
                                alt=""
                                className="h-full w-full object-contain"
                            />
                        ) : (
                            <span className="text-[10px] text-zinc-400">
                                {time.toFixed(1)}s
                            </span>
                        )}
                    </div>
                );
            })}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-10 w-1 rounded-full bg-emerald-500 shadow-[0_0_0_2px_#fff,0_0_8px_#10b981]"
                style={{
                    left: `calc(${Math.min(1, offset / Math.max(0.1, lastSelected)) * 100}% - 2px)`,
                }}
            />
        </div>
    );
}
