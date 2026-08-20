/**
 * Save this file at: resources/js/pages/document-archive.tsx
 */
import { Head, router } from '@inertiajs/react';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
    CATEGORIES,
    DocIcon,
    FONT_HREF,
    Masthead,
    MOCK_DOCS,
    WIREDESK_CSS,
    type DocCategory,
    type DocumentItem,
} from '@/components/newscreator/shared';

interface Props {
    documents?: DocumentItem[];
}

export default function DocumentArchive({ documents }: Props) {
    const [docs, setDocs] = useState<DocumentItem[]>(documents?.length ? documents : MOCK_DOCS);
    const [activeCategory, setActiveCategory] = useState<DocCategory | 'All'>('All');
    const [modalDoc, setModalDoc] = useState<DocumentItem | null>(null);
    const [uploadCategory, setUploadCategory] = useState<DocCategory>('Safety');
    const [isDragging, setIsDragging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ name: string; pct: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const shownDocs = activeCategory === 'All' ? docs : docs.filter((d) => d.category === activeCategory);
    const readyCount = docs.filter((d) => d.status === 'ready').length;

    function deleteDoc(id: number) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
    }

    // TODO: replace this simulated upload with a real POST to your
    // DocumentController (multipart/form-data), then poll or listen
    // for the ingestion pipeline (extract → chunk → embed → Qdrant)
    // to flip status from 'processing' to 'ready'.
    function handleFiles(file: File) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const typeMap: Record<string, DocumentItem['type']> = { pdf: 'pdf', docx: 'docx', jpg: 'img', jpeg: 'img', png: 'img' };
        const type = typeMap[ext];
        if (!type) {
            alert('Unsupported format. Please upload a PDF, DOCX, JPG, or PNG.');
            return;
        }

        setUploadProgress({ name: file.name, pct: 0 });
        let p = 0;
        const timer = setInterval(() => {
            p += Math.random() * 22 + 10;
            if (p >= 100) {
                p = 100;
                clearInterval(timer);
                setTimeout(() => {
                    setUploadProgress(null);
                    const newDoc: DocumentItem = {
                        id: Date.now(),
                        name: file.name,
                        type,
                        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                        date: 'Today',
                        status: 'processing',
                        category: uploadCategory,
                        extract: [{ year: '—', text: 'Extraction in progress. Check back shortly.' }],
                    };
                    setDocs((prev) => [newDoc, ...prev]);
                    setTimeout(() => {
                        setDocs((prev) => prev.map((d) => (d.id === newDoc.id ? { ...d, status: 'ready' } : d)));
                    }, 1800);
                }, 350);
            }
            setUploadProgress((cur) => (cur ? { ...cur, pct: Math.min(100, p) } : cur));
        }, 220);
    }

    function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
        if (e.target.files?.length) handleFiles(e.target.files[0]);
        e.target.value = '';
    }

    function onDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files[0]);
    }

    function useInCreator(doc: DocumentItem) {
        setModalDoc(null);
        router.visit(`/apakhabar-creator/create?doc=${doc.id}`);
    }

    return (
        <>
            <Head title="ApaKhabar Creator — Document Archive">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link href={FONT_HREF} rel="stylesheet" />
            </Head>

            <div className="wiredesk-app">
                <style>{WIREDESK_CSS}</style>

                <Masthead active="archive" />

                <main className="page">
                    <div className="page-head">
                        <div>
                            <div className="eyebrow">Source Material</div>
                            <h2>Document Archive</h2>
                            <p className="lede">Every report, poster, and event file you've uploaded — sorted, tagged, and ready to cite.</p>
                        </div>
                        <div className="stat-strip">
                            <div className="stat">
                                <div className="n">{docs.length}</div>
                                <div className="l">Documents</div>
                            </div>
                            <div className="stat">
                                <div className="n">{readyCount}</div>
                                <div className="l">Ready</div>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`card upload-bar ${isDragging ? 'drag' : ''}`}
                        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                        onDrop={onDrop}
                    >
                        <div className="icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                                <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
                            </svg>
                        </div>
                        <div className="copy">
                            <strong>Upload a document</strong>
                            <span>Drag &amp; drop, or choose a file · PDF, DOCX, JPG, PNG · max 20 MB</span>
                        </div>
                        <select className="cat-select" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as DocCategory)}>
                            <option value="Safety">Safety</option>
                            <option value="Education">Education</option>
                            <option value="Information">Information</option>
                        </select>
                        <button className="btn ghost small" onClick={() => fileInputRef.current?.click()}>
                            Choose File
                        </button>
                        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" onChange={onFileInputChange} />
                        {uploadProgress && (
                            <div className="progress-wrap show">
                                <div className="progress-track">
                                    <div className="progress-bar" style={{ width: `${uploadProgress.pct}%` }} />
                                </div>
                                <div className="progress-label">
                                    <span>Uploading {uploadProgress.name}</span>
                                    <span>{Math.round(uploadProgress.pct)}%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="section-label">
                        <h3>My Documents</h3>
                        <div className="line" />
                        <div className="count mono">{docs.length} {docs.length === 1 ? 'file' : 'files'}</div>
                    </div>

                    <div className="cat-filters">
                        {CATEGORIES.map((c: DocCategory | 'All') => {
                            const count = c === 'All' ? docs.length : docs.filter((d) => d.category === c).length;
                            return (
                                <button
                                    key={c}
                                    className={`cat-filter ${activeCategory === c ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(c)}
                                >
                                    <span className="dot" />
                                    {c} ({count})
                                </button>
                            );
                        })}
                    </div>

                    <div className="doc-list">
                        {shownDocs.length === 0 && <div className="empty">No documents in "{activeCategory}" yet.</div>}
                        {shownDocs.map((d) => (
                            <div className="doc-row" key={d.id}>
                                <div className={`doc-icon ${d.type === 'img' ? 'img' : ''}`}>
                                    <DocIcon type={d.type} />
                                </div>
                                <div>
                                    <div className="doc-name">{d.name}</div>
                                    <div className="doc-meta">{d.type.toUpperCase()} · {d.size}</div>
                                </div>
                                <span className={`cat-tag cat-${d.category.toLowerCase()}`}>{d.category}</span>
                                <div className={`badge ${d.status === 'ready' ? 'ready' : 'processing'}`}>
                                    {d.status === 'ready' ? 'Ready' : 'Processing'}
                                </div>
                                <div className="doc-date">{d.date}</div>
                                <div className="row-actions">
                                    <button className="icon-btn" title="View" onClick={() => setModalDoc(d)}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    </button>
                                    <button className="icon-btn danger" title="Delete" onClick={() => deleteDoc(d.id)}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>

                {modalDoc && (
                    <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setModalDoc(null); }}>
                        <div className="modal">
                            <div className="modal-head">
                                <div>
                                    <h3>{modalDoc.name}</h3>
                                    <div className="doc-meta mono">{modalDoc.type.toUpperCase()} · {modalDoc.size} · Uploaded {modalDoc.date}</div>
                                </div>
                                <button className="modal-close" onClick={() => setModalDoc(null)} aria-label="Close">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 4l16 16M20 4L4 20" />
                                    </svg>
                                </button>
                            </div>
                            <div className="modal-body">
                                <h4>Category</h4>
                                <span className={`cat-tag cat-${modalDoc.category.toLowerCase()}`}>{modalDoc.category}</span>
                                <h4>Status</h4>
                                <div className={`badge ${modalDoc.status === 'ready' ? 'ready' : 'processing'}`}>
                                    {modalDoc.status === 'ready' ? 'Ready to use' : 'Still processing'}
                                </div>
                                <h4>Extracted Information</h4>
                                <div className="extract-block">
                                    {modalDoc.extract.map((e: { year: string; text: string }, i: number) => (
                                        <div key={i}>
                                            <div className="extract-year">{e.year}</div>
                                            <div>{e.text}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="modal-actions">
                                    <button className="btn blue small" onClick={() => useInCreator(modalDoc)}>
                                        Use in Creator
                                    </button>
                                    <button className="btn ghost small" onClick={() => setModalDoc(null)}>Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}