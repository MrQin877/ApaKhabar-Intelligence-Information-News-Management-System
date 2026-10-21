import { Link } from '@inertiajs/react';
import { ArrowRight, Eye, Play } from 'lucide-react';

export interface HomeShort {
    id: number;
    title: string;
    description: string;
    thumbnail_url: string;
    video_url: string;
    view_count: number;
}
function compactViews(count: number) {
    if (count < 1000) {
        return String(count);
    }

    const unit = count < 1_000_000 ? 1000 : 1_000_000;
    const suffix = unit === 1000 ? 'K' : 'M';
    const rounded = Math.floor((count / unit) * 10) / 10;

    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}${suffix}`;
}
export function HomeShorts({ shorts = [] }: { shorts?: HomeShort[] }) {
    return (
        <section
            id="shorts"
            className="scroll-mt-24 space-y-4"
            aria-label="Shorts"
        >
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">Shorts</h2>
            </div>
            <p className="text-xs text-muted-foreground">
                Video pendek terbaru dari ApaKhabar.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
                {shorts.map(({ id, title, thumbnail_url, view_count }) => (
                    <Link
                        key={id}
                        href={`/shorts/${id}`}
                        className="group min-w-0 space-y-3 focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
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
                            <span
                                className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-xs font-medium text-white"
                                aria-label={`${(view_count ?? 0).toLocaleString('id-ID')} tayangan`}
                            >
                                <Eye className="size-3.5" aria-hidden="true" />
                                {compactViews(view_count ?? 0)}
                            </span>
                        </div>
                        <h3 className="line-clamp-2 text-sm leading-snug font-semibold">
                            {title}
                        </h3>
                    </Link>
                ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                {shorts.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                        Belum ada video pendek yang diterbitkan.
                    </p>
                )}
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
