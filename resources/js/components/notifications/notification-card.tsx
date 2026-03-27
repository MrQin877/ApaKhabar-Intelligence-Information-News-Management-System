import { useState } from 'react'
import { Check, CheckCheck, Clock, ChevronDown, ChevronUp, Radio, Smartphone, MessageSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NotificationIcon } from './notification-icon'
import { NotificationTypeBadge } from './notification-type-badge'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/notification'
 
interface NotificationCardProps {
    notif: Notification
    onMarkRead: (id: string) => void
}
 
function ChannelIcon({ channel }: { channel: string }) {
    const lower = channel.toLowerCase()
    if (lower.includes('whatsapp')) return <MessageSquare className="h-3 w-3" />
    if (lower.includes('sms'))      return <Smartphone className="h-3 w-3" />
    return <Radio className="h-3 w-3" />
}
 
export function NotificationCard({ notif, onMarkRead }: NotificationCardProps) {
    const [expanded, setExpanded] = useState(false)
    const isLong = notif.message.length > 100
 
    return (
        <Card className={cn(
            "transition-all duration-200 border",
            !notif.is_read
                ? "border-green-200 dark:border-green-800/60 bg-white dark:bg-neutral-900 shadow-sm"
                : "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40"
        )}>
            <CardContent className="p-0">
                <div className="flex gap-3 p-4">
                    {/* Unread dot */}
                    <div className="relative mt-0.5">
                        {!notif.is_read && (
                            <span className="absolute -left-1 top-0 h-2 w-2 rounded-full bg-green-500 ring-2 ring-white dark:ring-neutral-900" />
                        )}
                        <NotificationIcon type={notif.type} size="md" />
                    </div>
 
                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
 
                        {/* Title + badge row */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <p className={cn(
                                    "text-sm leading-snug",
                                    !notif.is_read
                                        ? "font-semibold text-neutral-900 dark:text-neutral-100"
                                        : "font-medium text-neutral-600 dark:text-neutral-400"
                                )}>
                                    {notif.title}
                                </p>
                                <NotificationTypeBadge type={notif.type} size="sm" />
                            </div>
 
                            {/* Mark read button */}
                            {!notif.is_read && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 text-neutral-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950/30"
                                    onClick={() => onMarkRead(notif.id)}
                                    title="Tandai sebagai dibaca"
                                >
                                    <Check className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
 
                        {/* Message — collapsed or expanded */}
                        <p className={cn(
                            "text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed",
                            !expanded && isLong && "line-clamp-2"
                        )}>
                            {notif.message}
                        </p>
 
                        {/* Meta row */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
                            <div className="flex items-center gap-2 text-xs text-neutral-400">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span title={notif.sent_at_full}>{notif.sent_at}</span>
                                <span className="text-neutral-200 dark:text-neutral-700">·</span>
                                <ChannelIcon channel={notif.channel} />
                                <span>via {notif.channel}</span>
                                {notif.is_read && (
                                    <>
                                        <span className="text-neutral-200 dark:text-neutral-700">·</span>
                                        <CheckCheck className="h-3 w-3 text-green-400" />
                                        <span className="text-green-500">Dibaca</span>
                                    </>
                                )}
                            </div>
 
                            {/* Expand toggle */}
                            {isLong && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs gap-1 text-neutral-400 hover:text-green-600 dark:hover:text-green-400"
                                    onClick={() => setExpanded(v => !v)}
                                >
                                    {expanded
                                        ? <><ChevronUp className="h-3 w-3" /> Sembunyikan</>
                                        : <><ChevronDown className="h-3 w-3" /> Baca selengkapnya</>
                                    }
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}