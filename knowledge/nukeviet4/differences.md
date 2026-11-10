# NukeViet 4.x và 5.x

| | 4.x | 5.x |
| --- | --- | --- |
| Mã nguồn | Gốc repository: `modules/`, `themes/`, `includes/` | Trong `src/` |
| PHP | 7.4 trở lên. Không dùng cú pháp chỉ có từ PHP 8 | 8.2 trở lên |
| Chuẩn | PSR-2 | PSR-12 |
| Template | XTemplate, `<!-- BEGIN: main -->`, `{LANG.key}` | Smarty / `NVSmarty` |
| Ngôn ngữ trong code | `$lang_module`, `$lang_global` | `$nv_Lang->getModule()`, `getGlobal()` |
| File ngôn ngữ module | `language/vi.php` và `language/admin_vi.php` riêng | Một `language/vi.php` cho site và admin |
| Block | `*.ini`, thân file là XML | `*.json` |
| CSRF thường gặp | `md5(NV_CHECK_SESSION . '_' . $module_name . '_' . $op . '_' . $admin_info['userid'])` | `csrf_create` / `csrf_check` |
| Đọc DB | `$db`, và có thể `$db_slave` | `$db` và `$nv_Cache->db()`. Không còn `$db_slave` |

Agent phải giữ một phiên bản trong suốt một task. Module 4.x không được khai báo `declare(strict_types=1)` theo kiểu thư viện 5, không dùng `match`, `enum`, nullsafe `?->`, hay union type.
