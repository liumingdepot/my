import type { ReactNode } from 'react'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type Block =
  | { type: 'heading'; level: HeadingLevel; text: string }
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; rows: string[][] }

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isSeparator(line: string) {
  const cells = splitRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function isListItem(line: string) {
  return /^[-*•]\s+/.test(line)
}

function listText(line: string) {
  return line.replace(/^[-*•]\s+/, '')
}

function parseHeading(line: string): { level: HeadingLevel; text: string } | null {
  const match = /^(#{1,6})\s+(.+)$/.exec(line)
  if (!match) return null
  return {
    level: match[1].length as HeadingLevel,
    text: match[2].trim(),
  }
}

export function parseReport(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()
    if (!trimmed) {
      index += 1
      continue
    }
    const heading = parseHeading(trimmed)
    if (heading) {
      blocks.push({ type: 'heading', level: heading.level, text: heading.text })
      index += 1
      continue
    }
    if (trimmed.startsWith('|')) {
      const rows: string[][] = []
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('|')) {
        const row = (lines[index] ?? '').trim()
        if (!isSeparator(row)) rows.push(splitRow(row))
        index += 1
      }
      if (rows.length) blocks.push({ type: 'table', rows })
      continue
    }
    if (isListItem(trimmed)) {
      const items: string[] = []
      while (index < lines.length) {
        const next = (lines[index] ?? '').trim()
        if (!isListItem(next)) break
        items.push(listText(next))
        index += 1
      }
      blocks.push({ type: 'list', items })
      continue
    }
    const paragraph = [trimmed]
    index += 1
    while (index < lines.length) {
      const next = (lines[index] ?? '').trim()
      if (!next || parseHeading(next) || next.startsWith('|') || isListItem(next)) break
      paragraph.push(next)
      index += 1
    }
    blocks.push({ type: 'p', text: paragraph.join('\n') })
  }
  return blocks
}

export function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    nodes.push(<strong key={key++}>{match[1]}</strong>)
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length === 1 && typeof nodes[0] === 'string' ? nodes[0] : nodes
}

const HEADING_TAG = {
  1: 'h2',
  2: 'h3',
  3: 'h4',
  4: 'h5',
  5: 'h6',
  6: 'h6',
} as const

export default function ReportBody({ source }: { source: string }) {
  return (
    <div className="report">
      {parseReport(source).map((block, index) => {
        if (block.type === 'heading') {
          const Tag = HEADING_TAG[block.level]
          return (
            <Tag key={index} className={`report-h${block.level}`}>
              {renderInline(block.text)}
            </Tag>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }
        if (block.type === 'table') {
          const [head, ...body] = block.rows
          return (
            <div key={index} className="table-wrap">
              <table>
                {head ? (
                  <thead>
                    <tr>
                      {head.map((cell, cellIndex) => (
                        <th key={cellIndex}>{renderInline(cell)}</th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {body.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{renderInline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return <p key={index}>{renderInline(block.text)}</p>
      })}
    </div>
  )
}
