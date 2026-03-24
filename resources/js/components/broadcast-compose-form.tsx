"use client"

import { router } from '@inertiajs/react'
import {
  Megaphone, Siren, Send, MessageSquare,
  Smartphone, Radio, Users, User,
  Clock, CalendarDays, Sparkles,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────
type Category = "pengumuman" | "darurat"
type Channel  = "whatsapp" | "sms" | "aplikasi"
type Audience = "semua" | "karyawan"
type SendMode = "now" | "scheduled"

// ── CategoryCard ───────────────────────────────────────────
function CategoryCard({
  value, selected, onSelect,
}: { value: Category; selected: boolean; onSelect: () => void }) {
  const cfg = {
    pengumuman: {
      icon: <Megaphone className="h-5 w-5" />,
      label: "Pengumuman",
      desc: "Info & update umum",
      active: "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400",
      iconBg: "bg-green-100 dark:bg-green-900/40 text-green-600",
    },
    darurat: {
      icon: <Siren className="h-5 w-5" />,
      label: "Darurat",
      desc: "Peringatan mendesak",
      active: "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400",
      iconBg: "bg-red-100 dark:bg-red-900/40 text-red-500",
    },
  }
  const { icon, label, desc, active, iconBg } = cfg[value]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-1 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150",
        selected
          ? active
          : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-700 dark:text-neutral-300"
      )}
    >
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        selected ? iconBg : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
      )}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold leading-none">{label}</p>
        <p className="mt-0.5 text-xs opacity-70">{desc}</p>
      </div>
    </button>
  )
}

// ── ChannelButton ──────────────────────────────────────────
function ChannelButton({
  value, selected, onToggle,
}: { value: Channel; selected: boolean; onToggle: () => void }) {
  const cfg: Record<Channel, { icon: React.ReactNode; label: string }> = {
    whatsapp: { icon: <MessageSquare className="h-4 w-4" />, label: "WhatsApp" },
    sms:      { icon: <Smartphone className="h-4 w-4" />,    label: "SMS"      },
    aplikasi: { icon: <Radio className="h-4 w-4" />,          label: "Aplikasi" },
  }
  const { icon, label } = cfg[value]

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-150",
        selected
          ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
          : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
      )}
    >
      {icon}{label}
    </button>
  )
}

// ── AudienceButton ─────────────────────────────────────────
function AudienceButton({
  value, selected, onSelect,
}: { value: Audience; selected: boolean; onSelect: () => void }) {
  const cfg: Record<Audience, { icon: React.ReactNode; label: string; sub: string }> = {
    semua:    { icon: <Users className="h-4 w-4" />, label: "Semua Pengguna", sub: "Warga & karyawan" },
    karyawan: { icon: <User  className="h-4 w-4" />, label: "Karyawan",       sub: "Internal saja"   },
  }
  const { icon, label, sub } = cfg[value]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-1 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-all duration-150",
        selected
          ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
          : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
      )}
    >
      <span className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
        selected ? "bg-green-100 dark:bg-green-900/40" : "bg-neutral-100 dark:bg-neutral-800"
      )}>
        {icon}
      </span>
      <div>
        <p className="font-medium leading-none">{label}</p>
        <p className="mt-0.5 text-xs opacity-60">{sub}</p>
      </div>
    </button>
  )
}

// ── Main Component ──────────────────────────────────────────
export function BroadcastComposeForm() {
  const [title,         setTitle]         = useState("")
  const [message,       setMessage]       = useState("")
  const [category,      setCategory]      = useState<Category>("pengumuman")
  const [channels,      setChannels]      = useState<Channel[]>(["aplikasi"])
  const [audience,      setAudience]      = useState<Audience>("semua")
  const [sendMode,      setSendMode]      = useState<SendMode>("now")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")

  const MAX        = 300
  const remaining  = MAX - message.length
  const isOverLimit = remaining < 0
  const canSubmit  = title.trim().length > 0
                  && message.trim().length > 0
                  && !isOverLimit
                  && channels.length > 0

  function toggleChannel(ch: Channel) {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
  }

  function handleSubmit() {
      if (!canSubmit) {
return
}

      router.post('/admin/broadcasting', {
          title,
          message,
          category,
          channels,
          audience,
          send_mode: sendMode,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
      })
  }

  return (
    <div className="flex flex-col gap-0 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
            <Sparkles className="h-4 w-4 text-green-600" />
          </div>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Tulis Pesan
          </h2>
        </div>
        {category === "darurat" && (
          <Badge variant="destructive" className="gap-1 text-xs">
            <Siren className="h-3 w-3" /> Darurat
          </Badge>
        )}
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-5 space-y-5">

        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Judul
          </Label>
          <Input
            placeholder="Masukkan judul siaran..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="h-9 text-sm bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 focus-visible:ring-green-500/40"
          />
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Pesan
          </Label>
          <Textarea
            placeholder="Tulis pengumuman untuk seluruh warga Desa Punggul..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={5}
            className={cn(
              "resize-none text-sm bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 focus-visible:ring-green-500/40",
              isOverLimit && "border-red-400 focus-visible:ring-red-400/40"
            )}
          />
          <p className={cn(
            "text-right text-xs tabular-nums",
            isOverLimit    ? "text-red-500"
            : remaining <= 30 ? "text-yellow-500"
            : "text-neutral-400"
          )}>
            {message.length}/{MAX}
          </p>
        </div>

        <Separator className="dark:bg-neutral-800" />

        {/* Category */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Kategori
          </Label>
          <div className="flex gap-3">
            <CategoryCard value="pengumuman" selected={category === "pengumuman"} onSelect={() => setCategory("pengumuman")} />
            <CategoryCard value="darurat"    selected={category === "darurat"}    onSelect={() => setCategory("darurat")} />
          </div>
        </div>

        {/* Audience */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Penerima
          </Label>
          <div className="flex gap-3">
            <AudienceButton value="semua"    selected={audience === "semua"}    onSelect={() => setAudience("semua")} />
            <AudienceButton value="karyawan" selected={audience === "karyawan"} onSelect={() => setAudience("karyawan")} />
          </div>
        </div>

        {/* Channels */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Saluran Pengiriman
          </Label>
          <div className="flex gap-2">
            <ChannelButton value="whatsapp" selected={channels.includes("whatsapp")} onToggle={() => toggleChannel("whatsapp")} />
            <ChannelButton value="sms"      selected={channels.includes("sms")}      onToggle={() => toggleChannel("sms")} />
            <ChannelButton value="aplikasi" selected={channels.includes("aplikasi")} onToggle={() => toggleChannel("aplikasi")} />
          </div>
          {channels.length === 0 && (
            <p className="text-xs text-red-500">Pilih minimal satu saluran pengiriman.</p>
          )}
        </div>

        <Separator className="dark:bg-neutral-800" />

        {/* Schedule toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-neutral-500" />
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 cursor-pointer">
                Jadwalkan Pengiriman
              </Label>
            </div>
            <Switch
              checked={sendMode === "scheduled"}
              onCheckedChange={v => setSendMode(v ? "scheduled" : "now")}
              className="data-[state=checked]:bg-green-600"
            />
          </div>

          {sendMode === "scheduled" && (
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-neutral-400">Tanggal</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  className="h-9 text-sm bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 focus-visible:ring-green-500/40"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-neutral-400">Waktu</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  className="h-9 text-sm bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 focus-visible:ring-green-500/40"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/30">
          <Button
              type="button"
              variant="outline"
              onClick={() => router.visit('/admin/broadcasting')}
              className="text-sm"
          >
              Batal
          </Button>
          <div className="flex items-center gap-3">
              <p className="text-xs text-neutral-400">
                  {channels.length > 0
                      ? `Dikirim via ${channels.join(", ")}`
                      : "Belum ada saluran dipilih"}
              </p>
              <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={cn(
                      "gap-2 text-sm font-medium transition-all",
                      category === "darurat"
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-green-600 hover:bg-green-700 text-white"
                  )}
              >
                  {sendMode === "scheduled"
                      ? <><Clock className="h-4 w-4" /> Jadwalkan Siaran</>
                      : <><Send  className="h-4 w-4" /> Kirim Siaran Sekarang</>
                  }
              </Button>
          </div>
      </div>
    </div>
  )
}