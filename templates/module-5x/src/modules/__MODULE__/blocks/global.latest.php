<?php

if (!defined('NV_MAINFILE')) {
    exit('Stop!!!');
}

if (!function_exists('nv___MODULE___block_latest')) {
    /**
     * @param array<string, string> $block_config
     */
    function nv___MODULE___block_latest(array $block_config): string
    {
        global $db, $module_data, $module_name, $nv_Lang;

        $limit = (int) ($block_config['numrow'] ?? 5);
        if ($limit < 1) {
            $limit = 5;
        }

        $tpl = new \NukeViet\Template\NVSmarty();
        $tpl->assign('LANG', $nv_Lang);
        $items = [];
        $sql = 'SELECT id, title, alias FROM ' . NV_PREFIXLANG . '_' . $module_data . ' WHERE status=1 ORDER BY id DESC LIMIT ' . $limit;
        $result = $db->query($sql);
        while ($row = $result->fetch()) {
            $items[] = $row;
        }
        $tpl->assign('ITEMS', $items);

        return $tpl->fetch('block.latest.tpl');
    }
}

$content = nv___MODULE___block_latest($block_config);
