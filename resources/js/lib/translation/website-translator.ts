import { apiFetch } from '@/lib/api';
import { uiTranslation } from './dictionary';
import type { WebsiteLanguage } from './dictionary';

type Entry = {
    node: Text | Element;
    attribute?: string;
    source: string;
    sourceLanguage: string;
    rendered: string;
};
const excluded =
    'script,style,noscript,textarea,pre,code,kbd,[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate,[data-no-translate],[data-slot="avatar"]';
const attributes = ['placeholder', 'title', 'aria-label', 'alt'];
// Reuse successful results across language switches; never persist page content.
const pageTranslations = new Map<string, string>();

// Only text-node data and descriptive attributes are changed. React-owned
// elements, form values, links and event handlers are never replaced.
export function translateWebsite(
    language: WebsiteLanguage,
    status: (state: 'working' | 'ready' | 'error') => void,
) {
    let stopped = false;
    let working = false;
    const failures = new Set<string>();
    let dirty = false;
    let timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    const entries = new Map<Node, Map<string, Entry>>();
    const cache = pageTranslations;
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

        const declared = parent.closest(
            '[lang]:not(html),[data-translation-source]',
        );
        const hint =
            declared?.getAttribute('data-translation-source') ??
            declared?.getAttribute('lang');
        const sourceLanguage =
            hint && ['en', 'id'].includes(hint) ? hint : 'auto';
        const key = attribute ?? 'text';
        const group = entries.get(node) ?? new Map<string, Entry>();
        const entry = group.get(key);

        if (!entry) {
            group.set(key, {
                node,
                attribute,
                source: value,
                sourceLanguage,
                rendered: value,
            });
        } else if (value !== entry.rendered) {
            entry.source = value;
            entry.sourceLanguage = sourceLanguage;
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
        // Keep line breaks outside inference so paragraph formatting survives.
        return text.split(/(\s*\n\s*)/u).flatMap((line) => {
            if (!line.trim()) return [line];
            const chunks: string[] = [];
            let characters = Array.from(line);
            while (characters.length > 700) {
                let cut = characters.slice(0, 701).lastIndexOf(' ');
                if (cut < 350) cut = 700;
                chunks.push(characters.slice(0, cut).join(''));
                characters = characters.slice(cut);
            }
            if (characters.length) chunks.push(characters.join(''));
            return chunks;
        });
    }
    const cacheKey = (part: string, entry: Entry) =>
        JSON.stringify([entry.sourceLanguage, part, language]);
    function apply(entry: Entry) {
        if (entry.sourceLanguage === language) return;
        const source = entry.source.trim();
        const translated =
            uiTranslation(source, language) ??
            (parts(source).every(
                (part) => !part.trim() || cache.has(cacheKey(part, entry)),
            )
                ? parts(source)
                      .map((part) => {
                          if (!part.trim()) return part;
                          const translated = cache.get(cacheKey(part, entry))!;
                          return (
                              (part.match(/^\s*/u)?.[0] ?? '') +
                              translated.trim() +
                              (part.match(/\s*$/u)?.[0] ?? '')
                          );
                      })
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
                    entry.sourceLanguage !== language &&
                    uiTranslation(entry.source.trim(), language) === undefined
                        ? parts(entry.source.trim())
                              .filter(
                                  (part) =>
                                      !!part.trim() &&
                                      !cache.has(cacheKey(part, entry)),
                              )
                              .map((part) => cacheKey(part, entry))
                        : [],
                ),
            ),
        ];
        const pending = new Set(missing);
        for (const key of failures) {
            if (!pending.has(key)) failures.delete(key);
        }

        if (missing.some((part) => !failures.has(part))) {
            status('working');

            try {
                while (missing.length && !stopped) {
                    const batch: string[] = [];
                    let size = 0;
                    const source = JSON.parse(missing[0])[0];

                    while (
                        missing.length &&
                        batch.length < 4 &&
                        size + JSON.parse(missing[0])[1].length <= 1400 &&
                        JSON.parse(missing[0])[0] === source
                    ) {
                        const item = missing.shift()!;
                        if (failures.has(item)) continue;
                        batch.push(item);
                        size += JSON.parse(item)[1].length;
                    }

                    if (!batch.length) continue;
                    let response: Response | undefined;
                    try {
                        response = await apiFetch('/website/translate', {
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
                                texts: batch.map((key) => JSON.parse(key)[1]),
                                source,
                                target: language,
                            }),
                        });
                    } catch {
                        if (stopped) return;
                    }
                    if (!response?.ok) {
                        batch.forEach((part) => failures.add(part));
                        // An unavailable service/session will fail every subsequent
                        // batch too. Keep originals and avoid an outage request storm.
                        missing.forEach((part) => failures.add(part));
                        missing.length = 0;
                        break;
                    }

                    let body;
                    try {
                        body = await response.json();
                    } catch {
                        batch.forEach((part) => failures.add(part));
                        continue;
                    }

                    if (
                        !Array.isArray(body.translations) ||
                        body.translations.length !== batch.length ||
                        body.translations.some(
                            (text: unknown) =>
                                typeof text !== 'string' || !text.trim(),
                        )
                    ) {
                        batch.forEach((part) => failures.add(part));
                        continue;
                    }

                    if (stopped) {
                        return;
                    }

                    batch.forEach((text, index) =>
                        cache.set(text, body.translations[index]),
                    );
                    while (cache.size > 2000) {
                        cache.delete(cache.keys().next().value!);
                    }
                    snapshot
                        .filter((entry) => entry.node.isConnected)
                        .forEach(apply);
                }

                if (!stopped) {
                    status(failures.size ? 'error' : 'ready');
                }
            } catch {
                if (!stopped) {
                    missing.forEach((part) => failures.add(part));
                    status('error');
                }
            }
        } else {
            status(failures.size ? 'error' : 'ready');
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
