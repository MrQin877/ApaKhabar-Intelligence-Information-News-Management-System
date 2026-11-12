import { Check, CheckCheck, Clock, ChevronDown, ChevronUp, Radio, Smartphone, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/notification'
import { NotificationIcon } from './notification-icon'
import { NotificationTypeBadge } from './notification-type-badge'
 
interface NotificationCardProps {
    notif: Notification
    onMarkRead: (id: string) => void
}
 
function ChannelIcon({ channel }: { channel: string }) {
    const lower = channel.toLowerCase()

    if (lower.includes('whatsapp')) {
return <MessageSquare className="h-3 w-3" />
}

    if (lower.includes('sms'))      {
return <Smartphone className="h-3 w-3" />
}

    return <Radio className="h-3 w-3" />
}
 
export function NotificationCard({ notif, onMarkRead }: NotificationCardProps) {
    const [expanded, setExpanded] = useState(false)
    const isLong = notif.message.length > 100
 
    return (
        <Card className={cn(
            "transition-all duration-200 border",
            !notif.is_read
                ? "border-success-border bg-card shadow-sm"
                : "border-border bg-secondary/50"
        )}>
            <CardContent className="p-0">
                <div className="flex gap-3 p-4">
                    {/* Unread dot */}
                    <div className="relative mt-0.5">
                        {!notif.is_read && (
                            <span className="absolute -left-1 top-0 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-background" />
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
                                        ? "font-semibold text-foreground"
                                        : "font-medium text-muted-foreground"
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
                                    className="h-6 w-6 shrink-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    onClick={() => onMarkRead(notif.id)}
                                    title="Tandai sebagai dibaca"
                                >
                                    <Check className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
 
                        {/* Message — collapsed or expanded */}
                        <p className={cn(
                            "text-sm text-muted-foreground leading-relaxed",
                            !expanded && isLong && "line-clamp-2"
                        )}>
                            {notif.message}
                        </p>
 
                        {/* Meta row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span title={notif.sent_at_full}>{notif.sent_at}</span>
                                <span className="text-border">·</span>
                                <ChannelIcon channel={notif.channel} />
                                <span>via {notif.channel}</span>
                                {notif.is_read && (
                                    <>
                                        <span className="text-border">·</span>
                                        <CheckCheck className="h-3 w-3 text-success-text" />
                                        <span className="text-success-text">Dibaca</span>
                                    </>
                                )}
                            </div>
 
                            {/* Expand toggle */}
                            {isLong && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
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