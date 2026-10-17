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
      return el ? el.textContent : null;
    });
    console.log(`>>> [OBSERVED VALUE 1 - After Reset]:`, labelAfterReset);

    // 3. Run Scenario 1 in replay
    console.log('\n2. Clicking Scenario 1: Hidden Collision (replay)...');
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
      return el ? el.textContent : null;
    });
    console.log(`>>> [OBSERVED VALUE 2 - After S1 Replay]:`, labelAfterS1);

    console.log('\n================================================================');
    console.log('TEST SUMMARY:');
    console.log(`  Observed Value 1 (After Reset):    ${labelAfterReset === null ? 'null' : `"${labelAfterReset}"`}`);
    console.log(`  Observed Value 2 (After S1 Replay): ${labelAfterS1 === null ? 'null' : `"${labelAfterS1}"`}`);
    console.log('================================================================');

    if (labelAfterReset !== null || !labelAfterS1 || !labelAfterS1.includes('carried over')) {
      throw new Error(`Unexpected values: [1] = ${labelAfterReset}, [2] = "${labelAfterS1}"`);
    }
  } finally {
    await browser.close();
  }
}

testMemoryStateLabel().catch((err) => {
  console.error('Playwright Test Failed:', err);
  process.exit(1);
});
