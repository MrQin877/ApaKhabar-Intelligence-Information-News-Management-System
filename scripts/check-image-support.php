<?php

// CLI-only preflight: no credentials, database access, files, or network calls.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$checks = [
    'php_8_2_or_newer' => PHP_VERSION_ID >= 80200,
    'gd' => extension_loaded('gd'),
    'jpeg' => function_exists('gd_info') && (gd_info()['JPEG Support'] ?? false),
    'png' => function_exists('gd_info') && (gd_info()['PNG Support'] ?? false),
    'webp' => function_exists('gd_info') && (gd_info()['WebP Support'] ?? false),
    'exif' => function_exists('exif_read_data'),
    'fileinfo' => extension_loaded('fileinfo'),
    'mbstring' => extension_loaded('mbstring'),
];
$checks['webp_round_trip_alpha'] = false;
if ($checks['gd'] && $checks['webp']) {
    $image = imagecreatetruecolor(16, 16);
    imagealphablending($image, false);
    imagesavealpha($image, true);
    imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
    ob_start();
    $encoded = imagewebp($image, null, 80);
    $bytes = ob_get_clean();
    imagedestroy($image);
    $decoded = $encoded ? @imagecreatefromstring($bytes) : false;
    $checks['webp_round_trip_alpha'] = $decoded !== false
        && getimagesizefromstring($bytes)['mime'] === 'image/webp'
        && imagecolorsforindex($decoded, imagecolorat($decoded, 8, 8))['alpha'] === 127;
    if ($decoded !== false) {
        imagedestroy($decoded);
    }
}
echo json_encode([
    'php' => PHP_VERSION, 'binary' => PHP_BINARY, 'ini' => php_ini_loaded_file(),
    'memory_limit' => ini_get('memory_limit'), 'checks' => $checks,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL;
exit(in_array(false, $checks, true) ? 1 : 0);
