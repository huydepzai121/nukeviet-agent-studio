# XTemplate trên NukeViet 4.x

```php
$xtpl = new XTemplate(
    'main.tpl',
    NV_ROOTDIR . '/themes/' . $module_info['template'] . '/modules/' . $module_file
);
$xtpl->assign('LANG', $lang_module);
$xtpl->assign('GLANG', $lang_global);
$xtpl->parse('main');
$contents = $xtpl->text('main');
```

File tpl:

```html
<!-- BEGIN: main -->
<h1>{LANG.main}</h1>
<!-- BEGIN: loop -->
<a href="{ROW.link}">{ROW.title}</a>
<!-- END: loop -->
<!-- END: main -->
```

Quy tắc:

- Khối lồng nhau phải đóng đúng tên.
- Không dùng cú pháp Smarty (`{$LANG->getModule(...)}`, `{foreach}`).
- Đường dẫn tpl lấy từ theme đang chọn (`$module_info['template']`), fallback về theme mặc định do core xử lý khi file không tồn tại ở theme con.
- Admin dùng cùng kiểu XTemplate, thư mục `themes/admin_default/modules/<module>/`.
