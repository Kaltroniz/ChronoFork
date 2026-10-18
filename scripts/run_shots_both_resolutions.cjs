const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../docs/screens');
const EVIDENCE_DIR = path.resolve(__dirname, '../docs/evidence/phase7');
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

async function runResolution(width, height) {
  console.log(`\n================================================================`);
  console.log(`RUNNING SCREENSHOT & NON-INTERSECTION SUITE AT ${width}x${height}`);
  console.log(`================================================================`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);

    // 01-idle.png
    console.log(`[${width}x${height}] Capturing 01-idle.png...`);
    await page.screenshot({ path: path.join(OUT_DIR, '01-idle.png') });

    // Click Scenario 1
    console.log(`[${width}x${height}] Triggering Scenario 1...`);
    await page.click('[data-testid="scenario-button-1"]');
    await page.waitForTimeout(800);

    // Event 4: Claims
    await page.evaluate(() => (window).__chronoSetIndex(4));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '02-claims.png') });

    // Event 5: Collision Detection (Hero)
    await page.evaluate(() => (window).__chronoSetIndex(5));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '03-collision-hero.png') });

    // Event 7: Collision & Git merge step (Assert label and chip bounding boxes)
    console.log(`\n--- [${width}x${height}] ASSERTING EVENT 7 CHAIN LABELS & CHIPS ---`);
    await page.evaluate(() => (window).__chronoSetIndex(7));
    await page.waitForTimeout(1000);

    const layoutData = await page.evaluate(() => {
      const cy = window.__chronoCy;
      if (!cy) return null;

      const chainIds = [
        'taskflow.worker.execute_job',
        'taskflow.queue.dequeue_task',
        'taskflow.auth.validate_token',
        'taskflow.database.get_connection',
        'taskflow.config.load_config'
      ];

      const labels = chainIds.map((id) => {
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
            y2: Math.round((r.bottom - parentR.top) * 10) / 10,
            w: Math.round(r.width * 10) / 10,
            h: Math.round(r.height * 10) / 10
          }
        };
      });

      return { labels, chips };
    });

    if (!layoutData) throw new Error('Layout data not accessible from window.__chronoCy');

    console.log(`[${width}x${height}] Chain Node Labels:`);
    layoutData.labels.forEach((l, idx) => {
      console.log(`  [${idx}] ${l.name}: bbox=[x1: ${l.bb.x1}, x2: ${l.bb.x2}, y1: ${l.bb.y1}, y2: ${l.bb.y2}]`);
    });

    console.log(`[${width}x${height}] Claim Chips:`);
    layoutData.chips.forEach((c, idx) => {
      console.log(`  [Chip ${idx}] "${c.text}": bbox=[x1: ${c.bb.x1}, x2: ${c.bb.x2}, y1: ${c.bb.y1}, y2: ${c.bb.y2}]`);
    });

    // 10 Pairwise Label Non-Intersection checks
    console.log(`\n[${width}x${height}] Pairwise Non-Intersection Assertions:`);
    for (let i = 0; i < layoutData.labels.length; i++) {
      for (let j = i + 1; j < layoutData.labels.length; j++) {
        const l1 = layoutData.labels[i];
        const l2 = layoutData.labels[j];
        const res = rectIntersection(l1.bb, l2.bb);
        const gap = Math.round((l2.bb.x1 - l1.bb.x2) * 10) / 10;
        if (res.intersects) {
          throw new Error(`OVERLAP: [${l1.name}] and [${l2.name}] overlap by ${res.area}px² at ${width}x${height}`);
        } else {
          console.log(`  ASSERTION PASSED: [${l1.name}] and [${l2.name}] do NOT intersect (gap = ${gap}px)`);
        }
      }
    }

    // Label non-intersection with A2 chip
    const a2Chip = layoutData.chips.find((c) => c.text.includes('A2'));
    if (!a2Chip) throw new Error(`A2 chip not found in DOM at ${width}x${height}`);
    layoutData.labels.forEach((l) => {
      const res = rectIntersection(l.bb, a2Chip.bb);
      if (res.intersects) {
        throw new Error(`OVERLAP: Label [${l.name}] and A2 chip overlap by ${res.area}px² at ${width}x${height}`);
      } else {
        const vGap = Math.round((l.bb.y1 - a2Chip.bb.y2) * 10) / 10;
        console.log(`  ASSERTION PASSED: Label [${l.name}] and [A2 chip] do NOT intersect (vertical gap = ${vGap}px)`);
      }
    });

    // Event 10: Handoff
    await page.evaluate(() => (window).__chronoSetIndex(10));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '05-resolution-handoff.png') });

    // Event 13: Verdict Tab
    await page.evaluate(() => (window).__chronoSetIndex(13));
    await page.waitForTimeout(600);
    const verdictBtn = page.locator('button:has-text("Verdict")');
    if (await verdictBtn.isVisible()) {
      await verdictBtn.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: path.join(OUT_DIR, '04-git-vs-chronofork.png') });

    // Merge receipt
    const receiptBtn = page.locator('button:has-text("Merge receipt")');
    if (await receiptBtn.isVisible()) {
      await receiptBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT_DIR, '08-receipt.png') });
    }

    // Scenario 2: Memory compare
    console.log(`[${width}x${height}] Capturing Scenario 2 (06-memory-run-compare.png)...`);
    await page.click('[data-testid="scenario-button-2"]');
    await page.waitForTimeout(1000);
    await page.evaluate(() => (window).__chronoSetIndex(6));
    await page.waitForTimeout(600);
    const memTab = page.locator('button:has-text("Memory (")');
    if (await memTab.isVisible()) {
      await memTab.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: path.join(OUT_DIR, '06-memory-run-compare.png') });

    // Scenario 3: Zero path proof
    console.log(`[${width}x${height}] Capturing Scenario 3 (07-zero-path-proof.png)...`);
    await page.click('[data-testid="scenario-button-3"]');
    await page.waitForTimeout(1000);
    await page.evaluate(() => (window).__chronoSetIndex(5));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '07-zero-path-proof.png') });

    console.log(`\n🌟 All assertions passed at ${width}x${height}!`);
  } finally {
    await browser.close();
  }
}

(async () => {
  // 1. Run at 1440x900
  await runResolution(1440, 900);

  // 2. Run at 1920x1080
  await runResolution(1920, 1080);

  console.log('\n================================================================');
  console.log('🎉 SCREENSHOT SUITE COMPLETED FOR BOTH 1440x900 AND 1920x1080');
  console.log('================================================================');
})();
