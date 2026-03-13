<?php
require 'vendor/autoload.php';

$uri = "mongodb+srv://kuanchinzhong_db_user:Lis2aG2J9DjR86TK@apakhabar.q8pbyew.mongodb.net/?appName=ApaKhabar";
$client = new MongoDB\Client($uri);

var_dump($client->listDatabases());