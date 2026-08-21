import { Head, router } from '@inertiajs/react';
import React, { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import creatorRoutes from '@/routes/admin/creator';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// ---------------------------------------------------------------------------
// Types & mock data
// ---------------------------------------------------------------------------

type DocCategory = 'Safety' | 'Education' | 'Information';
type DocType = 'pdf' | 'docx' | 'img';
type DocStatus = 'ready' | 'processing';

interface DocumentItem {
  id: number;
  name: string;
  type: DocType;
  size: string;
  date: string;
  status: DocStatus;
  category: DocCategory;
  extract: { year: string; text: string }[];
}

const CATEGORIES: (DocCategory | 'All')[] = ['All', 'Safety', 'Education', 'Information'];

const MOCK_DOCS: DocumentItem[] = [
  {
    id: 1,
    name: 'Flood Report 2025.pdf',
    type: 'pdf',
    size: '2.4 MB',
    date: '2 days ago',
    status: 'ready',
    category: 'Safety',
    extract: [
      { year: '2025', text: 'Water levels rose sharply, prompting evacuation of ~150 residents to two shelters.' },
    ],
  },
  {
    id: 2,
    name: 'Penang Flood Statistics 2025.pdf',
    type: 'pdf',
    size: '1.1 MB',
    date: '5 days ago',
    status: 'ready',
    category: 'Information',
    extract: [
      { year: '2025', text: 'Cumulative rainfall exceeded the monthly average by 68%.' },
    ],
  },
  {
    id: 3,
    name: 'Community Evacuation Poster.png',
    type: 'img',
    size: '640 KB',
    date: '1 week ago',
    status: 'ready',
    category: 'Education',
    extract: [{ year: '—', text: 'Visual awareness poster for shelter locations.' }],
  },
];

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------

function DocIcon({ type }: { type: DocType }) {
  if (type === 'img') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — shares the same design tokens as newscreator.tsx (ang- prefix)
// ---------------------------------------------------------------------------

const STYLES = `
:root{
  --bg:#F4F5F7; --surface:#FFFFFF; --surface-2:#FAFBFC; --ink:#1A2233;
  --ink-soft:#5C6675; --ink-faint:#8E96A3; --border:#E3E6EB; --border-strong:#D3D8DF;
  --accent:#2B5FE0; --accent-hover:#2450C4; --accent-soft:#EAF0FE; --accent-soft-border:#CBDAFB;
  --success:#1F8F5F; --success-soft:#E7F6EE; --warn:#B7791A; --warn-soft:#FCF3E1;
  --radius-sm:8px; --radius-md:10px; --radius-lg:14px;
  --shadow-sm:0 1px 2px rgba(20,25,40,0.04); --shadow-md:0 4px 16px rgba(20,25,40,0.06);
  --font-ui:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  --font-serif:'Source Serif 4',Georgia,serif; --font-mono:'IBM Plex Mono',monospace;
}
.ang-app *{box-sizing:border-box;}
.ang-app{font-family:var(--font-ui);background:var(--bg);color:var(--ink);min-height:100vh;}
.ang-app button{font-family:inherit;cursor:pointer;background:none;border:none;color:inherit;}
.ang-app input,.ang-app select{font-family:inherit;color:inherit;}
.ang-archive-page{max-width:920px;margin:0 auto;padding:36px 28px 60px;}
.ang-archive-head{margin-bottom:22px;}
.ang-archive-eyebrow{font-family:var(--font-mono);font-size:11px;font-weight:500;letter-spacing:.08em;color:var(--accent);text-transform:uppercase;margin-bottom:6px;}
.ang-archive-head h2{font-family:var(--font-serif);font-size:26px;font-weight:600;letter-spacing:-.01em;margin:0 0 6px;}
.ang-archive-head p{font-size:13px;color:var(--ink-soft);line-height:1.5;margin:0;max-width:520px;}
.ang-stat-strip{display:flex;gap:20px;margin-top:16px;}
.ang-stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px 16px;min-width:88px;}
.ang-stat .n{font-size:20px;font-weight:700;color:var(--ink);}
.ang-stat .l{font-size:11px;color:var(--ink-faint);font-weight:500;text-transform:uppercase;letter-spacing:.03em;}
.ang-upload-bar{display:flex;align-items:center;gap:14px;background:var(--surface);border:1.5px dashed var(--border-strong);border-radius:var(--radius-lg);padding:18px 20px;margin-bottom:26px;transition:.15s;}
.ang-upload-bar.drag{border-color:var(--accent);background:var(--accent-soft);}
.ang-upload-icon{width:38px;height:38px;flex:0 0 38px;border-radius:10px;background:var(--accent-soft);border:1px solid var(--accent-soft-border);display:flex;align-items:center;justify-content:center;color:var(--accent);}
.ang-upload-copy{flex:1;min-width:0;}
.ang-upload-copy strong{display:block;font-size:13.5px;font-weight:600;margin-bottom:2px;}
.ang-upload-copy span{font-size:12px;color:var(--ink-faint);}
.ang-cat-select{height:34px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);font-size:12.5px;color:var(--ink);}
.ang-upload-input{display:none;}
.ang-progress-wrap{width:100%;margin-top:10px;}
.ang-progress-track{height:5px;border-radius:3px;background:var(--border);overflow:hidden;}
.ang-progress-bar{height:100%;background:var(--accent);transition:width .2s;}
.ang-progress-label{display:flex;justify-content:space-between;font-size:11px;color:var(--ink-faint);margin-top:5px;}
.ang-section-label{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.ang-section-label h3{font-size:13px;font-weight:600;margin:0;white-space:nowrap;}
.ang-section-label .line{flex:1;height:1px;background:var(--border);}
.ang-section-label .count{font-size:11.5px;color:var(--ink-faint);}
.ang-cat-filters{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:18px;}
.ang-cat-filter{padding:6px 12px;border:1px solid var(--border-strong);border-radius:20px;font-size:12px;font-weight:500;color:var(--ink-soft);background:var(--surface);transition:.12s;}
.ang-cat-filter:hover{border-color:var(--accent);color:var(--accent);}
.ang-cat-filter.active{background:var(--accent);border-color:var(--accent);color:#fff;}
.ang-doc-list{display:flex;flex-direction:column;gap:8px;}
.ang-doc-row{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;transition:.12s;}
.ang-doc-row:hover{border-color:var(--border-strong);box-shadow:var(--shadow-sm);}
.ang-doc-row-icon{width:34px;height:34px;flex:0 0 34px;border-radius:8px;background:var(--surface-2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--ink-faint);}
.ang-doc-row-info{flex:1;min-width:0;}
.ang-doc-row-name{font-size:13px;font-weight:500;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ang-doc-row-meta{font-size:11.5px;color:var(--ink-faint);}
.ang-cat-tag{font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:12px;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;}
.ang-cat-tag.cat-safety{background:var(--warn-soft);color:var(--warn);}
.ang-cat-tag.cat-education{background:var(--accent-soft);color:var(--accent);}
.ang-cat-tag.cat-information{background:var(--success-soft);color:var(--success);}
.ang-status-badge{font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:12px;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;}
.ang-status-badge.ready{background:var(--success-soft);color:var(--success);}
.ang-status-badge.processing{background:var(--warn-soft);color:var(--warn);}
.ang-doc-row-date{font-size:11.5px;color:var(--ink-faint);white-space:nowrap;}
.ang-row-actions{display:flex;gap:4px;}
.ang-icon-btn{width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--ink-soft);}
.ang-icon-btn:hover{background:var(--surface-2);}
.ang-icon-btn.danger:hover{background:#FCEBEA;color:#C43D3D;}
.ang-empty{padding:40px 0;text-align:center;font-size:13px;color:var(--ink-faint);}
.ang-modal-overlay{position:fixed;inset:0;background:rgba(20,25,40,.42);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;}
.ang-modal-card{width:480px;max-width:100%;background:var(--surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-md);padding:24px;max-height:86vh;overflow-y:auto;}
.ang-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px;}
.ang-modal-head h3{font-size:15px;font-weight:600;margin:0 0 3px;}
.ang-modal-head .meta{font-size:11.5px;color:var(--ink-faint);}
.ang-modal-close{width:28px;height:28px;flex:0 0 28px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--ink-soft);}
.ang-modal-close:hover{background:var(--surface-2);}
.ang-modal-body h4{font-size:11px;font-weight:600;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.04em;margin:16px 0 8px;}
.ang-modal-body h4:first-child{margin-top:0;}
.ang-extract-block{background:var(--surface-2);border-left:2px solid var(--accent);border-radius:0 8px 8px 0;padding:12px 14px;font-family:var(--font-serif);font-size:13.5px;line-height:1.65;color:var(--ink-soft);}
.ang-extract-year{font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--accent);margin-bottom:3px;}
.ang-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px;}
.ang-wbtn{display:flex;align-items:center;gap:6px;height:34px;padding:0 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12.5px;font-weight:500;color:var(--ink-soft);background:var(--surface);transition:.15s;}
.ang-wbtn:hover{background:var(--surface-2);border-color:var(--border-strong);color:var(--ink);}
.ang-wbtn.primary{background:var(--accent);color:#fff;border-color:var(--accent);}
.ang-wbtn.primary:hover{background:var(--accent-hover);}
.ang-back-btn{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:500;color:var(--ink-soft);margin-bottom:14px;padding:6px 10px 6px 6px;border-radius:var(--radius-sm);transition:.15s;}
.ang-back-btn:hover{background:var(--surface-2);color:var(--ink);}
@media (max-width:640px){
  .ang-archive-page{padding:24px 16px 40px;}
  .ang-upload-bar{flex-wrap:wrap;}
  .ang-doc-row{flex-wrap:wrap;}
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
    const typeMap: Record<string, DocType> = { pdf: 'pdf', docx: 'docx', jpg: 'img', jpeg: 'img', png: 'img' };
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
    router.visit(`${creatorRoutes.create()}?doc=${doc.id}`);
  }

  return (
    <>
      <Head title="Document Library" />
      <div className="ang-app">
        <style>{STYLES}</style>

        <div className="ang-archive-page">
          <div className="ang-archive-head">
            <button className="ang-back-btn" onClick={() => router.visit(creatorRoutes.create())}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to News Creator
            </button>
            <div className="ang-archive-eyebrow">Source material</div>
            <h2>Document Library</h2>
            <p>Every report, poster, and event file you've uploaded — sorted, tagged, and ready to cite.</p>
            <div className="ang-stat-strip">
              <div className="ang-stat">
                <div className="n">{docs.length}</div>
                <div className="l">Documents</div>
              </div>
              <div className="ang-stat">
                <div className="n">{readyCount}</div>
                <div className="l">Ready</div>
              </div>
            </div>
          </div>

          <div
            className={`ang-upload-bar${isDragging ? ' drag' : ''}`}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={onDrop}
          >
            <div className="ang-upload-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
              </svg>
            </div>
            <div className="ang-upload-copy">
              <strong>Upload a document</strong>
              <span>Drag &amp; drop, or choose a file · PDF, DOCX, JPG, PNG · max 20 MB</span>
              {uploadProgress && (
                <div className="ang-progress-wrap">
                  <div className="ang-progress-track">
                    <div className="ang-progress-bar" style={{ width: `${uploadProgress.pct}%` }} />
                  </div>
                  <div className="ang-progress-label">
                    <span>Uploading {uploadProgress.name}</span>
                    <span>{Math.round(uploadProgress.pct)}%</span>
                  </div>
                </div>
              )}
            </div>
            <select
              className="ang-cat-select"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as DocCategory)}
            >
              <option value="Safety">Safety</option>
              <option value="Education">Education</option>
              <option value="Information">Information</option>
            </select>
            <button className="ang-wbtn primary" onClick={() => fileInputRef.current?.click()}>
              Choose File
            </button>
            <input
              ref={fileInputRef}
              className="ang-upload-input"
              type="file"
              accept=".pdf,.docx,.jpg,.jpeg,.png"
              onChange={onFileInputChange}
            />
          </div>

          <div className="ang-section-label">
            <h3>My Documents</h3>
            <div className="line" />
            <div className="count">{docs.length} {docs.length === 1 ? 'file' : 'files'}</div>
          </div>

          <div className="ang-cat-filters">
            {CATEGORIES.map((c) => {
              const count = c === 'All' ? docs.length : docs.filter((d) => d.category === c).length;
              return (
                <button
                  key={c}
                  className={`ang-cat-filter${activeCategory === c ? ' active' : ''}`}
                  onClick={() => setActiveCategory(c)}
                >
                  {c} ({count})
                </button>
              );
            })}
          </div>

          <div className="ang-doc-list">
            {shownDocs.length === 0 && (
              <div className="ang-empty">No documents in "{activeCategory}" yet.</div>
            )}
            {shownDocs.map((d) => (
              <div className="ang-doc-row" key={d.id}>
                <div className="ang-doc-row-icon">
                  <DocIcon type={d.type} />
                </div>
                <div className="ang-doc-row-info">
                  <div className="ang-doc-row-name">{d.name}</div>
                  <div className="ang-doc-row-meta">{d.type.toUpperCase()} · {d.size}</div>
                </div>
                <span className={`ang-cat-tag cat-${d.category.toLowerCase()}`}>{d.category}</span>
                <div className={`ang-status-badge ${d.status === 'ready' ? 'ready' : 'processing'}`}>
                  {d.status === 'ready' ? 'Ready' : 'Processing'}
                </div>
                <div className="ang-doc-row-date">{d.date}</div>
                <div className="ang-row-actions">
                  <button className="ang-icon-btn" title="View" onClick={() => setModalDoc(d)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button className="ang-icon-btn danger" title="Delete" onClick={() => deleteDoc(d.id)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {modalDoc && (
          <div
            className="ang-modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) setModalDoc(null); }}
          >
            <div className="ang-modal-card">
              <div className="ang-modal-head">
                <div>
                  <h3>{modalDoc.name}</h3>
                  <div className="meta">{modalDoc.type.toUpperCase()} · {modalDoc.size} · Uploaded {modalDoc.date}</div>
                </div>
                <button className="ang-modal-close" onClick={() => setModalDoc(null)} aria-label="Close">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M4 4l16 16M20 4L4 20" />
                  </svg>
                </button>
              </div>
              <div className="ang-modal-body">
                <h4>Category</h4>
                <span className={`ang-cat-tag cat-${modalDoc.category.toLowerCase()}`}>{modalDoc.category}</span>
                <h4>Status</h4>
                <div className={`ang-status-badge ${modalDoc.status === 'ready' ? 'ready' : 'processing'}`}>
                  {modalDoc.status === 'ready' ? 'Ready to use' : 'Still processing'}
                </div>
                <h4>Extracted Information</h4>
                <div className="ang-extract-block">
                  {modalDoc.extract.map((e, i) => (
                    <div key={i} style={{ marginBottom: i < modalDoc.extract.length - 1 ? 12 : 0 }}>
                      <div className="ang-extract-year">{e.year}</div>
                      <div>{e.text}</div>
                    </div>
                  ))}
                </div>
                <div className="ang-modal-actions">
                  <button className="ang-wbtn" onClick={() => setModalDoc(null)}>Close</button>
                  <button className="ang-wbtn primary" onClick={() => useInCreator(modalDoc)}>
                    Use in Creator
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
const breadcrumbs: BreadcrumbItem[] = [
  { title: 'News Creator', href: creatorRoutes.create() },
  { title: 'Document Library', href: creatorRoutes.archive() },
];
DocumentArchive.layout = (page: React.ReactNode) => (
  <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);