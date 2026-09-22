import { Head, router } from '@inertiajs/react';
import {
    Archive,
    History,
    Paperclip,
    Send,
    Pencil,
    ImagePlus,
    Rocket,
    Bold,
    Italic,
    Underline,
    AlignLeft,
    AlignCenter,
    AlignRight,
    List,
    ListOrdered,
    Undo2,
    Redo2,
    ChevronDown,
    ChevronRight,
    FileText,
    X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import AppLayout from '@/layouts/app-layout';
import assistantRoutes from '@/routes/admin/assistant';
import documentRoutes from '@/routes/admin/documents';
import type { BreadcrumbItem } from '@/types';

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

interface Source {
    doc: string;
    page: string;
    extract: string;
}

interface Evidence {
    source: string;
    quote: string;
}
interface InformationItem {
    id: number;
    title: string;
    summary: string;
    labels: string[];
    confidence: number | null;
    document: { id: number; original_name: string };
}
interface GeneratedArticle {
    headline: string;
    subheadline: string | null;
    lead: string;
    body: string[];
    summary: string;
    labels: string[];
    warnings: string[];
    selected_sources: Array<{
        id: number;
        title: string;
        document: string;
        evidence: Evidence[];
    }>;
}
interface Props {
    informationItems: InformationItem[];
    generatedArticle?: GeneratedArticle | null;
    preselectedInformationIds?: number[];
}

function escapeHtml(value: string): string {
    return value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;',
            })[character] ?? character,
    );
}

const SUGGESTIONS = [
    'Create a flood report',
    'Generate awareness article',
    'Summarize a report',
];

const EMPTY_EXAMPLES = [
    'Create a flood report for Penang',
    'Generate a 2025 flood awareness article',
    'Summarize this report',
];

const LOADING_STEPS = [
    'Searching relevant reports...',
    'Retrieving information...',
    'Generating article...',
];

type MobileTab = 'chat' | 'preview';

// ---------------------------------------------------------------------------
// Styles
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
.ang-app{font-family:var(--font-ui);background:var(--bg);color:var(--ink);flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden;}
.ang-app button{font-family:inherit;cursor:pointer;background:none;border:none;color:inherit;}
.ang-app input,.ang-app textarea,.ang-app select{font-family:inherit;color:inherit;}
.ang-header{height:64px;flex:0 0 64px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:var(--surface);border-bottom:1px solid var(--border);position:relative;z-index:50;}
.ang-header-left{display:flex;align-items:center;gap:12px;}
.ang-brand-icon{width:34px;height:34px;border-radius:9px;background:var(--ink);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ang-brand-icon svg{width:18px;height:18px;stroke:#fff;}
.ang-brand-text{display:flex;flex-direction:column;line-height:1.15;}
.ang-brand-name{font-size:15px;font-weight:600;letter-spacing:-0.01em;}
.ang-brand-sub{font-size:11.5px;color:var(--ink-faint);font-weight:500;}
.ang-header-right{display:flex;align-items:center;gap:8px;}
.ang-hbtn{display:flex;align-items:center;gap:6px;height:36px;padding:0 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-weight:500;color:var(--ink-soft);background:var(--surface);transition:.15s;position:relative;}
.ang-hbtn:hover{background:var(--surface-2);border-color:var(--border-strong);color:var(--ink);}
.ang-saved-dropdown{position:absolute;top:48px;right:20px;width:280px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-md);overflow:hidden;}
.ang-saved-dropdown-head{padding:12px 14px;border-bottom:1px solid var(--border);font-size:12.5px;font-weight:600;color:var(--ink-soft);}
.ang-saved-dropdown-item{padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;}
.ang-saved-dropdown-item:last-child{border-bottom:none;}
.ang-saved-dropdown-item .t{font-weight:500;margin-bottom:2px;}
.ang-saved-dropdown-item .m{font-size:11.5px;color:var(--ink-faint);}
.ang-mobile-tabs{display:none;flex:0 0 46px;background:var(--surface);border-bottom:1px solid var(--border);padding:0 12px;align-items:center;gap:6px;}
.ang-mtab{flex:1;height:32px;border-radius:7px;font-size:12.5px;font-weight:500;color:var(--ink-soft);display:flex;align-items:center;justify-content:center;border:1px solid transparent;}
.ang-mtab.active{background:var(--accent-soft);color:var(--accent);border-color:var(--accent-soft-border);}
.ang-main{flex:1;display:flex;min-height:0;}
.ang-chat-panel{width:38%;min-width:340px;max-width:520px;display:flex;flex-direction:column;border-right:1px solid var(--border);background:var(--surface);min-height:0;position:relative;}
.ang-chat-head{padding:18px 20px 14px;border-bottom:1px solid var(--border);flex:0 0 auto;}
.ang-chat-head h1{font-size:16px;font-weight:600;letter-spacing:-0.01em;margin:0 0 3px;}
.ang-chat-head p{font-size:12.5px;color:var(--ink-soft);line-height:1.4;margin:0 0 10px;}
.ang-ai-status{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:500;color:var(--success);background:var(--success-soft);padding:4px 9px;border-radius:20px;}
.ang-ai-status .pulse{width:6px;height:6px;border-radius:50%;background:var(--success);animation:ang-pulse 2s infinite;}
@keyframes ang-pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
.ang-msgscroller-wrap{flex:1;min-height:0;display:flex;flex-direction:column;}
.ang-msgscroller{flex:1;min-height:0;display:flex;flex-direction:column;}
.ang-msgscroller-viewport{flex:1;min-height:0;padding:18px 20px;}
.ang-msgscroller-content{display:flex;flex-direction:column;gap:14px;}
.ang-msgscroller-btn{position:absolute;bottom:14px;right:14px;z-index:5;}
.ang-msg{max-width:88%;font-size:13.5px;line-height:1.55;}
.ang-msg.user{align-self:flex-end;margin-left:auto;}
.ang-msg.ai{align-self:flex-start;}
.ang-msg-bubble{padding:10px 13px;border-radius:var(--radius-md);}
.ang-msg.user .ang-msg-bubble{background:var(--ink);color:#fff;border-bottom-right-radius:4px;}
.ang-msg.ai .ang-msg-bubble{background:var(--surface-2);border:1px solid var(--border);border-bottom-left-radius:4px;color:var(--ink);}
.ang-msg-label{font-size:10.5px;font-weight:600;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;}
.ang-msg.ai .ang-msg-label{color:var(--accent);}
.ang-clar-card{margin-top:10px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 13px;}
.ang-clar-title{font-size:12.5px;font-weight:600;margin-bottom:10px;color:var(--ink);}
.ang-clar-group{margin-bottom:12px;}
.ang-clar-group:last-of-type{margin-bottom:0;}
.ang-clar-group-label{font-size:11px;font-weight:600;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;}
.ang-chip-row{display:flex;flex-wrap:wrap;gap:6px;}
.ang-chip{padding:6px 11px;border:1px solid var(--border-strong);border-radius:20px;font-size:12.5px;font-weight:500;color:var(--ink-soft);background:var(--surface);transition:.12s;}
.ang-chip:hover{border-color:var(--accent);color:var(--accent);}
.ang-chip.selected{background:var(--accent);border-color:var(--accent);color:#fff;}
.ang-clar-continue{margin-top:12px;width:100%;height:34px;border-radius:var(--radius-sm);background:var(--border);color:var(--ink-faint);font-size:12.5px;font-weight:600;transition:.15s;}
.ang-clar-continue.ready{background:var(--accent);color:#fff;}
.ang-clar-continue.ready:hover{background:var(--accent-hover);}
.ang-loading-msg{align-self:flex-start;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-md);border-bottom-left-radius:4px;padding:12px 13px;max-width:88%;}
.ang-loading-steps{display:flex;flex-direction:column;gap:7px;}
.ang-loading-step{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink-faint);opacity:.35;}
.ang-loading-step.active{color:var(--ink);opacity:1;}
.ang-loading-step.done{color:var(--ink-soft);opacity:1;}
.ang-step-marker{width:14px;height:14px;flex:0 0 14px;border-radius:50%;border:1.5px solid var(--border-strong);display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;}
.ang-loading-step.active .ang-step-marker{border-color:var(--accent);position:relative;}
.ang-loading-step.active .ang-step-marker::after{content:'';width:6px;height:6px;border-radius:50%;background:var(--accent);animation:ang-pulse 1s infinite;}
.ang-loading-step.done .ang-step-marker{background:var(--success);border-color:var(--success);}
.ang-suggest-row{padding:0 20px 10px;display:flex;flex-wrap:wrap;gap:6px;flex:0 0 auto;}
.ang-suggest-chip{padding:6px 12px;border:1px solid var(--border);border-radius:20px;font-size:12px;font-weight:500;color:var(--ink-soft);background:var(--surface-2);transition:.12s;}
.ang-suggest-chip:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);}
.ang-chat-input-wrap{flex:0 0 auto;padding:0 20px 18px;}
.ang-chat-input{display:flex;align-items:flex-end;gap:8px;border:1px solid var(--border-strong);border-radius:var(--radius-lg);background:var(--surface);padding:8px 8px 8px 12px;transition:.15s;}
.ang-chat-input:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);}
.ang-chat-input textarea{flex:1;border:none;outline:none;resize:none;font-size:13.5px;line-height:1.4;max-height:90px;padding:6px 0;background:transparent;}
.ang-attach-btn{width:30px;height:30px;flex:0 0 30px;display:flex;align-items:center;justify-content:center;color:var(--ink-faint);border-radius:8px;}
.ang-attach-btn:hover{background:var(--surface-2);color:var(--ink-soft);}
.ang-send-btn{width:32px;height:32px;flex:0 0 32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;transition:.15s;}
.ang-send-btn:hover{background:var(--accent-hover);}
.ang-workspace{flex:1;display:flex;flex-direction:column;min-height:0;min-width:0;}
.ang-ws-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--border);background:var(--surface);}
.ang-ws-head-left h2{font-size:15px;font-weight:600;margin:0 0 2px;}
.ang-ws-head-left .sub{font-size:12px;color:var(--ink-soft);display:flex;align-items:center;gap:8px;}
.ang-status-badge{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:5px;text-transform:uppercase;letter-spacing:.03em;}
.ang-status-badge.draft{background:var(--warn-soft);color:var(--warn);}
.ang-status-badge.saved{background:var(--success-soft);color:var(--success);}
.ang-ws-head-right{display:flex;align-items:center;gap:8px;}
.ang-wbtn{display:flex;align-items:center;gap:6px;height:34px;padding:0 13px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12.5px;font-weight:500;color:var(--ink-soft);background:var(--surface);transition:.15s;}
.ang-wbtn:hover{background:var(--surface-2);border-color:var(--border-strong);color:var(--ink);}
.ang-wbtn.primary{background:var(--accent);color:#fff;border-color:var(--accent);}
.ang-wbtn.primary:hover{background:var(--accent-hover);}
.ang-unsaved-flag{display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:var(--warn);}
.ang-unsaved-flag::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--warn);}
.ang-thumb-wrap{position:relative;margin-bottom:18px;border-radius:var(--radius-md);overflow:hidden;}
.ang-thumb-img{width:100%;max-height:320px;object-fit:cover;display:block;}
.ang-thumb-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;height:160px;border:1.5px dashed var(--border-strong);border-radius:var(--radius-md);color:var(--ink-faint);font-size:12.5px;font-weight:500;background:var(--surface-2);transition:.15s;}
.ang-thumb-empty:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);}
.ang-thumb-actions{position:absolute;top:10px;right:10px;display:flex;gap:6px;}
.ang-thumb-btn{height:28px;padding:0 10px;border-radius:7px;font-size:11.5px;font-weight:600;background:rgba(26,34,51,.72);color:#fff;backdrop-filter:blur(2px);transition:.15s;}
.ang-thumb-btn:hover{background:rgba(26,34,51,.88);}
.ang-thumb-btn.danger:hover{background:#C0392B;}
@media (max-width:480px){
  .ang-thumb-empty{height:120px;}
}
.ang-toolbar{display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:9px 28px;background:var(--surface-2);border-bottom:1px solid var(--border);}
.ang-tb-select{height:30px;padding:0 8px;border:1px solid var(--border);border-radius:7px;background:var(--surface);font-size:12.5px;color:var(--ink);}
.ang-tb-btn{width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--ink-soft);border:1px solid transparent;}
.ang-tb-btn:hover{background:var(--surface);border-color:var(--border);}
.ang-tb-divider{width:1px;height:20px;background:var(--border);margin:0 5px;}
.ang-tb-color{width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;}
.ang-tb-color input[type=color]{position:absolute;inset:0;opacity:0;cursor:pointer;}
.ang-ws-scroll{flex:1;overflow-y:auto;padding:32px 28px 60px;min-height:0;}
.ang-empty-state{max-width:420px;margin:60px auto 0;text-align:center;}
.ang-empty-illo{width:76px;height:76px;margin:0 auto 20px;background:var(--surface);border:1px solid var(--border);border-radius:18px;display:flex;align-items:center;justify-content:center;color:var(--ink-faint);}
.ang-empty-state h3{font-size:16px;font-weight:600;margin:0 0 6px;}
.ang-empty-state p{font-size:13px;color:var(--ink-soft);line-height:1.55;margin:0 0 22px;}
.ang-empty-examples{display:flex;flex-direction:column;gap:8px;}
.ang-empty-example{padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-md);font-size:12.5px;font-weight:500;color:var(--ink-soft);background:var(--surface);text-align:left;display:flex;align-items:center;gap:8px;transition:.12s;width:100%;}
.ang-empty-example:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);}
.ang-ws-loading{max-width:640px;margin:40px auto 0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:40px 36px;text-align:center;}
.ang-ws-loading-spin{width:32px;height:32px;margin:0 auto 16px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:ang-spin .8s linear infinite;}
@keyframes ang-spin{to{transform:rotate(360deg);}}
.ang-ws-loading p{font-size:13px;color:var(--ink-soft);margin:0;}
.ang-doc-card{max-width:680px;margin:0 auto;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);padding:44px 48px 36px;}
.ang-doc-stamp{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:10.5px;font-weight:500;color:var(--accent);background:var(--accent-soft);padding:3px 9px;border-radius:5px;margin-bottom:16px;}
.ang-doc-category{font-family:var(--font-mono);font-size:11px;font-weight:500;letter-spacing:.08em;color:var(--ink-faint);text-transform:uppercase;margin-bottom:12px;}
.ang-doc-headline{font-family:var(--font-serif);font-size:32px;font-weight:600;line-height:1.2;letter-spacing:-.01em;color:var(--ink);margin-bottom:14px;outline:none;}
.ang-doc-headline[contenteditable="true"]{border-bottom:2px dashed var(--accent-soft-border);padding-bottom:4px;}
.ang-doc-meta{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--ink-soft);margin-bottom:22px;}
.ang-doc-meta .sep{width:3px;height:3px;border-radius:50%;background:var(--border-strong);}
.ang-doc-divider{height:1px;background:var(--border);margin-bottom:26px;}
.ang-doc-body{font-family:var(--font-serif);font-size:16.5px;line-height:1.75;color:var(--ink);outline:none;}
.ang-doc-body[contenteditable="true"]{border:1px dashed var(--accent-soft-border);border-radius:8px;padding:14px;margin:0 -14px;}
.ang-doc-body p{margin:0 0 16px;}
.ang-doc-body p:last-child{margin-bottom:0;}
.ang-doc-body img{max-width:100%;height:auto;border-radius:8px;margin:6px 0 16px;display:block;}
.ang-cite{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;font-family:var(--font-ui);font-size:9.5px;font-weight:600;color:var(--accent);background:var(--accent-soft);border-radius:4px;vertical-align:2px;margin-left:2px;cursor:pointer;}
.ang-cite:hover{background:var(--accent);color:#fff;}
.ang-sources-section{margin-top:34px;padding-top:22px;border-top:1px solid var(--border);}
.ang-sources-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;cursor:pointer;}
.ang-sources-toggle h4{font-size:12.5px;font-weight:600;color:var(--ink);margin:0;}
.ang-sources-toggle .chev{color:var(--ink-faint);transition:transform .15s;}
.ang-sources-toggle .chev.open{transform:rotate(180deg);}
.ang-sources-list{margin-top:12px;display:flex;flex-direction:column;gap:8px;}
.ang-source-card{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);transition:.12s;text-align:left;width:100%;}
.ang-source-card:hover{border-color:var(--accent-soft-border);background:var(--accent-soft);}
.ang-source-icon{width:30px;height:30px;flex:0 0 30px;border-radius:7px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--ink-faint);}
.ang-source-info{flex:1;min-width:0;}
.ang-source-name{font-size:12.5px;font-weight:500;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ang-source-page{font-size:11.5px;color:var(--ink-faint);}
.ang-source-arrow{color:var(--ink-faint);flex:0 0 auto;}
.ang-drawer-overlay{position:fixed;inset:0;background:rgba(20,25,40,.3);z-index:200;}
.ang-drawer{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:88vw;background:var(--surface);box-shadow:-8px 0 24px rgba(20,25,40,.08);display:flex;flex-direction:column;transform:translateX(0);transition:transform .22s ease;}
.ang-drawer-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border);}
.ang-drawer-head h3{font-size:14.5px;font-weight:600;margin:0;}
.ang-drawer-close{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--ink-soft);}
.ang-drawer-close:hover{background:var(--surface-2);}
.ang-drawer-body{flex:1;overflow-y:auto;padding:20px;}
.ang-drawer-doc-icon{width:44px;height:44px;border-radius:9px;background:var(--accent-soft);border:1px solid var(--accent-soft-border);display:flex;align-items:center;justify-content:center;color:var(--accent);margin-bottom:12px;}
.ang-drawer-body h4{font-size:14px;font-weight:600;margin:0 0 3px;}
.ang-drawer-body .page{font-size:12px;color:var(--ink-faint);margin:0 0 16px;}
.ang-drawer-extract-label{font-size:11px;font-weight:600;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;}
.ang-drawer-extract{font-family:var(--font-serif);font-size:14px;line-height:1.7;color:var(--ink-soft);background:var(--surface-2);border-left:2px solid var(--accent);padding:14px 16px;border-radius:0 8px 8px 0;}
@media (max-width:1200px){
  .ang-doc-card{padding:36px 36px 30px;}
}
@media (max-width:1024px){
  .ang-chat-panel{width:42%;min-width:300px;}
  .ang-doc-card{padding:32px 30px 28px;}
  .ang-doc-headline{font-size:28px;}
}
@media (max-width:820px){
  .ang-mobile-tabs{display:flex;}
  .ang-main{position:relative;}
  .ang-chat-panel{position:absolute;inset:0;width:100%;max-width:none;border-right:none;display:none;}
  .ang-chat-panel.mobile-active{display:flex;}
  .ang-workspace{position:absolute;inset:0;display:none;}
  .ang-workspace.mobile-active{display:flex;}
  .ang-ws-head{flex-wrap:wrap;gap:10px;padding:14px 20px;}
  .ang-ws-head-right{width:100%;justify-content:flex-start;flex-wrap:wrap;}
  .ang-toolbar{padding:8px 16px;overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;}
  .ang-toolbar::-webkit-scrollbar{height:4px;}
  .ang-tb-select{flex:0 0 auto;}
  .ang-ws-scroll{padding:24px 20px 50px;}
  .ang-doc-card{padding:28px 24px 24px;}
  .ang-doc-meta{flex-wrap:wrap;row-gap:4px;}
  .ang-drawer{width:100%;max-width:none;}
  .ang-source-card{flex-wrap:wrap;}
}
@media (max-width:600px){
  .ang-header{padding:0 14px;}
  .ang-header-right{gap:6px;}
  .ang-hbtn span{display:none;}
  .ang-hbtn{padding:0 10px;}
  .ang-chat-head{padding:14px 16px 12px;}
  .ang-msgscroller-viewport{padding:14px 16px;}
  .ang-suggest-row{padding:0 16px 8px;}
  .ang-suggest-chip{font-size:11.5px;padding:5px 10px;}
  .ang-chat-input-wrap{padding:0 16px 14px;}
  .ang-msg{max-width:94%;}
  .ang-clar-card{padding:10px 11px;}
  .ang-loading-msg{max-width:94%;}
  .ang-ws-loading{padding:28px 20px;margin-top:24px;}
  .ang-empty-state{margin-top:36px;max-width:100%;}
  .ang-empty-illo{width:60px;height:60px;}
  .ang-empty-illo svg{width:26px;height:26px;}
}
@media (max-width:480px){
  .ang-doc-card{padding:22px 16px 20px;}
  .ang-doc-headline{font-size:22px;}
  .ang-doc-category{font-size:10px;}
  .ang-doc-stamp{font-size:10px;padding:2px 7px;}
  .ang-ws-head{padding:12px 14px;}
  .ang-ws-head-left h2{font-size:14px;}
  .ang-ws-scroll{padding:18px 14px 36px;}
  .ang-status-badge{font-size:10px;padding:2px 6px;}
  .ang-wbtn{padding:0 10px;font-size:12px;height:32px;}
  .ang-wbtn span{display:inline;}
  .ang-source-card{padding:9px 10px;}
  .ang-source-name{font-size:12px;}
  .ang-drawer-body{padding:16px;}
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'AI Assistant', href: assistantRoutes.index() },
];

export default function NewsCreator({
    informationItems,
    generatedArticle,
    preselectedInformationIds = [],
}: Props) {
    // Chat / flow state
    const [inputValue, setInputValue] = useState('');
    const [instruction, setInstruction] = useState('');
    const [flowStarted, setFlowStarted] = useState(
        preselectedInformationIds.length > 0,
    );
    const [selectedInformation, setSelectedInformation] = useState<number[]>(
        preselectedInformationIds,
    );
    const [confirmed, setConfirmed] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [loadingStepIndex, setLoadingStepIndex] = useState(0);
    const [generated] = useState(Boolean(generatedArticle));
    const [version] = useState(1);
    const [status, setStatus] = useState<'draft' | 'saved'>('draft');

    // Editor state
    const [isEditing, setIsEditing] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const headlineRef = useRef<HTMLHeadingElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const savedHeadlineHTML = useRef('');
    const savedBodyHTML = useRef('');
    const imageInputRef = useRef<HTMLInputElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    //Thumbnail
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const savedThumbnail = useRef<string | null>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    // Sources / drawer
    const [sourcesOpen, setSourcesOpen] = useState(true);
    const [drawerSource, setDrawerSource] = useState<Source | null>(null);

    // Misc UI
    const [savedDropdownOpen, setSavedDropdownOpen] = useState(false);
    const [mobileTab, setMobileTab] = useState<MobileTab>('chat');

    // Close the "recent uploaded" dropdown on outside click
    useEffect(() => {
        if (!savedDropdownOpen) {
            return;
        }

        const handler = () => setSavedDropdownOpen(false);
        document.addEventListener('click', handler);

        return () => document.removeEventListener('click', handler);
    }, [savedDropdownOpen]);

    const allSelected = selectedInformation.length > 0;
    const sources: Source[] = (generatedArticle?.selected_sources ?? []).map(
        (source) => ({
            doc: source.document,
            page:
                source.evidence.map((evidence) => evidence.source).join(', ') ||
                'Extracted information',
            extract:
                source.evidence.map((evidence) => evidence.quote).join(' ') ||
                source.title,
        }),
    );

    function startFlow() {
        if (flowStarted) {
            return;
        }

        setFlowStarted(true);
    }

    function sendMessage(text: string) {
        const trimmed = text.trim();

        if (!trimmed) {
            return;
        }

        setInstruction(trimmed);
        setInputValue('');
        window.setTimeout(startFlow, 300);
    }

    function autoGrow(el: HTMLTextAreaElement) {
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 90)}px`;
    }

    function toggleInformation(id: number) {
        setSelectedInformation((current) =>
            current.includes(id)
                ? current.filter((value) => value !== id)
                : [...current, id],
        );
    }

    function confirmSelections() {
        if (!allSelected) {
            return;
        }

        setConfirmed(true);
        runGeneration();
    }

    function runGeneration() {
        setGenerating(true);
        setLoadingStepIndex(1);
        setThumbnail(null);
        router.post(
            '/admin/apakhabar-creator/generate',
            {
                information_ids: selectedInformation,
                prompt: instruction || null,
                tone: 'formal',
            },
            {
                preserveScroll: true,
                onFinish: () => setGenerating(false),
            },
        );
    }

    useEffect(() => {
        if (!generatedArticle) {
            return;
        }

        const articleSources = generatedArticle.selected_sources ?? [];
        const paragraphs = [generatedArticle.lead, ...generatedArticle.body];
        const html = paragraphs
            .map(
                (paragraph, index) =>
                    `<p>${escapeHtml(paragraph)}${articleSources[index] ? `<span class="ang-cite" data-source="${index}">${index + 1}</span>` : ''}</p>`,
            )
            .join('');

        if (bodyRef.current) {
            bodyRef.current.innerHTML = html;
        }

        if (headlineRef.current) {
            headlineRef.current.textContent = generatedArticle.headline;
        }
    }, [generatedArticle]);

    function handleBodyClick(e: React.MouseEvent<HTMLDivElement>) {
        const target = e.target as HTMLElement;
        const cite = target.closest('.ang-cite') as HTMLElement | null;

        if (!cite) {
            return;
        }

        const idx = Number(cite.getAttribute('data-source'));
        const source = sources[idx];

        if (source) {
            setDrawerSource(source);
        }
    }

    function enterEdit() {
        if (isEditing) {
            return;
        }

        savedHeadlineHTML.current = headlineRef.current?.innerHTML ?? '';
        savedBodyHTML.current = bodyRef.current?.innerHTML ?? '';
        savedThumbnail.current = thumbnail;
        setIsEditing(true);
        setIsDirty(false);
    }

    function cancelEdit() {
        if (headlineRef.current) {
            headlineRef.current.innerHTML = savedHeadlineHTML.current;
        }

        if (bodyRef.current) {
            bodyRef.current.innerHTML = savedBodyHTML.current;
        }

        setThumbnail(savedThumbnail.current);
        setIsEditing(false);
    }

    function saveEdit() {
        setIsDirty(false);
        setStatus('saved');
        setIsEditing(false);
    }

    function markDirty() {
        setIsDirty(true);
    }

    function execCmd(cmd: string, value?: string) {
        document.execCommand(cmd, false, value);
        bodyRef.current?.focus();
        markDirty();
    }

    function onImageSelected(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';

        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert('Please choose an image file.');

            return;
        }

        bodyRef.current?.focus();
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                document.execCommand('insertImage', false, reader.result);
                markDirty();
            }
        };
        reader.readAsDataURL(file);
    }

    function onThumbnailSelected(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';

        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert('Please choose an image file.');

            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setThumbnail(reader.result);
                markDirty();
            }
        };
        reader.readAsDataURL(file);
    }

    // TODO: wire this to your publish endpoint (e.g. router.post(creatorRoutes.publish(), {...}))
    function handlePublish() {
        setStatus('saved');
        setIsDirty(false);
    }

    function showMobile(which: MobileTab) {
        setMobileTab(which);
    }

    const wsBusy = generating;

    return (
        <>
            <Head title="Intelligent News Creator" />
            <div className="ang-app" ref={rootRef}>
                <style>{STYLES}</style>

                {/* HEADER */}
                <header className="ang-header">
                    <div className="ang-header-left">
                        <div className="ang-brand-icon">
                            <FileText size={18} strokeWidth={2} color="#fff" />
                        </div>
                        <div className="ang-brand-text">
                            <span className="ang-brand-name">
                                AI News Generator
                            </span>
                            <span className="ang-brand-sub">
                                AI-powered news authoring
                            </span>
                        </div>
                    </div>
                    <div
                        className="ang-header-right"
                        style={{ position: 'relative' }}
                    >
                        <button
                            className="ang-hbtn"
                            aria-label="Document Library"
                            title="Document Library"
                            onClick={() =>
                                router.visit(documentRoutes.index())
                            }
                        >
                            <Archive size={14} strokeWidth={2} />
                            <span>Document Library</span>
                        </button>
                        <button
                            className="ang-hbtn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSavedDropdownOpen((o) => !o);
                            }}
                        >
                            <History size={14} strokeWidth={2} />
                            <span>Recent uploaded</span>
                        </button>
                        {savedDropdownOpen && (
                            <div
                                className="ang-saved-dropdown"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="ang-saved-dropdown-head">
                                    Recently extracted information
                                </div>
                                {informationItems.slice(0, 5).map((item) => (
                                    <div
                                        className="ang-saved-dropdown-item"
                                        key={item.id}
                                    >
                                        <div className="t">{item.title}</div>
                                        <div className="m">
                                            {item.document.original_name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </header>

                {/* MOBILE TABS */}
                <div className="ang-mobile-tabs">
                    <button
                        className={`ang-mtab${mobileTab === 'chat' ? 'active' : ''}`}
                        onClick={() => showMobile('chat')}
                    >
                        AI Assistant
                    </button>
                    <button
                        className={`ang-mtab${mobileTab === 'preview' ? 'active' : ''}`}
                        onClick={() => showMobile('preview')}
                    >
                        News Preview
                    </button>
                </div>

                {/* MAIN */}
                <div className="ang-main">
                    {/* LEFT: CHAT */}
                    <section
                        className={`ang-chat-panel${mobileTab === 'chat' ? 'mobile-active' : ''}`}
                    >
                        <div className="ang-chat-head">
                            <h1>AI Assistant</h1>
                            <p>
                                Tell me what kind of news report you want to
                                create.
                            </p>
                            <span className="ang-ai-status">
                                <span className="pulse" />
                                AI ready
                            </span>
                        </div>

                        <div className="ang-msgscroller-wrap">
                            <MessageScrollerProvider
                                autoScroll
                                defaultScrollPosition="end"
                                scrollPreviousItemPeek={48}
                            >
                                <MessageScroller className="ang-msgscroller">
                                    <MessageScrollerViewport className="ang-msgscroller-viewport">
                                        <MessageScrollerContent className="ang-msgscroller-content">
                                            <MessageScrollerItem messageId="intro">
                                                <div className="ang-msg ai">
                                                    <div className="ang-msg-label">
                                                        AI Assistant
                                                    </div>
                                                    <div className="ang-msg-bubble">
                                                        Hi! I can help you
                                                        create a news report
                                                        from your uploaded
                                                        documents. What would
                                                        you like to create
                                                        today?
                                                    </div>
                                                </div>
                                            </MessageScrollerItem>

                                            {flowStarted && (
                                                <MessageScrollerItem messageId="clarify">
                                                    <div className="ang-msg ai">
                                                        <div className="ang-msg-label">
                                                            AI Assistant
                                                        </div>
                                                        <div className="ang-msg-bubble">
                                                            Pilih satu atau
                                                            beberapa informasi
                                                            hasil ekstraksi yang
                                                            akan menjadi sumber
                                                            faktual berita.
                                                        </div>
                                                        <div className="ang-clar-card">
                                                            <div className="ang-clar-title">
                                                                Informasi
                                                                tersedia
                                                            </div>

                                                            <div className="ang-clar-group">
                                                                <div className="ang-clar-group-label">
                                                                    Pilih sumber
                                                                    informasi
                                                                </div>
                                                                <div className="ang-chip-row">
                                                                    {informationItems.map(
                                                                        (
                                                                            item,
                                                                        ) => (
                                                                            <button
                                                                                key={
                                                                                    item.id
                                                                                }
                                                                                className={`ang-chip${selectedInformation.includes(item.id) ? 'selected' : ''}`}
                                                                                onClick={() =>
                                                                                    toggleInformation(
                                                                                        item.id,
                                                                                    )
                                                                                }
                                                                                title={`${item.document.original_name} — ${item.summary}`}
                                                                            >
                                                                                {
                                                                                    item.title
                                                                                }
                                                                            </button>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <button
                                                                className={`ang-clar-continue${allSelected ? 'ready' : ''}`}
                                                                onClick={
                                                                    confirmSelections
                                                                }
                                                                disabled={
                                                                    !allSelected
                                                                }
                                                            >
                                                                {allSelected
                                                                    ? `Generate from ${selectedInformation.length} item(s)`
                                                                    : 'Select at least one information item'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </MessageScrollerItem>
                                            )}

                                            {confirmed && (
                                                <MessageScrollerItem
                                                    messageId="user-confirm"
                                                    scrollAnchor
                                                >
                                                    <div className="ang-msg user">
                                                        <div className="ang-msg-bubble">
                                                            Gunakan{' '}
                                                            {
                                                                selectedInformation.length
                                                            }{' '}
                                                            informasi yang saya
                                                            pilih untuk membuat
                                                            berita berbahasa
                                                            Indonesia.
                                                        </div>
                                                    </div>
                                                </MessageScrollerItem>
                                            )}

                                            {confirmed && (
                                                <MessageScrollerItem messageId="ai-ack">
                                                    <div className="ang-msg ai">
                                                        <div className="ang-msg-label">
                                                            AI Assistant
                                                        </div>
                                                        <div className="ang-msg-bubble">
                                                            Baik. Saya akan
                                                            memeriksa
                                                            kelengkapan
                                                            informasi dan
                                                            membuat draf
                                                            berdasarkan sumber
                                                            yang dipilih.
                                                        </div>
                                                    </div>
                                                </MessageScrollerItem>
                                            )}

                                            {generating && (
                                                <MessageScrollerItem messageId="loading">
                                                    <div className="ang-loading-msg">
                                                        <div className="ang-loading-steps">
                                                            {LOADING_STEPS.map(
                                                                (text, i) => (
                                                                    <div
                                                                        key={
                                                                            text
                                                                        }
                                                                        className={`ang-loading-step${
                                                                            i <
                                                                            loadingStepIndex
                                                                                ? 'done'
                                                                                : i ===
                                                                                    loadingStepIndex
                                                                                  ? 'active'
                                                                                  : ''
                                                                        }`}
                                                                    >
                                                                        <span className="ang-step-marker">
                                                                            {i <
                                                                            loadingStepIndex
                                                                                ? '✓'
                                                                                : ''}
                                                                        </span>
                                                                        {text}
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                </MessageScrollerItem>
                                            )}

                                            {generated && !generating && (
                                                <MessageScrollerItem messageId="ai-draft-ready">
                                                    <div className="ang-msg ai">
                                                        <div className="ang-msg-label">
                                                            AI Assistant
                                                        </div>
                                                        <div className="ang-msg-bubble">
                                                            Here's your draft.
                                                            You can review it on
                                                            the right, edit it,
                                                            or ask me to change
                                                            something — I'll
                                                            update the preview
                                                            based on what you
                                                            tell me.
                                                        </div>
                                                    </div>
                                                </MessageScrollerItem>
                                            )}
                                        </MessageScrollerContent>
                                    </MessageScrollerViewport>
                                    <MessageScrollerButton className="ang-msgscroller-btn" />
                                </MessageScroller>
                            </MessageScrollerProvider>
                        </div>

                        <div className="ang-suggest-row">
                            {SUGGESTIONS.map((s) => (
                                <button
                                    key={s}
                                    className="ang-suggest-chip"
                                    onClick={() => sendMessage(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        <div className="ang-chat-input-wrap">
                            <div className="ang-chat-input">
                                <button
                                    className="ang-attach-btn"
                                    aria-label="Attach file"
                                    onClick={() =>
                                        router.visit(documentRoutes.index())
                                    }
                                >
                                    <Paperclip size={16} strokeWidth={2} />
                                </button>
                                <textarea
                                    rows={1}
                                    placeholder="Ask AI to create or modify a news article..."
                                    value={inputValue}
                                    onChange={(e) => {
                                        setInputValue(e.target.value);
                                        autoGrow(e.target);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage(inputValue);
                                        }
                                    }}
                                />
                                <button
                                    className="ang-send-btn"
                                    aria-label="Send message"
                                    onClick={() => sendMessage(inputValue)}
                                >
                                    <Send size={14} strokeWidth={2.2} />
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* RIGHT: WORKSPACE */}
                    <section
                        className={`ang-workspace${mobileTab === 'preview' ? 'mobile-active' : ''}`}
                    >
                        <div className="ang-ws-head">
                            <div className="ang-ws-head-left">
                                <h2>News preview</h2>
                                <div className="sub">
                                    {generated ? (
                                        <>
                                            <span
                                                className={`ang-status-badge ${status}`}
                                            >
                                                {status === 'saved'
                                                    ? 'Published'
                                                    : 'Draft'}
                                            </span>
                                            <span>
                                                Last generated: just now
                                            </span>
                                            <span className="sep" />
                                            <span>Version {version}</span>
                                        </>
                                    ) : (
                                        <span>
                                            Start a conversation to generate a
                                            draft
                                        </span>
                                    )}
                                </div>
                            </div>
                            {generated && (
                                <div className="ang-ws-head-right">
                                    {isDirty && (
                                        <span className="ang-unsaved-flag">
                                            Unsaved changes
                                        </span>
                                    )}
                                    <button
                                        className="ang-wbtn"
                                        onClick={enterEdit}
                                    >
                                        <Pencil size={14} strokeWidth={2} />
                                        <span>
                                            {isEditing ? 'Editing...' : 'Edit'}
                                        </span>
                                    </button>
                                    <button
                                        className="ang-wbtn primary"
                                        onClick={handlePublish}
                                    >
                                        <Rocket size={14} strokeWidth={2} />
                                        <span>Publish</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {isEditing && (
                            <div className="ang-toolbar">
                                <select
                                    className="ang-tb-select"
                                    style={{ width: 112 }}
                                    onChange={(e) =>
                                        execCmd('fontName', e.target.value)
                                    }
                                >
                                    <option value="'Source Serif 4',serif">
                                        Source Serif
                                    </option>
                                    <option value="Georgia,serif">
                                        Georgia
                                    </option>
                                    <option value="Arial,sans-serif">
                                        Arial
                                    </option>
                                    <option value="'Courier New',monospace">
                                        Courier New
                                    </option>
                                </select>
                                <select
                                    className="ang-tb-select"
                                    style={{ width: 64 }}
                                    defaultValue="3"
                                    onChange={(e) =>
                                        execCmd('fontSize', e.target.value)
                                    }
                                >
                                    <option value="2">13</option>
                                    <option value="3">16</option>
                                    <option value="4">18</option>
                                    <option value="5">22</option>
                                    <option value="6">28</option>
                                </select>
                                <div className="ang-tb-divider" />
                                <button
                                    className="ang-tb-btn"
                                    title="Bold"
                                    onClick={() => execCmd('bold')}
                                >
                                    <Bold size={14} strokeWidth={2} />
                                </button>
                                <button
                                    className="ang-tb-btn"
                                    title="Italic"
                                    onClick={() => execCmd('italic')}
                                >
                                    <Italic size={14} strokeWidth={2} />
                                </button>
                                <button
                                    className="ang-tb-btn"
                                    title="Underline"
                                    onClick={() => execCmd('underline')}
                                >
                                    <Underline size={14} strokeWidth={2} />
                                </button>
                                <div className="ang-tb-divider" />
                                <button
                                    className="ang-tb-btn"
                                    title="Align left"
                                    onClick={() => execCmd('justifyLeft')}
                                >
                                    <AlignLeft size={14} strokeWidth={2} />
                                </button>
                                <button
                                    className="ang-tb-btn"
                                    title="Align center"
                                    onClick={() => execCmd('justifyCenter')}
                                >
                                    <AlignCenter size={14} strokeWidth={2} />
                                </button>
                                <button
                                    className="ang-tb-btn"
                                    title="Align right"
                                    onClick={() => execCmd('justifyRight')}
                                >
                                    <AlignRight size={14} strokeWidth={2} />
                                </button>
                                <div className="ang-tb-divider" />
                                <button
                                    className="ang-tb-btn"
                                    title="Bullet list"
                                    onClick={() =>
                                        execCmd('insertUnorderedList')
                                    }
                                >
                                    <List size={14} strokeWidth={2} />
                                </button>
                                <button
                                    className="ang-tb-btn"
                                    title="Numbered list"
                                    onClick={() => execCmd('insertOrderedList')}
                                >
                                    <ListOrdered size={14} strokeWidth={2} />
                                </button>
                                <div className="ang-tb-divider" />
                                <button
                                    className="ang-tb-btn"
                                    title="Insert image"
                                    onClick={() =>
                                        imageInputRef.current?.click()
                                    }
                                >
                                    <ImagePlus size={14} strokeWidth={2} />
                                </button>
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={onImageSelected}
                                />
                                <div className="ang-tb-divider" />
                                <div
                                    className="ang-tb-color"
                                    title="Text color"
                                >
                                    <input
                                        type="color"
                                        defaultValue="#1a2233"
                                        onChange={(e) =>
                                            execCmd('foreColor', e.target.value)
                                        }
                                    />
                                </div>
                                <div className="ang-tb-color" title="Highlight">
                                    <input
                                        type="color"
                                        defaultValue="#fdf1c7"
                                        onChange={(e) =>
                                            execCmd(
                                                'hiliteColor',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="ang-tb-divider" />
                                <button
                                    className="ang-tb-btn"
                                    title="Undo"
                                    onClick={() => execCmd('undo')}
                                >
                                    <Undo2 size={14} strokeWidth={2} />
                                </button>
                                <button
                                    className="ang-tb-btn"
                                    title="Redo"
                                    onClick={() => execCmd('redo')}
                                >
                                    <Redo2 size={14} strokeWidth={2} />
                                </button>
                                <div style={{ flex: 1 }} />
                                <button
                                    className="ang-wbtn"
                                    onClick={cancelEdit}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="ang-wbtn primary"
                                    onClick={saveEdit}
                                >
                                    Save changes
                                </button>
                            </div>
                        )}

                        <div className="ang-ws-scroll">
                            {!generated && !wsBusy && (
                                <div className="ang-empty-state">
                                    <div className="ang-empty-illo">
                                        <FileText size={34} strokeWidth={1.6} />
                                    </div>
                                    <h3>Your news article will appear here</h3>
                                    <p>
                                        Start by telling the AI what kind of
                                        news report you want to create.
                                    </p>
                                    <div className="ang-empty-examples">
                                        {EMPTY_EXAMPLES.map((ex) => (
                                            <button
                                                key={ex}
                                                className="ang-empty-example"
                                                onClick={() => {
                                                    showMobile('chat');
                                                    sendMessage(ex);
                                                }}
                                            >
                                                <ChevronRight
                                                    size={13}
                                                    strokeWidth={2}
                                                />
                                                {ex}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {wsBusy && (
                                <div className="ang-ws-loading">
                                    <div className="ang-ws-loading-spin" />
                                    <p>{LOADING_STEPS[loadingStepIndex]}</p>
                                </div>
                            )}

                            <div
                                className="ang-doc-card"
                                style={{
                                    display:
                                        generated && !wsBusy ? 'block' : 'none',
                                }}
                            >
                                <span className="ang-doc-stamp">AI draft</span>
                                {(thumbnail || isEditing) && (
                                    <div className="ang-thumb-wrap">
                                        {thumbnail ? (
                                            <img
                                                src={thumbnail}
                                                alt="Thumbnail"
                                                className="ang-thumb-img"
                                            />
                                        ) : (
                                            <button
                                                type="button"
                                                className="ang-thumb-empty"
                                                onClick={() =>
                                                    thumbnailInputRef.current?.click()
                                                }
                                            >
                                                <ImagePlus
                                                    size={20}
                                                    strokeWidth={1.8}
                                                />
                                                <span>Add thumbnail</span>
                                            </button>
                                        )}
                                        {isEditing && thumbnail && (
                                            <div className="ang-thumb-actions">
                                                <button
                                                    type="button"
                                                    className="ang-thumb-btn"
                                                    onClick={() =>
                                                        thumbnailInputRef.current?.click()
                                                    }
                                                >
                                                    Change
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ang-thumb-btn danger"
                                                    onClick={() => {
                                                        setThumbnail(null);
                                                        markDirty();
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                        <input
                                            ref={thumbnailInputRef}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={onThumbnailSelected}
                                        />
                                    </div>
                                )}
                                <div className="ang-doc-category">
                                    FLOOD REPORT
                                </div>
                                <h2
                                    className="ang-doc-headline"
                                    ref={headlineRef}
                                    contentEditable={isEditing}
                                    suppressContentEditableWarning
                                    spellCheck={false}
                                    onInput={markDirty}
                                >
                                    Flood Situation in Penang: 2025 Overview
                                </h2>
                                <div className="ang-doc-meta">
                                    <span>
                                        Bahasa Indonesia ·{' '}
                                        {generatedArticle?.labels.join(', ') ||
                                            'Berita'}
                                    </span>
                                    <span className="sep" />
                                    <span>Generated by AI News Generator</span>
                                </div>
                                <div className="ang-doc-divider" />
                                <div
                                    className="ang-doc-body"
                                    ref={bodyRef}
                                    contentEditable={isEditing}
                                    suppressContentEditableWarning
                                    spellCheck={false}
                                    onInput={markDirty}
                                    onClick={handleBodyClick}
                                />

                                <div className="ang-sources-section">
                                    <button
                                        className="ang-sources-toggle"
                                        onClick={() =>
                                            setSourcesOpen((o) => !o)
                                        }
                                    >
                                        <h4>Sources used ({sources.length})</h4>
                                        <ChevronDown
                                            size={14}
                                            strokeWidth={2}
                                            className={`chev${sourcesOpen ? 'open' : ''}`}
                                        />
                                    </button>
                                    {sourcesOpen && (
                                        <div className="ang-sources-list">
                                            {sources.map((s) => (
                                                <button
                                                    key={s.doc}
                                                    className="ang-source-card"
                                                    onClick={() =>
                                                        setDrawerSource(s)
                                                    }
                                                >
                                                    <div className="ang-source-icon">
                                                        <FileText
                                                            size={15}
                                                            strokeWidth={2}
                                                        />
                                                    </div>
                                                    <div className="ang-source-info">
                                                        <div className="ang-source-name">
                                                            {s.doc}
                                                        </div>
                                                        <div className="ang-source-page">
                                                            {s.page}
                                                        </div>
                                                    </div>
                                                    <ChevronRight
                                                        size={14}
                                                        strokeWidth={2}
                                                        className="ang-source-arrow"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* SOURCES DRAWER */}
                {drawerSource && (
                    <div
                        className="ang-drawer-overlay"
                        onClick={() => setDrawerSource(null)}
                    >
                        <div
                            className="ang-drawer"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="ang-drawer-head">
                                <h3>Source detail</h3>
                                <button
                                    className="ang-drawer-close"
                                    aria-label="Close"
                                    onClick={() => setDrawerSource(null)}
                                >
                                    <X size={16} strokeWidth={2} />
                                </button>
                            </div>
                            <div className="ang-drawer-body">
                                <div className="ang-drawer-doc-icon">
                                    <FileText size={20} strokeWidth={2} />
                                </div>
                                <h4>{drawerSource.doc}</h4>
                                <div className="page">{drawerSource.page}</div>
                                <div className="ang-drawer-extract-label">
                                    Relevant extract
                                </div>
                                <div className="ang-drawer-extract">
                                    {drawerSource.extract}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
NewsCreator.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);
