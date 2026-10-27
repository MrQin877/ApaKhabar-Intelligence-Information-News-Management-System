<?php

namespace App\Services\Analytics;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Chart\Chart;
use PhpOffice\PhpSpreadsheet\Chart\DataSeries;
use PhpOffice\PhpSpreadsheet\Chart\DataSeriesValues;
use PhpOffice\PhpSpreadsheet\Chart\Legend;
use PhpOffice\PhpSpreadsheet\Chart\PlotArea;
use PhpOffice\PhpSpreadsheet\Chart\Title;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Throwable;

class AnalyticsExport
{
    public const HEADERS = ['Kategori', 'Kanal', 'Objek', 'Metrik', 'Nilai', 'Satuan', 'Cakupan data', 'Dari', 'Sampai', 'Penjelasan', 'Status data'];

    public function data(array $widgets, string $from, string $to, string $scope = 'all', ?int $post = null, string $search = '', string $category = '', string $sort = 'views', string $platform = 'all'): array
    {
        $activityChannel = match ($platform) {
            'web' => 'Website', 'mobile' => 'Aplikasi mobile', default => 'Website & Mobile'
        };
        $reports = app(PostPerformance::class);
        $byId = collect($widgets)->keyBy('id');
        $sheets = [];
        $row = fn ($group, $channel, $object, $metric, $value, $unit, $coverage, $note, $status = 'Tersedia') => [$group, $channel, $object, $metric, $value ?? 'Belum tersedia', $unit, $coverage, $from, $to, $note, $status];
        $add = function ($sheet, $entry) use (&$sheets) {
            $sheets[$sheet]['rows'][] = $entry;
        };
        $overview = $byId->get('overview')['rows'] ?? [];
        $trend = $reports->interactionTrend($from, $to);
        $broadcast = app(AnalyticsReport::class)->broadcastExport($from, $to);
        $recorded = $broadcast['rows'][1]['value'];
        $read = $broadcast['rows'][2]['value'];
        $add('Ringkasan', $row('Pengguna', $activityChannel, 'Akun warga', 'Warga aktif', $overview[2]['value'] ?? 0, 'akun unik', 'Periode laporan', 'Akun warga dengan aktivitas tercatat; platform sesuai filter aktivitas; bukan penjumlahan identitas unik antarberita.'));
        $add('Ringkasan', $row('Engagement', 'Website', 'Semua berita', 'Interaksi berita', array_sum(array_column($trend, 'likes')) + array_sum(array_column($trend, 'comments')), 'interaksi', 'Periode laporan', 'Suka aktif + komentar yang kini diterbitkan, menurut tanggal pembuatan. Ringkasan ini mencakup semua berita; filter judul/kategori hanya berlaku pada lembar Berita.'));
        $add('Ringkasan', $row('Siaran', 'Aplikasi', 'Siaran terkirim dalam periode', 'Rasio baca', $recorded ? round($read / $recorded * 100, 2) : null, '%', 'Status baca saat ini', $broadcast['note'], $recorded ? 'Tersedia' : 'Tidak ada denominator'));
        $sheets['Ringkasan']['chart'] = ['title' => 'Respons warga terhadap berita', 'unit' => 'Interaksi (jumlah)', 'rows' => $trend, 'series' => ['likes' => 'Suka aktif', 'comments' => 'Komentar diterbitkan']];
        foreach ($overview as $i => $entry) {
            $add('Pengguna', $row('Pengguna', $i === 2 ? $activityChannel : 'Website & Mobile', 'Akun warga', $entry['label'], $entry['value'], $i === 2 ? 'akun unik' : 'akun', in_array($i, [0, 3]) ? 'Kondisi saat ini' : 'Periode laporan', 'Populasi akun warga, bukan sensus penduduk fisik.'));
        }
        foreach (['age', 'citizenship', 'ethnicity'] as $key) {
            foreach ($byId->get($key)['rows'] ?? [] as $entry) {
                $widget = $byId->get($key);
                $add('Pengguna', $row('Demografi', 'Akun warga', $widget['title'], $entry['label'], $entry['value'], 'akun', 'Profil saat ini; tidak mengikuti periode', $widget['note']));
                foreach (['male' => 'Laki-laki', 'female' => 'Perempuan', 'unspecified' => 'Tidak disebutkan'] as $field => $label) {
                    if (isset($entry[$field])) {
                        $add('Pengguna', $row('Demografi', 'Akun warga', $entry['label'], $label, $entry[$field], 'akun', 'Profil saat ini', $widget['note']));
                    }
                }
            }
        }
        $postRows = [];
        foreach ($reports->all($search, $category, $sort, $from, $to, $post) as $item) {
            $object = '#'.$item['id'].' · '.$item['title'];
            $note = 'Kategori berita: '.$item['category'].'; status: '.$item['status'].'. ';
            $postRows[] = $row('Engagement', 'Website', $object, 'Total tayangan kumulatif', $item['views'], 'kali', 'Seluruh rekaman; tidak mengikuti periode', $note.'Termasuk kunjungan berulang; riwayat tayangan harian belum tersedia.');
            $postRows[] = $row('Engagement', 'Website', $object, 'Identitas unik kumulatif', $item['unique'], 'identitas akun/tamu', 'Seluruh rekaman; tidak mengikuti periode', $note.'Bukan orang unik lintas berita. Identitas tamu dapat terhitung lagi setelah retensi.');
            $postRows[] = $row('Engagement', 'Website', $object, 'Suka dalam periode', $item['likes'], 'suka', 'Periode laporan', $note.'Suka yang masih aktif menurut tanggal dibuat; pembatalan suka tidak direkonstruksi.');
            $postRows[] = $row('Engagement', 'Website', $object, 'Komentar dalam periode', $item['comments'], 'komentar', 'Periode laporan', $note.'Komentar yang kini berstatus diterbitkan, termasuk tamu.');
        }
        $sheets['Berita']['rows'] = $postRows;
        $newsTrend = $reports->interactionTrend($from, $to, $post, $post ? '' : $search, $post ? '' : $category);
        $sheets['Berita']['chart'] = ['title' => $post ? 'Tren interaksi berita #'.$post : 'Tren interaksi berita sesuai filter', 'unit' => 'Interaksi (jumlah)', 'rows' => $newsTrend, 'series' => ['likes' => 'Suka aktif', 'comments' => 'Komentar diterbitkan']];
        foreach ($broadcast['rows'] as $i => $entry) {
            $add('Siaran', $row('Siaran', 'Aplikasi', 'Siaran periode laporan', $entry['label'], $entry['value'], $i === 0 ? 'siaran' : 'notifikasi', 'Siaran dikirim dalam periode; status baca saat ini', $broadcast['note']));
        }
        foreach ($broadcast['recent'] as $item) {
            foreach (['recorded' => 'Notifikasi tercatat', 'read' => 'Notifikasi dibaca'] as $key => $label) {
                $add('Siaran', $row('Siaran', 'Aplikasi', '#'.$item['id'].' · '.$item['title'], $label, $item[$key], 'notifikasi', 'Dikirim '.$item['sent_at'], 'Kategori: '.$item['category'].'. '.$broadcast['note']));
            }
            $add('Siaran', $row('Siaran', 'Aplikasi', '#'.$item['id'].' · '.$item['title'], 'Rasio baca', $item['recorded'] ? round($item['read'] / $item['recorded'] * 100, 2) : null, '%', 'Status baca saat ini', 'Notifikasi dibaca ÷ tercatat × 100.', $item['recorded'] ? 'Tersedia' : 'Tidak ada denominator'));
        }
        $sheets['Siaran']['chart'] = ['title' => 'Pembacaan menurut kategori siaran', 'unit' => 'Notifikasi (jumlah)', 'rows' => $broadcast['category_trend'], 'series' => ['recorded' => 'Tercatat', 'read' => 'Dibaca'], 'x' => 'Kategori siaran', 'bar' => true];
        foreach (['Kunjungan website' => 'kunjungan', 'Sesi website' => 'sesi', 'Pengunjung unik website' => 'identitas unik'] as $metric => $unit) {
            $add('Website', $row('Akses', 'Website', 'Seluruh website', $metric, null, $unit, 'Belum dilacak', 'Pelacakan tersendiri belum tersedia. Tayangan berita bukan pengganti kunjungan seluruh website.', 'Belum tersedia'));
        }
        foreach ($byId->get('activity')['heatmap'] ?? [] as $cell) {
            $add('Aktivitas', $row('Aktivitas', $activityChannel, 'Hari ISO '.$cell['day'].' · '.str_pad((string) $cell['hour'], 2, '0', STR_PAD_LEFT).':00', 'Warga aktif per slot', $cell['value'], 'akun unik/slot', 'Periode; platform sesuai filter', $byId->get('activity')['note']));
        }
        foreach ($byId->get('meta')['accounts'] ?? [] as $account) {
            $name = $account['platform'] === 'facebook' ? 'Facebook' : 'Instagram';
            $metric = $name === 'Facebook' ? 'Kunjungan halaman harian' : 'Jangkauan harian';
            $unit = $name === 'Facebook' ? 'kali/hari' : 'akun/hari';
            $metaTrend = [];
            foreach ($account['rows'] as $point) {
                $date = substr($point['label'], 0, 10);
                $add($name, $row('Media sosial', $name, $account['account'] ?? 'Akun belum dipilih', $metric, $point['value'], $unit, $date.' · periode Meta UTC', $account['note'].' Sinkronisasi terakhir: '.($account['last_sync'] ?? 'belum tersedia').'. Jangkauan harian tidak dijumlahkan menjadi akun unik bulanan.', $this->status($account['status'])));
                $metaTrend[] = ['label' => $date, 'value' => $point['value']];
            }
            if (! $account['rows']) {
                $add($name, $row('Media sosial', $name, $account['account'] ?? 'Akun belum dipilih', $metric, null, $unit, 'Periode laporan', $account['note'], $this->status($account['status'])));
            }
            $add($name, $row('Engagement', $name, $account['account'] ?? 'Akun belum dipilih', 'Reaksi, komentar, bagikan', null, 'interaksi', 'Belum tersedia pada integrasi', 'Metrik ini belum dikumpulkan integrasi saat ini; tidak dianggap nol.', 'Belum tersedia'));
            $sheets[$name]['chart'] = ['title' => $metric.' '.$name, 'unit' => $unit, 'rows' => $metaTrend, 'series' => ['value' => $metric]];
        }
        if ($post) {
            $sheets['Ringkasan'] = ['rows' => $postRows, 'chart' => $sheets['Berita']['chart']];
        }
        $allowed = $post ? ['Ringkasan', 'Berita'] : match ($scope) {
            'summary' => ['Ringkasan'], 'audience' => ['Pengguna', 'Aktivitas', 'Website'], 'posts' => ['Berita'], 'broadcasts' => ['Siaran'], 'social' => ['Facebook', 'Instagram'], default => array_keys($sheets),
        };
        $sheets = array_intersect_key($sheets, array_flip($allowed));
        $definitions = [];
        foreach ($sheets as $sheet) {
            foreach ($sheet['rows'] ?? [] as $entry) {
                $key = $entry[0].'|'.$entry[1].'|'.$entry[3].'|'.$entry[5].'|'.$entry[6];
                $definitions[$key] = [$entry[0], $entry[1], 'Definisi metrik', $entry[3], '—', $entry[5], $entry[6], $from, $to, preg_replace('/^Kategori berita: .*?; status: .*?\. /u', '', $entry[9]), $entry[10]];
            }
        }
        $sheets['Definisi'] = ['rows' => array_values($definitions)];

        return $sheets;
    }

    private function status(string $status): string
    {
        return match ($status) {
            'ready' => 'Tersinkron', 'not_selected' => 'Akun belum dipilih', 'pending' => 'Menunggu sinkronisasi',
            'disconnected' => 'Koneksi terputus', 'no_data' => 'Meta tidak mengembalikan data', default => 'Gagal sinkronisasi; data tersimpan mungkin lama',
        };
    }

    public function csv(array $sheets, $stream): void
    {
        fwrite($stream, "\xEF\xBB\xBF");
        fputcsv($stream, self::HEADERS, ',', '"', '');
        foreach ($sheets as $name => $sheet) {
            if ($name === 'Definisi') {
                continue;
            }
            foreach ($sheet['rows'] ?? [] as $entry) {
                fputcsv($stream, array_map(fn ($v) => is_string($v) && preg_match('/^[\s]*[=+@-]/u', $v) ? "'".$v : $v, $entry), ',', '"', '');
            }
        }
    }

    public function workbook(array $sheets, string $from, string $to): string
    {
        $book = new Spreadsheet;
        $book->removeSheetByIndex(0);
        $book->getProperties()->setCreator('ApaKhabar')->setTitle('Laporan Analitik ApaKhabar');
        $book->getDefaultStyle()->getFont()->setName('Calibri')->setSize(11);
        $path = tempnam(sys_get_temp_dir(), 'ak-analytics-');
        try {
            foreach ($sheets as $name => $data) {
                $sheet = $book->createSheet()->setTitle($name);
                $chart = $data['chart'] ?? null;
                $hasChart = $chart && count($chart['rows']) > 0;
                $header = $hasChart ? 23 : 7;
                $sheet->mergeCells('A1:K1')->setCellValueExplicit('A1', 'ApaKhabar · '.$name, DataType::TYPE_STRING);
                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(20)->getColor()->setRGB('15803D');
                $sheet->getRowDimension(1)->setRowHeight(32);
                $sheet->mergeCells('A2:K2')->setCellValueExplicit('A2', 'Periode laporan: '.$from.' — '.$to.' · Zona waktu: '.config('analytics.timezone'), DataType::TYPE_STRING);
                $sheet->mergeCells('A3:K4')->setCellValueExplicit('A3', 'Cakupan setiap metrik tercantum pada kolom Cakupan data. Penghitung kumulatif dan profil saat ini tidak mengikuti filter tanggal. Nilai belum tersedia bukan nol. Grafik interaksi tidak menunjukkan tayangan harian. Data demo lokal, jika ada, ikut dihitung dan ditandai pada objeknya.', DataType::TYPE_STRING);
                $sheet->getStyle('A3:K4')->getAlignment()->setWrapText(true);
                $sheet->getRowDimension(3)->setRowHeight(32);
                foreach (self::HEADERS as $i => $value) {
                    $sheet->setCellValueExplicit([$i + 1, $header], $value, DataType::TYPE_STRING);
                }
                $sheet->getStyle('A'.$header.':K'.$header)->applyFromArray(['font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']], 'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '15803D']]]);
                $sheet->getRowDimension($header)->setRowHeight(26);
                foreach ($data['rows'] ?? [] as $index => $entry) {
                    $r = $header + $index + 1;
                    foreach ($entry as $col => $value) {
                        $sheet->setCellValueExplicit([$col + 1, $r], $value, is_int($value) || is_float($value) ? DataType::TYPE_NUMERIC : DataType::TYPE_STRING);
                    }
                    $sheet->getRowDimension($r)->setRowHeight(48);
                    if ($index % 2 === 0) {
                        $sheet->getStyle('A'.$r.':K'.$r)->getFill()->setFillType('solid')->getStartColor()->setRGB('F0FDF4');
                    }
                }
                $last = max($header + 1, $header + count($data['rows'] ?? []));
                if (empty($data['rows'])) {
                    $sheet->setCellValueExplicit('A'.($header + 1), 'Belum ada data sesuai cakupan laporan.', DataType::TYPE_STRING);
                }
                $sheet->getStyle('A'.$header.':K'.$last)->getAlignment()->setVertical('top')->setWrapText(true);
                foreach (['A' => 18, 'B' => 20, 'C' => 40, 'D' => 30, 'E' => 16, 'F' => 21, 'G' => 38, 'H' => 14, 'I' => 14, 'J' => 80, 'K' => 23] as $col => $width) {
                    $sheet->getColumnDimension($col)->setWidth($width);
                }
                $sheet->getStyle('E'.($header + 1).':E'.$last)->getNumberFormat()->setFormatCode('#,##0.##');
                $sheet->setAutoFilter('A'.$header.':K'.$last)->freezePane('C'.($header + 1));
                $sheet->getSheetView()->setZoomScale(80);
                $sheet->getPageSetup()->setOrientation('landscape')->setFitToWidth(1)->setFitToHeight(0)->setRowsToRepeatAtTopByStartAndEnd($header, $header);
                $sheet->getPageSetup()->setPrintArea('A1:K'.$last);
                if ($hasChart) {
                    $this->chart($sheet, $chart);
                }
            }
            $book->setActiveSheetIndex(0);
            $writer = new Xlsx($book);
            $writer->setIncludeCharts(true);
            $writer->save($path);

            return $path;
        } catch (Throwable $error) {
            if (is_file($path)) {
                unlink($path);
            }
            throw $error;
        } finally {
            $book->disconnectWorksheets();
        }
    }

    private function chart($sheet, array $data): void
    {
        $name = "'".str_replace("'", "''", $sheet->getTitle())."'";
        $count = count($data['rows']);
        foreach ($data['rows'] as $i => $row) {
            $sheet->setCellValueExplicit([14, $i + 2], $row['label'], DataType::TYPE_STRING);
        }
        $categories = [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, $name.'!$N$2:$N$'.($count + 1), null, $count)];
        $labels = [];
        $values = [];
        $colors = ['16A34A', '0D9488', 'F59E0B'];
        foreach (array_keys($data['series']) as $i => $key) {
            $col = Coordinate::stringFromColumnIndex(15 + $i);
            $sheet->setCellValueExplicit($col.'1', $data['series'][$key], DataType::TYPE_STRING);
            foreach ($data['rows'] as $j => $row) {
                $sheet->setCellValueExplicit($col.($j + 2), $row[$key], DataType::TYPE_NUMERIC);
            }
            $labels[] = new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, $name.'!$'.$col.'$1', null, 1);
            $value = new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_NUMBER, $name.'!$'.$col.'$2:$'.$col.'$'.($count + 1), null, $count);
            $value->setFillColor($colors[$i % 3]);
            $values[] = $value;
        }
        $series = new DataSeries(($data['bar'] ?? false) ? DataSeries::TYPE_BARCHART : DataSeries::TYPE_LINECHART, (($data['bar'] ?? false) ? DataSeries::GROUPING_CLUSTERED : DataSeries::GROUPING_STANDARD), range(0, count($values) - 1), $labels, $categories, $values);
        if ($data['bar'] ?? false) {
            $series->setPlotDirection(DataSeries::DIRECTION_COL);
        }
        $chart = new Chart('chart_'.$sheet->getTitle(), new Title($data['title']), new Legend(Legend::POSITION_BOTTOM), new PlotArea(null, [$series]), true, 'gap', new Title($data['x'] ?? 'Tanggal'), new Title($data['unit']));
        $chart->setTopLeftPosition('A6')->setBottomRightPosition('I21');
        $sheet->addChart($chart);
        // Helper data is deliberately visible to keep charts interoperable with Excel/LibreOffice.
        $sheet->setCellValueExplicit('N1', $data['x'] ?? 'Tanggal', DataType::TYPE_STRING);
    }
}
