import Markdown from 'react-markdown'
import { formatTravelMarkdown, defaultMarkdownComponents } from './markdownHelpers'

/**
 * Smart Markdown renderer component with pre-formatting and custom components.
 */
export function SmartMarkdown({ content, className = '', components = {} }) {
  if (!content) return null
  const normalized = formatTravelMarkdown(content)
  const mergedComponents = { ...defaultMarkdownComponents, ...components }

  return (
    <div className={`markdown-body ${className}`}>
      <Markdown components={mergedComponents}>
        {normalized}
      </Markdown>
    </div>
  )
}

/**
 * Inline Markdown renderer for list items and small badges.
 */
export function SmartMarkdownInline({ children, className = '' }) {
  if (!children) return null
  const normalized = typeof children === 'string' ? formatTravelMarkdown(children) : children
  return (
    <Markdown
      components={{
        p: ({ children: c }) => <span className={className}>{c}</span>,
        strong: ({ children: c }) => <strong className="font-extrabold">{c}</strong>,
        ul: ({ children: c }) => <span className="inline-flex flex-col gap-1">{c}</span>,
        li: ({ children: c }) => <span className="block">{c}</span>,
      }}
    >
      {normalized}
    </Markdown>
  )
}
