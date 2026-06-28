import React from 'react'
import { AGENTS } from '../constants/agents'

const agentById = Object.fromEntries(AGENTS.map(a => [a.id, a]))

const COLOR_TEXT   = { blue: 'text-blue-400',   green: 'text-green-400',   red: 'text-red-400',   purple: 'text-purple-400'   }
const COLOR_BG     = { blue: 'bg-blue-500',      green: 'bg-green-500',     red: 'bg-red-500',     purple: 'bg-purple-500'     }
const COLOR_BORDER = { blue: 'border-blue-500',  green: 'border-green-500', red: 'border-red-500', purple: 'border-purple-500' }
const COLOR_RING   = { blue: 'ring-blue-500',    green: 'ring-green-500',   red: 'ring-red-500',   purple: 'ring-purple-500'   }
const COLOR_LINE   = { blue: 'bg-blue-500',      green: 'bg-green-500',     red: 'bg-red-500',     purple: 'bg-purple-500'     }

export default function WorkflowTrack({ workflow, currentStep = -1, completedSteps = [] }) {
  if (!workflow) return null

  return (
    <div className="flex items-start w-full overflow-x-auto py-2 gap-0">
      {workflow.agents.map((agentId, index) => {
        const agent = agentById[agentId]
        if (!agent) return null

        const isCompleted = completedSteps.includes(index)
        const isCurrent   = currentStep === index
        const isLast      = index === workflow.agents.length - 1

        const circleCls = [
          'w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all duration-300',
          isCompleted
            ? `${COLOR_BG[agent.color]} text-white`
            : isCurrent
            ? `bg-gray-900 border-2 ${COLOR_BORDER[agent.color]} ring-2 ring-offset-2 ring-offset-gray-950 ${COLOR_RING[agent.color]}`
            : 'bg-gray-800 text-gray-500',
        ].join(' ')

        const labelCls = [
          'text-xs text-center whitespace-nowrap mt-1 transition-colors duration-300',
          isCompleted ? COLOR_TEXT[agent.color]
            : isCurrent ? 'text-white font-semibold'
            : 'text-gray-600',
        ].join(' ')

        return (
          <React.Fragment key={agentId}>
            <div className="flex flex-col items-center min-w-[72px]">
              <div className={circleCls}>
                {isCompleted
                  ? <span className="text-sm font-bold">✓</span>
                  : <span>{agent.icon}</span>
                }
              </div>
              <span className={labelCls}>{agent.name}</span>
            </div>

            {!isLast && (
              <div className="flex-1 flex items-center mb-6 min-w-[12px] mx-1">
                <div className={`h-0.5 w-full transition-colors duration-300 ${isCompleted ? COLOR_LINE[agent.color] : 'bg-gray-800'}`} />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
