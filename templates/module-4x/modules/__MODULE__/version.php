<?php

if (!defined('NV_MAINFILE') && !defined('NV_ADMIN')) {
    die('Stop!!!');
}

$module_version = array(
    'name' => '__TITLE__',
    'modfuncs' => 'main,detail',
    'submenu' => 'content',
    'is_sysmod' => 0,
    'virtual' => 1,
    'version' => '4.5.00',
    'date' => 'Tue, 10 Nov 2026 00:00:00 GMT',
    'author' => '__AUTHOR__',
    'note' => '',
    'uploads_dir' => array(
        $module_upload
    )
);
