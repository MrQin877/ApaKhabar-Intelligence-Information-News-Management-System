import { Head, Link, usePage, router } from '@inertiajs/react';
import {
    Eye,
    Heart,
    Lock,
    MessageCircle,
    ThumbsUp,
    ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import { HeaderBar } from '@/components/header-bar';
import { Badge } from '@/components/ui/badge';
import { login, register } from '@/routes';
import type { SharedData } from '@/types';

interface Reply {
    id: number;
    author: string;
    avatar: string;
    content: string;
    date: string;
    likes: number;
}

interface Comment {
    id: number;
    author: string;
    avatar: string;
    content: string;
    date: string;
    likes: number;
    replies: Reply[];
}

interface News {
    id: number;
    title: string;
    content: string;
    image: string;
    date: string;
    category: string;
    views: number;
    likes_count: number;
    liked_by_user: boolean;
}

interface Props {
    news: News;
    comments: Comment[];
    canRegister?: boolean;
}

// ─── Auth Prompt Modal ────────────────────────────────────────────────────────

function AuthPrompt({
    action,
    onClose,
}: {
    action: string;
    onClose: () => void;
}) {
    return (
        // 1️⃣ Modal backdrop fade-in
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            style={{ animation: 'fadeIn 0.2s ease both' }}
        >
            {/* 2️⃣ Modal card slide-up */}
            <div
                className="mx-4 w-full max-w-sm rounded-xl bg-card p-8 text-center text-card-foreground shadow-xl"
                style={{ animation: 'fadeSlideUp 0.25s ease both' }}
            >
                <div className="mb-4 flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-bg">
                        <Lock className="h-6 w-6 text-danger-500" />
                    </div>
                </div>
                <h3 className="mb-2 text-lg font-bold text-card-foreground">
                    Login Diperlukan
                </h3>
                <p className="mb-6 text-sm text-muted-foreground">
                    Anda perlu login untuk {action}. Bergabunglah sekarang —
                    gratis!
                </p>
                <div className="flex gap-3">
                    <Link
                        href={login()}
                        className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
                    >
                        Masuk
                    </Link>
                    <Link
                        href={register()}
                        className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-700"
                    >
                        Daftar
                    </Link>
                </div>
                <button
                    onClick={onClose}
                    className="mt-4 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                    Nanti saja
                </button>
            </div>
        </div>
    );
}

// ─── Comment Thread ───────────────────────────────────────────────────────────

function CommentItem({
    comment,
    isAuthenticated,
    onAuthRequired,
}: {
    comment: Comment;
    isAuthenticated: boolean;
    onAuthRequired: (action: string) => void;
}) {
    const [showReplyBox, setShowReplyBox] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [showReplies, setShowReplies] = useState(true);

    const handleReplyClick = () => {
        if (!isAuthenticated) {
            onAuthRequired('membalas komentar');

            return;
        }

        setShowReplyBox(!showReplyBox);
    };

    const handleSubmitReply = () => {
        if (!replyText.trim()) {
            return;
        }

        router.post(`/comments/${comment.id}/replies`, { content: replyText });
        setReplyText('');
        setShowReplyBox(false);
    };

    return (
        // 3️⃣ Each comment fades in on mount
        <div className="flex animate-fade-slide-up gap-3">
            <img
                src={
                    comment.avatar ||
                    `https://ui-avatars.com/api/?name=${comment.author}&background=dcfce7&color=16a34a`
                }
                alt={comment.author}
                className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover"
            />
            <div className="flex-1">
                <div className="rounded-2xl rounded-tl-none bg-gray-50 px-4 py-3 dark:bg-neutral-800">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {comment.author}
                        </span>
                        <span className="text-xs text-gray-400">
                            {comment.date}
                        </span>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {comment.content}
                    </p>
                </div>
                <div className="mt-1.5 flex items-center gap-4 pl-1">
                    <button
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors duration-200 hover:text-green-600"
                        onClick={() =>
                            !isAuthenticated &&
                            onAuthRequired('menyukai komentar')
                        }
                    >
                        <ThumbsUp className="h-3 w-3" />
                        {comment.likes}
                    </button>
                    <button
                        className="text-xs font-medium text-gray-500 transition-colors duration-200 hover:text-green-600"
                        onClick={handleReplyClick}
                    >
                        Balas
                    </button>
                    {comment.replies.length > 0 && (
                        <button
                            className="flex items-center gap-1 text-xs text-gray-400 transition-colors duration-200 hover:text-gray-600"
                            onClick={() => setShowReplies(!showReplies)}
                        >
                            {/* 4️⃣ Chevron rotates smoothly */}
                            <span
                                className={`transition-transform duration-200 ${showReplies ? 'rotate-0' : 'rotate-180'}`}
                            >
                                <ChevronUp className="h-3 w-3" />
                            </span>
                            {comment.replies.length} balasan
                        </button>
                    )}
                </div>

                {/* 5️⃣ Reply box slides down */}
                <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${showReplyBox ? 'mt-3 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    <div className="flex gap-2">
                        <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Tulis balasan..."
                            rows={2}
                            className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-shadow duration-200 focus:ring-2 focus:ring-green-300 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        />
                        <button
                            onClick={handleSubmitReply}
                            className="self-end rounded-xl bg-green-600 px-4 py-2 text-sm text-white transition-all duration-150 hover:bg-green-700 active:scale-95"
                        >
                            Kirim
                        </button>
                    </div>
                </div>

                {/* 6️⃣ Replies section collapses smoothly */}
                <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${showReplies && comment.replies.length > 0 ? 'mt-3 max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    <div className="space-y-3 border-l-2 border-green-100 pl-4 dark:border-green-900">
                        {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex gap-3">
                                <img
                                    src={
                                        reply.avatar ||
                                        `https://ui-avatars.com/api/?name=${reply.author}&background=dcfce7&color=16a34a`
                                    }
                                    alt={reply.author}
                                    className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover"
                                />
                                <div className="flex-1">
                                    <div className="rounded-2xl rounded-tl-none bg-gray-50 px-3 py-2 dark:bg-neutral-800">
                                        <div className="mb-1 flex items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                                {reply.author}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {reply.date}
                                            </span>
                                        </div>
                                        <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                                            {reply.content}
                                        </p>
                                    </div>
                                    <button
                                        className="mt-1 flex items-center gap-1 pl-1 text-xs font-medium text-gray-500 transition-colors duration-200 hover:text-green-600"
                                        onClick={() =>
                                            !isAuthenticated &&
                                            onAuthRequired('menyukai balasan')
                                        }
                                    >
                                        <ThumbsUp className="h-3 w-3" />
                                        {reply.likes}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewsDetails({ news, comments = [] }: Props) {
    const { auth } = usePage<SharedData>().props;
    const isAuthenticated = !!auth.user;

    const [liked, setLiked] = useState(news.liked_by_user);
    const [likesCount, setLikesCount] = useState(news.likes_count);
    const [commentText, setCommentText] = useState('');
    const [authPrompt, setAuthPrompt] = useState<string | null>(null);

    const handleLike = () => {
        if (!isAuthenticated) {
            setAuthPrompt('menyukai berita ini');

            return;
        }

        router.post(
            `/news/${news.id}/like`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setLiked(!liked);
                    setLikesCount(liked ? likesCount - 1 : likesCount + 1);
                },
            },
        );
    };

    const handleComment = () => {
        if (!isAuthenticated) {
            setAuthPrompt('menulis komentar');

            return;
        }

        if (!commentText.trim()) {
            return;
        }

        router.post(
            `/news/${news.id}/comments`,
            { content: commentText },
            {
                preserveScroll: true,
                onSuccess: () => setCommentText(''),
            },
        );
    };

    return (
        <>
            <Head title={`${news.title} — ApaKhabar`} />

            {authPrompt && (
                <AuthPrompt
                    action={authPrompt}
                    onClose={() => setAuthPrompt(null)}
                />
            )}

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
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Eye className="h-4 w-4" />
                            {news.views.toLocaleString()} dilihat
                        </span>
                    </div>

                    {/* 8️⃣ Hero image fades in with zoom — longer delay so title loads first */}
                    <div
                        className="mb-8 animate-fade-slide-up overflow-hidden rounded-xl"
                        style={{ animationDelay: '160ms' }}
                    >
                        <img
                            src={news.image}
                            alt={news.title}
                            className="max-h-96 w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
                        />
                    </div>

                    {/* Article body */}
                    <div
                        className="article-content prose prose-sm dark:prose-invert mb-8 max-w-none animate-fade-slide-up leading-relaxed text-foreground"
                        style={{ animationDelay: '200ms' }}
                        dangerouslySetInnerHTML={{ __html: news.content || '' }}
                    />

                    {/* 9️⃣ Like button — scale + color transition */}
                    <div
                        className="mb-10 flex animate-fade-slide-up items-center justify-between border-y border-border py-4"
                        style={{ animationDelay: '240ms' }}
                    >
                        <button
                            onClick={handleLike}
                            className={`flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition-all duration-200 active:scale-95 ${
                                liked
                                    ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
                                    : 'border-gray-300 bg-white text-gray-600 hover:border-green-400 hover:text-green-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-400'
                            }`}
                        >
                            {/* 🔟 Heart icon fills smoothly */}
                            <Heart
                                className={`h-4 w-4 transition-all duration-200 ${liked ? 'scale-110 fill-white' : 'scale-100'}`}
                            />
                            {liked ? 'Disukai' : 'Suka'} · {likesCount}
                        </button>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                                <MessageCircle className="h-4 w-4" />
                                {comments.length} komentar
                            </span>
                            <span className="flex items-center gap-1">
                                <Eye className="h-4 w-4" />
                                {news.views.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Comments Section */}
                    <section
                        className="animate-fade-slide-up"
                        style={{ animationDelay: '280ms' }}
                    >
                        <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">
                            Komentar ({comments.length})
                        </h2>

                        {/* Comment input */}
                        <div className="mb-8 flex gap-3">
                            <img
                                src={
                                    isAuthenticated
                                        ? `https://ui-avatars.com/api/?name=${auth.user?.name}&background=dcfce7&color=16a34a`
                                        : `https://ui-avatars.com/api/?name=Guest&background=f3f4f6&color=9ca3af`
                                }
                                alt="You"
                                className="h-9 w-9 shrink-0 rounded-full"
                            />
                            <div className="flex-1">
                                <textarea
                                    value={commentText}
                                    onChange={(e) =>
                                        setCommentText(e.target.value)
                                    }
                                    onClick={() =>
                                        !isAuthenticated &&
                                        setAuthPrompt('menulis komentar')
                                    }
                                    placeholder={
                                        isAuthenticated
                                            ? 'Tulis komentar...'
                                            : 'Login untuk berkomentar...'
                                    }
                                    readOnly={!isAuthenticated}
                                    rows={3}
                                    className="w-full cursor-text resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 transition-shadow duration-200 focus:ring-2 focus:ring-green-300 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                                />
                                <div className="mt-2 flex justify-end">
                                    {/* 1️⃣1️⃣ Submit button press feedback */}
                                    <button
                                        onClick={handleComment}
                                        className="rounded-xl bg-green-600 px-5 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-green-700 active:scale-95"
                                    >
                                        Kirim Komentar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Comment list */}
                        {comments.length === 0 ? (
                            <div className="animate-fade-slide-up py-12 text-center text-gray-400">
                                <div className="mb-3 flex justify-center">
                                    <MessageCircle className="h-10 w-10 text-gray-300 dark:text-neutral-700" />
                                </div>
                                <p className="text-sm">
                                    Belum ada komentar. Jadilah yang pertama!
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {comments.map((comment, index) => (
                                    // 1️⃣2️⃣ Staggered comment entries
                                    <div
                                        key={comment.id}
                                        style={{
                                            animationDelay: `${index * 80}ms`,
                                        }}
                                    >
                                        <CommentItem
                                            comment={comment}
                                            isAuthenticated={isAuthenticated}
                                            onAuthRequired={(action) =>
                                                setAuthPrompt(action)
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </>
    );
}
