<?php

if (!defined('NV_MAINFILE')) {
    exit('Stop!!!');
}

/**
 * @param array<int, array<string, string>> $items
 */
function nv___MODULE___main(array $items): string
{
    global $nv_Lang;

    $tpl = new \NukeViet\Template\NVSmarty();
    $tpl->assign('LANG', $nv_Lang);
    $tpl->assign('ITEMS', $items);

    return $tpl->fetch('main.tpl');
}
