import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import App from '../App'

// Mock API and utils — tests verify orchestration, not external calls
vi.mock('../api/claudeAgent', () => ({
  callAgent: vi.fn(async (agentId, _msg, _mem, onChunk) => {
    onChunk?.(`${agentId} output`)
    return `${agentId} output`
  }),
}))

vi.mock('../utils/telegramNotifier', () => ({
  notifyWorkflowStart:    vi.fn().mockResolvedValue(undefined),
  notifyAgentStart:       vi.fn().mockResolvedValue(undefined),
  notifyAgentDone:        vi.fn().mockResolvedValue(undefined),
  notifyAgentError:       vi.fn().mockResolvedValue(undefined),
  notifyWorkflowComplete: vi.fn().mockResolvedValue(undefined),
  notifyMemoryUpdated:    vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../utils/obsidianSync', () => ({
  syncToObsidian: vi.fn().mockResolvedValue({ ok: true }),
}))

import { callAgent } from '../api/claudeAgent'
import {
  notifyWorkflowStart,
  notifyAgentDone,
  notifyWorkflowComplete,
} from '../utils/telegramNotifier'
import { syncToObsidian } from '../utils/obsidianSync'

beforeEach(() => {
  vi.clearAllMocks()
})

async function submitWorkflow(label, taskText) {
  // Select workflow button
  fireEvent.click(screen.getByText(label))
  // Type task
  const textarea = screen.getByPlaceholderText(/Describe the task/i)
  fireEvent.change(textarea, { target: { value: taskText } })
  // Click Run
  fireEvent.click(screen.getByText('Run'))
}

describe('App — layout', () => {
  it('renders the dashboard header', () => {
    render(<App />)
    expect(screen.getByText('AI Dev Agent')).toBeInTheDocument()
    expect(screen.getByText('dashboard.percubaan.com')).toBeInTheDocument()
  })

  it('renders all 4 agent cards', () => {
    render(<App />)
    expect(screen.getByText('Planner')).toBeInTheDocument()
    expect(screen.getByText('Coder')).toBeInTheDocument()
    expect(screen.getByText('Debugger')).toBeInTheDocument()
    expect(screen.getByText('Tester')).toBeInTheDocument()
  })

  it('renders all workflow buttons in TaskInput', () => {
    render(<App />)
    expect(screen.getByText('Build New Feature')).toBeInTheDocument()
    expect(screen.getByText('Fix a Bug')).toBeInTheDocument()
    expect(screen.getByText('Full Project Build')).toBeInTheDocument()
    expect(screen.getByText('Code Review')).toBeInTheDocument()
  })

  it('renders Shared Memory panel', () => {
    render(<App />)
    expect(screen.getByText('Shared Memory')).toBeInTheDocument()
  })

  it('renders Activity Log panel', () => {
    render(<App />)
    expect(screen.getByText('Activity Log')).toBeInTheDocument()
  })

  it('all agents start as Idle', () => {
    render(<App />)
    expect(screen.getAllByText('Idle')).toHaveLength(4)
  })
})

describe('App — workflow: Build New Feature', () => {
  it('calls agents in order: planner → coder → tester', async () => {
    render(<App />)
    await act(async () => { await submitWorkflow('Build New Feature', 'build login page') })
    await waitFor(() => expect(screen.queryByText('Running')).not.toBeInTheDocument(), { timeout: 5000 })

    const order = callAgent.mock.calls.map(c => c[0])
    expect(order).toEqual(['planner', 'coder', 'tester'])
  })

  it('notifies workflow start', async () => {
    render(<App />)
    await act(async () => { await submitWorkflow('Build New Feature', 'build login page') })
    await waitFor(() => expect(notifyWorkflowStart).toHaveBeenCalledWith('Build New Feature', 'build login page'))
  })

  it('notifies workflow complete', async () => {
    render(<App />)
    await act(async () => { await submitWorkflow('Build New Feature', 'build login') })
    await waitFor(() => expect(notifyWorkflowComplete).toHaveBeenCalled(), { timeout: 5000 })
  })

  it('syncs each agent to Obsidian', async () => {
    render(<App />)
    await act(async () => { await submitWorkflow('Build New Feature', 'build nav') })
    await waitFor(() => expect(syncToObsidian).toHaveBeenCalledTimes(3), { timeout: 5000 })
  })

  it('notifies done for each agent', async () => {
    render(<App />)
    await act(async () => { await submitWorkflow('Build New Feature', 'build footer') })
    await waitFor(() => expect(notifyAgentDone).toHaveBeenCalledTimes(3), { timeout: 5000 })
  })
})

describe('App — workflow: Fix a Bug', () => {
  it('calls agents in order: debugger → tester', async () => {
    render(<App />)
    await act(async () => { await submitWorkflow('Fix a Bug', 'fix null pointer') })
    await waitFor(() => expect(callAgent).toHaveBeenCalledTimes(2), { timeout: 5000 })

    const order = callAgent.mock.calls.map(c => c[0])
    expect(order).toEqual(['debugger', 'tester'])
  })
})

describe('App — workflow: Full Project Build', () => {
  it('calls agents in order: planner → coder → debugger → tester', async () => {
    render(<App />)
    await act(async () => { await submitWorkflow('Full Project Build', 'build full app') })
    await waitFor(() => expect(callAgent).toHaveBeenCalledTimes(4), { timeout: 5000 })

    const order = callAgent.mock.calls.map(c => c[0])
    expect(order).toEqual(['planner', 'coder', 'debugger', 'tester'])
  })
})

describe('App — workflow: Code Review', () => {
  it('calls agents in order: coder → tester', async () => {
    render(<App />)
    await act(async () => { await submitWorkflow('Code Review', 'review auth module') })
    await waitFor(() => expect(callAgent).toHaveBeenCalledTimes(2), { timeout: 5000 })

    const order = callAgent.mock.calls.map(c => c[0])
    expect(order).toEqual(['coder', 'tester'])
  })
})

describe('App — context chaining', () => {
  it('passes previous agent output as context to next agent', async () => {
    render(<App />)
    await act(async () => { await submitWorkflow('Fix a Bug', 'fix crash') })
    await waitFor(() => expect(callAgent).toHaveBeenCalledTimes(2), { timeout: 5000 })

    // Second call (tester) should include debugger output in the message
    const testerMessage = callAgent.mock.calls[1][1]
    expect(testerMessage).toContain('debugger output')
  })
})

describe('App — activity log', () => {
  it('logs workflow start entry', async () => {
    render(<App />)
    await act(async () => { await submitWorkflow('Fix a Bug', 'fix error') })
    await waitFor(() => expect(screen.getByText(/Started: Fix a Bug/)).toBeInTheDocument())
  })
})
