import {
    Bookmark,
    Globe,
    Heart,
    MessageCircle,
    Send,
    Share2,
    ThumbsUp,
    UserRound,
} from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import type { PublishPlatformId } from '@/components/publish-news-dialog';

export interface PublicationPreviewData {
    token: string;
    title: string;
    category: string | null;
    content: string;
    caption: string;
    images: Record<PublishPlatformId, string | null>;
    issues: Partial<Record<PublishPlatformId, string[]>>;
}

export const platformNames = {
    website: 'Aplikasi',
    facebook: 'Facebook',
    instagram: 'Instagram',
};

export function PlatformIcon({ platform }: { platform: PublishPlatformId }) {
    return platform === 'website' ? (
        <AppLogoIcon className="size-5 shrink-0" aria-hidden="true" />
    ) : (
        <img
            src={`/images/integrations/${platform === 'facebook' ? 'facebook.png' : 'instagram.svg'}`}
            alt=""
            className="size-5 shrink-0 object-contain"
        />
    );
}

export function PublicationPreview({
    data,
    platform,
    accountName,
    onImageLoad,
    onImageError,
}: {
    data: PublicationPreviewData;
    platform: PublishPlatformId;
    accountName?: string | null;
    onImageLoad: () => void;
    onImageError: () => void;
}) {
    const displayName =
        accountName?.trim() ||
        (platform === 'facebook' ? 'Halaman Facebook' : 'akun_instagram');
    const cardWidth = {
        website: 'max-w-[560px]',
        facebook: 'max-w-[500px]',
        instagram: 'max-w-[340px]',
    }[platform];
    const image = data.images[platform];
    const photo = image ? (
        <img
            src={image}
            alt={`Foto berita ${platformNames[platform]}`}
            onLoad={onImageLoad}
            onError={onImageError}
            className="block h-auto w-full"
        />
    ) : null;

    return (
        <div className="mx-auto w-full max-w-[560px]">
            <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
                Tampilan di {platformNames[platform]}
            </p>
            <article
                className={`mx-auto w-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm ${cardWidth}`}
            >
                {platform === 'website' ? (
                    <>
                        {photo}
                        <div className="space-y-1.5 p-3">
                            {data.category && (
                                <span className="inline-flex max-w-full rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium break-words whitespace-normal text-primary">
                                    {data.category}
                                </span>
                            )}
                            <h1 className="text-base leading-5 font-bold break-words">
                                {data.title}
                            </h1>
                            <div
                                className="article-content text-sm leading-5 break-words [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:italic [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-semibold [&_li]:my-0 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-4"
                                dangerouslySetInnerHTML={{
                                    __html: data.content,
                                }}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2 px-3 py-2">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <UserRound
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            </span>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold break-words">
                                    {displayName}
                                </p>
                                {!accountName?.trim() && (
                                    <p className="text-xs text-muted-foreground">
                                        Nama contoh untuk pratinjau
                                    </p>
                                )}
                                {platform === 'facebook' && (
                                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                        Baru saja &middot;{' '}
                                        <Globe
                                            className="size-3"
                                            aria-label="Publik"
                                        />
                                    </p>
                                )}
                            </div>
                        </div>
                        {platform === 'facebook' && (
                            <p className="mx-3 mb-2 text-sm leading-5 break-words whitespace-pre-wrap">
                                {data.caption}
                            </p>
                        )}
                        {photo}
                        {platform === 'facebook' ? (
                            <div className="flex flex-wrap justify-around gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-2">
                                    <ThumbsUp className="size-4" />
                                    Suka
                                </span>
                                <span className="flex items-center gap-2">
                                    <MessageCircle className="size-4" />
                                    Komentar
                                </span>
                                <span className="flex items-center gap-2">
                                    <Share2 className="size-4" />
                                    Bagikan
                                </span>
                            </div>
                        ) : (
                            <>
                                <div
                                    className="flex gap-3 px-3 py-2 [&_svg]:size-4"
                                    aria-label="Suka, komentar, bagikan, dan simpan"
                                >
                                    <Heart />
                                    <MessageCircle />
                                    <Send />
                                    <Bookmark className="ml-auto" />
                                </div>
                                <p className="mx-3 mb-3 text-sm leading-5 break-words whitespace-pre-wrap">
                                    <strong>{displayName} </strong>
                                    {data.caption}
                                </p>
                            </>
                        )}
                    </>
                )}
            </article>
        </div>
    );
}
