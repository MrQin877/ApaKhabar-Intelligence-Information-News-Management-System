<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class BroadcastController extends Controller
{
    // GET /admin/broadcasting
    public function index()
    {
        $broadcasts = Broadcast::active()
            ->with('creator:id,name')
            ->latest()
            ->get()
            ->map(fn ($b) => [
                'id'        => (string) $b->id,
                'type'      => $b->category,        // maps to frontend 'type'
                'title'     => $b->title,
                'audience'  => $b->audience === 'semua' ? 'Semua Pengguna' : 'Karyawan',
                'status'    => match($b->status) {
                    'dikirim'   => 'Dikirim',
                    'terjadwal' => 'Terjadwal',
                    default     => 'Tertunda',
                },
                'sent_time' => $b->sent_at?->format('h:i A') ?? $b->created_at->format('h:i A'),
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
            'message'        => 'required|string|max:300',
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

        Broadcast::create([
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

        return redirect()->route('admin.broadcasting.index')
            ->with('success', 'Siaran berhasil dibuat.');
    }

    // POST /admin/broadcasting/archive
    public function archive(Request $request)
    {
        $request->validate([
            'ids'   => 'required|array|min:1',
            'ids.*' => 'exists:broadcasts,id',
        ]);

        Broadcast::whereIn('id', $request->ids)
            ->update(['archived_at' => now()]);

        return back()->with('success', count($request->ids) . ' siaran berhasil diarsipkan.');
    }

    // POST /admin/broadcasting/{broadcast}/restore
    public function restore(Broadcast $broadcast)
    {
        $broadcast->update(['archived_at' => null]);

        return back()->with('success', 'Siaran berhasil dipulihkan.');
    }
}
