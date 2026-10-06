import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
export interface Category {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: 'active' | 'inactive';
    display_order: number;
    is_default: boolean;
    articles_count: number;
}

export interface SavedCategory {
    categoryID: number;
    name: string;
    is_active: boolean;
    display_order: number;
}

export function CategoryDialog({
    editing = null,
    defaultOrder = 0,
    onClose,
    onSaved,
}: {
    editing?: Category | null;
    defaultOrder?: number;
    onClose: () => void;
    onSaved: (category: SavedCategory, categories?: Category[]) => void;
}) {
    const form = useForm({
        name: editing?.name ?? '',
        description: editing?.description ?? '',
        status: editing?.status ?? 'active',
        display_order: editing?.display_order ?? defaultOrder,
    });
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    async function submit() {
        if (processing) {
            return;
        }

        setProcessing(true);
        setError('');
        form.clearErrors();

        try {
            const csrf = document.querySelector<HTMLMetaElement>(
                'meta[name="csrf-token"]',
            )?.content;
            const cookie = document.cookie
                .split('; ')
                .find((value) => value.startsWith('XSRF-TOKEN='));
            const response = await fetch(
                editing
                    ? `/admin/categories/${editing.id}`
                    : '/admin/categories',
                {
                    method: editing ? 'PUT' : 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        ...(cookie
                            ? {
                                  'X-XSRF-TOKEN': decodeURIComponent(
                                      cookie.slice(11),
                                  ),
                              }
                            : csrf
                              ? { 'X-CSRF-TOKEN': csrf }
                              : {}),
                    },
                    body: JSON.stringify(form.data),
                },
            );
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 422 && data.errors) {
                    for (const field of [
                        'name',
                        'description',
                        'status',
                        'display_order',
                    ] as const) {
                        if (data.errors[field]) {
                            form.setError(field, data.errors[field][0]);
                        }
                    }

                    return;
                }

                throw new Error(
                    data.message ?? 'Kategori tidak dapat disimpan.',
                );
            }

            onSaved(data.category, data.categories);
            onClose();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Kategori tidak dapat disimpan.',
            );
        } finally {
            setProcessing(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !processing) {
                    onClose();
                }
            }}
        >
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
                        <Label htmlFor="category-description">Deskripsi</Label>
                        <Textarea
                            id="category-description"
                            value={form.data.description}
                            onChange={(event) =>
                                form.setData('description', event.target.value)
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="category-order">Urutan tampilan</Label>
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
                {form.errors.description && (
                    <p role="alert" className="text-xs text-destructive">
                        {form.errors.description}
                    </p>
                )}
                {form.errors.display_order && (
                    <p role="alert" className="text-xs text-destructive">
                        {form.errors.display_order}
                    </p>
                )}
                {form.errors.status && (
                    <p role="alert" className="text-xs text-destructive">
                        {form.errors.status}
                    </p>
                )}
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={processing}
                        onClick={onClose}
                    >
                        Batal
                    </Button>
                    <Button onClick={submit} disabled={processing}>
                        {processing ? 'Menyimpan…' : 'Simpan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
