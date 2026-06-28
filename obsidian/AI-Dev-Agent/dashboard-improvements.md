# Dashboard Improvements

Track UI/UX changes, new panels, and data pipeline updates for the dashboard.

## UI / UX Changes
### 2026-06-26 — Project Scaffold
- Vite + React 18 + Tailwind setup complete
- `src/constants/agents.js` — 4 agents with id, name, icon, role, color, pulse
- `src/constants/workflows.js` — 4 workflows with agent sequences
- Dev server: `0.0.0.0:5173`


## New Panels / Widgets
### 2026-06-26 — Core UI Components
- `PulseRing.jsx` — dual-ring CSS keyframe animation around active agent icon, hex color per agent
- `AgentCard.jsx` — status badge (idle/thinking/working/done/error/queued), PulseRing when active, indeterminate/determinate progress bar, scrollable monospace output panel, queue position badge
- `WorkflowTrack.jsx` — horizontal step track, connecting lines, checkmark on completed steps, ring highlight on current step
- Keyframes added to `index.css`: `pulse-ring`, `pulse-ring-delay`, `indeterminate`


### 2026-06-26 — Input & Log Panels
- `TaskInput.jsx` — workflow selector buttons, textarea (Ctrl+Enter to submit), loading spinner on Run button, fully disabled while running
- `MemoryPanel.jsx` — parses raw memory.md into 4 color-coded sections, scrollable monospace, Clear button
- `ActivityLog.jsx` — timestamped entries, color-coded per agent, auto-scroll to bottom, max 60 entries

## Data Pipeline
### 2026-06-26 — Telegram + Obsidian Utils
- `utils/telegramNotifier.js` — 6 functions: workflowStart, agentStart, agentDone, agentError, workflowComplete, memoryUpdated. HTML parse mode. Reads token/chat_id from `import.meta.env`. Silent fail.
- `utils/obsidianSync.js` — `syncToObsidian(agentId, output, type)` maps agent → Obsidian file, POSTs to `BACKEND_URL/obsidian/append`. Falls back to `project-log.md` for unknown agents.

### 2026-06-26 — API + App Shell
- `api/claudeAgent.js` — SSE streaming to Anthropic `/v1/messages`, model `claude-sonnet-4-6`, 1000 tokens. 4 system prompts (planner/coder/debugger/tester) each include memory rule. `onChunk` callback for live output streaming.
- `App.jsx` — full orchestration shell. State: agentStates, memory, logs, activeWorkflow, currentStep, completedSteps. `runWorkflow()` loops workflow steps sequentially, passes previous agent output as context to next. Triggers all Telegram + Obsidian sync hooks. Dark space UI with 2×4 agent grid, workflow track, task input, memory panel, activity log.

## Tests
### 2026-06-26 — Test Suite (Vitest + Testing Library)

**Result: 46/46 passed ✓**

| File | Tests | Result |
|---|---|---|
| `AgentCard.test.jsx` | 13 | ✓ all passed |
| `WorkflowTrack.test.jsx` | 8 | ✓ all passed |
| `ActivityLog.test.jsx` | 9 | ✓ all passed (after fix) |
| `App.test.jsx` | 16 | ✓ all passed |

**Bug found and fixed:**
- `ActivityLog.jsx` — `bottomRef.current?.scrollIntoView` throws in jsdom (not implemented). Fixed: guard with `typeof scrollIntoView === 'function'` check. Safe in real browser, silently skips in test environment.

**Coverage:**
- AgentCard: all 6 statuses, queue badge, output panel, progress bar
- WorkflowTrack: checkmarks, null workflow guard, all 4 agents
- ActivityLog: empty state, entry rendering, 60-entry cap, type prefixes
- App: all 4 workflow agent sequences verified, context chaining, Telegram/Obsidian call counts

## Known Issues

### Resolved
- **CSS not showing through Cloudflare tunnel (2026-06-27):** Vite dev mode injects CSS via JavaScript (`__vite__updateStyle()`), which silently fails through tunnel proxies. Fixed by switching to `vite preview` (production build) in ecosystem.config.js. Production build generates `<link rel="stylesheet">` that works through any proxy/CDN/tunnel.
- **Anthropic API calls blocked in browser:** Added `anthropic-dangerous-direct-browser-access: true` header to all requests in `claudeAgent.js`. Without this header, Anthropic blocks direct browser calls.
- **MAX_TOKENS=1000 causing truncated coder/planner output:** Planner outputs (architecture plans) and coder outputs (code + explanation) were cut off at ~750 words. Bumped to 4096.
- **`dashboard/.env` was missing:** All `VITE_*` env vars were `undefined` at build time. Created file with Telegram creds and VITE_BACKEND_URL. Rebuilt dashboard. **Pending:** user still needs to fill in `VITE_ANTHROPIC_API_KEY`.
- **obsidianSync.js called wrong URL:** Was `api.percubaan.com/obsidian/append` (voice-model server, no such route). Fixed to `voicetotext.percubaan.com/api/obsidian/append` (Next.js API route that writes via `fs`).

---

## 2026-06-27 — Final Dashboard State

**Production build:** `npm run build` ✓ (run after .env was created)  
**pm2 process:** `vite preview --host 0.0.0.0 --port 5173`  
**Cloudflare:** `dashboard.percubaan.com → localhost:5173` ✓  
**CSS:** Fully applied via `<link rel="stylesheet">` (production build) ✓  

### Component inventory

| Component | File | Status |
|---|---|---|
| Agent grid | `AgentCard.jsx` | ✅ |
| Pulse ring animation | `PulseRing.jsx` | ✅ |
| Workflow step track | `WorkflowTrack.jsx` | ✅ |
| Task input + workflow selector | `TaskInput.jsx` | ✅ |
| Memory panel | `MemoryPanel.jsx` | ✅ |
| Activity log (60-entry cap) | `ActivityLog.jsx` | ✅ |
| App orchestration shell | `App.jsx` | ✅ |
| Claude SSE streaming | `api/claudeAgent.js` (MAX_TOKENS=4096) | ✅ |
| Telegram notifications | `utils/telegramNotifier.js` | ✅ |
| Obsidian sync | `utils/obsidianSync.js` | ✅ |

### Workflows available

| id | Name | Agents |
|---|---|---|
| plan-build-test | Plan → Build → Test | planner → coder → tester |
| debug-fix-verify | Debug → Fix → Verify | debugger → coder → tester |
| review-refactor | Review → Refactor | debugger → coder |
| full-cycle | Full Cycle | planner → coder → debugger → tester |

### Telegram notifications active

All 6 notification points wired:
1. `workflowStart` — sent when Run is clicked
2. `agentStart` — sent before each agent call
3. `agentDone` — sent with output preview (first 200 chars) after each agent
4. `agentError` — sent if any agent throws
5. `workflowComplete` — sent when all agents finish
6. `memoryUpdated` — sent when memory panel is synced

### Pending actions

- User must add `VITE_ANTHROPIC_API_KEY=sk-ant-...` to `dashboard/.env`, then:
  ```bash
  cd /home/penyahpepijat/claude/dashboard
  npm run build
  pm2 restart dashboard
  ```

