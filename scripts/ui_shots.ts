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

async function verifyMinimumFontSize(page: any, shotName: string) {
  const violations = await page.evaluate(() => {
    const badElements: Array<{ tag: string; text: string; fontSize: string }> = [];
    const all = document.querySelectorAll('*');

    for (const el of Array.from(all)) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        continue;
      }

      // Check if node has direct text content
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

async function main() {
  console.log('Launching Playwright Chromium at 1920x1080 with video recording...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: VIDEO_TEMP_DIR,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:5173 ...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);

    // 01-idle.png
    console.log('Capturing 01-idle.png ...');
    await verifyMinimumFontSize(page, '01-idle');
    await page.screenshot({ path: path.join(OUT_DIR, '01-idle.png') });

    // Click Scenario 1 button on LeftRail to start replay
    console.log('Starting Scenario 1 ...');
    const sc1Btn = page.locator('button:has-text("1. Hidden Collision")');
    await sc1Btn.click();
    await page.waitForTimeout(600);

    // 02-claims.png
    console.log('Capturing 02-claims.png ...');
    await page.waitForTimeout(1000);
    await verifyMinimumFontSize(page, '02-claims');
    await page.screenshot({ path: path.join(OUT_DIR, '02-claims.png') });

    // Wait for collision hero to appear
    console.log('Waiting for collision detection and HeroSplit ...');
    await page.waitForSelector('div[role="alert"]', { timeout: 12000 });
    await page.waitForTimeout(800);

    // 03-collision-hero.png
    console.log('Capturing 03-collision-hero.png ...');
    await verifyMinimumFontSize(page, '03-collision-hero');
    await page.screenshot({ path: path.join(OUT_DIR, '03-collision-hero.png') });

    // 09-focus-view-4hop.png: Focus view with 4-hop chain
    console.log('Capturing 09-focus-view-4hop.png ...');
    await page.waitForTimeout(1000);
    await verifyMinimumFontSize(page, '09-focus-view-4hop');
    await page.screenshot({ path: path.join(OUT_DIR, '09-focus-view-4hop.png') });

    // Wait for git merge comparison event
    console.log('Waiting for GIT_COMPARISON event ...');
    await page.waitForTimeout(2000);

    // Ensure Verdict tab is open
    const verdictTab = page.locator('button:has-text("Verdict")');
    await verdictTab.click();
    await page.waitForTimeout(600);

    // 04-git-vs-chronofork.png
    console.log('Capturing 04-git-vs-chronofork.png ...');
    await verifyMinimumFontSize(page, '04-git-vs-chronofork');
    await page.screenshot({ path: path.join(OUT_DIR, '04-git-vs-chronofork.png') });

    // Wait for handoff / resolution
    console.log('Waiting for agent handoff resolution ...');
    await page.waitForTimeout(2500);

    // 05-resolution-handoff.png
    console.log('Capturing 05-resolution-handoff.png ...');
    await verifyMinimumFontSize(page, '05-resolution-handoff');
    await page.screenshot({ path: path.join(OUT_DIR, '05-resolution-handoff.png') });

    // Wait for verification completion
    await page.waitForTimeout(3000);

    // Click Merge receipt tab and approve merge
    console.log('Capturing 08-receipt.png ...');
    const receiptTab = page.locator('button:has-text("Merge receipt")');
    await receiptTab.click();
    await page.waitForTimeout(600);

    const approveBtn = page.locator('button:has-text("Approve Merge")');
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await page.waitForTimeout(500);
    }
    await verifyMinimumFontSize(page, '08-receipt');
    await page.screenshot({ path: path.join(OUT_DIR, '08-receipt.png') });

    // Scenario 2: Memory Recall
    console.log('Starting Scenario 2 (Memory Recall) ...');
    const sc2Btn = page.locator('button:has-text("2. Memory Recall")');
    await sc2Btn.click();
    await page.waitForTimeout(1500);

    // Open Memory tab in ResultStrip
    const memoryTab = page.locator('button:has-text("Memory (")');
    await memoryTab.click();
    await page.waitForTimeout(800);

    // 06-memory-run-compare.png
    console.log('Capturing 06-memory-run-compare.png ...');
    await verifyMinimumFontSize(page, '06-memory-run-compare');
    await page.screenshot({ path: path.join(OUT_DIR, '06-memory-run-compare.png') });

    // Scenario 3: Safe Parallel Proof
    console.log('Starting Scenario 3 (Safe Parallel Proof) ...');
    const sc3Btn = page.locator('button:has-text("3. Safe Parallel")');
    await sc3Btn.click();
    await page.waitForTimeout(1500);

    // 07-zero-path-proof.png
    console.log('Capturing 07-zero-path-proof.png ...');
    await page.waitForSelector('div[role="status"]', { timeout: 12000 });
    await page.waitForTimeout(600);
    await verifyMinimumFontSize(page, '07-zero-path-proof');
    await page.screenshot({ path: path.join(OUT_DIR, '07-zero-path-proof.png') });

    // Keep recording for smooth 20s scenario experience
    await page.waitForTimeout(2000);

    console.log('\nAll screenshots successfully captured and verified against font-size >= 13px!');
  } finally {
    const videoObj = page.video();
    await page.close();

    // Finalize video file and copy to docs/screens/scenario1.webm
    if (videoObj) {
      try {
        const videoPath = await videoObj.path();
        const targetPath = path.join(OUT_DIR, 'scenario1.webm');
        if (videoPath && fs.existsSync(videoPath)) {
          fs.copyFileSync(videoPath, targetPath);
          console.log(`Video recorded successfully to: ${targetPath}`);
        }
      } catch (vErr) {
        console.warn('Could not copy recorded video:', vErr);
      }
    }

    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Error running ui_shots:', err);
  process.exit(1);
});
