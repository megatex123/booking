const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const MODEL   = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

const MEMORY_RULE = `
Before responding: review the shared memory provided in the user message.
After responding: your output will be stored in shared memory for the next agent.`

const SYSTEM_PROMPTS = {
  planner: `You are a software architect and technical planner.${MEMORY_RULE}
Output a clear numbered plan with concrete steps. Each step must name the file or function to create/change.
Format your output as a structured plan, not prose. Be specific and actionable.`,

  coder: `You are a senior full-stack developer (React/Next.js, Node.js, Python Flask, Go, PHP).${MEMORY_RULE}
Write clean, working code. Add a comment only when the WHY is non-obvious.
Output code in fenced blocks with the file path as the label. No half-implementations.`,

  debugger: `You are an expert debugger and root-cause analyst.${MEMORY_RULE}
First identify the root cause precisely. Then provide the minimal fix.
Format: 1) Root Cause, 2) Fix, 3) Files changed. Do not over-engineer the solution.`,

  tester: `You are a QA engineer who writes thorough tests.${MEMORY_RULE}
Write pytest tests for Python code and Jest/Vitest tests for JavaScript/React.
Cover the golden path and key edge cases. Label each test with what it verifies.`,
}

/**
 * Calls the Anthropic Messages API with streaming.
 *
 * @param {string}   agentId     - One of: planner, coder, debugger, tester
 * @param {string}   userMessage - The task + context passed to this agent
 * @param {string}   memory      - Current shared memory.md contents
 * @param {Function} onChunk     - Called with each streamed text delta
 * @returns {Promise<string>}    - Full accumulated output
 */
export async function callAgent(agentId, userMessage, memory = '', onChunk, signal) {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY is not set')

  const systemPrompt = SYSTEM_PROMPTS[agentId]
  if (!systemPrompt) throw new Error(`Unknown agentId: ${agentId}`)

  const fullUserMessage = memory
    ? `--- SHARED MEMORY ---\n${memory}\n--- END MEMORY ---\n\n${userMessage}`
    : userMessage

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type':         'application/json',
      'x-api-key':            API_KEY,
      'anthropic-version':    '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      stream:     true,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: fullUserMessage }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let fullOutput = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') continue
      try {
        const event = JSON.parse(raw)
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const chunk = event.delta.text
          fullOutput += chunk
          onChunk?.(chunk)
        }
      } catch {
        // malformed SSE line — skip
      }
    }
  }

  return fullOutput
}
