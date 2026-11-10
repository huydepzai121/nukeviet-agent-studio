import fs from 'node:fs'
import path from 'node:path'
import { moduleFiles, themeOverlayFiles, type BlueprintFile } from '../shared/blueprint'

export interface WriteTask {
  nodeId?: string
  attempt: number
  version: string
  module: string
  title: string
}

function writeAll(root: string, files: BlueprintFile[]): string[] {
  const written: string[] = []
  for (const file of files) {
    const abs = path.join(root, file.path)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, file.contents)
    written.push(file.path)
  }
  return written
}

function installTheme(root: string): string[] {
  const source = path.join(root, 'src', 'themes', 'default')
  const dest = path.join(root, 'src', 'themes', 'studio')
  const written: string[] = []
  if (fs.existsSync(source)) {
    fs.cpSync(source, dest, { recursive: true })
    const config = path.join(dest, 'config.ini')
    if (fs.existsSync(config)) {
      const xml = fs
        .readFileSync(config, 'utf8')
        .replace('<name>NukeViet Default</name>', '<name>Studio</name>')
        .replace(
          /<description>[\s\S]*?<\/description>/,
          '<description>Giao diện Studio: layout của default, CSS và header riêng cho NukeViet Agent Studio.</description>',
        )
      fs.writeFileSync(config, xml)
      written.push('src/themes/studio/config.ini')
    }
    written.push('src/themes/studio/')
  } else {
    fs.mkdirSync(path.join(dest, 'layout'), { recursive: true })
    fs.mkdirSync(path.join(dest, 'css'), { recursive: true })
    fs.writeFileSync(
      path.join(dest, 'config.ini'),
      `<?xml version="1.0" encoding="utf-8"?>
<theme>
    <info>
        <name>Studio</name>
        <author>NukeViet Agent Studio</author>
        <description>Theme Studio</description>
    </info>
    <layoutdefault>content</layoutdefault>
</theme>
`,
    )
    written.push('src/themes/studio/config.ini')
  }
  return [...written, ...writeAll(root, themeOverlayFiles())]
}

/** Write the contact-book module and Studio theme when cwd is a NukeViet 5 tree. */
export function applyBlueprint(root: string, task: WriteTask): string[] {
  if (task.version !== '5.x') return []
  if (!fs.existsSync(path.join(root, 'src', 'modules'))) return []
  const written: string[] = []
  if (task.nodeId === 'theme') written.push(...installTheme(root))
  const writeModule = (task.nodeId === 'scaffold' && task.attempt > 1) || task.nodeId === 'backend' || task.nodeId === 'lang'
  if (writeModule) written.push(...writeAll(root, moduleFiles(task.module, task.title)))
  return written
}
