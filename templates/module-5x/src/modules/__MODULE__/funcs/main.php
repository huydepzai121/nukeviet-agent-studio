<?php

if (!defined('NV_IS_MOD___MODULE_UPPER__')) {
    exit('Stop!!!');
}

$page_title = $nv_Lang->getModule('main');
$array_data = [];

$sql = 'SELECT id, title, alias FROM ' . NV_PREFIXLANG . '_' . $module_data . ' WHERE status=1 ORDER BY id DESC LIMIT 20';
$result = $db->query($sql);
while ($row = $result->fetch()) {
    $row['link'] = NV_BASE_SITEURL . 'index.php?' . NV_LANG_VARIABLE . '=' . NV_LANG_DATA . '&amp;' . NV_NAME_VARIABLE . '=' . $module_name . '&amp;' . NV_OP_VARIABLE . '=detail&amp;id=' . (int) $row['id'];
    $array_data[] = $row;
}

$contents = nv___MODULE___main($array_data);

include NV_ROOTDIR . '/includes/header.php';
echo nv_site_theme($contents);
include NV_ROOTDIR . '/includes/footer.php';
