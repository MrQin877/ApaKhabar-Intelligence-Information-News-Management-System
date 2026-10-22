import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useVideoFrames } from '@/components/video-frame-timeline';

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));
const timestamp = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${Math.floor((seconds % 1) * 10)}`;
const MIN_LENGTH = 0.1;

export function VideoTrimTimeline({
    source,
    duration,
    start,
    end,
    currentTime,
    disabled,
    onStart,
    onEnd,
    onSeek,
}: {
    source: string;
    duration: number;
    start: number;
    end: number;
    currentTime: number;
    disabled: boolean;
    onStart: (value: number) => void;
    onEnd: (value: number) => void;
    onSeek: (value: number) => void;
}) {
    const images = useVideoFrames(source, duration);
    const track = useRef<HTMLDivElement>(null);
    const dragging = useRef<'start' | 'end' | null>(null);
    const max = Math.max(duration, MIN_LENGTH);
    const position = (clientX: number) => {
        const bounds = track.current?.getBoundingClientRect();

        if (!bounds?.width) {
            return null;
        }

        return (
            Math.round(
                clamp((clientX - bounds.left) / bounds.width, 0, 1) *
                    duration *
                    100,
            ) / 100
        );
    };
    const update = (side: 'start' | 'end', clientX: number) => {
        const time = position(clientX);

        if (time === null) {
            return;
        }

        if (side === 'start') {
            onStart(clamp(time, 0, end - MIN_LENGTH));
        } else {
            onEnd(clamp(time, start + MIN_LENGTH, duration));
        }
    };
    const key = (side: 'start' | 'end', event: KeyboardEvent) => {
        if (disabled) {
            return;
        }

        const value = side === 'start' ? start : end;
        const step = event.shiftKey ? 1 : 0.1;
        const next =
            event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? duration
                  : event.key === 'ArrowRight' || event.key === 'ArrowUp'
                    ? value + step
                    : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                      ? value - step
                      : null;

        if (next === null) {
            return;
        }

        event.preventDefault();

        if (side === 'start') {
            onStart(clamp(Math.round(next * 100) / 100, 0, end - MIN_LENGTH));
        } else {
            onEnd(
                clamp(
                    Math.round(next * 100) / 100,
                    start + MIN_LENGTH,
                    duration,
                ),
            );
        }
    };
    const handle = (side: 'start' | 'end', value: number) => (
        <div
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={side === 'start' ? 'Awal potongan' : 'Akhir potongan'}
            aria-valuemin={side === 'start' ? 0 : start + MIN_LENGTH}
            aria-valuemax={side === 'start' ? end - MIN_LENGTH : duration}
            aria-valuenow={value}
            aria-valuetext={`${timestamp(value)} detik`}
            aria-disabled={disabled}
            className={`pointer-events-auto absolute top-0 z-20 h-full w-4 cursor-grab touch-none rounded-md bg-emerald-500 shadow-md outline-none focus-visible:ring-2 focus-visible:ring-white active:cursor-grabbing ${side === 'start' ? 'left-0' : 'right-0'}`}
            onPointerDown={(event) => {
                if (disabled) {
                    return;
                }

                event.stopPropagation();
                dragging.current = side;
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
                if (dragging.current === side && !disabled) {
                    update(side, event.clientX);
                }
            }}
            onPointerUp={(event) => {
                if (dragging.current === side && !disabled) {
                    update(side, event.clientX);
                }

                dragging.current = null;
            }}
            onPointerCancel={() => {
                dragging.current = null;
            }}
            onLostPointerCapture={() => {
                dragging.current = null;
            }}
            onKeyDown={(event) => key(side, event)}
        >
            <span
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white"
            />
        </div>
    );

    return (
        <div className="space-y-2" aria-label="Potong durasi video">
            <div className="relative pt-7">
                <span
                    className={`absolute top-0 rounded bg-emerald-600 px-1.5 py-0.5 text-xs text-white tabular-nums ${start === 0 ? '' : '-translate-x-1/2'}`}
                    style={{ left: `${(start / max) * 100}%` }}
                >
                    {timestamp(start)}
                </span>
                <span
                    className={`absolute top-0 rounded bg-emerald-600 px-1.5 py-0.5 text-xs text-white tabular-nums ${end === duration ? '-translate-x-full' : '-translate-x-1/2'}`}
                    style={{ left: `${(end / max) * 100}%` }}
                >
                    {timestamp(end)}
                </span>
                <div
                    ref={track}
                    className="relative flex h-20 cursor-grab overflow-hidden rounded-lg bg-zinc-950"
                    onPointerDown={(event) => {
                        if (disabled || event.target !== event.currentTarget) {
                            return;
                        }

                        const time = position(event.clientX);

                        if (time !== null) {
                            onSeek(clamp(time, start, end));
                        }
                    }}
                >
                    {Array.from({ length: 8 }, (_, index) => (
                        <div
                            key={index}
                            className="pointer-events-none min-w-0 flex-1 border-r border-white/10"
                        >
                            {images[index] ? (
                                <img
                                    src={images[index]}
                                    alt=""
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <span className="text-[10px] text-zinc-400">
                                    {timestamp((index / 7) * duration)}
                                </span>
                            )}
                        </div>
                    ))}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-0 bg-black/60"
                        style={{ width: `${(start / max) * 100}%` }}
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 right-0 bg-black/60"
                        style={{ width: `${((duration - end) / max) * 100}%` }}
                    />
                    <div
                        className="pointer-events-none absolute inset-y-0 border-y-2 border-emerald-500"
                        style={{
                            left: `${(start / max) * 100}%`,
                            right: `${((duration - end) / max) * 100}%`,
                        }}
                    >
                        {handle('start', start)}
                        {handle('end', end)}
                    </div>
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white/80"
                        style={{ left: `${(currentTime / max) * 100}%` }}
                    />
                </div>
            </div>
            <p className="text-right text-xs text-muted-foreground">
                Durasi dipilih: {timestamp(end - start)} / {timestamp(duration)}
            </p>
        </div>
    );
}
