import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: React.ReactNode } }).props.children)
  return ''
}

function tone(value: string): string | undefined {
  const token = value.trim().toLowerCase()
  if (['đạt', 'pass', 'xong', 'ok'].includes(token)) return 'text-ok font-medium'
  if (['lỗi', 'fail', 'failed', 'cao'].includes(token)) return 'text-bad font-medium'
  if (['cảnh báo', 'warn'].includes(token)) return 'text-warn font-medium'
  return undefined
}

const components: Components = {
  td: ({ children }) => <td className={tone(textOf(children))}>{children}</td>,
  code: ({ className, children }) => {
    const language = /language-(\w+)/.exec(className || '')?.[1]
    const value = String(children).replace(/\n$/, '')
    if (language === 'diff') {
      return (
        <pre>
          <code>
            {value.split('\n').map((line, index) => (
              <div key={index} className={line.startsWith('+') ? 'diff-line-add' : line.startsWith('-') ? 'diff-line-del' : undefined}>
                {line || ' '}
              </div>
            ))}
          </code>
        </pre>
      )
    }
    if (className) return <code className={className}>{children}</code>
    return <code>{children}</code>
  },
}

export function MarkdownView({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className ? `md ${className}` : 'md'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text || ''}
      </ReactMarkdown>
    </div>
  )
}
