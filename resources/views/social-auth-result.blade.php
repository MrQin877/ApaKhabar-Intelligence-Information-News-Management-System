<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Otorisasi Instagram</title></head>
<body>
    <p>{{ $success ? 'Instagram terhubung. Kembali ke jendela editor untuk melanjutkan.' : 'Otorisasi Instagram dibatalkan atau tidak berhasil. Kembali ke editor dan coba lagi.' }}</p>
    <button type="button" onclick="window.close()">Kembali ke editor</button>
    <script>
        if (window.opener) {
            window.opener.postMessage({ type: 'apakhabar:instagram-auth', success: @json($success) }, window.location.origin);
            window.close();
        }
    </script>
</body>
</html>
