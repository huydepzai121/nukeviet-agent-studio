<?php

if (!defined('NV_MAINFILE')) {
    die('Stop!!!');
}

function nv___MODULE___main($items)
{
    global $module_info, $module_file, $lang_module, $lang_global;

    $xtpl = new XTemplate('main.tpl', NV_ROOTDIR . '/themes/' . $module_info['template'] . '/modules/' . $module_file);
    $xtpl->assign('LANG', $lang_module);
    $xtpl->assign('GLANG', $lang_global);
    foreach ($items as $row) {
        $xtpl->assign('ROW', $row);
        $xtpl->parse('main.loop');
    }
    $xtpl->parse('main');

    return $xtpl->text('main');
}
