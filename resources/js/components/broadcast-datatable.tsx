"use client"

import { router } from '@inertiajs/react'
import {
  flexRender,
  useTable
  
  
  
  
} from "@tanstack/react-table"
import type {ColumnDef, RowData, SortingState, ColumnFiltersState} from "@tanstack/react-table";

import {
  ChevronDown,
  Columns3,
  Search,
  Siren,
  Megaphone,
  X,
  Archive,
  Send,
  ListFilter,
  CircleCheck,
  Users,
} from "lucide-react"
import { useState } from "react"
import { features  } from "@/components/broadcast-data-table-features"
import type {DataTableFeatures} from "@/components/broadcast-data-table-features";

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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

  function ColumnSelector({
  table,
  columnLabels,
}: {
  table: any
  columnLabels: Record<string, string>
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 shrink-0"
        >
          <Columns3 className="h-4 w-4" />
          <span className="hidden sm:inline">Kolom</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {table
          .getAllColumns()
          .filter(
            (column: any) =>
              column.id !== "select" && 
              column.id !== "actions" &&
              column.getCanHide()
          )
          .map((column: any) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) =>
                column.toggleVisibility(!!value)
              }
              className="capitalize"
            >
              {columnLabels[column.id] ?? column.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


interface DataTableProps<TData extends RowData, TValue = unknown> {
  columns: ColumnDef<DataTableFeatures, TData, TValue>[]
  data: TData[]
}


const columnLabels: Record<string, string> = {
  select: "Pilih",
  type: "Jenis",
  title: "Judul",
  audience: "Penerima",
  status: "Status",
  sent_time: "Waktu Terkirim",
  archived_at: "Diarsipkan",
  actions: "Aksi",
}

export function DataTable<TData extends RowData, TValue = unknown>({ columns, data }: DataTableProps<TData, TValue>) {
  type FilterControl = "search" | "status" | "audience"

  const [sorting, setSorting] = useState<SortingState>([])
  const [activeFilterControls, setActiveFilterControls] = useState<FilterControl[]>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const [rowSelection, setRowSelection] = useState<Record<string, true>>({})

  const table = useTable({
    features,
    data,
    columns: columns as any,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 7 },
    },
  })

  function addFilterControl(filter: FilterControl) {
    setActiveFilterControls((current) =>
      current.includes(filter) ? current : [...current, filter]
    )
  }

  function removeFilterControl(filter: FilterControl) {
    setActiveFilterControls((current) => current.filter((item) => item !== filter))

    if (filter === "search") {
      table.getColumn("title")?.setFilterValue("")
    }

    if (filter === "status") {
      table.getColumn("status")?.setFilterValue(undefined)
    }

    if (filter === "audience") {
      table.getColumn("audience")?.setFilterValue(undefined)
    }
}

  const typeFilter = (table.getColumn("type")?.getFilterValue() as string[]) ?? []
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string[]) ?? []
  const audienceFilter = (table.getColumn("audience")?.getFilterValue() as string[]) ?? []
  const searchValue = (table.getColumn("title")?.getFilterValue() as string) ?? ""

  const hasActiveFilters =
    typeFilter.length > 0 ||
    statusFilter.length > 0 ||
    audienceFilter.length > 0 ||
    Boolean(searchValue.trim()) ||
    activeFilterControls.length > 0

  function clearAllFilters() {
    table.getColumn("title")?.setFilterValue(undefined)
    table.getColumn("type")?.setFilterValue(undefined)
    table.getColumn("status")?.setFilterValue(undefined)
    table.getColumn("audience")?.setFilterValue(undefined)

    setActiveFilterControls([])
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
  const currentPage = table.state.pagination?.pageIndex ?? 0
  const totalPages = table.getPageCount()
  const selectedIds = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => (row.original as { id: string }).id)

  function handleBulkArchive() {
    router.post('/admin/broadcasting/archive', { ids: selectedIds }, {
      preserveScroll: true,
      onSuccess: () => table.resetRowSelection(),
    })
  }

  function handleBulkResend() {
    console.log("Resend IDs:", selectedIds)
    table.resetRowSelection()
  }




  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col border-b border-sidebar-border/40 bg-sidebar-bg rounded-t-lg">
        {selectedCount === 0 ? (
          <div className="flex w-full items-center gap-2 overflow-x-auto px-3 py-3 flex-nowrap">
            <Tabs
              value={typeFilter[0] ?? "all"}
              onValueChange={(value) => {
                if (value === "all") {
                  table.getColumn("type")?.setFilterValue(undefined)
                } else {
                  table.getColumn("type")?.setFilterValue([value])
                }
              }}
              className="shrink-0"
            >
              <TabsList className="h-9 bg-muted/40 p-1">
                <TabsTrigger value="all" className="h-8 px-3 text-xs sm:text-sm">
                  Semua
                </TabsTrigger>

                <TabsTrigger value="darurat" className="h-8 gap-1.5 px-3 text-xs sm:text-sm">
                  <Siren className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Darurat</span>
                </TabsTrigger>

                <TabsTrigger value="pengumuman" className="h-8 gap-1.5 px-3 text-xs sm:text-sm">
                  <Megaphone className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Pengumuman</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0">
                  <ListFilter className="h-4 w-4" />
                  <span className="hidden sm:inline">Filter</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Tambah Filter</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  disabled={activeFilterControls.includes("search")}
                  onClick={() => addFilterControl("search")}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  Cari
                </DropdownMenuItem>

                <DropdownMenuItem
                  disabled={activeFilterControls.includes("status")}
                  onClick={() => addFilterControl("status")}
                  className="gap-2"
                >
                  <CircleCheck className="h-4 w-4" />
                  Status
                </DropdownMenuItem>

                <DropdownMenuItem
                  disabled={activeFilterControls.includes("audience")}
                  onClick={() => addFilterControl("audience")}
                  className="gap-2"
                >
                  <Users className="h-4 w-4" />
                  Penerima
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {activeFilterControls.includes("search") && (
              <div className="relative flex shrink-0 items-center overflow-hidden rounded-md border bg-background">
                <div className="flex h-9 items-center pl-2.5 text-muted-foreground">
                  <Search className="h-4 w-4" />
                </div>

                <Input
                  autoFocus
                  placeholder="Cari judul..."
                  value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
                  onChange={(event) => table.getColumn("title")?.setFilterValue(event.target.value)}
                  className="h-9 w-[180px] border-0 bg-transparent pl-2 pr-0 shadow-none ring-0 focus-visible:ring-0"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFilterControl("search")}
                  className="h-9 w-9 rounded-none"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {activeFilterControls.includes("status") && (
              <div className="flex shrink-0 items-center overflow-hidden rounded-md border">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-r-none border-r-0 bg-background"
                    >
                      <CircleCheck className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        Status{statusFilter.length > 0 ? ` (${statusFilter.length})` : ""}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuLabel>Filter Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {(["Dikirim", "Terjadwal", "Tertunda"] as const).map((status) => (
                      <DropdownMenuCheckboxItem
                        key={status}
                        checked={statusFilter.includes(status)}
                        onCheckedChange={() => toggleArrayFilter("status", status)}
                      >
                        {status}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeFilterControl("status")}
                  className="h-9 w-9 rounded-l-none border-l-0 bg-background"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {activeFilterControls.includes("audience") && (
              <div className="flex shrink-0 items-center overflow-hidden rounded-md border">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-r-none border-r-0 bg-background"
                    >
                      <Users className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        Penerima{audienceFilter.length > 0 ? ` (${audienceFilter.length})` : ""}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>Filter Penerima</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {(["Semua Pengguna", "Karyawan"] as const).map((audience) => (
                      <DropdownMenuCheckboxItem
                        key={audience}
                        checked={audienceFilter.includes(audience)}
                        onCheckedChange={() => toggleArrayFilter("audience", audience)}
                      >
                        {audience}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeFilterControl("audience")}
                  className="h-9 w-9 rounded-l-none border-l-0 bg-background"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="flex-1 min-w-[8px]" />

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearAllFilters} className="h-9 gap-1.5 shrink-0">
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Bersihkan</span>
              </Button>
            )}

            <ColumnSelector table={table} columnLabels={columnLabels} />
          </div>
        ) : (
          <div className="flex w-full items-center gap-2 overflow-x-auto px-3 py-3 flex-nowrap">
            <span className="shrink-0 text-sm font-medium whitespace-nowrap">
              {selectedCount}
              <span className="hidden sm:inline"> siaran dipilih</span>
              <span className="sm:hidden"> dipilih</span>
            </span>

            <div className="hidden sm:block h-5 w-px bg-border" />

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkResend} className="h-9 gap-1.5">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Kirim Ulang</span>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5">
                    <Archive className="h-4 w-4" />
                    <span className="hidden sm:inline">Arsipkan</span>
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Arsipkan {selectedCount} siaran?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Siaran yang diarsipkan tidak akan ditampilkan dalam senarai utama, tetapi masih boleh dipulihkan dari halaman Arsip.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkArchive} className="bg-red-600 hover:bg-red-700 text-white">
                      <Archive className="h-4 w-4 mr-1.5" />
                      Ya, Arsipkan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex-1 min-w-[8px]" />

            <Button variant="outline" size="sm" onClick={() => table.resetRowSelection()} className="h-9 gap-1.5 shrink-0">
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Batal Pilih</span>
            </Button>

            <ColumnSelector table={table} columnLabels={columnLabels} />
          </div>
        )}
      </div>

      <div className="overflow-hidden bg-sidebar-bg">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className=" hover:bg-sidebar-border/10 border-b border-sidebar-border/40"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-10 py-0 px-3">
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
                  className="border-b border-sidebar-border/40 hover:bg-sidebar-border/10 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5 px-3">
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

      <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-3 border-t border-sidebar-border/40 dark:border-sidebar-border/40 bg-sidebar-bg rounded-b-lg">
        <div className="text-sm text-neutral-500 dark:text-neutral-400 min-w-[180px]">
          {selectedCount > 0 ? (
            <span>{selectedCount} dari {totalCount} baris dipilih.</span>
          ) : (
            <span>{totalCount} total hasil</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <span className="hidden sm:inline">Baris per halaman</span>
            <Select
              value={`${table.state.pagination?.pageSize ?? 7}`}
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

          <Pagination className="mx-0 w-auto">
            <PaginationContent className="gap-1">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault()
                    table.previousPage()
                  }}
                  aria-disabled={!table.getCanPreviousPage()}
                  className={table.getCanPreviousPage() ? "cursor-pointer" : "pointer-events-none opacity-50"}
                />
              </PaginationItem>

              {Array.from({ length: Math.max(totalPages, 1) }, (_, index) => index + 1).map((page) => {
                const isActive = page - 1 === currentPage

                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      isActive={isActive}
                      onClick={(event) => {
                        event.preventDefault()
                        table.setPageIndex(page - 1)
                      }}
                      className="min-w-9 cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault()
                    table.nextPage()
                  }}
                  aria-disabled={!table.getCanNextPage()}
                  className={table.getCanNextPage() ? "cursor-pointer" : "pointer-events-none opacity-50"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  )
}
