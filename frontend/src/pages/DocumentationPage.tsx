import React from 'react'
import { Link, NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { MaterialIcon } from '../components/MaterialIcon'

const documentationModules = import.meta.glob<string>('../../documentation/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

type DocumentationEntry = {
  id: string
  title: string
  content: string
  filename: string
  section: string
  order: number
}

const docMeta: Record<string, { section: string; order: number }> = {
  'toolbox-overview': { section: 'Toolbox', order: 0 },
  'toolbox-administration': { section: 'Toolbox', order: 1 },
  'toolbox-job-monitoring': { section: 'Toolbox', order: 2 },
  'toolbox-auth-architecture': { section: 'Toolbox', order: 3 },
  'toolkit': { section: 'Toolkit', order: 0 },
  'toolkit-worker': { section: 'Toolkit', order: 1 },
  'toolkit-ui': { section: 'Toolkit', order: 2 },
  'toolkit-build': { section: 'Toolkit', order: 3 },
  'examples-basic-toolkit': { section: 'Examples', order: 0 },
  'examples-job-queue': { section: 'Examples', order: 1 },
}

const sectionOrder = ['Toolbox', 'Toolkit', 'Examples']

const documentationEntries: DocumentationEntry[] = Object.entries(documentationModules)
  .map(([path, content]) => {
    const filename = path.split('/').pop() ?? path
    const id = path.replace(/^.*documentation\//, '').replace(/\.md$/i, '')
    const explicitTitle = extractHeading(content)
    const title = explicitTitle || beautifyFileName(filename)
    const meta = docMeta[id] ?? { section: 'Toolbox', order: 100 }

    return {
      id,
      title,
      content,
      filename,
      section: meta.section,
      order: meta.order,
  }
  })
  .sort((a, b) => {
    if (a.order === b.order) {
      return a.title.localeCompare(b.title)
    }
    return a.order - b.order
  })

const documentationMap = new Map(documentationEntries.map((entry) => [entry.id, entry]))
const defaultDocId = documentationEntries[0]?.id ?? ''

export default function DocumentationPage() {
  if (documentationEntries.length === 0) {
    return (
      <div style={emptyStateStyles.container}>
        <MaterialIcon name="library_add" ariaHidden={false} style={{ fontSize: '2.25rem', color: 'var(--color-link)' }} />
        <h2 style={{ margin: 0 }}>Documentation space not yet configured</h2>
        <p style={emptyStateStyles.body}>
          Create markdown files under <code>frontend/documentation</code> to populate this area with Toolbox runbooks, examples, and toolkit
          authoring guides.
        </p>
      </div>
    )
  }

  const sections = sectionOrder
    .map((section) => ({
      title: section,
      entries: documentationEntries.filter((entry) => entry.section === section),
    }))
    .filter((group) => group.entries.length > 0)

  return (
    <div style={pageStyles.wrapper}>
      <aside style={pageStyles.sidebar}>
        <p style={pageStyles.sidebarHeading}>Toolbox Docs</p>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {sections.map((section) => (
            <div key={section.title} style={{ display: 'grid', gap: '0.4rem' }}>
              <p style={pageStyles.sectionHeading}>{section.title}</p>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                {section.entries.map((entry) => (
                  <NavLink key={entry.id} to={entry.id} end style={({ isActive }) => getSidebarButtonStyle(isActive)}>
                    <span style={{ fontWeight: 600 }}>{entry.title}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div style={{ minHeight: 360 }}>
        <Routes>
          <Route index element={<Navigate to={defaultDocId} replace />} />
          <Route path=":docId" element={<DocumentationArticle />} />
          <Route
            path="*"
            element={
              <div style={emptyStateStyles.container}>
                <MaterialIcon name="help" ariaHidden={false} style={{ fontSize: '2.25rem', color: 'var(--color-link)' }} />
                <h2 style={{ margin: 0 }}>Document not found</h2>
                <p style={emptyStateStyles.body}>Choose another guide from the navigation.</p>
              </div>
            }
          />
        </Routes>
      </div>
    </div>
  )
}

function DocumentationArticle() {
  const { docId = '' } = useParams()
  const entry = documentationMap.get(docId)

  if (!entry) {
    return (
      <div style={emptyStateStyles.container}>
        <MaterialIcon name="compass_calibration" ariaHidden={false} style={{ fontSize: '2.25rem', color: 'var(--color-link)' }} />
        <h2 style={{ margin: 0 }}>Unknown guide</h2>
        <p style={emptyStateStyles.body}>Select a valid document from the sidebar.</p>
      </div>
    )
  }

  return (
    <article style={pageStyles.article}>
      <header style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.45rem' }}>{entry.title}</h1>
      </header>
      <div style={pageStyles.articleBody}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {entry.content}
        </ReactMarkdown>
      </div>
    </article>
  )
}

function extractHeading(content: string): string | null {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#')) {
      return trimmed.replace(/^#+\s*/, '').trim() || null
    }
  }
  return null
}

function beautifyFileName(filename: string): string {
  return filename
    .replace(/\.md$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function getSidebarButtonStyle(active: boolean): React.CSSProperties {
  if (active) {
    return {
      borderLeft: '3px solid var(--color-accent)',
      background: 'var(--color-accent-soft)',
      borderRadius: 6,
      padding: '0.4rem 0.6rem',
      color: 'var(--color-text-primary)',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'background 0.15s ease, border 0.15s ease',
      textDecoration: 'none',
    }
  }
  return {
    borderLeft: '3px solid transparent',
    background: 'transparent',
    borderRadius: 6,
    padding: '0.4rem 0.6rem',
    color: 'var(--color-text-secondary)',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.15s ease, border 0.15s ease',
    textDecoration: 'none',
  }
}

const linkStyle: React.CSSProperties = {
  color: 'var(--color-link)',
  textDecoration: 'none',
  fontWeight: 500,
}

type MarkdownCodeProps = React.HTMLAttributes<HTMLElement> & {
  inline?: boolean
  children?: React.ReactNode
}

const CODE_FONT_FAMILY = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace'

const inlineCodeStyle: React.CSSProperties = {
  display: 'inline-block',
  background: 'var(--color-accent-soft)',
  padding: '0.1rem 0.35rem',
  borderRadius: 5,
  fontSize: '0.85em',
  fontFamily: CODE_FONT_FAMILY,
  lineHeight: 'inherit',
  color: 'var(--color-text-primary)',
  whiteSpace: 'pre-wrap',
  width: 'auto',
  maxWidth: '100%',
  verticalAlign: 'baseline',
}

const codeBlockContainerStyle: React.CSSProperties = {
  margin: '0.5rem 0',
  background: 'var(--color-code-bg)',
  color: 'var(--color-code-text)',
  padding: '0.65rem 0.9rem',
  borderRadius: 10,
  overflow: 'auto',
  fontSize: '0.85rem',
  display: 'block',
}

const codeBlockStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: CODE_FONT_FAMILY,
  whiteSpace: 'pre',
  display: 'block',
}

const renderCode = ({ inline, children, style, ...props }: MarkdownCodeProps) => {
  const childArray = React.Children.toArray(children)
  const textContent = childArray.every((child) => typeof child === 'string')
    ? (childArray as string[]).join('')
    : null
  const effectiveInline = inline ?? (textContent ? !textContent.includes('\n') : false)

  if (effectiveInline) {
    const combinedInlineStyle = style ? { ...inlineCodeStyle, ...style } : inlineCodeStyle
    return (
      <code {...props} style={combinedInlineStyle}>
        {children}
      </code>
    )
  }

  const combinedBlockStyle = style ? { ...codeBlockStyle, ...style } : codeBlockStyle

  return (
    <pre style={codeBlockContainerStyle}>
      <code {...props} style={combinedBlockStyle}>
        {children}
      </code>
    </pre>
  )
}

const markdownComponents: Components = {
  a({ href, children, node: _node, ...props }) {
    if (!href) {
      return <span {...props}>{children}</span>
    }
    const internalTarget = resolveInternalDocHref(href)
    if (internalTarget) {
      return (
        <Link to={`/documentation/${internalTarget}`} style={linkStyle} {...props}>
          {children}
        </Link>
      )
    }
    const external = href.startsWith('http') || href.startsWith('https')
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        style={linkStyle}
        {...props}
      >
        {children}
      </a>
    )
  },
  code: renderCode,
  ul({ children }) {
    return (
      <ul style={{ margin: '0 0 0.75rem 1.25rem', padding: 0, display: 'grid', gap: '0.35rem' }}>
        {children}
      </ul>
    )
  },
  ol({ children }) {
    return (
      <ol style={{ margin: '0 0 0.75rem 1.25rem', padding: 0, display: 'grid', gap: '0.35rem' }}>
        {children}
      </ol>
    )
  },
  p({ children }) {
    return <p style={{ margin: 0, color: 'var(--color-text-primary)' }}>{children}</p>
  },
  h2({ children }) {
    return <h2 style={headingStyles(2)}>{children}</h2>
  },
  h3({ children }) {
    return <h3 style={headingStyles(3)}>{children}</h3>
  },
  h4({ children }) {
    return <h4 style={headingStyles(4)}>{children}</h4>
  },
  h5({ children }) {
    return <h5 style={headingStyles(5)}>{children}</h5>
  },
  h6({ children }) {
    return <h6 style={headingStyles(6)}>{children}</h6>
  },
}

function resolveInternalDocHref(href: string): string | null {
  if (!href) {
    return null
  }
  if (href.startsWith('/documentation/')) {
    const slug = href.replace('/documentation/', '').replace(/\/$/, '')
    return documentationMap.has(slug) ? slug : null
  }
  if (!href.includes(':')) {
    const trimmed = href.replace(/^\.\//, '').replace(/\.md$/i, '')
    return documentationMap.has(trimmed) ? trimmed : null
  }
  return null
}

function headingStyles(level: number): React.CSSProperties {
  const fontSizes = ['0', '1.6rem', '1.35rem', '1.15rem', '1rem', '0.95rem', '0.9rem']
  const margins = ['0', '0 0 0.75rem', '1.5rem 0 0.5rem', '1.25rem 0 0.5rem', '1rem 0 0.4rem', '0.85rem 0 0.3rem', '0.8rem 0 0.25rem']
  const safeLevel = Math.max(1, Math.min(level, 6))
  return {
    margin: margins[safeLevel],
    fontSize: fontSizes[safeLevel],
    color: 'var(--color-text-primary)',
  }
}

const pageStyles = {
  wrapper: {
    background: 'var(--color-surface)',
    borderRadius: 12,
    padding: '1.75rem',
    boxShadow: 'var(--color-shadow)',
    display: 'grid',
    gridTemplateColumns: '260px 1fr',
    gap: '1.5rem',
    minHeight: 420,
  } as React.CSSProperties,
  sidebar: {
    borderRight: '1px solid var(--color-border)',
    paddingRight: '1.25rem',
    display: 'grid',
    alignContent: 'start',
    gap: '0.75rem',
  } as React.CSSProperties,
  sidebarHeading: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
  } as React.CSSProperties,
  sectionHeading: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
  } as React.CSSProperties,
  article: {
    display: 'grid',
    alignContent: 'start',
    gap: '0.35rem',
  } as React.CSSProperties,
  articleBody: {
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.5rem',
    background: 'var(--color-surface-alt)',
    color: 'var(--color-text-primary)',
    fontSize: '0.95rem',
    lineHeight: 1.65,
    display: 'grid',
    gap: '1rem',
  } as React.CSSProperties,
}

const emptyStateStyles = {
  container: {
    background: 'var(--color-surface)',
    borderRadius: 12,
    padding: '1.75rem',
    boxShadow: 'var(--color-shadow)',
    display: 'grid',
    gap: '0.7rem',
    justifyItems: 'flex-start',
  } as React.CSSProperties,
  body: {
    margin: 0,
    color: 'var(--color-text-secondary)',
    fontSize: '0.9rem',
  } as React.CSSProperties,
}
