import type { Lang, MockTask, MockTurnResult, NvVersion } from './types'
import { encodeTurn } from './parse'
import { moduleRoot } from './workflow'

export function parseTask(prompt: string): MockTask {
  const newline = prompt.indexOf('\n')
  const first = newline === -1 ? prompt : prompt.slice(0, newline)
  const match = first.match(/^NVAS_TASK\s+(\{.*\})\s*$/)
  const meta = match ? (JSON.parse(match[1]) as Partial<MockTask>) : {}
  const text = (newline === -1 ? '' : prompt.slice(newline + 1)).trim()
  return {
    kind: meta.kind === 'node' ? 'node' : 'chat',
    nodeId: meta.nodeId,
    attempt: meta.attempt ?? 1,
    version: meta.version === '4.x' ? '4.x' : '5.x',
    module: meta.module || 'news',
    title: meta.title || 'Module',
    lang: meta.lang === 'en' ? 'en' : 'vi',
    text,
  }
}

export function mockTurn(task: MockTask): MockTurnResult {
  if (task.kind === 'chat' || !task.nodeId) return chatTurn(task)
  const built = nodeTurn(task)
  return built
}

export function encodeMock(task: MockTask): string {
  const turn = mockTurn(task)
  return encodeTurn(turn)
}

function nodeTurn(task: MockTask): MockTurnResult {
  const vi = task.lang !== 'en'
  const root = moduleRoot(task.version, task.module)
  const id = task.nodeId
  if (id === 'scaffold' && task.attempt === 1) return scaffoldFail(task, root, vi)
  if (id === 'scaffold') return scaffoldOk(task, root, vi)
  if (id === 'analyze') return analyze(task, root, vi)
  if (id === 'theme') return theme(task, root, vi)
  if (id === 'backend') return backend(task, root, vi)
  if (id === 'lang') return language(task, root, vi)
  if (id === 'gate') return gate(task, root, vi)
  if (id === 'review') return review(task, root, vi)
  return fix(task, root, vi)
}

function analyze(task: MockTask, root: string, vi: boolean): MockTurnResult {
  const php = task.version === '5.x' ? '8.2+' : '7.4+'
  const engine = task.version === '5.x' ? 'Smarty' : 'XTemplate'
  return {
    status: 'ok',
    summary: vi
      ? `Đã chốt phạm vi module **${task.title}** (\`${task.module}\`) trên NukeViet ${task.version}. Bốn func, hai bảng, không đụng core.`
      : `Scoped **${task.title}** (\`${task.module}\`) on NukeViet ${task.version}. Four funcs, two tables, core untouched.`,
    tools: [
      { id: 't-read-ver', title: vi ? `Đọc ${root}/version.php` : `Read ${root}/version.php`, kind: 'read' },
      { id: 't-plan', title: vi ? 'Lập danh sách file' : 'List files', kind: 'think' },
    ],
    logs: [{ level: 'info', message: `version=${task.version} php=${php} template=${engine}` }],
    text: vi
      ? [
          `## Phạm vi`,
          '',
          `Module \`${task.module}\` đặt tại \`${root}\`. PHP ${php}, template ${engine}.`,
          '',
          '| Func | Khu vực | Việc |',
          '| --- | --- | --- |',
          '| main | site | Danh sách tin đã duyệt |',
          '| detail | site | Trang chi tiết theo alias |',
          '| main | admin | Danh sách, bật/tắt, sắp xếp |',
          '| content | admin | Thêm và sửa, có CSRF |',
          '',
          'Bảng: `' + prefix(task.version) + '_' + task.module + '` và bảng `_config`. Không thêm bảng dùng chung.',
          '',
          'Rủi ro: alias trùng, và POST admin thiếu token. Cổng kiểm tra sẽ chặn hai điểm này.',
        ].join('\n')
      : [
          `## Scope`,
          '',
          `Module \`${task.module}\` lives at \`${root}\`. PHP ${php}, ${engine} templates.`,
          '',
          '| Func | Area | Job |',
          '| --- | --- | --- |',
          '| main | site | Published list |',
          '| detail | site | Alias detail |',
          '| main | admin | List, toggle, weight |',
          '| content | admin | Create and edit, with CSRF |',
          '',
          'Tables stay language-prefixed. Shared tables are out of scope.',
        ].join('\n'),
  }
}

function theme(task: MockTask, root: string, vi: boolean): MockTurnResult {
  const future = task.version === '5.x'
  return {
    status: 'ok',
    summary: vi
      ? future
        ? 'Giao diện bám theme `future` và `admin_future`: Smarty, Bootstrap 5, không JS inline.'
        : 'Giao diện bám `default` và `admin_default`: XTemplate, khối BEGIN/END, không Smarty.'
      : future
        ? 'UI follows `future` and `admin_future`: Smarty, Bootstrap 5, no inline JS.'
        : 'UI follows `default` and `admin_default`: XTemplate blocks, no Smarty.',
    tools: [
      { id: 't-theme', title: vi ? 'Đối chiếu theme đang chạy' : 'Check active theme', kind: 'search' },
    ],
    logs: [{ level: 'info', message: future ? 'template=smarty' : 'template=xtemplate' }],
    text: vi
      ? future
        ? [
            `## Theme`,
            '',
            `- Site: \`src/themes/future/modules/${task.module}/main.tpl\``,
            `- Admin: \`src/themes/admin_future/modules/${task.module}/main.tpl\``,
            `- JS riêng: \`src/themes/admin_future/js/${task.module}.js\` (ajax-submit, không viết trong tpl).`,
            '',
            'Danh sách dùng bảng Bootstrap 5. Form content có `invalid-feedback`. Tiêu đề lấy từ `{$LANG->getModule(\'title\')}`.',
            '',
            'Hằng URL viết thẳng `{$smarty.const.NV_BASE_SITEURL}`, không assign lại từ PHP.',
          ].join('\n')
        : [
            `## Theme`,
            '',
            `- Site: \`themes/default/modules/${task.module}/main.tpl\``,
            `- Admin: \`themes/admin_default/modules/${task.module}/main.tpl\``,
            '',
            'Mỗi tpl có `<!-- BEGIN: main -->` … `<!-- END: main -->`. Chuỗi là `{LANG.key}` và `{GLANG.key}`.',
            '',
            'PHP tạo XTemplate bằng `$module_info[\'template\']` và `$module_file`, rồi `parse(\'main\')` và `text(\'main\')`.',
          ].join('\n')
      : future
        ? `Site and admin templates use NVSmarty under the future themes. Strings go through \`{$LANG->getModule('key')}\`.`
        : `Site and admin templates use XTemplate BEGIN/END blocks and \`{LANG.key}\`.`,
  }
}

function scaffoldFail(task: MockTask, root: string, vi: boolean): MockTurnResult {
  const file = `${root}/version.php`
  return {
    status: 'failed',
    summary: vi
      ? `Khung đã ghi nhưng \`php -l\` dừng ở \`${file}\`: thiếu dấu phẩy trong mảng phiên bản. Sẽ thử lại.`
      : `Skeleton written, but \`php -l\` failed in \`${file}\` (missing comma). Retrying.`,
    tools: [
      { id: 't-write', title: vi ? `Ghi khung ${root}` : `Write ${root}`, kind: 'edit' },
      { id: 't-lint', title: `php -l ${file}`, kind: 'execute' },
    ],
    logs: [
      { level: 'info', message: `write ${root}/functions.php` },
      { level: 'error', message: `PHP Parse error: syntax error, unexpected token "]" in ${file} on line 18` },
    ],
    text: vi
      ? [
          `## php -l`,
          '',
          '```text',
          `PHP Parse error: syntax error, unexpected token "]" in ${file} on line 18`,
          'Errors parsing version.php',
          '```',
          '',
          'Dòng `' + "'virtual' => 1" + '` thiếu dấu phẩy trước `' + "'version'" + '`. Các file khác không bị ghi đè ở lần thử này.',
          '',
          '| Tệp | Trạng thái |',
          '| --- | --- |',
          `| ${file} | lỗi cú pháp |`,
          `| ${root}/functions.php | đã ghi |`,
          `| ${root}/admin/main.php | đã ghi |`,
          `| ${root}/language/${task.version === '5.x' ? 'vi.php' : 'admin_vi.php'} | đã ghi |`,
        ].join('\n')
      : [
          `## php -l`,
          '',
          '```text',
          `PHP Parse error: syntax error, unexpected token "]" in ${file} on line 18`,
          '```',
          '',
          'Missing comma after `virtual`. Other files were left in place.',
        ].join('\n'),
  }
}

function scaffoldOk(task: MockTask, root: string, vi: boolean): MockTurnResult {
  const file = `${root}/version.php`
  return {
    status: 'ok',
    summary: vi
      ? `Lần 2: đã thêm dấu phẩy trong \`${file}\`. \`php -l\` sạch trên cả khung.`
      : `Attempt 2: comma restored in \`${file}\`. \`php -l\` is clean.`,
    tools: [
      { id: 't-fix', title: vi ? `Sửa ${file}` : `Patch ${file}`, kind: 'edit' },
      { id: 't-lint2', title: `php -l ${root}`, kind: 'execute' },
    ],
    logs: [{ level: 'info', message: 'php -l: No syntax errors detected' }],
    text: vi
      ? [
          `## Sửa version.php`,
          '',
          '```diff',
          `--- a/${file}`,
          `+++ b/${file}`,
          '@@',
          "-    'virtual' => 1",
          "+    'virtual' => 1,",
          "     'version' => '" + (task.version === '5.x' ? '5.0.00' : '4.5.00') + "',",
          '```',
          '',
          '```text',
          `No syntax errors detected in ${file}`,
          '```',
          '',
          'Khung bám skeleton ' + (task.version === '5.x' ? '`templates/module-5x`' : '`templates/module-4x`') + '.',
        ].join('\n')
      : [
          '```diff',
          `-    'virtual' => 1`,
          `+    'virtual' => 1,`,
          '```',
          '',
          '`php -l` reports no syntax errors.',
        ].join('\n'),
  }
}

function backend(task: MockTask, root: string, vi: boolean): MockTurnResult {
  const csrf = task.version === '5.x' ? 'csrf_create / csrf_check' : 'md5(NV_CHECK_SESSION …)'
  return {
    status: 'ok',
    summary: vi
      ? `Schema và CRUD admin đã vào \`${root}/action_mysql.php\`. CSRF kiểu ${task.version}: ${csrf}.`
      : `Schema and admin CRUD are in place. CSRF follows the ${task.version} pattern.`,
    tools: [
      { id: 't-sql', title: vi ? 'Viết action_mysql.php' : 'Write action_mysql.php', kind: 'edit' },
      { id: 't-crud', title: vi ? 'Viết admin/content.php' : 'Write admin/content.php', kind: 'edit' },
    ],
    logs: [{ level: 'info', message: `csrf=${csrf}` }],
    text: vi
      ? [
          `## CSDL`,
          '',
          'Hai bảng theo ngôn ngữ, tiền tố `' + prefix(task.version) + '`. Không dùng `INSERT ... ON DUPLICATE KEY UPDATE` để nhét cấu hình lúc chạy.',
          '',
          '| Bảng | Khóa |',
          '| --- | --- |',
          `| _${task.module} | id, alias UNIQUE |`,
          `| _${task.module}_config | config_name UNIQUE |`,
          '',
          'Chuỗi tìm kiếm đi qua `prepare()` + `bindParam()`. `id` ép `(int)` rồi nối thẳng.',
          '',
          `Mọi POST admin kiểm tra ${csrf} trước khi ghi.`,
        ].join('\n')
      : [
          'Language-prefixed tables only. User strings use prepared statements. Integers are cast. POST handlers check CSRF before writes.',
        ].join('\n'),
  }
}

function language(task: MockTask, root: string, vi: boolean): MockTurnResult {
  const files = task.version === '5.x'
    ? [`${root}/language/vi.php`, `${root}/language/en.php`]
    : [`${root}/language/vi.php`, `${root}/language/admin_vi.php`, `${root}/language/en.php`, `${root}/language/admin_en.php`]
  return {
    status: 'ok',
    summary: vi
      ? task.version === '5.x'
        ? 'Một file `language/vi.php` dùng chung site và admin. Code gọi `$nv_Lang->getModule()`, không đọc `$lang_module` trực tiếp.'
        : 'Tách `language/vi.php` (site) và `language/admin_vi.php` (admin). Code đọc `$lang_module`.'
      : task.version === '5.x'
        ? 'Single `language/vi.php`. Call sites use `$nv_Lang->getModule()`.'
        : 'Separate site and admin language files. Call sites use `$lang_module`.',
    tools: files.map((file, index) => ({ id: `t-lang-${index}`, title: file, kind: 'edit' as const })),
    logs: [{ level: 'info', message: `lang files=${files.length}` }],
    text: vi
      ? [
          `## Từ điển`,
          '',
          ...files.map((file) => `- \`${file}\``),
          '',
          task.version === '5.x'
            ? 'Trong tpl: `{$LANG->getModule(\'main\')}`. Trong PHP: `$nv_Lang->getModule(\'main\')`. File vẫn khai báo `$lang_module` vì đó là định dạng nạp của NukeViet 5.'
            : 'Site assign `$lang_module` từ `vi.php`. Admin nạp `admin_vi.php` vào cùng biến `$lang_module` khi ở khu vực quản trị. Không gộp hai file.',
          '',
          '| Key | vi |',
          '| --- | --- |',
          '| main | Tin tức |',
          '| add | Thêm tin |',
          '| error_alias | Alias đã tồn tại |',
        ].join('\n')
      : files.map((file) => `- \`${file}\``).join('\n'),
  }
}

function gate(task: MockTask, root: string, vi: boolean): MockTurnResult {
  const style = task.version === '5.x' ? 'PSR-12' : 'PSR-2'
  const input = task.version === '5.x' ? '$nv_Request' : '$nv_Request (không $_POST)'
  const csrf = task.version === '5.x' ? 'csrf_check' : 'NV_CHECK_SESSION'
  return {
    status: 'ok',
    branch: 'review',
    summary: vi
      ? [
          'Cổng kiểm tra **đạt**. Nhánh sửa không kích hoạt.',
          '',
          '| Hạng mục | Kết quả |',
          '| --- | --- |',
          '| php -l | đạt |',
          `| ${style} | đạt |`,
          '| SQL prepare | đạt |',
          `| CSRF (${csrf}) | đạt |`,
        ].join('\n')
      : `Gate passed. Branch **review**. php -l, ${style}, prepared SQL, and CSRF are clean.`,
    tools: [
      { id: 't-php', title: `php -l ${root}`, kind: 'execute' },
      { id: 't-grep', title: vi ? 'Quét $_GET/$_POST, csrf, unserialize' : 'Scan superglobals, csrf, unserialize', kind: 'search' },
    ],
    logs: [
      { level: 'info', message: 'php -l clean' },
      { level: 'info', message: `style=${style}` },
      { level: 'info', message: 'branch=review' },
    ],
    text: vi
      ? [
          `## Quyết định`,
          '',
          'Đi tiếp sang **Review / Test**. Nhánh **Sửa & chạy lại** được bỏ qua vì không còn lỗi chặn.',
          '',
          '| Hạng mục | Kết quả | Ghi chú |',
          '| --- | --- | --- |',
          '| php -l | đạt | không còn Parse error |',
          `| ${style} | đạt | 4 spaces, LF, UTF-8 |`,
          `| Input ${input} | đạt | không thấy superglobal |`,
          '| SQL | đạt | chuỗi dùng prepare |',
          '| XSS | đạt | không echo dữ liệu thô |',
          `| CSRF | đạt | ${csrf} |`,
          '| Khung file | đạt | đúng skeleton phiên bản |',
          '',
          `Phạm vi quét: \`${root}\` và tpl của module. Không đụng module khác.`,
        ].join('\n')
      : [
          '## Decision',
          '',
          'Continue to **Review / Test**. The fix branch stays unused.',
          '',
          '| Check | Result |',
          '| --- | --- |',
          '| php -l | pass |',
          `| ${style} | pass |`,
          '| Input | pass |',
          '| SQL | pass |',
          `| CSRF (${csrf}) | pass |`,
          '| Skeleton | pass |',
        ].join('\n'),
  }
}

function review(task: MockTask, root: string, vi: boolean): MockTurnResult {
  return {
    status: 'ok',
    summary: vi
      ? `Review xong. Cài module \`${task.module}\` trong Quản trị > Modules. Chưa chạy acceptance test trên trình duyệt.`
      : `Review complete. Install \`${task.module}\` from Admin > Modules. Browser acceptance tests were not run.`,
    tools: [{ id: 't-diff', title: vi ? 'Đọc diff khung module' : 'Read module diff', kind: 'read' }],
    logs: [{ level: 'info', message: 'acceptance=skipped (needs a running site)' }],
    text: vi
      ? [
          `## Review`,
          '',
          `- Khung \`${root}\` khớp NukeViet ${task.version}.`,
          '- Lỗi cú pháp ở lần thử đầu đã được sửa, không còn trong diff cuối.',
          '- Chưa chạy Codeception. Cần site local và sự đồng ý trước khi cài đè CSDL test.',
          '',
          'Bước tiếp theo của người dùng: zip module hoặc copy vào site, rồi kích hoạt trong quản trị.',
        ].join('\n')
      : `The ${task.version} skeleton matches the pack. The first-attempt syntax error is gone. Codeception was not executed.`,
  }
}

function fix(task: MockTask, root: string, vi: boolean): MockTurnResult {
  return {
    status: 'ok',
    summary: vi ? `Đã sửa các mục cổng đánh dấu trong \`${root}\`.` : `Applied the gate fixes under \`${root}\`.`,
    tools: [{ id: 't-fix', title: root, kind: 'edit' }],
    logs: [{ level: 'info', message: 'fix branch' }],
    text: vi ? `Sửa trong \`${root}\` rồi trả lại cổng kiểm tra.` : `Patched \`${root}\` and returned control to the gate.`,
  }
}

function chatTurn(task: MockTask): MockTurnResult {
  const vi = task.lang !== 'en'
  const q = task.text.toLowerCase()
  let text: string
  if (/smarty|xtemplate|template|giao diện/.test(q)) {
    text = task.version === '5.x'
      ? vi
        ? 'NukeViet 5 trong studio này dùng **Smarty** (`NVSmarty`) cho theme `future` / `admin_future`. XTemplate còn trong một số khu vực cũ; module mới không dùng `<!-- BEGIN: main -->`.'
        : 'This studio targets **Smarty** (`NVSmarty`) for NukeViet 5 future themes. New modules should not use XTemplate blocks.'
      : vi
        ? 'NukeViet 4 dùng **XTemplate**. Cú pháp là `<!-- BEGIN: main -->`, biến `{LANG.key}`. Không dùng Smarty hay `$nv_Lang`.'
        : 'NukeViet 4 uses **XTemplate** (`<!-- BEGIN: main -->`, `{LANG.key}`). Do not use Smarty or `$nv_Lang`.'
  } else if (/admin_vi|ngôn ngữ|language|\$nv_lang|\$lang_module/.test(q)) {
    text = task.version === '5.x'
      ? vi
        ? 'NukeViet 5 gom site và admin vào **một** `language/vi.php`. File vẫn gán `$lang_module`, nhưng code gọi `$nv_Lang->getModule()`. Không tạo `admin_vi.php`.'
        : 'NukeViet 5 uses a single `language/vi.php`. The file still assigns `$lang_module`; call sites use `$nv_Lang->getModule()`. There is no `admin_vi.php`.'
      : vi
        ? 'NukeViet 4 tách **`language/vi.php`** (ngoài site) và **`language/admin_vi.php`** (quản trị). Cả hai đổ vào `$lang_module` đúng khu vực. Chưa có `$nv_Lang`.'
        : 'NukeViet 4 splits `language/vi.php` and `language/admin_vi.php`, both feeding `$lang_module`. `$nv_Lang` does not exist.'
  } else if (/block|\.ini|\.json/.test(q)) {
    text = task.version === '5.x'
      ? vi
        ? 'Block NukeViet 5 khai báo bằng **JSON** (`global.<tên>.json`: info, config, datafunction, submitfunction, i18n). Đuôi `.ini` là thói quen 4.x.'
        : 'NukeViet 5 block config is **JSON**. The `.ini` extension belongs to 4.x.'
      : vi
        ? 'Block NukeViet 4 dùng file **`.ini` nhưng nội dung là XML** `<block>…</block>`, không phải INI thường. Từ 4.6 có thêm JSON; skeleton 4.x của studio giữ `.ini` để chạy được cả dòng 4.'
        : 'NukeViet 4 block config uses a `.ini` extension whose body is XML. This studio keeps that form so the whole 4.x line can load it.'
  } else if (/khác|difference|4\.x|5\.x|phiên bản/.test(q)) {
    text = vi
      ? 'Khác biệt đang áp cho dự án này nằm ở tab **Workflow** bên phải: thư mục `src/` hay gốc repo, PSR, template, ngôn ngữ, và đuôi file cấu hình block. Đổi phiên bản bằng `/version 4` hoặc `/version 5`.'
      : 'The active version card is on the Workflow tab: `src/` vs repository root, coding standard, template engine, language files, and block config. Switch with `/version 4` or `/version 5`.'
  } else {
    text = vi
      ? `Mình đang ở dự án **${task.title}** (${task.module}, NukeViet ${task.version}), agent Mock ACP. Gõ \`/run\` để chạy workflow module, \`/workflow\` để xem các bước, \`/help\` để liệt kê lệnh.`
      : `Project **${task.title}** (${task.module}, NukeViet ${task.version}), Mock ACP. Use \`/run\` to start the module workflow, \`/workflow\` for the steps, \`/help\` for commands.`
  }
  return {
    status: 'ok',
    summary: text,
    text,
    tools: [],
    logs: [{ level: 'info', message: 'mock chat' }],
  }
}

function prefix(version: NvVersion): string {
  return version === '5.x' ? 'NV_PREFIXLANG' : 'NV_PREFIXLANG'
}

export function chunkText(text: string, size = 28): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size))
  return chunks.length ? chunks : ['']
}

export type { Lang }
