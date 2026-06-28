import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ActivityLog from '../components/ActivityLog'

function makeEntry(agent, type, message, id) {
  return { id, agent, type, message, ts: new Date('2026-06-26T10:00:00Z').getTime() }
}

describe('ActivityLog', () => {
  it('shows empty state when no entries', () => {
    render(<ActivityLog entries={[]} />)
    expect(screen.getByText('No activity yet…')).toBeInTheDocument()
  })

  it('renders a log entry message', () => {
    const entries = [makeEntry('coder', 'start', 'Starting task', 1)]
    render(<ActivityLog entries={entries} />)
    expect(screen.getByText('Starting task')).toBeInTheDocument()
  })

  it('renders agent name in brackets', () => {
    const entries = [makeEntry('planner', 'info', 'Planning...', 1)]
    render(<ActivityLog entries={entries} />)
    expect(screen.getByText('[planner]')).toBeInTheDocument()
  })

  it('renders multiple entries', () => {
    const entries = [
      makeEntry('coder',    'start', 'Coder started',  1),
      makeEntry('debugger', 'done',  'Debugger done',  2),
      makeEntry('tester',   'info',  'Tests running',  3),
    ]
    render(<ActivityLog entries={entries} />)
    expect(screen.getByText('Coder started')).toBeInTheDocument()
    expect(screen.getByText('Debugger done')).toBeInTheDocument()
    expect(screen.getByText('Tests running')).toBeInTheDocument()
  })

  it('shows entry count', () => {
    const entries = [
      makeEntry('coder', 'start', 'msg 1', 1),
      makeEntry('coder', 'done',  'msg 2', 2),
    ]
    render(<ActivityLog entries={entries} />)
    expect(screen.getByText('2 entries')).toBeInTheDocument()
  })

  it('shows 0 entries when empty', () => {
    render(<ActivityLog entries={[]} />)
    expect(screen.getByText('0 entries')).toBeInTheDocument()
  })

  it('caps display at 60 entries', () => {
    const entries = Array.from({ length: 80 }, (_, i) =>
      makeEntry('system', 'info', `message ${i + 1}`, i + 1)
    )
    render(<ActivityLog entries={entries} />)
    // first 20 entries are sliced off, so message 1 should not appear
    expect(screen.queryByText('message 1')).not.toBeInTheDocument()
    // last entry should appear
    expect(screen.getByText('message 80')).toBeInTheDocument()
  })

  it('renders system entries', () => {
    const entries = [makeEntry('system', 'workflow', 'Workflow complete', 1)]
    render(<ActivityLog entries={entries} />)
    expect(screen.getByText('[system]')).toBeInTheDocument()
    expect(screen.getByText('Workflow complete')).toBeInTheDocument()
  })

  it('renders type prefix symbols', () => {
    const entries = [
      makeEntry('coder',  'start', 'started', 1),
      makeEntry('coder',  'done',  'done',    2),
      makeEntry('coder',  'error', 'failed',  3),
    ]
    render(<ActivityLog entries={entries} />)
    expect(screen.getByText('▶')).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByText('✗')).toBeInTheDocument()
  })
})
