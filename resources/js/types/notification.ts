export type NotifType = 'darurat' | 'pengumuman'
export type FilterTab = 'semua' | 'darurat' | 'pengumuman' | 'belum-dibaca'
 
export type Notification = {
    id: string
    type: NotifType
    title: string
    message: string
    sent_at: string       // e.g. "2 jam lalu"
    sent_at_full: string  // e.g. "19 Mac 2026, 10:30"
    channel: string       // e.g. "Aplikasi, WhatsApp"
    is_read: boolean
}