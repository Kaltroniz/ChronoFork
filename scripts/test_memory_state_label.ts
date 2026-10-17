import { chromium } from '../frontend/node_modules/playwright';

async function testMemoryStateLabel() {
  console.log('================================================================');
  console.log('🧪 Real Playwright Test: Reset -> Read Label -> Run S1 -> Read Label');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);

    // 1. Click Reset button (or call onReset)
    console.log('1. Clicking Reset button...');
    const resetBtn = page.locator('[data-testid="reset-button"]');
    await resetBtn.waitFor({ state: 'visible', timeout: 5000 });
    await resetBtn.click();
    await page.waitForTimeout(600);

    // 2. Read "Memory state" label text after Reset
    const labelAfterReset = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="memory-state-indicator"]');
      if (!el) return 'ABSENT (hidden because memoryWasReset is true)';
      return el.textContent?.trim() || 'EMPTY';
    });
    console.log(`>>> [OBSERVED STRING 1 - After Reset]: "${labelAfterReset}"\n`);

    // 3. Run Scenario 1 in replay
    console.log('2. Clicking Scenario 1: Hidden Collision (replay)...');
    await page.click('[data-testid="scenario-button-1"]');

    // 4. Wait for S1 replay to finish and write memory episode
    console.log('3. Waiting for Scenario 1 replay stream to complete (event 13 MEMORY_UPDATE)...');
    await page.waitForFunction(
      () => {
        const state = (window as any).__chronoGetState?.();
        const evts = state?.events || [];
        return evts.length >= 14 && evts.some((e: any) => e.phase === 'MEMORY_UPDATE');
      },
      { timeout: 20000 }
    );
    await page.waitForTimeout(1000);

    // 5. Read "Memory state" label text after S1 completes
    const labelAfterS1 = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="memory-state-indicator"]');
      if (!el) return 'ABSENT';
      return el.textContent?.trim() || 'EMPTY';
    });
    console.log(`>>> [OBSERVED STRING 2 - After S1 Replay]: "${labelAfterS1}"\n`);

    console.log('================================================================');
    console.log('TEST SUMMARY:');
    console.log(`  Observed String 1 (After Reset):    "${labelAfterReset}"`);
    console.log(`  Observed String 2 (After S1 Replay): "${labelAfterS1}"`);
    console.log('================================================================');

    if (!labelAfterReset.includes('ABSENT') || !labelAfterS1.includes('Memory state: carried over')) {
      throw new Error(`Unexpected strings: [1] = "${labelAfterReset}", [2] = "${labelAfterS1}"`);
    }
  } finally {
    await browser.close();
  }
}

testMemoryStateLabel().catch((err) => {
  console.error('Playwright Test Failed:', err);
  process.exit(1);
});
