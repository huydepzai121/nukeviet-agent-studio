import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { moduleFiles, moduleSlug } from '../src/shared/blueprint'
import { emptySignals, scoreNukeViet } from '../src/shared/detect'
import { assertCloneUrl, parseGitStatus, parseUnifiedDiff, repoNameFromUrl } from '../src/shared/git-text'
import { mergeAgents } from '../src/shared/defaults'
import { branchSlug, titleFromMessage } from '../src/shared/threads'
import { applyBlueprint } from '../src/main/write-blueprint'
import { relativeTime } from '../src/renderer/src/lib/format'

describe('nukeviet detection', () => {
  it('scores a 5.x tree from src, Smarty, and vi.php only', () => {
    const signals = emptySignals()
    signals.srcLayout = true
    signals.viPhp = 2
    signals.smarty = 1
    signals.hasVendorVinades = true
    expect(scoreNukeViet(signals).version).toBe('5.x')
  })

  it('scores a 4.x tree from XTemplate and admin_vi.php', () => {
    const signals = emptySignals()
    signals.rootLayout = true
    signals.adminVi = 3
    signals.xtemplate = 2
    expect(scoreNukeViet(signals).version).toBe('4.x')
  })

  it('walks fixture folders', async () => {
    const { collectSignals } = await import('../src/main/fs-ops')
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nvas-detect-'))
    fs.mkdirSync(path.join(root, 'src/modules/news/language'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src/modules/news/language/vi.php'), '<?php $lang_module = [];')
    fs.mkdirSync(path.join(root, 'src/themes/default/modules/news'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src/themes/default/modules/news/main.tpl'), '{foreach $ITEMS as $row}{/foreach}')
    fs.mkdirSync(path.join(root, 'src/includes'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src/includes/core.php'), '<?php class NVSmarty {}')
    expect(scoreNukeViet(collectSignals(root)).version).toBe('5.x')

    const legacy = fs.mkdtempSync(path.join(os.tmpdir(), 'nvas-detect4-'))
    fs.mkdirSync(path.join(legacy, 'modules/news/language'), { recursive: true })
    fs.mkdirSync(path.join(legacy, 'includes'), { recursive: true })
    fs.writeFileSync(path.join(legacy, 'modules/news/language/admin_vi.php'), '<?php')
    fs.writeFileSync(path.join(legacy, 'modules/news/language/vi.php'), '<?php')
    fs.writeFileSync(path.join(legacy, 'themes-main.tpl'), '<!-- BEGIN: main -->')
    fs.mkdirSync(path.join(legacy, 'themes/default'), { recursive: true })
    fs.writeFileSync(path.join(legacy, 'themes/default/main.tpl'), '<!-- BEGIN: main --> {LANG.main}')
    expect(scoreNukeViet(collectSignals(legacy)).version).toBe('4.x')
  })
})

describe('git text', () => {
  it('reads branch and dirty state', () => {
    expect(parseGitStatus('## main...origin/main\n M src/a.php\n')).toEqual({ branch: 'main', dirty: true, repo: true })
    expect(parseGitStatus('## nukeviet5.0\n')).toEqual({ branch: 'nukeviet5.0', dirty: false, repo: true })
  })

  it('splits a unified diff', () => {
    const diff = ['diff --git a/src/a.php b/src/a.php', '--- a/src/a.php', '+++ b/src/a.php', '@@', '-old', '+new'].join('\n')
    const [file] = parseUnifiedDiff(diff)
    expect(file?.path).toBe('src/a.php')
    expect(file?.additions).toBe(1)
    expect(file?.deletions).toBe(1)
  })

  it('rejects unsafe clone urls', () => {
    expect(repoNameFromUrl('https://github.com/nukeviet/nukeviet.git')).toBe('nukeviet')
    expect(() => assertCloneUrl('https://example.com/a.git && rm -rf /')).toThrow()
    expect(assertCloneUrl('https://github.com/nukeviet/nukeviet.git')).toContain('github.com')
  })
})

describe('threads', () => {
  it('titles from the first line and slugs a branch', () => {
    expect(titleFromMessage('  Tạo module **contact book** cho site\nchi tiết')).toBe('Tạo module contact book cho site')
    expect(branchSlug('Sổ liên hệ', 'th-ab12')).toMatch(/^nvas\/so-lien-he-/)
  })

  it('keeps built-in agents when settings are partial', () => {
    const agents = mergeAgents([{ id: 'claude', name: 'Claude Code', builtin: false, command: 'claude-agent-acp' }])
    expect(agents.find((agent) => agent.id === 'mock')?.builtin).toBe(true)
    expect(agents.find((agent) => agent.id === 'claude')?.command).toBe('claude-agent-acp')
    expect(agents.find((agent) => agent.id === 'custom')).toBeTruthy()
  })
})

describe('relative time', () => {
  const now = Date.parse('2026-11-10T12:00:00Z')
  it('does not call 26 hours “26 giờ trước”', () => {
    expect(relativeTime(now - 26 * 3600_000, 'vi', now)).toBe('hôm qua')
    expect(relativeTime(now - 2 * 3600_000, 'vi', now)).toBe('2 giờ trước')
    expect(relativeTime(now - 30_000, 'en', now)).toBe('just now')
  })
})

describe('blueprint files', () => {
  it('writes a 5.x module and theme that pass php -l', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nvas-blue-'))
    fs.mkdirSync(path.join(root, 'src/modules'), { recursive: true })
    fs.mkdirSync(path.join(root, 'src/themes/default/css'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'src/themes/default/config.ini'),
      '<?xml version="1.0"?><theme><info><name>NukeViet Default</name><description>default</description></info></theme>',
    )
    const theme = applyBlueprint(root, { nodeId: 'theme', attempt: 1, version: '5.x', module: 'nukeviet', title: 'nukeviet' })
    const mod = applyBlueprint(root, { nodeId: 'scaffold', attempt: 2, version: '5.x', module: 'contactbook', title: 'Sổ liên hệ' })
    expect(theme.some((file) => file.includes('studio'))).toBe(true)
    expect(mod.some((file) => file.includes('src/modules/contactbook/version.php'))).toBe(true)
    expect(fs.readFileSync(path.join(root, 'src/themes/studio/config.ini'), 'utf8')).toContain('<name>Studio</name>')
    const phpFiles = moduleFiles('contactbook', 'Sổ liên hệ').map((file) => file.path).filter((file) => file.endsWith('.php'))
    for (const file of phpFiles) {
      const output = execFileSync('php', ['-l', path.join(root, file)], { encoding: 'utf8' })
      expect(output).toContain('No syntax errors')
    }
    expect(moduleSlug('nukeviet')).toBe('contactbook')
  })
})
