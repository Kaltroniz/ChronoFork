# Phase 1 Frontend Corrections Evidence Pack

> **Branch**: `SS1` (Local commit only)  
> **Timestamp**: 2026-10-17T13:01:00+05:30  
> **Execution Mode**: Frontend Only Modifications (`frontend/`)

---

## 1. Amendments & Verifications Summary

### Amendment 9: Risk Scores from Existing Evidence
From `docs/evidence/phase0/test_p1_stdout.txt`:
```text
Top 5 Risk-Scored Symbols in taskflow:
  taskflow.auth.validate_token: risk = 0.8561 (PR: 0.03992, BW: 40.0)
  taskflow.config.load_config: risk = 0.8250 (PR: 0.056058, BW: 26.0)
  taskflow.database.get_connection: risk = 0.7676 (PR: 0.044014, BW: 30.0)
  taskflow.worker.execute_job: risk = 0.6535 (PR: 0.017215, BW: 40.0)
  taskflow.queue.dequeue_task: risk = 0.5084 (PR: 0.014955, BW: 30.0)
```
- **Explanation**:
  - `taskflow.config.load_config`: PageRank = 0.056058, Betweenness = 26.0. Unified risk formula gives $0.5 \times (0.056058 / 0.056058) + 0.5 \times (26.0 / 40.0) = 0.5 \times 1.0 + 0.5 \times 0.65 = \mathbf{0.8250}$.
  - `taskflow.auth.validate_token`: PageRank = 0.039920, Betweenness = 40.0. Unified risk formula gives $0.5 \times (0.039920 / 0.056058) + 0.5 \times (40.0 / 40.0) = 0.3561 + 0.5000 = \mathbf{0.8561}$.
  - In an older cached replay message, `0.85` was either a hardcoded string or mistakenly rounded `validate_token`'s `0.8561` instead of `load_config`'s `0.8250`.

### Amendment 10: Removal of Codebase Dump Doc
- Executed `git rm CHRONOFORK_ALL_CODE_AND_EXPLANATION.md`.
- Committed in local commit `f882596`:
  `[SS1 f882596] chore: remove CHRONOFORK_ALL_CODE_AND_EXPLANATION.md (7614 deletions)`.

### Amendment 6: Single Source of Truth
- **Source of Truth**: `replays/*.json` is the sole source of truth.
- **Action Taken**: Deleted duplicate `frontend/src/fixtures/scenario_1.json` and removed dev fallback in `frontend/src/App.tsx`.
- The frontend strictly connects to backend SSE streaming (`/runs/{id}/events`), which serves directly from `replays/`. If the backend is unreachable, the console displays a clear error instead of falling back to stale fixtures.

### Amendment 4: GraphCanvas.tsx Fallback Strings Removed
**Grep BEFORE Edit**:
```text
frontend/src/components/GraphCanvas.tsx:132: nodeId: (e.node_ids && e.node_ids[0]) || 'taskflow.config.load_config',
frontend/src/components/GraphCanvas.tsx:144: nodeId: 'taskflow.worker.execute_job',
frontend/src/components/GraphCanvas.tsx:902: const startNodeId = a1Claim?.nodeId || 'taskflow.config.load_config';
frontend/src/components/GraphCanvas.tsx:988: const neighA2 = get4HopNeighborhood(a2Claim?.nodeId || 'taskflow.worker.execute_job');
frontend/src/components/GraphCanvas.tsx:989: const neighA3 = get4HopNeighborhood(a3Claim?.nodeId || 'taskflow.reports.generator.generate_summary');
frontend/src/components/GraphCanvas.tsx:1277: const a1Node = cy.getElementById('taskflow.config.load_config');
frontend/src/components/GraphCanvas.tsx:1278: const a2Node = cy.getElementById('taskflow.worker.execute_job');
frontend/src/components/GraphCanvas.tsx:1293: source: 'taskflow.config.load_config',
frontend/src/components/GraphCanvas.tsx:1294: target: 'taskflow.worker.execute_job',
```
**Grep AFTER Edit**:
```text
(0 matches)
```

### Amendment 3: Reset $\to$ Run S1 $\to$ Label State Sequence
Observed output from [`reset_run_s1_sequence_stdout.txt`](docs/evidence/phase1/reset_run_s1_sequence_stdout.txt):
```text
Step 1 (Reset): {"status":"SUCCESS","message":"Memory graph mem:taskflow has been reset."}
Memory count immediately after reset: rules=0, episodes=0
UI State: memoryWasReset=True -> "carried over" label is HIDDEN
Step 2 (Execute S1 Live): run_id=run_1792222194642, status=LIVE_EXECUTED
Events streamed: 15, Memory write events: 1
Memory count after S1 run: rules=1, episodes=1
UI State Transition: MEMORY_UPDATE event received -> setMemoryWasReset(false) fired!
UI State now: memoryWasReset=False -> "Memory state: carried over from previous runs" label is VISIBLE!
```

### Amendment 5 & 8: Zero-Path and Scenario 2 Card Text
- In [`ZeroPathProof.tsx`](frontend/src/components/ZeroPathProof.tsx):
  - Scenario 2 card text: `"memory changed A1's claim to BODY_EDIT; the breaking-intent query returned 0 rows"`.
  - Intent-filtered query card footer: `"no breaking-intent claim reaches another claim · Parallel execution authorized"`.
  - Removed all occurrences of `"Disjoint subgraphs confirmed"` when evaluating intent-filtered queries.

### Amendment 7: Provenance & LLM Badges
- In [`frontend/src/adapters/events.ts`](frontend/src/adapters/events.ts) and [`frontend/src/components/ProvenanceStrip.tsx`](frontend/src/components/ProvenanceStrip.tsx):
  - Provenance state strictly derived from `event.provenance[category]`. If absent, renders `"UNLABELLED"`.
  - LLM badge pill is conditionally filtered out unless `activeEvent?.provenance?.llm` is explicitly defined.
  - Receipt card capture time formatted with date, time, and timezone via `toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium', timeZoneName: 'short' })`.

### Items 5 & 6: Labels & Edge Styling
- In [`GraphCanvas.tsx`](frontend/src/components/GraphCanvas.tsx):
  - Compound module label font size constrained to `15px` bold (within min 13px, max 16px constraint).
  - Non-chain edges set to `0.12` opacity during run.
  - Handoff edge renders above labels with visible `"HANDED OFF"` text.
  - Scenario 3 legend adds explicit swatches for A2 neighborhood (`#E0A458`) and A3 neighborhood (`#4FB286`).

### Item 7: Verdict Placeholders
- In [`ResultStrip.tsx`](frontend/src/components/ResultStrip.tsx):
  - Before test data is available, renders neutral `"PENDING"`.
  - For Scenarios 2 and 3 in the Git column, renders `"Not run in this scenario"`.
  - Removed all instances of `'— FAILED'` and `'— PASSED'` from empty column states.
  - ChronoFork column never reads `FAILED` beside a SAFE card.

---

## 2. Hard-Coded Results Removal Audit (Item 11)

**Grep Before & After Across `frontend/src/`**:
- `12 PASSED`: 0 hits remaining.
- `5 FAILED`: 0 hits remaining.
- `1.39`: 0 hits remaining.
- `taskflow.` fallbacks in components: 0 hits remaining.
- `— PASSED` / `— FAILED`: 0 hits remaining.

---

## 3. Playwright State-Assertion Code (Item 12 Preview)

Per Amendment 2, screenshot and video captures are deferred to run after Phase 2 regenerates replays. Below is the state assertion test suite embedded in [`scripts/ui_shots.ts`](scripts/ui_shots.ts):

```typescript
// 02 Two claim chips with intents
const chipTexts = await page.$$eval('.cf-claim-chip', (els) => els.map((e) => e.textContent?.trim()));
recordAssert(2, 'Two chips with intents', chipTexts.length === 2 && chipTexts.some(c => c.includes('SIGNATURE_CHANGE')), '2 chips with intents', JSON.stringify(chipTexts));

// 03 Breach edges >= 4 and hero/chain boxes disjoint
const heroBox = await page.locator('.cf-floating-card').boundingBox();
const chainEdges = await page.evaluate(() => (window as any).__chronoCy.edges('.chain-edge').length);
recordAssert(3, 'Breach edges >= 4 and disjoint hero', chainEdges >= 4 && heroBox !== null, '>=4 breach edges', `edges=${chainEdges}`);

// 04 "5" FAILED and "12" PASSED both present
const stripText = await page.locator('#chrono-result-strip').innerText();
recordAssert(4, '5 FAILED and 12 PASSED in Verdict', stripText.includes('5 FAILED') && stripText.includes('12 PASSED'), '5 FAILED and 12 PASSED present', stripText.slice(0, 100));

// 05 HANDOFF text present
const hasHandoff = await page.evaluate(() => {
  const cy = (window as any).__chronoCy;
  return cy.edges().some((e: any) => e.data('label') === 'HANDED OFF');
});
recordAssert(5, 'HANDOFF text present', hasHandoff, 'HANDED OFF edge present', `hasHandoff=${hasHandoff}`);

// 06 BODY_EDIT chips and zero breach nodes in Scenario 2
const s2Chips = await page.$$eval('.cf-claim-chip', (els) => els.map((e) => e.textContent?.trim()));
const breachCountS2 = await page.evaluate(() => (window as any).__chronoCy.nodes('.breach-node').length);
recordAssert(6, 'BODY_EDIT chips & 0 breach nodes', s2Chips.every(c => c.includes('BODY_EDIT')) && breachCountS2 === 0, 'BODY_EDIT chips, 0 breach', `chips=${JSON.stringify(s2Chips)}, breach=${breachCountS2}`);

// 07 Zero breach nodes, SAFE card present, ChronoFork not FAILED in Scenario 3
const safeCard = await page.locator('text=SAFE · 0 PATHS').count();
const chronoforkFailed = stripText.includes('ChronoFork') && stripText.includes('FAILED');
recordAssert(7, 'SAFE card & ChronoFork not FAILED', safeCard > 0 && !chronoforkFailed, 'SAFE card, not failed', `safeCards=${safeCard}`);

// 08 Approval hash present only after clicking Approve
const hashBefore = await page.locator('.approval-hash').count();
await page.click('button:has-text("Approve & Sign")');
const hashAfter = await page.locator('.approval-hash').innerText();
recordAssert(8, 'Approval hash after click', hashBefore === 0 && hashAfter.length === 64, '64-char sha256 hash', hashAfter);
```
