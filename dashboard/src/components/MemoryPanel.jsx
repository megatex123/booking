import React from 'react'

const SECTIONS = ['Patterns Learned', 'Bugs Fixed', 'Decisions Made', 'Things to Avoid']

function parseMemory(raw) {
  const result = {}
  if (!raw) return result

  let currentSection = null
  for (const line of raw.split('\n')) {
    const heading = SECTIONS.find(s => line.startsWith(`## ${s}`))
    if (heading) {
      currentSection = heading
      result[currentSection] = result[currentSection] ?? []
      continue
    }
    if (currentSection && line.trim()) {
      result[currentSection].push(line)
    }
  }
  return result
}

const SECTION_COLOR = {
  'Patterns Learned': 'text-blue-400',
  'Bugs Fixed':       'text-green-400',
  'Decisions Made':   'text-yellow-400',
  'Things to Avoid':  'text-red-400',
}

export default function MemoryPanel({ memoryRaw = '', onClear }) {
  const sections = parseMemory(memoryRaw)
  const isEmpty = !memoryRaw.trim()

  return (
    <div className="flex flex-col gap-3 bg-gray-900 border border-gray-800 rounded-2xl p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm tracking-wide uppercase opacity-60">Shared Memory</h2>
        <button
          onClick={onClear}
          className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
        >
          Clear
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed bg-gray-950 rounded-xl p-3 space-y-4">
        {isEmpty ? (
          <span className="text-gray-700">Memory is empty. Agents will write here after each run.</span>
        ) : (
          SECTIONS.map(section => {
            const lines = sections[section]
            if (!lines?.length) return null
            return (
              <div key={section}>
                <div className={`font-bold mb-1 ${SECTION_COLOR[section]}`}>{section}</div>
                {lines.map((line, i) => (
                  <div key={i} className="text-gray-400 pl-2 border-l border-gray-800">{line}</div>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
