# AI Assistant and editorial UI architecture

See [system architecture](system-architecture.md) for backend boundaries and [repository map](repository-map.md) for related modules.

## Screens and components

`resources/js/pages/admin/intelligentnewscreator/chat.tsx` coordinates the assistant. `documents.tsx` owns the independent library; `index.tsx` is the news workspace and `editor.tsx` is the manual editor.

Shared components in `resources/js/components/intelligent-news/` include:

| Component | Responsibility |
| --- | --- |
| `source-picker.tsx` | Unified document/information selection |
| `information-attachments.tsx` | Attached-source disclosure |
| `session-panel.tsx` | Conversation/session navigation |
| `chat-message.tsx` | Conversation message rendering |
| `agent-work-trace.tsx` | Visible operational stages |
| `document-processing-status.tsx` | Extraction progress/status |
| `extracted-information-review.tsx` | Extracted-fact review |
| `quality-score.tsx` | Evaluation score/details |
| `category-proposal.tsx` | Proposed-category decisions |
| `preview-frame.tsx` | Draft preview container, including mobile overlay |

`publish-news-dialog.tsx` and `publish-result-dialog.tsx` are shared publishing components. `news-rich-editor.tsx` supports the manual editor; do not confuse it with the AI draft's continuous-content editing interface.

## User flow

Users can upload sources, select existing sources, or write facts directly in the chat. The source menu combines documents and information; a separate manual-facts menu is unnecessary. Attached information can be collapsed, with a count. Document selection is tied to related information eligibility; selecting a document does not bypass source approval.

Conversation/analysis and extraction can finish without creating news. An explicit draft request starts queued generation. Material clarification is collected together, then the workflow continues within its clarification limit. Progress reports application stages rather than private chain-of-thought.

A generated card offers Preview and Edit. Both open the preview panel; Edit enters editing mode. On mobile the panel overlays the assistant. The draft is shown as title plus continuous content with word count, rather than separate lead/subheadline sections. Python's structured fields are adapted at the integration boundary.

Publication is offered inside the preview. The shared confirmation dialog selects channels and confirms review of the current version. Saving edits increments the version and clears old review state. The server rejects stale review confirmation and blocking quality findings. A separate mandatory “approve draft” card action is not required; the compatibility review endpoint still exists.

## State and persistence

Composer input, selected sources, preview mode, and unsaved edits are frontend state. Conversations, messages, selected-source context, drafts, versions, evaluation records, and run events are persisted by Laravel. Session navigation allows users to reopen prior work; publishing is part of conversation lifecycle handling rather than an instruction to automatically continue chatting.

Async submission returns a request ID for polling. Ownership-checked Laravel endpoints proxy progress and expose final saved results. A loading indicator is not evidence that the model is still running: terminal status comes from server records. Mobile drawers should close on navigation, and document controls adapt to smaller screens.

## Document preview

`NewsCreatorController.previewDocument()` serves supported direct previews or asks the AI Service to normalize office/spreadsheet files for a readable preview. This is a content preview, not a full Microsoft Office layout renderer. Failed conversion provides a download path. Preview access is checked server-side, independently of the visible library controls.

The latest draft card is anchored to its generating assistant message rather than appended after every subsequent upload. Extraction progress uses the matching upload response's document IDs, not all documents attached to the conversation. `tests/js/assistant-turns.test.mjs` covers second-upload anchoring and reconstruction after reload. Automatically retrieved context appears in expandable source details; the draft preview identifies the 250-word generated-content limit.
