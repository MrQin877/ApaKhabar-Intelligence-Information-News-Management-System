import { Head, router, useForm } from '@inertiajs/react';
import { Edit3, Plus, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Category {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: 'active' | 'inactive';
    display_order: number;
    is_default: boolean;
    articles_count: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Kategori Berita', href: '/admin/categories' },
];

export default function Categories({ categories }: { categories: Category[] }) {
    const [editing, setEditing] = useState<Category | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Category | null>(null);
    const form = useForm({
        name: '',
        description: '',
        status: 'active' as 'active' | 'inactive',
        display_order: 0,
    });

    function openForm(category?: Category) {
        setEditing(category ?? null);
        form.setData(
            category
                ? {
                      name: category.name,
                      description: category.description ?? '',
                      status: category.status,
                      display_order: category.display_order,
                  }
                : {
                      name: '',
                      description: '',
                      status: 'active',
                      display_order: categories.length,
                  },
        );
        form.clearErrors();
        setFormOpen(true);
    }

    function submit() {
        const options = {
            preserveScroll: true,
            onSuccess: () => setFormOpen(false),
        };

        if (editing) {
            form.put(`/admin/categories/${editing.id}`, options);
        } else {
            form.post('/admin/categories', options);
        }
    }

    function toggleStatus(category: Category) {
        router.put(
            `/admin/categories/${category.id}`,
            {
                name: category.name,
                description: category.description,
                display_order: category.display_order,
                status: category.status === 'active' ? 'inactive' : 'active',
            },
            { preserveScroll: true },
        );
    }

    return (
        <>
            <Head title="Kategori Berita" />
            <div className="min-h-full bg-background p-4 text-foreground md:p-6">
                <div className="mx-auto max-w-6xl space-y-6">
                    <header className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h1 className="flex items-center gap-2 text-2xl font-semibold">
                                <Tags className="text-primary" /> Kategori
                                Berita
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Kategori aktif langsung tersedia untuk editor
                                dan asisten AI.
                            </p>
                        </div>
                        <Button onClick={() => openForm()}>
                            <Plus /> Tambah kategori
                        </Button>
                    </header>

                    <Card>
                        <CardHeader>
                            <CardTitle>Semua kategori</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Urutan</TableHead>
                                        <TableHead>Nama</TableHead>
                                        <TableHead>Slug</TableHead>
                                        <TableHead>Artikel</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">
                                            Tindakan
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categories.map((category) => (
                                        <TableRow key={category.id}>
                                            <TableCell>
                                                {category.display_order}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {category.name}{' '}
                                                {category.is_default && (
                                                    <Badge variant="secondary">
                                                        Bawaan
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {category.slug}
                                            </TableCell>
                                            <TableCell>
                                                {category.articles_count}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        category.status ===
                                                        'active'
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                >
                                                    {category.status ===
                                                    'active'
                                                        ? 'Aktif'
                                                        : 'Nonaktif'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            openForm(category)
                                                        }
                                                    >
                                                        <Edit3 /> Edit
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={
                                                            category.is_default
                                                        }
                                                        onClick={() =>
                                                            toggleStatus(
                                                                category,
                                                            )
                                                        }
                                                    >
                                                        {category.status ===
                                                        'active'
                                                            ? 'Nonaktifkan'
                                                            : 'Aktifkan'}
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="icon-sm"
                                                        disabled={
                                                            category.is_default
                                                        }
                                                        onClick={() =>
                                                            setDeleting(
                                                                category,
                                                            )
                                                        }
                                                        aria-label={`Hapus ${category.name}`}
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? 'Edit kategori' : 'Tambah kategori'}
                        </DialogTitle>
                        <DialogDescription>
                            Slug dibuat otomatis dari nama kategori.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="category-name">Nama *</Label>
                            <Input
                                id="category-name"
                                value={form.data.name}
                                onChange={(event) =>
                                    form.setData('name', event.target.value)
                                }
                            />
                            {form.errors.name && (
                                <p className="text-xs text-destructive">
                                    {form.errors.name}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category-description">
                                Deskripsi
                            </Label>
                            <Textarea
                                id="category-description"
                                value={form.data.description}
                                onChange={(event) =>
                                    form.setData(
                                        'description',
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category-order">
                                Urutan tampilan
                            </Label>
                            <Input
                                id="category-order"
                                type="number"
                                min={0}
                                value={form.data.display_order}
                                onChange={(event) =>
                                    form.setData(
                                        'display_order',
                                        Number(event.target.value),
                                    )
                                }
                            />
                        </div>
                        {editing && (
                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <Label htmlFor="category-active">
                                    Kategori aktif
                                </Label>
                                <Switch
                                    id="category-active"
                                    checked={form.data.status === 'active'}
                                    disabled={editing.is_default}
                                    onCheckedChange={(checked) =>
                                        form.setData(
                                            'status',
                                            checked ? 'active' : 'inactive',
                                        )
                                    }
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setFormOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button onClick={submit} disabled={form.processing}>
                            {form.processing ? 'Menyimpan…' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={Boolean(deleting)}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Hapus kategori {deleting?.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleting?.articles_count
                                ? `Kategori ini digunakan oleh ${deleting.articles_count} artikel/draf. Penghapusan akan ditolak; nonaktifkan atau pindahkan artikelnya terlebih dahulu.`
                                : 'Kategori yang tidak digunakan dapat dihapus permanen.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={Boolean(deleting?.articles_count)}
                            onClick={() =>
                                deleting &&
                                router.delete(
                                    `/admin/categories/${deleting.id}`,
                                    { onSuccess: () => setDeleting(null) },
                                )
                            }
                        >
                            Hapus kategori
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

Categories.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);
