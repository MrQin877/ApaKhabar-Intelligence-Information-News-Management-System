import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
    new URL('../../resources/js/lib/assistant-turns.ts', import.meta.url),
    'utf8',
);
const module = { exports: {} };
vm.runInNewContext(
    ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports: module.exports },
);
const { assistantTurnAnchors } = module.exports;

test('second upload retains the first draft position and gets its own progress anchor', () => {
    const messages = [
        {
            id: 1,
            intent: 'document_processing',
            payload: { document_ids: [10] },
        },
        {
            id: 2,
            intent: 'generate_news',
            payload: { article: { headline: 'First draft' } },
        },
        {
            id: 3,
            intent: 'extract_information',
            payload: { document_ids: [20] },
        },
        {
            id: 4,
            intent: 'document_processing',
            payload: { document_ids: [20] },
        },
    ];
    const anchors = assistantTurnAnchors(messages);
    assert.equal(anchors.draftMessageId, 2);
    assert.equal(anchors.extractionMessageId, 4);
    assert.deepEqual(
        messages.map((message) => message.id),
        [1, 2, 3, 4],
    );
});

test('new draft moves the current draft card to its response and survives reload', () => {
    const messages = [
        { id: 2, payload: { article: {} } },
        { id: 4, intent: 'document_processing' },
        { id: 5, payload: { article: { headline: 'Revised' } } },
    ];
    assert.equal(
        assistantTurnAnchors(JSON.parse(JSON.stringify(messages)))
            .draftMessageId,
        5,
    );
    assert.equal(assistantTurnAnchors([]).draftMessageId, undefined);
});
