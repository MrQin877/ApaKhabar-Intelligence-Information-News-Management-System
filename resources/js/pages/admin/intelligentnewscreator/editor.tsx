import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    FilePenLine,
    ImagePlus,
    Info,
    Save,
    Send,
    Settings2,
    X,
    LoaderCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { NewsRichEditor } from '@/components/news-rich-editor';
import { PublishNewsDialog } from '@/components/publish-news-dialog';
import type {
    PublishPlatform,
    PublishPlatformId,
} from '@/components/publish-news-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import type { MetaAuthConfig } from '@/lib/meta-auth';
import type { BreadcrumbItem } from '@/types';

interface Draft {
    id: number;
    headline: string;
    subheadline: string | null;
    content: string;
    content_html: string;
    show_on_homepage: boolean;
    summary: string;
    category_id: number | null;
    image: string | null;
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
    const [dragging, setDragging] = useState(false);
    const [preview, setPreview] = useState('');
    const fileInput = useRef<HTMLInputElement>(null);
    const form = useForm({
        headline: draft?.headline ?? '',
        subheadline: draft?.subheadline ?? '',
        content: draft?.content_html ?? '',
        content_format: 'html',
        show_on_homepage: draft?.show_on_homepage ?? true,
        cover_photo: null as File | null,
        summary: draft?.summary ?? '',
        category_id: draft?.category_id ? String(draft.category_id) : '',
        image: draft?.image ?? '',
        platforms: [] as PublishPlatformId[],
    });
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
    const hasRequiredContent = Boolean(
        form.data.headline.trim() &&
        form.data.summary.trim() &&
        Array.from(contentText).length >= 20,
    );

    useEffect(() => {
        return () => {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    function selectCover(file?: File) {
        if (!file || form.processing) {
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
        setPreview(URL.createObjectURL(file));
    }

    function save(intent: 'draft' | 'publish') {
        if (form.processing) {
            return;
        }

        if (intent === 'publish' && !hasRequiredContent) {
            return;
        }

        if (intent === 'publish' && !form.data.platforms.length) {
            form.setError('platforms', 'Pilih setidaknya satu platform.');

            return;
        }

        form.transform((data) => ({
            ...data,
            intent,
            ...(draft ? { _method: 'put' } : {}),
        }));
        // Multipart POST with method spoofing keeps the existing PUT update route.
        form.post(
            draft ? `/admin/news/manual/${draft.id}` : '/admin/news/manual',
            {
                preserveScroll: true,
                forceFormData: true,
                onFinish: () => setConfirmPublish(false),
                onError: (errors) => {
                    setConfirmPublish(false);
                    const platformError = Object.entries(errors).find(([key]) =>
                        key.startsWith('platforms'),
                    );

                    if (platformError) {
                        form.setError('platforms', platformError[1]);
                    } else {
                        setConfirmPublish(false);
                    }
                },
                onSuccess: (page) => {
                    const saved = page.props.draft as Draft | undefined;
                    setPreview('');
                    setConfirmPublish(false);
                    form.setData((data) => ({
                        ...data,
                        cover_photo: null,
                        image: saved?.image ?? data.image,
                        content: saved?.content_html ?? data.content,
                    }));

                    if (fileInput.current) {
                        fileInput.current.value = '';
                    }
                },
            },
        );
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

                                            if (!form.processing) {
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
                                            disabled={form.processing}
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
                                            disabled={form.processing}
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
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="icon-sm"
                                                className="absolute top-3 right-3 rounded-full shadow-sm"
                                                aria-label="Hapus foto sampul"
                                                disabled={form.processing}
                                                onClick={() => {
                                                    setPreview('');
                                                    setConfirmPublish(false);
                                                    form.setData((data) => ({
                                                        ...data,
                                                        image: '',
                                                        cover_photo: null,
                                                    }));
                                                }}
                                            >
                                                <X />
                                            </Button>
                                        )}
                                    </div>
                                    <FieldError
                                        message={form.errors.cover_photo}
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
                                                form.processing ||
                                                Boolean(form.data.cover_photo)
                                            }
                                            onChange={(event) =>
                                                form.setData(
                                                    'image',
                                                    event.target.value,
                                                )
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
                                    <Label htmlFor="subheadline">
                                        Subjudul
                                    </Label>
                                    <Input
                                        id="subheadline"
                                        value={form.data.subheadline}
                                        onChange={(event) =>
                                            form.setData(
                                                'subheadline',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Keterangan tambahan untuk judul"
                                        maxLength={255}
                                        aria-invalid={Boolean(
                                            form.errors.subheadline,
                                        )}
                                    />
                                    <FieldError
                                        message={form.errors.subheadline}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="summary">Ringkasan *</Label>
                                    <Textarea
                                        id="summary"
                                        value={form.data.summary}
                                        onChange={(event) =>
                                            form.setData(
                                                'summary',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Ringkasan singkat untuk daftar berita"
                                        className="min-h-28 resize-y rounded-lg bg-background leading-6"
                                        maxLength={1000}
                                        aria-invalid={Boolean(
                                            form.errors.summary,
                                        )}
                                    />
                                    <div className="flex justify-between gap-3">
                                        <FieldError
                                            message={form.errors.summary}
                                        />
                                        <span className="ml-auto text-xs text-muted-foreground">
                                            {form.data.summary.length}/1000
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="content">
                                        Isi berita *
                                    </Label>
                                    <NewsRichEditor
                                        value={form.data.content}
                                        onChange={(html) =>
                                            form.setData('content', html)
                                        }
                                        invalid={Boolean(form.errors.content)}
                                        disabled={form.processing}
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
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    Tanpa kategori
                                                </SelectItem>
                                                {categories.map((category) => (
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
                                                ))}
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
                                            disabled={form.processing}
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
                        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-end gap-3 px-4 py-4 sm:px-6 lg:px-8">
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={form.processing}
                                className="h-10 flex-1 rounded-lg bg-card sm:flex-none sm:px-5"
                            >
                                <Save />{' '}
                                {form.processing
                                    ? 'Menyimpan...'
                                    : 'Simpan draf'}
                            </Button>
                            <Button
                                type="button"
                                disabled={
                                    form.processing || !hasRequiredContent
                                }
                                aria-describedby={
                                    !hasRequiredContent
                                        ? 'publish-content-hint'
                                        : undefined
                                }
                                onClick={() => setConfirmPublish(true)}
                                className="h-10 flex-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 sm:flex-none sm:px-5"
                                title="Simpan dan tinjau draf sebelum menerbitkan"
                            >
                                {form.processing ? (
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
                processing={form.processing}
                error={form.errors.platforms}
                onPublish={() => save('publish')}
            />
        </>
    );
}

ManualEditor.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);
