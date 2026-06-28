import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WorkflowTrack from '../components/WorkflowTrack'

const WORKFLOW = {
  id: 'build-feature',
  label: 'Build New Feature',
  agents: ['planner', 'coder', 'tester'],
}

describe('WorkflowTrack', () => {
  it('renders all agent names in the workflow', () => {
    render(<WorkflowTrack workflow={WORKFLOW} />)
    expect(screen.getByText('Planner')).toBeInTheDocument()
    expect(screen.getByText('Coder')).toBeInTheDocument()
    expect(screen.getByText('Tester')).toBeInTheDocument()
  })

  it('renders agent icons', () => {
    render(<WorkflowTrack workflow={WORKFLOW} />)
    expect(screen.getByText('🗺️')).toBeInTheDocument()
    expect(screen.getByText('💻')).toBeInTheDocument()
    expect(screen.getByText('✅')).toBeInTheDocument()
  })

  it('shows checkmark for completed steps', () => {
    render(<WorkflowTrack workflow={WORKFLOW} completedSteps={[0]} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('shows checkmarks for multiple completed steps', () => {
    render(<WorkflowTrack workflow={WORKFLOW} completedSteps={[0, 1]} />)
    expect(screen.getAllByText('✓')).toHaveLength(2)
  })

  it('does not show checkmark when no steps completed', () => {
    render(<WorkflowTrack workflow={WORKFLOW} completedSteps={[]} />)
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })

  it('returns null when workflow is undefined', () => {
    const { container } = render(<WorkflowTrack workflow={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders single-agent workflow correctly', () => {
    const single = { id: 'fix', label: 'Fix', agents: ['debugger'] }
    render(<WorkflowTrack workflow={single} />)
    expect(screen.getByText('Debugger')).toBeInTheDocument()
  })

  it('renders all 4 agents in full-build workflow', () => {
    const full = {
      id: 'full-build',
      label: 'Full Project Build',
      agents: ['planner', 'coder', 'debugger', 'tester'],
    }
    render(<WorkflowTrack workflow={full} />)
    expect(screen.getByText('Planner')).toBeInTheDocument()
    expect(screen.getByText('Coder')).toBeInTheDocument()
    expect(screen.getByText('Debugger')).toBeInTheDocument()
    expect(screen.getByText('Tester')).toBeInTheDocument()
  })
})
