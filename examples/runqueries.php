<?php

require_once './others/sphinxapi.php';

$cl = new SphinxClient();
$cl->SetServer('localhost', 19312);
$cl->AddQuery('test');
$r = $cl->RunQueries();
var_export($r);
