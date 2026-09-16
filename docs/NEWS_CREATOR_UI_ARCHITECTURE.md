# Intelligent News Creator UI Architecture

## Component breakdown

- `NewsCreatorAgent`: page-level coordinator for the split workspace and server requests.
- `ChatPanel`: conversation history, suggestions, source picker, attachments, and persistent composer.
- `QuestionCard`: renders all material clarification fields together as selectable chips and submits one clarification round.
- `ProgressIndicator`: shows the active generation stage, elapsed time, progress, and an optional expanded step list.
- `DocumentPreview`: read-first rendering of the current AI draft, metadata, labels, citations, and review state.
- `EditorToolbar`: contextual formatting actions shown only in edit mode.
- `SourcesPanel`: collapsible document cards with page/source references and evidence excerpts.
- `PublishConfirmation`: explicit moderator confirmation before publication.

The first implementation keeps these concepts in `chat.tsx` so the behavior can be validated without changing page routing. They can later be extracted into files under `components/news-creator/` without changing the state contract.

## State structure

| State                                              | Owner              | Purpose                                           |
| -------------------------------------------------- | ------------------ | ------------------------------------------------- |
| `prompt`, `files`, `informationIds`, `documentIds` | Chat page          | Inputs and moderator-approved sources             |
| `answers`                                          | Question card      | All selections for the single clarification round |
| `busy`, `elapsedSeconds`, `activeStage`            | Progress indicator | Visible generation lifecycle                      |
| `editedArticle`                                    | Document preview   | Working copy of the current draft                 |
| `editMode`                                         | Document preview   | Switches read view and editor toolbar             |
| `sourcesOpen`                                      | Sources panel      | Controls evidence disclosure                      |
| `version`, `reviewed_at`                           | Database draft     | Persistent version and human-review gate          |

## Request lifecycle

```text
Prompt/source selection
        |
        v
Completeness check ---- clear ----> Generate draft
        |
        | material ambiguity
        v
One combined QuestionCard
        |
        | submit once; clarification_rounds = 1
        v
Generate with conservative defaults
        |
        v
Preview -> Edit -> Save (new version, review cleared)
        |
        v
Moderator marks reviewed -> Publish confirmation -> Publish
```

The server rejects publication when `reviewed_at` is empty. Saving an edit increments `version` and clears `reviewed_at`, ensuring that the current version must be reviewed again. AI content is never published automatically.
