import React, { useState, useCallback, useRef } from 'react'
import { AGENTS } from './constants/agents'
import { WORKFLOWS } from './constants/workflows'
import AgentCard from './components/AgentCard'
import WorkflowTrack from './components/WorkflowTrack'
import TaskInput from './components/TaskInput'
import MemoryPanel from './components/MemoryPanel'
import ActivityLog from './components/ActivityLog'
import { callAgent } from './api/claudeAgent'
import {
  notifyWorkflowStart,
  notifyAgentStart,
  notifyAgentDone,
  notifyAgentError,
  notifyWorkflowComplete,
  notifyMemoryUpdated,
} from './utils/telegramNotifier'
import { syncToObsidian } from './utils/obsidianSync'

const agentById = Object.fromEntries(AGENTS.map(a => [a.id, a]))

const IDLE_STATE = { status: 'idle', output: '', progress: 0, queuePosition: null }

function initAgentStates() {
  return Object.fromEntries(AGENTS.map(a => [a.id, { ...IDLE_STATE }]))
}

let logIdCounter = 0
function makeLog(agent, type, message) {
  return { id: ++logIdCounter, agent, type, message, ts: Date.now() }
}

export default function App() {
  const [isRunning,   setIsRunning]   = useState(false)
  const [agentStates, setAgentStates] = useState(initAgentStates)
  const [memory,      setMemory]      = useState('')
  const [logs,        setLogs]        = useState([])
  const [activeWorkflow, setActiveWorkflow] = useState(null)
  const [currentStep,    setCurrentStep]    = useState(-1)
  const [completedSteps, setCompletedSteps] = useState([])

  const abortRef     = useRef(null)
  const cancelledRef = useRef(false)

  function pushLog(agent, type, message) {
    setLogs(prev => [...prev, makeLog(agent, type, message)])
  }

  function setAgent(agentId, patch) {
    setAgentStates(prev => ({ ...prev, [agentId]: { ...prev[agentId], ...patch } }))
  }

  function resetAll() {
    setAgentStates(initAgentStates())
    setCurrentStep(-1)
    setCompletedSteps([])
    setActiveWorkflow(null)
  }

  function cancelWorkflow() {
    cancelledRef.current = true
    abortRef.current?.abort()
  }

  const runWorkflow = useCallback(async ({ task, workflow }) => {
    cancelledRef.current = false
    abortRef.current = new AbortController()
    setIsRunning(true)
    resetAll()
    setActiveWorkflow(workflow)

    const startedAt = Date.now()
    pushLog('system', 'workflow', `Started: ${workflow.label} — "${task}"`)
    await notifyWorkflowStart(workflow.label, task)

    // Mark agents not in this workflow as idle; agents in queue as queued
    AGENTS.forEach(a => {
      const pos = workflow.agents.indexOf(a.id)
      if (pos === -1) {
        setAgent(a.id, { ...IDLE_STATE })
      } else if (pos > 0) {
        setAgent(a.id, { status: 'queued', output: '', progress: 0, queuePosition: pos + 1 })
      }
    })

    let previousOutput = task
    const ranAgents = []

    let wasCancelled = false

    for (let i = 0; i < workflow.agents.length; i++) {
      if (cancelledRef.current) { wasCancelled = true; break }

      const agentId = workflow.agents[i]
      const agent   = agentById[agentId]
      setCurrentStep(i)
      setAgent(agentId, { status: 'thinking', output: '', progress: 0, queuePosition: null })
      pushLog(agentId, 'start', `Starting (step ${i + 1}/${workflow.agents.length})`)
      await notifyAgentStart(agent.name, agent.icon, i + 1, workflow.agents.length)

      const userMessage = i === 0
        ? task
        : `Task: ${task}\n\nContext from ${workflow.agents[i - 1]}:\n${previousOutput}`

      let accumulated = ''

      try {
        setAgent(agentId, { status: 'working' })

        accumulated = await callAgent(agentId, userMessage, memory, chunk => {
          accumulated += chunk
          setAgent(agentId, { output: accumulated, progress: 0 })
        }, abortRef.current.signal)

        setAgent(agentId, { status: 'done', output: accumulated, progress: 100 })
        setCompletedSteps(prev => [...prev, i])
        pushLog(agentId, 'done', `Done — ${accumulated.length} chars`)
        await notifyAgentDone(agent.name, agent.icon, accumulated)

        const memEntry = `\n[${new Date().toISOString()}] ${agent.name}: ${accumulated.slice(0, 300)}`
        setMemory(prev => prev + memEntry)
        await notifyMemoryUpdated(agent.name)
        pushLog(agentId, 'memory', 'Memory updated')

        await syncToObsidian(agentId, accumulated, 'log')
        pushLog(agentId, 'info', 'Synced to Obsidian')

        previousOutput = accumulated
        ranAgents.push(agent.name)

      } catch (err) {
        if (err.name === 'AbortError' || cancelledRef.current) {
          setAgent(agentId, { status: 'idle', output: '' })
          wasCancelled = true
          break
        }
        setAgent(agentId, { status: 'error', output: `Error: ${err.message}` })
        pushLog(agentId, 'error', err.message)
        await notifyAgentError(agent.name, err.message)
        break
      }
    }

    const duration = Date.now() - startedAt
    if (wasCancelled) {
      pushLog('system', 'workflow', `Cancelled after ${(duration / 1000).toFixed(1)}s`)
      AGENTS.forEach(a => {
        if (agentStates[a.id]?.status === 'queued') setAgent(a.id, { ...IDLE_STATE })
      })
    } else {
      pushLog('system', 'workflow', `Complete in ${(duration / 1000).toFixed(1)}s`)
      await notifyWorkflowComplete(workflow.label, ranAgents, duration)
    }
    setCurrentStep(-1)
    setIsRunning(false)
  }, [memory])

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧠</span>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">AI Dev Agent</h1>
            <p className="text-gray-500 text-xs">dashboard.percubaan.com</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Running
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col gap-6 p-6 max-w-screen-2xl mx-auto w-full">

        {/* Workflow track */}
        {activeWorkflow && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4">
            <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold">
              {activeWorkflow.label}
            </div>
            <WorkflowTrack
              workflow={activeWorkflow}
              currentStep={currentStep}
              completedSteps={completedSteps}
            />
          </div>
        )}

        {/* Agent cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {AGENTS.map(agent => {
            const state = agentStates[agent.id]
            return (
              <AgentCard
                key={agent.id}
                agent={agent}
                status={state.status}
                output={state.output}
                progress={state.progress}
                queuePosition={state.queuePosition}
              />
            )
          })}
        </div>

        {/* Task input + side panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <TaskInput onRun={runWorkflow} onCancel={cancelWorkflow} isRunning={isRunning} />
          </div>
          <div className="lg:col-span-1 min-h-[280px]">
            <MemoryPanel memoryRaw={memory} onClear={() => !isRunning && setMemory('')} />
          </div>
          <div className="lg:col-span-1 min-h-[280px]">
            <ActivityLog entries={logs} />
          </div>
        </div>

      </div>
    </div>
  )
}
