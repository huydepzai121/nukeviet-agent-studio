<?php

/**
 * Skeleton NukeViet Agent Studio — module 5.x.
 * Thay __MODULE__ và __TITLE__ trước khi đưa vào src/modules.
 */

if (!defined('NV_ADMIN') && !defined('NV_MAINFILE')) {
    exit('Stop!!!');
}

$module_version = [
    'name' => '__TITLE__',
    'modfuncs' => 'main,detail',
    'submenu' => 'content',
    'is_sysmod' => 0,
    'virtual' => 1,
    'version' => '5.0.00',
    'date' => 'Tue, 10 Nov 2026 00:00:00 GMT',
    'author' => '__AUTHOR__',
    'note' => '',
    'uploads_dir' => [
        $module_upload,
    ],
];
