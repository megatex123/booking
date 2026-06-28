import React, { useState } from 'react'
import { WORKFLOWS } from '../constants/workflows'

export default function TaskInput({ onRun, onCancel, isRunning = false }) {
  const [task, setTask] = useState('')
  const [selectedWorkflow, setSelectedWorkflow] = useState(WORKFLOWS[0].id)

  function handleRun() {
    const trimmed = task.trim()
    if (!trimmed || isRunning) return
    const workflow = WORKFLOWS.find(w => w.id === selectedWorkflow)
    onRun?.({ task: trimmed, workflow })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleRun()
  }

  return (
    <div className="flex flex-col gap-4 bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h2 className="text-white font-semibold text-sm tracking-wide uppercase opacity-60">Task</h2>

      {/* Workflow selector */}
      <div className="flex flex-wrap gap-2">
        {WORKFLOWS.map(wf => {
          const active = wf.id === selectedWorkflow
          return (
            <button
              key={wf.id}
              onClick={() => !isRunning && setSelectedWorkflow(wf.id)}
              disabled={isRunning}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white',
                isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {wf.label}
            </button>
          )
        })}
      </div>

      {/* Textarea */}
      <textarea
        className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 resize-none font-mono focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        rows={4}
        placeholder="Describe the task… (Ctrl+Enter to run)"
        value={task}
        onChange={e => setTask(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isRunning}
      />

      {/* Run / Cancel buttons */}
      <div className="flex items-center gap-2 self-end">
        {isRunning && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-all duration-150 cursor-pointer"
          >
            <span>✕</span>
            Cancel
          </button>
        )}
        <button
          onClick={handleRun}
          disabled={isRunning || !task.trim()}
          className={[
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
            isRunning || !task.trim()
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer',
          ].join(' ')}
        >
          {isRunning ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              Running…
            </>
          ) : (
            <>
              <span>▶</span>
              Run
            </>
          )}
        </button>
      </div>
    </div>
  )
}
