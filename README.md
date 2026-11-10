# NukeViet Agent Studio

Harness lập trình trên desktop cho NukeViet CMS. Ứng dụng là **ACP client**: chat orchestrator gọi agent qua [Agent Client Protocol](https://agentclientprotocol.com), mỗi bước của workflow chạy bằng một agent chuyên biệt, và inspector giữ spec, output, transcript, log.

Giao diện mặc định là tiếng Việt. Chuyển English trong Cài đặt → Ngôn ngữ (`vi` / `en`).

## ADE

Studio là môi trường lập trình cho agent (ADE), cùng kiểu dự án / hội thoại / worktree với T3 Code và Conductor. Canvas workflow, Inspector và Runs vẫn nằm trong chế độ **Workflow** của từng hội thoại.

- **Dự án.** Sidebar trái. Mở thư mục bằng hộp thoại hệ thống. Clone repository (URL, nhánh, thư mục đích, tiến trình `git clone` chạy trực tiếp). Dự án gần đây được ghi vào `userData/nvas-ade.json`. Thư mục NukeViet được gắn nhãn **4.x** hoặc **5.x** (5.x có `src/`, Smarty, chỉ `vi.php`; 4.x có XTemplate và `admin_vi.php`). Nhánh git và dấu thay đổi chưa commit hiện cạnh tên dự án.
- **Hội thoại.** Mỗi dự án có nhiều chat. Nút **Cuộc trò chuyện mới** và `Ctrl/Cmd+N`. Đổi tên, xóa, tự đặt tiêu đề từ tin nhắn đầu. Mỗi hội thoại giữ một phiên ACP riêng, cwd là thư mục dự án (hoặc worktree). Chọn agent: Mock ACP, Claude Code, Codex, Gemini CLI, hoặc lệnh tùy chỉnh.
- **Workspace.** Cây thư mục, diff (`git diff` + file mới) với Accept (stage) và Revert theo file, terminal xterm.js. Có thể tạo git worktree/nhánh `nvas/…` cho một hội thoại.
- **Workflow.** Tab Chat | Workflow | Diff | Terminal. Workflow chạy trên thư mục thật. Gói kiến thức và skeleton 4.x / 5.x giữ nguyên. Trên NukeViet 5, Mock ACP ghi module `contactbook` (CRUD admin + trang site) và theme `studio` (copy `default` + CSS riêng).
- **Lệnh.** `Ctrl/Cmd+K` mở bảng lệnh. Trong chat: `/run`, `/stop`, `/module contactbook`, `/version 5`, `/help`.
- **Cài đặt.** Gateway OpenAI-compatible mặc định `https://bedrock.viber.vn/v1`. API key nằm trong `safeStorage` (hoặc AES trong `userData` nếu máy không có keyring) và được đưa vào env của agent. Lệnh từng agent sửa trong Cài đặt → Tác nhân ACP.

Terminal dùng PTY qua Python (`pty.fork`) vì `node-pty` cần biên dịch native. Nếu không có `python3`, studio rơi về shell pipe.

## Vì sao Electron

SDK chính thức `@agentclientprotocol/sdk` là TypeScript và nói chuyện với agent bằng JSON-RPC trên stdio. Tiến trình main của Electron là Node, nên spawn Claude Code, Codex, Gemini CLI và mock agent là một lệnh `spawn` cộng `ndJsonStream`. Tauri buộc phải viết client ACP bằng Rust hoặc nhét một sidecar Node. Electron cũng có `safeStorage` (DPAPI trên Windows, Keychain trên macOS, libsecret trên Linux) để giữ API key ngoài repo.

## Yêu cầu

- Node.js 22+
- npm 10+
- Để chạy agent thật: Claude Code qua `@agentclientprotocol/claude-agent-acp`, Codex qua `@agentclientprotocol/codex-acp`, hoặc Gemini CLI (`gemini --acp`)

Mock ACP được bundle sẵn. Không cần API key để xem hết vòng workflow.

## Cài và chạy

```bash
npm install
npm run dev
```

`npm run dev` bundle mock agent rồi mở cửa sổ Electron. Renderer Vite dùng cổng **43123**.

Chỉ xem giao diện trên trình duyệt (mock chạy trong trang, không spawn process ACP):

```bash
npm run dev:web
```

Mở http://127.0.0.1:43123/ . Thêm `?autodemo=1` để tự chạy workflow.

```bash
npm test
npm run build
```

## Demo

Dự án mẫu **Tin tức** (`news`) gắn NukeViet **5.x**. Gõ `/run` hoặc bấm **Chạy**.

Workflow `Module NukeViet`:

1. Phân tích yêu cầu (`analyst`)
2. Thiết kế UI/theme (`theme`)
3. Tạo khung module (`module`) — `php -l` lỗi một lần vì thiếu dấu phẩy trong `version.php`, rồi thử lại và xong ở lần 2
4. Backend PHP/DB (`backend`)
5. Ngôn ngữ (`i18n`)
6. Gate kiểm tra (`decision-gate`) — php -l, chuẩn mã, input, SQL, CSRF. Nhánh **review** được chọn, nhánh **sửa** bị bỏ qua
7. Review / Test (`review`)

Panel dưới lọc Active / Cần chú ý / Trực tiếp / Đã xong / Tất cả. Bấm một run để mở tab của nó.

Lệnh trong ô chat: `/run`, `/stop`, `/workflow`, `/version 4`, `/version 5`, `/project`, `/knowledge`, `/clear`, `/help`.

## Gateway và model

Cài đặt → Mô hình. Mặc định là gateway OpenAI-compatible [https://bedrock.viber.vn/v1](https://bedrock.viber.vn/v1) (NewAPI), chế độ **Cả hai** để ghi đồng thời biến Anthropic và OpenAI.

Model gợi ý:

- `claude-sonnet-4-6`
- `claude-opus-4-6`
- `claude-haiku-4-5-20251001`

API key bấm **Lưu key**. Bản Electron ghi bằng `safeStorage` (keychain hệ điều hành). Nếu máy Linux không có keyring, key được mã hóa AES-256-GCM, khóa nằm trong `userData/master.key` (quyền `0600`). Bản `dev:web` chỉ giữ key trong bộ nhớ của tab, không ghi đĩa và không đưa vào `localStorage`. Key không bao giờ vào git, log, hay prompt.

Khi spawn agent, process nhận:

| Biến | Khi nào |
| --- | --- |
| `ANTHROPIC_BASE_URL` | chế độ Anthropic hoặc Cả hai |
| `ANTHROPIC_AUTH_TOKEN` | có key, cùng chế độ |
| `ANTHROPIC_API_KEY` | cùng giá trị, vì một số adapter đọc tên này |
| `ANTHROPIC_MODEL` | model đang chọn |
| `OPENAI_BASE_URL` | chế độ OpenAI hoặc Cả hai |
| `OPENAI_API_KEY` | có key, cùng chế độ |
| `OPENAI_MODEL` | model đang chọn |

**Kiểm tra kết nối** gọi `GET {base}/models` (hoặc `{base}/v1/models` nếu base chưa kết thúc bằng `/v1`) với `Authorization: Bearer`.

## Agent ACP

Cài đặt → Tác nhân ACP. Lệnh mặc định:

| Agent | Lệnh |
| --- | --- |
| Mock ACP | process nội bộ `agents/dist/mock-acp-agent.mjs` |
| Claude Code | `npx -y @agentclientprotocol/claude-agent-acp` |
| Codex | `npx -y @agentclientprotocol/codex-acp` |
| Gemini CLI | `gemini --acp` |

Tên cũ `claude-code-acp` là adapter đời trước. Gói hiện tại của ACP là `@agentclientprotocol/claude-agent-acp` (binary `claude-agent-acp`). Sửa lệnh trong cài đặt nếu máy bạn dùng wrapper khác.

Client dùng `client()` + `ndJsonStream` của `@agentclientprotocol/sdk`: `initialize`, `session/new`, `session/prompt`, và nhận `session/update` (text, tool call). Mock agent là phía `agent()` của cùng SDK, nói đúng protocol trên stdio. `npm test` có một ca spawn mock agent thật.

Prompt của mỗi bước có dòng `NVAS_TASK`, thẻ phiên bản, và yêu cầu kết thúc bằng `NVAS_STATUS: ok|failed`. Cổng kiểm tra thêm `NVAS_BRANCH: review|fix`. Agent thật làm được việc nếu tuân hai dòng đó; không có dòng trạng thái thì bước được coi là xong.

## NukeViet 4.x và 5.x

Mỗi dự án chọn một phiên bản. Prompt và tab Workflow đổi theo lựa chọn đó.

| | 4.x | 5.x |
| --- | --- | --- |
| Mã | gốc repository | `src/` |
| PHP | 7.4+ | 8.2+ |
| Chuẩn | PSR-2 | PSR-12 |
| Template | XTemplate | Smarty (`NVSmarty`) |
| Ngôn ngữ | `$lang_module`, `admin_vi.php` riêng | `$nv_Lang`, một `language/vi.php` |
| Block | `.ini` (thân XML) | `.json` |

Gói **5.x** là bản sao `CLAUDE.md`, `docs/knowledge` và `.claude/skills` từ nhánh `nukeviet5.0` của [nukeviet/nukeviet](https://github.com/nukeviet/nukeviet) (commit `6aa0b3c`), giấy phép GPL-2.0-or-later. Xem `knowledge/nukeviet5/ATTRIBUTION.md`. Skill gồm `new-module`, `new-block`, `new-api`, `security-audit`, `migrate2future`, và các skill cùng thư mục.

Gói **4.x** là tóm tắt viết cho studio từ [wiki NukeViet](https://wiki.nukeviet.vn/), nằm ở `knowledge/nukeviet4/`.

Skeleton:

- `templates/module-5x/` — copy vào cây `src/`
- `templates/module-4x/` — copy vào gốc site 4.x

Đổi `__MODULE__`, `__MODULE_UPPER__`, `__TITLE__`, `__AUTHOR__` trước khi dùng. File ngôn ngữ 5.x vẫn gán `$lang_module` vì đó là định dạng nạp; code và tpl gọi `$nv_Lang`.

## Đóng gói

```bash
npm run dist
```

`electron-builder` ghi vào `release/`. Cấu hình ở `electron-builder.yml`.

- **Windows (ưu tiên):** target `nsis` và `portable`. Chạy `npm run dist` trên Windows để ra `NukeViet Agent Studio Setup <version>.exe`. Bộ cài NSIS cho chọn thư mục. Bản portable không cần cài.
- **macOS:** target `dmg`. Cần ký và notarize nếu phát hành ngoài máy mình; bản local mở bằng chuột phải → Open lần đầu.
- **Linux:** `AppImage` và `deb`.

Build chéo (ra file Windows từ Linux) cần Wine và toolchain NSIS. Cách chắc là build từng hệ trên chính hệ đó, hoặc CI matrix ba OS. `npm run build` chỉ ra thư mục `out/` (main, preload, renderer) và không tạo installer.

Key người dùng nằm trong `userData` của Electron, không nằm trong gói cài.

## Cấu trúc

```
src/main          tiến trình Electron: cửa sổ, ACP, keychain
src/preload       cầu IPC
src/renderer      React, canvas, chat, inspector
src/shared        workflow, prompt, mock script, engine
agents            mock ACP agent
knowledge         gói 4.x và 5.x
templates         skeleton module
```

## Giấy phép tài liệu NukeViet

File trong `knowledge/nukeviet5/` (trừ README và ATTRIBUTION của studio) thuộc NukeViet, GPL-2.0-or-later. Phần ứng dụng còn lại là mã của studio này.
