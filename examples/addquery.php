<?php

require_once './others/sphinxapi.php';

$cl = new SphinxClient();
$cl->SetServer('localhost', 19312);
$r = $cl->AddQuery('test');
echo $r, PHP_EOL;
$r = $cl->AddQuery('truc');
echo $r, PHP_EOL;
