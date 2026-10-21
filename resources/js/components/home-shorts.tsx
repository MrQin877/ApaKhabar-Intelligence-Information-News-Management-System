import { ArrowRight, Play } from 'lucide-react';

export interface HomeShort {
    id: number;
    title: string;
    description: string;
    thumbnail_url: string;
    video_url: string;
}
export function HomeShorts({ shorts = [] }: { shorts?: HomeShort[] }) {
    return (
        <section className="space-y-4" aria-label="Shorts">
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">Shorts</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
                {shorts.map(({ id, title, thumbnail_url }) => (
                    <article key={id} className="min-w-0 space-y-3">
                        <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-secondary">
                            <img
                                src={thumbnail_url}
                                alt=""
                                loading="lazy"
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                            <span className="absolute top-3 left-3 rounded-full bg-black/40 p-2 text-white">
                                <Play className="size-4" />
                            </span>
                        </div>
                        <h3 className="line-clamp-2 text-sm leading-snug font-semibold">
                            {title}
                        </h3>
                    </article>
                ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                    {shorts.length === 0
                        ? 'Belum ada video pendek yang diterbitkan.'
                        : 'Video pendek terbaru dari ApaKhabar.'}
                </p>
                <a
                    role="link"
                    aria-disabled="true"
                    title="Segera hadir"
                    className="ml-auto inline-flex cursor-default items-center gap-2 text-sm font-medium text-primary"
                >
                    More Shorts <ArrowRight className="size-4" />
                </a>
            </div>
        </section>
    );
}
