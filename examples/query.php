<?php

require_once '../others/sphinxapi.php';

$cl = new SphinxClient();
$r = $cl->Query('test');
//var_dump($r);
