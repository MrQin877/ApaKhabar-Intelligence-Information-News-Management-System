import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
    clamp,
    cropPlatforms,
    cropRectangle,
    defaultCrops,
    updateCrop,
} from '@/lib/image-crops';
import type { Crop, CropPlatform, ImageCrops } from '@/lib/image-crops';

function Preview({
    image,
    platform,
    crop,
    onChange,
}: {
    image: HTMLImageElement;
    platform: CropPlatform;
    crop: Crop;
    onChange: (crop: Crop) => void;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);
    const spec = cropPlatforms[platform];
    const rectangle = cropRectangle(
        image.naturalWidth,
        image.naturalHeight,
        platform,
        crop,
    );
    useEffect(() => {
        const context = canvas.current?.getContext('2d');

        if (!context) {
            return;
        }

        context.fillStyle = '#fff';
        context.fillRect(0, 0, spec.width, spec.height);
        context.drawImage(
            image,
            rectangle.x,
            rectangle.y,
            rectangle.width,
            rectangle.height,
            0,
            0,
            spec.width,
            spec.height,
        );
    }, [
        image,
        rectangle.x,
        rectangle.y,
        rectangle.width,
        rectangle.height,
        spec,
    ]);

    return (
        <section className="min-w-0 space-y-3">
            <div className="flex items-center justify-between text-sm font-medium">
                <span>{spec.label}</span>
                <span className="text-xs text-muted-foreground">
                    {spec.ratio}
                </span>
            </div>
            <canvas
                ref={canvas}
                width={spec.width}
                height={spec.height}
                tabIndex={0}
                aria-label={`Atur posisi gambar ${spec.label}. Geser atau gunakan tombol panah.`}
                className="block w-full cursor-grab touch-none rounded-lg border focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    // Start from the visible center, so dragging at image edges has no dead zone.
                    drag.current = {
                        x: event.clientX,
                        y: event.clientY,
                        crop: {
                            ...crop,
                            x:
                                (rectangle.x + rectangle.width / 2) /
                                image.naturalWidth,
                            y:
                                (rectangle.y + rectangle.height / 2) /
                                image.naturalHeight,
                        },
                    };
                }}
                onPointerMove={(event) => {
                    if (!drag.current) {
                        return;
                    }

                    const box = event.currentTarget.getBoundingClientRect();
                    onChange({
                        ...crop,
                        x: clamp(
                            drag.current.crop.x -
                                (((event.clientX - drag.current.x) /
                                    box.width) *
                                    rectangle.width) /
                                    image.naturalWidth,
                        ),
                        y: clamp(
                            drag.current.crop.y -
                                (((event.clientY - drag.current.y) /
                                    box.height) *
                                    rectangle.height) /
                                    image.naturalHeight,
                        ),
                    });
                }}
                onPointerUp={() => {
                    drag.current = null;
                }}
                onPointerCancel={() => {
                    drag.current = null;
                }}
                onKeyDown={(event) => {
                    const delta: Record<string, [number, number]> = {
                        ArrowLeft: [-0.01, 0],
                        ArrowRight: [0.01, 0],
                        ArrowUp: [0, -0.01],
                        ArrowDown: [0, 0.01],
                    };

                    if (!delta[event.key]) {
                        return;
                    }

                    event.preventDefault();
                    onChange({
                        ...crop,
                        x: clamp(crop.x + delta[event.key][0]),
                        y: clamp(crop.y + delta[event.key][1]),
                    });
                }}
            />
            <label className="flex items-center gap-3 text-xs text-muted-foreground">
                Zoom
                <input
                    aria-label={`Zoom ${spec.label}`}
                    type="range"
                    min="1"
                    max="4"
                    step="0.01"
                    value={crop.zoom}
                    className="min-w-0 flex-1"
                    onChange={(event) =>
                        onChange({ ...crop, zoom: Number(event.target.value) })
                    }
                />
                <span>{crop.zoom.toFixed(2)}×</span>
            </label>
        </section>
    );
}

export function NewsImageCropDialog({
    src,
    initial,
    onClose,
    onReplace,
    onSave,
}: {
    src: string;
    initial: ImageCrops | null;
    onClose: () => void;
    onReplace: () => void;
    onSave: (crops: ImageCrops) => void;
}) {
    const [crops, setCrops] = useState(initial ?? defaultCrops);
    const [image, setImage] = useState<HTMLImageElement>();
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const loaded = new Image();
        loaded.onload = () => setImage(loaded);
        loaded.onerror = () => setFailed(true);
        loaded.src = src;

        return () => {
            loaded.onload = null;
            loaded.onerror = null;
        };
    }, [src]);
    function change(platform: CropPlatform, crop: Crop) {
        setCrops((previous) => updateCrop(previous, platform, crop));
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Pratinjau & Sesuaikan</DialogTitle>
                    <DialogDescription>
                        Geser gambar untuk memilih fokus, lalu atur zoom di
                        setiap platform. Gambar asli tetap tersimpan.
                    </DialogDescription>
                </DialogHeader>
                <label className="flex items-center gap-3 text-sm">
                    <Switch
                        checked={crops.sync}
                        onCheckedChange={(sync) =>
                            setCrops((previous) => ({
                                ...previous,
                                sync,
                                ...(sync
                                    ? {
                                          instagram: {
                                              ...previous.instagram,
                                              x: previous.website.x,
                                              y: previous.website.y,
                                          },
                                          facebook: {
                                              ...previous.facebook,
                                              x: previous.website.x,
                                              y: previous.website.y,
                                          },
                                      }
                                    : {}),
                            }))
                        }
                    />
                    Sinkronkan posisi gambar
                </label>
                <p className="text-xs text-muted-foreground">
                    Saat sinkronisasi diaktifkan kembali, posisi mengikuti
                    Aplikasi. Zoom diatur terpisah.
                </p>
                {failed ? (
                    <p role="alert" className="text-sm text-destructive">
                        Gambar tidak dapat dibuka. Silakan unggah kembali.
                    </p>
                ) : image ? (
                    <div className="grid gap-6 md:grid-cols-3">
                        {(Object.keys(cropPlatforms) as CropPlatform[]).map(
                            (platform) => (
                                <Preview
                                    key={platform}
                                    image={image}
                                    platform={platform}
                                    crop={crops[platform]}
                                    onChange={(crop) => change(platform, crop)}
                                />
                            ),
                        )}
                    </div>
                ) : (
                    <p role="status">Memuat gambar…</p>
                )}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onReplace}>
                        Ganti gambar
                    </Button>
                    <Button
                        type="button"
                        disabled={!image || failed}
                        onClick={() => onSave(crops)}
                    >
                        Simpan penyesuaian
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
