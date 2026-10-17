const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));
const { execSync } = require('child_process');
const fs = require('fs');

async function run() {
  console.log('1. Stopping FalkorDB container...');
  execSync('docker stop chronofork-falkordb');

  try {
    console.log('2. Testing 503 backend endpoints...');
    let outputs = '=== 503 ENDPOINT TESTS (FalkorDB Offline) ===\n\n';

    const testEndpoint = (name, cmd) => {
      try {
        const res = execSync(cmd).toString();
        outputs += `--- ${name} ---\n${res}\n\n`;
      } catch (err) {
        outputs += `--- ${name} ---\n${err.stdout ? err.stdout.toString() : err.message}\n\n`;
      }
    };

    testEndpoint('POST /runs (live mode)', 'curl -s -i -X POST http://127.0.0.1:8000/runs -H "Content-Type: application/json" -d \'{"scenario": 1, "mode": "live"}\'');
    testEndpoint('GET /graph/taskflow', 'curl -s -i http://127.0.0.1:8000/graph/taskflow');
    testEndpoint('GET /collisions/test_run', 'curl -s -i http://127.0.0.1:8000/collisions/test_run');

    fs.writeFileSync('docs/evidence/phase2b/fail_loudly_503.txt', outputs);
    console.log('Saved 503 outputs to docs/evidence/phase2b/fail_loudly_503.txt');
    console.log(outputs);

    console.log('3. Running Playwright test in browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    // Click Live mode toggle button
    console.log('Clicking Live mode button...');
    await page.click('button:has-text("Live")');
    await page.waitForTimeout(500);

    // Click Scenario 1 button or Play button
    console.log('Clicking Scenario 1 button to trigger live run...');
    await page.click('button:has-text("1. Hidden Collision")');

    // Wait for error banner
    console.log('Waiting for error banner...');
    const bannerSelector = 'div.fixed.bottom-4 span';
    await page.waitForSelector(bannerSelector, { timeout: 10000 });

    const bannerText = await page.textContent(bannerSelector);
    console.log('DOM BANNER TEXT:', bannerText);

    // Save screenshot
    const screenshotPath = 'docs/screens/live-fail-loudly.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot to ${screenshotPath}`);

    await browser.close();
  } finally {
    console.log('4. Restarting FalkorDB container...');
    execSync('docker start chronofork-falkordb');
    console.log('FalkorDB container restarted.');
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  try {
    execSync('docker start chronofork-falkordb');
  } catch {}
  process.exit(1);
});
