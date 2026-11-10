import type { Lang, NvVersion, Project } from './types'
import { knowledgeFor, moduleRoot } from './workflow'

export interface PromptContext {
  kind: 'node' | 'chat'
  nodeId?: string
  attempt: number
  project: Project
  lang: Lang
  userText?: string
  spec?: string
}

export function buildPrompt(ctx: PromptContext): string {
  const task = {
    kind: ctx.kind,
    nodeId: ctx.nodeId,
    attempt: ctx.attempt,
    version: ctx.project.version,
    module: ctx.project.module,
    title: ctx.project.name,
    lang: ctx.lang,
  }
  const rules = versionCard(ctx.project.version)
  const files = ctx.nodeId ? knowledgeFor(ctx.nodeId, ctx.project.version) : knowledgeFor('analyze', ctx.project.version)
  const root = moduleRoot(ctx.project.version, ctx.project.module)
  const lines = [
    `NVAS_TASK ${JSON.stringify(task)}`,
    '',
    'Bạn là tác nhân lập trình trong NukeViet Agent Studio.',
    'Chỉ dùng convention của đúng phiên bản được giao. Không trộn NukeViet 4 và NukeViet 5.',
    'Không chạy git reset, git clean, git stash. Không ghi đè file ngoài phạm vi module.',
    '',
    rules,
    '',
    `Dự án: ${ctx.project.name}`,
    `Module: ${ctx.project.module}`,
    `Thư mục module: ${root}`,
    `Đường dẫn làm việc: ${ctx.project.path}`,
    `Lần thử: ${ctx.attempt}`,
    '',
    'Tài liệu nên đọc trước khi sửa:',
    ...files.map((file) => `- ${file}`),
  ]
  if (ctx.kind === 'node') {
    lines.push('', 'Nhiệm vụ của bước này:', ctx.spec?.trim() || ctx.nodeId || '', '', 'Khi xong, dòng cuối cùng phải là `NVAS_STATUS: ok` hoặc `NVAS_STATUS: failed`.', 'Nếu đây là cổng quyết định, thêm `NVAS_BRANCH: review` hoặc `NVAS_BRANCH: fix`.')
  } else {
    lines.push('', 'Hội thoại với người dùng:', ctx.userText?.trim() || '')
  }
  return lines.join('\n')
}

export function versionCard(version: NvVersion): string {
  if (version === '5.x') {
    return [
      'NukeViet 5.x',
      '- Mã nguồn nằm trong src/. Module tại src/modules/<tên>.',
      '- PHP 8.2+, PSR-12, 4 spaces, comment tiếng Việt.',
      '- Template Smarty qua \\NukeViet\\Template\\NVSmarty. Hằng trong tpl: {$smarty.const.TEN_HANG}.',
      '- Ngôn ngữ qua $nv_Lang->getModule() / getGlobal(). Một file language/vi.php cho cả site và admin. File vẫn gán $lang_module, code không đọc mảng trực tiếp.',
      '- Block config đuôi .json (info, config, datafunction, submitfunction, i18n).',
      '- Input chỉ qua $nv_Request. SQL chuỗi dùng prepare + bindParam. Số nguyên cast (int).',
      '- CSRF: csrf_create($csrf_key) và csrf_check($token, $csrf_key).',
      '- Output thô: nv_htmlspecialchars(). Dữ liệu từ get_title() đã escape, không escape lần nữa.',
      '- Cache đọc: $nv_Cache->db(). Không dùng $db_slave.',
      '- Bảng theo ngôn ngữ: NV_PREFIXLANG . "_<module>". Bảng chung: NV_TABLEPREFIX.',
    ].join('\n')
  }
  return [
    'NukeViet 4.x',
    '- Mã nguồn ở gốc repository, không có thư mục src/. Module tại modules/<tên>.',
    '- PHP 7.4+. Không dùng cú pháp chỉ có từ PHP 8 (union type, match, nullsafe, named arguments, enum).',
    '- PSR-2, 4 spaces, UTF-8 không BOM, xuống dòng LF.',
    '- Template XTemplate. Khối <!-- BEGIN: main --> / <!-- END: main -->. Biến {LANG.key}, {GLANG.key}.',
    '- Ngôn ngữ: $lang_module. Site dùng language/vi.php. Admin dùng language/admin_vi.php riêng.',
    '- Block config đuôi .ini. Nội dung là XML <block><info><config><datafunction><submitfunction>.',
    '- Ngôn ngữ block: language/block.global.<tên>_vi.php.',
    '- Input qua $nv_Request. Không đọc $_GET/$_POST/$_REQUEST.',
    '- CSRF kiểu 4.x: $checkss = md5(NV_CHECK_SESSION . "_" . $module_name . "_" . $op . "_" . $admin_info["userid"]).',
    '- Có thể còn $db_slave cho đọc. Bảng: NV_PREFIXLANG . "_" . $module_data.',
  ].join('\n')
}

export function specFor(nodeId: string, version: NvVersion, module: string, title: string): string {
  const root = moduleRoot(version, module)
  const tpl = version === '5.x' ? 'Smarty / NVSmarty, theme future và admin_future' : 'XTemplate, theme default và admin_default'
  const lang = version === '5.x' ? 'một file language/vi.php, đọc bằng $nv_Lang' : 'language/vi.php và language/admin_vi.php, đọc bằng $lang_module'
  const block = version === '5.x' ? 'blocks/global.latest.json' : 'blocks/global.latest.ini (XML)'
  const standard = version === '5.x' ? 'PSR-12, PHP 8.2+' : 'PSR-2, PHP 7.4+'
  const specs: Record<string, string> = {
    analyze: `Phân tích yêu cầu module "${title}" (\`${module}\`) trên NukeViet ${version}. Liệt kê func, bảng, quyền admin, và các file sẽ tạo dưới \`${root}\`. Chưa ghi mã.`,
    theme: `Thiết kế giao diện cho module \`${module}\`. Engine: ${tpl}. Nêu layout danh sách, form, và block mới. Không trộn cú pháp template của phiên bản kia.`,
    scaffold: `Tạo khung module tại \`${root}\` từ skeleton templates/module-${version === '5.x' ? '5x' : '4x'}. Đủ version.php, functions, admin, funcs/main.php, action_mysql.php, ${lang}, ${block}.`,
    backend: `Viết schema trong action_mysql.php và luồng CRUD admin. Mọi chuỗi người dùng đi qua prepare(). Mọi POST có kiểm tra CSRF đúng kiểu ${version}.`,
    lang: `Điền từ điển cho module \`${module}\`. ${lang}. Key đặt tiếng Anh, giá trị tiếng Việt (và en nếu có).`,
    gate: `Cổng kiểm tra. Chạy php -l, đối chiếu ${standard}, và checklist bảo mật (input, SQL, XSS, CSRF, file). Chọn nhánh review nếu đạt, nhánh fix nếu còn lỗi chặn.`,
    review: `Tổng hợp diff, rủi ro còn lại, và cách cài module trong Quản trị > Modules. Không mở rộng phạm vi.`,
    fix: `Sửa đúng các mục cổng kiểm tra đánh dấu lỗi. Giữ nguyên phần đã đạt. Sau đó trả lại cổng.`,
  }
  return specs[nodeId] ?? nodeId
}
