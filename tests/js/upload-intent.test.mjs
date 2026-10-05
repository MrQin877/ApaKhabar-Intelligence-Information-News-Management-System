import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../resources/js/lib/upload-intent.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: module.exports });
const { requestsNewsGeneration } = module.exports;

test('registration news prompt keeps generation despite source restrictions', () => {
    assert.equal(requestsNewsGeneration('Buatkan ringkasan berita berdasarkan data registrasi pelatihan digital dalam dokumen ini. Jelaskan jumlah seluruh baris data, jumlah pendaftaran yang berbeda, jumlah peserta unik, serta apakah terdapat catatan pendaftaran yang berulang. Bedakan dengan jelas antara jumlah baris data, jumlah pendaftaran, jumlah peserta unik, dan kehadiran aktual. Gunakan hanya informasi dari dokumen ini dan jangan gunakan konteks atau data historis dari dokumen sebelumnya. Jangan menganggap data registrasi sebagai bukti bahwa peserta benar-benar hadir, dan jangan menambahkan informasi lain yang tidak didukung oleh dokumen.'), true);
});

test('restrictions and missing data do not negate an explicit news request', () => {
    for (const prompt of ['Buatkan berita. Jangan gunakan data historis.', 'Write a news article. Do not invent facts.', 'Buat berita tentang kegiatan yang belum berlangsung.', 'Tulis berita; jangan tambahkan jumlah peserta.']) {
        assert.equal(requestsNewsGeneration(prompt), true, prompt);
    }
});

test('extraction-only, delayed and negated generation requests stay non-generative', () => {
    for (const prompt of ['', 'Ekstrak data ini saja.', 'Jangan buatkan berita.', 'Tolong jangan membuat berita.', 'Do not write a news article.', 'Buatkan berita nanti saja.', 'Buat berita, tetapi tunggu dulu.', 'Berita jangan dibuat.', 'Belum perlu berita.', 'Simpan saja. Jangan tulis berita.']) {
        assert.equal(requestsNewsGeneration(prompt), false, prompt);
    }
});
