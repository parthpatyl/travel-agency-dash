/**
 * Normalizes raw travel package text into clean, well-formatted Markdown.
 * - Converts inline bullet characters (•, ▪, ●, \u2022) into newline Markdown list items (\n- )
 * - Formats uppercase section headers (e.g., CONTRACT:, BOOKING & CONTRACT:, TAXATION:)
 * - Formats inline travel labels (e.g., Meals:, Guide:, Overnight stay:, Check-in Time:)
 */
export function formatTravelMarkdown(text) {
  if (!text || typeof text !== 'string') return ''
  let formatted = text

  // 1. Convert bullet characters (•, ▪, ●, \u2022) into newline markdown bullets
  // Inline bullets: "landmarks: • Item 1 • Item 2" -> "landmarks:\n- Item 1\n- Item 2"
  formatted = formatted.replace(/([^\n])\s*[•▪●\u2022]\s*/g, '$1\n- ')
  // Leading bullets: "• Item 1" -> "- Item 1"
  formatted = formatted.replace(/^[•▪●\u2022]\s*/gm, '- ')

  // 2. Format uppercase section headers (e.g., CONTRACT:, BOOKING & CONTRACT:, TAXATION:, AIRLINES & TICKET:)
  // Match uppercase phrases ending with ':' (3 to 35 chars) that appear inline or at sentence boundaries
  const headerRegex = /(?:^|\.|\\n|\s{2,})\s*([A-Z0-9\s&/-]{3,35}:)/g
  formatted = formatted.replace(headerRegex, (match, header) => {
    const cleanHeader = header.trim().replace(/:$/, '')
    // Ignore short words or times like "15:00 hrs"
    if (/\d{1,2}:\d{2}/.test(header) || cleanHeader.length < 3) return match
    return `.\n\n### ${cleanHeader}\n`
  })

  // 3. Format key-value labels in travel descriptions (e.g. Meals:, Guide:, Overnight stay:)
  const labelRegex = /(?:^|\n|\.\s+)(Meals|Guide|Overnight stay|Overnight|Check-in Time|Check-out Time|Note|Important):\s*/gi
  formatted = formatted.replace(labelRegex, (match, label) => {
    return `\n\n**${label.trim()}:** `
  })

  // 4. Clean up multiple blank lines & leading periods
  formatted = formatted
    .replace(/^\.\n\n/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return formatted
}

/**
 * Splits text containing bullet points, newlines, or sentence boundaries into clean string arrays.
 * Useful when pasting multiline/bulleted text or unformatted paragraphs into input fields for inclusions/exclusions.
 */
export function splitBulletedItems(text) {
  if (!text) return []
  if (Array.isArray(text)) return flattenBulletedItems(text)
  if (typeof text !== 'string') return [String(text)]

  const trimmed = text.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return flattenBulletedItems(parsed)
    } catch {
      // continue to split by delimiter
    }
  }

  // If text already contains explicit newlines or bullet symbols, split strictly on them
  const hasBulletsOrNewlines = /[\r\n•▪●\u2022]/.test(trimmed)
  if (hasBulletsOrNewlines) {
    return trimmed
      .split(/\r?\n|[•▪●\u2022]/)
      .map(item => item.trim().replace(/^[-*+]\s+/, '').replace(/^\d+[\.\)]\s+/, ''))
      .filter(Boolean)
  }

  // Dense paragraph mode: split on sentence boundaries (. followed by capital letter) or semicolons
  const delimRegex = /(?<=\.)\s*(?=[A-Z0-9])|(?<=[a-z0-9])\.\s*(?=[A-Z0-9])|;/
  const initialChunks = trimmed.split(delimRegex)

  const items = []
  const phraseBoundary = /\s+(?=(?:Insurance|GST|Guide charges|Room heater charges|Anything which is not|Any additional costs)\b)/

  for (let chunk of initialChunks) {
    chunk = chunk.trim()
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+[\.\)]\s+/, '')
    if (!chunk) continue

    const subChunks = chunk.split(phraseBoundary)
    for (const sub of subChunks) {
      const cleaned = sub.trim().replace(/\.+$/, '')
      if (cleaned) {
        items.push(cleaned)
      }
    }
  }

  // Deduplicate consecutive identical items
  const deduped = []
  for (let i = 0; i < items.length; i++) {
    if (i === 0 || items[i].toLowerCase() !== items[i - 1].toLowerCase()) {
      deduped.push(items[i])
    }
  }

  return deduped
}

/**
 * Flattens an array or string of items where any item might contain embedded bullets or newlines.
 * Ensures every bullet item gets rendered as a separate element in lists.
 */
export function flattenBulletedItems(items) {
  if (!items) return []
  if (typeof items === 'string') {
    return splitBulletedItems(items)
  }
  if (!Array.isArray(items)) return []

  const result = []
  for (const item of items) {
    if (typeof item === 'string') {
      const trimmed = item.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed)
          if (Array.isArray(parsed)) {
            result.push(...flattenBulletedItems(parsed))
            continue
          }
        } catch {
          // treat as plain text
        }
      }
      const split = splitBulletedItems(item)
      result.push(...split)
    } else if (item) {
      result.push(String(item))
    }
  }
  return result
}

/**
 * Custom components for ReactMarkdown to prevent Tailwind CSS reset issues.
 */
export const defaultMarkdownComponents = {
  h1: ({ children }) => <h1 className="font-display text-xl font-bold text-stone-900 mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="font-display text-lg font-bold text-stone-900 mt-3 mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="font-display text-base font-bold text-stone-900 mt-3 mb-1">{children}</h3>,
  h4: ({ children }) => <h4 className="font-display text-sm font-bold text-stone-900 mt-2 mb-1">{children}</h4>,
  p: ({ children }) => <p className="mb-2 leading-relaxed font-light">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-2 text-stone-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-2 text-stone-700">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-extrabold text-stone-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-3 border-amber-500 pl-3 py-1 my-2 bg-amber-50/50 italic text-stone-700 rounded-r">
      {children}
    </blockquote>
  ),
}
