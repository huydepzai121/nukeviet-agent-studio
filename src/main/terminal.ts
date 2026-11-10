import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'

const PTY_SOURCE = `
import os, sys, pty, select, errno, struct, fcntl, termios
cwd = sys.argv[1]
shell = "/bin/bash" if os.path.exists("/bin/bash") else (os.environ.get("SHELL") or "/bin/sh")
os.environ["TERM"] = "xterm-256color"
os.environ["PS1"] = "\\\\[\\\\e[38;5;150m\\\\]\\\\w\\\\[\\\\e[0m\\\\] $ "
pid, fd = pty.fork()
if pid == 0:
    try:
        os.chdir(cwd)
    except OSError:
        pass
    os.execv(shell, [shell, "--noprofile", "--norc", "-i"])
else:
    stdin = sys.stdin.fileno()
    stdout = sys.stdout.fileno()
    ctrl = None
    try:
        os.fstat(3)
        ctrl = 3
    except OSError:
        ctrl = None
    try:
        os.set_blocking(stdin, False)
        os.set_blocking(fd, False)
        if ctrl is not None:
            os.set_blocking(ctrl, False)
    except Exception:
        pass
    def resize(data):
        parts = data.strip().split()
        if len(parts) != 2:
            return
        cols, rows = int(parts[0]), int(parts[1])
        if cols < 2 or rows < 2 or cols > 500 or rows > 200:
            return
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    while True:
        try:
            watch = [stdin, fd] if ctrl is None else [stdin, fd, ctrl]
            ready, _, _ = select.select(watch, [], [], 0.4)
        except Exception:
            break
        if stdin in ready:
            try:
                data = os.read(stdin, 8192)
            except OSError:
                data = b""
            if data:
                try:
                    os.write(fd, data)
                except OSError:
                    break
        if ctrl in ready:
            try:
                data = os.read(ctrl, 256)
            except OSError:
                data = b""
            if data:
                try:
                    resize(data.decode("utf-8", "ignore"))
                except Exception:
                    pass
        if fd in ready:
            try:
                data = os.read(fd, 8192)
            except OSError as exc:
                if exc.errno == errno.EIO:
                    break
                data = b""
            if not data:
                break
            try:
                os.write(stdout, data)
            except OSError:
                break
        waited, _ = os.waitpid(pid, os.WNOHANG)
        if waited:
            break
`

export interface TerminalSession {
  id: string
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => void
  onData: (listener: (data: string) => void) => () => void
}

let seq = 0

export function startTerminal(cwd: string): TerminalSession {
  const id = `term-${++seq}`
  const listeners = new Set<(data: string) => void>()
  const emit = (data: string) => {
    for (const listener of listeners) listener(data)
  }
  const root = fs.existsSync(cwd) ? cwd : process.cwd()
  let child: ChildProcessWithoutNullStreams | null = null
  let mode: 'pty' | 'pipe' = 'pty'
  try {
    child = spawn('python3', ['-u', '-c', PTY_SOURCE, root], {
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
      env: process.env,
    }) as ChildProcessWithoutNullStreams
  } catch {
    mode = 'pipe'
  }
  if (!child) {
    mode = 'pipe'
    child = spawn(process.env.SHELL || '/bin/bash', ['-i'], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, TERM: 'xterm-256color' },
    }) as ChildProcessWithoutNullStreams
  }
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => emit(chunk))
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => emit(chunk))
  child.on('exit', (code) => emit(`\r\n[process exited ${code ?? 0}]\r\n`))
  if (mode === 'pipe') emit('\r\n[pipe shell — python pty unavailable]\r\n')
  return {
    id,
    write: (data) => child?.stdin.write(data),
    resize: (cols, rows) => {
      const pipe = child?.stdio[3]
      if (pipe && 'write' in pipe) pipe.write(`${cols} ${rows}\n`)
    },
    kill: () => child?.kill('SIGTERM'),
    onData: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
