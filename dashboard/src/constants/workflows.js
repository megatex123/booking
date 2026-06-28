export const WORKFLOWS = [
  {
    id: 'build-feature',
    label: 'Build New Feature',
    agents: ['planner', 'coder', 'tester'],
  },
  {
    id: 'fix-bug',
    label: 'Fix a Bug',
    agents: ['debugger', 'tester'],
  },
  {
    id: 'full-build',
    label: 'Full Project Build',
    agents: ['planner', 'coder', 'debugger', 'tester'],
  },
  {
    id: 'code-review',
    label: 'Code Review',
    agents: ['coder', 'tester'],
  },
]
