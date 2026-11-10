import type { NvVersion, WorkflowEdgeDef, WorkflowNodeDef } from './types'

export const WORKFLOW_ID = 'nukeviet-module'
export const MAX_ATTEMPTS = 2

export const WORKFLOW_NODES: WorkflowNodeDef[] = [
  { id: 'analyze', kind: 'step', agent: 'analyst', x: 0, y: 0 },
  { id: 'theme', kind: 'step', agent: 'theme', x: 292, y: 0 },
  { id: 'scaffold', kind: 'step', agent: 'module', x: 0, y: 168 },
  { id: 'backend', kind: 'step', agent: 'backend', x: 292, y: 168 },
  { id: 'lang', kind: 'step', agent: 'i18n', x: 0, y: 336 },
  { id: 'gate', kind: 'gate', agent: 'decision-gate', x: 292, y: 336 },
  { id: 'review', kind: 'step', agent: 'review', x: 584, y: 292 },
  { id: 'fix', kind: 'step', agent: 'fix', x: 584, y: 444 },
]

export const WORKFLOW_EDGES: WorkflowEdgeDef[] = [
  { id: 'e1', source: 'analyze', target: 'theme' },
  { id: 'e2', source: 'theme', target: 'scaffold' },
  { id: 'e3', source: 'scaffold', target: 'backend' },
  { id: 'e4', source: 'backend', target: 'lang' },
  { id: 'e5', source: 'lang', target: 'gate' },
  { id: 'e6', source: 'gate', target: 'review', sourceHandle: 'review', when: 'review' },
  { id: 'e7', source: 'gate', target: 'fix', sourceHandle: 'fix', when: 'fix' },
]

export const LINEAR_STEPS = ['analyze', 'theme', 'scaffold', 'backend', 'lang', 'gate'] as const

export const EVAL_IDS = ['syntax', 'style', 'input', 'sql', 'csrf', 'files'] as const

export function nodeDef(id: string): WorkflowNodeDef {
  const found = WORKFLOW_NODES.find((node) => node.id === id)
  if (!found) throw new Error(`Unknown node ${id}`)
  return found
}

export function knowledgeFor(nodeId: string, version: NvVersion): string[] {
  if (version === '5.x') {
    const common = ['knowledge/nukeviet5/CLAUDE.md']
    switch (nodeId) {
      case 'analyze':
        return [...common, 'knowledge/nukeviet5/docs/module.md']
      case 'theme':
        return [...common, 'knowledge/nukeviet5/docs/theme.md', 'knowledge/nukeviet5/skills/new-theme/SKILL.md', 'knowledge/nukeviet5/docs/xtemplate-to-smarty.md']
      case 'scaffold':
        return [...common, 'knowledge/nukeviet5/skills/new-module/SKILL.md', 'knowledge/nukeviet5/docs/module.md', 'templates/module-5x/']
      case 'backend':
        return [...common, 'knowledge/nukeviet5/docs/mysql.md', 'knowledge/nukeviet5/docs/security.md']
      case 'lang':
        return [...common, 'knowledge/nukeviet5/docs/language.md', 'knowledge/nukeviet5/skills/lang-translator/SKILL.md']
      case 'gate':
        return [...common, 'knowledge/nukeviet5/skills/security-audit/SKILL.md', 'knowledge/nukeviet5/docs/security.md']
      case 'review':
        return [...common, 'knowledge/nukeviet5/docs/testing.md', 'knowledge/nukeviet5/skills/acceptance-test/SKILL.md']
      default:
        return [...common, 'knowledge/nukeviet5/docs/module.md']
    }
  }
  const common = ['knowledge/nukeviet4/README.md', 'knowledge/nukeviet4/differences.md']
  switch (nodeId) {
    case 'analyze':
      return [...common, 'knowledge/nukeviet4/module.md']
    case 'theme':
      return [...common, 'knowledge/nukeviet4/template.md']
    case 'scaffold':
      return [...common, 'knowledge/nukeviet4/module.md', 'templates/module-4x/']
    case 'backend':
      return [...common, 'knowledge/nukeviet4/security.md']
    case 'lang':
      return [...common, 'knowledge/nukeviet4/language.md']
    case 'gate':
      return [...common, 'knowledge/nukeviet4/security.md', 'knowledge/nukeviet4/coding-standard.md']
    default:
      return common
  }
}

export function moduleRoot(version: NvVersion, module: string): string {
  return version === '5.x' ? `src/modules/${module}` : `modules/${module}`
}
