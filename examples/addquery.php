<?php

require_once '../others/sphinxapi.php';

$cl = new SphinxClient();
$r = $cl->AddQuery('test');
echo $r, PHP_EOL;
$r = $cl->AddQuery('truc');
echo $r, PHP_EOL;
