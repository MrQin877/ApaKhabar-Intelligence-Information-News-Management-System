/**
 * Save this file at: resources/js/pages/intelligentNCnews-creator.tsx
 */
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    FONT_HREF,
    Masthead,
    MOCK_DOCS,
    WIREDESK_CSS,
    type ArticleData,
    type DocumentItem,
    type SavedArticle,
} from '@/components/newscreator/shared';
import { DocIcon } from '@/components/newscreator/shared';

interface Props {
    documents?: DocumentItem[];
    // Optional: pass ?doc=ID through from the Archive page's "Use in Creator" button
    selectedDocId?: number | null;
}

export default function IntelligentNewsCreator({ documents, selectedDocId }: Props) {
    const docs: DocumentItem[] = documents?.length ? documents : MOCK_DOCS;

    // Pick up ?doc=ID from the URL if the controller didn't already pass it as a prop
    const initialDocId =
    selectedDocId ??
    (typeof window !== 'undefined'
        ? (Number(new URLSearchParams(window.location.search).get('doc')) || docs[0]?.id) ?? null
        : docs[0]?.id ?? null);

    const [selDocId, setSelDocId] = useState<number | null>(initialDocId);
    const [selYear, setSelYear] = useState('2025');
    const [selType, setSelType] = useState('General News');
    const [tone, setTone] = useState<'Formal' | 'Professional' | 'Casual'>('Formal');
    const [selLength, setSelLength] = useState('300 words');
    const [keywords, setKeywords] = useState<string[]>(['flood', 'village', 'evacuation']);
    const [kwInput, setKwInput] = useState('');
    const [instructions, setInstructions] = useState(
        'Focus on the number of people affected and evacuation efforts.',
    );

    const [isGenerating, setIsGenerating] = useState(false);
    const [currentArticle, setCurrentArticle] = useState<ArticleData | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editHeadline, setEditHeadline] = useState('');
    const [editBody, setEditBody] = useState('');
    const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);

    useEffect(() => {
        if (selDocId === null && docs.length) setSelDocId(docs[0].id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function addKeyword() {
        const v = kwInput.trim();
        if (!v) return;
        setKeywords((prev) => [...prev, v]);
        setKwInput('');
    }

    // TODO: replace this simulated generation with a real request to your
    // Laravel RagService endpoint, e.g. POST /apakhabar-creator/generate
    // { document_id, year, news_type, tone, length, keywords, instructions }
    function generateArticle() {
        const doc = docs.find((d) => d.id === selDocId);
        const docName = doc?.name ?? 'source document';
        setIsGenerating(true);
        setCurrentArticle(null);

        setTimeout(() => {
            const affected = selYear === '2024' ? '80' : '150';
            const headline =
                selYear === '2024'
                    ? 'Flood Displaces Dozens in Village A as Waters Rise'
                    : 'Flood Affects Hundreds of Residents Across Two Villages';
            const body =
                `The ${selYear} flood season has left ${affected} residents of Village A displaced` +
                (selYear === '2025'
                    ? ', with a further 200 people affected in Village C as water levels continued to rise through the week.'
                    : '.') +
                ` Local evacuation teams moved quickly to relocate affected households to nearby community shelters, prioritising elderly residents and young families.\n\nAuthorities say the response drew on lessons from previous flood seasons, with pre-positioned supplies helping shorten the time between the initial alert and full evacuation. Relief coordinators are continuing to monitor water levels and have asked residents in low-lying areas to stay alert for further advisories.\n\nCommunity volunteers have also stepped in to support the effort, distributing food, clean water, and temporary bedding to those sheltering away from home. Officials expect to share an update on recovery plans once flood waters recede.`;

            const sourceNames = docs
                .filter((d) => d.status === 'ready')
                .slice(0, 2)
                .map((d) => d.name);

            setCurrentArticle({
                headline,
                body,
                kicker: `${selType} · ${selYear}`,
                byline: `By ApaKhabar Creator AI · Generated from ${docName} · ${tone} tone`,
                meta: `${selType} · ${selLength}`,
                sourceNames,
                status: 'unsaved',
            });
            setIsGenerating(false);
        }, 1400);
    }

    function startEdit() {
        if (!currentArticle) return;
        setEditHeadline(currentArticle.headline);
        setEditBody(currentArticle.body);
        setIsEditing(true);
    }

    function finishEdit() {
        if (!currentArticle) return;
        setCurrentArticle({ ...currentArticle, headline: editHeadline, body: editBody });
        setIsEditing(false);
    }

    // TODO: replace with a real POST /articles (or PATCH) call to persist to MySQL
    function persistArticle(status: 'draft' | 'saved') {
        if (!currentArticle) return;
        if (isEditing) finishEdit();
        const finalArticle: ArticleData = { ...currentArticle, status };
        setCurrentArticle(finalArticle);

        setSavedArticles((prev) => {
            const idx = prev.findIndex((s) => s.headline === finalArticle.headline);
            const record: SavedArticle = { headline: finalArticle.headline, status, updated: 'Just now', full: finalArticle };
            if (idx > -1) {
                const copy = [...prev];
                copy[idx] = record;
                return copy;
            }
            return [record, ...prev];
        });
    }

    function loadSaved(article: SavedArticle) {
        setCurrentArticle(article.full);
        setIsEditing(false);
    }

    function removeSaved(headline: string) {
        setSavedArticles((prev) => prev.filter((s) => s.headline !== headline));
    }

    return (
        <>
            <Head title="ApaKhabar Creator — Intelligent News Creator">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link href={FONT_HREF} rel="stylesheet" />
            </Head>

            <div className="wiredesk-app">
                <style>{WIREDESK_CSS}</style>

                <Masthead active="creator" />

                <main className="page">
                    <div className="page-head">
                        <div>
                            <div className="eyebrow">Generate</div>
                            <h2>Intelligent News Creator</h2>
                            <p className="lede">Pick a source, set the angle, and generate a draft — with every figure traceable back to its document.</p>
                        </div>
                    </div>

                    <div className="desk-grid">
                        <div className="desk-controls">
                            <div className="card">
                                <div className="field">
                                    <label>Source Document</label>
                                    <select value={selDocId ?? ''} onChange={(e) => setSelDocId(Number(e.target.value))}>
                                        {docs.length === 0 && <option disabled>No documents uploaded</option>}
                                        {docs.map((d) => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="field">
                                    <label>Year</label>
                                    <select value={selYear} onChange={(e) => setSelYear(e.target.value)}>
                                        <option>2025</option>
                                        <option>2024</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label>News Type</label>
                                    <select value={selType} onChange={(e) => setSelType(e.target.value)}>
                                        <option>General News</option>
                                        <option>Incident Report</option>
                                        <option>Community Update</option>
                                        <option>Press Release</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label>Tone</label>
                                    <div className="radio-row">
                                        {(['Formal', 'Professional', 'Casual'] as const).map((t) => (
                                            <label key={t} className={`radio-pill ${tone === t ? 'checked' : ''}`}>
                                                <input type="radio" name="tone" value={t} checked={tone === t} onChange={() => setTone(t)} />
                                                {t}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="field">
                                    <label>Length</label>
                                    <select value={selLength} onChange={(e) => setSelLength(e.target.value)}>
                                        <option>150 words</option>
                                        <option>300 words</option>
                                        <option>500 words</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label>Keywords</label>
                                    <div className="kw-box">
                                        {keywords.map((k, i) => (
                                            <span className="kw-tag" key={k + i}>
                                                {k}
                                                <button onClick={() => setKeywords((prev) => prev.filter((_, idx) => idx !== i))}>×</button>
                                            </span>
                                        ))}
                                        <input
                                            type="text"
                                            placeholder="Type a keyword, press Enter"
                                            value={kwInput}
                                            onChange={(e) => setKwInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                                        />
                                    </div>
                                </div>
                                <div className="field" style={{ marginBottom: 20 }}>
                                    <label>Additional Instructions</label>
                                    <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} />
                                </div>
                                <button className="btn blue" style={{ width: '100%' }} onClick={generateArticle} disabled={!selDocId || isGenerating}>
                                    Generate News
                                </button>
                            </div>
                        </div>

                        <div className="card article-panel">
                            {isGenerating && (
                                <div className="article-body loading">
                                    <div className="loader-dots"><span /><span /><span /></div>
                                    <div className="loading-text">
                                        Reading {docs.find((d) => d.id === selDocId)?.name} · drafting {tone.toLowerCase()} copy…
                                    </div>
                                </div>
                            )}

                            {!isGenerating && !currentArticle && (
                                <div className="article-empty">
                                    <div className="icon">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                            <rect x="4" y="3" width="16" height="18" rx="1.5" />
                                            <path d="M8 8h8M8 12h8M8 16h5" />
                                        </svg>
                                    </div>
                                    <h3>No draft yet</h3>
                                    <p>Set your options on the left and generate a draft. The article and its sources will appear here.</p>
                                </div>
                            )}

                            {!isGenerating && currentArticle && (
                                <>
                                    <div className="article-bar">
                                        <div className="status">
                                            <span className={`dot ${currentArticle.status === 'draft' ? 'draft' : currentArticle.status === 'saved' ? 'saved' : ''}`} />
                                            {currentArticle.status === 'draft' ? 'Draft saved' : currentArticle.status === 'saved' ? 'Saved' : 'Draft ready · not saved'} · {currentArticle.meta}
                                        </div>
                                        <div className="article-actions">
                                            <button className="btn ghost small" onClick={isEditing ? finishEdit : startEdit}>
                                                {isEditing ? 'Done Editing' : 'Edit'}
                                            </button>
                                            <button className="icon-btn" title="Regenerate" onClick={generateArticle}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                                    <path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5" />
                                                </svg>
                                            </button>
                                            <button className="btn ghost small" onClick={() => persistArticle('draft')}>Save as Draft</button>
                                            <button className="btn green small" onClick={() => persistArticle('saved')}>Save</button>
                                            <button className="btn blue small">Export</button>
                                        </div>
                                    </div>
                                    <div className="article-body">
                                        <span className="stamp">AI Draft</span>
                                        <div className="article-kicker">{currentArticle.kicker}</div>
                                        {isEditing ? (
                                            <input
                                                className="article-headline"
                                                value={editHeadline}
                                                onChange={(e) => setEditHeadline(e.target.value)}
                                            />
                                        ) : (
                                            <h2 className="article-headline">{currentArticle.headline}</h2>
                                        )}
                                        <div className="article-byline">{currentArticle.byline}</div>
                                        {isEditing && (
                                            <div className="edit-hint show">
                                                Editing — edit the text below, then press "Done Editing" to lock it back in.
                                            </div>
                                        )}
                                        {isEditing ? (
                                            <textarea
                                                className="article-text"
                                                style={{ width: '100%', minHeight: 220 }}
                                                value={editBody}
                                                onChange={(e) => setEditBody(e.target.value)}
                                            />
                                        ) : (
                                            <div className="article-text">
                                                {currentArticle.body.split('\n\n').map((p: string, i: number) => <p key={i}>{p}</p>)}
                                            </div>
                                        )}
                                        <div className="sources-block">
                                            <h4>Sources</h4>
                                            {currentArticle.sourceNames.map((name: string) => {
                                                const d = docs.find((doc) => doc.name === name);
                                                return (
                                                    <div className="source-item" key={name}>
                                                        <div className={`doc-icon ${d?.type === 'img' ? 'img' : ''}`} style={{ width: 26, height: 26 }}>
                                                            {d && <DocIcon type={d.type} />}
                                                        </div>
                                                        <span>{name}</span>
                                                        <span className="tag">verified</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="section-label">
                        <h3>Saved &amp; Drafts</h3>
                        <div className="line" />
                        <div className="count mono">{savedArticles.length} {savedArticles.length === 1 ? 'item' : 'items'}</div>
                    </div>
                    <div className="saved-list">
                        {savedArticles.length === 0 && (
                            <div className="empty">Nothing saved yet. Generate a draft above, then Save or Save as Draft.</div>
                        )}
                        {savedArticles.map((a) => (
                            <div className="saved-item" key={a.headline} onClick={() => loadSaved(a)}>
                                <span className={`badge ${a.status}`}>{a.status === 'draft' ? 'Draft' : 'Saved'}</span>
                                <span className="s-title">{a.headline}</span>
                                <span className="s-meta">{a.updated}</span>
                                <button
                                    className="icon-btn danger"
                                    title="Remove"
                                    onClick={(e) => { e.stopPropagation(); removeSaved(a.headline); }}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                        <path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        </>
    );
}