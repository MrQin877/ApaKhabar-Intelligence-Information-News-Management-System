import { Head, Link, usePage, router } from '@inertiajs/react';
import { Eye, Heart, Lock, MessageCircle, ThumbsUp, ChevronUp } from 'lucide-react';
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
    excerpt: string;
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

function AuthPrompt({ action, onClose }: { action: string; onClose: () => void }) {
    return (
        // 1️⃣ Modal backdrop fade-in
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            style={{ animation: 'fadeIn 0.2s ease both' }}
        >
            {/* 2️⃣ Modal card slide-up */}
            <div
                className="bg-card text-card-foreground rounded-xl shadow-xl p-8 max-w-sm w-full mx-4 text-center"
                style={{ animation: 'fadeSlideUp 0.25s ease both' }}
            >
                <div className="flex justify-center mb-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-bg">
                        <Lock className="h-6 w-6 text-danger-500" />
                    </div>
                </div>
                <h3 className="mb-2 text-lg font-bold text-card-foreground">Login Diperlukan</h3>
                <p className="mb-6 text-sm text-muted-foreground">
                    Anda perlu login untuk {action}. Bergabunglah sekarang — gratis!
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
        <div className="flex gap-3 animate-fade-slide-up">
            <img
                src={comment.avatar || `https://ui-avatars.com/api/?name=${comment.author}&background=dcfce7&color=16a34a`}
                alt={comment.author}
                className="h-9 w-9 rounded-full object-cover shrink-0 mt-0.5"
            />
            <div className="flex-1">
                <div className="bg-gray-50 dark:bg-neutral-800 rounded-2xl rounded-tl-none px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{comment.author}</span>
                        <span className="text-xs text-gray-400">{comment.date}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{comment.content}</p>
                </div>
                <div className="flex items-center gap-4 mt-1.5 pl-1">
                    <button
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 font-medium transition-colors duration-200"
                        onClick={() => !isAuthenticated && onAuthRequired('menyukai komentar')}
                    >
                        <ThumbsUp className="h-3 w-3" />
                        {comment.likes}
                    </button>
                    <button
                        className="text-xs text-gray-500 hover:text-green-600 font-medium transition-colors duration-200"
                        onClick={handleReplyClick}
                    >
                        Balas
                    </button>
                    {comment.replies.length > 0 && (
                        <button
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors duration-200"
                            onClick={() => setShowReplies(!showReplies)}
                        >
                            {/* 4️⃣ Chevron rotates smoothly */}
                            <span className={`transition-transform duration-200 ${showReplies ? 'rotate-0' : 'rotate-180'}`}>
                                <ChevronUp className="h-3 w-3" />
                            </span>
                            {comment.replies.length} balasan
                        </button>
                    )}
                </div>

                {/* 5️⃣ Reply box slides down */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showReplyBox ? 'max-h-40 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                    <div className="flex gap-2">
                        <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Tulis balasan..."
                            rows={2}
                            className="flex-1 text-sm border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-300 transition-shadow duration-200"
                        />
                        <button
                            onClick={handleSubmitReply}
                            className="self-end px-4 py-2 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700 active:scale-95 transition-all duration-150"
                        >
                            Kirim
                        </button>
                    </div>
                </div>

                {/* 6️⃣ Replies section collapses smoothly */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showReplies && comment.replies.length > 0 ? 'max-h-[1000px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-3 border-l-2 border-green-100 dark:border-green-900 pl-4">
                        {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex gap-3">
                                <img
                                    src={reply.avatar || `https://ui-avatars.com/api/?name=${reply.author}&background=dcfce7&color=16a34a`}
                                    alt={reply.author}
                                    className="h-7 w-7 rounded-full object-cover shrink-0 mt-0.5"
                                />
                                <div className="flex-1">
                                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-2xl rounded-tl-none px-3 py-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-semibold text-gray-900 dark:text-white">{reply.author}</span>
                                            <span className="text-xs text-gray-400">{reply.date}</span>
                                        </div>
                                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{reply.content}</p>
                                    </div>
                                    <button
                                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 font-medium mt-1 pl-1 transition-colors duration-200"
                                        onClick={() => !isAuthenticated && onAuthRequired('menyukai balasan')}
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

        router.post(`/news/${news.id}/like`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                setLiked(!liked);
                setLikesCount(liked ? likesCount - 1 : likesCount + 1);
            },
        });
    };

    const handleComment = () => {
        if (!isAuthenticated) {
            setAuthPrompt('menulis komentar');

            return;
        }

        if (!commentText.trim()) {
return;
}

        router.post(`/news/${news.id}/comments`, { content: commentText }, {
            preserveScroll: true,
            onSuccess: () => setCommentText(''),
        });
    };

    return (
        <>
            <Head title={`${news.title} — ApaKhabar`} />

            {authPrompt && (
                <AuthPrompt action={authPrompt} onClose={() => setAuthPrompt(null)} />
            )}

            <div className="min-h-screen bg-background text-foreground">

                <HeaderBar />

                <main className="mx-auto max-w-3xl px-4 py-10">

                    {/* 7️⃣ Page header fades in */}
                    <div className="animate-fade-slide-up mb-6">
                        <h1 className="text-3xl font-bold text-foreground leading-tight">
                            {news.title}
                        </h1>
                    </div>

                    {/* Breadcrumb — slight delay */}
                    <div
                        className="animate-fade-slide-up mb-6 flex items-center gap-2 text-xs text-muted-foreground"
                        style={{ animationDelay: '80ms' }}
                    >
                        <Link href="/" className="transition-colors duration-200 hover:text-primary">
                            Beranda
                        </Link>
                        <span>/</span>
                        <span className="text-muted-foreground">{news.category}</span>
                    </div>

                    {/* Category & Meta — slight delay */}
                    <div
                        className="animate-fade-slide-up flex items-center gap-3 mb-4"
                        style={{ animationDelay: '120ms' }}
                    >
                        <Badge className="bg-brand-100 text-brand-800 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-300">
                            {news.category}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{news.date}</span>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Eye className="h-4 w-4" />
                            {news.views.toLocaleString()} dilihat
                        </span>
                    </div>

                    {/* 8️⃣ Hero image fades in with zoom — longer delay so title loads first */}
                    <div
                        className="animate-fade-slide-up overflow-hidden rounded-xl mb-8"
                        style={{ animationDelay: '160ms' }}
                    >
                        <img
                            src={news.image}
                            alt={news.title}
                            className="w-full object-cover max-h-96
                                       transition-transform duration-700 hover:scale-[1.02]"
                        />
                    </div>

                    {/* Article body */}
                    <div
                        className="article-content animate-fade-slide-up prose prose-sm dark:prose-invert mb-8 max-w-none leading-relaxed text-foreground"
                        style={{ animationDelay: '200ms' }}
                        dangerouslySetInnerHTML={{ __html: news.content || `<p>${news.excerpt}</p>` }}
                    />

                    {/* 9️⃣ Like button — scale + color transition */}
                    <div
                        className="animate-fade-slide-up mb-10 flex items-center justify-between border-y border-border py-4"
                        style={{ animationDelay: '240ms' }}
                    >
                        <button
                            onClick={handleLike}
                            className={`flex items-center gap-2 px-5 py-2 rounded-full border text-sm font-medium
                                        transition-all duration-200 active:scale-95 ${
                                liked
                                    ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                                    : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-neutral-700 hover:border-green-400 hover:text-green-600'
                            }`}
                        >
                            {/* 🔟 Heart icon fills smoothly */}
                            <Heart className={`h-4 w-4 transition-all duration-200 ${liked ? 'fill-white scale-110' : 'scale-100'}`} />
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
                    <section className="animate-fade-slide-up" style={{ animationDelay: '280ms' }}>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                            Komentar ({comments.length})
                        </h2>

                        {/* Comment input */}
                        <div className="flex gap-3 mb-8">
                            <img
                                src={
                                    isAuthenticated
                                        ? `https://ui-avatars.com/api/?name=${auth.user?.name}&background=dcfce7&color=16a34a`
                                        : `https://ui-avatars.com/api/?name=Guest&background=f3f4f6&color=9ca3af`
                                }
                                alt="You"
                                className="h-9 w-9 rounded-full shrink-0"
                            />
                            <div className="flex-1">
                                <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    onClick={() => !isAuthenticated && setAuthPrompt('menulis komentar')}
                                    placeholder={isAuthenticated ? 'Tulis komentar...' : 'Login untuk berkomentar...'}
                                    readOnly={!isAuthenticated}
                                    rows={3}
                                    className="w-full text-sm border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-green-300 transition-shadow duration-200 cursor-text"
                                />
                                <div className="flex justify-end mt-2">
                                    {/* 1️⃣1️⃣ Submit button press feedback */}
                                    <button
                                        onClick={handleComment}
                                        className="px-5 py-2 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700 active:scale-95 transition-all duration-150 font-medium"
                                    >
                                        Kirim Komentar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Comment list */}
                        {comments.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 animate-fade-slide-up">
                                <div className="flex justify-center mb-3">
                                    <MessageCircle className="h-10 w-10 text-gray-300 dark:text-neutral-700" />
                                </div>
                                <p className="text-sm">Belum ada komentar. Jadilah yang pertama!</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {comments.map((comment, index) => (
                                    // 1️⃣2️⃣ Staggered comment entries
                                    <div
                                        key={comment.id}
                                        style={{ animationDelay: `${index * 80}ms` }}
                                    >
                                        <CommentItem
                                            comment={comment}
                                            isAuthenticated={isAuthenticated}
                                            onAuthRequired={(action) => setAuthPrompt(action)}
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