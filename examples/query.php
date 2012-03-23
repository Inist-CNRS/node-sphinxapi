<?php

require_once './others/sphinxapi.php';

$cl = new SphinxClient();
$cl->SetServer('localhost', 19312);
$r = $cl->Query('test');
var_dump($r);
