<?php

require_once '../others/sphinxapi.php';

$cl = new SphinxClient();
$r = $cl->Status();
var_dump($r);
