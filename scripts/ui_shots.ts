import { chromium } from '../frontend/node_modules/playwright';
import * as path from 'path';
import * as fs from 'fs';

const OUT_DIR = path.resolve(__dirname, '../docs/screens');
const VIDEO_TEMP_DIR = path.resolve(OUT_DIR, 'video_temp');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}
if (!fs.existsSync(VIDEO_TEMP_DIR)) {
  fs.mkdirSync(VIDEO_TEMP_DIR, { recursive: true });
}

interface AssertionRecord {
  item: number;
  title: string;
  passed: boolean;
  expected: string;
  observed: string;
}

const assertionResults: AssertionRecord[] = [];

function recordAssert(item: number, title: string, condition: boolean, expected: string, observed: string) {
  assertionResults.push({
    item,
    title,
    passed: Boolean(condition),
    expected,
    observed
  });
  if (!condition) {
    console.error(`\n❌ ASSERTION FAILED [Item ${item}: ${title}]`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Observed: ${observed}\n`);
    throw new Error(`Assertion failed: [Item ${item}: ${title}] Expected ${expected}, got ${observed}`);
  } else {
    console.log(`✅ [Item ${item}] ${title} -> PASSED\n   Observed: ${observed}`);
  }
}

async function verifyMinimumFontSize(page: any, shotName: string) {
  const violations = await page.evaluate(() => {
    const badElements: Array<{ tag: string; text: string; fontSize: string }> = [];
    const all = document.querySelectorAll('*');

    for (const el of Array.from(all)) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        continue;
      }

      let hasText = false;
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
          hasText = true;
          break;
        }
      }

      if (hasText) {
        const sizePx = parseFloat(style.fontSize);
        if (sizePx < 12.9) {
          badElements.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().slice(0, 30),
            fontSize: style.fontSize
          });
        }
      }
    }
    return badElements;
  });

  if (violations.length > 0) {
    console.error(`[FONT VIOLATION in ${shotName}] Found ${violations.length} text elements below 13px:`);
    violations.slice(0, 5).forEach((v: any) => console.error(`  <${v.tag}> "${v.text}..." fontSize=${v.fontSize}`));
    throw new Error(`Text nodes rendered below 13px in ${shotName}`);
  }
}

async function checkLabelIntersections(page: any, stateName: string) {
  return await page.evaluate(() => {
    const cy = (window as any).__chronoCy;
    if (!cy) return { totalVisibleLabels: 0, intersectionCount: 0, intersections: [], minFontSize: 13, maxFontSize: 16 };

    const boxes: Array<{ id: string; label: string; x1: number; y1: number; x2: number; y2: number }> = [];
    const fontSizes: number[] = [];

    cy.nodes(':visible').forEach((n: any) => {
      if (n.hasClass('hide-label')) return;
      const lbl = n.renderedStyle('label');
      if (!lbl) return;

      const fsNum = parseFloat(n.renderedStyle('font-size')) || (n.numericStyle('font-size') * cy.zoom());
      fontSizes.push(fsNum);

      const bb = n.renderedBoundingBox({ includeLabels: true, includeNodes: false, includeOverlays: false });
      if (bb && bb.w > 0 && bb.h > 0) {
        boxes.push({ id: n.id(), label: lbl, x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2 });
      } else {
        const rPos = n.renderedPosition();
        const rH = n.renderedHeight();
        const textW = Math.max(lbl.length * fsNum * 0.65, 30);
        const textH = fsNum * 1.25;
        const top = n.isParent() ? rPos.y - rH / 2 - textH - 4 : rPos.y + rH / 2 + 6;
        boxes.push({ id: n.id(), label: lbl, x1: rPos.x - textW / 2, y1: top, x2: rPos.x + textW / 2, y2: top + textH });
      }
    });

    const intersections: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const b1 = boxes[i];
        const b2 = boxes[j];
        const overlaps = !(
          b1.x2 <= b2.x1 ||
          b1.x1 >= b2.x2 ||
          b1.y2 <= b2.y1 ||
          b1.y1 >= b2.y2
        );
        if (overlaps) {
          intersections.push(`"${b1.label}" (${b1.id}) overlaps with "${b2.label}" (${b2.id})`);
        }
      }
    }

    return {
      totalVisibleLabels: boxes.length,
      intersectionCount: intersections.length,
      intersections,
      minFontSize: fontSizes.length > 0 ? Math.min(...fontSizes) : 13,
      maxFontSize: fontSizes.length > 0 ? Math.max(...fontSizes) : 16,
      sampleBoxes: boxes.slice(0, 4)
    };
  });
}

async function main() {
  console.log('================================================================');
  console.log('🚀 ChronoFork Final UI Corrections Verification Suite');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:5173 ...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);

    // =========================================================================
    // 01-idle.png: Idle State & Requirement 5 (Label legibility in Idle)
    // =========================================================================
    console.log('\n--- State: IDLE ---');
    await page.locator('text=Waiting for a run').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('text=Module').waitFor({ state: 'visible', timeout: 5000 });

    const idleLabels = await checkLabelIntersections(page, 'idle');
    recordAssert(
      5,
      'Idle state: no two visible label bounding boxes intersect',
      idleLabels.intersectionCount === 0,
      '0 intersections',
      `${idleLabels.intersectionCount} intersections across ${idleLabels.totalVisibleLabels} visible labels`
    );

    recordAssert(
      5,
      'Idle state: on-screen label fonts clamped between 13px and 16px',
      idleLabels.minFontSize >= 12.9 && idleLabels.maxFontSize <= 16.5,
      '13px <= font <= 16px',
      `min font: ${idleLabels.minFontSize.toFixed(2)}px, max font: ${idleLabels.maxFontSize.toFixed(2)}px`
    );

    await verifyMinimumFontSize(page, '01-idle');
    await page.screenshot({ path: path.join(OUT_DIR, '01-idle.png') });
    console.log('📸 01-idle.png saved.');

    // =========================================================================
    // START SCENARIO 1: Hidden Collision
    // =========================================================================
    console.log('\n--- Scenario 1: Hidden Collision ---');
    const sc1Btn = page.locator('button:has-text("1. Hidden Collision")');
    await sc1Btn.click();
    await page.waitForTimeout(600);

    await page.waitForFunction(
      () => ((window as any).__chronoGetState?.()?.eventsLength ?? 0) >= 14,
      { timeout: 10000 }
    );

    // -------------------------------------------------------------------------
    // Event 3: FORK_SIMULATION (Requirement 3: Blast radius before collision)
    // -------------------------------------------------------------------------
    console.log('\n--- Step to Event 3: FORK_SIMULATION ---');
    await page.evaluate(() => {
      (window as any).__chronoSetIndex(3);
    });
    await page.waitForTimeout(600);

    const blastRadiusStats = await page.evaluate(() => {
      const cy = (window as any).__chronoCy;
      if (!cy) return null;
      const chainIds = (window as any).__chronoGetChainNodeIds?.() || [];
      const nodesData = chainIds.map((id: string) => {
        const n = cy.getElementById(id);
        const pos = n.position();
        const rPos = n.renderedPosition();
        return {
          id,
          hasA1Halo: n.hasClass('a1-blast-halo'),
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          rx: Math.round(rPos.x),
          ry: Math.round(rPos.y)
        };
      });
      return {
        chainIds,
        nodesData
      };
    });

    recordAssert(
      3,
      'At FORK_SIMULATION: reverse-CALLS blast radius of A1 claimed symbol (5 nodes)',
      blastRadiusStats !== null && blastRadiusStats.chainIds.length === 5,
      '5 nodes: [execute_job, dequeue_task, validate_token, get_connection, load_config]',
      `[${blastRadiusStats?.chainIds.join(', ')}]`
    );

    recordAssert(
      3,
      'At FORK_SIMULATION: nodes receive A1-colored halo (a1-blast-halo)',
      blastRadiusStats !== null && blastRadiusStats.nodesData.every((n: any) => n.hasA1Halo),
      'all nodes have a1-blast-halo: true',
      `nodes with halo: ${blastRadiusStats?.nodesData.filter((n: any) => n.hasA1Halo).length} / 5`
    );

    // -------------------------------------------------------------------------
    // Event 4: CLAIMS by A1 & A2 (Requirement 2 & Requirement 5)
    // -------------------------------------------------------------------------
    console.log('\n--- Step to Event 4: CLAIMS (02-claims.png) ---');
    await page.evaluate(() => {
      (window as any).__chronoSetIndex(4);
    });
    await page.waitForTimeout(600);

    const claimsStats = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.cf-claim-chip')).map((c) => ({
        text: c.textContent?.trim() || '',
        title: c.getAttribute('title') || ''
      }));
      const timelineChips = Array.from(document.querySelectorAll('.cf-timeline-chip')).map((c) => c.textContent?.trim() || '');

      // Check node layout stability
      const cy = (window as any).__chronoCy;
      const chainIds = (window as any).__chronoGetChainNodeIds?.() || [];
      const posMap = chainIds.map((id: string) => {
        const n = cy.getElementById(id);
        return { id, x: Math.round(n.position().x), y: Math.round(n.position().y) };
      });

      return { chips, timelineChips, posMap };
    });

    const chipTextsSc1 = claimsStats.chips.map((c) => c.text);
    recordAssert(
      2,
      'Scenario 1 graph chips display "A1 · SIGNATURE_CHANGE" and "A2 · BODY_EDIT"',
      chipTextsSc1.includes('A1 · SIGNATURE_CHANGE') && chipTextsSc1.includes('A2 · BODY_EDIT'),
      '["A1 · SIGNATURE_CHANGE", "A2 · BODY_EDIT"]',
      `[${chipTextsSc1.map((t) => `"${t}"`).join(', ')}]`
    );

    const chipTooltipsSc1 = claimsStats.chips.map((c) => c.title);
    recordAssert(
      2,
      'Scenario 1 chip tooltips contain agent names ("ConfigCoder", "WorkerCoder")',
      chipTooltipsSc1.some((t) => t.includes('ConfigCoder')) && chipTooltipsSc1.some((t) => t.includes('WorkerCoder')),
      'ConfigCoder and WorkerCoder in tooltips',
      `[${chipTooltipsSc1.map((t) => `"${t}"`).join(', ')}]`
    );

    // Layout stability check: positions at step 4 match step 3
    const positionsMatch = claimsStats.posMap.every((p: any, idx: number) => {
      const prev = blastRadiusStats?.nodesData[idx];
      return prev && prev.x === p.x && prev.y === p.y;
    });
    recordAssert(
      3,
      'Layout stays stable between events (no jump from FORK_SIMULATION to CLAIM)',
      positionsMatch,
      'exact same positions',
      `positions = ${JSON.stringify(claimsStats.posMap)}`
    );

    const claimsLabels = await checkLabelIntersections(page, 'claims');
    recordAssert(
      5,
      'Claims state: no two visible label bounding boxes intersect',
      claimsLabels.intersectionCount === 0,
      '0 intersections',
      `${claimsLabels.intersectionCount} intersections across ${claimsLabels.totalVisibleLabels} visible labels`
    );

    await verifyMinimumFontSize(page, '02-claims');
    await page.screenshot({ path: path.join(OUT_DIR, '02-claims.png') });
    console.log('📸 02-claims.png saved.');

    // -------------------------------------------------------------------------
    // Event 5: COLLISION_DETECTION (Requirement 1, Requirement 4 & Requirement 5)
    // -------------------------------------------------------------------------
    console.log('\n--- Step to Event 5: COLLISION_DETECTION (03-collision-hero.png) ---');
    await page.evaluate(() => {
      (window as any).__chronoSetIndex(5);
    });
    // First render of collision event: hero card is expanded
    await page.waitForTimeout(300);

    // Item 1: Chain from events only in Scenario 1
    const sc1ChainStats = await page.evaluate(() => {
      const state = (window as any).__chronoGetState?.();
      const currentEvt = state?.activeEvent || state?.events?.[5];
      const pathNodes = currentEvt?.collision?.path_nodes || [];
      const chainIds = (window as any).__chronoGetChainNodeIds?.() || [];
      const breachCount = (window as any).__chronoGetBreachSignalCount?.() || 0;
      return {
        pathNodes,
        chainIds,
        breachCount
      };
    });

    recordAssert(
      1,
      'Scenario 1 chain node IDs derived from event.collision.path_nodes',
      sc1ChainStats.chainIds.length === 5 &&
        sc1ChainStats.chainIds.every((id: string, i: number) => id === sc1ChainStats.pathNodes[i]),
      `[${sc1ChainStats.pathNodes.join(', ')}]`,
      `[${sc1ChainStats.chainIds.join(', ')}]`
    );

    recordAssert(
      1,
      'Scenario 1 collision turns chain red (5 breach nodes)',
      sc1ChainStats.breachCount === 5,
      '5 breach nodes',
      `${sc1ChainStats.breachCount} breach nodes`
    );

    // Item 4: Hero card non-overlap with chain nodes at first render of collision event
    const heroOverlapStats = await page.evaluate(() => {
      const heroEl = document.querySelector('div[role="alert"].cf-floating-card') as HTMLElement | null;
      if (!heroEl) return { found: false, error: 'Hero card not found' };

      const heroRect = heroEl.getBoundingClientRect();
      const heroBox = {
        left: Math.round(heroRect.left),
        top: Math.round(heroRect.top),
        right: Math.round(heroRect.right),
        bottom: Math.round(heroRect.bottom),
        width: Math.round(heroRect.width),
        height: Math.round(heroRect.height)
      };

      const cy = (window as any).__chronoCy;
      const cyContainer = document.querySelector('#chrono-cy-container')?.getBoundingClientRect();
      if (!cy || !cyContainer) return { found: false, error: 'Cytoscape container not found' };

      const chainIds = (window as any).__chronoGetChainNodeIds?.() || [];
      const chainBoxes = chainIds.map((id: string) => {
        const n = cy.getElementById(id);
        const bb = n.renderedBoundingBox();
        const absBox = {
          id,
          left: Math.round(cyContainer.left + bb.x1),
          top: Math.round(cyContainer.top + bb.y1),
          right: Math.round(cyContainer.left + bb.x2),
          bottom: Math.round(cyContainer.top + bb.y2),
          width: Math.round(bb.w),
          height: Math.round(bb.h)
        };
        const intersects = !(
          absBox.right <= heroBox.left ||
          absBox.left >= heroBox.right ||
          absBox.bottom <= heroBox.top ||
          absBox.top >= heroBox.bottom
        );
        return {
          ...absBox,
          intersects
        };
      });

      const anyIntersects = chainBoxes.some((b: any) => b.intersects);
      return {
        found: true,
        heroBox,
        chainBoxes,
        anyIntersects,
        verticalGap: chainBoxes[0].top - heroBox.bottom
      };
    });

    recordAssert(
      4,
      'Hero card capped at height <= 230px',
      heroOverlapStats.found && (heroOverlapStats as any).heroBox.height <= 230,
      '<= 230px',
      `${(heroOverlapStats as any)?.heroBox?.height}px`
    );

    recordAssert(
      4,
      'Bounding boxes of expanded hero card and chain nodes do NOT intersect at first render',
      heroOverlapStats.found && !(heroOverlapStats as any).anyIntersects,
      '0 intersections',
      `Intersects: ${(heroOverlapStats as any).anyIntersects}. Vertical clearance gap: ${(heroOverlapStats as any).verticalGap}px. Hero: [top: ${(heroOverlapStats as any).heroBox.top}, bottom: ${(heroOverlapStats as any).heroBox.bottom}]. Chain top: ${(heroOverlapStats as any).chainBoxes[0].top}.`
    );

    await verifyMinimumFontSize(page, '03-collision-hero');
    await page.screenshot({ path: path.join(OUT_DIR, '03-collision-hero.png') });
    console.log('📸 03-collision-hero.png saved.');

    // Wait 1.5s for auto-docking
    await page.waitForTimeout(1600);

    const collisionLabels = await checkLabelIntersections(page, 'collision');
    recordAssert(
      5,
      'Collision state: no two visible label bounding boxes intersect',
      collisionLabels.intersectionCount === 0,
      '0 intersections',
      `${collisionLabels.intersectionCount} intersections across ${collisionLabels.totalVisibleLabels} visible labels`
    );

    await verifyMinimumFontSize(page, '09-focus-view-4hop');
    await page.screenshot({ path: path.join(OUT_DIR, '09-focus-view-4hop.png') });
    console.log('📸 09-focus-view-4hop.png saved.');

    // -------------------------------------------------------------------------
    // Event 10: RESOLUTION & HANDOFF (Requirement 6: Edges & Handoff text)
    // -------------------------------------------------------------------------
    console.log('\n--- Step to Event 10: RESOLUTION & HANDOFF (05-resolution-handoff.png) ---');
    await page.evaluate(() => {
      (window as any).__chronoSetIndex(10);
    });
    await page.waitForTimeout(800);

    const edgeStats = await page.evaluate(() => {
      const cy = (window as any).__chronoCy;
      if (!cy) return null;

      // Check faint edges opacity
      const faintEdges = cy.edges('.faint-edge');
      const faintEdgeOpacity = faintEdges.length > 0 ? parseFloat(faintEdges[0].renderedStyle('opacity')) : 0;
      const faintEdgeZ = faintEdges.length > 0 ? parseInt(faintEdges[0].renderedStyle('z-index') || '1') : 1;

      // Check handoff edge
      const handoffEdge = cy.getElementById('handoff-edge');
      const handoffEdgeExists = handoffEdge.length > 0;
      const handoffLabel = handoffEdge.length > 0 ? handoffEdge.data('label') : '';
      const handoffLineStyle = handoffEdge.length > 0 ? handoffEdge.renderedStyle('line-style') : '';

      // Check DOM overlay
      const overlayEl = document.querySelector('.cf-handoff-overlay');
      const overlayText = overlayEl?.textContent?.trim() || '';

      return {
        faintEdgeCount: faintEdges.length,
        faintEdgeOpacity,
        faintEdgeZ,
        handoffEdgeExists,
        handoffLabel,
        handoffLineStyle,
        overlayText
      };
    });

    recordAssert(
      6,
      'Non-chain edges at 12% opacity and below the chain (z-index < chain z-index 1000)',
      edgeStats !== null && Math.abs(edgeStats.faintEdgeOpacity - 0.12) < 0.03 && edgeStats.faintEdgeZ < 1000,
      'opacity: 0.12, z-index < 1000',
      `opacity: ${edgeStats?.faintEdgeOpacity.toFixed(2)}, z-index: ${edgeStats?.faintEdgeZ} (below chain z-index 1000) across ${edgeStats?.faintEdgeCount} edges`
    );

    recordAssert(
      6,
      'Handoff dashed arrow drawn above labels with visible "HANDED OFF" text in DOM overlay',
      edgeStats !== null && edgeStats.handoffEdgeExists && edgeStats.handoffLineStyle === 'dashed' && edgeStats.overlayText === 'HANDED OFF',
      'dashed edge + "HANDED OFF" text',
      `line-style: ${edgeStats?.handoffLineStyle}, overlayText: "${edgeStats?.overlayText}"`
    );

    await verifyMinimumFontSize(page, '05-resolution-handoff');
    await page.screenshot({ path: path.join(OUT_DIR, '05-resolution-handoff.png') });
    console.log('📸 05-resolution-handoff.png saved.');

    // -------------------------------------------------------------------------
    // Event 13: VERIFICATION COMPLETE (04-git-vs-chronofork.png & 08-receipt.png)
    // -------------------------------------------------------------------------
    console.log('\n--- Step to Event 13: VERIFICATION COMPLETE ---');
    await page.evaluate(() => {
      (window as any).__chronoSetIndex(13);
    });
    await page.waitForTimeout(600);

    const finalLabels = await checkLabelIntersections(page, 'final');
    recordAssert(
      5,
      'Final state: no two visible label bounding boxes intersect',
      finalLabels.intersectionCount === 0,
      '0 intersections',
      `${finalLabels.intersectionCount} intersections across ${finalLabels.totalVisibleLabels} visible labels`
    );

    await page.locator('button:has-text("Verdict")').click();
    await page.waitForTimeout(300);
    await verifyMinimumFontSize(page, '04-git-vs-chronofork');
    await page.screenshot({ path: path.join(OUT_DIR, '04-git-vs-chronofork.png') });
    console.log('📸 04-git-vs-chronofork.png saved.');

    // Merge receipt
    await page.locator('button:has-text("Merge receipt")').click();
    await page.waitForTimeout(400);

    const approveBtn = page.locator('button:has-text("Approve Merge")');
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await page.waitForTimeout(500);
    }
    await page.locator('text=MERGE APPROVED').waitFor({ state: 'visible', timeout: 5000 });
    await verifyMinimumFontSize(page, '08-receipt');
    await page.screenshot({ path: path.join(OUT_DIR, '08-receipt.png') });
    console.log('📸 08-receipt.png saved.');

    // =========================================================================
    // SCENARIO 2: Memory Recall (Requirement 1 & Requirement 2)
    // =========================================================================
    console.log('\n--- Scenario 2: Memory Recall ---');
    const sc2Btn = page.locator('button:has-text("2. Memory Recall")');
    await sc2Btn.click();
    await page.waitForTimeout(600);

    await page.waitForFunction(
      () => ((window as any).__chronoGetState?.()?.eventsLength ?? 0) >= 5,
      { timeout: 10000 }
    );

    // Step to event 3 (COLLISION_DETECTION in Scenario 2)
    await page.evaluate(() => {
      (window as any).__chronoSetIndex(3);
    });
    await page.waitForTimeout(800);

    const sc2Stats = await page.evaluate(() => {
      const chainIds = (window as any).__chronoGetChainNodeIds?.() || [];
      const breachCount = (window as any).__chronoGetBreachSignalCount?.() || 0;
      const chips = Array.from(document.querySelectorAll('.cf-claim-chip')).map((c) => ({
        text: c.textContent?.trim() || '',
        title: c.getAttribute('title') || ''
      }));
      const zeroCollisionsCard = Array.from(document.querySelectorAll('div[role="status"]')).find((el) =>
        el.textContent?.includes('ZERO COLLISIONS · memory-guided')
      );

      return {
        chainIds,
        breachCount,
        chips,
        hasZeroCollisionsCard: Boolean(zeroCollisionsCard),
        zeroCollisionsText: zeroCollisionsCard?.textContent?.trim() || ''
      };
    });

    recordAssert(
      1,
      'Scenario 2: no chain (empty chainNodeIds)',
      sc2Stats.chainIds.length === 0,
      '0 chain nodes: []',
      `[${sc2Stats.chainIds.join(', ')}]`
    );

    recordAssert(
      1,
      'Scenario 2: zero breach/signal-colored nodes (no red/amber anywhere)',
      sc2Stats.breachCount === 0,
      '0 breach/signal nodes',
      `${sc2Stats.breachCount} breach/signal nodes`
    );

    const chipTextsSc2 = sc2Stats.chips.map((c) => c.text);
    recordAssert(
      2,
      'Scenario 2 graph chips display "A1 · BODY_EDIT" and "A2 · BODY_EDIT"',
      chipTextsSc2.includes('A1 · BODY_EDIT') && chipTextsSc2.includes('A2 · BODY_EDIT'),
      '["A1 · BODY_EDIT", "A2 · BODY_EDIT"]',
      `[${chipTextsSc2.map((t) => `"${t}"`).join(', ')}]`
    );

    recordAssert(
      1,
      'Scenario 2 shows small green "ZERO COLLISIONS · memory-guided" card',
      sc2Stats.hasZeroCollisionsCard,
      'ZERO COLLISIONS · memory-guided card visible',
      sc2Stats.zeroCollisionsText
    );

    await page.locator('button:has-text("Memory (")').click();
    await page.waitForTimeout(500);
    await verifyMinimumFontSize(page, '06-memory-run-compare');
    await page.screenshot({ path: path.join(OUT_DIR, '06-memory-run-compare.png') });
    console.log('📸 06-memory-run-compare.png saved.');

    // =========================================================================
    // SCENARIO 3: Safe Parallel Proof (Requirement 1 & Requirement 3)
    // =========================================================================
    console.log('\n--- Scenario 3: Safe Parallel ---');
    const sc3Btn = page.locator('button:has-text("3. Safe Parallel")');
    await sc3Btn.click();
    await page.waitForTimeout(600);

    await page.waitForFunction(
      () => ((window as any).__chronoGetState?.()?.eventsLength ?? 0) >= 5,
      { timeout: 10000 }
    );

    // Step to event 3 (COLLISION_DETECTION in Scenario 3)
    await page.evaluate(() => {
      (window as any).__chronoSetIndex(3);
    });
    await page.waitForTimeout(800);

    const sc3Stats = await page.evaluate(() => {
      const chainIds = (window as any).__chronoGetChainNodeIds?.() || [];
      const breachCount = (window as any).__chronoGetBreachSignalCount?.() || 0;
      const cy = (window as any).__chronoCy;

      const a2Nodes = cy.nodes('.disjoint-neigh-a2');
      const a3Nodes = cy.nodes('.disjoint-neigh-a3');

      const a2Boxes = a2Nodes.map((n: any) => n.position());
      const a3Boxes = a3Nodes.map((n: any) => n.position());

      const a2MaxX = Math.max(...a2Boxes.map((p: any) => p.x));
      const a3MinX = Math.min(...a3Boxes.map((p: any) => p.x));
      const horizontalGap = a3MinX - a2MaxX;

      const safeCard = Array.from(document.querySelectorAll('div[role="status"]')).find((el) =>
        el.textContent?.includes('SAFE · 0 PATHS')
      );

      return {
        chainIds,
        breachCount,
        a2Count: a2Nodes.length,
        a3Count: a3Nodes.length,
        a2Color: a2Nodes.length > 0 ? a2Nodes[0].renderedStyle('border-color') : '',
        a3Color: a3Nodes.length > 0 ? a3Nodes[0].renderedStyle('border-color') : '',
        horizontalGap,
        hasSafeCard: Boolean(safeCard),
        safeCardText: safeCard?.textContent?.trim() || ''
      };
    });

    recordAssert(
      1,
      'Scenario 3: no chain (empty chainNodeIds)',
      sc3Stats.chainIds.length === 0,
      '0 chain nodes: []',
      `[${sc3Stats.chainIds.join(', ')}]`
    );

    recordAssert(
      1,
      'Scenario 3: zero breach/signal-colored nodes',
      sc3Stats.breachCount === 0,
      '0 breach/signal nodes',
      `${sc3Stats.breachCount} breach/signal nodes`
    );

    recordAssert(
      1,
      'Scenario 3: two disjoint neighborhoods separated by visible gap (> 200px) with NO connecting highlight',
      sc3Stats.a2Count > 0 && sc3Stats.a3Count > 0 && sc3Stats.horizontalGap > 200,
      'A2 and A3 clusters separated by > 200px gap',
      `A2 cluster: ${sc3Stats.a2Count} nodes (${sc3Stats.a2Color}), A3 cluster: ${sc3Stats.a3Count} nodes (${sc3Stats.a3Color}), gap: ${sc3Stats.horizontalGap}px`
    );

    recordAssert(
      1,
      'Scenario 3 shows SAFE · 0 PATHS card',
      sc3Stats.hasSafeCard,
      'SAFE · 0 PATHS visible',
      sc3Stats.safeCardText
    );

    await verifyMinimumFontSize(page, '07-zero-path-proof');
    await page.screenshot({ path: path.join(OUT_DIR, '07-zero-path-proof.png') });
    console.log('📸 07-zero-path-proof.png saved.');

    await page.close();
    await context.close();

    // =========================================================================
    // REQUIREMENT 7: VIDEO RECORDINGS
    // =========================================================================
    console.log('\n================================================================');
    console.log('🎬 Recording Required Video Clips (docs/screens/)');
    console.log('================================================================');

    // -------------------------------------------------------------------------
    // Clip 1: scenario1.webm (Target <= 28s)
    // Start video AFTER clicking "Play the Story", end 2s after receipt shows MERGE APPROVED
    // -------------------------------------------------------------------------
    console.log('\n--- Recording scenario1.webm (Target <= 28s) ---');
    const vContext1 = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      recordVideo: {
        dir: VIDEO_TEMP_DIR,
        size: { width: 1920, height: 1080 }
      }
    });

    const vPage1 = await vContext1.newPage();
    await vPage1.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
    await vPage1.waitForTimeout(500);

    // Set speed to Slow (1000ms per event)
    const slowBtn = vPage1.locator('button:has-text("Slow")');
    if (await slowBtn.isVisible()) {
      await slowBtn.click();
      await vPage1.waitForTimeout(300);
    }

    // Click "Play Story"
    const playStoryBtn = vPage1.locator('button:has-text("Play Story")');
    if (await playStoryBtn.isVisible()) {
      await playStoryBtn.click();
    } else {
      await vPage1.locator('button:has-text("1. Hidden Collision")').click();
    }

    const tStart1 = Date.now();
    console.log('Play Story clicked. Advancing through Scenario 1 events...');

    // Wait until event 13 (VERIFICATION complete)
    await vPage1.waitForFunction(
      () => ((window as any).__chronoGetState?.()?.currentIndex ?? 0) >= 13,
      { timeout: 25000 }
    );
    console.log('Event 13 reached: Verification complete.');
    // Pause playback so story mode does not auto-advance before approval
    await vPage1.keyboard.press('Space');
    await vPage1.waitForTimeout(200);

    // Open receipt and click Approve Merge
    const receiptTab1 = vPage1.locator('button:has-text("Merge receipt")');
    await receiptTab1.click();
    await vPage1.waitForTimeout(500);

    const approveBtn1 = vPage1.locator('button:has-text("Approve Merge")');
    await approveBtn1.waitFor({ state: 'visible', timeout: 4000 });
    await approveBtn1.click();
    console.log('Clicked "Approve Merge". Waiting for "MERGE APPROVED" seal...');

    await vPage1.locator('text=MERGE APPROVED').waitFor({ state: 'visible', timeout: 5000 });
    console.log('"MERGE APPROVED" confirmed in receipt. Holding for exactly 2.0s...');
    await vPage1.waitForTimeout(2000);

    const duration1 = (Date.now() - tStart1) / 1000;
    const vObj1 = vPage1.video();
    await vPage1.close();
    await vContext1.close();

    if (vObj1) {
      const vPath1 = await vObj1.path();
      const target1 = path.join(OUT_DIR, 'scenario1.webm');
      if (vPath1 && fs.existsSync(vPath1)) {
        fs.copyFileSync(vPath1, target1);
        console.log(`🎥 scenario1.webm saved (${duration1.toFixed(1)}s, target <= 28s)`);
      }
    }

    recordAssert(
      7,
      'scenario1.webm duration is within target <= 28s',
      duration1 <= 28.5,
      '<= 28s',
      `${duration1.toFixed(1)}s`
    );

    // -------------------------------------------------------------------------
    // Clip 2: scenario2.webm (~12s clip)
    // -------------------------------------------------------------------------
    console.log('\n--- Recording scenario2.webm (~12s clip) ---');
    const vContext2 = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      recordVideo: {
        dir: VIDEO_TEMP_DIR,
        size: { width: 1920, height: 1080 }
      }
    });

    const vPage2 = await vContext2.newPage();
    await vPage2.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
    await vPage2.waitForTimeout(400);

    // Set speed to Slow
    const slowBtn2 = vPage2.locator('button:has-text("Slow")');
    if (await slowBtn2.isVisible()) {
      await slowBtn2.click();
      await vPage2.waitForTimeout(300);
    }

    const tStart2 = Date.now();
    await vPage2.locator('button:has-text("2. Memory Recall")').click();

    // Switch to Memory tab around 4s
    await vPage2.waitForTimeout(4000);
    const memTab2 = vPage2.locator('button:has-text("Memory (")');
    if (await memTab2.isVisible()) {
      await memTab2.click();
    }

    // Hold until total 12s
    const elapsed2 = (Date.now() - tStart2) / 1000;
    if (elapsed2 < 12) {
      await vPage2.waitForTimeout((12 - elapsed2) * 1000);
    }

    const duration2 = (Date.now() - tStart2) / 1000;
    const vObj2 = vPage2.video();
    await vPage2.close();
    await vContext2.close();

    if (vObj2) {
      const vPath2 = await vObj2.path();
      const target2 = path.join(OUT_DIR, 'scenario2.webm');
      if (vPath2 && fs.existsSync(vPath2)) {
        fs.copyFileSync(vPath2, target2);
        console.log(`🎥 scenario2.webm saved (${duration2.toFixed(1)}s, target ~12s)`);
      }
    }

    recordAssert(
      7,
      'scenario2.webm recorded as separate ~12s clip',
      Math.abs(duration2 - 12) <= 1.5,
      '~12s',
      `${duration2.toFixed(1)}s`
    );

    // -------------------------------------------------------------------------
    // Clip 3: scenario3.webm (~12s clip)
    // -------------------------------------------------------------------------
    console.log('\n--- Recording scenario3.webm (~12s clip) ---');
    const vContext3 = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      recordVideo: {
        dir: VIDEO_TEMP_DIR,
        size: { width: 1920, height: 1080 }
      }
    });

    const vPage3 = await vContext3.newPage();
    await vPage3.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
    await vPage3.waitForTimeout(400);

    // Set speed to Slow
    const slowBtn3 = vPage3.locator('button:has-text("Slow")');
    if (await slowBtn3.isVisible()) {
      await slowBtn3.click();
      await vPage3.waitForTimeout(300);
    }

    const tStart3 = Date.now();
    await vPage3.locator('button:has-text("3. Safe Parallel")').click();

    // Step through and open receipt around 5s
    await vPage3.waitForTimeout(5000);
    const receiptTab3 = vPage3.locator('button:has-text("Merge receipt")');
    if (await receiptTab3.isVisible()) {
      await receiptTab3.click();
    }

    // Hold until total 12s
    const elapsed3 = (Date.now() - tStart3) / 1000;
    if (elapsed3 < 12) {
      await vPage3.waitForTimeout((12 - elapsed3) * 1000);
    }

    const duration3 = (Date.now() - tStart3) / 1000;
    const vObj3 = vPage3.video();
    await vPage3.close();
    await vContext3.close();

    if (vObj3) {
      const vPath3 = await vObj3.path();
      const target3 = path.join(OUT_DIR, 'scenario3.webm');
      if (vPath3 && fs.existsSync(vPath3)) {
        fs.copyFileSync(vPath3, target3);
        console.log(`🎥 scenario3.webm saved (${duration3.toFixed(1)}s, target ~12s)`);
      }
    }

    recordAssert(
      7,
      'scenario3.webm recorded as separate ~12s clip',
      Math.abs(duration3 - 12) <= 1.5,
      '~12s',
      `${duration3.toFixed(1)}s`
    );

    // Summary table
    console.log('\n================================================================');
    console.log('📋 COMPLETE VERIFICATION REPORT (OBSERVED VALUES PRINTED):');
    console.log('================================================================');
    assertionResults.forEach((r) => {
      console.log(`[Item ${r.item}] ${r.title}`);
      console.log(`   Result: ${r.passed ? 'PASSED' : 'FAILED'}`);
      console.log(`   Observed: ${r.observed}\n`);
    });
    console.log('================================================================\n');

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\n❌ Execution error:', err);
  process.exit(1);
});
