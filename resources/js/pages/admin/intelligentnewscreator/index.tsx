import { Head, Link, router } from '@inertiajs/react';
import {
    Archive,
    Bot,
    FileArchive,
    FilePenLine,
    Grid2X2,
    List,
    MoreHorizontal,
    Newspaper,
    Plus,
    RotateCcw,
    Search,
    Send,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    PublicationIndicators,
    RetryPublicationDialog,
} from '@/components/news-publication';
import type { PublicationResults } from '@/components/news-publication';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type Status = 'draft' | 'active' | 'archived';
type ViewMode = 'card' | 'list';

interface WorkspaceItem {
    publication_results?: PublicationResults;
    retry_url?: string | null;
    view_url?: string | null;
    published_at?: string | null;
    key: string;
    id: number;
    record_type: 'draft' | 'session' | 'news';
    title: string;
    preview: string;
    status: Status;
    creation_method: 'manual' | 'ai';
    category: string | null;
    updated_at: string | null;
    resume_url: string;
    can_publish: boolean;
    quality_score: number | null;
    quality_label: string | null;
    publish_blocked: boolean;
}

interface Props {
    items: WorkspaceItem[];
    counts: Record<Status, number>;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Berita', href: '/admin/news' },
];

const statusNames: Record<Status, string> = {
    draft: 'Draf',
    active: 'Aktif',
    archived: 'Diarsipkan',
};

function ItemActions({ item }: { item: WorkspaceItem }) {
    const [retryOpen, setRetryOpen] = useState(false);
    const published =
        item.record_type === 'news' ||
        Object.keys(item.publication_results ?? {}).length > 0;
    const changeArchiveState = () => {
        const action = item.status === 'archived' ? 'restore' : 'archive';
        router.post(
            `/admin/news/${item.record_type}/${item.id}/${action}`,
            {},
            { preserveScroll: true },
        );
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Tindakan berita"
                    >
                        <MoreHorizontal />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        asChild
                        disabled={published && !item.view_url}
                    >
                        <Link
                            href={
                                published
                                    ? (item.view_url ?? '#')
                                    : item.resume_url
                            }
                        >
                            <FilePenLine />
                            {published
                                ? 'View'
                                : item.record_type === 'session'
                                  ? 'Lanjutkan percakapan'
                                  : 'Buka'}
                        </Link>
                    </DropdownMenuItem>
                    {item.retry_url && (
                        <DropdownMenuItem onSelect={() => setRetryOpen(true)}>
                            <RotateCcw /> Ulang
                        </DropdownMenuItem>
                    )}
                    {item.can_publish && (
                        <DropdownMenuItem
                            onSelect={() =>
                                router.post(
                                    `/admin/news/drafts/${item.id}/publish`,
                                )
                            }
                        >
                            <Send /> Publikasikan
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={changeArchiveState}>
                        {item.status === 'archived' ? (
                            <RotateCcw />
                        ) : (
                            <Archive />
                        )}
                        {item.status === 'archived' ? 'Pulihkan' : 'Arsip'}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {item.retry_url && (
                <RetryPublicationDialog
                    open={retryOpen}
                    onOpenChange={setRetryOpen}
                    url={item.retry_url}
                    results={item.publication_results ?? {}}
                />
            )}
        </>
    );
}

export default function NewsWorkspace({ items, counts }: Props) {
    const [status, setStatus] = useState<Status>('active');
    const [view, setView] = useState<ViewMode>('card');
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const query = search.trim().toLocaleLowerCase('id');

        return items.filter(
            (item) =>
                item.status === status &&
                (!query ||
                    [item.title, item.preview, item.category]
                        .filter(Boolean)
                        .join(' ')
                        .toLocaleLowerCase('id')
                        .includes(query)),
        );
    }, [items, search, status]);

    return (
        <>
            <Head title="Daftar Berita" />
            <div className="min-h-full bg-background p-4 text-foreground md:p-6">
                <div className="mx-auto flex max-w-7xl flex-col gap-6">
                    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                                    <Newspaper className="size-5" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-semibold">
                                        Daftar Berita
                                    </h1>
                                    <p className="text-sm text-muted-foreground">
                                        Kelola draf manual, percakapan AI, dan
                                        berita aktif.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild>
                                <Link href="/admin/documents">
                                    <FileArchive /> Arsip dokumen
                                </Link>
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button>
                                        <Plus /> Buat berita
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-56"
                                >
                                    <DropdownMenuItem asChild>
                                        <Link href="/admin/news/manual/create">
                                            <FilePenLine /> Tulis manual
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/admin/ai-assistant">
                                            <Bot /> Buat dengan AI
                                        </Link>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>

                    <Card className="gap-4 py-4">
                        <CardContent className="flex flex-col gap-4 px-4 lg:flex-row lg:items-center lg:justify-between">
                            <Tabs
                                value={status}
                                onValueChange={(value) =>
                                    setStatus(value as Status)
                                }
                            >
                                <TabsList>
                                    {(Object.keys(statusNames) as Status[]).map(
                                        (value) => (
                                            <TabsTrigger
                                                key={value}
                                                value={value}
                                            >
                                                {statusNames[value]}
                                                <Badge
                                                    variant="secondary"
                                                    className="ml-1.5"
                                                >
                                                    {counts[value]}
                                                </Badge>
                                            </TabsTrigger>
                                        ),
                                    )}
                                </TabsList>
                            </Tabs>
                            <div className="flex gap-2">
                                <div className="relative min-w-0 flex-1 sm:w-72">
                                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Cari berita…"
                                        className="pl-9"
                                    />
                                </div>
                                <ToggleGroup
                                    type="single"
                                    value={view}
                                    onValueChange={(value) =>
                                        value && setView(value as ViewMode)
                                    }
                                    variant="outline"
                                >
                                    <ToggleGroupItem
                                        value="card"
                                        aria-label="Tampilan kartu"
                                    >
                                        <Grid2X2 />
                                    </ToggleGroupItem>
                                    <ToggleGroupItem
                                        value="list"
                                        aria-label="Tampilan daftar"
                                    >
                                        <List />
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </div>
                        </CardContent>
                    </Card>

                    {filtered.length === 0 ? (
                        <Card className="border-dashed py-14 text-center">
                            <CardContent className="space-y-3">
                                <Newspaper className="mx-auto size-10 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">
                                        Belum ada{' '}
                                        {statusNames[status].toLowerCase()}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Buat berita manual atau mulai percakapan
                                        dengan AI.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : view === 'card' ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {filtered.map((item) => (
                                <Card
                                    key={item.key}
                                    className="gap-4 transition-colors hover:border-primary/40"
                                >
                                    <CardHeader className="flex-row items-start justify-between gap-3 px-5">
                                        <div className="flex flex-wrap gap-2">
                                            <Badge
                                                variant={
                                                    item.creation_method ===
                                                    'ai'
                                                        ? 'default'
                                                        : 'secondary'
                                                }
                                            >
                                                {item.creation_method ===
                                                'ai' ? (
                                                    <Bot />
                                                ) : (
                                                    <FilePenLine />
                                                )}
                                                {item.creation_method === 'ai'
                                                    ? 'Dibuat AI'
                                                    : 'Manual'}
                                            </Badge>
                                            {item.category && (
                                                <Badge variant="outline">
                                                    {item.category}
                                                </Badge>
                                            )}
                                            {item.quality_score !== null && (
                                                <Badge
                                                    variant={
                                                        item.publish_blocked
                                                            ? 'destructive'
                                                            : 'outline'
                                                    }
                                                >
                                                    Kualitas{' '}
                                                    {item.quality_score.toFixed(
                                                        1,
                                                    )}
                                                    %
                                                </Badge>
                                            )}
                                        </div>
                                        <ItemActions item={item} />
                                    </CardHeader>
                                    <CardContent className="min-h-28 space-y-2 px-5">
                                        <Link
                                            href={item.resume_url}
                                            className="line-clamp-2 font-semibold hover:text-primary"
                                        >
                                            {item.title}
                                        </Link>
                                        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                                            {item.preview}
                                        </p>
                                    </CardContent>
                                    <CardFooter className="mt-auto flex-wrap justify-between gap-3 border-t px-5 pt-4 text-xs text-muted-foreground">
                                        <span>
                                            {(item.published_at ??
                                            item.updated_at)
                                                ? new Date(
                                                      (item.published_at ??
                                                          item.updated_at)!,
                                                  ).toLocaleDateString('id-ID')
                                                : '-'}
                                        </span>
                                        <PublicationIndicators
                                            results={
                                                item.publication_results ?? {}
                                            }
                                        />
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="gap-0 overflow-hidden py-0">
                            {filtered.map((item) => (
                                <div
                                    key={item.key}
                                    className="flex items-center gap-4 border-b p-4 last:border-b-0"
                                >
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                                        {item.creation_method === 'ai' ? (
                                            <Bot />
                                        ) : (
                                            <FilePenLine />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={item.resume_url}
                                            className="block truncate font-medium hover:text-primary"
                                        >
                                            {item.title}
                                        </Link>
                                        <p className="truncate text-sm text-muted-foreground">
                                            {item.preview}
                                        </p>
                                    </div>
                                    <Badge
                                        variant={
                                            item.creation_method === 'ai'
                                                ? 'default'
                                                : 'secondary'
                                        }
                                        className="hidden sm:flex"
                                    >
                                        {item.creation_method === 'ai'
                                            ? 'AI'
                                            : 'Manual'}
                                    </Badge>
                                    {item.quality_score !== null && (
                                        <Badge
                                            variant={
                                                item.publish_blocked
                                                    ? 'destructive'
                                                    : 'outline'
                                            }
                                            className="hidden sm:flex"
                                        >
                                            {item.quality_score.toFixed(1)}%
                                        </Badge>
                                    )}
                                    <span className="hidden text-xs text-muted-foreground md:block">
                                        {item.updated_at
                                            ? new Date(
                                                  item.updated_at,
                                              ).toLocaleDateString('id-ID')
                                            : '-'}
                                    </span>
                                    <ItemActions item={item} />
                                </div>
                            ))}
                        </Card>
                    )}
                </div>
            </div>
        </>
    );
}

NewsWorkspace.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);
