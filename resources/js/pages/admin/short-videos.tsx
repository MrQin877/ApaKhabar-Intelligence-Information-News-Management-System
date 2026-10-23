import { Head, router, usePoll } from '@inertiajs/react';
import {
    Upload,
    Video,
    LoaderCircle,
    Pencil,
    ImagePlus,
    Film,
    Crop,
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
import {
    CoverPreview,
    ShortCoverDialog,
    defaultCoverCrop,
    coverPoster,
} from '@/components/short-cover-dialog';
import type { CoverCrop } from '@/components/short-cover-dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { VideoCropDialog } from '@/components/video-crop-dialog';
import {
    VideoFrameTimeline,
    formatFrameTime,
} from '@/components/video-frame-timeline';
import { useUnsavedNews } from '@/hooks/use-unsaved-news';
import AppLayout from '@/layouts/app-layout';
import { editorSnapshot } from '@/lib/editor-snapshot';
import type { PublishResult } from '@/lib/manual-publish';
import { metaRequest } from '@/lib/meta-auth';
import type { MetaAuthConfig } from '@/lib/meta-auth';
import type { VideoCrop } from '@/lib/video-crop';

type ShortVideo = {
    id: number;
    title: string;
    description: string;
    video_url: string;
    thumbnail_url: string;
    frame_offset: number;
    status: string;
    metadata: {
        duration: number;
        processing?: {
            revision: string;
            status: 'queued' | 'processing' | 'ready' | 'failed';
            error?: string | null;
        };
        bytes?: number;
        cover_source?: 'frame' | 'photo';
        cover_original?: string;
        cover_crop?: CoverCrop;
        local_path?: string;
        social_asset?: { source_path?: string; url: string; public_id: string };
        video_crop?: VideoCrop;
        crop_source?: { url: string };
    };
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

function SelectedCover({
    image,
    detail,
    description,
}: {
    image: string;
    detail: string;
    description: string;
}) {
    return (
        <div className="flex items-center gap-4 rounded-lg border bg-zinc-950/50 p-3">
            <div className="flex aspect-[9/16] w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-900 sm:w-20">
                {image ? (
                    <img
                        src={image}
                        alt="Sampul terpilih"
                        className="h-full w-full object-contain"
                    />
                ) : (
                    <Film className="size-5 text-muted-foreground" />
                )}
            </div>
            <div className="min-w-0 space-y-1">
                <p className="text-sm text-muted-foreground">Sampul Terpilih</p>
                <p className="truncate font-medium tabular-nums" title={detail}>
                    {detail}
                </p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}
function hasFrameCover(video: ShortVideo | null) {
    return (
        video?.metadata.cover_source === 'frame' ||
        (!video?.metadata.cover_source &&
            !!video?.thumbnail_url.includes('/video/upload/'))
    );
}

function savedVideoState(video: ShortVideo | null) {
    return {
        title: video?.title ?? '',
        description: video?.description ?? '',
        media: video?.video_url ?? '',
        offset: video?.frame_offset ?? 0,
        thumbnail: hasFrameCover(video)
            ? `frame:${video?.frame_offset ?? 0}`
            : (video?.thumbnail_url ?? ''),
        cover: null as File | null,
        coverCrop:
            video && !hasFrameCover(video)
                ? (video.metadata.cover_crop ?? defaultCoverCrop)
                : null,
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
    notice = null,
    videos,
    publishPlatforms,
    metaAuth,
    filters,
}: {
    filters?: { search: string; status: string };
    mode?: 'editor' | 'list';
    draft?: ShortVideo | null;
    notice?: string | null;
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
    const [coverMode, setCoverMode] = useState<
        'keep' | 'frame' | 'upload' | 'photo'
    >('keep');
    const [busy, setBusy] = useState(false);
    const [savingAction, setSavingAction] = useState<
        'draft' | 'crop' | 'publish' | null
    >(null);
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
    const [coverTab, setCoverTab] = useState(
        draft?.thumbnail_url && !hasFrameCover(draft) ? 'photo' : 'video',
    );
    const [photoUrl, setPhotoUrl] = useState(
        draft?.thumbnail_url && !hasFrameCover(draft)
            ? draft.thumbnail_url
            : '',
    );
    const [photoFilename, setPhotoFilename] = useState('');
    const [frameThumbnail, setFrameThumbnail] = useState(
        hasFrameCover(draft) ? (draft?.thumbnail_url ?? '') : '',
    );
    const [coverError, setCoverError] = useState('');
    const [coverCrop, setCoverCrop] = useState<CoverCrop>(
        draft?.metadata.cover_crop ?? defaultCoverCrop,
    );
    const [coverCropOpen, setCoverCropOpen] = useState(false);
    const coverOriginal = cover
        ? photoUrl
        : (current?.metadata.cover_original ?? photoUrl);
    const [cropOpen, setCropOpen] = useState(false);
    const coverInput = useRef<HTMLInputElement>(null);
    const [playbackTime, setPlaybackTime] = useState(0);
    const requestedFrame = useRef<number | null>(null);
    const framePlayer = useRef<HTMLVideoElement>(null);
    const player = useRef<HTMLVideoElement>(null);
    const fitBackground = useRef<HTMLVideoElement>(null);
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
        coverCrop: coverTab === 'photo' ? coverCrop : null,
    });
    const unsaved = useUnsavedNews(
        mode === 'editor' && snapshot !== savedSnapshot,
        busy,
    );
    const titleError =
        touched.title || attempted
            ? attempted && !title.trim()
                ? 'Judul video wajib diisi.'
                : title.length > 255
                  ? 'Judul maksimal 255 karakter.'
                  : fieldErrors.title
            : undefined;
    const descriptionError =
        touched.description || attempted
            ? attempted && !description.trim()
                ? 'Deskripsi video wajib diisi.'
                : description.length > 10000
                  ? 'Deskripsi maksimal 10000 karakter.'
                  : fieldErrors.description
            : undefined;
    const selectedFramePreview =
        frameThumbnail ||
        (hasFrameCover(current) &&
        Math.abs((current?.frame_offset ?? 0) - offset) < 0.001
            ? current?.thumbnail_url
            : '') ||
        '';
    const processingStatus = current?.metadata.processing?.status ?? 'ready';
    const pendingFrame =
        current?.metadata.local_path &&
        coverMode === 'frame' &&
        (!hasFrameCover(current) ||
            Math.abs(current.frame_offset - offset) >= 0.001);
    const publishHint =
        localFile || pendingFrame
            ? 'Simpan draf terlebih dahulu dan tunggu sampai video siap.'
            : processingStatus !== 'ready'
              ? 'Tunggu sampai video siap sebelum menerbitkan.'
              : busy
                ? 'Tunggu proses video selesai.'
                : !localFile && !current
                  ? 'Pilih video terlebih dahulu.'
                  : localVideoError
                    ? 'Video lokal tidak dapat diputar. Pilih video MP4 yang valid.'
                    : localFile && !duration
                      ? 'Menunggu pratinjau video lokal.'
                      : localFile &&
                          (!Number.isFinite(duration) || duration > 900)
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
            if (photoUrl.startsWith('blob:')) {
                URL.revokeObjectURL(photoUrl);
            }
        },
        [photoUrl],
    );
    useEffect(() => {
        if (coverTab !== 'photo' || !coverOriginal) {
            return;
        }

        let active = true;
        void coverPoster(coverOriginal, coverCrop)
            .then((url) => {
                if (active) {
                    setThumbnail(url);
                }
            })
            .catch(() => {
                if (active) {
                    setCoverError('Pratinjau sampul tidak dapat dimuat.');
                }
            });

        return () => {
            active = false;
        };
    }, [coverOriginal, coverCrop, coverTab]);
    const refresh = () => {
        if (mode === 'list') {
            router.reload({ only: ['videos'] });
        }
    };

    useEffect(() => {
        if (
            mode !== 'editor' ||
            !current ||
            !['queued', 'processing'].includes(processingStatus)
        ) {
            return;
        }

        let active = true;
        let timer: ReturnType<typeof setTimeout>;
        const poll = async () => {
            try {
                const response = await fetch(
                    `/admin/short-videos/${current.id}/processing`,
                    { headers: { Accept: 'application/json' } },
                );

                if (!response.ok) {
                    return;
                }

                const data: { video: ShortVideo } = await response.json();

                if (!active || guard.current) {
                    return;
                }

                // Merge server media only; never overwrite unsaved text or cover controls.
                setCurrent((previous) =>
                    previous?.id === data.video.id ? data.video : previous,
                );

                if (data.video.metadata.processing?.status === 'ready') {
                    setSource((previous) =>
                        previous === current.video_url
                            ? data.video.video_url
                            : previous,
                    );
                    setDuration(data.video.metadata.duration);

                    if (snapshot === savedSnapshot) {
                        requestedFrame.current = data.video.frame_offset;
                        setOffset(data.video.frame_offset);
                        setThumbnail(data.video.thumbnail_url);
                        setFrameThumbnail(data.video.thumbnail_url);
                        setSavedSnapshot(
                            editorSnapshot(savedVideoState(data.video)),
                        );
                    }
                }
            } catch {
                // A temporary network failure must not discard the saved draft.
            } finally {
                if (active) {
                    timer = setTimeout(poll, 2500);
                }
            }
        };
        timer = setTimeout(poll, 1500);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [mode, current, processingStatus, snapshot, savedSnapshot]);
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
        requestedFrame.current = 0;
        setPlaybackTime(0);
        setLocalFile(file);
        setLocalVideoError(false);
        setDuration(0);
        setCropOpen(false);
        setCoverTab('video');
        setPhotoUrl('');
        setPhotoFilename('');
        setFrameThumbnail('');
        setMessage('');
        setCover(null);
        setCoverMode('frame');
        setOffset(0);
        setThumbnail('');
        setSource(URL.createObjectURL(file));
    }
    async function ensureUploaded(edit?: VideoCrop): Promise<ShortVideo> {
        if (!localFile) {
            if (!current) {
                throw new Error('Pilih video terlebih dahulu.');
            }

            return current;
        }

        const body = new FormData();
        body.append('video', localFile);
        body.append('title', title);
        body.append('description', description);

        if (edit) {
            body.append('frame_offset', String(offset));
        }

        if (edit) {
            for (const [key, value] of Object.entries(edit)) {
                body.append(`edit[${key}]`, String(value));
            }
        }

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
            setLocalFile(null);
            setSource(data.video.video_url);
            setDuration(data.video.metadata.duration);
            refresh();

            return data.video;
        } finally {
            setProgress(null);
        }
    }
    async function saveCrop(edit: VideoCrop) {
        edit = { ...edit, mode: edit.mode ?? 'crop' };

        if (guard.current) {
            throw new Error('Tunggu proses video selesai.');
        }

        guard.current = true;
        setBusy(true);
        setSavingAction('crop');

        try {
            const wasLocal = !!localFile;
            const video = await ensureUploaded(edit);
            const body = new FormData();
            body.append('expected_url', video.video_url);

            for (const [key, value] of Object.entries(edit)) {
                body.append(key, String(value));
            }

            body.append('frame_offset', String(offset));

            const data = wasLocal
                ? { video }
                : await upload(`/admin/short-videos/${video.id}/crop`, body);
            setCurrent(data.video);
            setSource(data.video.video_url);
            setDuration(data.video.metadata.duration);

            // Keep an unsaved custom cover; regenerate selected video frames from the new asset.
            if (coverMode === 'frame') {
                requestedFrame.current = data.video.frame_offset;
                setOffset(data.video.frame_offset);
                setThumbnail(data.video.thumbnail_url);
                setFrameThumbnail(data.video.thumbnail_url);
            } else if (coverMode !== 'upload') {
                requestedFrame.current = data.video.frame_offset;
                setOffset(data.video.frame_offset);
                setThumbnail(data.video.thumbnail_url);
            } else {
                requestedFrame.current = data.video.frame_offset;
                setOffset(data.video.frame_offset);
            }

            setFeedback({
                variant: 'success',
                title: 'Perubahan berhasil disimpan',
                message:
                    'Pengaturan tersimpan. Video diproses di latar belakang.',
            });
            refresh();
        } finally {
            guard.current = false;
            setBusy(false);
            setSavingAction(null);
        }
    }
    function frame(force = false) {
        const video = framePlayer.current;

        if (
            !video ||
            coverTab !== 'video' ||
            (!force && coverMode !== 'frame') ||
            video.seeking ||
            !video.videoWidth ||
            !video.videoHeight ||
            Math.abs(video.currentTime - (requestedFrame.current ?? offset)) >
                0.001
        ) {
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            const image = canvas.toDataURL('image/jpeg', 0.85);
            setFrameThumbnail(image);
            setThumbnail(image);
        } catch {
            // Cloudinary frame delivery remains available when canvas CORS is restricted.
            if (current && !localFile && !current.metadata.local_path) {
                const image = current.video_url
                    .replace(
                        '/upload/',
                        `/upload/so_${video.currentTime.toFixed(3)},f_jpg/`,
                    )
                    .replace(/\.mp4(?:\?.*)?$/, '.jpg');
                setThumbnail(image);
                setFrameThumbnail(image);
            }
        }
    }
    function chooseFrame(value: number) {
        if (busy) {
            return;
        }

        requestedFrame.current = value;
        setFrameThumbnail('');
        player.current?.pause();
        fitBackground.current?.pause();

        if (player.current) {
            player.current.currentTime = value;
        }

        if (fitBackground.current) {
            fitBackground.current.currentTime = value;
        }

        setPlaybackTime(value);
        setOffset(value);
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
            setCoverError('Gunakan sampul JPG/PNG maksimal 5 MB.');

            return;
        }

        setError('');
        setCoverError('');
        setCover(file);
        setPhotoFilename(file.name);
        setCoverCrop(defaultCoverCrop);
        const url = URL.createObjectURL(file);
        setPhotoUrl(url);

        if (coverTab === 'photo') {
            setCoverMode('upload');
            setThumbnail(url);
        }
    }
    function switchCoverTab(tab: string) {
        setCoverTab(tab);
        setCoverError('');

        if (tab === 'video') {
            setCoverMode('frame');
            const image =
                !localFile && current && !current.metadata.local_path
                    ? current.video_url
                          .replace(
                              '/upload/',
                              `/upload/so_${offset.toFixed(3)},f_jpg/`,
                          )
                          .replace(/\.mp4(?:\?.*)?$/, '.jpg')
                    : frameThumbnail;
            setThumbnail(image);

            if (framePlayer.current) {
                framePlayer.current.currentTime = offset;
            }
        } else {
            setThumbnail(photoUrl);
            setCoverMode(
                cover
                    ? 'upload'
                    : current?.metadata.cover_original
                      ? 'photo'
                      : photoUrl && photoUrl === current?.thumbnail_url
                        ? 'keep'
                        : 'upload',
            );
        }
    }
    async function save(): Promise<ShortVideo> {
        if (coverTab === 'photo' && !photoUrl) {
            throw new Error('Pilih foto sampul atau gunakan tab Dari Video.');
        }

        const replacingVideo = !!localFile;
        const video = await ensureUploaded();

        const body = new FormData();
        body.append('title', title);
        body.append('description', description);

        if (
            coverTab === 'photo' &&
            (coverMode !== 'keep' || current?.metadata.cover_original)
        ) {
            for (const [key, value] of Object.entries(coverCrop)) {
                body.append(`cover_crop[${key}]`, String(value));
            }
        }

        body.append('frame_offset', String(offset));
        body.append(
            'cover_mode',
            replacingVideo && coverMode === 'frame' && offset === 0
                ? 'keep'
                : coverMode,
        );

        if (coverTab === 'photo' && coverMode === 'upload') {
            let selectedPhoto = cover;

            if (!selectedPhoto && photoUrl) {
                const response = await fetch(photoUrl);

                if (!response.ok) {
                    throw new Error(
                        'Foto sampul tidak dapat dimuat. Pilih foto kembali.',
                    );
                }

                const blob = await response.blob();
                selectedPhoto = new File([blob], 'cover.jpg', {
                    type: blob.type || 'image/jpeg',
                });
            }

            if (selectedPhoto) {
                body.append('cover', selectedPhoto);
            }
        }

        const data = await upload(`/admin/short-videos/${video.id}`, body);
        setCurrent(data.video);
        router.replace({
            url: `/admin/short-videos/create?draft=${data.video.id}`,
            preserveState: true,
            preserveScroll: true,
        });
        setTitle(data.video.title);
        setDescription(data.video.description ?? '');
        setFieldErrors({});
        requestedFrame.current = data.video.frame_offset;
        setOffset(data.video.frame_offset);
        setSavedSnapshot(editorSnapshot(savedVideoState(data.video)));
        setThumbnail(data.video.thumbnail_url);

        if (coverTab === 'photo') {
            setPhotoUrl(data.video.thumbnail_url);
        } else {
            setFrameThumbnail(data.video.thumbnail_url);
        }

        setCoverMode('keep');

        if (coverTab === 'photo') {
            setCover(null);
        }

        refresh();

        return data.video;
    }
    async function saveDraft() {
        if (guard.current) {
            return;
        }

        guard.current = true;
        setBusy(true);
        setSavingAction('draft');
        setError('');

        try {
            if (localFile || snapshot !== savedSnapshot) {
                await save();
            }

            setFeedback({
                variant: 'success',
                message: 'Draf berhasil disimpan',
            });

            if (unsaved.open) {
                unsaved.continueEditing();
            }
        } catch (failure) {
            showFailure(failure, 'Gagal menyimpan draf');
        } finally {
            setBusy(false);
            setSavingAction(null);
            guard.current = false;
        }
    }
    async function prepare(): Promise<PublicationPreviewData> {
        if (coverTab === 'photo' && !photoUrl) {
            throw new Error('Pilih foto sampul atau gunakan tab Dari Video.');
        }

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
            video_url: localFile ? source : (current?.video_url ?? source),
            thumbnail_url: thumbnail || undefined,
        };
    }
    async function publish() {
        if (guard.current) {
            return;
        }

        guard.current = true;
        setBusy(true);
        setSavingAction('publish');
        setError('');
        const pendingId = -Date.now();
        window.dispatchEvent(
            new CustomEvent('short-publication', {
                detail: {
                    id: pendingId,
                    title,
                    thumbnail_url: thumbnail,
                    destinations: selected,
                    ready: false,
                    result: {
                        attempt_id: `pending-${-pendingId}`,
                        pending: true,
                        success: false,
                        results: Object.fromEntries(
                            selected.map((platform) => [
                                platform,
                                {
                                    success: false,
                                    status: 'queued',
                                    message: 'Menunggu',
                                },
                            ]),
                        ),
                    },
                },
            }),
        );

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

            if (data.video.status !== 'published') {
                throw new Error(
                    'Publikasi belum dikonfirmasi. Periksa status video dan coba lagi.',
                );
            }

            setDialog(false);
            setSavedSnapshot(editorSnapshot(savedVideoState(data.video)));
            setCurrent(data.video);
            window.dispatchEvent(
                new CustomEvent('short-publication', {
                    detail: {
                        id: data.video.id,
                        title: data.video.title,
                        thumbnail_url: data.video.thumbnail_url,
                        duration: data.video.metadata?.duration,
                        destinations: selected,
                        ready: true,
                        replaceId: pendingId,
                        result: data.result,
                        open: true,
                    },
                }),
            );
            unsaved.allowLeave();
            router.visit('/admin/short-videos', { replace: true });
        } catch (failure) {
            window.dispatchEvent(
                new CustomEvent('short-publication', {
                    detail: { removeId: pendingId },
                }),
            );
            showFailure(failure, 'Gagal menerbitkan video');
        } finally {
            guard.current = false;
            setBusy(false);
            setSavingAction(null);
        }
    }
    async function showStatus(video: ShortVideo) {
        window.dispatchEvent(
            new CustomEvent('short-publication', {
                detail: {
                    id: video.id,
                    title: video.title,
                    thumbnail_url: video.thumbnail_url,
                    duration: video.metadata?.duration,
                    destinations: video.publications
                        ?.filter(
                            (publication) =>
                                publication.status !== 'not_selected',
                        )
                        .map(
                            (publication) =>
                                publication.platform as PublishPlatformId,
                        ),
                    ready: true,
                    open: true,
                },
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
                {mode === 'editor' && (busy || current) && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                    >
                        {(busy ||
                            ['queued', 'processing'].includes(
                                processingStatus,
                            )) && (
                            <LoaderCircle className="size-4 animate-spin" />
                        )}
                        <span>
                            {busy
                                ? progress !== null && progress < 100
                                    ? `Mengunggah video... ${progress}%`
                                    : 'Menyimpan draf...'
                                : processingStatus === 'failed'
                                  ? 'Gagal memproses'
                                  : processingStatus === 'ready'
                                    ? 'Video siap'
                                    : 'Memproses video...'}
                        </span>
                        {!busy && processingStatus === 'failed' && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                    if (!current || guard.current) {
                                        return;
                                    }

                                    guard.current = true;
                                    setBusy(true);

                                    try {
                                        const data = await upload(
                                            `/admin/short-videos/${current.id}/processing/retry`,
                                            new FormData(),
                                        );
                                        setCurrent(data.video);
                                    } catch (failure) {
                                        showFailure(
                                            failure,
                                            'Gagal mencoba kembali',
                                        );
                                    } finally {
                                        guard.current = false;
                                        setBusy(false);
                                    }
                                }}
                            >
                                Coba lagi
                            </Button>
                        )}
                        {!busy && processingStatus === 'failed' && (
                            <span className="text-xs">
                                Video asli dan pengaturan tetap tersimpan.
                            </span>
                        )}
                    </div>
                )}
                <FeedbackToast
                    feedback={feedback}
                    onDismiss={() => setFeedback(null)}
                    duration={5000}
                    inline
                />
                {notice && mode === 'list' && (
                    <p
                        role="status"
                        className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"
                    >
                        {notice}
                    </p>
                )}
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
                    <div className="grid items-start gap-6 rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <div className="min-w-0 space-y-3">
                            <Label htmlFor="short-video">Unggah Video</Label>
                            <div
                                className={`relative rounded-xl border-2 border-dashed transition-colors ${dragging ? 'border-primary bg-primary/10' : source ? 'border-zinc-800 bg-zinc-950 text-white' : 'border-border bg-muted/20 hover:border-primary/40'}`}
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
                                {source ? (
                                    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl p-4 pt-16 text-center">
                                        <div className="relative isolate aspect-[9/16] h-[min(65dvh,640px)] max-w-full overflow-hidden rounded-lg bg-black">
                                            {localFile && (
                                                <video
                                                    ref={fitBackground}
                                                    src={source}
                                                    muted
                                                    playsInline
                                                    aria-hidden="true"
                                                    className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
                                                />
                                            )}
                                            <video
                                                key={source}
                                                ref={player}
                                                src={source}
                                                controls
                                                preload="metadata"
                                                poster={thumbnail || undefined}
                                                className="relative h-full w-full object-contain"
                                                onTimeUpdate={(event) =>
                                                    setPlaybackTime(
                                                        event.currentTarget
                                                            .currentTime,
                                                    )
                                                }
                                                onPlay={(event) => {
                                                    setPlaybackTime(
                                                        event.currentTarget
                                                            .currentTime,
                                                    );

                                                    if (
                                                        fitBackground.current &&
                                                        player.current
                                                    ) {
                                                        fitBackground.current.currentTime =
                                                            player.current.currentTime;
                                                        void fitBackground.current
                                                            .play()
                                                            .catch(() => {});
                                                    }
                                                }}
                                                onPause={(event) => {
                                                    setPlaybackTime(
                                                        event.currentTarget
                                                            .currentTime,
                                                    );
                                                    fitBackground.current?.pause();
                                                }}
                                                onSeeking={(event) => {
                                                    setPlaybackTime(
                                                        event.currentTarget
                                                            .currentTime,
                                                    );

                                                    if (
                                                        fitBackground.current &&
                                                        player.current
                                                    ) {
                                                        fitBackground.current.currentTime =
                                                            player.current.currentTime;
                                                    }
                                                }}
                                                onLoadedMetadata={(event) => {
                                                    setPlaybackTime(
                                                        event.currentTarget
                                                            .currentTime || 0,
                                                    );

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
                                                    canvas.width =
                                                        video.videoWidth;
                                                    canvas.height =
                                                        video.videoHeight;
                                                    canvas
                                                        .getContext('2d')
                                                        ?.drawImage(
                                                            video,
                                                            0,
                                                            0,
                                                        );
                                                    const initialFrame =
                                                        canvas.toDataURL(
                                                            'image/jpeg',
                                                            0.85,
                                                        );
                                                    setThumbnail(initialFrame);
                                                    setFrameThumbnail(
                                                        initialFrame,
                                                    );
                                                }}
                                                onError={() => {
                                                    if (localFile) {
                                                        setLocalVideoError(
                                                            true,
                                                        );
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="flex w-full flex-wrap justify-center gap-x-4 gap-y-2 border-t border-white/10 pt-3 text-xs text-zinc-300">
                                            <span>
                                                {Math.floor(duration / 60)}:
                                                {String(
                                                    Math.floor(duration % 60),
                                                ).padStart(2, '0')}
                                            </span>
                                            <span>MP4 (H.264/AAC)</span>
                                            <span>
                                                {(
                                                    (localFile?.size ??
                                                        current?.metadata
                                                            .bytes ??
                                                        0) /
                                                    1024 /
                                                    1024
                                                ).toFixed(1)}{' '}
                                                MB
                                            </span>
                                        </div>
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
                                                    Edit Video
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onSelect={() => {
                                                        player.current?.pause();
                                                        setCropOpen(true);
                                                    }}
                                                >
                                                    <Crop />
                                                    Sesuaikan / Pangkas Video
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
                                            ? `Mengunggah video... ${progress}%`
                                            : 'Menyimpan draf...'}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 space-y-5 lg:border-l lg:pl-6">
                            <div className="space-y-2">
                                <Label htmlFor="short-title">Judul Video</Label>
                                <Input
                                    id="short-title"
                                    aria-invalid={!!titleError}
                                    aria-describedby={
                                        titleError
                                            ? 'short-title-error'
                                            : undefined
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
                                <p className="text-right text-xs text-muted-foreground">
                                    {title.length}/255
                                </p>
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
                                    Isi / Deskripsi
                                </Label>
                                <Textarea
                                    id="short-description"
                                    aria-invalid={!!descriptionError}
                                    aria-describedby={
                                        descriptionError
                                            ? 'short-description-error'
                                            : undefined
                                    }
                                    placeholder="Tulis deskripsi video"
                                    rows={5}
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
                                <p className="text-right text-xs text-muted-foreground">
                                    {description.length}/10000
                                </p>
                                {descriptionError && (
                                    <p
                                        id="short-description-error"
                                        className="text-xs text-destructive"
                                    >
                                        {descriptionError}
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Deskripsi digunakan sebagai caption.
                                    Instagram maksimal 2200 karakter.
                                </p>
                            </div>
                            <section
                                className="space-y-3 rounded-xl border p-4"
                                aria-label="Pilih Sampul"
                            >
                                <h2 className="font-semibold">Pilih Sampul</h2>
                                <Tabs
                                    value={coverTab}
                                    onValueChange={switchCoverTab}
                                    className="gap-4"
                                >
                                    <TabsList className="w-full group-data-[orientation=horizontal]/tabs:h-11">
                                        <TabsTrigger
                                            value="video"
                                            disabled={busy || !source}
                                            className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600"
                                        >
                                            <Film />
                                            Dari Video
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="photo"
                                            disabled={busy || !source}
                                            className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600"
                                        >
                                            <ImagePlus />
                                            Unggah Foto
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent
                                        value="video"
                                        className="space-y-4"
                                    >
                                        <video
                                            ref={framePlayer}
                                            key={source}
                                            src={source || undefined}
                                            crossOrigin="anonymous"
                                            preload="auto"
                                            muted
                                            playsInline
                                            className="hidden"
                                            onLoadedData={() => {
                                                if (framePlayer.current) {
                                                    requestedFrame.current =
                                                        offset;

                                                    if (
                                                        Math.abs(
                                                            framePlayer.current
                                                                .currentTime -
                                                                offset,
                                                        ) < 0.001
                                                    ) {
                                                        frame(true);
                                                    } else {
                                                        framePlayer.current.currentTime =
                                                            offset;
                                                    }
                                                }
                                            }}
                                            onSeeked={() => frame(true)}
                                        />
                                        <SelectedCover
                                            image={selectedFramePreview}
                                            detail={formatFrameTime(offset)}
                                            description="Posisi sampul pada video"
                                        />
                                        <VideoFrameTimeline
                                            source={source}
                                            duration={duration}
                                            offset={offset}
                                            playbackTime={playbackTime}
                                            disabled={
                                                busy || !source || duration <= 0
                                            }
                                            onSelect={chooseFrame}
                                        />
                                    </TabsContent>
                                    <TabsContent
                                        value="photo"
                                        className="space-y-4"
                                    >
                                        {photoUrl && (
                                            <SelectedCover
                                                image={thumbnail || photoUrl}
                                                detail={
                                                    photoFilename ||
                                                    'Foto tersimpan'
                                                }
                                                description="Foto yang dipilih"
                                            />
                                        )}
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
                                                selectCover(
                                                    event.target.files?.[0],
                                                );
                                                event.target.value = '';
                                            }}
                                        />
                                        <p className="text-sm leading-relaxed text-muted-foreground">
                                            Pilih foto dari galeri sebagai
                                            sampul. Perubahan disimpan saat Anda
                                            menyimpan draf atau menerbitkan.
                                        </p>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() =>
                                                    coverInput.current?.click()
                                                }
                                                className="flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 p-6 text-sm focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                                            >
                                                {photoUrl ? (
                                                    <div className="relative aspect-[9/16] h-64 overflow-hidden rounded-lg bg-black">
                                                        <CoverPreview
                                                            source={
                                                                coverOriginal
                                                            }
                                                            crop={coverCrop}
                                                        />
                                                    </div>
                                                ) : (
                                                    <ImagePlus className="size-10 text-emerald-600" />
                                                )}
                                                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                                    Pilih Foto dari Galeri
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    JPG/PNG, maksimal 5 MB
                                                </span>
                                            </button>
                                            {photoUrl && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="secondary"
                                                            className="absolute top-2 right-2 z-10"
                                                            aria-label="Pangkas Sampul"
                                                            disabled={busy}
                                                            onClick={() =>
                                                                setCoverCropOpen(
                                                                    true,
                                                                )
                                                            }
                                                        >
                                                            <Crop className="size-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        Pangkas Sampul
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                        </div>
                                        {coverError && (
                                            <p
                                                role="alert"
                                                className="text-sm text-destructive"
                                            >
                                                {coverError}
                                            </p>
                                        )}
                                    </TabsContent>
                                </Tabs>
                                <p className="rounded-lg bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
                                    Tab aktif menentukan sampul yang disimpan
                                    saat menyimpan draf atau menerbitkan.
                                    Instagram menggunakan sampul ini; Facebook
                                    memilih sampul secara otomatis.
                                </p>
                            </section>
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
                                    {savingAction === 'draft' && (
                                        <LoaderCircle className="size-4 animate-spin" />
                                    )}
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
                                    {savingAction === 'publish' && (
                                        <LoaderCircle className="size-4 animate-spin" />
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
            {coverCropOpen && (
                <ShortCoverDialog
                    source={coverOriginal}
                    initial={coverCrop}
                    onClose={() => setCoverCropOpen(false)}
                    onApply={(edit) => {
                        setCoverCrop(edit);

                        if (!cover && !current?.metadata.cover_original) {
                            setCoverMode('upload');
                        }
                    }}
                />
            )}
            {cropOpen && (
                <VideoCropDialog
                    source={
                        localFile
                            ? source
                            : (current?.metadata.crop_source?.url ?? source)
                    }
                    initial={
                        localFile ? undefined : current?.metadata.video_crop
                    }
                    onClose={() => setCropOpen(false)}
                    onSave={saveCrop}
                />
            )}
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
                            {savingAction === 'draft' && (
                                <LoaderCircle className="size-4 animate-spin" />
                            )}
                            Simpan sebagai Draf
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
