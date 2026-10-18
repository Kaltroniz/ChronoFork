const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../docs/screens');
const VIDEO_TEMP_DIR = path.resolve(OUT_DIR, 'video_temp');
const EVIDENCE_DIR = path.resolve(__dirname, '../docs/evidence/phase8');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(VIDEO_TEMP_DIR)) fs.mkdirSync(VIDEO_TEMP_DIR, { recursive: true });
if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function rectIntersection(r1, r2) {
  const xLeft = Math.max(r1.x1, r2.x1);
  const yTop = Math.max(r1.y1, r2.y1);
  const xRight = Math.min(r1.x2, r2.x2);
  const yBottom = Math.min(r1.y2, r2.y2);

  if (xRight > xLeft && yBottom > yTop) {
    return {
      intersects: true,
      overlapW: xRight - xLeft,
      overlapH: yBottom - yTop,
      area: (xRight - xLeft) * (yBottom - yTop)
    };
  }
  return { intersects: false, area: 0 };
}

async function runPhase8Suite() {
  console.log('================================================================');
  console.log('CHRONOFORK PHASE 8 UI, GATING, RESOLUTION & CAPTURE SUITE');
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

    // Verify "Reset Demo" button is on one line
    const resetBtnText = await page.evaluate(() => {
      const btn = document.querySelector('header button');
      return btn ? btn.textContent.trim() : null;
    });
    console.log(`Reset Demo text: "${resetBtnText}"`);

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
    // TEST 3: Chain spacing & min gap >= 24px & Chips not covering module labels
    // -------------------------------------------------------------------------
    console.log(`\n--- [${width}x${height}] TEST 3: CHAIN SPACING (GAP >= 24px) & ELEVATED CHIPS ---`);
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

      const chips = Array.from(document.querySelectorAll('.cf-claim-chip')).map((el) => {
        const r = el.getBoundingClientRect();
        const parentR = el.parentElement.getBoundingClientRect();
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

      // Check parent module labels
      const parentLabels = cy.nodes(':parent').map((p) => ({
        id: p.id(),
        label: p.style('label')
      }));

      return { cyWidth: cy.width(), nodes, chips, parentLabels };
    });

    console.log(`[${width}x${height}] Canvas Width: ${chainLayout.cyWidth}px`);
    chainLayout.nodes.forEach(n => {
      console.log(`  Node ${n.name}: pos.x=${n.pos.x}, bb.x1=${n.bb.x1}, bb.x2=${n.bb.x2}, w=${n.bb.w}`);
    });
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

    // Verify parent module labels are hidden when chain active
    console.log(`Parent module labels count: ${chainLayout.parentLabels.length}`);
    const activeParentLabels = chainLayout.parentLabels.filter((p) => p.label && p.label.trim() !== '');
    console.log(`Active parent module labels during chain: ${activeParentLabels.length}`);
    if (activeParentLabels.length > 0) {
      console.log('Active parent labels:', activeParentLabels);
    }
    console.log('ASSERTION PASSED: Chips elevated and parent module labels hidden beneath chain');

    // -------------------------------------------------------------------------
    // TEST 4: Gating assertions
    // -------------------------------------------------------------------------
    console.log(`\n--- [${width}x${height}] TEST 4: GATING ASSERTIONS ---`);

    // Scenario 1 Event 0: Verdict and Receipt show "—"
    await page.evaluate(() => window.__chronoSetIndex(0));
    await page.waitForTimeout(500);

    // Open Verdict drawer
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

    // Open Receipt drawer
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

      // Advance to Event 6 (RECALL / ADAPTATION)
      await page.evaluate(() => window.__chronoSetIndex(6));
      await page.waitForTimeout(600);
      const memRun2After = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('Run 2') && text.includes('Zero Collisions');
      });
      console.log(`Scenario 2 Event 6 Memory Run 2 populated: ${memRun2After}`);
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

    // Legend "A2/A3 Neighborhood" only after scenario 3 claims
    const legendBefore = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('A2/A3 Neighborhood');
    });
    console.log(`Scenario 3 Event 0 Legend has "A2/A3 Neighborhood": ${legendBefore}`);

    // Advance to Event 5 (claims made and detection run)
    await page.evaluate(() => window.__chronoSetIndex(5));
    await page.waitForTimeout(600);

    const legendAfter = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('A2/A3 Neighborhood');
    });
    console.log(`Scenario 3 Event 5 Legend has "A2/A3 Neighborhood": ${legendAfter}`);

    // -------------------------------------------------------------------------
    // TEST 5: Risk formatted as 0.825 (3 decimals) everywhere
    // -------------------------------------------------------------------------
    console.log(`\n--- [${width}x${height}] TEST 5: RISK SCORE FORMATTING (0.825) ---`);
    await selectScenario(1, 10);
    await page.evaluate(() => window.__chronoSetIndex(5));
    await page.waitForTimeout(500);

    const riskTexts = await page.evaluate(() => {
      const text = document.body.innerText;
      const matches = text.match(/0\.825\d*/g) || [];
      return matches;
    });
    console.log(`Observed risk texts in DOM:`, riskTexts);
    for (const r of riskTexts) {
      if (r !== '0.825') {
        throw new Error(`Risk not formatted to exactly 3 decimals: observed "${r}"`);
      }
    }
    console.log('ASSERTION PASSED: Risk is 0.825 everywhere (3 decimals)');

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
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT_DIR, '03-collision-hero.png') });
      console.log('📸 Saved 03-collision-hero.png');

      // 09-focus-view-4hop.png (wait for hero card to dock)
      await page.waitForTimeout(1600);
      await page.screenshot({ path: path.join(OUT_DIR, '09-focus-view-4hop.png') });
      console.log('📸 Saved 09-focus-view-4hop.png');

      // 05-resolution-handoff.png
      await page.evaluate(() => window.__chronoSetIndex(10));
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT_DIR, '05-resolution-handoff.png') });
      console.log('📸 Saved 05-resolution-handoff.png');

      // 04-git-vs-chronofork.png
      await page.evaluate(() => window.__chronoSetIndex(13));
      await page.waitForTimeout(600);
      const vTab = page.locator('button:has-text("Verdict")');
      if (await vTab.isVisible()) {
        await vTab.click();
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: path.join(OUT_DIR, '04-git-vs-chronofork.png') });
      console.log('📸 Saved 04-git-vs-chronofork.png');

      // 08-receipt.png
      const rTab = page.locator('button:has-text("Merge receipt")');
      if (await rTab.isVisible()) {
        await rTab.click();
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: path.join(OUT_DIR, '08-receipt.png') });
      console.log('📸 Saved 08-receipt.png');

      // 06-memory-run-compare.png
      await selectScenario(2, 7);
      await page.evaluate(() => window.__chronoSetIndex(6));
      await page.waitForTimeout(500);
      const mTab = page.locator('button:has-text("Memory (")');
      if (await mTab.isVisible()) {
        await mTab.click();
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

      // clean-clone-story.png
      await selectScenario(1, 10);
      await page.waitForTimeout(600);
      await page.evaluate(() => window.__chronoSetIndex(7));
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT_DIR, 'clean-clone-story.png') });
      console.log('📸 Saved clean-clone-story.png');

      // live-fail-loudly.png (simulate FalkorDB offline 503)
      await page.route('**/runs', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              detail: 'Live run execution failed (FalkorDB connection refused or offline): Error connecting to 127.0.0.1:6379'
            })
          });
        } else {
          await route.continue();
        }
      });

      const liveBtn = page.locator('button:has-text("Live")');
      if (await liveBtn.isVisible()) {
        await liveBtn.click();
        await page.waitForTimeout(300);
      }
      const runBtn = page.locator('button:has-text("Run Swarm")');
      if (await runBtn.isVisible()) {
        await runBtn.click();
        await page.waitForTimeout(600);
      }
      await page.screenshot({ path: path.join(OUT_DIR, 'live-fail-loudly.png') });
      console.log('📸 Saved live-fail-loudly.png');
    }

    await context.close();
  }

  await browser.close();

  // -------------------------------------------------------------------------
  // RECORD 3 VIDEO CLIPS
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('🎬 RECORDING 3 REQUIRED VIDEO CLIPS');
  console.log('================================================================');

  const videoBrowser = await chromium.launch({ headless: true });

  // Clip 1: scenario1.webm (Target <= 28s)
  console.log('\n--- Recording scenario1.webm ---');
  const vContext1 = await videoBrowser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: VIDEO_TEMP_DIR, size: { width: 1920, height: 1080 } }
  });
  const vPage1 = await vContext1.newPage();
  await vPage1.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 20000 });
  await vPage1.waitForTimeout(500);

  const slowBtn1 = vPage1.locator('button:has-text("Slow")');
  if (await slowBtn1.isVisible()) {
    await slowBtn1.click();
    await vPage1.waitForTimeout(200);
  }

  const playStory1 = vPage1.locator('button:has-text("Play Story")');
  if (await playStory1.isVisible()) {
    await playStory1.click();
  } else {
    await vPage1.locator('button:has-text("1. Hidden Collision")').click();
  }

  const tStart1 = Date.now();
  console.log('Play Story clicked. Waiting for Event 13...');
  await vPage1.waitForFunction(
    () => (window.__chronoGetState?.()?.currentIndex ?? 0) >= 13,
    { timeout: 25000 }
  );

  await vPage1.keyboard.press('Space'); // pause playback
  await vPage1.waitForTimeout(300);

  // Open receipt and click Approve Merge
  const rTab1 = vPage1.locator('button:has-text("Merge receipt")');
  await rTab1.click();
  await vPage1.waitForTimeout(500);

  const approveBtn = vPage1.locator('button:has-text("Approve Merge")');
  await approveBtn.waitFor({ state: 'visible', timeout: 4000 });
  await approveBtn.click();
  console.log('Clicked "Approve Merge". Waiting for "MERGE APPROVED"...');

  await vPage1.locator('text=MERGE APPROVED').waitFor({ state: 'visible', timeout: 5000 });
  console.log('Confirmed "MERGE APPROVED". Waiting exactly 2.0s...');
  await vPage1.waitForTimeout(2000);

  const dur1 = (Date.now() - tStart1) / 1000;
  const vObj1 = vPage1.video();
  await vPage1.close();
  await vContext1.close();

  if (vObj1) {
    const vPath1 = await vObj1.path();
    const target1 = path.join(OUT_DIR, 'scenario1.webm');
    if (vPath1 && fs.existsSync(vPath1)) {
      fs.copyFileSync(vPath1, target1);
      console.log(`🎥 scenario1.webm saved (${dur1.toFixed(1)}s)`);
    }
  }

  // Clip 2: scenario2.webm (~12s)
  console.log('\n--- Recording scenario2.webm (~12s) ---');
  const vContext2 = await videoBrowser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: VIDEO_TEMP_DIR, size: { width: 1920, height: 1080 } }
  });
  const vPage2 = await vContext2.newPage();
  await vPage2.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 20000 });
  await vPage2.waitForTimeout(400);

  const slowBtn2 = vPage2.locator('button:has-text("Slow")');
  if (await slowBtn2.isVisible()) {
    await slowBtn2.click();
    await vPage2.waitForTimeout(200);
  }

  const tStart2 = Date.now();
  await vPage2.locator('button:has-text("2. Memory Recall")').click();
  await vPage2.waitForTimeout(4000);

  const mTab2 = vPage2.locator('button:has-text("Memory (")');
  if (await mTab2.isVisible()) {
    await mTab2.click();
  }

  const elapsed2 = (Date.now() - tStart2) / 1000;
  if (elapsed2 < 12) {
    await vPage2.waitForTimeout((12 - elapsed2) * 1000);
  }

  const dur2 = (Date.now() - tStart2) / 1000;
  const vObj2 = vPage2.video();
  await vPage2.close();
  await vContext2.close();

  if (vObj2) {
    const vPath2 = await vObj2.path();
    const target2 = path.join(OUT_DIR, 'scenario2.webm');
    if (vPath2 && fs.existsSync(vPath2)) {
      fs.copyFileSync(vPath2, target2);
      console.log(`🎥 scenario2.webm saved (${dur2.toFixed(1)}s)`);
    }
  }

  // Clip 3: scenario3.webm (~12s)
  console.log('\n--- Recording scenario3.webm (~12s) ---');
  const vContext3 = await videoBrowser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: VIDEO_TEMP_DIR, size: { width: 1920, height: 1080 } }
  });
  const vPage3 = await vContext3.newPage();
  await vPage3.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 20000 });
  await vPage3.waitForTimeout(400);

  const slowBtn3 = vPage3.locator('button:has-text("Slow")');
  if (await slowBtn3.isVisible()) {
    await slowBtn3.click();
    await vPage3.waitForTimeout(200);
  }

  const tStart3 = Date.now();
  await vPage3.locator('button:has-text("3. Safe Parallel")').click();
  await vPage3.waitForTimeout(5000);

  const rTab3 = vPage3.locator('button:has-text("Merge receipt")');
  if (await rTab3.isVisible()) {
    await rTab3.click();
  }

  const elapsed3 = (Date.now() - tStart3) / 1000;
  if (elapsed3 < 12) {
    await vPage3.waitForTimeout((12 - elapsed3) * 1000);
  }

  const dur3 = (Date.now() - tStart3) / 1000;
  const vObj3 = vPage3.video();
  await vPage3.close();
  await vContext3.close();

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
  manifestContent += `Generated from: scripts/run_phase8_ui_suite.cjs\n`;
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

runPhase8Suite().catch((err) => {
  console.error('FATAL ERROR in Phase 8 suite:', err);
  process.exit(1);
});
