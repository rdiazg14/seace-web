import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTheme } from '../lib/theme'

interface Props {
  content: string
  className?: string
  isDark?: boolean
}

export function MarkdownRenderer({ content, className = '', isDark }: Props) {
  const { isDark: themeDark } = useTheme()
  const dark = isDark ?? themeDark

  return (
    <div
      className={`prose max-w-none
        prose-p:my-1 prose-p:leading-relaxed
        prose-table:text-sm
        prose-td:py-1 prose-td:px-3
        prose-th:py-1 prose-th:px-3 prose-th:font-semibold
        prose-ul:my-1 prose-li:my-0
        prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
        ${dark
          ? 'prose-invert prose-headings:text-white prose-headings:font-semibold prose-strong:text-white'
          : 'prose-headings:text-[var(--text-primary)] prose-headings:font-semibold prose-strong:text-[var(--text-primary)] prose-a:text-emerald-600'}
        ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
