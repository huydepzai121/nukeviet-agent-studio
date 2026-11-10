# Module NukeViet 4.x

Module nằm ở `modules/<ten>/` trên gốc site, không nằm trong `src/`.

Tên module: chữ thường, số, gạch dưới. URL chưa rewrite: `index.php?lang=vi&nv=<module>&op=<func>`.

## File tối thiểu

- `version.php` — mảng `$module_version` (`name`, `modfuncs`, `is_sysmod`, `virtual`, `version`, `author`, `uploads_dir`)
- `functions.php` — `define('NV_IS_MOD_<TEN>', true);` khi ở ngoài site
- `admin.functions.php` — `NV_IS_FILE_ADMIN`, mảng `$allow_func`
- `admin.menu.php` — `$submenu`
- `action_mysql.php` — `$sql_create_module`, `$sql_drop_module`
- `funcs/main.php` — trang ngoài site, bọc `header.php` / `nv_site_theme()` / `footer.php`
- `admin/main.php` — trang quản trị, bọc `nv_admin_theme()`
- `theme.php` — hàm render XTemplate
- `language/vi.php` và `language/admin_vi.php`

Guard đầu file:

- Ngoài site: `if (!defined('NV_IS_MOD_TEN')) die('Stop!!!');`
- Admin: `if (!defined('NV_IS_FILE_ADMIN')) die('Stop!!!');`
- `version.php`: `if (!defined('NV_MAINFILE') && !defined('NV_ADMIN')) die('Stop!!!');`

Thứ tự chạy: `functions.php` hoặc `admin.functions.php`, rồi file trong `funcs/` hoặc `admin/`. Thiếu `op` thì chạy `main`.

Bảng theo ngôn ngữ: `NV_PREFIXLANG . '_' . $module_data`. Không dùng từ khóa dành riêng của MySQL làm tên cột.

Skeleton tương ứng: `templates/module-4x/`.
