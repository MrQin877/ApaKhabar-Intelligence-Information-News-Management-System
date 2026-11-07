<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (config('database.connections.mysql.host') !== 'db') { throw new RuntimeException('Docker database required'); }
$db = Illuminate\Support\Facades\DB::connection();
if ($db->getDatabaseName() !== 'apakhabar_docker') { throw new RuntimeException('Unexpected database'); }
$fkErrors = 0;
$fks = $db->select("SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL");
foreach ($fks as $fk) {
    foreach ((array)$fk as $name) { if (!preg_match('/^[a-zA-Z0-9_]+$/', $name)) { throw new RuntimeException('Unexpected identifier'); } }
    $fkErrors += $db->selectOne("SELECT COUNT(*) AS n FROM `{$fk->TABLE_NAME}` a LEFT JOIN `{$fk->REFERENCED_TABLE_NAME}` b ON a.`{$fk->COLUMN_NAME}`=b.`{$fk->REFERENCED_COLUMN_NAME}` WHERE a.`{$fk->COLUMN_NAME}` IS NOT NULL AND b.`{$fk->REFERENCED_COLUMN_NAME}` IS NULL")->n;
}
if ($fkErrors) { throw new RuntimeException('Orphaned foreign keys found; stop testing'); }
$db->statement('CREATE TABLE IF NOT EXISTS phase2b_jobs LIKE jobs');
if ($db->table('phase2b_jobs')->count()) { throw new RuntimeException('Test queue is not empty'); }
$email = 'phase2b-'.bin2hex(random_bytes(6)).'@example.invalid';
$password = bin2hex(random_bytes(20));
$role = $db->table('user_roles')->where('name', 'admin')->value('roleID');
if (!$role) { throw new RuntimeException('Admin role missing'); }
$id = $db->table('users')->insertGetId(['name'=>'Docker disposable runtime test', 'password'=>Illuminate\Support\Facades\Hash::make($password), 'roleID'=>$role, 'created_at'=>now(), 'updated_at'=>now()], 'userID');
$db->table('emails')->insert(['email'=>$email, 'userID'=>$id, 'email_verified_at'=>now(), 'created_at'=>now(), 'updated_at'=>now()]);
file_put_contents('/tmp/phase2b-credentials.json', json_encode(['email'=>$email, 'password'=>$password, 'userID'=>$id]));
if (!Illuminate\Support\Facades\Auth::validate(['email'=>$email,'password'=>$password])) { throw new RuntimeException('Authentication validation failed'); }
foreach (['public','local'] as $disk) {
    $fs=Illuminate\Support\Facades\Storage::disk($disk);
    if (!$fs->put('phase2b-check.txt', 'Docker isolated storage test')) { throw new RuntimeException('Storage write failed'); }
    if ($fs->get('phase2b-check.txt') !== 'Docker isolated storage test') { throw new RuntimeException('Storage read failed'); }
}
echo json_encode(['database'=>'db', 'foreign_keys_checked'=>count($fks), 'orphaned_keys'=>$fkErrors, 'authentication'=>'passed', 'storage'=>'public/private read-write passed', 'queue_table'=>config('queue.connections.database.table')]).PHP_EOL;
