import { router } from '@inertiajs/react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FeedbackToast } from '@/components/feedback-toast';
import type { Feedback } from '@/components/feedback-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    cropArea,
    invalidPhotoMessage,
    mutatePhoto,
    validatePhoto,
} from '@/lib/profile-photo';
import type { User } from '@/types';

export default function ProfilePhoto({ user }: { user: User }) {
    const input = useRef<HTMLInputElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const request = useRef(false);
    const selection = useRef(0);
    const drag = useRef<{
        x: number;
        y: number;
        position: { x: number; y: number };
    } | null>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [avatar, setAvatar] = useState<string | null | undefined>(
        user.avatar,
    );
    useEffect(() => {
        setAvatar(user.avatar);
    }, [user.avatar]);
    useEffect(() => {
        if (!image) {
            return;
        }

        const context = canvas.current?.getContext('2d');

        if (!context) {
            return;
        }

        const crop = cropArea(
            image.naturalWidth,
            image.naturalHeight,
            zoom,
            position.x,
            position.y,
        );
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 512, 512);
        context.drawImage(
            image,
            crop.x,
            crop.y,
            crop.size,
            crop.size,
            0,
            0,
            512,
            512,
        );
    }, [image, zoom, position]);
    async function choose(file?: File) {
        if (!file || request.current) {
            return;
        }

        const current = ++selection.current;
        let url: string | undefined;

        try {
            validatePhoto(file);
            url = URL.createObjectURL(file);
            const decoded = new Image();
            decoded.src = url;
            await decoded.decode();

            if (!decoded.naturalWidth || !decoded.naturalHeight) {
                throw new Error(invalidPhotoMessage);
            }

            if (current !== selection.current) {
                return;
            }

            setZoom(1);
            setPosition({ x: 0.5, y: 0.5 });
            setError('');
            setImage(decoded);
        } catch {
            setFeedback({ variant: 'error', message: invalidPhotoMessage });
        } finally {
            if (url) {
                URL.revokeObjectURL(url);
            }
        }
    }
    async function save(remove = false) {
        if (request.current) {
            return;
        }

        request.current = true;
        setBusy(true);
        setError('');

        try {
            const blob = remove
                ? null
                : await new Promise<Blob>((resolve, reject) => {
                      if (!canvas.current || !image) {
                          reject(new Error('Sila pilih semula foto.'));

                          return;
                      }

                      canvas.current.toBlob(
                          (value) =>
                              value
                                  ? resolve(value)
                                  : reject(
                                        new Error('Foto tidak dapat diproses.'),
                                    ),
                          'image/jpeg',
                          0.9,
                      );
                  });
            const result = await mutatePhoto(blob);
            setAvatar(result.avatar);
            setImage(null);
            setFeedback({
                variant: 'success',
                message: remove
                    ? 'Foto profil dibuang.'
                    : 'Foto profil disimpan.',
            });
            router.reload({ only: ['auth', 'comments'] });
        } catch (failure) {
            const message =
                failure instanceof Error
                    ? failure.message
                    : 'Foto tidak dapat disimpan. Sila cuba lagi.';

            if (remove) {
                setFeedback({ variant: 'error', message });
            } else {
                setError(message);
            }
        } finally {
            request.current = false;
            setBusy(false);
        }
    }
    const initial =
        Array.from(user.name.trim())[0]?.toLocaleUpperCase('id') || 'U';

    return (
        <section
            aria-label="Foto Profil"
            className="space-y-4 border-b border-border pb-6"
        >
            <FeedbackToast
                feedback={feedback}
                onDismiss={() => setFeedback(null)}
                duration={5000}
            />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar className="size-24 shrink-0 border-2 border-primary">
                    <AvatarImage src={avatar ?? undefined} alt={user.name} />
                    <AvatarFallback className="text-3xl">
                        {initial}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-3">
                    <div>
                        <h2 className="text-lg font-semibold">Foto Profil</h2>
                        <p className="text-sm text-muted-foreground">
                            Gunakan foto profil untuk memperibadikan akaun anda.
                        </p>
                    </div>
                    <input
                        ref={input}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        tabIndex={-1}
                        aria-label="Pilih foto profil"
                        disabled={busy}
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            void choose(file);
                        }}
                    />
                    <div className="flex flex-wrap gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => input.current?.click()}
                        >
                            <Upload className="size-4" />
                            Muat naik foto
                        </Button>
                        {avatar && (
                            <Button
                                type="button"
                                variant="outline"
                                className="text-destructive"
                                disabled={busy}
                                onClick={() => void save(true)}
                            >
                                {busy ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Trash2 className="size-4" />
                                )}
                                Buang foto
                            </Button>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Format: JPG, PNG, WEBP · Saiz maksimum: 5 MB
                    </p>
                </div>
            </div>
            <Dialog
                open={!!image}
                onOpenChange={(open) => {
                    if (!open && !request.current) {
                        setImage(null);
                    }
                }}
            >
                <DialogContent
                    className="max-h-[90dvh] overflow-y-auto rounded-xl"
                    closeDisabled={busy}
                    closeLabel="Batal"
                >
                    <DialogHeader>
                        <DialogTitle>Sesuaikan Foto Profil</DialogTitle>
                        <DialogDescription>
                            Pangkas foto untuk menyesuaikan kawasan yang ingin
                            dipaparkan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mx-auto w-full max-w-80 space-y-4">
                        <div className="relative aspect-square overflow-hidden rounded-lg border bg-secondary">
                            <canvas
                                ref={canvas}
                                width={512}
                                height={512}
                                tabIndex={0}
                                role="img"
                                aria-label="Pangkas foto. Seret untuk mengubah kedudukan atau gunakan kekunci anak panah."
                                className="block size-full cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
                                onPointerDown={(e) => {
                                    if (busy) {
                                        return;
                                    }

                                    e.currentTarget.setPointerCapture(
                                        e.pointerId,
                                    );
                                    drag.current = {
                                        x: e.clientX,
                                        y: e.clientY,
                                        position,
                                    };
                                }}
                                onPointerMove={(e) => {
                                    if (!drag.current || !image || busy) {
                                        return;
                                    }

                                    const crop = cropArea(
                                        image.naturalWidth,
                                        image.naturalHeight,
                                        zoom,
                                        position.x,
                                        position.y,
                                    );
                                    const scale =
                                        crop.size /
                                        e.currentTarget.getBoundingClientRect()
                                            .width;
                                    const start = drag.current;
                                    setPosition({
                                        x: Math.max(
                                            0,
                                            Math.min(
                                                1,
                                                start.position.x -
                                                    ((e.clientX - start.x) *
                                                        scale) /
                                                        (image.naturalWidth -
                                                            crop.size || 1),
                                            ),
                                        ),
                                        y: Math.max(
                                            0,
                                            Math.min(
                                                1,
                                                start.position.y -
                                                    ((e.clientY - start.y) *
                                                        scale) /
                                                        (image.naturalHeight -
                                                            crop.size || 1),
                                            ),
                                        ),
                                    });
                                }}
                                onPointerUp={() => {
                                    drag.current = null;
                                }}
                                onPointerCancel={() => {
                                    drag.current = null;
                                }}
                                onKeyDown={(e) => {
                                    if (
                                        busy ||
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
                                    setPosition((p) => ({
                                        x: Math.max(
                                            0,
                                            Math.min(
                                                1,
                                                p.x +
                                                    (e.key === 'ArrowLeft'
                                                        ? -0.02
                                                        : e.key === 'ArrowRight'
                                                          ? 0.02
                                                          : 0),
                                            ),
                                        ),
                                        y: Math.max(
                                            0,
                                            Math.min(
                                                1,
                                                p.y +
                                                    (e.key === 'ArrowUp'
                                                        ? -0.02
                                                        : e.key === 'ArrowDown'
                                                          ? 0.02
                                                          : 0),
                                            ),
                                        ),
                                    }));
                                }}
                            />
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 rounded-full border-2 border-white shadow-[0_0_0_100px_#0006]"
                            />
                        </div>
                        <label className="block space-y-2 text-sm font-medium">
                            Zum
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.01}
                                value={zoom}
                                disabled={busy}
                                onChange={(e) =>
                                    setZoom(Number(e.target.value))
                                }
                                className="block w-full accent-primary"
                            />
                        </label>
                    </div>
                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setImage(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            disabled={busy}
                            className="min-h-10 rounded-lg"
                            onClick={() => void save()}
                        >
                            {busy && (
                                <Loader2 className="size-4 animate-spin" />
                            )}
                            {busy ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
