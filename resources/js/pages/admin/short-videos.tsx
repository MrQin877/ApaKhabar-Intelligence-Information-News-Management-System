import { Head, router, usePoll } from '@inertiajs/react';
import {
    Upload,
    Video,
    LoaderCircle,
    Pencil,
    ImagePlus,
    Film,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PublicationPreviewData } from '@/components/publication-preview';
import { PublishNewsDialog } from '@/components/publish-news-dialog';
import type {
    PublishPlatform,
    PublishPlatformId,
} from '@/components/publish-news-dialog';
import { PublishResultDialog } from '@/components/publish-result-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUnsavedNews } from '@/hooks/use-unsaved-news';
import AppLayout from '@/layouts/app-layout';
import { editorSnapshot } from '@/lib/editor-snapshot';
import type { PublishResult } from '@/lib/manual-publish';
import { metaRequest } from '@/lib/meta-auth';
import type { MetaAuthConfig } from '@/lib/meta-auth';

type ShortVideo = {
    id: number;
    title: string;
    description: string;
    video_url: string;
    thumbnail_url: string;
    frame_offset: number;
    status: string;
    metadata: { duration: number };
    publications?: {
        platform: string;
        status: string;
        account_name: string | null;
    }[];
};
function savedVideoState(video: ShortVideo | null) {
    return {
        title: video?.title ?? '',
        description: video?.description ?? '',
        media: video?.video_url ?? '',
        offset: video?.frame_offset ?? 0,
        thumbnail: video?.thumbnail_url.includes('/video/upload/')
            ? `frame:${video.frame_offset}`
            : (video?.thumbnail_url ?? ''),
        cover: null as File | null,
    };
}
type Result = { video: ShortVideo; result: PublishResult };
const statusNames: Record<string, string> = {
    draft: 'Draf',
    published: 'Diterbitkan',
    archived: 'Diarsipkan',
    queued: 'Menunggu',
    processing: 'Diproses',
    failed: 'Gagal',
    uncertain: 'Belum pasti',
};

function upload(
    path: string,
    body: FormData,
    onProgress?: (progress: number) => void,
): Promise<{ video: ShortVideo }> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', path);
        xhr.setRequestHeader('Accept', 'application/json');
        const cookie = document.cookie
            .split(';')
            .map((v) => v.trim())
            .find((v) => v.startsWith('XSRF-TOKEN='));

        if (cookie) {
            xhr.setRequestHeader(
                'X-XSRF-TOKEN',
                decodeURIComponent(cookie.slice(11)),
            );
        } else {
            xhr.setRequestHeader(
                'X-CSRF-TOKEN',
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '',
            );
        }

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                onProgress?.(Math.round((event.loaded / event.total) * 100));
            }
        };
        xhr.onload = () => {
            try {
                const data = JSON.parse(xhr.responseText);

                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(data);
                } else {
                    reject(
                        new Error(
                            Object.values(data.errors ?? {})
                                .flat()
                                .join(' ') ||
                                data.message ||
                                'Permintaan gagal.',
                        ),
                    );
                }
            } catch {
                reject(
                    new Error(
                        'Respons server tidak valid. Periksa batas unggahan dan sesi masuk.',
                    ),
                );
            }
        };
        xhr.onerror = () =>
            reject(
                new Error(
                    'Koneksi terputus. Periksa daftar draf sebelum mengunggah ulang.',
                ),
            );
        xhr.send(body);
    });
}

export default function ShortVideos({
    videos,
    publishPlatforms,
    metaAuth,
}: {
    videos: { data: ShortVideo[]; current_page: number; last_page: number };
    publishPlatforms: PublishPlatform[];
    metaAuth: MetaAuthConfig;
}) {
    usePoll(10000, { only: ['videos'] });
    const [current, setCurrent] = useState<ShortVideo | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [source, setSource] = useState('');
    const [thumbnail, setThumbnail] = useState('');
    const [duration, setDuration] = useState(0);
    const [offset, setOffset] = useState(0);
    const [cover, setCover] = useState<File | null>(null);
    const [coverMode, setCoverMode] = useState<'keep' | 'frame' | 'upload'>(
        'keep',
    );
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [dialog, setDialog] = useState(false);
    const [selected, setSelected] = useState<PublishPlatformId[]>(['website']);
    const [result, setResult] = useState<PublishResult>();
    const [resultId, setResultId] = useState<number | null>(null);
    const [confirmation, setConfirmation] = useState<{
        video: ShortVideo;
        action: 'archive' | 'delete';
    } | null>(null);
    const [dragging, setDragging] = useState(false);
    const [frameOpen, setFrameOpen] = useState(false);
    const coverInput = useRef<HTMLInputElement>(null);
    const framePlayer = useRef<HTMLVideoElement>(null);
    const player = useRef<HTMLVideoElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const guard = useRef(false);
    const [savedSnapshot, setSavedSnapshot] = useState(() =>
        editorSnapshot(savedVideoState(null)),
    );
    const snapshot = editorSnapshot({
        title,
        description,
        media: current?.video_url ?? (progress !== null ? 'uploading' : ''),
        offset,
        thumbnail:
            coverMode === 'frame'
                ? `frame:${offset}`
                : coverMode === 'upload'
                  ? 'custom'
                  : savedVideoState(current).thumbnail,
        cover: coverMode === 'upload' ? cover : null,
    });
    const unsaved = useUnsavedNews(snapshot !== savedSnapshot, busy);

    useEffect(
        () => () => {
            if (source.startsWith('blob:')) {
                URL.revokeObjectURL(source);
            }
        },
        [source],
    );
    useEffect(
        () => () => {
            if (thumbnail.startsWith('blob:')) {
                URL.revokeObjectURL(thumbnail);
            }
        },
        [thumbnail],
    );
    useEffect(() => {
        if (!resultId) {
            return;
        }

        let stopped = false;
        const timer = window.setInterval(() => {
            void metaRequest<Result>(`/admin/short-videos/${resultId}/status`)
                .then((data) => {
                    if (!stopped) {
                        setResult((previous) => ({
                            ...data.result,
                            attempt_id:
                                previous?.attempt_id ?? data.result.attempt_id,
                        }));
                    }
                })
                .catch(() => {
                    if (!stopped) {
                        setError(
                            'Status belum dapat diperbarui. Periksa koneksi.',
                        );
                    }
                });
        }, 5000);

        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, [resultId]);
    const refresh = () => router.reload({ only: ['videos'] });
    function edit(video: ShortVideo) {
        setSavedSnapshot(editorSnapshot(savedVideoState(video)));
        setCurrent(video);
        setTitle(video.title);
        setDescription(video.description ?? '');
        setSource(video.video_url);
        setThumbnail(video.thumbnail_url);
        setOffset(video.frame_offset);
        setDuration(video.metadata.duration);
        setCover(null);
        setCoverMode('keep');
        setError('');
        setMessage('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function selectVideo(file?: File) {
        if (!file || guard.current) {
            return;
        }

        if (file.type !== 'video/mp4' || file.size > 100 * 1024 * 1024) {
            setError('Pilih MP4 H.264 maksimal 100 MB.');

            return;
        }

        void uploadVideo(file);
    }
    async function uploadVideo(file: File) {
        if (!file || guard.current) {
            return;
        }

        if (
            !['video/mp4'].includes(file.type) ||
            file.size > 100 * 1024 * 1024
        ) {
            setError('Pilih MP4 H.264 maksimal 100 MB.');

            return;
        }

        guard.current = true;
        setBusy(true);
        setError('');
        setCurrent(null);
        setDuration(0);
        setFrameOpen(false);
        setMessage('');
        setCover(null);
        setCoverMode('keep');
        setOffset(0);
        setThumbnail('');
        setSource(URL.createObjectURL(file));
        setProgress(0);

        try {
            const body = new FormData();
            body.append('video', file);
            const data = await upload(
                '/admin/short-videos/upload',
                body,
                setProgress,
            );
            setCurrent(data.video);
            setThumbnail(data.video.thumbnail_url);
            setDuration(data.video.metadata.duration);
            setMessage(
                'Video tersimpan sebagai draf. Lengkapi judul dan deskripsi.',
            );
            refresh();
        } catch (failure) {
            setError((failure as Error).message);
        } finally {
            guard.current = false;
            setBusy(false);
            setProgress(null);
        }
    }
    function frame(force = false) {
        const video = framePlayer.current;

        if (!video || !frameOpen || (!force && coverMode !== 'frame')) {
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            setThumbnail(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
            // Cloudinary frame delivery remains available when canvas CORS is restricted.
            if (current) {
                setThumbnail(
                    current.video_url
                        .replace(
                            '/upload/',
                            `/upload/so_${video.currentTime.toFixed(3)},f_jpg/`,
                        )
                        .replace(/\.mp4(?:\?.*)?$/, '.jpg'),
                );
            }
        }
    }
    function chooseFrame(value: number) {
        setOffset(value);
        setCover(null);
        setCoverMode('frame');

        if (framePlayer.current) {
            if (Math.abs(framePlayer.current.currentTime - value) < 0.001) {
                frame(true);
            } else {
                framePlayer.current.currentTime = value;
            }
        }
    }
    function selectCover(file?: File) {
        if (!file || busy) {
            return;
        }

        if (
            !['image/jpeg', 'image/png'].includes(file.type) ||
            file.size > 5 * 1024 * 1024
        ) {
            setError('Gunakan sampul JPG/PNG maksimal 5 MB.');

            return;
        }

        setError('');
        setCover(file);
        setCoverMode('upload');
        setThumbnail(URL.createObjectURL(file));
    }
    async function save(): Promise<ShortVideo> {
        if (!current) {
            throw new Error('Unggah video terlebih dahulu.');
        }

        const body = new FormData();
        body.append('title', title);
        body.append('description', description);
        body.append('frame_offset', String(offset));
        body.append('cover_mode', coverMode);

        if (cover) {
            body.append('cover', cover);
        }

        const data = await upload(`/admin/short-videos/${current.id}`, body);
        setCurrent(data.video);
        setTitle(data.video.title);
        setDescription(data.video.description ?? '');
        setOffset(data.video.frame_offset);
        setSavedSnapshot(editorSnapshot(savedVideoState(data.video)));
        setThumbnail(data.video.thumbnail_url);
        setCover(null);
        setCoverMode('keep');
        refresh();

        return data.video;
    }
    async function saveDraft() {
        if (guard.current) {
            return;
        }

        guard.current = true;
        setBusy(true);
        setError('');

        try {
            await save();
            setMessage('Draf berhasil disimpan.');

            if (unsaved.open) {
                unsaved.leave();
            }
        } catch (failure) {
            setError((failure as Error).message);
        } finally {
            setBusy(false);
            guard.current = false;
        }
    }
    async function prepare(): Promise<PublicationPreviewData> {
        const video = await save();

        return metaRequest<PublicationPreviewData>(
            `/admin/short-videos/${video.id}/preview`,
            { platforms: selected },
        );
    }
    async function publish(token: string) {
        if (!current || guard.current) {
            return;
        }

        guard.current = true;
        setBusy(true);
        setError('');

        try {
            const data = await metaRequest<Result>(
                `/admin/short-videos/${current.id}/publish`,
                { preview_token: token, platforms: selected },
            );
            setDialog(false);
            setSavedSnapshot(editorSnapshot(savedVideoState(data.video)));
            setCurrent(data.video);
            setResult(data.result);
            setResultId(data.video.id);
            refresh();
        } catch (failure) {
            setError((failure as Error).message);
        } finally {
            guard.current = false;
            setBusy(false);
        }
    }
    async function showStatus(video: ShortVideo) {
        try {
            const data = await metaRequest<Result>(
                `/admin/short-videos/${video.id}/status`,
            );
            setResult({
                ...data.result,
                attempt_id: `${data.result.attempt_id}-${Date.now()}`,
            });
            setResultId(video.id);
        } catch (failure) {
            setError((failure as Error).message);
        }
    }
    async function retry(platform: string) {
        if (!resultId || busy) {
            return;
        }

        setBusy(true);

        try {
            const data = await metaRequest<Result>(
                `/admin/short-videos/${resultId}/retry/${platform}`,
                {},
            );
            setResult(data.result);
            refresh();
        } catch (failure) {
            setError((failure as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Video Pendek', href: '/admin/short-videos' },
            ]}
        >
            <Head title="Video Pendek" />
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
                <div>
                    <h1 className="text-2xl font-semibold">Video Pendek</h1>
                    <p className="text-sm text-muted-foreground">
                        Publikasikan ke ApaKhabar dan akun sosial yang dipilih.
                    </p>
                </div>
                {error && (
                    <p
                        role="alert"
                        className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
                    >
                        {error}
                    </p>
                )}
                {message && (
                    <p
                        role="status"
                        className="rounded-lg bg-secondary p-3 text-sm"
                    >
                        {message}
                    </p>
                )}
                <div className="space-y-6 rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
                    <div className="space-y-2">
                        <Label htmlFor="short-video">Unggah Video</Label>
                        <div
                            className={`relative rounded-xl border-2 border-dashed transition-colors ${dragging ? 'border-primary bg-primary/10' : current && source ? 'border-primary bg-muted/20' : 'border-border bg-muted/20 hover:border-primary/40'}`}
                            onDragOver={(event) => {
                                event.preventDefault();

                                if (!busy) {
                                    setDragging(true);
                                }
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(event) => {
                                event.preventDefault();
                                setDragging(false);
                                selectVideo(event.dataTransfer.files[0]);
                            }}
                        >
                            <input
                                ref={fileInput}
                                id="short-video"
                                type="file"
                                accept="video/mp4"
                                className="sr-only"
                                disabled={busy}
                                onChange={(event) => {
                                    selectVideo(event.target.files?.[0]);
                                    event.target.value = '';
                                }}
                            />
                            <input
                                ref={coverInput}
                                aria-label="Unggah sampul"
                                type="file"
                                accept="image/jpeg,image/png"
                                className="sr-only"
                                disabled={
                                    busy ||
                                    !current ||
                                    current.status !== 'draft'
                                }
                                onChange={(event) => {
                                    selectCover(event.target.files?.[0]);
                                    event.target.value = '';
                                }}
                            />
                            {source ? (
                                <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl p-5 pt-14 text-center">
                                    <video
                                        key={source}
                                        ref={player}
                                        src={source}
                                        controls
                                        preload="metadata"
                                        poster={thumbnail || undefined}
                                        className="max-h-56 w-full rounded-lg object-contain"
                                    />
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                            fileInput.current?.click()
                                        }
                                        className="rounded text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        Klik untuk mengganti video
                                    </button>
                                    <span className="text-xs text-muted-foreground">
                                        MP4 H.264/AAC, maksimal 100 MB
                                    </span>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => fileInput.current?.click()}
                                    className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl p-5 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <span className="flex size-12 items-center justify-center rounded-full border bg-card text-primary shadow-sm">
                                        <Video className="size-5" />
                                    </span>
                                    <span className="text-sm font-medium">
                                        Klik untuk unggah atau seret video ke
                                        sini
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        MP4 H.264/AAC, maksimal 100 MB
                                    </span>
                                </button>
                            )}
                            {source && (
                                <div className="absolute top-3 right-3">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                className="h-8 rounded-full shadow-sm"
                                                disabled={
                                                    busy ||
                                                    !current ||
                                                    current.status !== 'draft'
                                                }
                                            >
                                                <Pencil className="size-3.5" />
                                                Edit
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onSelect={() => {
                                                    player.current?.pause();
                                                    setFrameOpen(true);
                                                }}
                                            >
                                                <Film />
                                                Pilih Sampul dari Video
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    coverInput.current?.click()
                                                }
                                            >
                                                <ImagePlus />
                                                Unggah Sampul
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    fileInput.current?.click()
                                                }
                                            >
                                                <Upload />
                                                Ganti Video
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Rekomendasi 9:16, maksimal 15 menit. Facebook:
                            minimal 540x960, durasi 4?60 detik.
                        </p>
                        {progress !== null && (
                            <div role="status" className="space-y-2">
                                <progress
                                    className="w-full accent-primary"
                                    max={100}
                                    value={progress}
                                />
                                <p className="text-xs">
                                    {progress < 100
                                        ? `Mengunggah ke server ${progress}%`
                                        : 'Memeriksa video dan menyimpan ke Cloudinary...'}
                                </p>
                            </div>
                        )}
                        {thumbnail && (
                            <div className="flex items-center gap-3 pt-2">
                                <img
                                    src={thumbnail}
                                    alt="Sampul terpilih"
                                    className="h-20 w-14 rounded-lg object-cover"
                                />
                                <div className="text-xs text-muted-foreground">
                                    <p className="font-medium text-foreground">
                                        Sampul terpilih
                                    </p>
                                    <p>
                                        {coverMode === 'keep'
                                            ? 'Tersimpan'
                                            : 'Simpan draf untuk menyimpan perubahan sampul.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="short-title">Judul Video *</Label>
                        <Input
                            id="short-title"
                            required
                            placeholder="Masukkan judul yang jelas"
                            value={title}
                            maxLength={255}
                            disabled={busy || current?.status === 'published'}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="short-description">
                            Isi / Deskripsi *
                        </Label>
                        <Textarea
                            id="short-description"
                            required
                            placeholder="Tulis deskripsi video"
                            rows={12}
                            value={description}
                            maxLength={10000}
                            disabled={busy || current?.status === 'published'}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            Deskripsi digunakan sebagai caption. Instagram
                            maksimal 2200 karakter.
                        </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                        <Button
                            variant="outline"
                            disabled={
                                busy || !current || current.status !== 'draft'
                            }
                            onClick={() => void saveDraft()}
                        >
                            Simpan Draf
                        </Button>
                        <Button
                            className="bg-brand-600 text-white hover:bg-brand-700"
                            disabled={
                                busy ||
                                !current ||
                                current.status !== 'draft' ||
                                !title.trim() ||
                                !description.trim()
                            }
                            onClick={() => setDialog(true)}
                        >
                            {busy && <LoaderCircle className="animate-spin" />}
                            Publikasikan
                        </Button>
                    </div>
                </div>
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Daftar Video</h2>
                    {videos.data.length === 0 && (
                        <p className="text-muted-foreground">
                            Belum ada video.
                        </p>
                    )}
                    <div className="divide-y rounded-xl border">
                        {videos.data.map((video) => (
                            <article
                                key={video.id}
                                className="flex flex-wrap items-center gap-4 p-4"
                            >
                                <img
                                    src={video.thumbnail_url}
                                    alt=""
                                    className="h-20 w-14 rounded object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-medium break-words">
                                        {video.title || 'Draf tanpa judul'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {statusNames[video.status]}
                                    </p>
                                    {video.publications?.map((p) => (
                                        <p
                                            key={p.platform}
                                            className="text-xs text-muted-foreground"
                                        >
                                            {p.platform === 'website'
                                                ? 'ApaKhabar'
                                                : p.platform}
                                            : {statusNames[p.status]}{' '}
                                            {p.account_name
                                                ? `(${p.account_name})`
                                                : ''}
                                        </p>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {video.status === 'draft' ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    unsaved.requestLeave(() =>
                                                        edit(video),
                                                    )
                                                }
                                                disabled={busy}
                                            >
                                                Edit Draf
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onClick={() =>
                                                    setConfirmation({
                                                        video,
                                                        action: 'delete',
                                                    })
                                                }
                                                disabled={busy}
                                            >
                                                Hapus
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                void showStatus(video)
                                            }
                                        >
                                            Status Publikasi
                                        </Button>
                                    )}
                                    {video.status === 'published' && (
                                        <Button
                                            variant="ghost"
                                            onClick={() =>
                                                setConfirmation({
                                                    video,
                                                    action: 'archive',
                                                })
                                            }
                                        >
                                            Arsipkan
                                        </Button>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                    <div className="flex justify-between">
                        <Button
                            variant="outline"
                            disabled={videos.current_page <= 1}
                            onClick={() =>
                                router.get(
                                    '/admin/short-videos',
                                    { page: videos.current_page - 1 },
                                    { preserveState: true },
                                )
                            }
                        >
                            Sebelumnya
                        </Button>
                        <span className="text-sm">
                            {videos.current_page} / {videos.last_page}
                        </span>
                        <Button
                            variant="outline"
                            disabled={videos.current_page >= videos.last_page}
                            onClick={() =>
                                router.get(
                                    '/admin/short-videos',
                                    { page: videos.current_page + 1 },
                                    { preserveState: true },
                                )
                            }
                        >
                            Berikutnya
                        </Button>
                    </div>
                </section>
            </div>
            <Dialog open={frameOpen} onOpenChange={setFrameOpen}>
                <DialogContent className="max-h-[90dvh] overflow-y-auto">
                    <DialogTitle>Pilih Sampul dari Video</DialogTitle>
                    <DialogDescription>
                        Geser penanda untuk memilih bingkai. Perubahan disimpan
                        saat menyimpan draf atau menerbitkan.
                    </DialogDescription>
                    <video
                        key={source}
                        ref={framePlayer}
                        src={source}
                        crossOrigin="anonymous"
                        preload="auto"
                        muted
                        playsInline
                        className="mx-auto max-h-56 w-full rounded-lg object-contain"
                        onLoadedData={() => {
                            if (framePlayer.current) {
                                framePlayer.current.currentTime = offset;
                            }
                        }}
                        onSeeked={() => frame()}
                    />
                    <Label htmlFor="frame-offset">
                        Bingkai video: {offset.toFixed(1)} detik
                    </Label>
                    <input
                        id="frame-offset"
                        type="range"
                        min={0}
                        max={Math.max(0, duration - 0.1)}
                        step={0.1}
                        value={offset}
                        className="w-full accent-primary"
                        disabled={busy}
                        onChange={(event) =>
                            chooseFrame(Number(event.target.value))
                        }
                    />
                    <Button
                        variant="outline"
                        onClick={() => {
                            chooseFrame(offset);
                        }}
                    >
                        Pilih Bingkai Ini
                    </Button>
                    {thumbnail && (
                        <img
                            src={thumbnail}
                            alt="Pratinjau sampul"
                            className="mx-auto max-h-40 rounded-lg object-contain"
                        />
                    )}
                    <div className="flex justify-end">
                        <Button onClick={() => setFrameOpen(false)}>
                            Selesai
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog
                open={unsaved.open}
                onOpenChange={(open) => {
                    if (!open) {
                        unsaved.continueEditing();
                    }
                }}
            >
                <DialogContent
                    overlayClassName="z-[100] bg-black/75"
                    className="z-[101] max-h-[calc(100dvh-2rem)] overflow-y-auto border-border/70 bg-card sm:max-w-[440px]"
                    closeDisabled={busy}
                    onInteractOutside={(event) => event.preventDefault()}
                >
                    <DialogTitle>Video belum disimpan</DialogTitle>
                    <DialogDescription>
                        Simpan video sebagai draf agar dapat dilanjutkan nanti.
                    </DialogDescription>
                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => unsaved.continueEditing()}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => unsaved.leave()}
                        >
                            Keluar Tanpa Menyimpan
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={() => void saveDraft()}
                        >
                            {busy ? 'Menyimpan...' : 'Simpan sebagai Draf'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <PublishNewsDialog
                videoMode
                open={dialog}
                onOpenChange={setDialog}
                platforms={publishPlatforms}
                metaAuth={metaAuth}
                selected={selected}
                onSelectionChange={(value) =>
                    setSelected(
                        Array.from(
                            new Set<PublishPlatformId>(['website', ...value]),
                        ),
                    )
                }
                processing={busy}
                contentReady={
                    !!current && !!title.trim() && !!description.trim()
                }
                error={error}
                onPreparePreview={prepare}
                onPublish={(token) => void publish(token)}
            />
            {result && (
                <PublishResultDialog
                    videoMode
                    result={result}
                    onRetry={(platform) => void retry(platform)}
                    retrying={busy}
                    onDismiss={() => {
                        setResultId(null);
                        setResult(undefined);
                        refresh();
                    }}
                />
            )}
            <Dialog
                open={!!confirmation}
                onOpenChange={(open) => {
                    if (!open && !busy) {
                        setConfirmation(null);
                    }
                }}
            >
                <DialogContent closeDisabled={busy}>
                    <DialogTitle>
                        {confirmation?.action === 'delete'
                            ? 'Hapus Draf?'
                            : 'Arsipkan Video?'}
                    </DialogTitle>
                    <DialogDescription>
                        Video tidak akan tampil di ApaKhabar. Postingan sosial
                        yang sudah terbit tidak dihapus.
                    </DialogDescription>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setConfirmation(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={async () => {
                                if (!confirmation) {
                                    return;
                                }

                                setBusy(true);

                                try {
                                    await metaRequest(
                                        `/admin/short-videos/${confirmation.video.id}/${confirmation.action === 'archive' ? 'archive' : 'delete'}`,
                                        {},
                                    );
                                    setConfirmation(null);
                                    refresh();
                                } catch (failure) {
                                    setError((failure as Error).message);
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            Konfirmasi
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
