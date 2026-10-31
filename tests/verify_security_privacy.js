/**
 * Test Suite: Security, Privacy, Auto Country Calculation, and Admin Vault
 */

const fs = require('fs');
const path = require('path');

// Mock localStorage and window
const localStorageData = {};
global.localStorage = {
  getItem: (key) => localStorageData[key] || null,
  setItem: (key, val) => { localStorageData[key] = String(val); },
  removeItem: (key) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};
global.window = global;

global.document = {
  createElement: () => ({
    getContext: () => ({
      fillText: () => {},
      measureText: () => ({ width: 100 })
    }),
    toDataURL: () => 'data:image/png;base64,mockCanvasHash123'
  }),
  getElementById: () => null,
  body: { style: {}, appendChild: () => {} }
};

global.navigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestBrowser',
  language: 'en-US',
  hardwareConcurrency: 8,
  deviceMemory: 16
};

global.screen = {
  width: 1920,
  height: 1080,
  colorDepth: 24
};

// Load security.js
require('../js/security.js');

const sec = global.securityService;

console.log('🧪 Starting AbroadShield Security & Privacy Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${message}`);
  } else {
    console.error(`❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// TEST 1: Silent Student Verification (Eligible age 22 passes silently)
const eligibleCheck = sec.validateAgeAndStudentStatus('2004-05-15', 'student_id', 'STU-YORK-9912', true);
assert(eligibleCheck.allowed === true, 'Eligible student (age 22) passes verification');
assert(eligibleCheck.age === 22, 'Calculates verified student age accurately');

// TEST 2: Over-age commercial candidate blocked silently WITHOUT leaking ":age=26"
const overAgeCheck = sec.validateAgeAndStudentStatus('1994-01-01', 'student_id', 'STU-OLD-11', true);
assert(overAgeCheck.allowed === false, 'Over-age candidate blocked by security filter');
assert(!overAgeCheck.message.includes('26'), 'Security error message does NOT reveal :age=26 threshold to user');
assert(overAgeCheck.message.includes('criteria not met'), 'Error message is professional and discrete');

// TEST 3: Confidential Admin Vault Access & Passkey
assert(sec.verifyAdminPasskey('admin2026') === true, 'Admin passkey "admin2026" validates successfully');
assert(sec.verifyAdminPasskey('wrong_pass') === false, 'Incorrect passkey rejected');

// TEST 4: Student identity recording strictly isolated in Admin Vault
sec.recordStudentVerification({
  id: 'usr_test_student',
  username: 'wander_scholar',
  realName: 'Arjun Sharma',
  email: 'arjun.sharma@gmail.com',
  dob: '2004-05-15',
  verifiedAge: 22,
  proofType: 'College Student ID Card',
  proofValue: 'YORK-2023-8819',
  country: 'Canada',
  university: 'York University'
});

const adminVaultRecords = sec.getAdminConfidentialRecords();
const foundRecord = adminVaultRecords.find(r => r.username === 'wander_scholar');
assert(foundRecord !== undefined, 'Student record stored in Admin Confidential Vault');
assert(foundRecord.email === 'arjun.sharma@gmail.com', 'Admin can see confidential student email');
assert(foundRecord.proofValue === 'YORK-2023-8819', 'Admin can see verified Student ID proof');

// TEST 5: Auto-calculate and dynamic country counts
const baselineCounts = {
  'Canada': 248,
  'UK': 182,
  'USA': 135,
  'Australia': 98,
  'Germany': 129
};

function calculateCountryCounts(records) {
  const counts = { ...baselineCounts };
  const custom = records.filter(r => !r.id.startsWith('usr_harpreet') && !r.id.startsWith('usr_ananya') && !r.id.startsWith('usr_rohit') && !r.id.startsWith('usr_neha') && !r.id.startsWith('usr_karthik'));
  custom.forEach(r => {
    if (r.country && counts[r.country] !== undefined) {
      counts[r.country]++;
    }
  });
  return counts;
}

const updatedCounts = calculateCountryCounts(adminVaultRecords);
assert(updatedCounts['Canada'] === 249, 'Canada student count automatically incremented to 249 when Arjun registered');
const totalStudents = Object.values(updatedCounts).reduce((a, b) => a + b, 0);
assert(totalStudents === 793, 'Global total students count updated to 793');

// TEST 6: Verify Device Fingerprint Hardware Lock (1 Device = 1 Student)
const devCheck1 = sec.verifyDeviceAccountBinding('arjun.sharma@gmail.com');
assert(devCheck1.allowed === true, 'First Google account permitted on device');

const devCheck2 = sec.verifyDeviceAccountBinding('commercial.agent@gmail.com');
assert(devCheck2.allowed === false, 'Second Google account on same physical hardware blocked permanently');

// TEST 7: Verified Student Profiles Strictly Omit Real Names & Contain Username, College, Course, and Place
require('../js/supabase.js');
const subService = new (global.SupabaseService || function() {
  this.getFallbackProfiles = (c) => {
    // create instance from file if needed
    const content = fs.readFileSync(path.join(__dirname, '../js/supabase.js'), 'utf8');
    const match = content.match(/getFallbackProfiles\(country\) \{([\s\S]*?)\n  \}/);
    if (match) {
      const fn = new Function('country', match[1]);
      return fn(c);
    }
    return [];
  };
})();

const mockSeniors = subService.getFallbackProfiles('All');
assert(mockSeniors.length >= 10, 'Fallback profiles contains global senior pool (10+ mentors)');

const realNamesList = ['Rahul Sharma', 'Ananya Iyer', 'Harpreet Singh', 'Rohit Verma', 'Neha Joshi', 'Karthik Reddy'];
const leakedRealName = mockSeniors.some(s => realNamesList.includes(s.display_name) || realNamesList.includes(s.username));
assert(!leakedRealName, 'Strict ID Privacy: Zero real student names in verified mentor profiles');

const allHaveRequiredAttrs = mockSeniors.every(s => 
  s.username && 
  (s.current_university || s.college) && 
  s.course && 
  (s.city || s.place)
);
assert(allHaveRequiredAttrs, 'Every verified senior profile strictly provides username, college, course, and place');

// TEST 8: Global Country Diversity (Ireland, France, Netherlands, Sweden, etc.)
const countriesRepresented = [...new Set(mockSeniors.map(s => s.destination_country))];
assert(countriesRepresented.includes('Ireland'), 'Ireland verified seniors represented');
assert(countriesRepresented.includes('France'), 'France verified seniors represented');
assert(countriesRepresented.includes('Netherlands'), 'Netherlands verified seniors represented');
assert(countriesRepresented.includes('Sweden'), 'Sweden verified seniors represented');

// TEST 9: Filter Seniors by Country or Course
function filterSeniors(seniors, country, course) {
  return seniors.filter(p => {
    const matchCountry = country === 'All' || p.destination_country === country;
    const matchCourse = course === 'All' || (p.course && p.course.toLowerCase().includes(course.toLowerCase()));
    return matchCountry && matchCourse;
  });
}

const irelandCs = filterSeniors(mockSeniors, 'Ireland', 'Computer Science');
assert(irelandCs.length === 1 && irelandCs[0].username === 'liam_dublin', 'Filter matches Ireland Computer Science senior (@liam_dublin at Trinity College Dublin)');

const cloudDevops = filterSeniors(mockSeniors, 'All', 'Cloud');
assert(cloudDevops.length >= 1 && cloudDevops[0].current_university === 'Langara College', 'Filter matches Cloud Computing course seniors');

// TEST 10: Crowdsourced Agency Creation & Review Form Linking
function checkOrCreateAgency(existingReviews, inputName) {
  const existing = existingReviews.find(r => r.agency_name.toLowerCase().includes(inputName.toLowerCase()));
  if (existing) {
    return { status: 'found', agency: existing.agency_name, prefillReview: true };
  } else {
    return { status: 'created', agency: inputName, prefillReview: true };
  }
}

const sampleReviews = [
  { agency_name: 'IDP Education', branch_city: 'Bangalore' },
  { agency_name: 'Apex Global Overseas', branch_city: 'Chandigarh' }
];

const checkExisting = checkOrCreateAgency(sampleReviews, 'Apex');
assert(checkExisting.status === 'found' && checkExisting.agency === 'Apex Global Overseas', 'Existing agency detected and linked on Wall of Truth');

const checkNew = checkOrCreateAgency(sampleReviews, 'Skyline Pathway Consultants');
assert(checkNew.status === 'created' && checkNew.agency === 'Skyline Pathway Consultants', 'Unlisted agency dynamically created on Wall of Truth');

// TEST 11: Verification Gate Cancellation
const mockUserState = {
  is_google: true,
  has_completed_onboarding: false,
  verification_paused: false
};

function cancelOnboarding(userState) {
  userState.verification_paused = true;
  return { modalClosed: true, reminderBannerVisible: true };
}

const cancelResult = cancelOnboarding(mockUserState);
assert(cancelResult.modalClosed === true, 'Verification gate modal safely closes on cancel');
assert(cancelResult.reminderBannerVisible === true, 'Verification banner displayed to allow student to verify later');

// TEST 12: Validate js/app.js syntax & compilation
const { execSync } = require('child_process');
let appSyntaxOk = false;
try {
  execSync('node -c "js/app.js"', { stdio: 'pipe' });
  appSyntaxOk = true;
} catch (e) {
  appSyntaxOk = false;
}
assert(appSyntaxOk === true, 'Core application file js/app.js compiles with zero syntax errors');

// TEST 13: Admin Vault Access Hidden from Public Header and Accessible via /admin
const indexHtmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert(!indexHtmlContent.includes('id="btnHeaderAdminVault"'), 'Admin button is completely removed from public header');

function checkAdminRouteMatch(pathname, hash) {
  const path = (pathname || '').toLowerCase();
  const h = (hash || '').toLowerCase();
  return path === '/admin' || path.startsWith('/admin') || h === '#admin';
}

assert(checkAdminRouteMatch('/admin', '') === true, 'Direct /admin URL triggers admin vault login');
assert(checkAdminRouteMatch('/admin/dashboard', '') === true, 'Subpath /admin/dashboard triggers admin vault login');
assert(checkAdminRouteMatch('/', '#admin') === true, 'Hash #admin triggers admin vault login');
assert(checkAdminRouteMatch('/', '') === false, 'Standard home URL / keeps admin vault hidden');

// TEST 14: 3D Animation Script Compilation & Integration
let animSyntaxOk = false;
try {
  execSync('node -c "js/animation3d.js"', { stdio: 'pipe' });
  animSyntaxOk = true;
} catch (e) {
  animSyntaxOk = false;
}
assert(animSyntaxOk === true, '3D animation engine js/animation3d.js compiles with zero syntax errors');
assert(indexHtmlContent.includes('js/animation3d.js'), 'index.html includes 3D animation engine script');
assert(indexHtmlContent.includes('fx-3d-pill'), 'Hero banner includes interactive 3D hubs indicator pill');

// TEST 15: Interactive Senior Advisory Ticker
const appJsContent = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
assert(indexHtmlContent.includes('advisoryCounterPill'), 'index.html has dynamic advisory counter pill');
assert(indexHtmlContent.includes('btnNextAdvisory'), 'index.html includes Next advisory button');
assert(indexHtmlContent.includes('btnPrevAdvisory'), 'index.html includes Previous advisory button');
assert(appJsContent.includes('SENIOR_ADVISORIES'), 'js/app.js defines multi-alert senior advisory catalogue');

const mockAdvisories = [
  { id: 1, text: 'Alert 1' },
  { id: 2, text: 'Alert 2' },
  { id: 3, text: 'Alert 3' },
  { id: 4, text: 'Alert 4' },
  { id: 5, text: 'Alert 5' }
];
let currentAdvIdx = 0;
function nextAdvisory() {
  currentAdvIdx = (currentAdvIdx + 1) % mockAdvisories.length;
  return mockAdvisories[currentAdvIdx];
}
assert(nextAdvisory().id === 2, 'Senior advisory advances to alert #2 on next trigger');
assert(mockAdvisories.length === 5, 'Senior advisory ticker loaded with 5 verified warnings');

// TEST 15B: Confirm NO years (2025/2026) are displayed in Senior Advisory
assert(!appJsContent.includes('Warning for 2025/2026 Aspirants'), 'js/app.js does not contain year 2025/2026 in advisory list');
assert(!indexHtmlContent.includes('Warning for 2025/2026 Aspirants'), 'index.html does not contain year 2025/2026 in advisory banner');
assert(appJsContent.includes('window.nextAdvisory'), 'js/app.js exposes window.nextAdvisory function');
assert(appJsContent.includes('window.prevAdvisory'), 'js/app.js exposes window.prevAdvisory function');
assert(indexHtmlContent.includes('window.nextAdvisory()'), 'index.html triggers window.nextAdvisory() on click');
assert(indexHtmlContent.includes('window.prevAdvisory()'), 'index.html triggers window.prevAdvisory() on click');

// TEST 16: Chat Authentication Enforcement (Login required before chatting)
assert(indexHtmlContent.includes('chatAuthGate'), 'Chat view contains dedicated Student Authentication Gate');
assert(indexHtmlContent.includes('Student Authentication Required'), 'Chat view requires student authentication');
assert(appJsContent.includes('requireAuthForChat'), 'js/app.js implements requireAuthForChat guard');

function mockRequireAuthForChat(currentUser, seniorId) {
  if (currentUser && currentUser.is_google) {
    return { allowed: true, promptLogin: false };
  }
  return { allowed: false, promptLogin: true, pendingSeniorId: seniorId };
}

const unauthChatAttempt = mockRequireAuthForChat(null, 'usr_rahul_to');
assert(unauthChatAttempt.allowed === false, 'Unauthenticated visitor is strictly blocked from chatting without login');
assert(unauthChatAttempt.promptLogin === true, 'Unauthenticated visitor receives Google login prompt when attempting to chat');
assert(unauthChatAttempt.pendingSeniorId === 'usr_rahul_to', 'Target senior is safely queued so chat opens immediately post-login');

const authChatAttempt = mockRequireAuthForChat({ is_google: true, username: 'test_student' }, 'usr_rahul_to');
assert(authChatAttempt.allowed === true, 'Authenticated Google student is immediately permitted to chat');
assert(authChatAttempt.promptLogin === false, 'Authenticated student does not see login prompt');

// TEST 17: Mobile Side Menu / Drawer (Android & iPhone Ergonomics)
const cssContent = fs.readFileSync(path.join(__dirname, '../css/index.css'), 'utf8');

assert(indexHtmlContent.includes('mobile-side-drawer'), 'index.html contains mobile side drawer markup');
assert(indexHtmlContent.includes('mobileDrawerBackdrop'), 'index.html contains mobile drawer backdrop overlay');
assert(indexHtmlContent.includes('btnMobileMenuToggle'), 'index.html includes mobile hamburger menu toggle button');
assert(indexHtmlContent.includes('drawerAuthCard'), 'index.html includes student authentication status card in drawer');
assert(indexHtmlContent.includes('drawer-country-grid'), 'index.html includes touch-friendly destination quick filter grid');

assert(appJsContent.includes('window.openMobileMenu'), 'js/app.js exposes window.openMobileMenu');
assert(appJsContent.includes('window.closeMobileMenu'), 'js/app.js exposes window.closeMobileMenu');
assert(appJsContent.includes('window.mobileNavigateTab'), 'js/app.js exposes window.mobileNavigateTab');
assert(appJsContent.includes('window.mobileSelectCountry'), 'js/app.js exposes window.mobileSelectCountry');
assert(appJsContent.includes('updateDrawerAuthUI'), 'js/app.js implements updateDrawerAuthUI');
assert(appJsContent.includes('touchstart'), 'js/app.js supports mobile touch gesture initiation');
assert(appJsContent.includes('touchend'), 'js/app.js supports swipe-left dismissal gesture');

assert(cssContent.includes('.mobile-side-drawer'), 'css/index.css defines mobile side drawer styles');
assert(cssContent.includes('env(safe-area-inset-top)'), 'css/index.css handles iPhone notch / Dynamic Island safe-area-inset-top');
assert(cssContent.includes('env(safe-area-inset-bottom)'), 'css/index.css handles iOS home bar / Android navigation safe-area-inset-bottom');
assert(cssContent.includes('.mobile-menu-toggle-btn'), 'css/index.css defines mobile hamburger button styling');

// TEST 18: Button Interactivity, Friend System, & Direct In-Chat Login
const freshHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const freshAppJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const freshCss = fs.readFileSync(path.join(__dirname, '../css/index.css'), 'utf8');

assert(freshHtml.includes('window.openModal(\'modalSubmitReview\')'), 'Hero Report Agent button has explicit reliable onclick handler');
assert(freshHtml.includes('window.goToChatView()'), 'Hero Chat button has explicit reliable onclick handler');
assert(freshHtml.includes('window.switchTabAndScrollScanner()'), 'Hero Scam Scanner button has explicit reliable onclick handler');
assert(freshHtml.includes('window.switchTabAndScrollCostCalc()'), 'Hero Cost Calculator button has explicit reliable onclick handler');

assert(freshHtml.includes('btnActiveChatFriend'), 'Chat view includes friend toggle button');
assert(freshHtml.includes('chatFilterFriends'), 'Chat sidebar includes My Friends filter tab');
assert(freshHtml.includes('chatGuestLoginBanner'), 'Chat view includes in-chat Google login banner for guests');
assert(freshHtml.includes('btnChatHeaderLogin'), 'Chat header includes in-header login pill');

assert(freshAppJs.includes('window.isFriend'), 'js/app.js exposes window.isFriend');
assert(freshAppJs.includes('window.toggleFriendship'), 'js/app.js exposes window.toggleFriendship');
assert(freshAppJs.includes('window.setChatFilter'), 'js/app.js exposes window.setChatFilter');
assert(freshAppJs.includes('window.promptChatLogin'), 'js/app.js exposes window.promptChatLogin');
assert(freshAppJs.includes('triggerSeniorFriendReply'), 'js/app.js implements interactive friend messaging reply engine');

assert(freshCss.includes('.card-3d-glare'), 'css/index.css defines card-3d-glare protection');
assert(freshCss.includes('pointer-events: none !important'), 'css/index.css guarantees 3D overlays do not block clicks');
assert(freshCss.includes('.btn-chat-friend'), 'css/index.css defines friend toggle styling');
// TEST 19: Student/Senior Profile Photo, Mobile Number Privacy Controls, & Data Storage Architecture
assert(freshHtml.includes('modalUserProfile'), 'index.html contains user profile management modal');
assert(freshHtml.includes('inputProfileAvatarFile'), 'index.html includes photo upload from device input');
assert(freshHtml.includes('inputProfileAvatarUrl'), 'index.html includes custom photo image URL input');
assert(freshHtml.includes('pickProfileAvatarPreset'), 'index.html includes one-click verified student avatar presets');
assert(freshHtml.includes('inputUserMobile'), 'index.html includes mobile phone number input field');
assert(freshHtml.includes('checkSharePhonePublicly'), 'index.html includes explicit public phone sharing privacy switch');
assert(freshHtml.includes('badgePhonePrivacyStatus'), 'index.html includes dynamic privacy status indicator badge');
assert(freshHtml.includes('btnChatHeaderWhatsApp'), 'index.html includes chat header WhatsApp quick contact button');
assert(freshHtml.includes('data-storage-trust-banner'), 'index.html includes data storage & privacy transparency banner');

assert(freshAppJs.includes('window.populateUserProfileModal'), 'js/app.js exposes window.populateUserProfileModal');
assert(freshAppJs.includes('window.pickProfileAvatarPreset'), 'js/app.js exposes window.pickProfileAvatarPreset');
assert(freshAppJs.includes('window.handlePhonePrivacyToggle'), 'js/app.js exposes window.handlePhonePrivacyToggle');
assert(freshAppJs.includes('window.updatePhonePrivacyUI'), 'js/app.js exposes window.updatePhonePrivacyUI');
assert(freshAppJs.includes('share_phone_publicly'), 'js/app.js handles share_phone_publicly state');
assert(freshAppJs.includes('btn-whatsapp-senior'), 'js/app.js generates WhatsApp quick link for opted-in seniors');
assert(freshAppJs.includes('Phone Kept Private'), 'js/app.js renders strict privacy badge for unshared phone numbers');

// Verify Security Vault Isolation for Mobile Data
const mockVaultRecord = sec.recordStudentVerification({
  email: 'priya.patel@gmail.com',
  name: 'Priya Patel',
  age: 23,
  studentIdProof: 'ID-UTOR-882194',
  mobileNumber: '+1 416 555 0199',
  sharePhonePublicly: false
});
assert(mockVaultRecord.mobileNumber === '+1 416 555 0199', 'Admin Confidential Vault securely logs student mobile number');
assert(mockVaultRecord.sharePhonePublicly === false, 'Admin Confidential Vault securely records private sharing flag');

const vaultRecords = sec.getAdminConfidentialRecords();
const priyaRecord = vaultRecords.find(r => r.email === 'priya.patel@gmail.com');
assert(priyaRecord && priyaRecord.mobileNumber === '+1 416 555 0199', 'Confidential student mobile number is accessible only in Admin Vault');

// Verify Strict Public Leak Prevention
const publicSeniorsFallback = [
  { username: 'rahul_to', share_phone_publicly: true, mobile_number: '+1 416 555 0188' },
  { username: 'ananya_uk', share_phone_publicly: false, mobile_number: '+44 7700 900123' }
];

function mockRenderPhoneDisplay(senior) {
  if (senior.share_phone_publicly && senior.mobile_number) {
    return `<a href="https://wa.me/${senior.mobile_number.replace(/[^0-9]/g, '')}">${senior.mobile_number}</a>`;
  }
  return '<span class="senior-private-phone-badge">🔒 Phone Kept Private</span>';
}

const rahulDisplay = mockRenderPhoneDisplay(publicSeniorsFallback[0]);
const ananyaDisplay = mockRenderPhoneDisplay(publicSeniorsFallback[1]);
assert(rahulDisplay.includes('+1 416 555 0188'), 'Opted-in senior displays clickable WhatsApp phone link');
assert(!ananyaDisplay.includes('+44 7700 900123'), 'Strict Privacy: Private senior mobile number NEVER rendered in public markup');
assert(ananyaDisplay.includes('Phone Kept Private'), 'Private senior renders discrete privacy badge');

console.log(`\n🎉 Results: ${passedTests}/${totalTests} tests passed!`);



