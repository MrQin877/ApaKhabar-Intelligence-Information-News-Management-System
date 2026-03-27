"use client"

import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ChevronDown,
  Search,
  Siren,
  Megaphone,
  X,
  SlidersHorizontal,
  Archive,
  Send,
  XCircle,
} from "lucide-react"
import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { router } from '@inertiajs/react'
 

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

// Column header display names in Indonesian
const columnLabels: Record<string, string> = {
  select: "Pilih",
  type: "Jenis",
  title: "Judul",
  audience: "Penerima",
  status: "Status",
  sent_time: "Waktu Terkirim",
  actions: "Aksi",
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

   // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: { pageSize: 7 },
    },
  })

  // Active filter helpers
  const typeFilter = (table.getColumn("type")?.getFilterValue() as string[]) ?? []
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string[]) ?? []
  const audienceFilter = (table.getColumn("audience")?.getFilterValue() as string[]) ?? []

  const hasActiveFilters =
    typeFilter.length > 0 ||
    statusFilter.length > 0 ||
    audienceFilter.length > 0 ||
    (table.getColumn("title")?.getFilterValue() as string)

  function clearAllFilters() {
    table.getColumn("title")?.setFilterValue("")
    table.getColumn("type")?.setFilterValue([])
    table.getColumn("status")?.setFilterValue([])
    table.getColumn("audience")?.setFilterValue([])
  }

  function toggleArrayFilter(column: string, value: string) {
    const col = table.getColumn(column)
    const current = (col?.getFilterValue() as string[]) ?? []
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    col?.setFilterValue(updated.length ? updated : undefined)
  }

  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const totalCount = table.getFilteredRowModel().rows.length

  // Bulk action helpers
  const selectedIds = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => (row.original as { id: string }).id)
/*
  function handleBulkDelete() {
    // TODO: router.delete or axios call with selectedIds
    console.log("Delete IDs:", selectedIds)
    table.resetRowSelection()
  }
*/
  function handleBulkArchive() {
      router.post('/admin/broadcasting/archive', { ids: selectedIds }, {
          preserveScroll: true,
          onSuccess: () => table.resetRowSelection(),
      })
  }

  function handleBulkResend() {
    // TODO: router.post with selectedIds
    console.log("Resend IDs:", selectedIds)
    table.resetRowSelection()
  }

  function handleBulkCancel() {
    // TODO: router.post with selectedIds
    console.log("Cancel IDs:", selectedIds)
    table.resetRowSelection()
  }

  return (
    <div className="space-y-3">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <Input
            placeholder="Cari judul siaran..."
            value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
            onChange={(e) => table.getColumn("title")?.setFilterValue(e.target.value)}
            className="pl-8 h-9 text-sm bg-white dark:bg-neutral-900"
          />
        </div>

        {/* Type Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 gap-1.5 text-sm ${typeFilter.length > 0 ? "border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30" : ""}`}
            >
              <Siren className="h-3.5 w-3.5" />
              Jenis
              {typeFilter.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {typeFilter.length}
                </Badge>
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel className="text-xs">Filter Jenis</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(["daurat", "pengumuman"] as const).map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={typeFilter.includes(type)}
                onCheckedChange={() => toggleArrayFilter("type", type)}
                className="gap-2 capitalize"
              >
                {type === "daurat"
                  ? <><Siren className="h-3.5 w-3.5 text-red-500" /> Darurat</>
                  : <><Megaphone className="h-3.5 w-3.5 text-green-500" /> Pengumuman</>
                }
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 gap-1.5 text-sm ${statusFilter.length > 0 ? "border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30" : ""}`}
            >
              Status
              {statusFilter.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {statusFilter.length}
                </Badge>
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel className="text-xs">Filter Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(["Dikirim", "Terjadwal", "Tertunda"] as const).map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={statusFilter.includes(s)}
                onCheckedChange={() => toggleArrayFilter("status", s)}
              >
                {s}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Audience Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 gap-1.5 text-sm ${audienceFilter.length > 0 ? "border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30" : ""}`}
            >
              Penerima
              {audienceFilter.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {audienceFilter.length}
                </Badge>
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs">Filter Penerima</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(["Semua Pengguna", "Karyawan"] as const).map((a) => (
              <DropdownMenuCheckboxItem
                key={a}
                checked={audienceFilter.includes(a)}
                onCheckedChange={() => toggleArrayFilter("audience", a)}
              >
                {a}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-9 px-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Column Visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm ml-auto">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Kolom
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs">Tampilkan Kolom</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(val) => col.toggleVisibility(!!val)}
                  className="capitalize"
                >
                  {columnLabels[col.id] ?? col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Bulk Action Bar ── */}
      {selectedCount > 0 && (
        <>
          {/* Mobile: sticky bottom bar */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/95 backdrop-blur px-4 py-3 flex items-center gap-2 shadow-lg">
            <span className="text-sm font-medium text-green-700 dark:text-green-400 shrink-0">
              {selectedCount} dipilih
            </span>
            <div className="flex items-center gap-2 flex-1">
              <Button variant="outline" size="sm" onClick={handleBulkResend}
                className="h-8 gap-1.5 text-xs flex-1 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
                <Send className="h-3.5 w-3.5" /> Kirim Ulang
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkCancel}
                className="h-8 gap-1.5 text-xs flex-1">
                <XCircle className="h-3.5 w-3.5" /> Batalkan
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                onClick={() => table.resetRowSelection()}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Desktop: inline bar (original, unchanged) */}
          <div className="hidden md:flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-2.5">
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              {selectedCount} siaran dipilih
            </span>
            <div className="h-4 w-px bg-green-200 dark:bg-green-800" />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkResend}
                className="h-8 gap-1.5 text-xs border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40">
                <Send className="h-3.5 w-3.5" /> Kirim Ulang
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkCancel}
                className="h-8 gap-1.5 text-xs">
                <XCircle className="h-3.5 w-3.5" /> Batalkan
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm"
                    className="h-8 gap-1.5 text-xs">
                    <Archive className="h-3.5 w-3.5" /> Arsipkan
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Arsipkan {selectedCount} siaran?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Siaran yang diarsipkan tidak akan ditampilkan dalam senarai utama,
                      tetapi masih boleh dipulihkan dari halaman Arsip.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkArchive}
                      className="bg-red-600 hover:bg-red-700 text-white">
                      <Archive className="h-3.5 w-3.5 mr-1.5" /> Ya, Arsipkan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => table.resetRowSelection()}
              className="h-8 gap-1 text-xs text-neutral-500">
              <X className="h-3.5 w-3.5" /> Batal Pilih
            </Button>
          </div>
        </>
      )}

      {/* ── Table ── */}
      <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border overflow-hidden bg-white dark:bg-neutral-900">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 border-b border-sidebar-border/70 dark:border-sidebar-border"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-10 py-0">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-b border-sidebar-border/40 dark:border-sidebar-border/40 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-neutral-400">
                  Tidak ada hasil ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Footer: selection info + pagination ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">

        {/* Selection info */}
        <div className="text-sm text-neutral-500 dark:text-neutral-400 min-w-[180px]">
          {selectedCount > 0 ? (
            <span>{selectedCount} dari {totalCount} baris dipilih.</span>
          ) : (
            <span>{totalCount} total hasil</span>
          )}
        </div>

        {/* Rows per page + page controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <span className="hidden sm:inline">Baris per halaman</span>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(val) => table.setPageSize(Number(val))}
            >
              <SelectTrigger className="h-8 w-[68px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 7, 10, 20].map((size) => (
                  <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 text-sm text-neutral-500">
            <span>
              Halaman {table.getState().pagination.pageIndex + 1} dari{" "}
              {table.getPageCount()}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              «
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              ‹
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              ›
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              »
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}