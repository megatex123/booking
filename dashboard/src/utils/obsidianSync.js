const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'https://voicetotext.percubaan.com'

const OBSIDIAN_FILE_MAP = {
  planner:  'project-log.md',
  coder:    'dashboard-improvements.md',
  debugger: 'agent-improvements.md',
  tester:   'agent-improvements.md',
  memory:   'memory.md',
  vtt:      'vtt-improvements.md',
  model:    'model-improvements.md',
  investment: 'investment-log.md',
}

/**
 * Appends agent output to the correct Obsidian file via backend API.
 *
 * @param {string} agentId   - Agent id or file type key (see OBSIDIAN_FILE_MAP)
 * @param {string} output    - Content to append
 * @param {'log'|'memory'|'improvement'} type - Determines formatting
 */
export async function syncToObsidian(agentId, output, type = 'log') {
  const file = OBSIDIAN_FILE_MAP[agentId] ?? 'project-log.md'
  const timestamp = new Date().toISOString().slice(0, 10)

  const body = {
    file,
    content: formatBlock(agentId, output, type, timestamp),
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/obsidian/append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { ok: true, file }
  } catch (err) {
    console.warn('[obsidianSync] failed:', err.message)
    return { ok: false, error: err.message }
  }
}

function formatBlock(agentId, output, type, date) {
  const header = `\n\n## ${date} — ${agentId} [${type}]\n`
  if (type === 'memory') {
    return `${header}${output}\n`
  }
  return `${header}\`\`\`\n${output}\n\`\`\`\n`
}
