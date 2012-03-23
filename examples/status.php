#!/usr/bin/env php
<?php

require_once './others/sphinxapi.php';

$cl = new SphinxClient();
$cl->SetServer('localhost', 19312);
$r = $cl->Status();
var_dump($r);
