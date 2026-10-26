import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';

export type CoverCrop = {
    mode: 'fit' | 'crop';
    x: number;
    y: number;
    zoom: number;
};
export const defaultCoverCrop: CoverCrop = {
    mode: 'fit',
    x: 0.5,
    y: 0.5,
    zoom: 1,
};

export async function coverPoster(
    source: string,
    crop: CoverCrop,
): Promise<string> {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d')!;
    const w = image.naturalWidth,
        h = image.naturalHeight;

    if (crop.mode === 'fit') {
        const bg = Math.max(1080 / w, 1920 / h);
        ctx.filter = 'blur(30px)';
        ctx.drawImage(
            image,
            (1080 - w * bg) / 2,
            (1920 - h * bg) / 2,
            w * bg,
            h * bg,
        );
        ctx.filter = 'none';
        const scale = Math.min(1080 / w, 1920 / h);
        ctx.drawImage(
            image,
            (1080 - w * scale) / 2,
            (1920 - h * scale) / 2,
            w * scale,
            h * scale,
        );
    } else {
        const cw = Math.max(
            1,
            Math.round(Math.min(w, (h * 9) / 16) / crop.zoom),
        );
        const ch = Math.max(
            1,
            Math.round(Math.min(h, (w * 16) / 9) / crop.zoom),
        );
        ctx.drawImage(
            image,
            Math.round((w - cw) * crop.x),
            Math.round((h - ch) * crop.y),
            cw,
            ch,
            0,
            0,
            1080,
            1920,
        );
    }

    return canvas.toDataURL('image/jpeg', 0.92);
}

export function CoverPreview({
    source,
    crop,
    onSize,
}: {
    source: string;
    crop: CoverCrop;
    onSize?: (size: { width: number; height: number }) => void;
}) {
    return (
        <>
            {crop.mode === 'fit' && (
                <img
                    src={source}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
                />
            )}
            <img
                src={source}
                alt="Foto sampul terpilih"
                draggable={false}
                onLoad={(event) =>
                    onSize?.({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                    })
                }
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{
                    objectFit: crop.mode === 'fit' ? 'contain' : 'cover',
                    objectPosition:
                        crop.mode === 'fit'
                            ? '50% 50%'
                            : `${crop.x * 100}% ${crop.y * 100}%`,
                    transform:
                        crop.mode === 'crop'
                            ? `scale(${crop.zoom})`
                            : undefined,
                    transformOrigin: `${crop.x * 100}% ${crop.y * 100}%`,
                }}
            />
        </>
    );
}

export function ShortCoverDialog({
    source,
    initial,
    onClose,
    onApply,
}: {
    source: string;
    initial: CoverCrop;
    onClose: () => void;
    onApply: (crop: CoverCrop) => void;
}) {
    const [crop, setCrop] = useState(initial);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const drag = useRef<{ x: number; y: number; crop: CoverCrop } | null>(null);
    const clamp = (n: number) => Math.max(0, Math.min(1, n));

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-lg">
                <DialogTitle>Pangkas Sampul</DialogTitle>
                <DialogDescription>
                    Sesuaikan seluruh foto atau geser dan zoom dalam bingkai
                    9:16.
                </DialogDescription>
                <div className="flex gap-2">
                    {(['fit', 'crop'] as const).map((mode) => (
                        <Button
                            key={mode}
                            variant={crop.mode === mode ? 'default' : 'outline'}
                            className={
                                crop.mode === mode
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : ''
                            }
                            onClick={() => setCrop({ ...crop, mode })}
                        >
                            {mode === 'fit'
                                ? 'Sesuaikan (Fit)'
                                : 'Pangkas (Crop)'}
                        </Button>
                    ))}
                </div>
                <div
                    role="group"
                    aria-label="Pratinjau sampul 9:16"
                    tabIndex={0}
                    className="relative mx-auto aspect-[9/16] h-[min(50dvh,440px)] max-w-full touch-none overflow-hidden rounded-lg bg-black"
                    onPointerDown={(e) => {
                        if (crop.mode !== 'crop') {
                            return;
                        }

                        e.currentTarget.setPointerCapture(e.pointerId);
                        drag.current = { x: e.clientX, y: e.clientY, crop };
                    }}
                    onPointerMove={(e) => {
                        if (!drag.current || !size.width) {
                            return;
                        }

                        const bounds = e.currentTarget.getBoundingClientRect();
                        const scale =
                            Math.max(
                                bounds.width / size.width,
                                bounds.height / size.height,
                            ) * crop.zoom;
                        const dx = size.width * scale - bounds.width;
                        const dy = size.height * scale - bounds.height;
                        setCrop({
                            ...drag.current.crop,
                            x:
                                dx > 0
                                    ? clamp(
                                          drag.current.crop.x -
                                              (e.clientX - drag.current.x) / dx,
                                      )
                                    : 0.5,
                            y:
                                dy > 0
                                    ? clamp(
                                          drag.current.crop.y -
                                              (e.clientY - drag.current.y) / dy,
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
                    onKeyDown={(e) => {
                        if (
                            crop.mode !== 'crop' ||
                            ![
                                'ArrowLeft',
                                'ArrowRight',
                                'ArrowUp',
                                'ArrowDown',
                            ].includes(e.key)
                        ) {
                            return;
                        }

                        e.preventDefault();
                        setCrop({
                            ...crop,
                            x: clamp(
                                crop.x +
                                    (e.key === 'ArrowLeft'
                                        ? 0.02
                                        : e.key === 'ArrowRight'
                                          ? -0.02
                                          : 0),
                            ),
                            y: clamp(
                                crop.y +
                                    (e.key === 'ArrowUp'
                                        ? 0.02
                                        : e.key === 'ArrowDown'
                                          ? -0.02
                                          : 0),
                            ),
                        });
                    }}
                >
                    <CoverPreview
                        source={source}
                        crop={crop}
                        onSize={setSize}
                    />
                </div>
                <label className="space-y-2 text-sm">
                    Zoom
                    <input
                        aria-label="Zoom sampul"
                        className="w-full accent-emerald-600"
                        type="range"
                        min={1}
                        max={4}
                        step={0.01}
                        value={crop.zoom}
                        disabled={crop.mode === 'fit'}
                        onChange={(e) =>
                            setCrop({ ...crop, zoom: Number(e.target.value) })
                        }
                    />
                </label>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        disabled={!size.width}
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => {
                            onApply(crop);
                            onClose();
                        }}
                    >
                        Terapkan
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
