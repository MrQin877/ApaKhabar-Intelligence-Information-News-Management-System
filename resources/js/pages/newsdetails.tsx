import { Head, Link, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { HeaderBar } from '@/components/header-bar';
import NewsEngagement from '@/components/news-engagement';
import type { PublicComment } from '@/components/news-engagement';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SharedData } from '@/types';

interface News {
    id: number;
    title: string;
    content: string;
    image: string;
    original_image: string;
    date: string;
    category: string;
    views: number;
    likes_count: number;
    liked_by_user: boolean;
}

interface Props {
    news: News;
    comments: PublicComment[];
    canRegister?: boolean;
}

export default function NewsDetails({ news, comments = [] }: Props) {
    const imagePreviewTrigger = useRef<HTMLButtonElement>(null);
    const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title={`${news.title} — ApaKhabar`} />

            <div className="min-h-screen bg-background text-foreground">
                <HeaderBar />

                <main className="mx-auto max-w-3xl px-4 py-10">
                    {/* 7️⃣ Page header fades in */}
                    <div className="mb-6 animate-fade-slide-up">
                        <h1 className="text-3xl leading-tight font-bold text-foreground">
                            {news.title}
                        </h1>
                    </div>

                    {/* Breadcrumb — slight delay */}
                    <div
                        className="mb-6 flex animate-fade-slide-up items-center gap-2 text-xs text-muted-foreground"
                        style={{ animationDelay: '80ms' }}
                    >
                        <Link
                            href="/"
                            className="transition-colors duration-200 hover:text-primary"
                        >
                            Beranda
                        </Link>
                        <span>/</span>
                        <span className="text-muted-foreground">
                            {news.category}
                        </span>
                    </div>

                    {/* Category & Meta — slight delay */}
                    <div
                        className="mb-4 flex animate-fade-slide-up items-center gap-3"
                        style={{ animationDelay: '120ms' }}
                    >
                        <Badge className="bg-brand-100 text-brand-800 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-300">
                            {news.category}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                            {news.date}
                        </span>
                    </div>

                    {/* 8️⃣ Hero image fades in with zoom — longer delay so title loads first */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    ref={imagePreviewTrigger}
                                    aria-label="Lihat gambar penuh"
                                    onClick={() => setImagePreviewOpen(true)}
                                    className="mb-8 block w-full animate-fade-slide-up cursor-zoom-in overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                    style={{ animationDelay: '160ms' }}
                                >
                                    <img
                                        src={news.image}
                                        alt={news.title}
                                        className={
                                            /\/news-images\/(?:crops\/|previews\/[^/]+\/crops\/)/.test(
                                                news.image ?? '',
                                            )
                                                ? 'h-auto w-full'
                                                : 'max-h-96 w-full object-cover transition-transform duration-700 hover:scale-[1.02]'
                                        }
                                    />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Lihat gambar penuh</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <Dialog
                        open={imagePreviewOpen}
                        onOpenChange={setImagePreviewOpen}
                    >
                        <DialogContent
                            onCloseAutoFocus={(event) => {
                                event.preventDefault();
                                imagePreviewTrigger.current?.focus();
                            }}
                            aria-describedby={undefined}
                            overlayClassName="bg-black/90"
                            className="flex h-dvh w-screen max-w-none items-center justify-center rounded-none border-0 bg-transparent p-4 pt-16 text-white shadow-none sm:max-w-none [&>button]:rounded-full [&>button]:bg-black/70 [&>button]:p-2 [&>button]:text-white [&>button]:opacity-100"
                            onClick={(event) => {
                                if (event.target === event.currentTarget) {
                                    setImagePreviewOpen(false);
                                }
                            }}
                        >
                            <DialogTitle className="sr-only">
                                Gambar penuh: {news.title}
                            </DialogTitle>
                            <img
                                src={news.original_image || news.image}
                                alt={news.title}
                                className="max-h-full max-w-full object-contain"
                            />
                        </DialogContent>
                    </Dialog>

                    {/* Article body */}
                    <div
                        className="article-content prose prose-sm dark:prose-invert mb-8 max-w-none animate-fade-slide-up leading-relaxed text-foreground"
                        style={{ animationDelay: '200ms' }}
                        dangerouslySetInnerHTML={{ __html: news.content || '' }}
                    />

                    <NewsEngagement
                        key={news.id}
                        news={news}
                        comments={comments}
                        authenticated={!!auth.user}
                    />
                </main>
            </div>
        </>
    );
}
