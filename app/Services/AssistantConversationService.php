<?php

namespace App\Services;

use App\Jobs\ProcessIntelligenceDocument;
use App\Models\IntelligenceDocument;
use App\Models\IntelligenceInformation;
use App\Models\IntelligentNewsSession;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class AssistantConversationService
{
    public function respond(int $userId, array $input): ?array
    {
        $session = isset($input['session_id'])
            ? IntelligentNewsSession::where('created_by', $userId)->findOrFail($input['session_id'])
            : IntelligentNewsSession::create(['created_by' => $userId, 'status' => 'collecting_sources',
                'selected_document_ids' => [], 'selected_information_ids' => [], 'user_facts' => [], 'pending_questions' => [], 'conflicts' => []]);
        $session?->assertWritable();

        $message = trim($input['prompt'] ?? '');
        if ($message === '') {
            throw ValidationException::withMessages(['prompt' => 'Tulis pertanyaan atau instruksi sebelum mengirim.']);
        }
        // Unambiguous current-turn commands must reach the editorial clarification graph.
        if (! preg_match('/\b(jangan|bukan|belum|do not|don.t|not now)\b/i', $message)
            && preg_match('/^(?:(?:tolong|silakan|please)\s+)?(?:buat(?:kan)?|tulis(?:kan)?|susun(?:kan)?|hasilkan|generate|create|write|make)\s+(?:draf(?:t)?\s+)?(?:berita|artikel|news|article)\b/iu', $message)) {
            return null;
        }
        $ids = $input['information_ids'] ?? $session->selected_information_ids ?? [];
        $docs = array_unique(array_merge($input['document_ids'] ?? [], $session->selected_document_ids ?? []));
        $items = IntelligenceInformation::where('is_active', true)
            ->whereHas('document', fn ($q) => $q->where('uploaded_by', $userId)->whereNull('archived_at'))
            ->where(fn ($q) => $q->whereIn('id', $ids)->orWhereIn('document_id', $docs))
            ->limit(200)->get();
        $history = $session->messages()->reorder()->latest('id')->limit(12)->get()->reverse()
            ->map(fn ($m) => ['role' => $m->role, 'content' => $m->content])->values()->all();
        $client = Http::acceptJson()->connectTimeout(5)->timeout(1200);
        if ($token = config('services.apakhabar_ai.token')) {
            $client->withHeaders(['X-ApaKhabar-Service-Token' => $token]);
        }
        $result = $client->post(rtrim(config('services.apakhabar_ai.url'), '/').'/assistant/respond', [
            'message' => $message, 'history' => $history,
            'information' => $items->map(fn ($i) => $i->only(['id', 'title', 'summary', 'fields', 'evidence', 'review_status']))->all(),
        ])->throw()->json();
        if (($result['intent'] ?? '') === 'extract_information') {
            $stored = IntelligenceDocument::where('uploaded_by', $userId)->whereNull('archived_at')
                ->whereIn('id', $docs)->whereNull('processed_at')->where('status', 'ready')->get();
            if ($stored->isNotEmpty()) {
                $session->update(['status' => 'processing_files', 'current_intent' => 'extract_information', 'prompt' => $message, 'selected_document_ids' => $stored->pluck('id')->all()]);
                $session->messages()->create(['role' => 'user', 'intent' => 'extract_information', 'content' => $message]);
                $session->messages()->create(['role' => 'assistant', 'intent' => 'document_processing', 'content' => 'Ekstraksi dokumen tersimpan telah dimulai. Saya akan menampilkan hasil tanpa membuat berita.']);
                foreach ($stored as $document) {
                    $document->update(['status' => 'processing']);
                    ProcessIntelligenceDocument::dispatch($document->id)->onQueue('documents');
                }

                return ['url' => route('admin.assistant.index', ['session' => $session->id], false)];
            }
        }
        if (($result['intent'] ?? '') === 'generate_news') {
            return null;
        }
        $session->update(['current_intent' => $result['intent'] ?? 'conversation', 'status' => 'collecting_sources',
            'title' => $session->title ?: mb_substr($message, 0, 100), 'prompt' => $message,
            'selected_information_ids' => $items->pluck('id')->all(),
            'selected_document_ids' => IntelligenceDocument::where('uploaded_by', $userId)->whereNull('archived_at')->whereIn('id', array_merge($docs, $items->pluck('document_id')->all()))->pluck('id')->all(), 'last_message_at' => now()]);
        $session->messages()->create(['role' => 'user', 'intent' => $result['intent'], 'content' => $message]);
        $sourceIds = collect($result['source_ids'] ?? [])->map(fn ($id) => (int) $id);
        abort_unless($sourceIds->diff($items->pluck('id'))->isEmpty(), 502);
        $session->messages()->create(['role' => 'assistant', 'intent' => $result['intent'], 'content' => $result['answer'],
            'payload' => ['information_attachments' => $items->whereIn('id', $sourceIds)->map(fn ($i) => [
                'id' => $i->id, 'document_id' => $i->document_id, 'title' => $i->title, 'summary' => $i->summary,
                'evidence' => $i->evidence, 'document' => ['id' => $i->document_id, 'original_name' => $i->document->original_name],
            ])->values()->all()]]);

        return ['url' => route('admin.assistant.index', ['session' => $session->id], false)];
    }
}
