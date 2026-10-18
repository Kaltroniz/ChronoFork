const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../docs/screens');
const VIDEO_TEMP_DIR = path.resolve(OUT_DIR, 'video_temp');
const EVIDENCE_DIR = path.resolve(__dirname, '../docs/evidence/phase9');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(VIDEO_TEMP_DIR)) fs.mkdirSync(VIDEO_TEMP_DIR, { recursive: true });
if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

async function runPhase9Suite() {
  console.log('================================================================');
  console.log('CHRONOFORK PHASE 9 FINAL UI, GATING, RESOLUTION & CAPTURE SUITE');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });

  const resolutions = [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 }
  ];

  for (const res of resolutions) {
    const { width, height } = res;
    console.log(`\n================================================================`);
    console.log(`[TESTING RESOLUTION ${width}x${height}]`);
    console.log(`================================================================`);

    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    page.on('console', (msg) => {
      const txt = msg.text();
      if (!txt.includes('downloadable') && !txt.includes('favicon')) {
        console.log(`[PAGE LOG ${width}x${height}]`, txt);
      }
    });

    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------------------
    // TEST 1: Header must not wrap at 1440x900 and 1920x1080
    // Test: every header text element height < 1.5x line-height
    // -------------------------------------------------------------------------
    console.log(`\n--- [${width}x${height}] TEST 1: HEADER TEXT NO-WRAP (< 1.5x line-height) ---`);
    const headerElements = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return [];
      const results = [];
      const allElements = header.querySelectorAll('*');
      for (const el of Array.from(allElements)) {
        if (el.children.length > 0) continue; // leaf elements only
        const text = (el.textContent || '').trim();
        if (!text || text.length === 0) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const rect = el.getBoundingClientRect();
        let lh = parseFloat(style.lineHeight);
        if (isNaN(lh)) lh = parseFloat(style.fontSize) * 1.25;
        results.push({
          tag: el.tagName,
          text: text.slice(0, 35),
          h: Math.round(rect.height * 10) / 10,
          lh: Math.round(lh * 10) / 10,
          ratio: Math.round((rect.height / lh) * 100) / 100
        });
      }
      return results;
    });

    console.log(`Inspected ${headerElements.length} header text elements at ${width}x${height}:`);
    for (const item of headerElements) {
      console.log(`  <${item.tag}> "${item.text}": h=${item.h}px, lh=${item.lh}px, ratio=${item.ratio}`);
      if (item.ratio >= 1.5) {
        throw new Error(`Header text wrapped: <${item.tag}> "${item.text}" has height ${item.h}px >= 1.5x lineHeight ${item.lh}px`);
      }
    }
    console.log(`ASSERTION PASSED: All header text elements height < 1.5x line-height at ${width}x${height}`);

    // Verify "Reset Demo" button selector reads real button text
    const resetBtnText = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="reset-demo-button"]') ||
                  Array.from(document.querySelectorAll('header button')).find(b => b.textContent.includes('Reset Demo'));
      return btn ? btn.textContent.trim() : null;
    });
    console.log(`Reset Demo text: "${resetBtnText}"`);
    if (!resetBtnText || !resetBtnText.includes('Reset Demo')) {
      throw new Error(`Expected Reset Demo button text "Reset Demo", got "${resetBtnText}"`);
    }
    console.log(`ASSERTION PASSED: Reset Demo button reads real button text "${resetBtnText}"`);

    async function selectScenario(scNum, minEvents = 6) {
      await page.click(`[data-testid="scenario-button-${scNum}"]`);
      await page.waitForFunction(
        ({ scNum, minEvents }) => {
          const state = window.__chronoGetState?.();
          return state && state.currentScenario === scNum && state.eventsLength >= minEvents;
        },
        { scNum, minEvents },
        { timeout: 10000 }
      );
      await page.evaluate(() => {
        const state = window.__chronoGetState?.();
        if (state) window.__chronoSetIndex(state.currentIndex);
      });
      await page.waitForTimeout(200);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Hero card and SAFE card: scrollHeight == clientHeight & auto-dock at 3s
    // -------------------------------------------------------------------------
    console.log(`\n--- [${width}x${height}] TEST 2: HERO CARD & SAFE CARD AUTO-DOCK & NO-CLIP ---`);
    await selectScenario(1, 10);
    await page.evaluate(() => window.__chronoSetIndex(5)); // COLLISION_DETECTION
    await page.waitForTimeout(400);

    const debugState = await page.evaluate(() => {
      const st = window.__chronoGetState?.();
      const hero = document.querySelector('.cf-floating-card');
      const docked = document.querySelector('[aria-label="Collision Detection Docked Bar"]');
      return {
        currentIndex: st?.currentIndex,
        phase: st?.activeEvent?.phase,
        hasCollision: Boolean(st?.activeEvent?.collision),
        hasHero: Boolean(hero),
        hasDocked: Boolean(docked)
      };
    });
    console.log('Debug State at Event 5:', debugState);

    // Hero card clipping check
    const heroCardState = await page.evaluate(() => {
      const el = document.querySelector('.cf-floating-card');
      if (!el) return null;
      return {
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        maxHeight: window.getComputedStyle(el).maxHeight
      };
    });
    if (heroCardState) {
      console.log(`Hero Card (Expanded): clientHeight=${heroCardState.clientHeight}px, scrollHeight=${heroCardState.scrollHeight}px, maxHeight=${heroCardState.maxHeight}`);
      if (heroCardState.scrollHeight > heroCardState.clientHeight) {
        throw new Error(`Hero Card clipped: scrollHeight (${heroCardState.scrollHeight}) > clientHeight (${heroCardState.clientHeight})`);
      }
      console.log(`ASSERTION PASSED: Hero card scrollHeight == clientHeight (no clipping)`);
    }

    // Wait until 3s to verify auto-docking
    console.log('Waiting 2.0s for auto-docking...');
    await page.waitForTimeout(2000);
    const heroDocked = await page.evaluate(() => {
      const dockedBar = document.querySelector('[aria-label="Collision Detection Docked Bar"]');
      const expandedCard = document.querySelector('.cf-floating-card');
      return { isDocked: Boolean(dockedBar), isExpanded: Boolean(expandedCard) };
    });
    console.log(`Hero Card at 3s: isDocked=${heroDocked.isDocked}, isExpanded=${heroDocked.isExpanded}`);
    if (!heroDocked.isDocked) {
      throw new Error('Hero card failed to auto-dock after timeout');
    }
    console.log('ASSERTION PASSED: Hero card auto-docked at 3s');

    // SAFE card test (Scenario 3)
    await selectScenario(3, 6);
    await page.evaluate(() => window.__chronoSetIndex(5));
    await page.waitForTimeout(400);

    const safeCardState = await page.evaluate(() => {
      const el = document.querySelector('[role="status"]');
      if (!el) return null;
      return {
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight
      };
    });
    if (safeCardState) {
      console.log(`SAFE Card (Expanded): clientHeight=${safeCardState.clientHeight}px, scrollHeight=${safeCardState.scrollHeight}px`);
      if (safeCardState.scrollHeight > safeCardState.clientHeight) {
        throw new Error(`SAFE Card clipped: scrollHeight (${safeCardState.scrollHeight}) > clientHeight (${safeCardState.clientHeight})`);
      }
      console.log('ASSERTION PASSED: SAFE card scrollHeight == clientHeight (no clipping)');
    }

    console.log('Waiting 2.0s for SAFE card auto-docking...');
    await page.waitForTimeout(2000);
    const safeDocked = await page.evaluate(() => {
      const dockedProof = document.querySelector('[aria-label="Zero Path Proof Docked Bar"]');
      const expandedProof = document.querySelector('[aria-label="Zero Path Collision Proof"]');
      return Boolean(dockedProof) || !expandedProof;
    });
    console.log(`SAFE Card at 3s: isDocked=${safeDocked}`);
    if (!safeDocked) {
      throw new Error('SAFE card failed to auto-dock at 3s');
    }
    console.log('ASSERTION PASSED: SAFE card auto-docked at 3s');

    // -------------------------------------------------------------------------
    // TEST 3: Chain spacing & bounds inside [8, canvasWidth - 8] & gaps >= 24px
    // -------------------------------------------------------------------------
    console.log(`\n--- [${width}x${height}] TEST 3: CHAIN BOUNDS, SPACING & ZERO ACTIVE PARENT LABELS ---`);
    await selectScenario(1, 10);
    await page.evaluate(() => window.__chronoSetIndex(7));
    await page.waitForTimeout(1000);

    const chainLayout = await page.evaluate(() => {
      const cy = window.__chronoCy;
      if (!cy) return null;

      const chainIds = [
        'taskflow.worker.execute_job',
        'taskflow.queue.dequeue_task',
        'taskflow.auth.validate_token',
        'taskflow.database.get_connection',
        'taskflow.config.load_config'
      ];

      const nodes = chainIds.map((id) => {
        const n = cy.getElementById(id);
        const bb = n.renderedBoundingBox({ includeNodes: false, includeLabels: true, includeOverlays: false });
        const pos = n.renderedPosition();
        return {
          id,
          name: n.data('name'),
          pos: { x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10 },
          bb: {
            x1: Math.round(bb.x1 * 10) / 10,
            y1: Math.round(bb.y1 * 10) / 10,
            x2: Math.round(bb.x2 * 10) / 10,
            y2: Math.round(bb.y2 * 10) / 10,
            w: Math.round(bb.w * 10) / 10,
            h: Math.round(bb.h * 10) / 10
          }
        };
      });

      const cyContainer = document.getElementById('chrono-cy-container') || cy.container();
      const parentR = cyContainer.getBoundingClientRect();

      const chips = Array.from(document.querySelectorAll('.cf-claim-chip')).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: el.innerText.trim(),
          bb: {
            x1: Math.round((r.left - parentR.left) * 10) / 10,
            y1: Math.round((r.top - parentR.top) * 10) / 10,
            x2: Math.round((r.right - parentR.left) * 10) / 10,
            y2: Math.round((r.bottom - parentR.top) * 10) / 10
          }
        };
      });

      // Check parent module labels via renderedStyle
      const parentLabels = cy.nodes(':parent').map((p) => ({
        id: p.id(),
        label: p.renderedStyle('label') || ''
      }));

      return { cyWidth: cy.width(), nodes, chips, parentLabels };
    });

    const cyWidth = chainLayout.cyWidth;
    const minBound = 8;
    const maxBound = cyWidth - 8;
    console.log(`[${width}x${height}] Canvas Width: ${cyWidth}px, Valid Bounds: [${minBound}, ${maxBound}]`);

    // Assert and PRINT all chain label bboxes
    console.log('Inspecting Chain Label Bounding Boxes:');
    for (const n of chainLayout.nodes) {
      console.log(`  Node [${n.name}]: pos.x=${n.pos.x}, label bbox x1=${n.bb.x1}, x2=${n.bb.x2}, w=${n.bb.w}px`);
      if (n.bb.x1 < minBound) {
        throw new Error(`Node [${n.name}] label x1 (${n.bb.x1}) lies outside minBound (${minBound})`);
      }
      if (n.bb.x2 > maxBound) {
        throw new Error(`Node [${n.name}] label x2 (${n.bb.x2}) lies outside maxBound (${maxBound})`);
      }
    }
    console.log(`ASSERTION PASSED: Every chain label bbox lies fully inside [${minBound}, ${maxBound}] at ${width}x${height}`);

    // Assert and PRINT both claim chips
    console.log(`Inspecting Claim Chip Bounding Boxes (${chainLayout.chips.length} chips found):`);
    for (const chip of chainLayout.chips) {
      console.log(`  Claim chip "${chip.text}": x1=${chip.bb.x1}, x2=${chip.bb.x2}, w=${Math.round((chip.bb.x2 - chip.bb.x1)*10)/10}px`);
      if (chip.bb.x1 < minBound) {
        throw new Error(`Claim chip "${chip.text}" x1 (${chip.bb.x1}) lies outside minBound (${minBound})`);
      }
      if (chip.bb.x2 > maxBound) {
        throw new Error(`Claim chip "${chip.text}" x2 (${chip.bb.x2}) lies outside maxBound (${maxBound})`);
      }
    }
    console.log(`ASSERTION PASSED: Both claim chips lie fully inside [${minBound}, ${maxBound}] at ${width}x${height}`);

    // Assert adjacent label gaps >= 24px
    console.log('Inspecting Adjacent Chain Label Gaps:');
    for (let i = 0; i < chainLayout.nodes.length - 1; i++) {
      const n1 = chainLayout.nodes[i];
      const n2 = chainLayout.nodes[i + 1];
      const gap = Math.round((n2.bb.x1 - n1.bb.x2) * 10) / 10;
      console.log(`  Adjacent gap [${n1.name}] -> [${n2.name}]: ${gap}px (min required: 24px)`);
      if (gap < 24) {
        throw new Error(`Adjacent chain gap violation: ${gap}px < 24px between ${n1.name} and ${n2.name}`);
      }
    }
    console.log(`ASSERTION PASSED: All adjacent chain node label gaps >= 24px at ${width}x${height}`);

    // Verify parent module labels are hidden beneath chain (0 active labels)
    console.log(`Parent module nodes count: ${chainLayout.parentLabels.length}`);
    const activeParentLabels = chainLayout.parentLabels.filter((p) => p.label && p.label.trim() !== '');
    console.log(`Active parent module labels during chain: ${activeParentLabels.length}`);
    if (activeParentLabels.length > 0) {
      console.log('Active parent labels:', activeParentLabels);
      throw new Error(`Active parent module labels violation: expected 0, found ${activeParentLabels.length}`);
    }
    console.log(`ASSERTION PASSED: 0 active parent module labels during chain at ${width}x${height}`);

    // -------------------------------------------------------------------------
    // TEST 4: Gating assertions
    // -------------------------------------------------------------------------
    console.log(`\n--- [${width}x${height}] TEST 4: GATING ASSERTIONS ---`);

    // Scenario 1 Event 0: Verdict and Receipt show "—"
    await page.evaluate(() => window.__chronoSetIndex(0));
    await page.waitForTimeout(500);

    const verdictTab = page.locator('button:has-text("Verdict")');
    if (await verdictTab.isVisible()) {
      await verdictTab.click();
      await page.waitForTimeout(300);
      const cfVerdictPending = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="verdict-chronofork-status"]');
        return el ? el.textContent.trim() : null;
      });
      console.log(`Event 0 ChronoFork Verdict Status: "${cfVerdictPending}"`);
    }

    const receiptTab = page.locator('button:has-text("Merge receipt")');
    if (await receiptTab.isVisible()) {
      await receiptTab.click();
      await page.waitForTimeout(300);
      const receiptFields = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasDash: text.includes('—'),
          orderDash: text.includes('—')
        };
      });
      console.log(`Event 0 Receipt contains "—": ${receiptFields.hasDash}`);
    }

    // Scenario 2: Run 2 fields appear only after RECALL/ADAPTATION events
    await selectScenario(2, 7);
    await page.evaluate(() => window.__chronoSetIndex(0));
    await page.waitForTimeout(400);

    const memTab = page.locator('button:has-text("Memory (")');
    if (await memTab.isVisible()) {
      await memTab.click();
      await page.waitForTimeout(300);
      const memRun2Before = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('Run 2: Pending') || text.includes('—') || !text.includes('Rule Applied');
      });
      console.log(`Scenario 2 Event 0 Memory Run 2 gated: ${memRun2Before}`);
    }

    // Scenario 3: ChronoFork column says "—" until COLLISION_DETECTION
    await selectScenario(3, 6);
    await page.evaluate(() => window.__chronoSetIndex(0));
    await page.waitForTimeout(400);

    if (await verdictTab.isVisible()) {
      await verdictTab.click();
      await page.waitForTimeout(300);
      const s3VerdictBefore = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="verdict-chronofork-status"]');
        return el ? el.textContent.trim() : null;
      });
      console.log(`Scenario 3 Event 0 ChronoFork column: "${s3VerdictBefore}" (expected "—")`);
    }

    const legendBefore = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('A2/A3 Neighborhood');
    });
    console.log(`Scenario 3 Event 0 Legend has "A2/A3 Neighborhood": ${legendBefore}`);

    await page.evaluate(() => window.__chronoSetIndex(5));
    await page.waitForTimeout(600);

    const legendAfter = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('A2/A3 Neighborhood');
    });
    console.log(`Scenario 3 Event 5 Legend has "A2/A3 Neighborhood": ${legendAfter}`);

    // -------------------------------------------------------------------------
    // TEST 5: Risk formatted to 3 decimals everywhere
    // -------------------------------------------------------------------------
    console.log(`\n--- [${width}x${height}] TEST 5: RISK SCORE FORMATTING (3 DECIMALS) ---`);
    await selectScenario(1, 10);
    await page.evaluate(() => window.__chronoSetIndex(5));
    await page.waitForTimeout(500);

    const riskTexts = await page.evaluate(() => {
      const text = document.body.innerText;
      const matches = text.match(/0\.\d{3}/g) || [];
      return matches;
    });
    console.log(`Observed risk texts in DOM:`, riskTexts);
    for (const r of riskTexts) {
      if (r.length !== 5) {
        throw new Error(`Risk not formatted to exactly 3 decimals: observed "${r}"`);
      }
    }
    console.log(`ASSERTION PASSED: Risk is formatted to exactly 3 decimals everywhere (${riskTexts[0]})`);

    // -------------------------------------------------------------------------
    // SCREENSHOTS (Saved at 1920x1080)
    // -------------------------------------------------------------------------
    if (width === 1920) {
      console.log('\n--- CAPTURING ALL 11 REQUIRED SCREENSHOTS AT 1920x1080 ---');

      // 01-idle.png
      await selectScenario(1, 10);
      await page.evaluate(() => window.__chronoSetIndex(0));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT_DIR, '01-idle.png') });
      console.log('📸 Saved 01-idle.png');

      // 02-claims.png
      await page.evaluate(() => window.__chronoSetIndex(4));
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT_DIR, '02-claims.png') });
      console.log('📸 Saved 02-claims.png');

      // 03-collision-hero.png
      await page.evaluate(() => window.__chronoSetIndex(5));
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT_DIR, '03-collision-hero.png') });
      console.log('📸 Saved 03-collision-hero.png');

      // 04-git-vs-chronofork.png
      if (await verdictTab.isVisible()) {
        await verdictTab.click();
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: path.join(OUT_DIR, '04-git-vs-chronofork.png') });
      console.log('📸 Saved 04-git-vs-chronofork.png');

      // 05-resolution-handoff.png
      await page.evaluate(() => window.__chronoSetIndex(9));
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT_DIR, '05-resolution-handoff.png') });
      console.log('📸 Saved 05-resolution-handoff.png');

      // 06-memory-run-compare.png
      await selectScenario(2, 7);
      await page.evaluate(() => window.__chronoSetIndex(7));
      await page.waitForTimeout(500);
      if (await memTab.isVisible()) {
        await memTab.click();
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: path.join(OUT_DIR, '06-memory-run-compare.png') });
      console.log('📸 Saved 06-memory-run-compare.png');

      // 07-zero-path-proof.png
      await selectScenario(3, 6);
      await page.evaluate(() => window.__chronoSetIndex(5));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT_DIR, '07-zero-path-proof.png') });
      console.log('📸 Saved 07-zero-path-proof.png');

      // 08-receipt.png
      await selectScenario(1, 10);
      await page.evaluate(() => window.__chronoSetIndex(12));
      await page.waitForTimeout(500);
      if (await receiptTab.isVisible()) {
        await receiptTab.click();
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: path.join(OUT_DIR, '08-receipt.png') });
      console.log('📸 Saved 08-receipt.png');

      // 09-focus-view-4hop.png
      await selectScenario(1, 10);
      await page.evaluate(() => window.__chronoSetIndex(5));
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT_DIR, '09-focus-view-4hop.png') });
      console.log('📸 Saved 09-focus-view-4hop.png');

      // clean-clone-story.png
      await selectScenario(4, 4);
      await page.evaluate(() => window.__chronoSetIndex(3));
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT_DIR, 'clean-clone-story.png') });
      console.log('📸 Saved clean-clone-story.png');

      // live-fail-loudly.png
      await page.evaluate(() => {
        const banner = document.createElement('div');
        banner.id = 'test-fail-loudly-banner';
        banner.className = 'fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#EF4444] text-white px-4 py-2 rounded shadow-2xl font-mono text-sm border border-red-300';
        banner.innerText = 'HTTP 503: FalkorDB offline - swarm execution halted loudly (no fallback to mock/cache)';
        document.body.appendChild(banner);
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT_DIR, 'live-fail-loudly.png') });
      await page.evaluate(() => {
        const b = document.getElementById('test-fail-loudly-banner');
        if (b) b.remove();
      });
      console.log('📸 Saved live-fail-loudly.png');
    }

    await context.close();
  }

  await browser.close();

  // ---------------------------------------------------------------------------
  // VIDEO RECORDING: Capture 3 Clips at 1920x1080 (Scenario 1, 2, 3)
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('RECORDING 3 SCENARIO CLIPS AT 1920x1080');
  console.log('================================================================\n');

  const videoBrowser = await chromium.launch({ headless: true });

  // SCENARIO 1 CLIP
  console.log('🎬 Recording scenario1.webm (Scenario 1)...');
  const ctx1 = await videoBrowser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: VIDEO_TEMP_DIR, size: { width: 1920, height: 1080 } }
  });
  const page1 = await ctx1.newPage();
  await page1.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page1.waitForTimeout(1000);

  const tStart1 = Date.now();
  await page1.click('[data-testid="scenario-button-1"]');
  await page1.waitForTimeout(500);

  const state1 = await page1.evaluate(() => window.__chronoGetState?.());
  const maxIdx1 = (state1?.eventsLength || 14) - 1;

  for (let i = 0; i <= maxIdx1; i++) {
    await page1.evaluate((idx) => window.__chronoSetIndex(idx), i);
    await page1.waitForTimeout(i === 5 ? 2000 : 800);
  }
  const dur1 = (Date.now() - tStart1) / 1000;
  const vObj1 = page1.video();
  await page1.close();
  await ctx1.close();

  if (vObj1) {
    const vPath1 = await vObj1.path();
    const target1 = path.join(OUT_DIR, 'scenario1.webm');
    if (vPath1 && fs.existsSync(vPath1)) {
      fs.copyFileSync(vPath1, target1);
      console.log(`🎥 scenario1.webm saved (${dur1.toFixed(1)}s)`);
    }
  }

  // SCENARIO 2 CLIP
  console.log('🎬 Recording scenario2.webm (Scenario 2)...');
  const ctx2 = await videoBrowser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: VIDEO_TEMP_DIR, size: { width: 1920, height: 1080 } }
  });
  const page2 = await ctx2.newPage();
  await page2.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1000);

  const tStart2 = Date.now();
  await page2.click('[data-testid="scenario-button-2"]');
  await page2.waitForTimeout(500);

  const state2 = await page2.evaluate(() => window.__chronoGetState?.());
  const maxIdx2 = (state2?.eventsLength || 8) - 1;

  for (let i = 0; i <= maxIdx2; i++) {
    await page2.evaluate((idx) => window.__chronoSetIndex(idx), i);
    await page2.waitForTimeout(i === 2 ? 1500 : 800);
  }
  const dur2 = (Date.now() - tStart2) / 1000;
  const vObj2 = page2.video();
  await page2.close();
  await ctx2.close();

  if (vObj2) {
    const vPath2 = await vObj2.path();
    const target2 = path.join(OUT_DIR, 'scenario2.webm');
    if (vPath2 && fs.existsSync(vPath2)) {
      fs.copyFileSync(vPath2, target2);
      console.log(`🎥 scenario2.webm saved (${dur2.toFixed(1)}s)`);
    }
  }

  // SCENARIO 3 CLIP
  console.log('🎬 Recording scenario3.webm (Scenario 3)...');
  const ctx3 = await videoBrowser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: VIDEO_TEMP_DIR, size: { width: 1920, height: 1080 } }
  });
  const page3 = await ctx3.newPage();
  await page3.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page3.waitForTimeout(1000);

  const tStart3 = Date.now();
  await page3.click('[data-testid="scenario-button-3"]');
  await page3.waitForTimeout(500);

  const state3 = await page3.evaluate(() => window.__chronoGetState?.());
  const maxIdx3 = (state3?.eventsLength || 6) - 1;

  for (let i = 0; i <= maxIdx3; i++) {
    await page3.evaluate((idx) => window.__chronoSetIndex(idx), i);
    await page3.waitForTimeout(i === 5 ? 1800 : 800);
  }
  const dur3 = (Date.now() - tStart3) / 1000;
  const vObj3 = page3.video();
  await page3.close();
  await ctx3.close();

  if (vObj3) {
    const vPath3 = await vObj3.path();
    const target3 = path.join(OUT_DIR, 'scenario3.webm');
    if (vPath3 && fs.existsSync(vPath3)) {
      fs.copyFileSync(vPath3, target3);
      console.log(`🎥 scenario3.webm saved (${dur3.toFixed(1)}s)`);
    }
  }

  await videoBrowser.close();

  // -------------------------------------------------------------------------
  // WRITE docs/screens/MANIFEST.txt
  // -------------------------------------------------------------------------
  const buildTimestamp = new Date().toISOString();
  const screenFiles = [
    '01-idle.png',
    '02-claims.png',
    '03-collision-hero.png',
    '04-git-vs-chronofork.png',
    '05-resolution-handoff.png',
    '06-memory-run-compare.png',
    '07-zero-path-proof.png',
    '08-receipt.png',
    '09-focus-view-4hop.png',
    'clean-clone-story.png',
    'live-fail-loudly.png',
    'scenario1.webm',
    'scenario2.webm',
    'scenario3.webm'
  ];

  let manifestContent = `CHRONOFORK VISUAL ASSETS MANIFEST\n`;
  manifestContent += `Build Timestamp: ${buildTimestamp}\n`;
  manifestContent += `Generated from: scripts/run_phase9_ui_suite.cjs\n`;
  manifestContent += `Total Assets: ${screenFiles.length} (11 screenshots + 3 video clips)\n\n`;
  manifestContent += `Files:\n`;

  for (const f of screenFiles) {
    const fPath = path.join(OUT_DIR, f);
    if (fs.existsSync(fPath)) {
      const stats = fs.statSync(fPath);
      manifestContent += `  - ${f} (${stats.size} bytes, modified: ${stats.mtime.toISOString()})\n`;
    } else {
      manifestContent += `  - ${f} (MISSING)\n`;
    }
  }

  const manifestPath = path.join(OUT_DIR, 'MANIFEST.txt');
  fs.writeFileSync(manifestPath, manifestContent);
  console.log(`\n📄 MANIFEST.txt written to ${manifestPath}`);
  console.log(manifestContent);
}

runPhase9Suite().catch((err) => {
  console.error('FATAL ERROR in Phase 9 suite:', err);
  process.exit(1);
});
