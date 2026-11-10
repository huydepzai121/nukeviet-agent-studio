# Ngôn ngữ NukeViet 4.x

Hai file, không gộp:

- `modules/<module>/language/vi.php` — ngoài site
- `modules/<module>/language/admin_vi.php` — quản trị

Cả hai gán `$lang_module`. Core nạp đúng file theo khu vực. Code đọc `$lang_module['key']` và `$lang_global['key']`. Không có lớp `$nv_Lang` trên dòng 4.x mà studio nhắm tới.

Đầu file cần `$lang_translator` (`author`, `createdate`, `copyright`, `info`, `langtype` = `lang_module`).

Key viết bằng tiếng Anh. Giá trị là câu hiển thị.

Ngôn ngữ block: `language/block.global.<ten>_vi.php`, biến `$lang_block`.

Trong tpl: `{LANG.key}`, `{GLANG.key}`.
