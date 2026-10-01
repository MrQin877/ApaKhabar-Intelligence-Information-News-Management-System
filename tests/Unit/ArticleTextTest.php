<?php

use App\Support\ArticleText;

test('news preview derives the first meaningful sentence from content', function () {
    expect(ArticleText::preview('<p>&nbsp;</p><p>Warga bergotong royong. Kegiatan kedua berlangsung besok.</p>'))
        ->toBe('Warga bergotong royong.')
        ->and(ArticleText::preview('<script>bad()</script><p>Berita &amp; kegiatan warga!</p>'))->toBe('Berita & kegiatan warga!')
        ->and(ArticleText::preview(null))->toBe('')
        ->and(mb_strlen(ArticleText::preview(str_repeat('Kegiatan warga ', 30))))->toBeLessThanOrEqual(160);
});

test('social posts contain title then full plain content preserving paragraph breaks', function () {
    expect(ArticleText::post('Judul &amp; berita', '<p>Paragraf <strong>pertama</strong>.</p><p>Paragraf kedua.</p>'))
        ->toBe("Judul & berita\n\nParagraf pertama.\n\nParagraf kedua.");
});
