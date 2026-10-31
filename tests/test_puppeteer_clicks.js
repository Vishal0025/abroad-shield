async function testButtons() {
  const puppeteer = await import('puppeteer-core');
  console.log('🚀 Starting Puppeteer-core with real Chrome...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => pageErrors.push(err.toString()));

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  console.log('\n--- BROWSER CONSOLE LOGS ---');
  consoleLogs.forEach(l => console.log(`[${l.type}] ${l.text}`));

  console.log('\n--- BROWSER PAGE ERRORS ---');
  if (pageErrors.length === 0) console.log('None! Zero page errors.');
  else pageErrors.forEach(e => console.error(e));

  console.log('\n--- TESTING PHYSICAL BUTTON CLICKS (DESKTOP 1280x800) ---');

  let totalTests = 0;
  let passedTests = 0;

  async function testClick(selector, expectedActionDesc, checkFn, evalArg) {
    totalTests++;
    try {
      const btn = await page.$(selector);
      if (!btn) {
        console.error(`❌ [FAIL] Selector "${selector}" not found on page!`);
        return false;
      }

      // Scroll element into center of viewport to avoid sticky header overlap
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      }, selector);
      await new Promise(r => setTimeout(r, 100));

      const box = await btn.boundingBox();
      if (!box) {
        console.error(`❌ [FAIL] Button "${selector}" has no bounding box (hidden/zero size)!`);
        return false;
      }

      // Check elementFromPoint to verify no invisible layer blocks it
      const topElementDesc = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return 'NOT_FOUND';
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return top ? (top.tagName + '#' + top.id + '.' + top.className) : 'NULL';
      }, selector);

      console.log(`Pointer hit test for ${selector}: [${topElementDesc}]`);

      // Physical cursor click
      await page.click(selector);
      await new Promise(r => setTimeout(r, 400));

      const passed = await page.evaluate(checkFn, evalArg);
      if (passed) {
        console.log(`✅ [PASS] Clicked "${selector}" -> ${expectedActionDesc}`);
        passedTests++;
        return true;
      } else {
        console.error(`❌ [FAIL] Clicked "${selector}" but ${expectedActionDesc} did not occur!`);
        return false;
      }
    } catch (err) {
      console.error(`❌ Error clicking ${selector}:`, err.message);
      return false;
    }
  }

  // 1. Test Advisory Ticker Navigation Buttons
  await testClick(
    '#btnNextAdvisory',
    'Senior advisory ticker cycled to next advice',
    () => {
      const pill = document.getElementById('advisoryCounterPill');
      return pill && pill.textContent.includes('2 /');
    }
  );

  await testClick(
    '#btnPrevAdvisory',
    'Senior advisory ticker cycled back to previous advice',
    () => {
      const pill = document.getElementById('advisoryCounterPill');
      return pill && pill.textContent.includes('1 /');
    }
  );

  // 2. Report / Review Your Agent Hero Button
  await testClick(
    '#btnHeroReportAgent',
    'modalSubmitReview opened with active class',
    () => {
      const modal = document.getElementById('modalSubmitReview');
      return modal && modal.classList.contains('active');
    }
  );

  // Close modal via close button
  await testClick(
    '#modalSubmitReview .modal-close-trigger',
    'modalSubmitReview closed',
    () => {
      const modal = document.getElementById('modalSubmitReview');
      return modal && !modal.classList.contains('active');
    }
  );

  // 3. Scam Scanner Hero Button
  await testClick(
    '#btnHeroScanLie',
    'view-scanner is active',
    () => {
      const scanner = document.getElementById('view-scanner');
      return scanner && scanner.classList.contains('active');
    }
  );

  // Switch back to reviews tab
  await page.evaluate(() => {
    window.switchTab('reviews');
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 200));

  // 4. Real Cost Calculator Hero Button
  await testClick(
    '#btnHeroCalcCost',
    'view-scanner is active for cost calc',
    () => {
      const scanner = document.getElementById('view-scanner');
      return scanner && scanner.classList.contains('active');
    }
  );

  // Switch back to reviews tab
  await page.evaluate(() => {
    window.switchTab('reviews');
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 200));

  // 5. Chat with Verified Seniors Hero Button
  await testClick(
    '#btnHeroChatSenior',
    'view-chat is active and in-chat container visible with no blocking modal',
    () => {
      const chat = document.getElementById('view-chat');
      const container = document.getElementById('chatAppContainer');
      const authModal = document.getElementById('modalGoogleAuth');
      const modalActive = authModal && authModal.classList.contains('active');
      return chat && chat.classList.contains('active') && container && container.style.display !== 'none' && !modalActive;
    }
  );

  // 6. Test In-Chat Header Login Button
  await testClick(
    '#btnChatHeaderLogin',
    'modalGoogleAuth opened from in-chat login button',
    () => {
      const modal = document.getElementById('modalGoogleAuth');
      return modal && modal.classList.contains('active');
    }
  );

  // Close Google Auth modal
  await page.evaluate(() => window.closeModal());
  await new Promise(r => setTimeout(r, 200));

  // 7. Test In-Chat Add Friend Button
  await testClick(
    '#btnActiveChatFriend',
    'prompted login or toggled friend successfully',
    () => {
      // Guest clicking add friend prompts Google sign-in modal
      const modal = document.getElementById('modalGoogleAuth');
      return modal && modal.classList.contains('active');
    }
  );

  // Close modal
  await page.evaluate(() => window.closeModal());
  await new Promise(r => setTimeout(r, 200));

  // 8. Test Navigation Tab button clicks
  const tabs = ['reviews', 'chat', 'feed', 'scanner', 'seniors'];
  for (const t of tabs) {
    await testClick(
      `.tab-btn[data-tab="${t}"]`,
      `tab switched to view-${t}`,
      (targetTab) => {
        const view = document.getElementById(`view-${targetTab}`);
        return view && view.classList.contains('active');
      },
      t
    );
  }

  // 9. Test Mobile viewport (iPhone / Android)
  console.log('\n--- TESTING MOBILE VIEWPORT (390x844 - iPhone / Android) ---');
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => {
    window.switchTab('reviews');
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 300));

  // Test mobile hamburger toggle
  await testClick(
    '#btnMobileMenuToggle',
    'mobileSideDrawer opened with active class',
    () => {
      const drawer = document.getElementById('mobileSideDrawer');
      return drawer && drawer.classList.contains('active');
    }
  );

  // Test mobile drawer close button
  await testClick(
    '#btnMobileDrawerClose',
    'mobileSideDrawer closed',
    () => {
      const drawer = document.getElementById('mobileSideDrawer');
      return drawer && !drawer.classList.contains('active');
    }
  );

  // Open drawer again and navigate to Chat tab via drawer item
  await testClick(
    '#btnMobileMenuToggle',
    'mobileSideDrawer opened again',
    () => {
      const drawer = document.getElementById('mobileSideDrawer');
      return drawer && drawer.classList.contains('active');
    }
  );

  await testClick(
    '.drawer-nav-item[data-tab="chat"]',
    'navigated to chat view via mobile drawer and drawer closed',
    () => {
      const chat = document.getElementById('view-chat');
      const drawer = document.getElementById('mobileSideDrawer');
      return chat && chat.classList.contains('active') && drawer && !drawer.classList.contains('active');
    }
  );

  // Mobile switch back to reviews tab via drawer
  await testClick(
    '#btnMobileMenuToggle',
    'mobileSideDrawer opened',
    () => {
      const drawer = document.getElementById('mobileSideDrawer');
      return drawer && drawer.classList.contains('active');
    }
  );

  await testClick(
    '.drawer-nav-item[data-tab="reviews"]',
    'navigated to reviews view via mobile drawer',
    () => {
      const reviews = document.getElementById('view-reviews');
      return reviews && reviews.classList.contains('active');
    }
  );

  // Test mobile click on hero button in mobile viewport
  await testClick(
    '#btnHeroChatSenior',
    'view-chat is active on mobile after hero click',
    () => {
      const chat = document.getElementById('view-chat');
      return chat && chat.classList.contains('active');
    }
  );

  await browser.close();
  console.log(`\n🏁 Test Results: ${passedTests} / ${totalTests} passed!`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL BUTTONS ARE FULLY WORKABLE AND OPERATIONAL!');
    process.exit(0);
  } else {
    console.error(`❌ ${totalTests - passedTests} test(s) failed.`);
    process.exit(1);
  }
}

testButtons().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
