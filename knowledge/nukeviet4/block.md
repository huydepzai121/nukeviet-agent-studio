# Block NukeViet 4.x

- Block của module: `blocks/module.<ten>.php` — chỉ hiện trong module đó.
- Block global: `blocks/global.<ten>.php`.
- Cấu hình: cùng tên, đuôi `.ini`. **Nội dung là XML**, không phải INI thông thường.

```xml
<?xml version="1.0" encoding="utf-8"?>
<block>
    <info>
        <name>Latest</name>
        <author></author>
        <website></website>
        <description></description>
    </info>
    <config>
        <numrow>5</numrow>
    </config>
    <datafunction>nv_block_config_sample_latest</datafunction>
    <submitfunction>nv_block_config_sample_latest_submit</submitfunction>
</block>
```

Từ NukeViet 4.6 có thêm JSON. Skeleton của studio vẫn dùng `.ini` để cài được trên cả dòng 4.x.

Cuối file PHP của block phải gán `$content`. Hàm nhận `$block_config`. Guard `NV_SYSTEM` hoặc `NV_MAINFILE`.

Tpl thường là `themes/<theme>/modules/<module>/block.latest.tpl`.
