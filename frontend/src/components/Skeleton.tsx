import React from 'react'
import './Skeleton.css'

export type SkeletonProps = {
  width?: number | string
  height?: number | string
  radius?: number | string
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = '1rem', radius = '8px', className = '', style }: SkeletonProps) {
  return (
    <div
      className={['tk-skeleton', className].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({ lines = 3, lineHeight = '1rem', gap = '0.6rem' }: { lines?: number; lineHeight?: string; gap?: string }) {
  return (
    <div className="tk-skeleton__text" style={{ display: 'grid', gap }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} height={lineHeight} />
      ))}
    </div>
  )
}
