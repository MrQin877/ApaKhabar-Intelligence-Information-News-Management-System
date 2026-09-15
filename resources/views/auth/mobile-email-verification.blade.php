<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <title>{{ $verified ? 'E-mail disahkan' : 'Tautan tidak valid' }} — ApaKhabar</title>
    <style>
        body { margin:0; padding:24px; min-height:90vh; display:grid; place-items:center; background:#f0f7f3; color:#173c2b; font:16px/1.6 system-ui,sans-serif; }
        main { box-sizing:border-box; width:100%; max-width:460px; padding:32px; border-radius:24px; background:white; text-align:center; box-shadow:0 8px 40px #173c2b12; }
        h1 { font-size:26px; line-height:1.3; } .icon { font-size:44px; color:#16803d; }
        a { display:block; margin-top:20px; padding:12px; border-radius:12px; background:#16803d; color:white; text-decoration:none; font-weight:600; }
        .secondary { background:transparent; color:#16803d; } p { overflow-wrap:anywhere; }
    </style>
</head>
<body>
<main>
    <div class="icon" aria-hidden="true">{{ $verified ? '✓' : '!' }}</div>
    <h1>{{ $verified ? 'Alamat e-mail telah disahkan' : 'Tautan tidak valid atau sudah kedaluwarsa' }}</h1>
    <p>{{ $verified ? 'Kembali ke aplikasi dan muat ulang status pengesahan anda.' : 'Buka aplikasi dan kirim ulang email konfirmasi untuk alamat e-mail terbaru anda.' }}</p>
    @if ($appUrl)
        <a href="{{ $appUrl }}">Buka ApaKhabar</a>
    @endif
    <p>Jika aplikasi tidak terbuka, buka ApaKhabar secara manual dan periksa status di Profil.</p>
    <a class="secondary" href="{{ route('login') }}">Lanjutkan di website</a>
</main>
</body>
</html>
