import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    Grip,
    Italic,
    List,
    ListOrdered,
    Quote,
    Underline,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { richTextLength } from '@/lib/rich-text';

const tools = [
    { command: 'bold', label: 'Tebal', icon: Bold },
    { command: 'italic', label: 'Miring', icon: Italic },
    { command: 'underline', label: 'Garis bawah', icon: Underline },
    { command: 'insertUnorderedList', label: 'Daftar berpoin', icon: List },
    {
        command: 'insertOrderedList',
        label: 'Daftar bernomor',
        icon: ListOrdered,
    },
    {
        command: 'formatBlock',
        value: 'blockquote',
        label: 'Kutipan',
        icon: Quote,
    },
    { command: 'justifyLeft', label: 'Rata kiri', icon: AlignLeft },
    { command: 'justifyCenter', label: 'Rata tengah', icon: AlignCenter },
    { command: 'justifyRight', label: 'Rata kanan', icon: AlignRight },
];

export function NewsRichEditor({
    value,
    onChange,
    invalid,
    disabled,
    characterCount,
    id = 'content',
    label = 'Isi berita',
    placeholder = 'Mulai tulis cerita Anda di sini...',
    maxLength,
    required = true,
}: {
    value: string;
    onChange: (html: string) => void;
    invalid: boolean;
    disabled: boolean;
    characterCount: number;
    id?: string;
    label?: string;
    placeholder?: string;
    maxLength?: number;
    required?: boolean;
}) {
    const editor = useRef<HTMLDivElement>(null);
    const selection = useRef<Range | null>(null);
    const [active, setActive] = useState<string[]>([]);

    useEffect(() => {
        if (editor.current && editor.current.innerHTML !== value) {
            editor.current.innerHTML = value;
        }
    }, [value]);

    function rememberSelection() {
        const current = window.getSelection();

        if (
            current?.rangeCount &&
            editor.current?.contains(current.anchorNode)
        ) {
            selection.current = current.getRangeAt(0).cloneRange();
            setActive(
                tools
                    .filter(
                        (tool) =>
                            tool.command !== 'formatBlock' &&
                            document.queryCommandState(tool.command),
                    )
                    .map((tool) => tool.command),
            );
        }
    }

    function command(name: string, argument?: string) {
        editor.current?.focus();

        if (selection.current) {
            const current = window.getSelection();
            current?.removeAllRanges();
            current?.addRange(selection.current);
        }

        // Match the existing news editor's native editing/undo behavior.
        const value =
            name === 'formatBlock' &&
            document.queryCommandValue('formatBlock') === 'blockquote'
                ? 'p'
                : argument;
        if (name === 'insertText' && maxLength !== undefined) {
            const current = window.getSelection();
            const selected = editor.current?.contains(
                current?.anchorNode ?? null,
            )
                ? Array.from(current?.toString() ?? '').length
                : 0;
            const remaining =
                maxLength -
                richTextLength(editor.current?.innerHTML ?? '') +
                selected;
            if (remaining <= 0) return;
            document.execCommand(
                name,
                false,
                Array.from(value ?? '')
                    .slice(0, remaining)
                    .join(''),
            );
        } else {
            document.execCommand(name, false, value);
        }
        const html = editor.current?.innerHTML ?? '';
        if (maxLength === undefined || richTextLength(html) <= maxLength) {
            onChange(html);
        }
        rememberSelection();
    }

    return (
        <div
            className={`overflow-hidden rounded-xl border bg-background focus-within:ring-2 focus-within:ring-ring/30 ${invalid ? 'border-destructive' : 'border-input'}`}
        >
            <div
                role="group"
                aria-label={`Format ${label.toLowerCase()}`}
                className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-3 py-2"
            >
                {tools.map(
                    (
                        { command: name, label, icon: Icon, value: argument },
                        index,
                    ) => (
                        <span
                            key={label}
                            className={
                                index === 3 || index === 6
                                    ? 'ml-1 border-l pl-2'
                                    : ''
                            }
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                title={label}
                                aria-label={label}
                                aria-pressed={active.includes(name)}
                                disabled={disabled}
                                className="rounded-md aria-pressed:bg-accent aria-pressed:text-accent-foreground"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => command(name, argument)}
                            >
                                <Icon className="size-4" />
                            </Button>
                        </span>
                    ),
                )}
                <span className="ml-auto shrink-0 pl-3 text-xs whitespace-nowrap text-muted-foreground">
                    Minimal 20 karakter
                </span>
            </div>
            <div className="relative flex h-72 min-h-40 resize-y flex-col overflow-auto sm:h-80">
                <div
                    ref={editor}
                    id={id}
                    role="textbox"
                    aria-label={label}
                    aria-multiline="true"
                    aria-required={required}
                    aria-invalid={invalid}
                    aria-describedby={`${id}-error`}
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    data-placeholder={placeholder}
                    className="min-h-0 flex-1 overflow-y-auto px-4 py-5 text-sm leading-7 break-words outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] sm:px-5 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
                    onInput={() => {
                        const html = editor.current?.innerHTML ?? '';
                        if (
                            maxLength !== undefined &&
                            richTextLength(html) > maxLength
                        ) {
                            editor.current!.innerHTML = value;
                            return;
                        }
                        onChange(html);
                        rememberSelection();
                    }}
                    onBeforeInput={(event) => {
                        if (maxLength === undefined || !event.data) return;
                        const selected =
                            window.getSelection()?.toString() ?? '';
                        if (
                            characterCount -
                                Array.from(selected).length +
                                Array.from(event.data).length >
                            maxLength
                        ) {
                            event.preventDefault();
                        }
                    }}
                    onMouseUp={rememberSelection}
                    onKeyUp={rememberSelection}
                    onBlur={rememberSelection}
                    onPaste={(event) => {
                        event.preventDefault();
                        command(
                            'insertText',
                            event.clipboardData.getData('text/plain'),
                        );
                    }}
                    onDrop={(event) => event.preventDefault()}
                />
                <div className="pointer-events-none shrink-0 px-4 pr-6 pb-3 text-right text-xs text-muted-foreground sm:px-5 sm:pr-6">
                    {characterCount}
                    {maxLength === undefined ? '' : `/${maxLength}`} karakter
                </div>
                <Grip
                    aria-hidden="true"
                    className="pointer-events-none absolute right-1 bottom-1 size-3 text-muted-foreground/50"
                />
            </div>
        </div>
    );
}
