import { Head, Link, usePage, router } from '@inertiajs/react';
import { login, register } from '@/routes';
import type { SharedData } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Eye, Heart, Lock, MessageCircle, ThumbsUp, ChevronUp, ChevronDown } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
                <div className="flex justify-center mb-4">
                    <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
                        <Lock className="h-6 w-6 text-red-500" />
                    </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Login Diperlukan</h3>
                <p className="text-sm text-gray-500 mb-6">
                    Anda perlu login untuk {action}. Bergabunglah sekarang — gratis!
                </p>
                <div className="flex gap-3">
                    <Link
                        href={login()}
                        className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                        Masuk
                    </Link>
                    <Link
                        href={register()}
                        className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
                    >
                        Daftar
                    </Link>
                </div>
                <button
                    onClick={onClose}
                    className="mt-4 text-xs text-gray-400 hover:text-gray-600"
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
        if (!replyText.trim()) return;
        router.post(`/comments/${comment.id}/replies`, { content: replyText });
        setReplyText('');
        setShowReplyBox(false);
    };

    return (
        <div className="flex gap-3">
            {/* Avatar */}
            <img
                src={comment.avatar || `https://ui-avatars.com/api/?name=${comment.author}&background=dcfce7&color=16a34a`}
                alt={comment.author}
                className="h-9 w-9 rounded-full object-cover shrink-0 mt-0.5"
            />

            <div className="flex-1">
                {/* Comment bubble */}
                <div className="bg-gray-50 rounded-2xl rounded-tl-none px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">{comment.author}</span>
                        <span className="text-xs text-gray-400">{comment.date}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4 mt-1.5 pl-1">
                    <button
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 font-medium transition"
                        onClick={() => !isAuthenticated && onAuthRequired('menyukai komentar')}
                    >
                        <ThumbsUp className="h-3 w-3" />
                        {comment.likes}
                    </button>
                    <button
                        className="text-xs text-gray-500 hover:text-green-600 font-medium transition"
                        onClick={handleReplyClick}
                    >
                        Balas
                    </button>
                    {comment.replies.length > 0 && (
                        <button
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
                            onClick={() => setShowReplies(!showReplies)}
                        >
                            {showReplies
                                ? <ChevronUp className="h-3 w-3" />
                                : <ChevronDown className="h-3 w-3" />
                            }
                            {comment.replies.length} balasan
                        </button>
                    )}
                </div>

                {/* Reply input */}
                {showReplyBox && (
                    <div className="mt-3 flex gap-2">
                        <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Tulis balasan..."
                            rows={2}
                            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
                        />
                        <button
                            onClick={handleSubmitReply}
                            className="self-end px-4 py-2 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700 transition"
                        >
                            Kirim
                        </button>
                    </div>
                )}

                {/* Nested replies */}
                {showReplies && comment.replies.length > 0 && (
                    <div className="mt-3 space-y-3 border-l-2 border-green-100 pl-4">
                        {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex gap-3">
                                <img
                                    src={reply.avatar || `https://ui-avatars.com/api/?name=${reply.author}&background=dcfce7&color=16a34a`}
                                    alt={reply.author}
                                    className="h-7 w-7 rounded-full object-cover shrink-0 mt-0.5"
                                />
                                <div className="flex-1">
                                    <div className="bg-gray-50 rounded-2xl rounded-tl-none px-3 py-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-semibold text-gray-900">{reply.author}</span>
                                            <span className="text-xs text-gray-400">{reply.date}</span>
                                        </div>
                                        <p className="text-xs text-gray-700 leading-relaxed">{reply.content}</p>
                                    </div>
                                    <button
                                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 font-medium mt-1 pl-1 transition"
                                        onClick={() => !isAuthenticated && onAuthRequired('menyukai balasan')}
                                    >
                                        <ThumbsUp className="h-3 w-3" />
                                        {reply.likes}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Show({ news, comments = [], canRegister = true }: Props) {
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
        if (!commentText.trim()) return;
        router.post(`/news/${news.id}/comments`, { content: commentText }, {
            preserveScroll: true,
            onSuccess: () => setCommentText(''),
        });
    };

    return (
        <>
            <Head title={`${news.title} — ApaKhabar`} />

            {/* Auth Prompt Modal */}
            {authPrompt && (
                <AuthPrompt action={authPrompt} onClose={() => setAuthPrompt(null)} />
            )}

            <div className="min-h-screen bg-white">

                {/* Navbar */}
                <nav className="border-b border-gray-200 bg-white px-4 py-3 sticky top-0 z-40">
                    <div className="mx-auto flex max-w-7xl items-center justify-between">
                        <div className="flex items-center">
                            <Link href="/">
                                <img src="/logo_w_name.svg" alt="ApaKhabar" className="h-10 w-auto" />
                            </Link>
                        </div>
                        <div className="hidden items-center space-x-6 text-sm font-medium text-gray-700 md:flex">
                            <Link href="/" className="hover:text-green-600">Beranda</Link>
                            <Link href="#" className="hover:text-green-600">Lingkungan</Link>
                            <Link href="#" className="hover:text-green-600">Pengumuman</Link>
                            <Link href="#" className="hover:text-green-600">Kecemasan</Link>
                        </div>
                        <div className="flex items-center space-x-2">
                            {auth.user ? (
                                <>
                                    {(auth.user.role === 'admin' || auth.user.role === 'moderator') && (
                                        <Link href="/admin/dashboard" className="rounded-sm border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-100">
                                            Dashboard
                                        </Link>
                                    )}
                                    <Link href="/logout" method="post" as="button" className="rounded-sm border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-100">
                                        Keluar
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link href={login()} className="text-sm font-medium text-gray-700 hover:text-black">Masuk</Link>
                                    {canRegister && (
                                        <Link href={register()} className="rounded-sm bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700">
                                            Daftar
                                        </Link>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </nav>

                {/* Article */}
                <main className="mx-auto max-w-3xl px-4 py-10">

                    {/* Page Header */}
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                            {news.title}
                        </h1>
                    </div>

                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
                        <Link href="/" className="hover:text-green-600">Beranda</Link>
                        <span>/</span>
                        <span className="text-gray-600">{news.category}</span>
                    </div>

                    {/* Category & Meta */}
                    <div className="flex items-center gap-3 mb-4">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            {news.category}
                        </Badge>
                        <span className="text-sm text-gray-400">{news.date}</span>
                        <span className="flex items-center gap-1 text-sm text-gray-400">
                            <Eye className="h-4 w-4" />
                            {news.views.toLocaleString()} dilihat
                        </span>
                    </div>

                    {/* Hero Image */}
                    <img
                        src={news.image}
                        alt={news.title}
                        className="w-full rounded-xl object-cover max-h-96 mb-8"
                    />

                    {/* Article Body */}
                    <div
                        className="prose prose-gray prose-sm max-w-none leading-relaxed text-gray-700 mb-8"
                        dangerouslySetInnerHTML={{ __html: news.content || `<p>${news.excerpt}</p>` }}
                    />

                    {/* Like & Stats Bar */}
                    <div className="flex items-center justify-between border-t border-b border-gray-100 py-4 mb-10">
                        <button
                            onClick={handleLike}
                            className={`flex items-center gap-2 px-5 py-2 rounded-full border text-sm font-medium transition ${
                                liked
                                    ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-green-400 hover:text-green-600'
                            }`}
                        >
                            <Heart className={`h-4 w-4 ${liked ? 'fill-white' : ''}`} />
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
                    <section>
                        <h2 className="text-lg font-bold text-gray-900 mb-6">
                            Komentar ({comments.length})
                        </h2>

                        {/* Comment Input */}
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
                                    className="w-full text-sm border border-gray-200 rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-green-300 cursor-text"
                                />
                                <div className="flex justify-end mt-2">
                                    <button
                                        onClick={handleComment}
                                        className="px-5 py-2 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700 transition font-medium"
                                    >
                                        Kirim Komentar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Comment List */}
                        {comments.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <div className="flex justify-center mb-3">
                                    <MessageCircle className="h-10 w-10 text-gray-300" />
                                </div>
                                <p className="text-sm">Belum ada komentar. Jadilah yang pertama!</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {comments.map((comment) => (
                                    <CommentItem
                                        key={comment.id}
                                        comment={comment}
                                        isAuthenticated={isAuthenticated}
                                        onAuthRequired={(action) => setAuthPrompt(action)}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </>
    );
}