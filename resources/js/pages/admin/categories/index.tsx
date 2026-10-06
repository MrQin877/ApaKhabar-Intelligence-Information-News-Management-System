import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Head, router } from '@inertiajs/react';
import { Edit3, Plus, Tags, Trash2, GripVertical, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import type React from 'react';
import { CategoryDialog } from '@/components/category-dialog';
import type { Category } from '@/components/category-dialog';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Kategori Berita', href: '/admin/categories' },
];

function SortableCategoryRow({
    category,
    position,
    saving,
    locked,
    openForm,
    toggleStatus,
    setDeleting,
}: {
    category: Category;
    position: number;
    saving: boolean;
    locked: boolean;
    openForm: (category: Category) => void;
    toggleStatus: (category: Category) => void;
    setDeleting: (category: Category) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: category.id, disabled: saving });

    return (
        <TableRow
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                position: 'relative',
                zIndex: isDragging ? 1 : undefined,
            }}
            className={
                isDragging
                    ? 'bg-accent shadow-lg outline outline-primary'
                    : undefined
            }
        >
            <TableCell className="w-12">
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        ref={setActivatorNodeRef}
                        {...attributes}
                        {...listeners}
                        disabled={saving}
                        className="cursor-grab touch-none active:cursor-grabbing"
                        aria-label={`Geser ${category.name}`}
                    >
                        <GripVertical className="size-4" />
                    </Button>
                </div>
            </TableCell>
            <TableCell>{position}</TableCell>
            <TableCell className="font-medium">
                {category.name}{' '}
                {category.is_default && (
                    <Badge variant="secondary">Bawaan</Badge>
                )}
            </TableCell>
            <TableCell className="text-muted-foreground">
                {category.slug}
            </TableCell>
            <TableCell>{category.articles_count}</TableCell>
            <TableCell>
                <Badge
                    variant={
                        category.status === 'active' ? 'default' : 'outline'
                    }
                >
                    {category.status === 'active' ? 'Aktif' : 'Nonaktif'}
                </Badge>
            </TableCell>
            <TableCell>
                <div className="flex justify-end gap-2">
                    <Button
                        disabled={locked}
                        variant="outline"
                        size="sm"
                        onClick={() => openForm(category)}
                    >
                        <Edit3 /> Edit
                    </Button>
                    <Button
                        disabled={locked}
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatus(category)}
                    >
                        {category.status === 'active'
                            ? 'Nonaktifkan'
                            : 'Aktifkan'}
                    </Button>
                    <Button
                        disabled={locked}
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => setDeleting(category)}
                        aria-label={`Hapus ${category.name}`}
                    >
                        <Trash2 />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}

export default function Categories({ categories }: { categories: Category[] }) {
    const [ordered, setOrdered] = useState(categories);
    const [saving, setSaving] = useState(false);
    const [orderError, setOrderError] = useState('');
    useEffect(() => {
        setOrdered(categories);
    }, [categories]);
    const dirty = ordered.some(
        (category, index) => category.id !== categories[index]?.id,
    );
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );
    function move(from: number, to: number) {
        if (
            saving ||
            from < 0 ||
            to < 0 ||
            from >= ordered.length ||
            to >= ordered.length ||
            from === to
        ) {
            return;
        }

        setOrdered((current) => arrayMove(current, from, to));
        setOrderError('');
    }
    function saveOrder() {
        if (!dirty || saving) {
            return;
        }

        setSaving(true);
        setOrderError('');
        router.post(
            '/admin/categories/reorder',
            {
                ids: ordered.map((category) => category.id),
                original_ids: categories.map((category) => category.id),
            },
            {
                preserveScroll: true,
                onError: (errors) =>
                    setOrderError(
                        errors.ids ??
                            Object.values(errors)[0] ??
                            'Urutan gagal disimpan.',
                    ),
                onFinish: () => setSaving(false),
            },
        );
    }
    const [editing, setEditing] = useState<Category | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Category | null>(null);
    function openForm(category?: Category) {
        setEditing(category ?? null);
        setFormOpen(true);
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
                        </div>
                        <Button
                            disabled={dirty || saving}
                            onClick={() => openForm()}
                        >
                            <Plus /> Tambah kategori
                        </Button>
                    </header>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <CardTitle>Semua kategori</CardTitle>
                                <div
                                    className={`flex gap-2 ${dirty ? 'visible' : 'invisible'}`}
                                    aria-hidden={!dirty}
                                >
                                    <Button
                                        variant="outline"
                                        disabled={!dirty || saving}
                                        onClick={() => {
                                            setOrdered(categories);
                                            setOrderError('');
                                        }}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        disabled={!dirty || saving}
                                        onClick={saveOrder}
                                    >
                                        <Save />
                                        {saving
                                            ? 'Menyimpan…'
                                            : 'Simpan urutan'}
                                    </Button>
                                </div>
                            </div>
                            {orderError && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {orderError}
                                </p>
                            )}
                        </CardHeader>
                        <CardContent>
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={({ active, over }) => {
                                    if (over) {
                                        move(
                                            ordered.findIndex(
                                                (category) =>
                                                    category.id === active.id,
                                            ),
                                            ordered.findIndex(
                                                (category) =>
                                                    category.id === over.id,
                                            ),
                                        );
                                    }
                                }}
                            >
                                <SortableContext
                                    items={ordered.map(
                                        (category) => category.id,
                                    )}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>
                                                    <span className="sr-only">
                                                        Atur urutan
                                                    </span>
                                                </TableHead>
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
                                            {ordered.map((category, index) => (
                                                <SortableCategoryRow
                                                    key={category.id}
                                                    category={category}
                                                    position={index + 1}
                                                    saving={saving}
                                                    locked={dirty || saving}
                                                    openForm={openForm}
                                                    toggleStatus={toggleStatus}
                                                    setDeleting={setDeleting}
                                                />
                                            ))}
                                        </TableBody>
                                    </Table>
                                </SortableContext>
                            </DndContext>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {formOpen && (
                <CategoryDialog
                    editing={editing}
                    defaultOrder={categories.length}
                    onClose={() => setFormOpen(false)}
                    onSaved={() => router.reload({ only: ['categories'] })}
                />
            )}

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
                            Kategori akan dihapus dari pilihan kategori. Berita
                            dan draf yang sudah menggunakan kategori ini tetap
                            tersimpan dan dapat dibuka.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
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
