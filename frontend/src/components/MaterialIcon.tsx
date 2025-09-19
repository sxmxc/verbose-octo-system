import React from 'react'

const baseStyle: React.CSSProperties = {
  fontSize: '1.05em',
  lineHeight: 1,
  display: 'inline-flex',
  verticalAlign: 'middle',
}

export function MaterialIcon({
  name,
  title,
  className,
  style,
  filled = false,
  ariaHidden = true,
}: {
  name: string
  title?: string
  className?: string
  style?: React.CSSProperties
  filled?: boolean
  ariaHidden?: boolean
}) {
  const classes = ['material-symbols-outlined']
  if (filled) {
    classes.push('material-symbols-filled')
  }
  if (className) {
    classes.push(className)
  }

  return (
    <span
      className={classes.join(' ')}
      style={{ ...baseStyle, ...style }}
      aria-hidden={ariaHidden}
      role={ariaHidden ? undefined : 'img'}
      title={title}
    >
      {name}
    </span>
  )
}
