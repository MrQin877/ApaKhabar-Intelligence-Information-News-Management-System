import { Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Clock,
    Megaphone,
    MessageSquare,
    Radio,
    Send,
    Siren,
    Smartphone,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

type Channel = 'aplikasi' | 'sms' | 'whatsapp';
type ComposeData = {
    title: string;
    message: string;
    category: 'pengumuman' | 'darurat';
    channels: Channel[];
    audience: 'semua' | 'karyawan';
    send_mode: 'now' | 'scheduled';
    scheduled_date: string;
    scheduled_time: string;
};
const channels: { value: Channel; label: string; icon: typeof Radio }[] = [
    { value: 'aplikasi', label: 'Aplikasi', icon: Radio },
    { value: 'sms', label: 'SMS', icon: Smartphone },
    { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
];
const categoryColors = {
    pengumuman:
        'text-success-text data-[state=on]:border-success-border data-[state=on]:bg-success-bg data-[state=on]:text-success-text',
    darurat:
        'text-danger-text data-[state=on]:border-danger-border data-[state=on]:bg-danger-bg data-[state=on]:text-danger-text',
};

export function BroadcastComposeForm() {
    const form = useForm<ComposeData>({
        title: '',
        message: '',
        category: 'pengumuman',
        channels: ['aplikasi'],
        audience: 'semua',
        send_mode: 'now',
        scheduled_date: '',
        scheduled_time: '',
    });
    const { data, setData, errors, processing } = form;
    const [review, setReview] = useState(false);
    const heading = useRef<HTMLHeadingElement>(null);
    const previousStep = useRef(review);
    const scheduled = data.send_mode === 'scheduled';
    const categoryLabel =
        data.category === 'darurat' ? 'Darurat' : 'Pengumuman';
    const categoryClass =
        data.category === 'darurat'
            ? 'border-danger-border bg-danger-bg text-danger-text'
            : 'border-success-border bg-success-bg text-success-text';

    useEffect(() => {
        if (previousStep.current !== review) {
            heading.current?.focus();
            previousStep.current = review;
        }
    }, [review]);

    function validate() {
        form.clearErrors();
        const next: Partial<Record<keyof ComposeData, string>> = {};

        if (!data.title.trim()) {
            next.title = 'Masukkan judul pesan.';
        } else if (data.title.length > 255) {
            next.title = 'Judul maksimum 255 karakter.';
        }

        if (!data.message.trim()) {
            next.message = 'Tulis isi pesan.';
        } else if (data.message.length > 500) {
            next.message = 'Pesan maksimum 500 karakter.';
        }

        if (!data.channels.length) {
            next.channels = 'Pilih minimal satu saluran.';
        }

        if (scheduled) {
            if (!data.scheduled_date) {
                next.scheduled_date = 'Pilih tanggal pengiriman.';
            }

            if (!data.scheduled_time) {
                next.scheduled_time = 'Pilih waktu pengiriman.';
            }

            if (data.scheduled_date && data.scheduled_time) {
                const timestamp = Date.parse(
                    `${data.scheduled_date}T${data.scheduled_time}:00+08:00`,
                );

                if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
                    next.scheduled_time =
                        'Pilih tanggal dan waktu mendatang (waktu Malaysia).';
                }
            }
        }

        form.setError(next);

        return Object.keys(next).length === 0;
    }

    function submit(event: React.FormEvent) {
        event.preventDefault();

        if (processing) {
            return;
        }

        if (!validate()) {
            setReview(false);

            return;
        }

        if (!review) {
            setReview(true);

            return;
        }

        form.post('/admin/broadcasting', { onError: () => setReview(false) });
    }

    function fieldError(field: keyof ComposeData) {
        return errors[field] ? (
            <p
                id={`compose-${field}-error`}
                role="alert"
                className="mt-1 text-xs text-destructive"
            >
                {errors[field]}
            </p>
        ) : null;
    }

    return (
        <div className="mx-auto w-full max-w-3xl px-2 py-4 sm:px-6">
            <header className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1
                        ref={heading}
                        tabIndex={-1}
                        className="text-2xl font-semibold tracking-tight outline-none"
                    >
                        {review ? 'Tinjau pesan' : 'Tulis pesan'}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {review
                            ? 'Periksa isi dan tujuan pengiriman.'
                            : 'Tulis pesan, pilih penerima, lalu tinjau sebelum dikirim.'}
                    </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                    {review ? '2 / 2 · Tinjau' : '1 / 2 · Tulis'}
                </Badge>
            </header>
            <form onSubmit={submit} noValidate>
                {!review ? (
                    <div className="space-y-6">
                        <fieldset className="space-y-2">
                            <legend className="mb-2 text-sm font-medium">
                                Kategori
                            </legend>
                            <ToggleGroup
                                type="single"
                                value={data.category}
                                onValueChange={(value) => {
                                    if (
                                        value === 'pengumuman' ||
                                        value === 'darurat'
                                    ) {
                                        setData('category', value);
                                    }
                                }}
                                aria-label="Kategori pesan"
                                className="w-fit gap-1 rounded-lg bg-muted/50 p-1"
                            >
                                <ToggleGroupItem
                                    value="pengumuman"
                                    className={cn(
                                        'gap-2 rounded-md border border-transparent px-4 text-sm',
                                        categoryColors.pengumuman,
                                    )}
                                >
                                    <Megaphone className="size-4" />
                                    Pengumuman
                                </ToggleGroupItem>
                                <ToggleGroupItem
                                    value="darurat"
                                    className={cn(
                                        'gap-2 rounded-md border border-transparent px-4 text-sm',
                                        categoryColors.darurat,
                                    )}
                                >
                                    <Siren className="size-4" />
                                    Darurat
                                </ToggleGroupItem>
                            </ToggleGroup>
                            {fieldError('category')}
                        </fieldset>
                        <div>
                            <Label htmlFor="compose-title">Judul pesan</Label>
                            <Input
                                id="compose-title"
                                className="mt-2"
                                placeholder="Masukkan judul yang jelas"
                                value={data.title}
                                maxLength={255}
                                onChange={(event) =>
                                    setData('title', event.target.value)
                                }
                                aria-invalid={!!errors.title}
                                aria-describedby={
                                    errors.title
                                        ? 'compose-title-error'
                                        : undefined
                                }
                            />
                            {fieldError('title')}
                        </div>
                        <div>
                            <Label htmlFor="compose-message">Isi pesan</Label>
                            <Textarea
                                id="compose-message"
                                className="mt-2 min-h-40 resize-y leading-relaxed"
                                placeholder="Tulis pesan untuk penerima…"
                                value={data.message}
                                onChange={(event) =>
                                    setData('message', event.target.value)
                                }
                                aria-invalid={
                                    !!errors.message ||
                                    data.message.length > 500
                                }
                                aria-describedby="compose-count compose-message-error"
                            />
                            <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
                                <span>Maksimum 500 karakter</span>
                                <span
                                    id="compose-count"
                                    className={cn(
                                        'tabular-nums',
                                        data.message.length > 500 &&
                                            'text-destructive',
                                    )}
                                >
                                    {data.message.length} / 500
                                </span>
                            </div>
                            {fieldError('message')}
                        </div>
                        <section
                            className="space-y-5 border-t pt-6"
                            aria-labelledby="compose-delivery"
                        >
                            <h2
                                id="compose-delivery"
                                className="text-sm font-semibold"
                            >
                                Pengiriman
                            </h2>
                            <div>
                                <Label htmlFor="compose-audience">
                                    Penerima
                                </Label>
                                <Select
                                    value={data.audience}
                                    onValueChange={(value) =>
                                        setData(
                                            'audience',
                                            value as ComposeData['audience'],
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        id="compose-audience"
                                        className="mt-2 w-full sm:max-w-sm"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="semua">
                                            Semua Pengguna
                                        </SelectItem>
                                        <SelectItem value="karyawan">
                                            Karyawan
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {fieldError('audience')}
                            </div>
                            <fieldset>
                                <legend className="mb-3 text-sm font-medium">
                                    Saluran
                                </legend>
                                <div className="flex flex-wrap gap-x-6 gap-y-3">
                                    {channels.map((channel) => (
                                        <Label
                                            key={channel.value}
                                            className="flex cursor-pointer items-center gap-2 py-1 font-normal"
                                        >
                                            <Checkbox
                                                checked={data.channels.includes(
                                                    channel.value,
                                                )}
                                                onCheckedChange={(checked) =>
                                                    setData(
                                                        'channels',
                                                        checked
                                                            ? [
                                                                  ...data.channels,
                                                                  channel.value,
                                                              ]
                                                            : data.channels.filter(
                                                                  (value) =>
                                                                      value !==
                                                                      channel.value,
                                                              ),
                                                    )
                                                }
                                                aria-invalid={!!errors.channels}
                                                aria-describedby={
                                                    errors.channels
                                                        ? 'compose-channels-error'
                                                        : undefined
                                                }
                                            />
                                            <channel.icon className="size-4 text-muted-foreground" />
                                            {channel.label}
                                        </Label>
                                    ))}
                                </div>
                                {fieldError('channels')}
                            </fieldset>
                            <fieldset>
                                <legend className="mb-2 text-sm font-medium">
                                    Waktu pengiriman
                                </legend>
                                <ToggleGroup
                                    type="single"
                                    value={data.send_mode}
                                    onValueChange={(value) => {
                                        if (
                                            value === 'now' ||
                                            value === 'scheduled'
                                        ) {
                                            setData('send_mode', value);
                                        }
                                    }}
                                    aria-label="Waktu pengiriman"
                                    className="w-fit gap-1 rounded-lg bg-muted/50 p-1"
                                >
                                    <ToggleGroupItem
                                        value="now"
                                        className="gap-2 rounded-md px-4 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                                    >
                                        <Send className="size-4" />
                                        Sekarang
                                    </ToggleGroupItem>
                                    <ToggleGroupItem
                                        value="scheduled"
                                        className="gap-2 rounded-md px-4 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                                    >
                                        <CalendarDays className="size-4" />
                                        Jadwalkan
                                    </ToggleGroupItem>
                                </ToggleGroup>
                                {fieldError('send_mode')}
                            </fieldset>
                            {scheduled && (
                                <div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <Label htmlFor="compose-date">
                                                Tanggal
                                            </Label>
                                            <Input
                                                id="compose-date"
                                                type="date"
                                                className="mt-2"
                                                value={data.scheduled_date}
                                                onChange={(event) =>
                                                    setData(
                                                        'scheduled_date',
                                                        event.target.value,
                                                    )
                                                }
                                                aria-invalid={
                                                    !!errors.scheduled_date
                                                }
                                                aria-describedby={
                                                    errors.scheduled_date
                                                        ? 'compose-scheduled_date-error'
                                                        : undefined
                                                }
                                            />
                                            {fieldError('scheduled_date')}
                                        </div>
                                        <div>
                                            <Label htmlFor="compose-time">
                                                Waktu
                                            </Label>
                                            <Input
                                                id="compose-time"
                                                type="time"
                                                className="mt-2"
                                                value={data.scheduled_time}
                                                onChange={(event) =>
                                                    setData(
                                                        'scheduled_time',
                                                        event.target.value,
                                                    )
                                                }
                                                aria-invalid={
                                                    !!errors.scheduled_time
                                                }
                                                aria-describedby={
                                                    errors.scheduled_time
                                                        ? 'compose-scheduled_time-error'
                                                        : undefined
                                                }
                                            />
                                            {fieldError('scheduled_time')}
                                        </div>
                                    </div>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Waktu Malaysia (UTC+8)
                                    </p>
                                </div>
                            )}
                        </section>
                    </div>
                ) : (
                    <div>
                        <section className="rounded-lg border bg-muted/30 p-5">
                            <Badge variant="outline" className={categoryClass}>
                                {categoryLabel}
                            </Badge>
                            <h2 className="mt-3 text-lg font-semibold break-words">
                                {data.title}
                            </h2>
                            <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
                                {data.message}
                            </p>
                        </section>
                        <dl className="my-6 grid gap-5 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-xs text-muted-foreground">
                                    Penerima
                                </dt>
                                <dd className="mt-1">
                                    {data.audience === 'semua'
                                        ? 'Semua Pengguna'
                                        : 'Karyawan'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">
                                    Saluran
                                </dt>
                                <dd className="mt-1 flex flex-wrap gap-3">
                                    {channels
                                        .filter((channel) =>
                                            data.channels.includes(
                                                channel.value,
                                            ),
                                        )
                                        .map((channel) => (
                                            <span
                                                key={channel.value}
                                                className="flex items-center gap-1.5"
                                            >
                                                <channel.icon className="size-4 text-muted-foreground" />
                                                {channel.label}
                                            </span>
                                        ))}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">
                                    Waktu pengiriman
                                </dt>
                                <dd className="mt-1">
                                    {scheduled
                                        ? `${data.scheduled_date} · ${data.scheduled_time} (UTC+8)`
                                        : 'Sekarang'}
                                </dd>
                            </div>
                        </dl>
                    </div>
                )}
                <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                    <Button
                        type="button"
                        variant="outline"
                        asChild
                        disabled={processing}
                    >
                        <Link
                            href="/admin/broadcasting"
                            onClick={(event) => {
                                if (processing) {
                                    event.preventDefault();
                                }
                            }}
                            aria-disabled={processing}
                        >
                            Batal
                        </Link>
                    </Button>
                    <div className="flex flex-wrap gap-2">
                        {review && (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={processing}
                                onClick={() => setReview(false)}
                            >
                                <ArrowLeft className="size-4" />
                                Kembali mengedit
                            </Button>
                        )}
                        <Button type="submit" disabled={processing}>
                            {processing ? (
                                'Memproses…'
                            ) : review ? (
                                scheduled ? (
                                    <>
                                        <Clock className="size-4" />
                                        Jadwalkan pesan
                                    </>
                                ) : (
                                    <>
                                        <Send className="size-4" />
                                        Kirim pesan sekarang
                                    </>
                                )
                            ) : (
                                <>
                                    Tinjau pesan
                                    <ArrowRight className="size-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </footer>
            </form>
        </div>
    );
}
