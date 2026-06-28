import React, { useEffect, useRef } from 'react'

const MAX_ENTRIES = 60

const AGENT_COLOR = {
  planner:  'text-blue-400',
  coder:    'text-green-400',
  debugger: 'text-red-400',
  tester:   'text-purple-400',
  system:   'text-gray-400',
}

const TYPE_PREFIX = {
  start:    '▶',
  done:     '✓',
  error:    '✗',
  info:     '·',
  memory:   '⟳',
  workflow: '◈',
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour12: false })
}

export default function ActivityLog({ entries = [] }) {
  const bottomRef = useRef(null)
  const visible = entries.slice(-MAX_ENTRIES)

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [entries.length])

  return (
    <div className="flex flex-col gap-3 bg-gray-900 border border-gray-800 rounded-2xl p-5 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm tracking-wide uppercase opacity-60">Activity Log</h2>
        <span className="text-xs text-gray-700">{entries.length} entries</span>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed bg-gray-950 rounded-xl p-3 space-y-1">
        {visible.length === 0 ? (
          <span className="text-gray-700">No activity yet…</span>
        ) : (
          visible.map((entry, i) => {
            const agentColor = AGENT_COLOR[entry.agent] ?? AGENT_COLOR.system
            const prefix = TYPE_PREFIX[entry.type] ?? TYPE_PREFIX.info

            return (
              <div key={entry.id ?? i} className="flex gap-2 items-start">
                <span className="text-gray-700 flex-shrink-0 tabular-nums">{formatTime(entry.ts)}</span>
                <span className={`flex-shrink-0 ${agentColor}`}>{prefix}</span>
                <span className={`flex-shrink-0 font-semibold ${agentColor}`}>
                  [{entry.agent ?? 'system'}]
                </span>
                <span className="text-gray-400 break-words min-w-0">{entry.message}</span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
