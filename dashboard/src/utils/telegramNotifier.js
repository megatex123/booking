const TOKEN   = import.meta.env.VITE_TELEGRAM_TOKEN
const CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID

export async function sendTelegram(message) {
  if (!TOKEN || !CHAT_ID) return
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'HTML' }),
    })
  } catch {
    // Telegram failures are non-critical — swallow silently
  }
}

export function notifyWorkflowStart(workflowName, task) {
  return sendTelegram(
    `<b>[dashboard]</b> ◈ Workflow started\n<b>${workflowName}</b>\n<i>${task}</i>`
  )
}

export function notifyAgentStart(agentName, icon, step, total) {
  return sendTelegram(
    `<b>[dashboard]</b> ${icon} <b>${agentName}</b> started (step ${step}/${total})`
  )
}

export function notifyAgentDone(agentName, icon, outputPreview) {
  const preview = outputPreview ? `\n<code>${outputPreview.slice(0, 200)}</code>` : ''
  return sendTelegram(
    `<b>[dashboard]</b> ✅ <b>${agentName}</b> done${preview}`
  )
}

export function notifyAgentError(agentName, error) {
  return sendTelegram(
    `<b>[dashboard]</b> ❌ <b>${agentName}</b> error\n<code>${String(error).slice(0, 300)}</code>`
  )
}

export function notifyWorkflowComplete(workflowName, agents, durationMs) {
  const secs = (durationMs / 1000).toFixed(1)
  const chain = agents.join(' → ')
  return sendTelegram(
    `<b>[dashboard]</b> 🎉 Workflow complete\n<b>${workflowName}</b>\n${chain}\n<i>${secs}s</i>`
  )
}

export function notifyMemoryUpdated(agentName) {
  return sendTelegram(
    `<b>[dashboard]</b> ⟳ Memory updated by <b>${agentName}</b>`
  )
}
