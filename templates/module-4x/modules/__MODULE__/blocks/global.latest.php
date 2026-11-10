<?php

if (!defined('NV_MAINFILE')) {
    die('Stop!!!');
}

if (!function_exists('nv___MODULE___block_latest')) {
    function nv___MODULE___block_latest($block_config)
    {
        global $db, $module_data, $module_info, $module_file, $lang_module;

        $limit = isset($block_config['numrow']) ? intval($block_config['numrow']) : 5;
        if ($limit < 1) {
            $limit = 5;
        }

        $xtpl = new XTemplate('block.latest.tpl', NV_ROOTDIR . '/themes/' . $module_info['template'] . '/modules/' . $module_file);
        $xtpl->assign('LANG', $lang_module);
        $sql = 'SELECT id, title, alias FROM ' . NV_PREFIXLANG . '_' . $module_data . ' WHERE status=1 ORDER BY id DESC LIMIT ' . $limit;
        $result = $db->query($sql);
        while ($row = $result->fetch()) {
            $xtpl->assign('ROW', $row);
            $xtpl->parse('main.loop');
        }
        $xtpl->parse('main');

        return $xtpl->text('main');
    }
}

$content = nv___MODULE___block_latest($block_config);
