import { apiFetch } from '@/lib/api';
import { uiTranslation } from './dictionary';
import type { WebsiteLanguage } from './dictionary';

type Entry = {
    node: Text | Element;
    attribute?: string;
    source: string;
    rendered: string;
};
const excluded =
    'script,style,noscript,textarea,pre,code,kbd,[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate,[data-no-translate],[data-slot="avatar"]';
const attributes = ['placeholder', 'title', 'aria-label', 'alt'];

// Only text-node data and descriptive attributes are changed. React-owned
// elements, form values, links and event handlers are never replaced.
export function translateWebsite(
    language: WebsiteLanguage,
    status: (state: 'working' | 'ready' | 'error') => void,
) {
    let stopped = false;
    let working = false;
    let failed = false;
    let dirty = false;
    let timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    const entries = new Map<Node, Map<string, Entry>>();
    const cache = new Map<string, string>();
    const read = (entry: Entry) =>
        entry.attribute
            ? ((entry.node as Element).getAttribute(entry.attribute) ?? '')
            : (entry.node.textContent ?? '');
    const write = (entry: Entry, value: string) => {
        entry.rendered = value;

        if (entry.attribute) {
            (entry.node as Element).setAttribute(entry.attribute, value);
        } else {
            entry.node.textContent = value;
        }
    };
    function track(node: Text | Element, attribute?: string) {
        const parent = node instanceof Element ? node : node.parentElement;

        if (!parent || parent.closest(excluded)) {
            return;
        }

        const value = attribute
            ? ((node as Element).getAttribute(attribute) ?? '')
            : (node.textContent ?? '');

        if (
            !/[\p{L}]/u.test(value) ||
            /^(https?:\/\/|\S+@\S+\.\S+$)/.test(value.trim()) ||
            /^(ApaKhabar|WhatsApp|SMS)$/i.test(value.trim())
        ) {
            return;
        }

        const key = attribute ?? 'text';
        const group = entries.get(node) ?? new Map<string, Entry>();
        const entry = group.get(key);

        if (!entry) {
            group.set(key, { node, attribute, source: value, rendered: value });
        } else if (value !== entry.rendered) {
            entry.source = value;
            entry.rendered = value;
        }

        entries.set(node, group);
    }
    function collect() {
        for (const node of entries.keys()) {
            if (!node.isConnected) {
                entries.delete(node);
            }
        }

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
        );
        let node: Node | null;

        while ((node = walker.nextNode())) {
            track(node as Text);
        }

        document.body
            .querySelectorAll('[placeholder],[title],[aria-label],[alt]')
            .forEach((element) => {
                for (const attr of attributes) {
                    if (element.hasAttribute(attr)) {
                        track(element, attr);
                    }
                }
            });
    }
    function parts(text: string): string[] {
        const chunks: string[] = [];

        while (text.length > 2500) {
            let cut = text.lastIndexOf(' ', 2500);

            if (cut < 1250) {
                cut = 2500;
            }

            chunks.push(text.slice(0, cut));
            text = text.slice(cut);
        }

        if (text) {
            chunks.push(text);
        }

        return chunks;
    }
    function apply(entry: Entry) {
        const source = entry.source.trim();
        const translated =
            uiTranslation(source, language) ??
            (parts(source).every((part) => cache.has(part))
                ? parts(source)
                      .map((part) => cache.get(part))
                      .join('')
                : undefined);

        if (translated !== undefined && read(entry) === entry.rendered) {
            const result = entry.source.replace(source, () => translated);

            if (result !== entry.rendered) {
                write(entry, result);
            }
        }
    }
    async function run() {
        if (stopped || working) {
            return;
        }

        working = true;
        dirty = false;
        collect();
        const snapshot = [...entries.values()].flatMap((group) => [
            ...group.values(),
        ]);
        snapshot.forEach(apply);
        const missing = [
            ...new Set(
                snapshot.flatMap((entry) =>
                    uiTranslation(entry.source.trim(), language) === undefined
                        ? parts(entry.source.trim()).filter(
                              (part) => !cache.has(part),
                          )
                        : [],
                ),
            ),
        ];

        if (!failed && missing.length) {
            status('working');

            try {
                while (missing.length && !stopped) {
                    const batch: string[] = [];
                    let size = 0;

                    while (
                        missing.length &&
                        batch.length < 20 &&
                        size + missing[0].length <= 10000
                    ) {
                        const item = missing.shift()!;
                        batch.push(item);
                        size += item.length;
                    }

                    const response = await apiFetch('/website/translate', {
                        method: 'POST',
                        credentials: 'same-origin',
                        signal: abort.signal,
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-CSRF-TOKEN':
                                document.querySelector<HTMLMetaElement>(
                                    'meta[name="csrf-token"]',
                                )?.content ?? '',
                        },
                        body: JSON.stringify({
                            texts: batch,
                            target: language,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error('Translation unavailable');
                    }

                    const body = await response.json();

                    if (
                        !Array.isArray(body.translations) ||
                        body.translations.length !== batch.length ||
                        body.translations.some(
                            (text: unknown) => typeof text !== 'string',
                        )
                    ) {
                        throw new Error('Invalid response');
                    }

                    if (stopped) {
                        return;
                    }

                    batch.forEach((text, index) =>
                        cache.set(text, body.translations[index]),
                    );
                    snapshot
                        .filter((entry) => entry.node.isConnected)
                        .forEach(apply);
                }

                if (!stopped) {
                    status('ready');
                }
            } catch {
                if (!stopped) {
                    failed = true;
                    status('error');
                }
            }
        } else if (!failed) {
            status('ready');
        }

        working = false;

        if (dirty && !stopped) {
            schedule();
        }
    }
    const schedule = () => {
        dirty = true;
        clearTimeout(timer);
        timer = setTimeout(() => {
            void run();
        }, 180);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: attributes,
    });
    schedule();

    return () => {
        stopped = true;
        abort.abort();
        clearTimeout(timer);
        observer.disconnect();

        for (const group of entries.values()) {
            for (const entry of group.values()) {
                if (entry.node.isConnected && read(entry) === entry.rendered) {
                    write(entry, entry.source);
                }
            }
        }
    };
}
