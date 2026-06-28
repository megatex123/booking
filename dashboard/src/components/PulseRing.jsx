import React from 'react'

const COLOR_HEX = {
  blue:   '#60a5fa',
  green:  '#4ade80',
  red:    '#f87171',
  purple: '#c084fc',
}

export default function PulseRing({ color = 'blue', active = false, children }) {
  const hex = COLOR_HEX[color] ?? COLOR_HEX.blue

  return (
    <div className="relative inline-flex items-center justify-center">
      {active && (
        <>
          <span
            className="absolute inset-0 rounded-full pulse-ring pointer-events-none"
            style={{ border: `2px solid ${hex}` }}
          />
          <span
            className="absolute inset-0 rounded-full pulse-ring-delay pointer-events-none"
            style={{ border: `2px solid ${hex}` }}
          />
        </>
      )}
      {children}
    </div>
  )
}
