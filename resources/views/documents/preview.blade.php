<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{{ $document->original_name }}</title>
<style>body{font:14px/1.6 system-ui,sans-serif;margin:0;background:#f5f6f8;color:#182230}header{padding:20px 28px;background:white;border-bottom:1px solid #e3e6eb;position:sticky;top:0;z-index:2}h1{font-size:18px;margin:0;overflow-wrap:anywhere}p{white-space:pre-wrap}small{color:#667085}a{color:#2754b5}nav{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px}main{padding:24px}section{background:white;border:1px solid #e3e6eb;border-radius:10px;padding:20px;margin-bottom:20px;scroll-margin-top:140px}.table{overflow:auto;max-height:65vh}table{border-collapse:collapse;font-size:13px;min-width:100%}td,th{border:1px solid #e4e7ec;padding:8px 12px;text-align:left;white-space:pre-wrap;min-width:100px;max-width:400px;overflow-wrap:anywhere}th{background:#f2f4f7;position:sticky;top:0}th.row{min-width:35px;color:#667085}h2{font-size:15px}.notice{background:#fff6df;padding:12px;border-radius:6px}</style></head><body>
<header><h1>{{ $document->original_name }}</h1><small>Pratinjau isi · Tata letak, gambar, dan grafik dapat berbeda. Rumus Excel menampilkan nilai tersimpan; nilai kosong mungkin belum dihitung.</small><nav><a href="{{ route('admin.documents.preview', ['document' => $document->id, 'download' => 1]) }}">Unduh file asli</a>@foreach($groups as $name => $elements)<a href="#sheet-{{ $loop->index }}">{{ $name }}</a>@endforeach</nav></header>
<main>@if($error)<p role="alert" class="notice">{{ $error }}</p>@endif
@foreach($groups as $name => $elements)<section id="sheet-{{ $loop->index }}"><h2>{{ $name }}</h2>
@if($elements->count() > 500)<p class="notice">Menampilkan 500 dari {{ $elements->count() }} bagian/baris. Unduh file untuk melihat seluruh isi.</p>@endif
@php($rows = $elements->take(500))
@foreach($rows as $element)
@if(($element['element_type'] ?? '') === 'table_row')
@if($loop->first || ($rows->values()[$loop->index - 1]['element_type'] ?? '') !== 'table_row')<div class="table"><table><tbody>@endif
<tr><th class="row" scope="row">{{ data_get($element, 'source.row') }}</th>@foreach(data_get($element, 'metadata.cells', explode(' | ', $element['content'])) as $cell)<td>{{ $cell }}</td>@endforeach</tr>
@if($loop->last || ($rows->values()[$loop->index + 1]['element_type'] ?? '') !== 'table_row')</tbody></table></div>@endif
@else<p>{{ $element['content'] }}</p>@endif
@endforeach</section>@endforeach
</main></body></html>
