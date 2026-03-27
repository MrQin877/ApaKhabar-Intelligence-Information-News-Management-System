<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Broadcast;
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
            ->with('creator:id,name')
            ->latest()
            ->get()
            ->map(fn ($b) => [
                'id'        => (string) $b->id,
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
                'sent_time' => $b->sent_at?->format('h:i A')
                            ?? $b->scheduled_at?->format('h:i A')
                            ?? $b->created_at->format('h:i A'),
            ]);

        return Inertia::render('admin/broadcasting/index', [
            'broadcasts' => $broadcasts,
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
            'category'     => $validated['category'],
            'channels'     => $validated['channels'],
            'audience'     => $validated['audience'],
            'send_mode'    => $validated['send_mode'],
            'status'       => $validated['send_mode'] === 'now' ? 'dikirim' : 'terjadwal',
            'sent_at'      => $validated['send_mode'] === 'now' ? now() : null,
            'scheduled_at' => $scheduledAt,
        ]);

        if ($validated['send_mode'] === 'now') {
            $this->sendToUsers($broadcast);
        }

        return redirect()->route('admin.broadcasting.index')
            ->with('success', 'Siaran berhasil dibuat.');
    }

    // GET /admin/broadcasting/{broadcast}
    public function show(Broadcast $broadcast)
    {
        $broadcast->load('creator:id,name');

        $broadcastId = (string) $broadcast->id;

        $allNotifications = Notification::where('data.broadcast_id', $broadcastId)->get();
        $totalSent = $allNotifications->count();
        $totalRead = $allNotifications->whereNotNull('read_at')->count();
        $readRate  = $totalSent > 0 ? round(($totalRead / $totalSent) * 100) : 0;

        return Inertia::render('admin/broadcasting/show', [
            'broadcast' => [
                'id'           => (string) $broadcast->id,
                'title'        => $broadcast->title,
                'message'      => $broadcast->message,
                'category'     => $broadcast->category,
                'channels'     => $broadcast->channels ?? [],
                'audience'     => $broadcast->audience,
                'status'       => $broadcast->status,
                'send_mode'    => $broadcast->send_mode,
                'scheduled_at' => $broadcast->scheduled_at?->translatedFormat('d M Y, H:i'),
                'sent_at'      => $broadcast->sent_at?->translatedFormat('d M Y, H:i'),
                'archived_at'  => $broadcast->archived_at,
                'created_at'   => $broadcast->created_at->translatedFormat('d M Y, H:i'),
                'creator'      => $broadcast->creator
                    ? ['id' => (string) $broadcast->creator->id, 'name' => $broadcast->creator->name]
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

        Broadcast::whereIn('id', $request->ids)
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

    // POST /admin/broadcasting/{broadcast}/restore
    public function restore(Broadcast $broadcast)
    {
        $broadcast->update(['archived_at' => null]);

        return back()->with('success', 'Siaran berhasil dipulihkan.');
    }

    // ── Private: send to target users ─────────────────────
    private function sendToUsers(Broadcast $broadcast): void
    {
        $users = $this->getTargetUsers($broadcast->audience);

        foreach ($users as $user) {
            // BroadcastNotification handles both:
            // - MongoDB in-app (always)
            // - Vonage SMS (if sms channel + verified phone)
            $user->notify(new BroadcastNotification($broadcast));
        }
    }

    private function getTargetUsers(string $audience)
    {
        return match($audience) {
            'karyawan' => User::where('role', 'karyawan')->get(),
            default    => User::whereIn('role', ['villager', 'karyawan'])->get(),
        };
    }
}