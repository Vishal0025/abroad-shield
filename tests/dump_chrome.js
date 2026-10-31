const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempDir = path.join(__dirname, '../.temp_chrome');

const cmd = `"${chromePath}" --headless=new --no-sandbox --user-data-dir="${tempDir}" --dump-dom http://localhost:3000`;
try {
  const out = execSync(cmd, { maxBuffer: 10 * 1024 * 1024 });
  console.log('Successfully dumped DOM! Length:', out.length);
  fs.writeFileSync(path.join(__dirname, 'chrome_dumped_dom.html'), out);
} catch (e) {
  console.error('Exec error:', e.message);
}
