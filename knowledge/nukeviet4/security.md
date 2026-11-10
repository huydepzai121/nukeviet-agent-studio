# Bảo mật khi viết module NukeViet 4.x

Đây là checklist cho mã module của chính dự án, không phải hướng dẫn tấn công.

1. Input chỉ qua `$nv_Request` (`get_int`, `get_title`, `get_string`, `get_textarea`). Không đọc `$_GET`, `$_POST`, `$_REQUEST`.
2. Số nguyên đã cast nối vào SQL được. Chuỗi người dùng dùng câu lệnh chuẩn bị của lớp `$db` (`prepare` / `bind` tùy bản vá 4.5), không nối thẳng vào dấu nháy.
3. Khi in ra HTML, dữ liệu thô đi qua `nv_htmlspecialchars()`. Chuỗi từ `get_title()` đã được escape.
4. POST ở admin kiểm tra `$checkss`:

```php
$checkss = md5(NV_CHECK_SESSION . '_' . $module_name . '_' . $op . '_' . $admin_info['userid']);
```

So sánh với giá trị gửi lên trước khi ghi hoặc xóa.

5. File theo đường dẫn người dùng: dùng hàm kiểm tra file của NukeViet, không gọi `unlink` / `file_get_contents` trên path thô.
6. Không `unserialize` dữ liệu người dùng.
7. Admin ghi dữ liệu chỉ sau `defined('NV_IS_FILE_ADMIN')` và `$allow_func`.
