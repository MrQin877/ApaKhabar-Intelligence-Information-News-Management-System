import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    FilePenLine,
    ImagePlus,
    Info,
    Save,
    Send,
    Settings2,
    LoaderCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { NewsImageCropDialog } from '@/components/news-image-crop-dialog';
import { NewsRichEditor } from '@/components/news-rich-editor';
import type { PublicationPreviewData } from '@/components/publication-preview';
import { PublishNewsDialog } from '@/components/publish-news-dialog';
import type {
    PublishPlatform,
    PublishPlatformId,
} from '@/components/publish-news-dialog';
import { PublishResultDialog } from '@/components/publish-result-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useUnsavedNews } from '@/hooks/use-unsaved-news';
import AppLayout from '@/layouts/app-layout';
import { defaultCrops, initializeCrops } from '@/lib/image-crops';
import type { ImageCrops } from '@/lib/image-crops';
import { hasManualContent, saveManualDraft } from '@/lib/manual-draft';
import { publishManual } from '@/lib/manual-publish';
import type { PublishResult } from '@/lib/manual-publish';
import type { MetaAuthConfig } from '@/lib/meta-auth';
import { index as categoryManagement } from '@/routes/admin/categories';
import type { BreadcrumbItem } from '@/types';

interface Draft {
    id: number;
    headline: string;
    content: string;
    content_html: string;
    show_on_homepage: boolean;
    category_id: number | null;
    image: string | null;
    image_crops: ImageCrops | null;
    status: string;
}

interface Category {
    categoryID: number;
    name: string;
}

interface Props {
    draft: Draft | null;
    categories: Category[];
    publishPlatforms: PublishPlatform[];
    metaAuth: MetaAuthConfig;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Berita', href: '/admin/news' },
    { title: 'Editor Manual', href: '/admin/news/manual/create' },
];

function FieldError({ message }: { message?: string }) {
    return message ? (
        <p className="text-xs text-destructive">{message}</p>
    ) : null;
}

export default function ManualEditor({
    draft,
    categories,
    publishPlatforms,
    metaAuth,
}: Props) {
    const [confirmPublish, setConfirmPublish] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [saveError, setSaveError] = useState('');
    const savingStarted = useRef(false);
    const [draftId, setDraftId] = useState(draft?.id);
    const [publishResult, setPublishResult] = useState<PublishResult>();
    const publishStarted = useRef(false);
    const [dragging, setDragging] = useState(false);
    const [preview, setPreview] = useState('');
    const [cropOpen, setCropOpen] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const categoryManagementLink = useRef<HTMLAnchorElement>(null);
    const [categoryOpen, setCategoryOpen] = useState(false);
    const availableCategories = categories.filter(
        (category) =>
            category.name.trim().toLocaleLowerCase('id') !== 'lainnya',
    );

    const form = useForm({
        headline: draft?.headline ?? '',
        content: draft?.content_html ?? '',
        content_format: 'html',
        show_on_homepage: draft?.show_on_homepage ?? true,
        cover_photo: null as File | null,
        category_id: draft?.category_id ? String(draft.category_id) : '',
        image: draft?.image ?? '',
        image_crops: draft?.image_crops ?? (null as ImageCrops | null),
        platforms: ['website'] as PublishPlatformId[],
    });
    const selectedCategoryExists =
        !form.data.category_id ||
        availableCategories.some(
            (category) => String(category.categoryID) === form.data.category_id,
        );
    const setFormData = form.setData;
    const setFormDefaults = form.setDefaults;
    useEffect(() => {
        if (!selectedCategoryExists) {
            setFormData('category_id', '');
            setFormDefaults('category_id', '');
        }
    }, [selectedCategoryExists, setFormData, setFormDefaults]);

    const busy =
        savingDraft || form.processing || publishing || Boolean(publishResult);
    const isDirty =
        form.isDirty && (Boolean(draftId) || hasManualContent(form.data));
    const unsaved = useUnsavedNews(isDirty, busy);
    const contentText = useMemo(() => {
        if (typeof DOMParser === 'undefined') {
            return '';
        }

        const document = new DOMParser().parseFromString(
            form.data.content,
            'text/html',
        );
        document
            .querySelectorAll('script, style')
            .forEach((element) => element.remove());

        return (document.body.textContent ?? '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .trim();
    }, [form.data.content]);
    const characterCount = Array.from(contentText).length;
    const hasRequiredContent = Boolean(
        form.data.headline.trim() && characterCount >= 20,
    );

    useEffect(() => {
        return () => {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    function selectCover(file?: File) {
        if (!file || busy) {
            return;
        }

        if (
            !['image/jpeg', 'image/png'].includes(file.type) ||
            file.size > 5 * 1024 * 1024
        ) {
            form.setError(
                'cover_photo',
                'Pilih gambar JPG atau PNG berukuran maksimal 5 MB.',
            );

            return;
        }

        form.clearErrors('cover_photo');
        form.setData('cover_photo', file);
        form.setData('image_crops', defaultCrops());
        const url = URL.createObjectURL(file);
        setPreview(url);
        const image = new Image();
        image.onload = () => {
            form.setData((data) =>
                data.cover_photo === file
                    ? {
                          ...data,
                          image_crops: initializeCrops(
                              data.image_crops ?? defaultCrops(),
                              image.naturalWidth,
                              image.naturalHeight,
                          ),
                      }
                    : data,
            );
        };
        image.src = url;
    }

    function save(intent: 'draft' | 'publish', previewToken?: string) {
        if (busy || publishStarted.current) {
            return;
        }

        if (intent === 'publish' && !hasRequiredContent) {
            return;
        }

        if (intent === 'publish' && !form.data.platforms.length) {
            form.setError('platforms', 'Pilih setidaknya satu platform.');

            return;
        }

        if (intent === 'publish') {
            // A ref closes the gap before React renders the disabled buttons.
            // Keep it locked through completion, including an uncertain network outcome.
            publishStarted.current = true;
            setPublishing(true);
            form.clearErrors();
            const body = new FormData();

            body.append('preview_token', previewToken ?? '');
            form.data.platforms.forEach((platform) =>
                body.append('platforms[]', platform),
            );

            body.append('intent', 'publish');

            if (draftId) {
                body.append('_method', 'put');
            }

            void publishManual(
                draftId
                    ? `/admin/news/manual/${draftId}`
                    : '/admin/news/manual',
                body,
                [...form.data.platforms],
            )
                .then((result) => {
                    if (
                        Object.values(result.results).some(
                            (platform) => platform.success,
                        )
                    ) {
                        form.setDefaults(form.data);
                        unsaved.allowLeave();
                    }

                    setConfirmPublish(false);
                    setPublishResult(result);
                })
                .finally(() => setPublishing(false));

            return;
        }

        void persistDraft();
    }

    async function persistDraft() {
        if (savingStarted.current || busy) {
            return;
        }

        savingStarted.current = true;
        setSavingDraft(true);
        setSaveError('');
        form.clearErrors();

        try {
            const saved = await saveManualDraft(form.data, draftId);
            setDraftId(saved.id);
            const data = {
                ...form.data,
                cover_photo: null,
                image: saved.image ?? '',
                image_crops: saved.image_crops,
                content: saved.content_html,
            };
            form.setDefaults(data);
            form.setData(data);
            setPreview('');

            if (fileInput.current) {
                fileInput.current.value = '';
            }

            window.dispatchEvent(new Event('manual-draft-saved'));

            if (unsaved.open) {
                unsaved.leave();
            } else {
                unsaved.allowLeave();
                router.visit(`/admin/news/manual/${saved.id}/edit`, {
                    replace: true,
                });
            }
        } catch (error) {
            setSaveError(
                error instanceof Error
                    ? error.message
                    : 'Draf belum berhasil disimpan. Periksa koneksi dan coba lagi.',
            );
        } finally {
            savingStarted.current = false;
            setSavingDraft(false);
        }
    }

    async function preparePreview(): Promise<PublicationPreviewData> {
        const body = new FormData();

        for (const [key, value] of Object.entries(form.data)) {
            if (key === 'platforms' || value === null) {
                continue;
            }

            if (key === 'image_crops') {
                body.append(key, JSON.stringify(value));
            } else if (value instanceof File) {
                body.append(key, value);
            } else {
                body.append(
                    key,
                    typeof value === 'boolean'
                        ? value
                            ? '1'
                            : '0'
                        : String(value),
                );
            }
        }

        const csrf = document.querySelector<HTMLMetaElement>(
            'meta[name="csrf-token"]',
        )?.content;
        const cookie = document.cookie
            .split('; ')
            .find((value) => value.startsWith('XSRF-TOKEN='));
        const response = await fetch('/admin/news/manual/preview', {
            method: 'POST',
            credentials: 'same-origin',
            signal: AbortSignal.timeout(60000),
            body,
            headers: {
                Accept: 'application/json',
                ...(cookie
                    ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)) }
                    : csrf
                      ? { 'X-CSRF-TOKEN': csrf }
                      : {}),
            },
        }).catch(() => {
            throw new Error(
                'Pratinjau belum dapat disiapkan. Periksa koneksi dan coba lagi.',
            );
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            const fields = Object.keys(result.errors ?? {});
            const message = fields.includes('headline')
                ? 'Judul berita belum diisi atau terlalu panjang.'
                : fields.includes('content')
                  ? 'Isi berita harus berisi setidaknya 20 karakter.'
                  : fields.some(
                          (key) =>
                              key.startsWith('image') || key === 'cover_photo',
                      )
                    ? 'Gambar belum siap. Periksa foto sampul dan potongan gambar.'
                    : fields.includes('category_id')
                      ? 'Kategori berita tidak tersedia. Pilih kembali kategori.'
                      : 'Pratinjau belum dapat disiapkan. Silakan coba lagi.';

            throw new Error(message);
        }

        return response.json();
    }

    const submit = (event: FormEvent) => {
        event.preventDefault();
        save('draft');
    };

    return (
        <>
            <Head title={draft ? 'Edit Draf Berita' : 'Buat Berita Manual'} />
            <div className="flex w-full flex-1 flex-col bg-(--editor-background) text-foreground [--editor-background:color-mix(in_oklab,var(--muted)_30%,var(--background))]">
                <form onSubmit={submit} className="flex w-full flex-1 flex-col">
                    <header className="mx-auto w-full max-w-7xl px-4 pt-7 pb-6 sm:px-6 lg:px-8 lg:pt-9">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-10 shrink-0 rounded-full bg-card"
                                asChild
                            >
                                <Link href="/admin/news" aria-label="Kembali">
                                    <ArrowLeft />
                                </Link>
                            </Button>
                            <div>
                                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                    {draft
                                        ? 'Edit draf manual'
                                        : 'Buat berita manual'}
                                </h1>
                                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                                    Tulis dan simpan berita sebagai draf sebelum
                                    dipublikasikan.
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="mx-auto grid w-full max-w-7xl flex-1 items-start gap-6 px-4 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <Card className="gap-0 overflow-hidden rounded-2xl border-border/80 py-0 shadow-sm">
                            <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-6">
                                <div className="flex items-center gap-2">
                                    <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <FilePenLine className="size-4" />
                                    </span>
                                    <CardTitle className="text-base">
                                        Konten Berita
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6 p-5 sm:p-6">
                                <div className="space-y-2">
                                    <Label htmlFor="cover_photo">
                                        Foto sampul
                                    </Label>
                                    <div
                                        className={`relative rounded-xl border-2 border-dashed transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 hover:border-primary/40'}`}
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
                                            selectCover(
                                                event.dataTransfer.files[0],
                                            );
                                        }}
                                    >
                                        <input
                                            ref={fileInput}
                                            id="cover_photo"
                                            type="file"
                                            accept="image/jpeg,image/png"
                                            className="sr-only"
                                            disabled={busy}
                                            onChange={(event) => {
                                                selectCover(
                                                    event.target.files?.[0],
                                                );
                                                event.target.value = '';
                                            }}
                                            aria-describedby="cover-hint"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                fileInput.current?.click()
                                            }
                                            disabled={busy}
                                            className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl p-5 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {preview || form.data.image ? (
                                                <img
                                                    src={
                                                        preview ||
                                                        form.data.image
                                                    }
                                                    alt="Pratinjau foto sampul"
                                                    className="max-h-56 w-full rounded-lg object-contain"
                                                />
                                            ) : (
                                                <span className="flex size-12 items-center justify-center rounded-full border bg-card text-primary shadow-sm">
                                                    <ImagePlus className="size-5" />
                                                </span>
                                            )}
                                            <span className="text-sm font-medium">
                                                {preview || form.data.image
                                                    ? 'Klik untuk mengganti foto'
                                                    : 'Klik untuk unggah atau seret foto ke sini'}
                                            </span>
                                            <span
                                                id="cover-hint"
                                                className="text-xs text-muted-foreground"
                                            >
                                                JPG atau PNG, maksimal 5 MB
                                            </span>
                                        </button>
                                        {(preview || form.data.image) && (
                                            <div className="absolute top-3 right-3 flex items-center gap-2">
                                                {(preview ||
                                                    form.data.image.includes(
                                                        '/news-images/',
                                                    )) && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        className="h-8 rounded-full shadow-sm"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            setCropOpen(true)
                                                        }
                                                    >
                                                        <FilePenLine />
                                                        Edit
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <FieldError
                                        message={form.errors.cover_photo}
                                    />
                                    <FieldError
                                        message={form.errors.image_crops}
                                    />
                                    <details className="text-xs text-muted-foreground">
                                        <summary className="cursor-pointer py-1">
                                            Gunakan URL gambar
                                        </summary>
                                        <Input
                                            aria-label="URL gambar"
                                            type="url"
                                            value={form.data.image}
                                            disabled={
                                                busy ||
                                                Boolean(form.data.cover_photo)
                                            }
                                            onChange={(event) =>
                                                form.setData((data) => ({
                                                    ...data,
                                                    image: event.target.value,
                                                    image_crops: null,
                                                }))
                                            }
                                            placeholder="https://..."
                                            className="mt-2 bg-background"
                                        />
                                    </details>
                                    <FieldError message={form.errors.image} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="headline">
                                        Judul berita *
                                    </Label>
                                    <Input
                                        id="headline"
                                        disabled={busy}
                                        value={form.data.headline}
                                        onChange={(event) =>
                                            form.setData(
                                                'headline',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Masukkan judul yang jelas"
                                        maxLength={255}
                                        aria-invalid={Boolean(
                                            form.errors.headline,
                                        )}
                                    />
                                    <FieldError
                                        message={form.errors.headline}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="content">
                                        Isi berita *
                                    </Label>
                                    <NewsRichEditor
                                        characterCount={characterCount}
                                        value={form.data.content}
                                        onChange={(html) =>
                                            form.setData('content', html)
                                        }
                                        invalid={Boolean(form.errors.content)}
                                        disabled={busy}
                                    />
                                    <div id="content-error" role="alert">
                                        <FieldError
                                            message={form.errors.content}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="gap-0 overflow-hidden rounded-2xl border-border/80 py-0 shadow-sm">
                                <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-6">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Settings2 className="size-4 text-muted-foreground" />
                                        Pengaturan
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6 p-5 sm:p-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="category">
                                            Kategori
                                        </Label>
                                        <Select
                                            open={categoryOpen}
                                            onOpenChange={setCategoryOpen}
                                            value={
                                                form.data.category_id || 'none'
                                            }
                                            onValueChange={(value) =>
                                                form.setData(
                                                    'category_id',
                                                    value === 'none'
                                                        ? ''
                                                        : value,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id="category"
                                                className="w-full rounded-lg bg-background"
                                                aria-invalid={Boolean(
                                                    form.errors.category_id,
                                                )}
                                            >
                                                <SelectValue placeholder="Pilih kategori" />
                                            </SelectTrigger>
                                            <SelectContent
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Tab') {
                                                        event.preventDefault();
                                                        categoryManagementLink.current?.focus();
                                                    }
                                                }}
                                            >
                                                <SelectItem value="none">
                                                    Tanpa kategori
                                                </SelectItem>
                                                {availableCategories.map(
                                                    (category) => (
                                                        <SelectItem
                                                            key={
                                                                category.categoryID
                                                            }
                                                            value={String(
                                                                category.categoryID,
                                                            )}
                                                        >
                                                            {category.name}
                                                        </SelectItem>
                                                    ),
                                                )}
                                                <SelectSeparator />
                                                <Link
                                                    ref={categoryManagementLink}
                                                    href={categoryManagement.url()}
                                                    className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                                    onKeyDown={(event) => {
                                                        if (
                                                            event.key ===
                                                                'Enter' ||
                                                            event.key === ' '
                                                        ) {
                                                            event.stopPropagation();
                                                        }

                                                        if (event.key === ' ') {
                                                            event.preventDefault();
                                                            event.currentTarget.click();
                                                        }
                                                    }}
                                                    onClick={() => {
                                                        setCategoryOpen(false);
                                                    }}
                                                >
                                                    <Settings2
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                    Kelola kategori
                                                </Link>
                                            </SelectContent>
                                        </Select>
                                        <FieldError
                                            message={form.errors.category_id}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-4 border-t pt-5">
                                        <Label
                                            htmlFor="show_on_homepage"
                                            className="cursor-pointer text-sm leading-5"
                                        >
                                            Tampilkan di beranda
                                        </Label>
                                        <Switch
                                            id="show_on_homepage"
                                            checked={form.data.show_on_homepage}
                                            onCheckedChange={(checked) =>
                                                form.setData(
                                                    'show_on_homepage',
                                                    checked,
                                                )
                                            }
                                            disabled={busy}
                                        />
                                    </div>
                                    <FieldError
                                        message={form.errors.show_on_homepage}
                                    />
                                </CardContent>
                            </Card>
                            <Card className="gap-0 rounded-xl border-primary/15 bg-primary/5 py-0 shadow-none">
                                <CardContent className="flex gap-3 p-5 text-sm leading-6 text-muted-foreground">
                                    <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                                    <p>
                                        Menyimpan sebagai draf tidak langsung
                                        mempublikasikan berita. Anda dapat
                                        meninjau dan menerbitkannya kapan saja
                                        dari Daftar Berita.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    <footer className="sticky bottom-0 z-20 w-full border-t border-border/40 bg-(--editor-background)">
                        {saveError && !unsaved.open && (
                            <p
                                role="alert"
                                className="px-4 pt-3 text-center text-sm text-destructive"
                            >
                                {saveError}
                            </p>
                        )}
                        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-end gap-3 px-4 py-4 sm:px-6 lg:px-8">
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={
                                    busy ||
                                    (!draftId && !hasManualContent(form.data))
                                }
                                className="h-10 flex-1 rounded-lg bg-card sm:flex-none sm:px-5"
                            >
                                <Save />{' '}
                                {savingDraft || form.processing
                                    ? 'Menyimpan...'
                                    : 'Simpan draf'}
                            </Button>
                            <Button
                                type="button"
                                disabled={busy || !hasRequiredContent}
                                aria-describedby={
                                    !hasRequiredContent
                                        ? 'publish-content-hint'
                                        : undefined
                                }
                                onClick={() => setConfirmPublish(true)}
                                className="h-10 flex-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 sm:flex-none sm:px-5"
                                title="Simpan dan tinjau draf sebelum menerbitkan"
                            >
                                {publishing || form.processing ? (
                                    <LoaderCircle className="animate-spin" />
                                ) : (
                                    <Send />
                                )}{' '}
                                Terbitkan
                            </Button>
                            {!hasRequiredContent && (
                                <p
                                    id="publish-content-hint"
                                    className="w-full text-right text-xs text-muted-foreground"
                                >
                                    Lengkapi konten berita sebelum menerbitkan.
                                </p>
                            )}
                        </div>
                    </footer>
                </form>
            </div>
            <PublishNewsDialog
                contentReady={hasRequiredContent}
                open={confirmPublish}
                onOpenChange={setConfirmPublish}
                platforms={publishPlatforms}
                metaAuth={metaAuth}
                selected={form.data.platforms}
                onSelectionChange={(selected) => {
                    form.clearErrors('platforms');
                    form.setData('platforms', selected);
                }}
                processing={publishing || form.processing}
                error={form.errors.platforms}
                onPreparePreview={preparePreview}
                onPublish={(token) => save('publish', token)}
            />
            {publishResult && <PublishResultDialog result={publishResult} />}
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
                    className="z-[101] max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto rounded-2xl border-border/70 bg-card p-5 shadow-2xl sm:max-w-[480px] sm:p-6"
                    closeDisabled={savingDraft}
                    aria-busy={savingDraft}
                    onInteractOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => {
                        event.preventDefault();

                        if (!savingDraft) {
                            unsaved.continueEditing();
                        }
                    }}
                >
                    <DialogHeader className="gap-3 pr-6 text-left">
                        <DialogTitle className="text-xl leading-snug tracking-tight">
                            Berita belum disimpan
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-6">
                            Simpan berita sebagai draf agar dapat dilanjutkan
                            nanti.
                        </DialogDescription>
                    </DialogHeader>
                    {saveError && (
                        <p role="alert" className="text-sm text-destructive">
                            {saveError}
                        </p>
                    )}
                    <DialogFooter className="flex-row justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={savingDraft}
                            onClick={() => {
                                form.reset();
                                unsaved.leave();
                            }}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            className="bg-brand-600 text-white hover:bg-brand-700"
                            disabled={savingDraft}
                            onClick={() => void persistDraft()}
                        >
                            {savingDraft && (
                                <LoaderCircle className="animate-spin" />
                            )}
                            {savingDraft ? 'Menyimpan...' : 'Simpan draf'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {cropOpen && (
                <NewsImageCropDialog
                    src={preview || form.data.image}
                    initial={form.data.image_crops}
                    onClose={() => setCropOpen(false)}
                    onReplace={() => {
                        flushSync(() => setCropOpen(false));
                        fileInput.current?.click();
                    }}
                    onSave={(crops) => {
                        form.setData('image_crops', crops);
                        setCropOpen(false);
                    }}
                />
            )}
        </>
    );
}

ManualEditor.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);
