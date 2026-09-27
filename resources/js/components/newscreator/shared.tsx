/**
 * Shared code for the ApaKhabar Creator pages:
 *   - resources/js/pages/document-archive.tsx
 *   - resources/js/pages/intelligentNCnews-creator.tsx
 *
 * Save this file at: resources/js/components/apakhabar-creator/shared.tsx
 */

/* ============================================================
   TYPES
   ============================================================ */

export type DocType = 'pdf' | 'docx' | 'img';
export type DocStatus = 'ready' | 'processing';
export type DocCategory = 'Safety' | 'Education' | 'Information';

export interface ExtractEntry {
    year: string;
    text: string;
}

export interface DocumentItem {
    id: number;
    name: string;
    type: DocType;
    size: string;
    date: string;
    status: DocStatus;
    category: DocCategory;
    extract: ExtractEntry[];
}

export interface ArticleData {
    headline: string;
    body: string;
    kicker: string;
    byline: string;
    meta: string;
    sourceNames: string[];
    status: 'unsaved' | 'draft' | 'saved';
}

export interface SavedArticle {
    headline: string;
    status: 'draft' | 'saved';
    updated: string;
    full: ArticleData;
}

export const CATEGORIES: Array<DocCategory | 'All'> = ['All', 'Safety', 'Education', 'Information'];

/* ============================================================
   MOCK DATA
   TODO: remove once documents come from the real backend
   (both pages currently seed from this independently, so
   uploads on the Archive page won't yet be visible on the
   Creator page — that sync arrives once we wire the API).
   ============================================================ */

export const MOCK_DOCS: DocumentItem[] = [
    {
        id: 1,
        name: 'Flood Report 2024–2025.pdf',
        type: 'pdf',
        size: '2.4 MB',
        date: '12 Aug 2026',
        status: 'ready',
        category: 'Safety',
        extract: [
            { year: '2024', text: 'Village A: 80 people affected, 3 households evacuated to Balik Pulau relief centre.' },
            { year: '2025', text: 'Village A: 150 people affected. Village C: 200 people affected, evacuation ongoing.' },
        ],
    },
    {
        id: 2,
        name: 'Flood Awareness Poster.png',
        type: 'img',
        size: '860 KB',
        date: '12 Aug 2026',
        status: 'ready',
        category: 'Education',
        extract: [
            { year: 'General', text: 'Poster outlines 4 flood-safety steps: move valuables up, cut power, avoid floodwater, follow evacuation routes.' },
        ],
    },
    {
        id: 3,
        name: 'University Event.docx',
        type: 'docx',
        size: '640 KB',
        date: '09 Aug 2026',
        status: 'processing',
        category: 'Information',
        extract: [
            { year: '2026', text: 'Orientation week schedule and welcome address details, still being processed.' },
        ],
    },
];

/* ============================================================
   ICONS
   ============================================================ */

export function DocIcon({ type }: { type: DocType }) {
    if (type === 'pdf') {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="2" width="16" height="20" rx="1.5" />
                <path d="M8 10h8M8 14h8M8 18h5" />
            </svg>
        );
    }

    if (type === 'docx') {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="2" width="16" height="20" rx="1.5" />
                <path d="M9 8l6 8M15 8l-6 8" />
            </svg>
        );
    }

    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="4" width="18" height="16" rx="1.5" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="M21 16l-5.5-5.5L4 21" />
        </svg>
    );
}

/* ============================================================
   FONT LINKS — spread these into <Head> on both pages
   ============================================================ */

export const FONT_HREF =
    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap';

/* ============================================================
   MASTHEAD (shared header + tab nav between the two pages)
   ============================================================ */

import { Link } from '@inertiajs/react';

export function Masthead({ active }: { active: 'archive' | 'creator' }) {
    const dateline = new Date()
        .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        .toUpperCase();

    return (
        <header className="masthead">
            <div className="masthead-inner">
                <div className="brand">
                    <div className="mark">AC</div>
                    <div>
                        <h1>ApaKhabar Creator</h1>
                        <div className="tagline">Field reports → publishable news</div>
                    </div>
                </div>
                <div className="dateline mono">{dateline}</div>
            </div>
            <div className="wire-rule" />
            <nav className="tabs">
                <Link href="/apakhabar-creator/documents" className={active === 'archive' ? 'active' : ''}>
                    <span className="num">01</span>Archive
                </Link>
                <Link href="/apakhabar-creator/create" className={active === 'creator' ? 'active' : ''}>
                    <span className="num">02</span>Creator
                </Link>
            </nav>
        </header>
    );
}

/* ============================================================
   STYLES — same design tokens/classes as the original mockup,
   scoped under .wiredesk-app. Import and render once per page:
     <style>{WIREDESK_CSS}</style>
   ============================================================ */

export const WIREDESK_CSS = `
.wiredesk-app{
  --paper: #E8E4D6; --paper-deep: #DDD8C6; --card: #F6F3E8;
  --ink: #211D17; --ink-soft: #5B5748; --ink-faint: #8B8674;
  --rule: #C8C2AC; --rule-strong: #A9A188;
  --wire-blue: #2B5F6B; --wire-blue-deep: #1C434C; --wire-blue-pale: #DCE7E6;
  --amber: #B5761E; --amber-pale: #F1E1C4;
  --red-stamp: #9C3B2E; --green: #4F7A3B; --green-pale: #E1E9D5;
  --shadow: 0 1px 0 rgba(33,29,23,0.06);
  background:
    repeating-linear-gradient(0deg, rgba(33,29,23,0.015) 0px, rgba(33,29,23,0.015) 1px, transparent 1px, transparent 3px),
    var(--paper);
  color:var(--ink);
  font-family:'IBM Plex Sans', sans-serif;
  min-height:100vh;
}
.wiredesk-app h1, .wiredesk-app h2, .wiredesk-app h3{ font-family:'Fraunces', serif; margin:0; letter-spacing:-0.01em; }
.wiredesk-app .mono{ font-family:'IBM Plex Mono', monospace; }
.wiredesk-app button{ font-family:inherit; cursor:pointer; }
.wiredesk-app ::selection{ background:var(--amber-pale); }

.wiredesk-app .masthead{ border-bottom:2px solid var(--ink); background:var(--paper); position:sticky; top:0; z-index:50; }
.wiredesk-app .masthead-inner{ max-width:1180px; margin:0 auto; padding:18px 28px 14px; display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; }
.wiredesk-app .brand{ display:flex; align-items:baseline; gap:10px;}
.wiredesk-app .brand .mark{ width:34px;height:34px; border:2px solid var(--ink); border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'IBM Plex Mono', monospace; font-weight:600; font-size:13px; }
.wiredesk-app .brand h1{ font-size:26px; font-weight:700; }
.wiredesk-app .brand .tagline{ font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:var(--ink-faint); margin-left:2px;}
.wiredesk-app .dateline{ font-family:'IBM Plex Mono', monospace; font-size:11px; color:var(--ink-soft); letter-spacing:0.04em; text-align:right;}
.wiredesk-app .wire-rule{ width:100%; height:1px; background-image: linear-gradient(90deg, var(--ink) 0 3px, transparent 3px 9px); background-size: 9px 1px; opacity:0.55; }
.wiredesk-app nav.tabs{ max-width:1180px; margin:0 auto; padding:0 28px; display:flex; gap:2px; }
.wiredesk-app nav.tabs a{ text-decoration:none; background:none; border:none; border-top:1px solid transparent; padding:12px 6px; margin-right:26px; font-family:'IBM Plex Mono', monospace; font-size:12.5px; letter-spacing:0.09em; text-transform:uppercase; color:var(--ink-faint); position:relative; border-bottom:2px solid transparent; display:inline-block; }
.wiredesk-app nav.tabs a .num{ opacity:0.55; margin-right:6px;}
.wiredesk-app nav.tabs a.active{ color:var(--ink); border-bottom:2px solid var(--wire-blue); }
.wiredesk-app nav.tabs a:hover:not(.active){ color:var(--ink-soft); }

.wiredesk-app .page{ max-width:1180px; margin:0 auto; padding:32px 28px 80px; }
.wiredesk-app .page-head{ display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin-bottom:24px; flex-wrap:wrap;}
.wiredesk-app .page-head h2{ font-size:32px; font-weight:600; }
.wiredesk-app .eyebrow{ font-family:'IBM Plex Mono', monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:var(--wire-blue-deep); margin-bottom:6px; display:flex; align-items:center; gap:8px; }
.wiredesk-app .eyebrow::before{ content:''; width:16px; height:1px; background:var(--wire-blue-deep); display:inline-block;}
.wiredesk-app .lede{ color:var(--ink-soft); font-size:14.5px; max-width:440px; line-height:1.5; }

.wiredesk-app .stat-strip{ display:flex; gap:0; border:1px solid var(--rule-strong); border-radius:2px; overflow:hidden;}
.wiredesk-app .stat{ padding:10px 18px; border-right:1px solid var(--rule-strong); text-align:center; background:var(--card);}
.wiredesk-app .stat:last-child{border-right:none;}
.wiredesk-app .stat .n{ font-family:'Fraunces', serif; font-size:22px; font-weight:600; line-height:1;}
.wiredesk-app .stat .l{ font-family:'IBM Plex Mono', monospace; font-size:9.5px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-faint); margin-top:3px;}

.wiredesk-app .card{ background:var(--card); border:1px solid var(--rule-strong); border-radius:3px; box-shadow:var(--shadow); }

.wiredesk-app .upload-bar{ display:flex; align-items:center; gap:14px; padding:12px 16px; flex-wrap:wrap; }
.wiredesk-app .upload-bar.drag{ border-color:var(--wire-blue); background:var(--wire-blue-pale); }
.wiredesk-app .upload-bar .icon{ width:32px;height:32px; border:1.5px solid var(--ink); border-radius:50%; flex-shrink:0; display:flex;align-items:center;justify-content:center; }
.wiredesk-app .upload-bar .copy{ flex:1; min-width:160px; }
.wiredesk-app .upload-bar .copy strong{ display:block; font-size:13.5px; font-weight:600; }
.wiredesk-app .upload-bar .copy span{ display:block; font-size:11px; color:var(--ink-faint); margin-top:1px;}
.wiredesk-app .upload-bar select.cat-select{ width:auto; min-width:140px; padding:8px 30px 8px 10px; font-size:12px; }

.wiredesk-app .btn{ display:inline-flex; align-items:center; gap:8px; justify-content:center; padding:10px 20px; border-radius:2px; font-size:13px; font-weight:600; letter-spacing:0.01em; border:1px solid var(--ink); background:var(--ink); color:var(--paper); transition:transform .1s ease, opacity .1s ease; white-space:nowrap; }
.wiredesk-app .btn:hover{ opacity:0.85;}
.wiredesk-app .btn:active{ transform:translateY(1px);}
.wiredesk-app .btn.ghost{ background:transparent; color:var(--ink); border:1px solid var(--rule-strong);}
.wiredesk-app .btn.ghost:hover{ border-color:var(--ink); opacity:1;}
.wiredesk-app .btn.blue{ background:var(--wire-blue); border-color:var(--wire-blue); color:#fff;}
.wiredesk-app .btn.green{ background:var(--green); border-color:var(--green); color:#fff;}
.wiredesk-app .btn:disabled{ opacity:0.4; cursor:not-allowed;}
.wiredesk-app .btn.small{ padding:7px 13px; font-size:11.5px;}

.wiredesk-app .progress-wrap{ margin-top:0; width:100%; }
.wiredesk-app .progress-track{ height:4px; background:var(--rule); border-radius:4px; overflow:hidden;}
.wiredesk-app .progress-bar{ height:100%; background:var(--wire-blue); transition:width .25s ease; }
.wiredesk-app .progress-label{ font-family:'IBM Plex Mono', monospace; font-size:10px; color:var(--ink-soft); margin-top:5px; display:flex; justify-content:space-between;}

.wiredesk-app input[type=file]{ display:none; }

.wiredesk-app .section-label{ display:flex; align-items:center; gap:12px; margin:34px 0 16px; }
.wiredesk-app .section-label h3{ font-size:14px; font-weight:600; letter-spacing:0.02em; white-space:nowrap;}
.wiredesk-app .section-label .line{ flex:1; height:1px; background:var(--rule-strong);}
.wiredesk-app .section-label .count{ font-family:'IBM Plex Mono', monospace; font-size:10.5px; color:var(--ink-faint);}

.wiredesk-app .cat-filters{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px; }
.wiredesk-app .cat-filter{ font-family:'IBM Plex Mono', monospace; font-size:11px; letter-spacing:0.04em; padding:7px 13px; border:1px solid var(--rule-strong); border-radius:20px; color:var(--ink-soft); background:transparent; display:flex; align-items:center; gap:6px; }
.wiredesk-app .cat-filter .dot{ width:6px;height:6px;border-radius:50%; background:var(--ink-faint);}
.wiredesk-app .cat-filter.active{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.wiredesk-app .cat-filter.active .dot{ background:var(--paper); }
.wiredesk-app .cat-filter:not(.active):hover{ border-color:var(--ink); color:var(--ink); }

.wiredesk-app .cat-safety{ background:#F1DCD6; color:var(--red-stamp); }
.wiredesk-app .cat-education{ background:var(--wire-blue-pale); color:var(--wire-blue-deep); }
.wiredesk-app .cat-information{ background:var(--amber-pale); color:var(--amber); }
.wiredesk-app .cat-tag{ font-family:'IBM Plex Mono', monospace; font-size:9.5px; letter-spacing:0.06em; text-transform:uppercase; padding:4px 9px; border-radius:20px; width:fit-content; }

.wiredesk-app .doc-list{ display:flex; flex-direction:column; gap:10px; }
.wiredesk-app .doc-row{ display:grid; grid-template-columns:38px 1fr 110px 120px 130px auto; align-items:center; gap:16px; padding:14px 16px; background:var(--card); border:1px solid var(--rule); border-radius:3px; transition:border-color .12s ease; }
.wiredesk-app .doc-row:hover{ border-color:var(--rule-strong); }
.wiredesk-app .doc-icon{ width:34px;height:34px; border-radius:3px; display:flex;align-items:center;justify-content:center; background:var(--wire-blue-pale); color:var(--wire-blue-deep); flex-shrink:0; }
.wiredesk-app .doc-icon.img{ background:var(--amber-pale); color:var(--red-stamp);}
.wiredesk-app .doc-name{ font-weight:600; font-size:14px; }
.wiredesk-app .doc-meta{ font-family:'IBM Plex Mono', monospace; font-size:10.5px; color:var(--ink-faint); margin-top:2px;}
.wiredesk-app .badge{ font-family:'IBM Plex Mono', monospace; font-size:9.5px; letter-spacing:0.06em; text-transform:uppercase; padding:4px 8px; border-radius:20px; text-align:center; width:fit-content; }
.wiredesk-app .badge.ready{ background:var(--wire-blue-pale); color:var(--wire-blue-deep);}
.wiredesk-app .badge.processing{ background:var(--amber-pale); color:var(--amber);}
.wiredesk-app .doc-date{ font-family:'IBM Plex Mono', monospace; font-size:11px; color:var(--ink-soft);}
.wiredesk-app .row-actions{ display:flex; gap:8px; justify-content:flex-end;}
.wiredesk-app .icon-btn{ width:30px;height:30px; border-radius:3px; border:1px solid var(--rule-strong); background:transparent; display:flex;align-items:center;justify-content:center; color:var(--ink-soft); }
.wiredesk-app .icon-btn:hover{ border-color:var(--ink); color:var(--ink);}
.wiredesk-app .icon-btn.danger:hover{ border-color:var(--red-stamp); color:var(--red-stamp);}

.wiredesk-app .empty{ text-align:center; padding:46px 20px; color:var(--ink-faint); font-size:13px; border:1px dashed var(--rule-strong); border-radius:3px; }

.wiredesk-app .modal-overlay{ position:fixed; inset:0; background:rgba(33,29,23,0.45); backdrop-filter:blur(1px); display:flex; align-items:center; justify-content:center; z-index:100; padding:24px; }
.wiredesk-app .modal{ background:var(--card); border:1px solid var(--rule-strong); border-radius:4px; width:100%; max-width:560px; max-height:85vh; overflow-y:auto; box-shadow:0 12px 40px rgba(33,29,23,0.25); }
.wiredesk-app .modal-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; padding:20px 24px; border-bottom:1px solid var(--rule); background:var(--paper-deep); }
.wiredesk-app .modal-head h3{ font-size:18px; margin-bottom:4px; }
.wiredesk-app .modal-close{ width:28px;height:28px; border:1px solid var(--rule-strong); border-radius:50%; background:none; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--ink-soft); }
.wiredesk-app .modal-close:hover{ border-color:var(--ink); color:var(--ink); }
.wiredesk-app .modal-body{ padding:22px 24px 26px; }
.wiredesk-app .modal-body h4{ font-family:'IBM Plex Mono', monospace; font-size:10.5px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-soft); margin:18px 0 10px; }
.wiredesk-app .modal-body h4:first-child{ margin-top:0; }
.wiredesk-app .extract-block{ background:var(--paper); border:1px solid var(--rule); border-radius:3px; padding:14px 16px; font-size:13px; line-height:1.65; }
.wiredesk-app .extract-year{ font-family:'IBM Plex Mono', monospace; font-size:11px; color:var(--wire-blue-deep); font-weight:600; margin-bottom:4px; }
.wiredesk-app .modal-actions{ display:flex; gap:10px; margin-top:20px; }

.wiredesk-app .desk-grid{ display:grid; grid-template-columns:340px 1fr; gap:26px; align-items:start; }
@media(max-width:920px){ .wiredesk-app .desk-grid{ grid-template-columns:1fr; } }

.wiredesk-app .field{ margin-bottom:16px; }
.wiredesk-app .field label{ display:block; font-family:'IBM Plex Mono', monospace; font-size:10.5px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-soft); margin-bottom:7px; }
.wiredesk-app select, .wiredesk-app textarea{ width:100%; padding:10px 12px; border:1px solid var(--rule-strong); border-radius:2px; background:var(--card); font-family:'IBM Plex Sans', sans-serif; font-size:13.5px; color:var(--ink); }
.wiredesk-app select{ appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235B5748'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; padding-right:32px;}
.wiredesk-app textarea{ resize:vertical; min-height:72px; line-height:1.5; }
.wiredesk-app select:focus, .wiredesk-app textarea:focus{ outline:none; border-color:var(--wire-blue); box-shadow:0 0 0 3px var(--wire-blue-pale); }

.wiredesk-app .radio-row{ display:flex; gap:8px; }
.wiredesk-app .radio-pill{ flex:1; text-align:center; padding:9px 6px; border:1px solid var(--rule-strong); border-radius:2px; font-size:12.5px; color:var(--ink-soft); position:relative; }
.wiredesk-app .radio-pill input{ position:absolute; opacity:0; inset:0; margin:0; cursor:pointer;}
.wiredesk-app .radio-pill.checked{ border-color:var(--wire-blue); background:var(--wire-blue-pale); color:var(--wire-blue-deep); font-weight:600;}

.wiredesk-app .kw-box{ display:flex; flex-wrap:wrap; gap:7px; padding:9px; border:1px solid var(--rule-strong); border-radius:2px; background:var(--card); }
.wiredesk-app .kw-tag{ display:flex; align-items:center; gap:6px; background:var(--wire-blue-pale); color:var(--wire-blue-deep); font-family:'IBM Plex Mono', monospace; font-size:11px; padding:5px 8px 5px 10px; border-radius:20px; }
.wiredesk-app .kw-tag button{ background:none; border:none; color:var(--wire-blue-deep); font-size:13px; line-height:1; opacity:0.6;}
.wiredesk-app .kw-tag button:hover{ opacity:1;}
.wiredesk-app .kw-box input{ border:none; outline:none; background:none; flex:1; min-width:90px; font-size:12.5px; padding:5px 4px;}

.wiredesk-app .desk-controls .card{ padding:20px; }

.wiredesk-app .article-panel{ padding:0; overflow:hidden; }
.wiredesk-app .article-empty{ padding:70px 30px; text-align:center; color:var(--ink-faint); }
.wiredesk-app .article-empty .icon{ width:52px;height:52px;margin:0 auto 16px; border:1.5px solid var(--rule-strong); border-radius:50%; display:flex;align-items:center;justify-content:center; color:var(--ink-faint); }
.wiredesk-app .article-empty h3{ color:var(--ink-soft); font-size:16px; margin-bottom:6px;}
.wiredesk-app .article-empty p{ font-size:12.5px; max-width:280px; margin:0 auto; line-height:1.5;}

.wiredesk-app .article-bar{ display:flex; justify-content:space-between; align-items:center; padding:14px 24px; border-bottom:1px solid var(--rule); background:var(--paper-deep); flex-wrap:wrap; gap:10px; }
.wiredesk-app .article-bar .status{ display:flex; align-items:center; gap:8px; font-family:'IBM Plex Mono', monospace; font-size:11px; color:var(--ink-soft); }
.wiredesk-app .status .dot{ width:7px;height:7px;border-radius:50%; background:var(--wire-blue);}
.wiredesk-app .status .dot.draft{ background:var(--amber); }
.wiredesk-app .status .dot.saved{ background:var(--green); }
.wiredesk-app .article-actions{ display:flex; gap:8px; flex-wrap:wrap; }

.wiredesk-app .article-body{ padding:30px 40px 40px; position:relative; }
.wiredesk-app .article-body.loading{ padding:60px 40px; }
.wiredesk-app .article-kicker{ font-family:'IBM Plex Mono', monospace; font-size:10.5px; letter-spacing:0.1em; text-transform:uppercase; color:var(--red-stamp); margin-bottom:10px; }
.wiredesk-app .article-headline{ font-size:28px; font-weight:700; line-height:1.18; margin-bottom:12px; width:100%; border:none; background:none; font-family:'Fraunces', serif; color:var(--ink); padding:0; }
.wiredesk-app .article-headline:focus{ outline:none; }
.wiredesk-app .article-byline{ font-family:'IBM Plex Mono', monospace; font-size:11px; color:var(--ink-faint); padding-bottom:16px; margin-bottom:18px; border-bottom:1px solid var(--rule); }
.wiredesk-app .article-text{ font-size:15px; line-height:1.75; color:#2A261E; }
.wiredesk-app .article-text p{ margin:0 0 16px; }
.wiredesk-app .article-text p:first-of-type::first-letter{ font-family:'Fraunces', serif; font-size:42px; font-weight:600; float:left; line-height:0.8; padding:6px 6px 0 0; color:var(--wire-blue-deep); }
.wiredesk-app .edit-hint{ font-family:'IBM Plex Mono', monospace; font-size:10.5px; color:var(--wire-blue-deep); background:var(--wire-blue-pale); padding:6px 10px; border-radius:3px; margin-bottom:14px; }

.wiredesk-app .sources-block{ margin-top:28px; padding-top:18px; border-top:1px solid var(--rule); }
.wiredesk-app .sources-block h4{ font-family:'IBM Plex Mono', monospace; font-size:10.5px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-soft); margin-bottom:12px; }
.wiredesk-app .source-item{ display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--rule); border-radius:3px; margin-bottom:7px; font-size:12.5px; }
.wiredesk-app .source-item .tag{ margin-left:auto; font-family:'IBM Plex Mono', monospace; font-size:9.5px; color:var(--wire-blue-deep); background:var(--wire-blue-pale); padding:2px 7px; border-radius:20px; }

.wiredesk-app .stamp{ position:absolute; top:20px; right:24px; font-family:'IBM Plex Mono', monospace; font-size:10px; letter-spacing:0.12em; color:var(--red-stamp); border:1.5px solid var(--red-stamp); padding:4px 10px; border-radius:2px; transform:rotate(4deg); opacity:0.75; text-transform:uppercase; }

.wiredesk-app .loader-dots{ display:flex; gap:6px; justify-content:center; margin-bottom:16px;}
.wiredesk-app .loader-dots span{ width:7px;height:7px;border-radius:50%; background:var(--wire-blue); animation:wdpulse 1.1s infinite ease-in-out;}
.wiredesk-app .loader-dots span:nth-child(2){ animation-delay:.15s;}
.wiredesk-app .loader-dots span:nth-child(3){ animation-delay:.3s;}
@keyframes wdpulse{ 0%,80%,100%{ opacity:0.25; transform:scale(0.85);} 40%{ opacity:1; transform:scale(1);} }
.wiredesk-app .loading-text{ text-align:center; font-family:'IBM Plex Mono', monospace; font-size:11.5px; color:var(--ink-soft);}

.wiredesk-app .saved-list{ display:flex; flex-direction:column; gap:8px; }
.wiredesk-app .saved-item{ display:flex; align-items:center; gap:12px; padding:11px 14px; background:var(--card); border:1px solid var(--rule); border-radius:3px; cursor:pointer; }
.wiredesk-app .saved-item:hover{ border-color:var(--rule-strong); }
.wiredesk-app .saved-item .badge.draft{ background:var(--amber-pale); color:var(--amber); }
.wiredesk-app .saved-item .badge.saved{ background:var(--green-pale); color:var(--green); }
.wiredesk-app .saved-item .s-title{ font-weight:600; font-size:13px; flex:1; }
.wiredesk-app .saved-item .s-meta{ font-family:'IBM Plex Mono', monospace; font-size:10.5px; color:var(--ink-faint); }

@media(max-width:640px){
  .wiredesk-app .doc-row{ grid-template-columns:32px 1fr; row-gap:6px;}
  .wiredesk-app .doc-row .badge, .wiredesk-app .doc-row .doc-date{ display:none; }
  .wiredesk-app .row-actions{ justify-content:flex-start; }
  .wiredesk-app .article-headline{ font-size:22px; }
  .wiredesk-app .article-body{ padding:22px 18px; }
  .wiredesk-app .upload-bar{ flex-direction:column; align-items:stretch; }
}
`;