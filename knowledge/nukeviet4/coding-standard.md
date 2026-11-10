# Chuẩn mã NukeViet 4.x

- PHP 7.4 trở lên. File LF, UTF-8 không BOM.
- PSR-2: 4 spaces, ngoặc nhọn xuống dòng với class và method, một câu lệnh một dòng.
- Không `declare(strict_types=1)` trong file module kiểu 4.x nếu dự án chưa bật đồng loạt.
- Không `match`, `enum`, promotion trong constructor, nullsafe, union type, `str_contains`, `str_starts_with`.
- Tên hàm module: `nv_<module>_<viec>()`.
- Comment và mô tả cho người dùng bằng tiếng Việt. Tên hàm, key ngôn ngữ, tên cột bằng tiếng Anh.
- `php -l` phải sạch trước khi coi bước khung là xong.
