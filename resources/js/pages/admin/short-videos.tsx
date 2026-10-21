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
import { FeedbackToast } from '@/components/feedback-toast';
import type { Feedback } from '@/components/feedback-toast';
import type { PublicationPreviewData } from '@/components/publication-preview';
import { PublishNewsDialog } from '@/components/publish-news-dialog';
import type {
    PublishPlatform,
    PublishPlatformId,
} from '@/components/publish-news-dialog';
import { ShortVideoList } from '@/components/short-video-list';
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
    created_at?: string;
    published_at?: string | null;
    publications?: {
        platform: string;
        status: string;
        account_name: string | null;
        permalink?: string | null;
        error_summary?: string | null;
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
class UploadError extends Error {
    constructor(
        message: string,
        public fields: Record<string, string[]> = {},
    ) {
        super(message);
    }
}

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
                        new UploadError(
                            Object.values(data.errors ?? {})
                                .flat()
                                .join(' ') ||
                                data.message ||
                                'Permintaan gagal.',
                            data.errors ?? {},
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

export function ShortVideos({
    mode = 'editor',
    draft = null,
    videos,
    publishPlatforms,
    metaAuth,
    filters,
}: {
    filters?: { search: string; status: string };
    mode?: 'editor' | 'list';
    draft?: ShortVideo | null;
    videos: { data: ShortVideo[]; current_page: number; last_page: number };
    publishPlatforms: PublishPlatform[];
    metaAuth: MetaAuthConfig;
}) {
    usePoll(10000, { only: ['videos'] });
    const [current, setCurrent] = useState<ShortVideo | null>(draft);
    const [title, setTitle] = useState(draft?.title ?? '');
    const [description, setDescription] = useState(draft?.description ?? '');
    const [source, setSource] = useState(draft?.video_url ?? '');
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [localVideoError, setLocalVideoError] = useState(false);
    const [thumbnail, setThumbnail] = useState(draft?.thumbnail_url ?? '');
    const [duration, setDuration] = useState(draft?.metadata.duration ?? 0);
    const [offset, setOffset] = useState(draft?.frame_offset ?? 0);
    const [cover, setCover] = useState<File | null>(null);
    const [coverMode, setCoverMode] = useState<'keep' | 'frame' | 'upload'>(
        'keep',
    );
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [touched, setTouched] = useState({
        title: false,
        description: false,
    });
    const [attempted, setAttempted] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [dialog, setDialog] = useState(false);
    const [selected, setSelected] = useState<PublishPlatformId[]>(['website']);
    const [confirmation, setConfirmation] = useState<{
        video: ShortVideo;
        action: 'archive' | 'delete' | 'restore';
    } | null>(null);
    const [dragging, setDragging] = useState(false);
    const [frameOpen, setFrameOpen] = useState(false);
    const coverInput = useRef<HTMLInputElement>(null);
    const framePlayer = useRef<HTMLVideoElement>(null);
    const player = useRef<HTMLVideoElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const guard = useRef(false);
    const [savedSnapshot, setSavedSnapshot] = useState(() =>
        editorSnapshot(savedVideoState(draft)),
    );
    const snapshot = editorSnapshot({
        title,
        description,
        media: localFile ?? current?.video_url ?? '',
        offset,
        thumbnail:
            coverMode === 'upload'
                ? 'custom'
                : localFile || coverMode === 'frame'
                  ? `frame:${offset}`
                  : savedVideoState(current).thumbnail,
        cover: coverMode === 'upload' ? cover : null,
    });
    const unsaved = useUnsavedNews(
        mode === 'editor' && snapshot !== savedSnapshot,
        busy,
    );
    const titleError =
        touched.title || attempted
            ? !title.trim()
                ? 'Judul video wajib diisi.'
                : title.length > 255
                  ? 'Judul maksimal 255 karakter.'
                  : fieldErrors.title
            : undefined;
    const descriptionError =
        touched.description || attempted
            ? !description.trim()
                ? 'Deskripsi video wajib diisi.'
                : description.length > 10000
                  ? 'Deskripsi maksimal 10000 karakter.'
                  : fieldErrors.description
            : undefined;
    const publishHint = busy
        ? 'Tunggu proses video selesai.'
        : !localFile && !current
          ? 'Pilih video terlebih dahulu.'
          : localVideoError
            ? 'Video lokal tidak dapat diputar. Pilih video MP4 yang valid.'
            : localFile && !duration
              ? 'Menunggu pratinjau video lokal.'
              : localFile && (!Number.isFinite(duration) || duration > 900)
                ? 'Durasi video harus maksimal 15 menit.'
                : current && current.status !== 'draft'
                  ? 'Video ini tidak tersedia sebagai draf.'
                  : !title.trim() || !description.trim()
                    ? 'Lengkapi judul dan deskripsi video.'
                    : !localFile && !current?.thumbnail_url
                      ? 'Sampul video belum tersedia.'
                      : '';
    const canPublish = !publishHint;
    function showFailure(failure: unknown, fallback: string) {
        const message = failure instanceof Error ? failure.message : fallback;
        setError(message);

        if (failure instanceof UploadError) {
            setFieldErrors(
                Object.fromEntries(
                    Object.entries(failure.fields).map(([key, values]) => [
                        key,
                        values[0],
                    ]),
                ),
            );
        }

        setFeedback({ variant: 'error', title: fallback, message });
    }

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
    const refresh = () => router.reload({ only: ['videos'] });
    function selectVideo(file?: File) {
        if (!file || guard.current) {
            return;
        }

        if (file.type !== 'video/mp4' || file.size > 100 * 1024 * 1024) {
            showFailure(
                new Error(
                    file.size > 100 * 1024 * 1024
                        ? 'Tinjau batas ukuran video yang diizinkan.'
                        : 'Gunakan format video yang sesuai dengan persyaratan Instagram dan Facebook Reels.',
                ),
                file.size > 100 * 1024 * 1024
                    ? 'Ukuran video terlalu besar'
                    : 'Format video tidak didukung',
            );

            return;
        }

        setError('');
        setFeedback(null);
        setLocalFile(file);
        setLocalVideoError(false);
        setDuration(0);
        setFrameOpen(false);
        setMessage('');
        setCover(null);
        setCoverMode('frame');
        setOffset(0);
        setThumbnail('');
        setSource(URL.createObjectURL(file));
    }
    async function ensureUploaded(): Promise<ShortVideo> {
        if (!localFile) {
            if (!current) {
                throw new Error('Pilih video terlebih dahulu.');
            }

            return current;
        }

        const body = new FormData();
        body.append('video', localFile);

        if (current) {
            body.append('short_video_id', String(current.id));
        }

        setProgress(0);

        try {
            const data = await upload(
                '/admin/short-videos/upload',
                body,
                setProgress,
            );
            setCurrent(data.video);
            setSavedSnapshot(editorSnapshot(savedVideoState(data.video)));
            setLocalFile(null);
            setSource(data.video.video_url);
            setDuration(data.video.metadata.duration);
            setFeedback({
                variant: 'success',
                title: 'Video berhasil diunggah',
                message: 'Video telah disimpan di Cloudinary.',
            });
            refresh();

            return data.video;
        } finally {
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
            if (current && !localFile) {
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
        const replacingVideo = !!localFile;
        const video = await ensureUploaded();

        const body = new FormData();
        body.append('title', title);
        body.append('description', description);
        body.append('frame_offset', String(offset));
        body.append(
            'cover_mode',
            replacingVideo && coverMode === 'frame' && offset === 0
                ? 'keep'
                : coverMode,
        );

        if (cover) {
            body.append('cover', cover);
        }

        const data = await upload(`/admin/short-videos/${video.id}`, body);
        setCurrent(data.video);
        setTitle(data.video.title);
        setDescription(data.video.description ?? '');
        setFieldErrors({});
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

        if (!title.trim() || !description.trim()) {
            setAttempted(true);
            setFeedback({
                variant: 'error',
                title: 'Lengkapi informasi video',
                message: 'Judul dan deskripsi wajib diisi.',
            });

            return;
        }

        guard.current = true;
        setBusy(true);
        setError('');
        setAttempted(true);

        try {
            await save();
            setFeedback({
                variant: 'success',
                message: 'Draf berhasil disimpan',
            });

            if (unsaved.open) {
                unsaved.leave();
            }
        } catch (failure) {
            showFailure(failure, 'Gagal menyimpan draf');
        } finally {
            setBusy(false);
            guard.current = false;
        }
    }
    async function prepare(): Promise<PublicationPreviewData> {
        if (!source || !title.trim() || !description.trim()) {
            throw new Error('Lengkapi video, judul, dan deskripsi.');
        }

        const heading = title.trim();
        const text = description.trim();
        const following = text.slice(heading.length, heading.length + 1);
        const alreadyStartsWithTitle =
            text.slice(0, heading.length).toLocaleLowerCase() ===
                heading.toLocaleLowerCase() &&
            (!following || /^[\s\p{P}]$/u.test(following));
        const caption = alreadyStartsWithTitle ? text : `${heading}\n\n${text}`;
        const captionLength = Array.from(caption).length;

        if (selected.includes('instagram') && captionLength > 2200) {
            throw new Error(
                'Judul dan deskripsi Instagram maksimal 2200 karakter.',
            );
        }

        if (selected.includes('facebook') && captionLength > 10000) {
            throw new Error(
                'Judul dan deskripsi Facebook maksimal 10000 karakter.',
            );
        }

        return {
            token: 'local-preview',
            title: heading,
            content: text,
            caption,
            category: null,
            images: { website: null, instagram: null, facebook: null },
            issues: {},
            video_url: source,
            thumbnail_url: thumbnail || undefined,
        };
    }
    async function publish() {
        if (guard.current) {
            return;
        }

        guard.current = true;
        setBusy(true);
        setError('');

        try {
            const video = await save();
            const preview = await metaRequest<PublicationPreviewData>(
                `/admin/short-videos/${video.id}/preview`,
                { platforms: selected },
            );
            const data = await metaRequest<Result>(
                `/admin/short-videos/${video.id}/publish`,
                { preview_token: preview.token, platforms: selected },
            );
            setDialog(false);
            setSavedSnapshot(editorSnapshot(savedVideoState(data.video)));
            setCurrent(data.video);
            window.dispatchEvent(
                new CustomEvent('short-publication', {
                    detail: {
                        id: data.video.id,
                        title: data.video.title,
                        result: data.result,
                        open: true,
                    },
                }),
            );
            refresh();
        } catch (failure) {
            showFailure(failure, 'Gagal menerbitkan video');
        } finally {
            guard.current = false;
            setBusy(false);
        }
    }
    async function showStatus(video: ShortVideo) {
        window.dispatchEvent(
            new CustomEvent('short-publication', {
                detail: { id: video.id, title: video.title, open: true },
            }),
        );
    }

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Video Pendek', href: '/admin/short-videos' },
            ]}
        >
            <Head
                title={mode === 'editor' ? 'Publikasi Video' : 'Daftar Video'}
            />
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {mode === 'editor' ? 'Publikasi Video' : 'Daftar Video'}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {mode === 'list'
                            ? 'Kelola draf dan video yang telah dipublikasikan.'
                            : 'Publikasikan ke ApaKhabar dan akun sosial yang dipilih.'}
                    </p>
                    {mode === 'list' && (
                        <Button
                            className="mt-3"
                            onClick={() =>
                                router.visit('/admin/short-videos/create')
                            }
                        >
                            Buat Video
                        </Button>
                    )}
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
                {mode === 'editor' && (
                    <div className="space-y-6 rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
                        <div className="space-y-2">
                            <Label htmlFor="short-video">Unggah Video</Label>
                            <div
                                className={`relative rounded-xl border-2 border-dashed transition-colors ${dragging ? 'border-primary bg-primary/10' : source ? 'border-primary bg-muted/20' : 'border-border bg-muted/20 hover:border-primary/40'}`}
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
                                        !source ||
                                        current?.status === 'published'
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
                                            onLoadedMetadata={(event) => {
                                                if (localFile) {
                                                    setDuration(
                                                        event.currentTarget
                                                            .duration,
                                                    );
                                                }
                                            }}
                                            onLoadedData={(event) => {
                                                if (
                                                    !localFile ||
                                                    coverMode !== 'frame' ||
                                                    thumbnail
                                                ) {
                                                    return;
                                                }

                                                const video =
                                                    event.currentTarget;
                                                const canvas =
                                                    document.createElement(
                                                        'canvas',
                                                    );
                                                canvas.width = video.videoWidth;
                                                canvas.height =
                                                    video.videoHeight;
                                                canvas
                                                    .getContext('2d')
                                                    ?.drawImage(video, 0, 0);
                                                setThumbnail(
                                                    canvas.toDataURL(
                                                        'image/jpeg',
                                                        0.85,
                                                    ),
                                                );
                                            }}
                                            onError={() => {
                                                if (localFile) {
                                                    setLocalVideoError(true);
                                                }
                                            }}
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
                                        onClick={() =>
                                            fileInput.current?.click()
                                        }
                                        className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl p-5 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <span className="flex size-12 items-center justify-center rounded-full border bg-card text-primary shadow-sm">
                                            <Video className="size-5" />
                                        </span>
                                        <span className="text-sm font-medium">
                                            Klik untuk unggah atau seret video
                                            ke sini
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
                                                        current?.status ===
                                                            'published'
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
                                aria-invalid={!!titleError}
                                aria-describedby={
                                    titleError ? 'short-title-error' : undefined
                                }
                                placeholder="Masukkan judul yang jelas"
                                value={title}
                                maxLength={255}
                                disabled={
                                    busy || current?.status === 'published'
                                }
                                onBlur={() =>
                                    setTouched((value) => ({
                                        ...value,
                                        title: true,
                                    }))
                                }
                                onChange={(event) => {
                                    setTitle(event.target.value);
                                    setFieldErrors((value) => ({
                                        ...value,
                                        title: '',
                                    }));
                                }}
                            />
                            {titleError && (
                                <p
                                    id="short-title-error"
                                    className="text-xs text-destructive"
                                >
                                    {titleError}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="short-description">
                                Isi / Deskripsi *
                            </Label>
                            <Textarea
                                id="short-description"
                                required
                                aria-invalid={!!descriptionError}
                                aria-describedby={
                                    descriptionError
                                        ? 'short-description-error'
                                        : undefined
                                }
                                placeholder="Tulis deskripsi video"
                                rows={12}
                                value={description}
                                maxLength={10000}
                                disabled={
                                    busy || current?.status === 'published'
                                }
                                onBlur={() =>
                                    setTouched((value) => ({
                                        ...value,
                                        description: true,
                                    }))
                                }
                                onChange={(event) => {
                                    setDescription(event.target.value);
                                    setFieldErrors((value) => ({
                                        ...value,
                                        description: '',
                                    }));
                                }}
                            />
                            {descriptionError && (
                                <p
                                    id="short-description-error"
                                    className="text-xs text-destructive"
                                >
                                    {descriptionError}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Deskripsi digunakan sebagai caption. Instagram
                                maksimal 2200 karakter.
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-3">
                            <Button
                                variant="outline"
                                disabled={
                                    busy ||
                                    (!current && !localFile) ||
                                    current?.status === 'published'
                                }
                                onClick={() => void saveDraft()}
                            >
                                Simpan Draf
                            </Button>
                            <Button
                                className="bg-brand-600 text-white hover:bg-brand-700"
                                disabled={!canPublish}
                                onClick={() => {
                                    if (guard.current) {
                                        return;
                                    }

                                    setAttempted(true);
                                    setDialog(true);
                                }}
                            >
                                {busy && (
                                    <LoaderCircle className="animate-spin" />
                                )}
                                Publikasikan
                            </Button>
                        </div>
                        {publishHint && (
                            <p
                                role="status"
                                className="text-right text-xs text-muted-foreground"
                            >
                                {publishHint}
                            </p>
                        )}
                    </div>
                )}
                {mode === 'list' && (
                    <ShortVideoList
                        key={filters?.search ?? ''}
                        videos={videos}
                        filters={filters}
                        busy={busy}
                        onStatus={(video) =>
                            void showStatus(video as ShortVideo)
                        }
                        onAction={(video, action) => {
                            setError('');
                            setConfirmation({
                                video: video as ShortVideo,
                                action,
                            });
                        }}
                    />
                )}
            </div>
            <FeedbackToast
                feedback={feedback}
                onDismiss={() => setFeedback(null)}
                duration={5000}
            />
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
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => unsaved.leave()}
                        >
                            Keluar Tanpa Menyimpan
                        </Button>
                        <Button
                            disabled={busy}
                            className="bg-brand-600 text-white hover:bg-brand-700"
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
                contentReady={canPublish}
                error={error}
                onPreparePreview={prepare}
                onPublish={() => void publish()}
            />
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
                            : confirmation?.action === 'restore'
                              ? 'Pulihkan Video?'
                              : 'Arsipkan Video?'}
                    </DialogTitle>
                    <DialogDescription>
                        {confirmation?.action === 'archive'
                            ? 'Video ini akan disembunyikan dari Beranda ApaKhabar dan dipindahkan ke Arsip. Video yang sudah dipublikasikan di Instagram atau Facebook tidak akan dihapus.'
                            : confirmation?.action === 'restore'
                              ? 'Video akan ditampilkan kembali di Beranda ApaKhabar tanpa menerbitkan ulang ke Instagram atau Facebook.'
                              : 'Draf ini akan dihapus. Video yang sudah diterbitkan tidak dapat dihapus melalui tindakan ini.'}
                    </DialogDescription>
                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
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
                                    const response = await metaRequest<{
                                        message: string;
                                    }>(
                                        `/admin/short-videos/${confirmation.video.id}/${confirmation.action}`,
                                        {},
                                    );
                                    setMessage(response.message);
                                    setConfirmation(null);
                                    refresh();
                                } catch (failure) {
                                    setError((failure as Error).message);
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            {confirmation?.action === 'archive'
                                ? 'Arsipkan'
                                : confirmation?.action === 'restore'
                                  ? 'Pulihkan'
                                  : 'Hapus Draf'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

export default function ShortVideosPage(
    props: Parameters<typeof ShortVideos>[0],
) {
    return (
        <ShortVideos
            key={`${props.mode ?? 'editor'}:${props.draft?.id ?? 'new'}`}
            {...props}
        />
    );
}
