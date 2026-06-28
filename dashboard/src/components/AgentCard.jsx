import React from 'react'
import PulseRing from './PulseRing'

const STATUS = {
  idle:     { label: 'Idle',       bg: 'bg-gray-800',        text: 'text-gray-400',   dot: 'bg-gray-500' },
  thinking: { label: 'Thinking…',  bg: 'bg-yellow-900/40',   text: 'text-yellow-300', dot: 'bg-yellow-400' },
  working:  { label: 'Working',    bg: 'bg-blue-900/40',     text: 'text-blue-300',   dot: 'bg-blue-400' },
  done:     { label: 'Done',       bg: 'bg-green-900/40',    text: 'text-green-300',  dot: 'bg-green-400' },
  error:    { label: 'Error',      bg: 'bg-red-900/40',      text: 'text-red-300',    dot: 'bg-red-500' },
  queued:   { label: 'Queued',     bg: 'bg-gray-800',        text: 'text-gray-400',   dot: 'bg-gray-600' },
}

const BORDER = {
  blue:   'border-blue-500/30',
  green:  'border-green-500/30',
  red:    'border-red-500/30',
  purple: 'border-purple-500/30',
}

const ACTIVE_STATES = new Set(['thinking', 'working'])

export default function AgentCard({
  agent,
  status = 'idle',
  output = '',
  progress = 0,
  queuePosition = null,
}) {
  const s = STATUS[status] ?? STATUS.idle
  const isActive = ACTIVE_STATES.has(status)
  const border = BORDER[agent.color] ?? 'border-gray-700'
  const showProgress = status === 'working'
  const showQueue = status === 'queued' && queuePosition !== null

  return (
    <div className={`relative flex flex-col gap-3 bg-gray-900 border ${border} rounded-2xl p-4`}>

      {/* Queue position badge */}
      {showQueue && (
        <span className="absolute top-3 right-3 bg-gray-700 text-gray-300 text-xs font-bold px-2 py-0.5 rounded-full">
          #{queuePosition}
        </span>
      )}

      {/* Header: icon + name + role */}
      <div className="flex items-center gap-3">
        <PulseRing color={agent.color} active={isActive}>
          <span className="text-3xl leading-none select-none">{agent.icon}</span>
        </PulseRing>
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm leading-tight">{agent.name}</div>
          <div className="text-gray-500 text-xs truncate">{agent.role}</div>
        </div>
      </div>

      {/* Status badge */}
      <div className={`inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot} ${isActive ? 'animate-pulse' : ''}`} />
        {s.label}
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
          {progress > 0 ? (
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          ) : (
            <div className="h-full bg-blue-400 rounded-full indeterminate-bar" />
          )}
        </div>
      )}

      {/* Output panel */}
      <div className="bg-gray-950 rounded-lg p-3 h-32 overflow-y-auto font-mono text-xs text-gray-400 leading-relaxed whitespace-pre-wrap break-words">
        {output
          ? output
          : <span className="text-gray-700">No output yet…</span>
        }
      </div>
    </div>
  )
}
