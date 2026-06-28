import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentCard from '../components/AgentCard'

const AGENT = {
  id: 'coder',
  name: 'Coder',
  icon: '💻',
  role: 'Implements features across the stack',
  color: 'green',
  pulse: 'bg-green-400',
}

describe('AgentCard', () => {
  it('renders agent name and icon', () => {
    render(<AgentCard agent={AGENT} />)
    expect(screen.getByText('Coder')).toBeInTheDocument()
    expect(screen.getByText('💻')).toBeInTheDocument()
  })

  it('renders agent role', () => {
    render(<AgentCard agent={AGENT} />)
    expect(screen.getByText('Implements features across the stack')).toBeInTheDocument()
  })

  it('shows Idle badge by default', () => {
    render(<AgentCard agent={AGENT} />)
    expect(screen.getByText('Idle')).toBeInTheDocument()
  })

  it('shows Thinking badge when status=thinking', () => {
    render(<AgentCard agent={AGENT} status="thinking" />)
    expect(screen.getByText('Thinking…')).toBeInTheDocument()
  })

  it('shows Working badge when status=working', () => {
    render(<AgentCard agent={AGENT} status="working" />)
    expect(screen.getByText('Working')).toBeInTheDocument()
  })

  it('shows Done badge when status=done', () => {
    render(<AgentCard agent={AGENT} status="done" />)
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('shows Error badge when status=error', () => {
    render(<AgentCard agent={AGENT} status="error" />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('shows queue position badge when status=queued', () => {
    render(<AgentCard agent={AGENT} status="queued" queuePosition={2} />)
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('Queued')).toBeInTheDocument()
  })

  it('does not show queue badge when queuePosition is null', () => {
    render(<AgentCard agent={AGENT} status="queued" queuePosition={null} />)
    expect(screen.queryByText(/#\d/)).not.toBeInTheDocument()
  })

  it('renders output text in output panel', () => {
    render(<AgentCard agent={AGENT} output="Step 1: create file" />)
    expect(screen.getByText('Step 1: create file')).toBeInTheDocument()
  })

  it('shows placeholder when output is empty', () => {
    render(<AgentCard agent={AGENT} output="" />)
    expect(screen.getByText('No output yet…')).toBeInTheDocument()
  })

  it('shows progress bar when status=working', () => {
    const { container } = render(<AgentCard agent={AGENT} status="working" progress={60} />)
    const bar = container.querySelector('.bg-blue-400')
    expect(bar).toBeInTheDocument()
  })

  it('does not show progress bar when idle', () => {
    const { container } = render(<AgentCard agent={AGENT} status="idle" />)
    const bar = container.querySelector('.bg-blue-400.rounded-full')
    expect(bar).not.toBeInTheDocument()
  })
})
