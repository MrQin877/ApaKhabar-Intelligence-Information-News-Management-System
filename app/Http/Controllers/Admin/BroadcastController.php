<?php

namespace App\Http\Controllers\Admin;

/**
 * BroadcastController.php
 *
 * This controller manages the broadcasting of messages to users, including
 * creating, sending, archiving, and restoring broadcasts. It also provides
 * analytics on sent broadcasts.
 *
 * Used for Admin Panel endpoints.
 */

use App\Http\Controllers\Controller;
use App\Models\Broadcast;
use App\Models\BroadcastCategory;
use App\Models\Channel;
use App\Models\Notification;
use App\Models\User;
use App\Notifications\BroadcastNotification;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BroadcastController extends Controller
{
    // ── No constructor needed — no injected service ────────

    // GET /admin/broadcasting
    public function index()
    {
        $broadcasts = Broadcast::active()
            ->with(['creator:userID,name', 'categoryRecord', 'channels', 'users.roleRecord'])
            ->latest()
            ->get()
            ->map(fn ($b) => [
                'id'        => (string) $b->getKey(),
                'type'      => $b->category,
                'title'     => $b->title,
                'audience'  => match($b->audience) {
                    'semua'    => 'Semua Pengguna',
                    'karyawan' => 'Karyawan',
                    default    => $b->audience,
                },
                'status'    => match($b->status) {
                    'dikirim'   => 'Dikirim',
                    'terjadwal' => 'Terjadwal',
                    default     => 'Tertunda',
                },
                'sent_time' => $b->sent_at?->translatedFormat('d M Y, h:i A')
                            ?? $b->scheduled_at?->translatedFormat('d M Y, h:i A')
                            ?? $b->created_at->translatedFormat('d M Y, h:i A'),
                'sent_timestamp' => ($b->sent_at ?? $b->scheduled_at ?? $b->created_at)->getTimestamp(),
            ]);

        // ── Analytics ──────────────────────────────────────────
        $totalPesan     = Broadcast::active()->count();
        $dikirimHariIni = Broadcast::active()
                            ->whereDate('sent_at', today())
                            ->count();

        $allNotifications = \App\Models\Notification::all();
        $totalSent        = $allNotifications->count();
        $totalRead        = $allNotifications->whereNotNull('read_at')->count();
        $rateTerbuka      = $totalSent > 0
                            ? round(($totalRead / $totalSent) * 100)
                            : 0;

        // ── Chart data — last 6 months ─────────────────────────
        $chartData = collect(range(5, 0))->map(function ($monthsAgo) {
            $date  = now()->startOfMonth()->subMonths($monthsAgo);  // ← startOfMonth() first
            $start = $date->copy()->startOfMonth();
            $end   = $date->copy()->endOfMonth();

            return [
                'month'      => $date->format('M'),
                'pengumuman' => Broadcast::active()
                                    ->whereHas('categoryRecord', fn ($query) => $query->where('name', 'pengumuman'))
                                    ->whereBetween('created_at', [$start, $end])
                                    ->count(),
                'darurat'    => Broadcast::active()
                                    ->whereHas('categoryRecord', fn ($query) => $query->where('name', 'darurat'))
                                    ->whereBetween('created_at', [$start, $end])
                                    ->count(),
            ];
        })->values();

        // ── Recent broadcasts ──────────────────────────────────
        $recentBroadcasts = Broadcast::active()
            ->where('status', 'dikirim')
            ->latest('sent_at')
            ->take(3)
            ->get()
            ->map(function ($b) {
                $broadcastId = (string) $b->getKey();
                $notifs      = \App\Models\Notification::whereJsonContains('data->broadcast_id', $broadcastId)->get();
                $sent        = $notifs->count();
                $read        = $notifs->whereNotNull('read_at')->count();
                $rate        = $sent > 0 ? round(($read / $sent) * 100) : 0;

                return [
                    'id'       => $broadcastId,
                    'title'    => $b->title,
                    'category' => $b->category,
                    'audience' => $b->audience === 'semua' ? 'Semua Pengguna' : 'Karyawan',
                    'sent_at'  => $b->sent_at?->format('H:i'),
                    'sent'     => $sent,
                    'read'     => $read,
                    'rate'     => $rate,
                ];
            });

        return Inertia::render('admin/broadcasting/index', [
            'broadcasts' => $broadcasts,
            'analytics'  => [
                'total_pesan'      => $totalPesan,
                'dikirim_hari_ini' => $dikirimHariIni,
                'rate_terbuka'     => $rateTerbuka,
                'chart_data'       => $chartData,
                'recent'           => $recentBroadcasts,
            ],
        ]);
    }

    // GET /admin/broadcasting/create
    public function create()
    {
        return Inertia::render('admin/broadcasting/create');
    }

    // POST /admin/broadcasting
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'          => 'required|string|max:255',
            'message'        => 'required|string|max:500',
            'category'       => 'required|in:pengumuman,darurat',
            'channels'       => 'required|array|min:1',
            'channels.*'     => 'in:whatsapp,sms,aplikasi',
            'audience'       => 'required|in:semua,karyawan',
            'send_mode'      => 'required|in:now,scheduled',
            'scheduled_date' => 'required_if:send_mode,scheduled|nullable|date',
            'scheduled_time' => 'required_if:send_mode,scheduled|nullable|date_format:H:i',
        ]);

        $scheduledAt = null;
        if ($validated['send_mode'] === 'scheduled') {
            $scheduledAt = \Carbon\Carbon::parse(
                $validated['scheduled_date'] . ' ' . $validated['scheduled_time']
            );
        }

        $broadcast = Broadcast::create([
            'created_by'   => auth()->id(),
            'title'        => $validated['title'],
            'message'      => $validated['message'],
            'categoryID'   => BroadcastCategory::where('name', $validated['category'])->value('categoryID'),
            'send_mode'    => $validated['send_mode'],
            'status'       => $validated['send_mode'] === 'now' ? 'dikirim' : 'terjadwal',
            'sent_at'      => $validated['send_mode'] === 'now' ? now() : null,
            'scheduled_at' => $scheduledAt,
        ]);

        $broadcast->channels()->sync(
            Channel::whereIn('name', $validated['channels'])->pluck('channelID')
        );
        $broadcast->users()->sync($this->getTargetUsers($validated['audience'])->modelKeys());

        if ($validated['send_mode'] === 'now') {
            $this->sendToUsers($broadcast);
        }

        return redirect()->route('admin.broadcasting.index')
            ->with('success', 'Siaran berhasil dibuat.');
    }

    // GET /admin/broadcasting/{broadcast}
    public function show(Broadcast $broadcast)
    {
        $broadcast->load(['creator:userID,name', 'categoryRecord', 'channels', 'users.roleRecord']);
        $broadcastId = (string) $broadcast->getKey();

        $allNotifications = \App\Models\Notification::whereJsonContains('data->broadcast_id', $broadcastId)->get();

        $totalSent = $allNotifications->count();
        $totalRead = $allNotifications->filter(fn ($n) => !is_null($n->read_at))->count();
        $readRate  = $totalSent > 0 ? round(($totalRead / $totalSent) * 100) : 0;

        return Inertia::render('admin/broadcasting/show', [
            'broadcast' => [
                'id'           => (string) $broadcast->getKey(),
                'title'        => $broadcast->title,
                'message'      => $broadcast->message,
                'category'     => $broadcast->category,
                'channels'     => $broadcast->channels->pluck('name')->all(),
                'audience'     => $broadcast->audience,
                'status'       => $broadcast->status,
                'send_mode'    => $broadcast->send_mode,
                'scheduled_at' => $broadcast->scheduled_at?->translatedFormat('d M Y, H:i'),
                'sent_at'      => $broadcast->sent_at?->translatedFormat('d M Y, H:i'),
                'archived_at'  => $broadcast->archived_at?->translatedFormat('d M Y, H:i'),
                'created_at'   => $broadcast->created_at->translatedFormat('d M Y, H:i'),
                'creator'      => $broadcast->creator
                    ? ['id' => (string) $broadcast->creator->getKey(), 'name' => $broadcast->creator->name]
                    : ['id' => null, 'name' => 'Admin'],
                'stats'        => [
                    'total_sent' => $totalSent,
                    'total_read' => $totalRead,
                    'read_rate'  => $readRate,
                ],
            ],
        ]);
    }

    // POST /admin/broadcasting/{broadcast}/resend
    public function resend(Broadcast $broadcast)
    {
        $broadcast->update([
            'status'  => 'dikirim',
            'sent_at' => now(),
        ]);

        $this->sendToUsers($broadcast);

        return back()->with('success', 'Siaran berhasil dikirim ulang.');
    }

    // POST /admin/broadcasting/archive (bulk)
    public function archive(Request $request)
    {
        $request->validate([
            'ids' => 'required|array|min:1',
        ]);

        Broadcast::whereIn('alertID', $request->ids)
            ->update(['archived_at' => now()]);

        return back()->with('success', count($request->ids) . ' siaran berhasil diarsipkan.');
    }

    // POST /admin/broadcasting/{broadcast}/archive (single)
    public function archiveSingle(Broadcast $broadcast)
    {
        $broadcast->update(['archived_at' => now()]);

        return redirect()->route('admin.broadcasting.index')
            ->with('success', 'Siaran berhasil diarsipkan.');
    }

    // GET /admin/broadcasting/archived
    public function archived()
    {
        $broadcasts = Broadcast::whereNotNull('archived_at')
            ->with(['creator:userID,name', 'categoryRecord', 'users.roleRecord'])
            ->latest('archived_at')
            ->get()
            ->map(fn ($b) => [
                'id'          => (string) $b->getKey(),
                'type'        => $b->category,
                'title'       => $b->title,
                'audience'    => match($b->audience) {
                    'semua'    => 'Semua Pengguna',
                    'karyawan' => 'Karyawan',
                    default    => $b->audience,
                },
                'status'      => match($b->status) {
                    'dikirim'   => 'Dikirim',
                    'terjadwal' => 'Terjadwal',
                    default     => 'Tertunda',
                },
                'sent_time'   => $b->sent_at?->format('h:i A')
                            ?? $b->scheduled_at?->format('h:i A')
                            ?? $b->created_at->format('h:i A'),
                'archived_at' => $b->archived_at?->translatedFormat('d M Y, H:i'),
            ]);

        return Inertia::render('admin/broadcasting/archived', [
            'broadcasts' => $broadcasts,
        ]);
    }

    // POST /admin/broadcasting/{broadcast}/restore
    public function restore(Broadcast $broadcast)
    {
        $broadcast->update(['archived_at' => null]);

        return back()->with('success', 'Siaran berhasil dipulihkan.');
    }

    private function sendToUsers(Broadcast $broadcast): void
    {
        $broadcast->loadMissing(['users.roleRecord', 'channels']);
        $users    = $broadcast->users;
        $channels = $broadcast->channels->pluck('name')->all();
        $message  = "[{$broadcast->category}] {$broadcast->title}\n\n{$broadcast->message}";

        // ── Debug ──
        \Log::info('sendToUsers debug', [
            'channels'   => $channels,
            'user_count' => $users->count(),
            'audience'   => $broadcast->audience,
        ]);

        $pushTokens = [];

        foreach ($users as $user) {
            // ── In-app always ──
            $user->notify(new BroadcastNotification($broadcast));

            if ($user->push_token) {
                $pushTokens[] = $user->push_token;
            }

            // ── Debug per user ──
            \Log::info('User SMS check', [
                'name'       => $user->name,
                'phone'      => $user->phone,
                'verified'   => $user->hasVerifiedPhone(),
                'has_sms'    => in_array('sms', $channels),
            ]);

            // ── SMS via Bulk360 ──
            if (in_array('sms', $channels)
                && $user->phone
                && $user->hasVerifiedPhone()
            ) {
                app(\App\Services\SmsService::class)->sendSms($user->phone, $message);
            }
        }

        // ── Push notification — bulk send ──
        if (count($pushTokens) > 0) {
            $this->sendExpoPushBulk(
                $pushTokens,
                $broadcast->title,
                $broadcast->message,
                $broadcast->category
            );
        }

        // ── WhatsApp Group — send ONCE to group, not per user ──
        if (in_array('whatsapp', $channels)) {
            $groupId = match($broadcast->audience) {
                'karyawan' => config('services.whapi.employee_group'),
                default    => config('services.whapi.villager_group'),
            };

            if ($groupId) {
                app(\App\Services\SmsService::class)->sendWhatsAppGroup($groupId, $message);
            }
        }
    }

    private function getTargetUsers(string $audience)
    {
        return match($audience) {
            'karyawan' => User::whereHas('roleRecord', fn ($query) => $query->whereIn('name', ['admin', 'moderator']))->get(),
            default    => User::whereHas('roleRecord', fn ($query) => $query->whereIn('name', ['villager', 'admin', 'moderator']))->get(),
        };
    }

    private function sendExpoPushBulk(
        array $tokens,
        string $title,
        string $body,
        string $type
    ): void {
        $chunks = array_chunk($tokens, 100);

        foreach ($chunks as $chunk) {
            $messages = array_map(fn($token) => [
                'to'       => $token,
                'title'    => $title,
                'body'     => $body,
                'data'     => ['type' => $type],
                'sound'    => 'default',
                'priority' => $type === 'darurat' ? 'high' : 'normal',
                'badge'    => 1,
            ], $chunk);

            try {
                $response = \Illuminate\Support\Facades\Http::withHeaders([
                    'Content-Type' => 'application/json',
                    'Accept'       => 'application/json',
                ])->post('https://exp.host/--/api/v2/push/send', $messages);

                \Log::info('Expo push sent', [
                    'count'    => count($chunk),
                    'response' => $response->json(),
                ]);

            } catch (\Exception $e) {
                \Log::error('Expo push failed', [
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}