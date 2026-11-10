<?php

if (!defined('NV_MAINFILE')) {
    exit('Stop!!!');
}

/**
 * @param string $alias
 */
function nv___MODULE___alias(string $alias): string
{
    return strtolower(change_alias($alias));
}
