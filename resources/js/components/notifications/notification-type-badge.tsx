import { Siren, Megaphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { NotifType } from '@/types/notification'
 
interface NotificationTypeBadgeProps {
    type: NotifType
    showIcon?: boolean
    size?: 'sm' | 'md'
}
 
export function NotificationTypeBadge({
    type,
    showIcon = true,
    size = 'sm',
}: NotificationTypeBadgeProps) {
    const isDarurat = type === 'darurat'

    return (
        <Badge
            variant="outline"
            className={cn(
                "font-medium gap-1 shrink-0",
                size === 'sm' ? "text-[10px] px-1.5 py-0 h-4" : "text-xs px-2 py-0.5",
                isDarurat
                    ? "border-danger-border text-danger-text bg-danger-bg"
                    : "border-success-border text-success-text bg-success-bg"
            )}
        >
            {showIcon && (
                isDarurat
                    ? <Siren className={size === 'sm' ? "h-2.5 w-2.5" : "h-3 w-3"} />
                    : <Megaphone className={size === 'sm' ? "h-2.5 w-2.5" : "h-3 w-3"} />
            )}
            {isDarurat ? 'Darurat' : 'Pengumuman'}
        </Badge>
    )
}