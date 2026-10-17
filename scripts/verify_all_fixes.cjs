const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const { execSync } = require('child_process');

function post(path, body = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 8000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let respData = '';
        res.on('data', (chunk) => (respData += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(respData));
          } catch {
            resolve(respData);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: 8000, path }, (res) => {
      let respData = '';
      res.on('data', (chunk) => (respData += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(respData));
        } catch {
          resolve(respData);
        }
      });
    }).on('error', reject);
  });
}

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

(async () => {
  console.log('================================================================');
  console.log('ITEM 1: MEMORY LABEL ON CLEAN LOAD VS 1 RULE');
  console.log('================================================================');
  // Clean load test
  await post('/memory/taskflow/reset');
  const emptyMem = await get('/memory/taskflow');
  const emptyRules = emptyMem.rules ? emptyMem.rules.length : 0;
  const emptyEpisodes = emptyMem.episodes ? emptyMem.episodes.length : 0;
  console.log(`Backend /memory/taskflow at clean load: rules=${emptyRules}, episodes=${emptyEpisodes}`);

  const browser = await chromium.launch({ headless: true });
  const context1 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page1 = await context1.newPage();
  await page1.goto('http://127.0.0.1:5173');
  await page1.waitForTimeout(1000);

  const indClean = await page1.$('[data-testid="memory-state-indicator"]');
  const indCleanText = indClean ? await indClean.innerText() : null;
  console.log(`DOM text of [data-testid="memory-state-indicator"] at clean load: ${JSON.stringify(indCleanText)}`);
  if (indCleanText === null) {
    console.log('ASSERTION PASSED: [data-testid="memory-state-indicator"] is absent (null) when memory counts are 0.');
  } else {
    console.error('ASSERTION FAILED: Indicator is visible when counts are 0!');
    process.exit(1);
  }
  await context1.close();

  // Test with 1 rule seeded
  execSync(`.venv/bin/python -c "from backend.app.memory import record_episode; record_episode('taskflow', 'run_seed', 'test task', 'SUCCESS', 'summary', ['taskflow.config.load_config', 'taskflow.worker.execute_job'], {'rule': 'test rule', 'advice': 'test advice'})"`, { stdio: 'inherit' });
  const seededMem = await get('/memory/taskflow');
  const seededRules = seededMem.rules ? seededMem.rules.length : 0;
  const seededEpisodes = seededMem.episodes ? seededMem.episodes.length : 0;
  console.log(`Backend /memory/taskflow with seeded rule: rules=${seededRules}, episodes=${seededEpisodes}`);

  const context2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page2 = await context2.newPage();
  await page2.goto('http://127.0.0.1:5173');
  await page2.waitForTimeout(1000);

  const indSeeded = await page2.$('[data-testid="memory-state-indicator"]');
  const indSeededText = indSeeded ? await indSeeded.innerText() : null;
  console.log(`DOM text of [data-testid="memory-state-indicator"] with 1 rule: ${JSON.stringify(indSeededText)}`);
  if (indSeededText && indSeededText.includes('Memory state: carried over')) {
    console.log('ASSERTION PASSED: [data-testid="memory-state-indicator"] is present when rule count > 0.');
  } else {
    console.error('ASSERTION FAILED: Indicator is absent when rule count > 0!');
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('ITEM 2: GRAPH LABELS & CHIPS AT SCENARIO 1, EVENT 7');
  console.log('================================================================');
  await page2.click('button:has-text("1. Hidden Collision")');
  await page2.waitForTimeout(600);
  await page2.evaluate(() => {
    (window).__chronoSetIndex(7);
  });
  await page2.waitForTimeout(1000);

  const layoutData = await page2.evaluate(() => {
    const cy = window.__chronoCy;
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

  console.log('--- 5 Chain Node Label Bounding Boxes ---');
  layoutData.labels.forEach((l, idx) => {
    console.log(`  [${idx}] ${l.name}: center=(${l.pos.x}, ${l.pos.y}), bbox=[x1: ${l.bb.x1}, x2: ${l.bb.x2}, y1: ${l.bb.y1}, y2: ${l.bb.y2}]`);
  });

  console.log('\n--- Claim Chip Bounding Boxes ---');
  layoutData.chips.forEach((c, idx) => {
    console.log(`  [Chip ${idx}] "${c.text}": bbox=[x1: ${c.bb.x1}, x2: ${c.bb.x2}, y1: ${c.bb.y1}, y2: ${c.bb.y2}]`);
  });

  console.log('\n--- Asserting Pairwise Label Non-Intersection (10 pairs) ---');
  for (let i = 0; i < layoutData.labels.length; i++) {
    for (let j = i + 1; j < layoutData.labels.length; j++) {
      const l1 = layoutData.labels[i];
      const l2 = layoutData.labels[j];
      const res = rectIntersection(l1.bb, l2.bb);
      const gap = Math.round((l2.bb.x1 - l1.bb.x2) * 10) / 10;
      if (res.intersects) {
        console.error(`  ❌ OVERLAP between ${l1.name} and ${l2.name}!`);
        process.exit(1);
      } else {
        console.log(`  ASSERTION PASSED: [${l1.name}] and [${l2.name}] do NOT intersect (horizontal gap: ${gap}px)`);
      }
    }
  }

  console.log('\n--- Asserting Chain Labels Non-Intersection with A2 Chip (5 checks) ---');
  const a2Chip = layoutData.chips.find((c) => c.text.includes('A2'));
  layoutData.labels.forEach((l) => {
    const res = rectIntersection(l.bb, a2Chip.bb);
    if (res.intersects) {
      console.error(`  ❌ OVERLAP between label ${l.name} and A2 chip!`);
      process.exit(1);
    } else {
      const vGap = Math.round((l.bb.y1 - a2Chip.bb.y2) * 10) / 10;
      console.log(`  ASSERTION PASSED: Label [${l.name}] and [A2 chip] do NOT intersect (vertical gap: ${vGap}px)`);
    }
  });

  console.log('\n--- Retaking Screenshots 03 and 04 ---');
  const screensDir = path.resolve(__dirname, '../docs/screens');
  await page2.evaluate(() => {
    (window).__chronoSetIndex(5);
  });
  await page2.waitForTimeout(600);
  await page2.screenshot({ path: path.join(screensDir, '03-collision-hero.png') });
  console.log(`  Retaken: docs/screens/03-collision-hero.png`);

  await page2.evaluate(() => {
    (window).__chronoSetIndex(13);
  });
  await page2.waitForTimeout(600);
  const verdictBtn = page2.locator('button:has-text("Verdict")');
  if (await verdictBtn.isVisible()) {
    await verdictBtn.click();
    await page2.waitForTimeout(300);
  }
  await page2.screenshot({ path: path.join(screensDir, '04-git-vs-chronofork.png') });
  console.log(`  Retaken: docs/screens/04-git-vs-chronofork.png`);

  console.log('\n================================================================');
  console.log('ITEM 3: TIMESTAMPS IN PROVENANCE BADGE (DATE + TIME + TIMEZONE)');
  console.log('================================================================');
  await page2.evaluate(() => {
    (window).__chronoSetIndex(7);
  });
  await page2.waitForTimeout(400);

  const provEl = await page2.$('[aria-label="System Provenance"]');
  const provText = provEl ? await provEl.innerText() : '';
  console.log(`DOM text of [aria-label="System Provenance"] at Event 7:`);
  console.log(provText);

  // Check pattern: YYYY-MM-DD HH:MM:SS TZ
  const datePattern = /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[A-Za-z0-9_+\-:]+/;
  if (datePattern.test(provText)) {
    console.log('ASSERTION PASSED: Provenance badge includes date, time, and timezone.');
  } else {
    console.error('ASSERTION FAILED: Provenance badge text does not match expected timestamp format with timezone!');
    process.exit(1);
  }

  await browser.close();
  console.log('\nALL VERIFICATION STEPS COMPLETE & PASSED!');
})();
