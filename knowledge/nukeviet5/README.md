# Gói kiến thức NukeViet 5.x

Bản sao tài liệu và skill từ nhánh `nukeviet5.0` của [nukeviet/nukeviet](https://github.com/nukeviet/nukeviet), commit `6aa0b3c75fa020ef9f696da4b1c620f9c53b26d8`.

Giấy phép của các file trong thư mục này: GPL-2.0-or-later. Xem `LICENSE` và `ATTRIBUTION.md`.

Studio đưa các file này vào prompt của agent khi dự án chọn NukeViet 5.x. Không trộn với gói 4.x.

Skill gốc:

- `skills/new-module` — khung module
- `skills/new-block` — block
- `skills/new-api` — API
- `skills/new-hook` — hook
- `skills/new-theme` — theme
- `skills/security-audit`, `skills/security-admin` — kiểm tra php -l, PSR-12, input, SQL, CSRF
- `skills/migrate2future`, `skills/migrate2future-block`, `skills/migrate2adminfuture` — XTemplate sang Smarty
- `skills/lang-translator`, `skills/add-func`, `skills/upgrade-module`, `skills/upgrade-theme`, `skills/acceptance-test`

`CLAUDE.md` là quy ước làm việc của nhánh 5.0: PHP 8.2+, PSR-12, `$nv_Lang`, Smarty, mã trong `src/`.
