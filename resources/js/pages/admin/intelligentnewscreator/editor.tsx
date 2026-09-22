import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, FilePenLine, Save } from 'lucide-react';
import type { FormEvent } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Draft {
    id: number;
    headline: string;
    subheadline: string | null;
    content: string;
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

export default function ManualEditor({ draft, categories }: Props) {
    const form = useForm({
        headline: draft?.headline ?? '',
        subheadline: draft?.subheadline ?? '',
        content: draft?.content ?? '',
        summary: draft?.summary ?? '',
        category_id: draft?.category_id ? String(draft.category_id) : '',
        image: draft?.image ?? '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true };

        if (draft) {
            form.put(`/admin/news/manual/${draft.id}`, options);
        } else {
            form.post('/admin/news/manual', options);
        }
    };

    return (
        <>
            <Head title={draft ? 'Edit Draf Berita' : 'Buat Berita Manual'} />
            <div className="min-h-full bg-background p-4 text-foreground md:p-6">
                <form
                    onSubmit={submit}
                    className="mx-auto flex max-w-5xl flex-col gap-6"
                >
                    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="icon" asChild>
                                <Link
                                    href="/admin/news"
                                    aria-label="Kembali"
                                >
                                    <ArrowLeft />
                                </Link>
                            </Button>
                            <div>
                                <h1 className="text-2xl font-semibold">
                                    {draft
                                        ? 'Edit draf manual'
                                        : 'Buat berita manual'}
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Tulis dan simpan berita sebagai draf sebelum
                                    dipublikasikan.
                                </p>
                            </div>
                        </div>
                        <Button type="submit" disabled={form.processing}>
                            <Save />{' '}
                            {form.processing ? 'Menyimpan…' : 'Simpan draf'}
                        </Button>
                    </header>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <FilePenLine className="size-5 text-primary" />
                                    <CardTitle>Konten berita</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
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
                                        className="min-h-24"
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
                                    <Textarea
                                        id="content"
                                        value={form.data.content}
                                        onChange={(event) =>
                                            form.setData(
                                                'content',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Tulis isi berita. Pisahkan paragraf dengan satu baris kosong."
                                        className="min-h-[420px] resize-y leading-7"
                                        aria-invalid={Boolean(
                                            form.errors.content,
                                        )}
                                    />
                                    <FieldError message={form.errors.content} />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Pengaturan</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="space-y-2">
                                        <Label>Kategori</Label>
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
                                    <div className="space-y-2">
                                        <Label htmlFor="image">
                                            URL gambar
                                        </Label>
                                        <Input
                                            id="image"
                                            type="url"
                                            value={form.data.image}
                                            onChange={(event) =>
                                                form.setData(
                                                    'image',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="https://…"
                                            aria-invalid={Boolean(
                                                form.errors.image,
                                            )}
                                        />
                                        <FieldError
                                            message={form.errors.image}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-muted/30">
                                <CardContent className="text-sm leading-6 text-muted-foreground">
                                    Menyimpan tidak langsung mempublikasikan
                                    berita. Anda dapat meninjau dan
                                    mempublikasikannya dari halaman Pembuat
                                    Berita.
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
}

ManualEditor.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);
