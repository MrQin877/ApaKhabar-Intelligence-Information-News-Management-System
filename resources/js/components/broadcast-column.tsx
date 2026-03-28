"use client"

import { router } from '@inertiajs/react'
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Megaphone, Siren, Eye, Send, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type Broadcast = {
  id: string
  type: 'daurat' | 'pengumuman'
  title: string
  audience: 'Semua Pengguna' | 'Karyawan'
  status: 'Dikirim' | 'Terjadwal' | 'Tertunda'
  sent_time: string
}

// --- Type Icon ---
function TypeIcon({ type }: { type: Broadcast['type'] }) {
  if (type === 'daurat') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
          <Siren className="h-4 w-4 text-red-500" />
        </div>
        {/* Hide label on mobile, show on sm+ */}
        <span className="hidden sm:block text-sm font-medium text-red-600 dark:text-red-400">
          Darurat
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-100 dark:bg-green-900/30">
        <Megaphone className="h-4 w-4 text-green-600" />
      </div>
      {/* Hide label on mobile, show on sm+ */}
      <span className="hidden sm:block text-sm font-medium text-green-700 dark:text-green-400">
        Pengumuman
      </span>
    </div>
  )
}

// --- Status Badge ---
function StatusBadge({ status }: { status: Broadcast['status'] }) {
  const map: Record<Broadcast['status'], { className: string; dot: string }> = {
    Dikirim:   { className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800", dot: "bg-green-500" },
    Terjadwal: { className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800", dot: "bg-yellow-500" },
    Tertunda:  { className: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800", dot: "bg-red-400" },
  }
  const { className, dot } = map[status]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  )
}

// --- Columns ---
export const columns: ColumnDef<Broadcast>[] = [
  // Row selection
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Pilih semua"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Pilih baris"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },

  // Type
  {
    accessorKey: "type",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3 h-8 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Jenis
        <ArrowUpDown className="ml-1.5 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <TypeIcon type={row.getValue("type")} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },

  // Title
  {
    accessorKey: "title",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3 h-8 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Judul
        <ArrowUpDown className="ml-1.5 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium text-neutral-900 dark:text-neutral-100 max-w-[260px] truncate block">
        {row.getValue("title")}
      </span>
    ),
  },

  // Audience
  {
    accessorKey: "audience",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3 h-8 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Penerima
        <ArrowUpDown className="ml-1.5 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-neutral-600 dark:text-neutral-400">
        {row.getValue("audience")}
      </span>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },

  // Status
  {
    accessorKey: "status",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3 h-8 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Status
        <ArrowUpDown className="ml-1.5 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },

  // Sent Time
  {
    accessorKey: "sent_time",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3 h-8 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Waktu Terkirim
        <ArrowUpDown className="ml-1.5 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-neutral-500 dark:text-neutral-400 font-mono">
        {row.getValue("sent_time")}
      </span>
    ),
  },

  // Row Actions
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const broadcast = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Buka menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
                onClick={() => router.visit(`/admin/broadcasting/${broadcast.id}`)}
                className="gap-2 cursor-pointer"
            >
                <Eye className="h-3.5 w-3.5" />
                Lihat Detail
            </DropdownMenuItem>
            {/* 
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <Pencil className="h-3.5 w-3.5" />
              Edit Siaran
            </DropdownMenuItem>
            */}
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <Send className="h-3.5 w-3.5" />
              Kirim Ulang
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
                onClick={() => router.post(`/admin/broadcasting/${broadcast.id}/archive`)}
                className="gap-2 cursor-pointer text-yellow-600 focus:text-yellow-600 focus:bg-yellow-50 dark:focus:bg-yellow-950"
            >
                <Archive className="h-3.5 w-3.5" />
                Arsipkan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]