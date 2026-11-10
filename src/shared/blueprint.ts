export interface BlueprintFile {
  path: string
  contents: string
}

export function moduleSlug(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  if (!slug || slug === 'nukeviet' || slug === 'nukeviet5') return 'contactbook'
  return slug
}

export function moduleTitle(name: string, title: string): string {
  if (!title.trim() || /nukeviet/i.test(title)) return 'Sổ liên hệ'
  return title.trim()
}

const THEME = 'studio'

export function moduleFiles(rawName: string, rawTitle: string): BlueprintFile[] {
  const mod = moduleSlug(rawName)
  const title = moduleTitle(rawName, rawTitle)
  const upper = mod.toUpperCase()
  const root = `src/modules/${mod}`
  const header = `<?php

/**
 * NukeViet Content Management System
 * @version 5.x
 * @author NukeViet Agent Studio
 * @license GNU/GPL version 2 or any later version
 */

`
  const files: BlueprintFile[] = [
    {
      path: `${root}/version.php`,
      contents: `${header}if (!defined('NV_ADMIN') && !defined('NV_MAINFILE')) {
    exit('Stop!!!');
}

$module_version = [
    'name' => '${title}',
    'modfuncs' => 'main,detail',
    'submenu' => 'main,content',
    'is_sysmod' => 0,
    'virtual' => 1,
    'version' => '5.0.00',
    'date' => 'Tue, 10 Nov 2026 00:00:00 GMT',
    'author' => 'NukeViet Agent Studio',
    'note' => '',
    'uploads_dir' => [
        $module_upload,
    ],
    'icon' => 'fa-solid fa-address-book',
];
`,
    },
    {
      path: `${root}/functions.php`,
      contents: `${header}if (!defined('NV_SYSTEM')) {
    exit('Stop!!!');
}

define('NV_IS_MOD_${upper}', true);
`,
    },
    {
      path: `${root}/global.functions.php`,
      contents: `${header}if (!defined('NV_MAINFILE')) {
    exit('Stop!!!');
}
`,
    },
    {
      path: `${root}/admin.functions.php`,
      contents: `${header}if (!defined('NV_ADMIN') or !defined('NV_MAINFILE') or !defined('NV_IS_MODADMIN')) {
    exit('Stop!!!');
}

$allow_func = [
    'main',
    'content',
];

define('NV_IS_FILE_ADMIN', true);
`,
    },
    {
      path: `${root}/admin.menu.php`,
      contents: `${header}if (!defined('NV_ADMIN')) {
    exit('Stop!!!');
}

$submenu['content'] = $nv_Lang->getModule('add');
$allow_func = ['main', 'content'];
`,
    },
    {
      path: `${root}/action_mysql.php`,
      contents: `${header}if (!defined('NV_IS_FILE_MODULES')) {
    exit('Stop!!!');
}

$sql_drop_module = [];
$sql_drop_module[] = 'DROP TABLE IF EXISTS ' . $db_config['prefix'] . '_' . $lang . '_' . $module_data;
$sql_drop_module[] = 'DROP TABLE IF EXISTS ' . $db_config['prefix'] . '_' . $lang . '_' . $module_data . '_config';

$sql_create_module = $sql_drop_module;
$sql_create_module[] = 'CREATE TABLE ' . $db_config['prefix'] . '_' . $lang . '_' . $module_data . " (
 id mediumint(8) unsigned NOT NULL AUTO_INCREMENT,
 full_name varchar(250) NOT NULL DEFAULT '',
 alias varchar(250) NOT NULL DEFAULT '',
 phone varchar(40) NOT NULL DEFAULT '',
 email varchar(120) NOT NULL DEFAULT '',
 note text NOT NULL,
 status tinyint(1) unsigned NOT NULL DEFAULT '1',
 add_time int(11) unsigned NOT NULL DEFAULT '0',
 PRIMARY KEY (id),
 UNIQUE KEY alias (alias)
) ENGINE=InnoDB";

$sql_create_module[] = 'CREATE TABLE ' . $db_config['prefix'] . '_' . $lang . '_' . $module_data . "_config (
 config_name varchar(30) NOT NULL,
 config_value varchar(255) NOT NULL,
 UNIQUE KEY config_name (config_name)
) ENGINE=InnoDB";

$sql_create_module[] = 'INSERT INTO ' . $db_config['prefix'] . '_' . $lang . '_' . $module_data . "_config (config_name, config_value) VALUES ('per_page', '20')";
`,
    },
    {
      path: `${root}/theme.php`,
      contents: `${header}if (!defined('NV_MAINFILE')) {
    exit('Stop!!!');
}

/**
 * @param array<int, array<string, mixed>> $items
 */
function nv_${mod}_main(array $items): string
{
    global $nv_Lang;

    $tpl = new \\NukeViet\\Template\\NVSmarty();
    $tpl->assign('LANG', $nv_Lang);
    $tpl->assign('ITEMS', $items);

    return $tpl->fetch('main.tpl');
}

/**
 * @param array<string, mixed> $row
 */
function nv_${mod}_detail(array $row): string
{
    global $nv_Lang;

    $tpl = new \\NukeViet\\Template\\NVSmarty();
    $tpl->assign('LANG', $nv_Lang);
    $tpl->assign('ROW', $row);

    return $tpl->fetch('detail.tpl');
}
`,
    },
    {
      path: `${root}/funcs/main.php`,
      contents: `${header}if (!defined('NV_IS_MOD_${upper}')) {
    exit('Stop!!!');
}

$page_title = $module_info['custom_title'];
$array_data = [];

$sql = 'SELECT id, full_name, alias, phone, email FROM ' . NV_PREFIXLANG . '_' . $module_data . ' WHERE status=1 ORDER BY id DESC LIMIT 50';
$result = $db->query($sql);
while ($row = $result->fetch()) {
    $row['link'] = NV_BASE_SITEURL . 'index.php?' . NV_LANG_VARIABLE . '=' . NV_LANG_DATA . '&amp;' . NV_NAME_VARIABLE . '=' . $module_name . '&amp;' . NV_OP_VARIABLE . '=detail&amp;id=' . (int) $row['id'];
    $array_data[] = $row;
}

$contents = nv_${mod}_main($array_data);

include NV_ROOTDIR . '/includes/header.php';
echo nv_site_theme($contents);
include NV_ROOTDIR . '/includes/footer.php';
`,
    },
    {
      path: `${root}/funcs/detail.php`,
      contents: `${header}if (!defined('NV_IS_MOD_${upper}')) {
    exit('Stop!!!');
}

$id = $nv_Request->get_int('id', 'get', 0);
$stmt = $db->prepare('SELECT id, full_name, alias, phone, email, note FROM ' . NV_PREFIXLANG . '_' . $module_data . ' WHERE id = :id AND status=1');
$stmt->bindValue(':id', $id, PDO::PARAM_INT);
$stmt->execute();
$row = $stmt->fetch();
$stmt->closeCursor();

if (empty($row)) {
    nv_redirect_location(NV_BASE_SITEURL . 'index.php?' . NV_LANG_VARIABLE . '=' . NV_LANG_DATA . '&' . NV_NAME_VARIABLE . '=' . $module_name);
}

$page_title = $row['full_name'];
$contents = nv_${mod}_detail($row);

include NV_ROOTDIR . '/includes/header.php';
echo nv_site_theme($contents);
include NV_ROOTDIR . '/includes/footer.php';
`,
    },
    {
      path: `${root}/admin/main.php`,
      contents: `${header}if (!defined('NV_IS_FILE_ADMIN')) {
    exit('Stop!!!');
}

$page_title = $nv_Lang->getModule('main');

if ($nv_Request->isset_request('delete', 'post')) {
    if (!csrf_check($nv_Request->get_string('checkss', 'post'), $csrf_key)) {
        nv_jsonOutput([
            'status' => 'error',
            'mess' => $nv_Lang->getGlobal('error_checkss'),
        ]);
    }
    $id = $nv_Request->get_int('delete', 'post', 0);
    $stmt = $db->prepare('DELETE FROM ' . NV_PREFIXLANG . '_' . $module_data . ' WHERE id = :id');
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $nv_Cache->delMod($module_name);
    nv_jsonOutput(['status' => 'ok']);
}

$rows = [];
$sql = 'SELECT id, full_name, phone, email, status, add_time FROM ' . NV_PREFIXLANG . '_' . $module_data . ' ORDER BY id DESC';
$result = $db->query($sql);
while ($row = $result->fetch()) {
    $row['url_edit'] = NV_BASE_ADMINURL . 'index.php?' . NV_LANG_VARIABLE . '=' . NV_LANG_DATA . '&amp;' . NV_NAME_VARIABLE . '=' . $module_name . '&amp;' . NV_OP_VARIABLE . '=content&amp;id=' . (int) $row['id'];
    $row['checkss'] = md5($csrf_key . '_' . $row['id']);
    $rows[] = $row;
}

$tpl = new \\NukeViet\\Template\\NVSmarty();
$tpl->assign('LANG', $nv_Lang);
$tpl->assign('ITEMS', $rows);
$tpl->assign('ADD_URL', NV_BASE_ADMINURL . 'index.php?' . NV_LANG_VARIABLE . '=' . NV_LANG_DATA . '&amp;' . NV_NAME_VARIABLE . '=' . $module_name . '&amp;' . NV_OP_VARIABLE . '=content');
$tpl->assign('CHECKSS', csrf_create($csrf_key));

$contents = $tpl->fetch('main.tpl');

include NV_ROOTDIR . '/includes/header.php';
echo nv_admin_theme($contents);
include NV_ROOTDIR . '/includes/footer.php';
`,
    },
    {
      path: `${root}/admin/content.php`,
      contents: `${header}if (!defined('NV_IS_FILE_ADMIN')) {
    exit('Stop!!!');
}

$id = $nv_Request->get_int('id', 'post,get', 0);
$row = [
    'id' => 0,
    'full_name' => '',
    'alias' => '',
    'phone' => '',
    'email' => '',
    'note' => '',
    'status' => 1,
];

if ($id > 0) {
    $stmt = $db->prepare('SELECT * FROM ' . NV_PREFIXLANG . '_' . $module_data . ' WHERE id = :id');
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $found = $stmt->fetch();
    $stmt->closeCursor();
    if (empty($found)) {
        nv_redirect_location(NV_BASE_ADMINURL . 'index.php?' . NV_LANG_VARIABLE . '=' . NV_LANG_DATA . '&' . NV_NAME_VARIABLE . '=' . $module_name);
    }
    $row = $found;
    $page_title = $nv_Lang->getModule('edit');
} else {
    $page_title = $nv_Lang->getModule('add');
}

$error = '';
if ($nv_Request->isset_request('save', 'post')) {
    if (!csrf_check($nv_Request->get_string('checkss', 'post'), $csrf_key)) {
        $error = $nv_Lang->getGlobal('error_checkss');
    } else {
        $row['full_name'] = $nv_Request->get_title('full_name', 'post', '', 250);
        $row['phone'] = $nv_Request->get_title('phone', 'post', '', 40);
        $row['email'] = $nv_Request->get_title('email', 'post', '', 120);
        $row['note'] = $nv_Request->get_textarea('note', 'post', '', 'br');
        $row['status'] = (int) $nv_Request->get_bool('status', 'post', false);
        $alias = $nv_Request->get_title('alias', 'post', '');
        $row['alias'] = $alias !== '' ? change_alias($alias) : change_alias($row['full_name']);
        if ($row['full_name'] === '') {
            $error = $nv_Lang->getModule('error_name');
        } else {
            if ($id > 0) {
                $stmt = $db->prepare('UPDATE ' . NV_PREFIXLANG . '_' . $module_data . ' SET full_name=:full_name, alias=:alias, phone=:phone, email=:email, note=:note, status=:status WHERE id=:id');
                $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            } else {
                $stmt = $db->prepare('INSERT INTO ' . NV_PREFIXLANG . '_' . $module_data . ' (full_name, alias, phone, email, note, status, add_time) VALUES (:full_name, :alias, :phone, :email, :note, :status, :add_time)');
                $stmt->bindValue(':add_time', NV_CURRENTTIME, PDO::PARAM_INT);
            }
            $stmt->bindValue(':full_name', $row['full_name'], PDO::PARAM_STR);
            $stmt->bindValue(':alias', $row['alias'], PDO::PARAM_STR);
            $stmt->bindValue(':phone', $row['phone'], PDO::PARAM_STR);
            $stmt->bindValue(':email', $row['email'], PDO::PARAM_STR);
            $stmt->bindValue(':note', $row['note'], PDO::PARAM_STR);
            $stmt->bindValue(':status', (int) $row['status'], PDO::PARAM_INT);
            $stmt->execute();
            $nv_Cache->delMod($module_name);
            nv_redirect_location(NV_BASE_ADMINURL . 'index.php?' . NV_LANG_VARIABLE . '=' . NV_LANG_DATA . '&' . NV_NAME_VARIABLE . '=' . $module_name);
        }
    }
}

$tpl = new \\NukeViet\\Template\\NVSmarty();
$tpl->assign('LANG', $nv_Lang);
$tpl->assign('ROW', $row);
$tpl->assign('ERROR', $error);
$tpl->assign('CHECKSS', csrf_create($csrf_key));
$tpl->assign('FORM_ACTION', NV_BASE_ADMINURL . 'index.php?' . NV_LANG_VARIABLE . '=' . NV_LANG_DATA . '&amp;' . NV_NAME_VARIABLE . '=' . $module_name . '&amp;' . NV_OP_VARIABLE . '=content' . ($id ? '&amp;id=' . $id : ''));

$contents = $tpl->fetch('content.tpl');

include NV_ROOTDIR . '/includes/header.php';
echo nv_admin_theme($contents);
include NV_ROOTDIR . '/includes/footer.php';
`,
    },
    {
      path: `${root}/language/vi.php`,
      contents: `${header}if (!defined('NV_MAINFILE')) {
    exit('Stop!!!');
}

$lang_translator['author'] = 'NukeViet Agent Studio';
$lang_translator['createdate'] = '10/11/2026, 00:00';
$lang_translator['copyright'] = '';
$lang_translator['info'] = '';
$lang_translator['langtype'] = 'lang_module';

$lang_module['main'] = '${title}';
$lang_module['detail'] = 'Chi tiết';
$lang_module['add'] = 'Thêm liên hệ';
$lang_module['edit'] = 'Sửa liên hệ';
$lang_module['save'] = 'Lưu';
$lang_module['full_name'] = 'Họ tên';
$lang_module['phone'] = 'Điện thoại';
$lang_module['email'] = 'Email';
$lang_module['note'] = 'Ghi chú';
$lang_module['status'] = 'Hiển thị';
$lang_module['feature'] = 'Chức năng';
$lang_module['error_name'] = 'Chưa nhập họ tên';
$lang_module['empty'] = 'Chưa có liên hệ nào.';
`,
    },
    {
      path: `${root}/language/en.php`,
      contents: `${header}if (!defined('NV_MAINFILE')) {
    exit('Stop!!!');
}

$lang_translator['author'] = 'NukeViet Agent Studio';
$lang_translator['createdate'] = '10/11/2026, 00:00';
$lang_translator['copyright'] = '';
$lang_translator['info'] = '';
$lang_translator['langtype'] = 'lang_module';

$lang_module['main'] = '${title}';
$lang_module['detail'] = 'Detail';
$lang_module['add'] = 'Add contact';
$lang_module['edit'] = 'Edit contact';
$lang_module['save'] = 'Save';
$lang_module['full_name'] = 'Name';
$lang_module['phone'] = 'Phone';
$lang_module['email'] = 'Email';
$lang_module['note'] = 'Note';
$lang_module['status'] = 'Visible';
$lang_module['feature'] = 'Actions';
$lang_module['error_name'] = 'Name is required';
$lang_module['empty'] = 'No contacts yet.';
`,
    },
  ]

  const siteMain = `<div class="contactbook-main vstack gap-3">
    <h1 class="h3">{$LANG->getModule('main')}</h1>
    {if empty($ITEMS)}
    <p class="text-body-secondary">{$LANG->getModule('empty')}</p>
    {else}
    {foreach from=$ITEMS item=row}
    <article class="border-bottom pb-3">
        <h2 class="h5 mb-1"><a href="{$row.link}">{$row.full_name}</a></h2>
        <p class="mb-0 text-body-secondary">{$row.phone} · {$row.email}</p>
    </article>
    {/foreach}
    {/if}
</div>
`
  const siteDetail = `<article class="contactbook-detail vstack gap-2">
    <h1 class="h3">{$ROW.full_name}</h1>
    <p class="mb-0"><strong>{$LANG->getModule('phone')}:</strong> {$ROW.phone}</p>
    <p class="mb-0"><strong>{$LANG->getModule('email')}:</strong> {$ROW.email}</p>
    {if $ROW.note}<div class="mt-2">{$ROW.note nofilter}</div>{/if}
</article>
`
  const adminMain = `<div class="card">
    <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="h5 mb-0">{$LANG->getModule('main')}</h2>
            <a class="btn btn-primary" href="{$ADD_URL}">{$LANG->getModule('add')}</a>
        </div>
        <div class="table-responsive">
            <table class="table table-striped align-middle mb-0">
                <thead>
                    <tr>
                        <th>{$LANG->getModule('full_name')}</th>
                        <th>{$LANG->getModule('phone')}</th>
                        <th>{$LANG->getModule('email')}</th>
                        <th>{$LANG->getModule('feature')}</th>
                    </tr>
                </thead>
                <tbody>
                    {foreach from=$ITEMS item=row}
                    <tr>
                        <td>{$row.full_name}</td>
                        <td>{$row.phone}</td>
                        <td>{$row.email}</td>
                        <td><a href="{$row.url_edit}">{$LANG->getModule('edit')}</a></td>
                    </tr>
                    {foreachelse}
                    <tr><td colspan="4">{$LANG->getModule('empty')}</td></tr>
                    {/foreach}
                </tbody>
            </table>
        </div>
    </div>
</div>
`
  const adminContent = `<div class="card">
    <div class="card-body">
        <h2 class="h5">{if $ROW.id}{$LANG->getModule('edit')}{else}{$LANG->getModule('add')}{/if}</h2>
        {if $ERROR}<div class="alert alert-danger">{$ERROR}</div>{/if}
        <form method="post" action="{$FORM_ACTION}" class="vstack gap-3">
            <input type="hidden" name="checkss" value="{$CHECKSS}">
            <div>
                <label class="form-label" for="full_name">{$LANG->getModule('full_name')}</label>
                <input class="form-control" id="full_name" name="full_name" value="{$ROW.full_name}" required>
            </div>
            <div>
                <label class="form-label" for="phone">{$LANG->getModule('phone')}</label>
                <input class="form-control" id="phone" name="phone" value="{$ROW.phone}">
            </div>
            <div>
                <label class="form-label" for="email">{$LANG->getModule('email')}</label>
                <input class="form-control" id="email" name="email" value="{$ROW.email}">
            </div>
            <div>
                <label class="form-label" for="note">{$LANG->getModule('note')}</label>
                <textarea class="form-control" id="note" name="note" rows="4">{$ROW.note}</textarea>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="status" name="status" value="1"{if $ROW.status} checked{/if}>
                <label class="form-check-label" for="status">{$LANG->getModule('status')}</label>
            </div>
            <button class="btn btn-primary" type="submit" name="save" value="1">{$LANG->getModule('save')}</button>
        </form>
    </div>
</div>
`
  for (const theme of ['default', THEME]) {
    files.push(
      { path: `src/themes/${theme}/modules/${mod}/main.tpl`, contents: siteMain },
      { path: `src/themes/${theme}/modules/${mod}/detail.tpl`, contents: siteDetail },
    )
  }
  files.push(
    { path: `src/themes/admin_default/modules/${mod}/main.tpl`, contents: adminMain },
    { path: `src/themes/admin_default/modules/${mod}/content.tpl`, contents: adminContent },
  )
  return files
}

export const STUDIO_CSS = `/* Studio — theme sinh bởi NukeViet Agent Studio */
body {
  background: #f3f0e8;
  color: #1c1915;
}
.site-header,
header .site-header {
  background: #14352b;
  color: #f4f1ea;
}
.site-header a,
header .site-header a {
  color: #e7f6ef;
}
a {
  color: #0f6b4c;
}
.contactbook-main h1,
.contactbook-detail h1 {
  letter-spacing: -0.02em;
}
.footer,
#footer {
  background: #10241e;
  color: #d7ebe3;
}
`

export function themeOverlayFiles(): BlueprintFile[] {
  return [
    { path: `src/themes/${THEME}/css/custom.css`, contents: STUDIO_CSS },
    {
      path: `src/themes/${THEME}/theme.php`,
      contents: `<?php

if (!defined('NV_SYSTEM') && !defined('NV_MAINFILE')) {
    exit('Stop!!!');
}

/**
 * Studio theme hook. Layout and blocks come from the copied default theme.
 */
function studio_brand(): string
{
    return 'Studio';
}
`,
    },
  ]
}

export function moduleSummary(rawName: string, rawTitle: string): string {
  const files = moduleFiles(rawName, rawTitle)
  const lines = files.map((file) => `- \`${file.path}\``)
  return ['## Files', '', ...lines, '', '```diff', `--- a/src/modules/${moduleSlug(rawName)}/version.php`, `+++ b/src/modules/${moduleSlug(rawName)}/version.php`, '@@', "+    'virtual' => 1,", "+    'version' => '5.0.00',", '```'].join('\n')
}

export function themeSummary(): string {
  return ['## Theme studio', '', '- `src/themes/studio/` (copy từ `default`, CSS riêng)', '- `src/themes/studio/css/custom.css`', '- `src/themes/studio/config.ini`', '', 'Layout giữ `layout.content-esbar.tpl`, header và footer của NukeViet. Màu header `#14352b`, nền giấy `#f3f0e8`.'].join('\n')
}
