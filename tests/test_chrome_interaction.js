const { spawn, execSync } = require('child_process');
const http = require('http');

async function run() {
  console.log('1. Launching Headless Chrome...');
  try {
    execSync('taskkill /F /IM chrome.exe', { stdio: 'ignore' });
  } catch (e) {}

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const fs = require('fs');
  const path = require('path');
  const tempDir = path.join(__dirname, '../.temp_chrome');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${tempDir}`,
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:3000'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  console.log('2. Querying Chrome CDP targets...');
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const page = targets.find(t => t.type === 'page');
  console.log('Found page target:', page.title, page.url);
  console.log('Connecting WebSocket to:', page.webSocketDebuggerUrl);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let msgId = 1;
  const callbacks = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      callbacks.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise(resolve => ws.onopen = resolve);
  console.log('3. WebSocket connected. Enabling Runtime and Console...');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      const { resolve, reject } = callbacks.get(data.id);
      callbacks.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    } else if (data.method === 'Runtime.consoleAPICalled') {
      const args = data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      console.log(`[BROWSER CONSOLE] [${data.params.type}]`, args);
    } else if (data.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', JSON.stringify(data.params.exceptionDetails));
    }
  };

  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');

  // Wait 1.5 seconds for scripts to run
  await new Promise(r => setTimeout(r, 1500));

  console.log('\n4. Evaluating button clicks in browser context:');

  // Test 1: Check if window functions exist
  const funcCheck = await sendCommand('Runtime.evaluate', {
    expression: 'JSON.stringify({ openModal: typeof window.openModal, goToChatView: typeof window.goToChatView, switchTab: typeof window.switchTabAndScrollScanner })',
    returnByValue: true
  });
  console.log('Window functions check:', funcCheck.result.value);

  // Test 2: Click btnHeroReportAgent
  const clickReport = await sendCommand('Runtime.evaluate', {
    expression: '(() => { const btn = document.getElementById("btnHeroReportAgent"); if (!btn) return "NOT_FOUND"; btn.click(); const modal = document.getElementById("modalSubmitReview"); return modal && modal.classList.contains("active"); })()',
    returnByValue: true
  });
  console.log('Click btnHeroReportAgent -> modalSubmitReview active:', clickReport.result.value);

  // Test 3: Click btnHeroChatSenior
  const clickChat = await sendCommand('Runtime.evaluate', {
    expression: '(() => { const btn = document.getElementById("btnHeroChatSenior"); if (!btn) return "NOT_FOUND"; btn.click(); const chatView = document.getElementById("view-chat"); return chatView && chatView.classList.contains("active"); })()',
    returnByValue: true
  });
  console.log('Click btnHeroChatSenior -> view-chat active:', clickChat.result.value);

  // Test 4: Click btnHeroScanLie
  const clickScan = await sendCommand('Runtime.evaluate', {
    expression: '(() => { const btn = document.getElementById("btnHeroScanLie"); if (!btn) return "NOT_FOUND"; btn.click(); const scannerView = document.getElementById("view-scanner"); return scannerView && scannerView.classList.contains("active"); })()',
    returnByValue: true
  });
  console.log('Click btnHeroScanLie -> view-scanner active:', clickScan.result.value);

  // Test 5: Click btnHeroCalcCost
  const clickCalc = await sendCommand('Runtime.evaluate', {
    expression: '(() => { const btn = document.getElementById("btnHeroCalcCost"); if (!btn) return "NOT_FOUND"; btn.click(); const scannerView = document.getElementById("view-scanner"); return scannerView && scannerView.classList.contains("active"); })()',
    returnByValue: true
  });
  console.log('Click btnHeroCalcCost -> view-scanner active:', clickCalc.result.value);

  // Test 6: Check elementFromPoint over the hero buttons!
  const elemAtPoint = await sendCommand('Runtime.evaluate', {
    expression: '(() => { const btn = document.getElementById("btnHeroReportAgent"); if (!btn) return "NO_BTN"; const rect = btn.getBoundingClientRect(); const topElem = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2); return topElem ? (topElem.tagName + "#" + topElem.id + "." + topElem.className) : "NULL"; })()',
    returnByValue: true
  });
  console.log('Element directly under cursor at btnHeroReportAgent:', elemAtPoint.result.value);

  ws.close();
  chrome.kill();
  try {
    execSync('taskkill /F /IM chrome.exe', { stdio: 'ignore' });
  } catch (e) {}
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

