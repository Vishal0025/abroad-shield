/**
 * AbroadShield Club - Core Application Logic
 * Integrates Supabase Database, Instagram-style Chat, Agent Wall of Truth & Interactive Tools
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    activeCountry: 'All',
    activeTab: 'reviews',
    currentUser: null,
    activeChatUser: null,
    searchQuery: '',
    reviewFilter: 'all', // all, danger, safe
    profiles: [],
    reviews: [],
    discussions: [],
    chatMessages: [],
    messagePollInterval: null,
    countryStudentCounts: {
      'Canada': 248,
      'UK': 182,
      'USA': 135,
      'Australia': 98,
      'Germany': 129
    },
    seniorCountryFilter: 'All',
    seniorCourseFilter: 'All',
    seniorSearchKeyword: '',
    adminVaultUnlocked: false,
    pendingChatSeniorId: null,
    friends: (() => {
      try {
        const saved = localStorage.getItem('abroad_shield_friends');
        return saved ? JSON.parse(saved) : ['usr_harpreet_ca', 'usr_ananya_uk'];
      } catch (e) {
        return ['usr_harpreet_ca', 'usr_ananya_uk'];
      }
    })(),
    chatFilter: 'all' // 'all' | 'friends'
  };

  // Pre-configured Currency exchange rates to INR
  const FX_RATES = {
    'Canada': { currency: 'CAD', symbol: '$', toInr: 61.5 },
    'UK': { currency: 'GBP', symbol: '£', toInr: 106.8 },
    'USA': { currency: 'USD', symbol: '$', toInr: 83.9 },
    'Australia': { currency: 'AUD', symbol: 'A$', toInr: 54.8 },
    'Germany': { currency: 'EUR', symbol: '€', toInr: 91.2 }
  };

  // City default living cost metrics (Real vs Agent Quoted)
  const CITY_COST_PRESETS = {
    'Toronto': { country: 'Canada', rentReal: 850, rentAgent: 450, foodReal: 300, foodAgent: 150, transitReal: 130, transitAgent: 80, otherReal: 120, otherAgent: 50 },
    'Vancouver': { country: 'Canada', rentReal: 950, rentAgent: 500, foodReal: 320, foodAgent: 150, transitReal: 140, transitAgent: 80, otherReal: 130, otherAgent: 50 },
    'London': { country: 'UK', rentReal: 900, rentAgent: 450, foodReal: 220, foodAgent: 120, transitReal: 140, transitAgent: 70, otherReal: 150, otherAgent: 60 },
    'Birmingham': { country: 'UK', rentReal: 600, rentAgent: 350, foodReal: 180, foodAgent: 100, transitReal: 80, transitAgent: 50, otherReal: 100, otherAgent: 40 },
    'Dallas': { country: 'USA', rentReal: 800, rentAgent: 400, foodReal: 280, foodAgent: 150, transitReal: 100, transitAgent: 50, otherReal: 140, otherAgent: 60 },
    'Melbourne': { country: 'Australia', rentReal: 950, rentAgent: 500, foodReal: 320, foodAgent: 150, transitReal: 160, transitAgent: 80, otherReal: 150, otherAgent: 70 },
    'Berlin': { country: 'Germany', rentReal: 550, rentAgent: 350, foodReal: 220, foodAgent: 120, transitReal: 49, transitAgent: 49, otherReal: 110, otherAgent: 50 }
  };

  // Onboarding Wizard State
  const onboarding = {
    step: 1,
    role: 'senior_student',
    country: 'Canada',
    safetyRating: 4,
    transitRating: 5,
    jobReality: 'Extremely Scarce (Takes 2-3+ months)',
    isCompleted: false,
    desiredUsername: ''
  };

  // Modal Helpers (Always available immediately for all buttons)
  window.openModal = (modalId) => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      if (modalId === 'modalUserProfile') {
        window.populateUserProfileModal();
      }
    }
  };

  window.closeModal = () => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    if (window.location.pathname.toLowerCase().includes('/admin') || window.location.hash.toLowerCase() === '#admin') {
      window.history.pushState(null, '', '/');
    }
  };

  window.switchTab = (tabId) => {
    switchTab(tabId);
  };

  // Senior Advisory Alert Ticker (No Year Mentioned)
  const SENIOR_ADVISORIES = [
    {
      id: 1,
      badge: '🚨 Document Safety',
      text: '🚨 <strong>Document Safety:</strong> Never leave original passports or marksheets with any education consultant. Embassies only require verified digital uploads!'
    },
    {
      id: 2,
      badge: '⚠️ College Accreditation',
      text: '⚠️ <strong>College Accreditation:</strong> Always verify that your college is a designated public institution with Work Permit (PGWP) eligibility before paying tuition deposits.'
    },
    {
      id: 3,
      badge: '🛡️ Job Reality Check',
      text: '🛡️ <strong>Job Reality:</strong> Consultants cannot legally guarantee jobs or PR. Seniors report off-campus work takes 2–3 months of active networking to secure.'
    },
    {
      id: 4,
      badge: '💳 Fee Protection',
      text: '💳 <strong>Fee Protection:</strong> Never pay ₹50,000–₹1,50,000 for "embassy quotas" or undocumented file opening. Direct university applications have zero hidden fees.'
    },
    {
      id: 5,
      badge: '🔑 Direct Portal Control',
      text: '🔑 <strong>Portal Credentials:</strong> Always demand your direct university application portal login credentials and password from your consultant.'
    }
  ];

  let currentAdvisoryIdx = 0;
  let advisoryTimer = null;

  window.nextAdvisory = () => {
    currentAdvisoryIdx = (currentAdvisoryIdx + 1) % SENIOR_ADVISORIES.length;
    renderAdvisory();
    restartAdvisoryTimer();
  };

  window.prevAdvisory = () => {
    currentAdvisoryIdx = (currentAdvisoryIdx - 1 + SENIOR_ADVISORIES.length) % SENIOR_ADVISORIES.length;
    renderAdvisory();
    restartAdvisoryTimer();
  };

  function renderAdvisory() {
    const adv = SENIOR_ADVISORIES[currentAdvisoryIdx];
    const textEl = document.getElementById('advisoryMessageText');
    const counterEl = document.getElementById('advisoryCounterPill');
    const trackEl = document.getElementById('advisoryTextTrack');

    if (counterEl) counterEl.textContent = `${currentAdvisoryIdx + 1} / ${SENIOR_ADVISORIES.length}`;
    if (textEl && trackEl) {
      trackEl.classList.remove('fade-in-advisory');
      void trackEl.offsetWidth; // trigger reflow
      textEl.innerHTML = adv.text;
      trackEl.classList.add('fade-in-advisory');
    }
  }

  function restartAdvisoryTimer() {
    if (advisoryTimer) clearInterval(advisoryTimer);
    advisoryTimer = setInterval(() => {
      currentAdvisoryIdx = (currentAdvisoryIdx + 1) % SENIOR_ADVISORIES.length;
      renderAdvisory();
    }, 6000);
  }

  function initSeniorAdvisoryTicker() {
    renderAdvisory();
    restartAdvisoryTimer();
  }

  // Initialize
  initUser();
  initCountryCounters();
  setupEventListeners();
  setupOnboardingWizard();
  loadData();
  setupCostCalculator();
  setupLieScanner();
  setupAdminVault();
  initSeniorAdvisoryTicker();
  initMobileMenu();

  // 1. User Account Setup (Google Sign-In & Privacy-first)
  function initUser() {
    const saved = localStorage.getItem('abroad_shield_user');
    if (saved) {
      try {
        state.currentUser = JSON.parse(saved);
      } catch (e) {
        state.currentUser = null;
      }
    }

    if (state.currentUser && state.currentUser.is_google) {
      onboarding.isCompleted = Boolean(state.currentUser.has_completed_onboarding);
      updateUserHeaderUI();
    } else {
      state.currentUser = null;
      updateUserHeaderUI();
    }
  }

  function updateUserHeaderUI() {
    const googleBtn = document.getElementById('btnHeaderGoogleLogin');
    const profilePill = document.getElementById('userProfilePill');
    const nameEl = document.getElementById('userDisplayHandle');
    const roleEl = document.getElementById('userDisplayRole');
    const avatarEl = document.getElementById('userDisplayAvatar');
    const googleTag = document.getElementById('userGoogleTag');

    if (state.currentUser && state.currentUser.is_google) {
      if (googleBtn) googleBtn.style.display = 'none';
      if (profilePill) profilePill.style.display = 'flex';
      if (nameEl) nameEl.textContent = '@' + state.currentUser.username;
      if (roleEl) roleEl.textContent = `${state.currentUser.role === 'senior_student' ? 'Senior' : 'Aspirant'} (${state.currentUser.destination_country})`;
      if (avatarEl) avatarEl.src = state.currentUser.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
      if (googleTag) googleTag.style.display = 'inline-flex';
    } else {
      if (googleBtn) googleBtn.style.display = 'flex';
      if (profilePill) profilePill.style.display = 'none';
    }
    updateChatAuthUI();
    updateDrawerAuthUI();
  }

  // 1C. Chat Authentication Gate & Direct In-Chat Login Option
  function updateChatAuthUI() {
    const gate = document.getElementById('chatAuthGate');
    const container = document.getElementById('chatAppContainer');
    const guestBanner = document.getElementById('chatGuestLoginBanner');
    const headerLoginBtn = document.getElementById('btnChatHeaderLogin');
    const chatMsgInput = document.getElementById('chatMsgInput');
    const chatGuestSeniorName = document.getElementById('chatGuestSeniorName');

    if (gate) gate.style.display = 'none'; // Keep container visible so visitors can explore & view mentors
    if (container) container.style.display = 'grid';

    const activeHandle = state.activeChatUser ? '@' + (state.activeChatUser.username || state.activeChatUser.display_name.replace('@', '')) : 'this senior';

    if (state.currentUser && state.currentUser.is_google) {
      if (guestBanner) guestBanner.style.display = 'none';
      if (headerLoginBtn) headerLoginBtn.style.display = 'none';
      if (chatMsgInput) {
        chatMsgInput.placeholder = `Message ${activeHandle} or friend without sharing phone or WhatsApp...`;
      }
    } else {
      if (guestBanner) guestBanner.style.display = 'flex';
      if (headerLoginBtn) headerLoginBtn.style.display = 'inline-flex';
      if (chatGuestSeniorName) chatGuestSeniorName.textContent = activeHandle;
      if (chatMsgInput) {
        chatMsgInput.placeholder = `🔒 Sign in with Google to message ${activeHandle} & make friends...`;
      }
    }
    updateActiveChatFriendUI();
  }

  function requireAuthForChat(pendingSeniorId) {
    if (state.currentUser && state.currentUser.is_google) {
      return true;
    }
    if (pendingSeniorId) {
      state.pendingChatSeniorId = pendingSeniorId;
    }
    showToast('🔒 Please sign in with Google to chat anonymously & make friends.');
    openModal('modalGoogleAuth');
    updateChatAuthUI();
    return false;
  }

  window.promptChatLogin = () => {
    if (state.activeChatUser) {
      state.pendingChatSeniorId = state.activeChatUser.id;
    }
    showToast('🔑 Sign in with Google to message seniors, reply, and make friends!');
    openModal('modalGoogleAuth');
  };

  // Friendship System (Make friends and message each other)
  window.isFriend = (userId) => {
    return Array.isArray(state.friends) && state.friends.includes(userId);
  };

  window.toggleFriendship = (userId) => {
    if (!state.currentUser) {
      state.pendingChatSeniorId = userId;
      showToast('🔒 Please sign in with Google to add friends and message each other.');
      openModal('modalGoogleAuth');
      return;
    }

    const senior = state.profiles.find(p => p.id === userId);
    const seniorName = senior ? '@' + (senior.username || senior.display_name.replace('@', '')) : 'Student';

    if (window.isFriend(userId)) {
      state.friends = state.friends.filter(id => id !== userId);
      showToast(`Removed ${seniorName} from your friends.`);
    } else {
      if (!Array.isArray(state.friends)) state.friends = [];
      state.friends.push(userId);
      showToast(`🎉 You and ${seniorName} are now Friends! You can message each other anytime.`);
    }

    localStorage.setItem('abroad_shield_friends', JSON.stringify(state.friends));
    renderChatSidebar();
    updateActiveChatFriendUI();
    renderSeniors();
  };

  window.toggleFriendshipForActiveUser = () => {
    if (state.activeChatUser) {
      window.toggleFriendship(state.activeChatUser.id);
    }
  };

  function updateActiveChatFriendUI() {
    const friendBtn = document.getElementById('btnActiveChatFriend');
    const friendBtnText = document.getElementById('btnActiveChatFriendText');
    if (!friendBtn || !state.activeChatUser) return;

    const isF = window.isFriend(state.activeChatUser.id);
    if (isF) {
      friendBtn.classList.add('is-friend');
      if (friendBtnText) friendBtnText.textContent = 'Friends 🤝';
      friendBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> <span id="btnActiveChatFriendText">Friends 🤝</span>';
    } else {
      friendBtn.classList.remove('is-friend');
      if (friendBtnText) friendBtnText.textContent = 'Add Friend';
      friendBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> <span id="btnActiveChatFriendText">Add Friend</span>';
    }
  }

  window.setChatFilter = (filter) => {
    state.chatFilter = filter;
    document.getElementById('chatFilterAll')?.classList.toggle('active', filter === 'all');
    document.getElementById('chatFilterFriends')?.classList.toggle('active', filter === 'friends');
    renderChatSidebar();
  };

  // Hero Quick Navigation Buttons
  window.goToChatView = () => {
    switchTab('chat');
    if (state.profiles.length > 0 && !state.activeChatUser) {
      selectChatUser(state.profiles[0]);
    }
    const target = document.getElementById('view-chat');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (!state.currentUser) {
      showToast('💬 Welcome to Senior Chat! Select any senior or friend to start messaging.');
    }
  };

  window.switchTabAndScrollScanner = () => {
    switchTab('scanner');
    setTimeout(() => {
      document.getElementById('agentLieScannerSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  window.switchTabAndScrollCostCalc = () => {
    switchTab('scanner');
    setTimeout(() => {
      document.getElementById('costCalcSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // 1B. Dynamic Real-Time Country Student Counters (Auto-Calculated)
  function initCountryCounters() {
    calculateAndSyncCountryStudentCounts();
  }

  function calculateAndSyncCountryStudentCounts() {
    const baseline = {
      'Canada': 248,
      'UK': 182,
      'USA': 135,
      'Australia': 98,
      'Germany': 129
    };

    // Calculate dynamic registrations from Confidential Admin Vault
    if (window.securityService) {
      const records = window.securityService.getAdminConfidentialRecords();
      const customRegistrations = records.filter(r => !r.id.startsWith('usr_harpreet') && !r.id.startsWith('usr_ananya') && !r.id.startsWith('usr_rohit') && !r.id.startsWith('usr_neha') && !r.id.startsWith('usr_karthik'));
      customRegistrations.forEach(r => {
        if (r.country && baseline[r.country] !== undefined) {
          baseline[r.country]++;
        }
      });
    }

    const saved = localStorage.getItem('abroad_country_counts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        Object.keys(baseline).forEach(c => {
          if (parsed[c] && parsed[c] > baseline[c]) {
            baseline[c] = parsed[c];
          }
        });
      } catch (e) {}
    }

    state.countryStudentCounts = baseline;
    localStorage.setItem('abroad_country_counts', JSON.stringify(baseline));
    renderCountryCounters();
  }

  function renderCountryCounters() {
    const counts = state.countryStudentCounts;
    const total = Object.values(counts).reduce((acc, c) => acc + (parseInt(c, 10) || 0), 0);

    const countAllEl = document.getElementById('countAll');
    const headerTotalEl = document.getElementById('headerTotalStudentsCount');
    const adminTotalEl = document.getElementById('adminVaultTotalCount');
    const adminDevEl = document.getElementById('adminVaultDeviceCount');

    if (countAllEl) countAllEl.textContent = total;
    if (headerTotalEl) headerTotalEl.textContent = total;
    if (adminTotalEl) adminTotalEl.textContent = total;
    if (adminDevEl) adminDevEl.textContent = total;

    const map = {
      'Canada': 'countCanada',
      'UK': 'countUK',
      'USA': 'countUSA',
      'Australia': 'countAus',
      'Germany': 'countGermany'
    };

    Object.entries(map).forEach(([country, elId]) => {
      const el = document.getElementById(elId);
      if (el) el.textContent = counts[country] || 0;
    });

    // Update onboard preview if open
    const onboardSelect = document.getElementById('onboardCountrySelect');
    const onboardCountEl = document.getElementById('onboardSelectedCountryCount');
    if (onboardSelect && onboardCountEl) {
      const selectedVal = onboardSelect.value || 'Canada';
      onboardCountEl.textContent = counts[selectedVal] || 0;
    }

    renderAdminCountryDistro();
  }

  function incrementCountryStudentCount(country) {
    if (!country) return;
    if (!state.countryStudentCounts[country]) {
      state.countryStudentCounts[country] = 100;
    }
    state.countryStudentCounts[country]++;
    localStorage.setItem('abroad_country_counts', JSON.stringify(state.countryStudentCounts));
    renderCountryCounters();
    showToast(`📊 Auto-Updated: ${country} now has ${state.countryStudentCounts[country]} registered students!`);
  }

  function renderAdminCountryDistro() {
    const distroWrap = document.getElementById('adminCountryDistroWrap');
    if (!distroWrap) return;
    const flags = {
      'Canada': '🇨🇦',
      'UK': '🇬🇧',
      'USA': '🇺🇸',
      'Australia': '🇦🇺',
      'Germany': '🇩🇪'
    };
    distroWrap.innerHTML = Object.entries(state.countryStudentCounts).map(([c, count]) => `
      <div class="country-distro-pill">
        <span>${flags[c] || '🌐'} ${c}</span>
        <strong>${count} students</strong>
      </div>
    `).join('');
  }

  // 2. Setup Event Listeners
  function setupEventListeners() {
    // Country Selector Pills
    document.querySelectorAll('.country-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.country-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        state.activeCountry = btn.dataset.country;
        loadData();
      });
    });

    // Main Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });

    // Reviews Search Input
    const searchInput = document.getElementById('reviewSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderReviews();
      });
    }

    // Review Filter Chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.reviewFilter = chip.dataset.filter;
        renderReviews();
      });
    });

    // Chat Message Form
    const chatForm = document.getElementById('chatInputForm');
    const chatInput = document.getElementById('chatMsgInput');
    if (chatForm && chatInput) {
      chatInput.addEventListener('click', () => {
        if (!state.currentUser) {
          window.promptChatLogin();
        }
      });
      chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!state.currentUser) {
          window.promptChatLogin();
          return;
        }
        if (!text || !state.activeChatUser) return;
        chatInput.value = '';
        await handleSendMessage(text);
      });
    }

    // Quick Prompt Chips in Chat
    document.querySelectorAll('.quick-prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (!state.currentUser) {
          window.promptChatLogin();
          return;
        }
        const chatInput = document.getElementById('chatMsgInput');
        if (chatInput) {
          chatInput.value = chip.dataset.prompt;
          chatInput.focus();
        }
      });
    });

    // Google Login Trigger
    document.getElementById('btnHeaderGoogleLogin')?.addEventListener('click', () => openModal('modalGoogleAuth'));

    // Modal Triggers & Hero Buttons
    document.getElementById('btnOpenReviewModal')?.addEventListener('click', () => openModal('modalSubmitReview'));
    document.getElementById('btnHeroReportAgent')?.addEventListener('click', () => openModal('modalSubmitReview'));
    document.getElementById('btnHeroChatSenior')?.addEventListener('click', () => window.goToChatView());
    document.getElementById('btnHeroScanLie')?.addEventListener('click', () => window.switchTabAndScrollScanner());
    document.getElementById('btnHeroCalcCost')?.addEventListener('click', () => window.switchTabAndScrollCostCalc());
    document.getElementById('headerDmBtn')?.addEventListener('click', () => window.goToChatView());
    document.getElementById('userProfilePill')?.addEventListener('click', () => openModal('modalUserProfile'));
    document.getElementById('btnOpenPostModal')?.addEventListener('click', () => openModal('modalSubmitPost'));

    // Modal Close Buttons
    document.querySelectorAll('.modal-close-trigger').forEach(btn => {
      btn.addEventListener('click', () => closeModal());
    });

    // Review Form Submission
    document.getElementById('formAgencyReview')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSubmitReview();
    });

    // User Profile Form
    document.getElementById('formUserProfile')?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSaveProfile();
    });

    // Profile Avatar File Upload & URL changes
    document.getElementById('inputProfileAvatarFile')?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        showToast('⚠️ Please upload an image under 4MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const preview = document.getElementById('userProfileAvatarImg');
        const urlInp = document.getElementById('inputProfileAvatarUrl');
        if (preview) preview.src = dataUrl;
        if (urlInp) urlInp.value = dataUrl;
        showToast('📸 Photo loaded! Click "Save Profile" to apply.');
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('inputProfileAvatarUrl')?.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      const preview = document.getElementById('userProfileAvatarImg');
      if (preview && url) {
        preview.src = url;
      }
    });

    // Global Country Dropdown Selector
    const globalCountrySel = document.getElementById('globalCountryDropdownSelect');
    if (globalCountrySel) {
      globalCountrySel.addEventListener('change', (e) => {
        const country = e.target.value;
        if (country) {
          document.querySelectorAll('.country-pill').forEach(p => p.classList.remove('active'));
          state.activeCountry = country;
          loadData();
          showToast(`Filtered destination: ${country}`);
        }
      });
    }

    // Senior Directory Filters (Country, Course, Keyword)
    document.getElementById('seniorCountryFilter')?.addEventListener('change', (e) => {
      state.seniorCountryFilter = e.target.value;
      renderSeniors();
    });

    document.getElementById('seniorCourseFilter')?.addEventListener('change', (e) => {
      state.seniorCourseFilter = e.target.value;
      renderSeniors();
    });

    document.getElementById('seniorSearchKeyword')?.addEventListener('input', (e) => {
      state.seniorSearchKeyword = e.target.value;
      renderSeniors();
    });

    // Crowdsource Agency Input Enter key
    document.getElementById('crowdsourceAgencyInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.handleCheckOrCreateAgency();
      }
    });

    // Post Question Form
    document.getElementById('formNewPost')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSubmitPost();
    });
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    document.querySelectorAll('.drawer-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-view-content').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabId}`);
    });

    if (tabId === 'chat') {
      updateChatAuthUI();
      if (!state.activeChatUser && state.profiles.length > 0) {
        selectChatUser(state.profiles[0]);
      }
      if (state.currentUser) {
        startChatPolling();
      }
    } else {
      stopChatPolling();
    }
  }

  // 3. Load Data from Supabase
  async function loadData() {
    try {
      // 1. Fetch profiles
      state.profiles = await window.supabaseService.getProfiles(state.activeCountry);
      renderSeniors();
      renderChatSidebar();

      // 2. Fetch reviews
      state.reviews = await window.supabaseService.getAgencyReviews(state.activeCountry);
      renderReviews();

      // 3. Fetch discussions
      state.discussions = await window.supabaseService.getDiscussions(state.activeCountry);
      renderDiscussions();

      // Update counters in tabs & mobile drawer
      const reviewBadge = document.getElementById('countTabReviews');
      if (reviewBadge) reviewBadge.textContent = state.reviews.length;
      const feedBadge = document.getElementById('countTabFeed');
      if (feedBadge) feedBadge.textContent = state.discussions.length;
      const seniorsBadge = document.getElementById('countTabSeniors');
      if (seniorsBadge) seniorsBadge.textContent = state.profiles.length;

      const drawerCountReviews = document.getElementById('drawerCountReviews');
      if (drawerCountReviews) drawerCountReviews.textContent = state.reviews.length;
      const drawerCountFeed = document.getElementById('drawerCountFeed');
      if (drawerCountFeed) drawerCountFeed.textContent = state.discussions.length;
      const drawerCountSeniors = document.getElementById('drawerCountSeniors');
      if (drawerCountSeniors) drawerCountSeniors.textContent = state.profiles.length;

    } catch (err) {
      console.error('Error loading data:', err);
    }
  }

  // 4. Render Reviews (Agent Wall of Truth)
  function renderReviews() {
    const container = document.getElementById('reviewsGrid');
    if (!container) return;

    let list = state.reviews;
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter(r => 
        (r.agency_name && r.agency_name.toLowerCase().includes(q)) ||
        (r.branch_city && r.branch_city.toLowerCase().includes(q)) ||
        (r.treatment_summary && r.treatment_summary.toLowerCase().includes(q))
      );
    }

    if (state.reviewFilter === 'danger') {
      list = list.filter(r => r.rating <= 2);
    } else if (state.reviewFilter === 'safe') {
      list = list.filter(r => r.rating >= 4);
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
          <i class="fa-solid fa-shield-halved" style="font-size: 2.5rem; color: var(--cyan-primary); margin-bottom: 12px;"></i>
          <h3 style="font-family: var(--font-display); font-size: 1.3rem;">No reviews found matching your search</h3>
          <p style="color: var(--text-secondary); margin: 8px 0 16px;">Be the first student to review your consultancy and protect upcoming batches!</p>
          <button class="btn-primary" onclick="document.getElementById('btnOpenReviewModal').click()">
            <i class="fa-solid fa-plus"></i> Submit Agency Review
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(r => {
      const isDanger = r.rating <= 2;
      const ratingStars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      const flagEmoji = getCountryFlag(r.destination_country);

      return `
        <article class="review-card ${isDanger ? 'danger-rated' : 'safe-rated'}">
          <div class="review-header">
            <div class="agency-info">
              <h3 class="agency-name-title">
                ${r.agency_name}
                ${isDanger ? '<i class="fa-solid fa-triangle-exclamation" style="color: var(--red-danger); font-size: 0.9rem;" title="Flagged Agency"></i>' : '<i class="fa-solid fa-circle-check" style="color: var(--emerald-safe); font-size: 0.9rem;" title="Verified Clean"></i>'}
              </h3>
              <div class="agency-city-badge">
                <i class="fa-solid fa-location-dot"></i> ${r.branch_city || 'India'} &nbsp;•&nbsp; ${flagEmoji} Target: ${r.destination_country}
              </div>
            </div>
            <div class="rating-badge-pill ${isDanger ? 'danger' : 'success'}">
              <span>${ratingStars}</span> (${r.rating}/5)
            </div>
          </div>

          <div class="treatment-headline">
            "${r.treatment_summary}"
          </div>

          <div class="comparison-box">
            <div class="compare-row">
              <span class="compare-label promised">
                <i class="fa-solid fa-bullhorn"></i> What Agent Claimed / Promised:
              </span>
              <p class="compare-text">${r.what_they_promised || 'N/A'}</p>
            </div>
            <div class="compare-row" style="margin-top: 6px;">
              <span class="compare-label actual">
                <i class="fa-solid fa-skull-crossbones"></i> Ground Reality / What Actually Happened:
              </span>
              <p class="compare-text">${r.what_actually_happened || 'N/A'}</p>
            </div>
          </div>

          ${r.hidden_charges_taken && r.hidden_charges_taken !== 'None reported' ? `
            <div class="alert-strip hidden-fee">
              <i class="fa-solid fa-wallet" style="margin-top: 2px;"></i>
              <div><strong>Hidden Fee Extorted:</strong> ${r.hidden_charges_taken}</div>
            </div>
          ` : ''}

          ${r.threat_or_pressure && r.threat_or_pressure !== 'None reported' ? `
            <div class="alert-strip threat">
              <i class="fa-solid fa-hand-fist" style="margin-top: 2px;"></i>
              <div><strong>Threat / Pressure Tactic:</strong> ${r.threat_or_pressure}</div>
            </div>
          ` : ''}

          <div class="review-footer">
            <div class="student-author">
              <i class="fa-solid fa-user-shield"></i>
              <div>
                <span>Shared by <span class="author-handle-tag">@${escapeHtml(r.student_handle || 'verified_senior')}</span></span>
                ${(r.college || r.course || r.place) ? `
                  <div style="font-size: 0.73rem; color: var(--text-muted); margin-top: 2px;">
                    ${r.college ? `🏛️ ${escapeHtml(r.college)}` : ''} 
                    ${r.course ? `• 🎓 ${escapeHtml(r.course)}` : ''} 
                    ${r.place ? `• 📍 ${escapeHtml(r.place)}` : ''}
                  </div>
                ` : ''}
              </div>
            </div>
            <button class="like-btn" onclick="window.handleLikeReview('${r.id}', ${r.likes_count || 0})">
              <i class="fa-regular fa-thumbs-up"></i> Helpful (${r.likes_count || 0})
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  // Like Review Global Handler
  window.handleLikeReview = async (reviewId, count) => {
    const updatedCount = await window.supabaseService.likeReview(reviewId, count);
    const target = state.reviews.find(r => r.id === reviewId);
    if (target) target.likes_count = updatedCount;
    renderReviews();
    showToast('Marked as helpful feedback!');
  };

  // Helper for Global Country Flags
  function getCountryFlag(country) {
    const flags = {
      'Canada': '🇨🇦', 'UK': '🇬🇧', 'USA': '🇺🇸', 'Australia': '🇦🇺', 'Germany': '🇩🇪',
      'Ireland': '🇮🇪', 'France': '🇫🇷', 'Netherlands': '🇳🇱', 'Sweden': '🇸🇪', 'New Zealand': '🇳🇿',
      'Singapore': '🇸🇬', 'Italy': '🇮🇹', 'Spain': '🇪🇸', 'Switzerland': '🇨🇭', 'UAE': '🇦🇪',
      'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Poland': '🇵🇱', 'Finland': '🇫🇮', 'Norway': '🇳🇴',
      'Denmark': '🇩🇰', 'Malaysia': '🇲🇾', 'Austria': '🇦🇹', 'Belgium': '🇧🇪', 'Czech Republic': '🇨🇿',
      'Hungary': '🇭🇺', 'Cyprus': '🇨🇾', 'Malta': '🇲🇹', 'Lithuania': '🇱🇹', 'Latvia': '🇱🇻',
      'Estonia': '🇪🇪', 'Georgia': '🇬🇪', 'Philippines': '🇵🇭'
    };
    return flags[country] || '🌍';
  }

  // 5. Render Instagram-Style Direct Messaging
  function renderChatSidebar() {
    const listEl = document.getElementById('chatThreadsList');
    if (!listEl) return;

    // Filter count synchronization
    const allCountEl = document.getElementById('chatCountAll');
    const friendsCountEl = document.getElementById('chatCountFriends');
    const friendsOnly = state.profiles.filter(p => window.isFriend(p.id));
    if (allCountEl) allCountEl.textContent = state.profiles.length;
    if (friendsCountEl) friendsCountEl.textContent = friendsOnly.length;

    let list = state.chatFilter === 'friends' ? friendsOnly : state.profiles;

    if (list.length === 0) {
      if (state.chatFilter === 'friends') {
        listEl.innerHTML = `
          <li style="padding: 24px 18px; text-align: center; color: var(--text-secondary); font-size: 0.85rem;">
            <i class="fa-solid fa-user-group" style="font-size: 1.8rem; color: #f472b6; margin-bottom: 8px; display: block;"></i>
            <strong>No Friends Added Yet</strong>
            <p style="margin-top: 6px; font-size: 0.78rem; color: var(--text-muted);">
              Switch to "All Mentors" and click "+ Add Friend" on seniors to add them to your friends list!
            </p>
          </li>
        `;
      } else {
        listEl.innerHTML = '<li style="padding: 20px; color: var(--text-muted); font-size: 0.85rem;">No seniors found for this country yet.</li>';
      }
      return;
    }

    listEl.innerHTML = list.map(p => {
      const isActive = state.activeChatUser && state.activeChatUser.id === p.id;
      const flagEmoji = getCountryFlag(p.destination_country);
      const userHandle = '@' + (p.username || p.display_name.replace('@', ''));
      const isF = window.isFriend(p.id);

      return `
        <li class="chat-thread-item ${isActive ? 'active' : ''}" onclick="window.selectChatUserById('${p.id}')">
          <div class="thread-avatar-wrap">
            <img class="thread-avatar" src="${p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" alt="${userHandle}">
            <div class="online-dot"></div>
          </div>
          <div class="thread-content">
            <div class="thread-top">
              <span class="thread-name">
                ${userHandle} ${flagEmoji}
                ${isF ? '<span class="friend-badge-pill"><i class="fa-solid fa-heart"></i> Friend</span>' : ''}
              </span>
              <span class="thread-time">${p.city || p.place || ''}</span>
            </div>
            <div class="thread-preview">${p.current_university || p.college || ''} • ${p.course ? p.course.substring(0, 22) + '...' : ''}</div>
          </div>
        </li>
      `;
    }).join('');
  }

  window.selectChatUserById = (userId) => {
    const user = state.profiles.find(p => p.id === userId);
    if (user) selectChatUser(user);
  };

  async function selectChatUser(user) {
    state.activeChatUser = user;
    renderChatSidebar();

    // Update active user header (Privacy-guaranteed: No real names!)
    const flagEmoji = getCountryFlag(user.destination_country);
    const userHandle = '@' + (user.username || user.display_name.replace('@', ''));

    const avatarEl = document.getElementById('activeChatAvatar');
    if (avatarEl) avatarEl.src = user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    const nameEl = document.getElementById('activeChatName');
    if (nameEl) nameEl.textContent = userHandle;
    const subEl = document.getElementById('activeChatSub');
    if (subEl) subEl.textContent = `${flagEmoji} ${user.current_university || user.college || 'University'} • ${user.course || 'Degree Program'} • ${user.city || user.place || ''}`;

    updateActiveChatFriendUI();
    updateChatAuthUI();

    // Public WhatsApp action button if senior enabled public phone
    const waBtn = document.getElementById('btnChatHeaderWhatsApp');
    const waBtnText = document.getElementById('btnChatHeaderWhatsAppText');
    const cleanPhone = (user.mobile_number || '').replace(/[^0-9]/g, '');
    if (user.share_phone_publicly && cleanPhone.length >= 7) {
      if (waBtn) {
        waBtn.style.display = 'inline-flex';
        waBtn.href = `https://wa.me/${cleanPhone}`;
        if (waBtnText) waBtnText.textContent = `WhatsApp (${user.mobile_number})`;
      }
    } else {
      if (waBtn) waBtn.style.display = 'none';
    }

    if (!state.currentUser) {
      const scrollArea = document.getElementById('messagesScrollArea');
      if (scrollArea) {
        scrollArea.innerHTML = `
          <div style="text-align: center; margin: auto 0; padding: 24px;">
            <img src="${user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" style="width: 76px; height: 76px; border-radius: var(--radius-full); border: 2.5px solid var(--cyan-primary); margin-bottom: 12px; box-shadow: 0 4px 18px var(--cyan-glow);">
            <h4 style="font-family: var(--font-display); font-size: 1.25rem; color: var(--text-main); margin-bottom: 6px;">Chat &amp; Make Friends with ${userHandle}</h4>
            <p style="color: var(--text-secondary); font-size: 0.88rem; max-width: 480px; margin: 0 auto 18px; line-height: 1.5;">
              Verified Senior at <strong>${escapeHtml(user.current_university || user.college || 'University')}</strong> in ${escapeHtml(user.city || user.destination_country)}.
              Sign in with Google to message each other, ask about living costs, and become friends!
            </p>
            <button class="chat-guest-login-btn" type="button" onclick="window.promptChatLogin()" style="margin: 0 auto;">
              <i class="fa-brands fa-google"></i> Sign In to Message &amp; Make Friends
            </button>
          </div>
        `;
      }
      return;
    }

    await loadChatMessages();
  }

  async function loadChatMessages() {
    if (!state.activeChatUser) return;
    if (!state.currentUser) return;
    const scrollArea = document.getElementById('messagesScrollArea');
    if (!scrollArea) return;
    
    // Fetch messages between current user and senior/friend
    state.chatMessages = await window.supabaseService.getDirectMessages(state.currentUser.id, state.activeChatUser.id);
    
    const isF = window.isFriend(state.activeChatUser.id);
    const activeHandle = '@' + (state.activeChatUser.username || state.activeChatUser.display_name.replace('@', ''));

    // If no messages yet, provide a welcoming senior prompt
    if (state.chatMessages.length === 0) {
      scrollArea.innerHTML = `
        <div style="text-align: center; margin: auto 0; padding: 20px;">
          <img src="${state.activeChatUser.avatar_url}" style="width: 70px; height: 70px; border-radius: var(--radius-full); border: 2px solid var(--cyan-primary); margin-bottom: 12px;">
          <h4 style="font-family: var(--font-display); font-size: 1.15rem; color: var(--text-main);">
            Start a direct chat with ${activeHandle} ${isF ? '<span class="friend-badge-pill"><i class="fa-solid fa-heart"></i> Friend</span>' : ''}
          </h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; max-width: 440px; margin: 8px auto 16px;">
            Ask about ground realities with consultancies, part-time jobs in ${state.activeChatUser.city || 'campus'}, or actual rent expenses. No phone numbers are shared!
          </p>
        </div>
      `;
      return;
    }

    scrollArea.innerHTML = state.chatMessages.map(m => {
      const isSent = m.sender_id === state.currentUser.id;
      const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';

      return `
        <div class="chat-bubble-row ${isSent ? 'sent' : 'received'}">
          <div class="chat-bubble">${escapeHtml(m.message)}</div>
          <div class="bubble-meta">
            ${timeStr} ${isSent ? ' • Delivered <i class="fa-solid fa-check-double" style="color: #67e8f9;"></i>' : ''}
          </div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    scrollArea.scrollTop = scrollArea.scrollHeight;
  }

  async function handleSendMessage(text) {
    if (!state.currentUser) {
      window.promptChatLogin();
      return;
    }
    if (!state.activeChatUser) return;
    const newMsg = await window.supabaseService.sendDirectMessage(
      state.currentUser.id,
      state.activeChatUser.id,
      text
    );
    await loadChatMessages();

    // Natural Friend & Senior Interactive Messaging response
    triggerSeniorFriendReply(state.activeChatUser, text);
  }

  function triggerSeniorFriendReply(senior, userText) {
    setTimeout(async () => {
      if (!state.currentUser) return;
      const isF = window.isFriend(senior.id);
      const textLower = (userText || '').toLowerCase();
      let reply = '';

      if (textLower.includes('job') || textLower.includes('work') || textLower.includes('earn')) {
        reply = `Hey @${state.currentUser.username}! Real talk on jobs in ${senior.city || senior.destination_country}: Consultants promise you will get a job on day 1—that's false. It takes about 6-8 weeks of active networking. Make sure your SIN/BRP is ready and don't pay any agent job-placement fee!`;
      } else if (textLower.includes('rent') || textLower.includes('room') || textLower.includes('cost') || textLower.includes('expense')) {
        reply = `Rent here in ${senior.city || senior.destination_country} is around ${senior.destination_country === 'UK' ? '£650-£850' : (senior.destination_country === 'Germany' ? '€450-€600' : '$800-$950')} for a shared room. Agents quote $400, but that is impossible unless you live 2 hours outside town. Always check local listings yourself!`;
      } else if (textLower.includes('agent') || textLower.includes('fee') || textLower.includes('consultant') || textLower.includes('file')) {
        reply = `Never hand over your original passport or marksheets! And never pay ₹50k-₹1.5L for 'embassy file opening'. University applications can be done directly or through free official partner channels. Demand your student portal login credentials!`;
      } else if (isF) {
        reply = `Hey friend @${state.currentUser.username}! So happy we connected on AbroadShield! I'm studying ${senior.course || 'here'} at ${senior.current_university || senior.college || 'university'}. Feel free to message me anytime if you want honest advice about ground reality here.`;
      } else {
        reply = `Hey @${state.currentUser.username}! Thanks for reaching out. Ground reality here at ${senior.current_university || senior.college || 'campus'} is totally different from what consultants advertise in India. Click "+ Add Friend" above so we can stay connected!`;
      }

      await window.supabaseService.sendDirectMessage(senior.id, state.currentUser.id, reply);
      await loadChatMessages();
      showToast(`💬 New message from ${senior.display_name}!`);
    }, 1200);
  }

  function startChatPolling() {
    stopChatPolling();
    state.messagePollInterval = setInterval(() => {
      if (state.activeTab === 'chat' && state.activeChatUser) {
        loadChatMessages();
      }
    }, 4500);
  }

  function stopChatPolling() {
    if (state.messagePollInterval) {
      clearInterval(state.messagePollInterval);
      state.messagePollInterval = null;
    }
  }

  // 6. Render Discussions (Senior Q&A Club Feed)
  function renderDiscussions() {
    const container = document.getElementById('discussionsList');
    if (!container) return;

    if (state.discussions.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
          <i class="fa-solid fa-comments" style="font-size: 2.5rem; color: var(--cyan-primary); margin-bottom: 12px;"></i>
          <h3 style="font-family: var(--font-display); font-size: 1.3rem;">No community posts in this country yet</h3>
          <p style="color: var(--text-secondary); margin: 8px 0 16px;">Have a question about visa, part-time jobs, or agents? Ask the club!</p>
          <button class="btn-primary" onclick="document.getElementById('btnOpenPostModal').click()">
            <i class="fa-solid fa-pen-to-square"></i> Ask a Question
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = state.discussions.map(p => {
      const flagEmoji = getCountryFlag(p.country);
      const userHandle = '@' + (p.author_handle || 'verified_student');

      return `
        <article class="post-card">
          <div class="post-header">
            <div class="post-author-row">
              <img class="post-author-avatar" src="${p.author_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" alt="${userHandle}">
              <div class="post-author-meta">
                <span class="post-author-name">${userHandle}</span>
                <span class="post-author-role">${escapeHtml(p.author_role || 'Senior Student')}</span>
              </div>
            </div>
            <span class="post-country-badge">${flagEmoji} ${p.country} &nbsp;•&nbsp; ${p.category}</span>
          </div>

          <h3 class="post-title">${p.title}</h3>
          <div class="post-body">${escapeHtml(p.content)}</div>

          ${p.tags && p.tags.length > 0 ? `
            <div class="post-tags">
              ${p.tags.map(t => `<span class="post-tag">#${t}</span>`).join('')}
            </div>
          ` : ''}

          <div class="post-footer-actions">
            <button class="upvote-btn" onclick="window.handleUpvotePost('${p.id}', ${p.upvotes || 0})">
              <i class="fa-solid fa-arrow-up"></i> Upvote (${p.upvotes || 0})
            </button>
            <button class="btn-secondary" style="font-size: 0.8rem; padding: 6px 14px;" onclick="window.triggerChatWithAuthor('${p.author_id}')">
              <i class="fa-solid fa-comment-dots"></i> Message Senior
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  window.handleUpvotePost = async (postId, current) => {
    const updated = await window.supabaseService.upvoteDiscussion(postId, current);
    const post = state.discussions.find(d => d.id === postId);
    if (post) post.upvotes = updated;
    renderDiscussions();
    showToast('Upvoted senior post!');
  };

  window.triggerChatWithAuthor = (authorId) => {
    if (!state.currentUser) {
      requireAuthForChat(authorId);
      return;
    }
    const senior = state.profiles.find(p => p.id === authorId);
    if (senior) {
      switchTab('chat');
      selectChatUser(senior);
    } else {
      switchTab('chat');
    }
  };

  // 7. Render Senior Directory (Filtered by Country & Course with Strict Privacy)
  function renderSeniors() {
    const container = document.getElementById('seniorsGrid');
    if (!container) return;

    let list = state.profiles;

    // Filter by Country
    if (state.seniorCountryFilter && state.seniorCountryFilter !== 'All') {
      list = list.filter(p => p.destination_country === state.seniorCountryFilter);
    }

    // Filter by Course / Program
    if (state.seniorCourseFilter && state.seniorCourseFilter !== 'All') {
      const courseQuery = state.seniorCourseFilter.toLowerCase();
      list = list.filter(p => {
        const c = (p.course || '').toLowerCase();
        return c.includes(courseQuery) || 
               (courseQuery.includes('computer') && (c.includes('software') || c.includes('cs') || c.includes('computing'))) ||
               (courseQuery.includes('data') && (c.includes('analytics') || c.includes('ai') || c.includes('intelligence'))) ||
               (courseQuery.includes('cloud') && (c.includes('devops') || c.includes('cloud') || c.includes('infrastructure'))) ||
               (courseQuery.includes('business') && (c.includes('management') || c.includes('mba') || c.includes('commerce'))) ||
               (courseQuery.includes('information') && (c.includes('it') || c.includes('security') || c.includes('cyber'))) ||
               (courseQuery.includes('engineering') && (c.includes('engineer') || c.includes('robotics') || c.includes('embedded')));
      });
    }

    // Filter by Search Keyword
    if (state.seniorSearchKeyword && state.seniorSearchKeyword.trim() !== '') {
      const q = state.seniorSearchKeyword.toLowerCase().trim();
      list = list.filter(p => 
        (p.username && p.username.toLowerCase().includes(q)) ||
        (p.current_university && p.current_university.toLowerCase().includes(q)) ||
        (p.college && p.college.toLowerCase().includes(q)) ||
        (p.course && p.course.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.place && p.place.toLowerCase().includes(q)) ||
        (p.bio && p.bio.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
          <i class="fa-solid fa-user-graduate" style="font-size: 2.5rem; color: var(--cyan-primary); margin-bottom: 12px;"></i>
          <h3 style="font-family: var(--font-display); font-size: 1.3rem;">No seniors found for this combination</h3>
          <p style="color: var(--text-secondary); margin: 8px 0 16px;">
            No verified seniors matched country <strong>"${escapeHtml(state.seniorCountryFilter)}"</strong> and course <strong>"${escapeHtml(state.seniorCourseFilter)}"</strong>.
          </p>
          <button class="btn-secondary" onclick="window.resetSeniorFilters()">
            <i class="fa-solid fa-rotate-left"></i> Reset Senior Filters
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(p => {
      const flagEmoji = getCountryFlag(p.destination_country);
      const userHandle = '@' + (p.username || p.display_name.replace('@', ''));
      const collegeName = p.current_university || p.college || 'University Abroad';
      const courseName = p.course || 'Master / Post-Grad Program';
      const placeName = p.place || p.city || 'Campus City';

      return `
        <div class="senior-profile-card">
          <div class="senior-avatar-row">
            <img class="senior-card-avatar" src="${p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" alt="${userHandle}">
            <div class="senior-names">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="verified-handle-badge">${userHandle}</span>
                <span style="font-size: 0.72rem; color: var(--emerald-safe); font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Verified</span>
              </div>
              <span class="senior-uni" style="margin-top: 4px;">${flagEmoji} ${p.destination_country}</span>
            </div>
          </div>

          <!-- Strict Privacy: College, Course, and Place -->
          <div class="senior-detail-chips">
            <div class="senior-chip-item">
              <i class="fa-solid fa-building-columns"></i>
              <span>College: <strong>${escapeHtml(collegeName)}</strong></span>
            </div>
            <div class="senior-chip-item">
              <i class="fa-solid fa-graduation-cap"></i>
              <span>Course: <strong>${escapeHtml(courseName)}</strong></span>
            </div>
            <div class="senior-chip-item">
              <i class="fa-solid fa-location-dot"></i>
              <span>Place: <strong>${escapeHtml(placeName)}</strong> (Intake: ${escapeHtml(p.intake_year || 'Current')})</span>
            </div>
          </div>

          <div class="senior-bio">
            "${escapeHtml(p.bio || 'Currently studying here. Happy to help genuine incoming students!')}"
          </div>

          <div class="senior-meta-tags">
            <span class="meta-chip">Agent: ${escapeHtml(p.agent_used || 'Self-Applied')}</span>
            <span class="meta-chip"><i class="fa-solid fa-lock"></i> Real Name Hidden</span>
            ${(p.share_phone_publicly && (p.mobile_number || '').replace(/[^0-9]/g, '').length >= 7) ? `
              <a href="https://wa.me/${p.mobile_number.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener noreferrer" class="senior-public-phone-pill" title="WhatsApp this Senior">
                <i class="fa-brands fa-whatsapp"></i> ${escapeHtml(p.mobile_number)}
              </a>
            ` : `
              <span class="meta-chip"><i class="fa-solid fa-phone-slash"></i> Phone Kept Private</span>
            `}
          </div>

          <div class="senior-actions">
            <button class="btn-primary btn-chat-senior" type="button" onclick="window.startDmWithSenior('${p.id}')">
              <i class="fa-regular fa-paper-plane"></i> Chat with Senior (${userHandle})
            </button>
            ${(p.share_phone_publicly && (p.mobile_number || '').replace(/[^0-9]/g, '').length >= 7) ? `
              <a href="https://wa.me/${p.mobile_number.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-senior" title="Connect directly on WhatsApp">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
              </a>
            ` : ''}
            <button class="btn-secondary btn-friend-card ${window.isFriend(p.id) ? 'is-friend' : ''}" type="button" onclick="window.toggleFriendship('${p.id}')">
              ${window.isFriend(p.id) ? '<i class="fa-solid fa-user-check"></i> Friends 🤝' : '<i class="fa-solid fa-user-plus"></i> Add Friend'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.resetSeniorFilters = () => {
    state.seniorCountryFilter = 'All';
    state.seniorCourseFilter = 'All';
    state.seniorSearchKeyword = '';
    const cSel = document.getElementById('seniorCountryFilter');
    if (cSel) cSel.value = 'All';
    const crSel = document.getElementById('seniorCourseFilter');
    if (crSel) crSel.value = 'All';
    const kw = document.getElementById('seniorSearchKeyword');
    if (kw) kw.value = '';
    renderSeniors();
  };

  window.startDmWithSenior = (seniorId) => {
    const senior = state.profiles.find(p => p.id === seniorId);
    switchTab('chat');
    if (senior) {
      selectChatUser(senior);
    }
    const chatSec = document.getElementById('view-chat');
    if (chatSec) {
      chatSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (!state.currentUser) {
      state.pendingChatSeniorId = seniorId;
      showToast(`💬 Previewing chat with @${senior ? (senior.username || senior.display_name) : 'senior'}. Sign in with Google to send messages & make friends!`);
    }
  };

  // 8. Lie Scanner (Interactive Checklist & Dynamic Meter)
  function setupLieScanner() {
    const checkboxes = document.querySelectorAll('.scanner-checkbox');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', calculateLieScore);
    });
    calculateLieScore();
  }

  function calculateLieScore() {
    const checkboxes = document.querySelectorAll('.scanner-checkbox');
    let totalScore = 0;
    let checkedCount = 0;

    checkboxes.forEach(cb => {
      if (cb.checked) {
        totalScore += parseInt(cb.dataset.weight, 10);
        checkedCount++;
      }
    });

    const scoreNum = document.getElementById('scannerScoreNum');
    const barFill = document.getElementById('scannerBarFill');
    const verdictEl = document.getElementById('scannerVerdict');
    const adviceEl = document.getElementById('scannerAdvice');

    if (!scoreNum || !barFill) return;

    // Cap at 100%
    const finalScore = Math.min(totalScore, 100);
    scoreNum.textContent = `${finalScore}%`;
    barFill.style.width = `${finalScore}%`;

    scoreNum.className = 'meter-score-num';
    if (finalScore >= 60) {
      scoreNum.classList.add('danger');
      barFill.style.backgroundColor = 'var(--red-danger)';
      if (verdictEl) verdictEl.innerHTML = `<span style="color: var(--red-danger);"><i class="fa-solid fa-skull-crossbones"></i> CRITICAL SCAM RISK: DO NOT PAY!</span>`;
      if (adviceEl) adviceEl.textContent = `Your agent is using 3 or more aggressive high-risk tactics. Withholding documents or promising guaranteed jobs are illegal red flags. Take your documents back immediately and self-apply.`;
    } else if (finalScore >= 25) {
      scoreNum.classList.add('warn');
      barFill.style.backgroundColor = 'var(--amber-warning)';
      if (verdictEl) verdictEl.innerHTML = `<span style="color: var(--amber-warning);"><i class="fa-solid fa-triangle-exclamation"></i> MODERATE RISK: HIGH COMMISSION PUSH</span>`;
      if (adviceEl) adviceEl.textContent = `The agent is likely steering you towards high-commission private colleges and understating true cost of living. Verify everything directly on university websites.`;
    } else {
      scoreNum.classList.add('safe');
      barFill.style.backgroundColor = 'var(--emerald-safe)';
      if (verdictEl) verdictEl.innerHTML = `<span style="color: var(--emerald-safe);"><i class="fa-solid fa-circle-check"></i> LOW RISK / NORMAL PROCESS</span>`;
      if (adviceEl) adviceEl.textContent = `No major malicious red flags detected. Still ensure you maintain your own university portal login and never surrender original passports.`;
    }
  }

  // 9. Cost of Living Reality Calculator
  function setupCostCalculator() {
    const citySelect = document.getElementById('calcCitySelect');
    const rentSlider = document.getElementById('calcRentSlider');
    const foodSlider = document.getElementById('calcFoodSlider');
    const transitSlider = document.getElementById('calcTransitSlider');
    const otherSlider = document.getElementById('calcOtherSlider');
    const currencyToggle = document.getElementById('calcCurrencyToggle');

    if (citySelect) {
      citySelect.addEventListener('change', () => {
        const preset = CITY_COST_PRESETS[citySelect.value];
        if (preset) {
          if (rentSlider) rentSlider.value = preset.rentReal;
          if (foodSlider) foodSlider.value = preset.foodReal;
          if (transitSlider) transitSlider.value = preset.transitReal;
          if (otherSlider) otherSlider.value = preset.otherReal;
          recalculateCosts();
        }
      });
    }

    [rentSlider, foodSlider, transitSlider, otherSlider].forEach(slider => {
      if (slider) slider.addEventListener('input', recalculateCosts);
    });

    if (currencyToggle) {
      currencyToggle.addEventListener('change', recalculateCosts);
    }

    recalculateCosts();
  }

  function recalculateCosts() {
    const citySelect = document.getElementById('calcCitySelect');
    const rentSlider = document.getElementById('calcRentSlider');
    const foodSlider = document.getElementById('calcFoodSlider');
    const transitSlider = document.getElementById('calcTransitSlider');
    const otherSlider = document.getElementById('calcOtherSlider');
    const currencyToggle = document.getElementById('calcCurrencyToggle');

    if (!citySelect || !rentSlider) return;

    const selectedCity = citySelect.value;
    const preset = CITY_COST_PRESETS[selectedCity] || CITY_COST_PRESETS['Toronto'];
    const fx = FX_RATES[preset.country] || { symbol: '$', toInr: 60 };

    const rent = parseInt(rentSlider.value, 10);
    const food = parseInt(foodSlider.value, 10);
    const transit = parseInt(transitSlider.value, 10);
    const other = parseInt(otherSlider.value, 10);

    const totalReal = rent + food + transit + other;
    const totalAgent = preset.rentAgent + preset.foodAgent + preset.transitAgent + preset.otherAgent;
    const gap = totalReal - totalAgent;

    // Update labels
    document.getElementById('lblRentVal').textContent = `${fx.symbol}${rent}`;
    document.getElementById('lblFoodVal').textContent = `${fx.symbol}${food}`;
    document.getElementById('lblTransitVal').textContent = `${fx.symbol}${transit}`;
    document.getElementById('lblOtherVal').textContent = `${fx.symbol}${other}`;

    const isINR = currencyToggle && currencyToggle.checked;

    const formatVal = (amt) => {
      if (isINR) {
        const inr = Math.round(amt * fx.toInr);
        return `₹${inr.toLocaleString('en-IN')}`;
      }
      return `${fx.symbol}${amt.toLocaleString()}`;
    };

    document.getElementById('costAgentClaim').textContent = `${formatVal(totalAgent)}/mo`;
    document.getElementById('costGroundReal').textContent = `${formatVal(totalReal)}/mo`;
    document.getElementById('costGapNotice').textContent = `⚠️ Hidden Monthly Deficit: ${formatVal(gap)} not mentioned in agent brochures!`;
  }

  // 10. Review Submission Handler
  async function handleSubmitReview() {
    const agencyName = document.getElementById('formAgencyName').value;
    const branchCity = document.getElementById('formBranchCity').value;
    const country = document.getElementById('formDestCountry').value;
    const rating = document.getElementById('formRating').value;
    const summary = document.getElementById('formTreatmentSummary').value;
    const promised = document.getElementById('formPromised').value;
    const actual = document.getElementById('formActuallyHappened').value;
    const hiddenFee = document.getElementById('formHiddenCharges').value;
    const threat = document.getElementById('formThreats').value;
    const isAnon = document.getElementById('formIsAnonymous').checked;

    const payload = {
      agency_name: agencyName,
      branch_city: branchCity,
      student_id: state.currentUser.id,
      student_name: isAnon ? 'Anonymous Senior' : state.currentUser.display_name,
      student_handle: isAnon ? 'anonymous' : state.currentUser.username,
      is_anonymous: isAnon,
      destination_country: country,
      rating: rating,
      treatment_summary: summary,
      what_they_promised: promised,
      what_actually_happened: actual,
      hidden_charges_taken: hiddenFee,
      threat_or_pressure: threat,
      recommended: parseInt(rating, 10) >= 3
    };

    const newReview = await window.supabaseService.submitAgencyReview(payload);
    state.reviews.unshift(newReview);
    renderReviews();
    closeModal();
    showToast('Your honest agency review has been published!');
  }

  // 11. Profile Edit & Privacy Management Handler
  window.populateUserProfileModal = () => {
    if (!state.currentUser) return;
    const u = state.currentUser;

    const preview = document.getElementById('userProfileAvatarImg');
    const urlInp = document.getElementById('inputProfileAvatarUrl');
    const userInp = document.getElementById('inputUsername');
    const dispInp = document.getElementById('inputDisplayName');
    const countrySel = document.getElementById('inputTargetCountry');
    const roleSel = document.getElementById('inputUserRole');
    const collegeInp = document.getElementById('inputUserCollege');
    const placeInp = document.getElementById('inputUserPlace');
    const courseInp = document.getElementById('inputUserCourse');
    const mobileInp = document.getElementById('inputUserMobile');
    const sharePhoneCheck = document.getElementById('checkSharePhonePublicly');

    if (preview) preview.src = u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    if (urlInp) urlInp.value = u.avatar_url || '';
    if (userInp) userInp.value = u.username || '';
    if (dispInp) dispInp.value = u.display_name || '';
    if (countrySel && u.destination_country) countrySel.value = u.destination_country;
    if (roleSel && u.role) roleSel.value = u.role;
    if (collegeInp) collegeInp.value = u.college || u.current_university || '';
    if (placeInp) placeInp.value = u.place || u.city || '';
    if (courseInp) courseInp.value = u.course || '';
    if (mobileInp) mobileInp.value = u.mobile_number || '';
    if (sharePhoneCheck) {
      sharePhoneCheck.checked = !!u.share_phone_publicly;
      window.updatePhonePrivacyUI(!!u.share_phone_publicly);
    }
  };

  window.pickProfileAvatarPreset = (url) => {
    const preview = document.getElementById('userProfileAvatarImg');
    const urlInp = document.getElementById('inputProfileAvatarUrl');
    if (preview) preview.src = url;
    if (urlInp) urlInp.value = url;
    showToast('Avatar preset selected! Click "Save Profile" to update.');
  };

  window.handlePhonePrivacyToggle = () => {
    const isChecked = document.getElementById('checkSharePhonePublicly')?.checked;
    window.updatePhonePrivacyUI(isChecked);
  };

  window.updatePhonePrivacyUI = (isPublic) => {
    const badge = document.getElementById('badgePhonePrivacyStatus');
    const card = document.querySelector('.privacy-toggle-card');
    const title = document.getElementById('togglePhonePrivacyTitle');
    const desc = document.getElementById('togglePhonePrivacyDesc');

    if (isPublic) {
      if (badge) {
        badge.className = 'privacy-status-badge public';
        badge.innerHTML = '<i class="fa-solid fa-globe"></i> Publicly Shared';
      }
      if (card) card.classList.add('is-public');
      if (title) title.innerHTML = '🌐 Mobile Number Publicly Shared with Students';
      if (desc) desc.textContent = 'Visible on your mentor profile & card with WhatsApp click-to-chat enabled.';
    } else {
      if (badge) {
        badge.className = 'privacy-status-badge private';
        badge.innerHTML = '<i class="fa-solid fa-lock"></i> Strictly Private';
      }
      if (card) card.classList.remove('is-public');
      if (title) title.innerHTML = '🔒 Share Mobile Number Publicly on AbroadShield';
      if (desc) desc.textContent = 'OFF by default. Turn ON only if you want students to view your number and reach you directly on WhatsApp.';
    }
  };

  function handleSaveProfile() {
    if (!state.currentUser) return;

    const handle = document.getElementById('inputUsername')?.value.replace(/[^a-zA-Z0-9_]/g, '') || state.currentUser.username;
    const dispName = document.getElementById('inputDisplayName')?.value.trim() || state.currentUser.display_name;
    const country = document.getElementById('inputTargetCountry')?.value || state.currentUser.destination_country;
    const role = document.getElementById('inputUserRole')?.value || state.currentUser.role;
    const avatarUrl = document.getElementById('inputProfileAvatarUrl')?.value.trim() || document.getElementById('userProfileAvatarImg')?.src || state.currentUser.avatar_url;
    const college = document.getElementById('inputUserCollege')?.value.trim() || '';
    const place = document.getElementById('inputUserPlace')?.value.trim() || '';
    const course = document.getElementById('inputUserCourse')?.value.trim() || '';
    const mobile = document.getElementById('inputUserMobile')?.value.trim() || '';
    const sharePublicly = document.getElementById('checkSharePhonePublicly')?.checked || false;

    if (sharePublicly && !mobile) {
      showToast('⚠️ Please enter your mobile number if you want to share it publicly.');
      document.getElementById('inputUserMobile')?.focus();
      return;
    }

    state.currentUser.username = handle;
    state.currentUser.display_name = dispName;
    state.currentUser.destination_country = country;
    state.currentUser.role = role;
    state.currentUser.avatar_url = avatarUrl;
    state.currentUser.college = college;
    state.currentUser.current_university = college;
    state.currentUser.place = place;
    state.currentUser.city = place;
    state.currentUser.course = course;
    state.currentUser.mobile_number = mobile;
    state.currentUser.share_phone_publicly = sharePublicly;

    localStorage.setItem('abroad_shield_user', JSON.stringify(state.currentUser));

    // Update Confidential Admin Vault (Admin eyes only)
    if (window.securityService) {
      window.securityService.recordStudentVerification({
        id: state.currentUser.id,
        username: handle,
        realName: state.currentUser.real_name || dispName,
        email: state.currentUser.email,
        country: country,
        university: college,
        mobileNumber: mobile,
        sharePhonePublicly: sharePublicly
      });
    }

    // Update profile in state.profiles if current user is listed
    const myProfileIdx = state.profiles.findIndex(p => p.id === state.currentUser.id || p.username === state.currentUser.username);
    if (myProfileIdx >= 0) {
      state.profiles[myProfileIdx] = {
        ...state.profiles[myProfileIdx],
        avatar_url: avatarUrl,
        destination_country: country,
        college: college,
        current_university: college,
        place: place,
        city: place,
        course: course,
        mobile_number: mobile,
        share_phone_publicly: sharePublicly
      };
    }

    updateUserHeaderUI();
    renderSeniors();
    renderChatSidebar();
    updateDrawerAuthUI();
    closeModal();

    if (sharePublicly && mobile) {
      showToast(`✅ Profile & photo updated! WhatsApp (${mobile}) is now shared publicly with students.`);
    } else {
      showToast('✅ Profile & photo updated! Mobile number is kept 100% confidential in admin vault.');
    }
  }

  // 12. Submit Discussion Post
  async function handleSubmitPost() {
    const title = document.getElementById('inputPostTitle').value;
    const country = document.getElementById('inputPostCountry').value;
    const category = document.getElementById('inputPostCategory').value;
    const content = document.getElementById('inputPostContent').value;

    const payload = {
      title,
      country,
      category,
      content,
      author_id: state.currentUser.id,
      author_name: state.currentUser.display_name,
      author_handle: state.currentUser.username,
      author_role: state.currentUser.role === 'aspirant' ? 'New Aspirant' : 'Senior Student',
      author_avatar: state.currentUser.avatar_url
    };

    const newPost = await window.supabaseService.submitDiscussion(payload);
    state.discussions.unshift(newPost);
    renderDiscussions();
    closeModal();
    showToast('Your question has been posted to the club feed!');
  }

  // 12. Google Login & Guided Onboarding System with Anti-Agent Security Gate
  function setupOnboardingWizard() {
    // Custom Desired Username Typing & Preview
    const customUserInp = document.getElementById('customDesiredUsername');
    const userPreview = document.getElementById('usernamePreviewBadge');
    if (customUserInp) {
      customUserInp.addEventListener('input', () => {
        const clean = customUserInp.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (userPreview) userPreview.textContent = clean ? `@${clean}` : '@student_alias';
      });
    }

    window.pickSuggestedUsername = (alias) => {
      if (customUserInp) {
        customUserInp.value = alias;
        if (userPreview) userPreview.textContent = `@${alias}`;
      }
    };

    // Country Select Live Student Counter Preview
    const onboardCountrySelect = document.getElementById('onboardCountrySelect');
    if (onboardCountrySelect) {
      onboardCountrySelect.addEventListener('change', () => {
        onboarding.country = onboardCountrySelect.value;
        const countEl = document.getElementById('onboardSelectedCountryCount');
        if (countEl) {
          countEl.textContent = state.countryStudentCounts[onboardCountrySelect.value] || 0;
        }
      });
    }

    // Discrete Student Eligibility Check on DOB input (Silent verification, no public leak of age parameters)
    const dobInput = document.getElementById('studentDobInput');
    const ageFeedback = document.getElementById('studentAgeFeedback');
    const ageText = document.getElementById('studentAgeText');

    if (dobInput) {
      dobInput.addEventListener('input', () => {
        const val = dobInput.value;
        if (!val) {
          if (ageFeedback) ageFeedback.style.display = 'none';
          return;
        }
        const birthDate = new Date(val);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }

        if (ageFeedback) {
          ageFeedback.style.display = 'inline-flex';
          if (age > 26 || age < 16) {
            ageFeedback.className = 'age-status-pill invalid';
            ageFeedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>Student Eligibility Criteria Not Met ❌</span>`;
          } else {
            ageFeedback.className = 'age-status-pill valid';
            ageFeedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>Student Eligibility Verified ✅</span>`;
          }
        }
      });
    }

    // Star Rating Click Handlers
    ['safetyStarRating', 'transitStarRating'].forEach(id => {
      const container = document.getElementById(id);
      if (!container) return;
      const stars = container.querySelectorAll('i');
      stars.forEach(star => {
        star.addEventListener('click', () => {
          const val = parseInt(star.dataset.val, 10);
          if (id === 'safetyStarRating') onboarding.safetyRating = val;
          if (id === 'transitStarRating') onboarding.transitRating = val;
          stars.forEach(s => {
            const sVal = parseInt(s.dataset.val, 10);
            if (sVal <= val) {
              s.className = 'fa-solid fa-star selected';
            } else {
              s.className = 'fa-regular fa-star';
            }
          });
        });
      });
    });

    // Job Pills Selection
    document.querySelectorAll('.job-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.job-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        onboarding.jobReality = pill.dataset.job;
      });
    });
  }

  // Google Login Select Handler with Hardware Device Binding
  window.handleGoogleLoginSelect = (name, email, avatar) => {
    // 1. Scan for commercial agent keywords
    if (window.securityService) {
      const scan = window.securityService.scanForAgentKeywords(email, name);
      if (scan.detected) {
        showToast(scan.message);
        window.securityService.triggerSecurityLockdown('AGENT_KEYWORD_DETECTED', scan.message);
        return;
      }

      // 2. Verify Device-Account Hardware Binding
      // If same physical device attempts multiple different accounts -> PERMANENT LOCKDOWN
      const deviceCheck = window.securityService.verifyDeviceAccountBinding(email);
      if (!deviceCheck.allowed) {
        showToast(deviceCheck.message || 'Device access blocked.');
        return;
      }
    }

    const handle = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    state.currentUser = {
      id: 'usr_g_' + Math.abs(hashCode(email)),
      username: handle,
      display_name: '@' + handle, // Strict Privacy: only username displayed publicly!
      real_name: name, // Kept strictly inside Admin Confidential Vault
      email: email,
      avatar_url: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      role: 'senior_student',
      destination_country: 'Canada',
      is_google: true,
      has_completed_onboarding: false
    };

    localStorage.setItem('abroad_shield_user', JSON.stringify(state.currentUser));
    closeModal();
    updateUserHeaderUI();
    updateChatAuthUI();
    showToast(`Google Identity Verified for @${handle}!`);
    openOnboardingModal();
  };

  // Close / Cancel Onboarding (Allow exploration first, resume anytime via banner)
  window.closeOnboardingModal = () => {
    closeModal();
    const banner = document.getElementById('verificationLaterBanner');
    if (banner) {
      banner.style.display = 'flex';
    }
    updateChatAuthUI();
    if (state.pendingChatSeniorId) {
      const pendingId = state.pendingChatSeniorId;
      state.pendingChatSeniorId = null;
      const senior = state.profiles.find(p => p.id === pendingId);
      switchTab('chat');
      if (senior) selectChatUser(senior);
    }
    showToast('Verification paused. Feel free to explore reviews, senior mentors, and calculators!');
  };

  // Crowdsource Agency: Check if exists or dynamically create agency profile & ask for review
  window.handleCheckOrCreateAgency = () => {
    const inputEl = document.getElementById('crowdsourceAgencyInput');
    const agencyName = inputEl?.value.trim();
    if (!agencyName) {
      showToast('Please enter an agency or consultancy name.');
      inputEl?.focus();
      return;
    }

    // Check if agency already exists on Wall of Truth
    const existing = state.reviews.find(r => 
      r.agency_name && r.agency_name.toLowerCase().includes(agencyName.toLowerCase())
    );

    if (existing) {
      switchTab('reviews');
      const searchBox = document.getElementById('reviewSearchInput');
      if (searchBox) {
        searchBox.value = existing.agency_name;
        state.searchQuery = existing.agency_name;
        renderReviews();
      }
      showToast(`Found "${existing.agency_name}" on Wall of Truth! Opening review form to submit your experience.`);
      
      openModal('modalSubmitReview');
      const formAgency = document.getElementById('formAgencyName');
      if (formAgency) formAgency.value = existing.agency_name;
      const formCity = document.getElementById('formBranchCity');
      if (formCity) formCity.value = existing.branch_city || '';
    } else {
      // Agency not found: create/register on Wall of Truth and ask for feedback!
      switchTab('reviews');
      openModal('modalSubmitReview');
      const formAgency = document.getElementById('formAgencyName');
      if (formAgency) formAgency.value = agencyName;
      const formCity = document.getElementById('formBranchCity');
      if (formCity) {
        formCity.value = '';
        formCity.focus();
      }
      showToast(`Agency "${agencyName}" ready for registration on Wall of Truth! Enter your honest feedback below.`);
    }
  };

  window.handleSignOut = () => {
    localStorage.removeItem('abroad_shield_user');
    state.currentUser = null;
    state.activeChatUser = null;
    updateUserHeaderUI();
    updateChatAuthUI();
    closeModal();
    showToast('Signed out successfully.');
  };

  window.reopenOnboardingWizard = () => {
    closeModal();
    openOnboardingModal();
  };

  // Custom Google Login
  window.handleCustomGoogleLogin = () => {
    const nameInput = document.getElementById('customGoogleName');
    const emailInput = document.getElementById('customGoogleEmail');
    const name = nameInput?.value.trim() || 'Verified Student';
    const email = emailInput?.value.trim() || 'student_' + Math.floor(1000 + Math.random() * 9000) + '@gmail.com';
    const avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    window.handleGoogleLoginSelect(name, email, avatar);
  };

  function openOnboardingModal() {
    onboarding.step = 1;
    onboarding.role = 'senior_student';
    updateOnboardingStepUI();
    openModal('modalStudentOnboarding');
    const greetingName = document.getElementById('onboardGreetingName');
    if (greetingName && state.currentUser) {
      greetingName.textContent = state.currentUser.display_name;
    }
    const customUserInp = document.getElementById('customDesiredUsername');
    const userPreview = document.getElementById('usernamePreviewBadge');
    if (customUserInp && state.currentUser) {
      customUserInp.value = state.currentUser.username || '';
      if (userPreview) userPreview.textContent = '@' + (state.currentUser.username || 'student_alias');
    }
    const onboardSelect = document.getElementById('onboardCountrySelect');
    const countEl = document.getElementById('onboardSelectedCountryCount');
    if (onboardSelect && countEl) {
      countEl.textContent = state.countryStudentCounts[onboardSelect.value || 'Canada'] || 0;
    }
  }

  window.selectOnboardingRole = (role) => {
    onboarding.role = role;
    document.getElementById('cardChooseSenior')?.classList.toggle('selected', role === 'senior_student');
    document.getElementById('cardChooseAspirant')?.classList.toggle('selected', role === 'aspirant');
  };

  function updateOnboardingStepUI() {
    const titleEl = document.getElementById('onboardStepTitle');
    const countEl = document.getElementById('onboardStepCount');
    const fillEl = document.getElementById('onboardProgressFill');
    const backBtn = document.getElementById('btnWizardBack');
    const nextBtn = document.getElementById('btnWizardNext');
    const footerControls = document.getElementById('wizardFooterControls');

    // Hide all step contents
    document.querySelectorAll('.wizard-step-content').forEach(el => el.classList.remove('active'));

    const isSenior = onboarding.role === 'senior_student';
    const totalSteps = isSenior ? 4 : 2;

    if (onboarding.step === 1) {
      document.getElementById('wizardStep1')?.classList.add('active');
      if (titleEl) titleEl.textContent = 'Step 1: Your Study Abroad Status';
      if (countEl) countEl.textContent = `Step 1 of ${totalSteps}`;
      if (fillEl) fillEl.style.width = '25%';
      if (backBtn) backBtn.style.display = 'none';
      if (nextBtn) {
        nextBtn.innerHTML = `Next Step <i class="fa-solid fa-arrow-right"></i>`;
        nextBtn.style.display = 'inline-flex';
      }
      if (footerControls) footerControls.style.display = 'flex';
    } else if (onboarding.step === 2) {
      if (backBtn) backBtn.style.display = 'inline-flex';
      if (isSenior) {
        document.getElementById('wizardStep2Senior')?.classList.add('active');
        if (titleEl) titleEl.textContent = 'Step 2: Area Environment & Safety';
        if (countEl) countEl.textContent = 'Step 2 of 4';
        if (fillEl) fillEl.style.width = '50%';
        if (nextBtn) nextBtn.innerHTML = `Next Step <i class="fa-solid fa-arrow-right"></i>`;
      } else {
        document.getElementById('wizardStep2Aspirant')?.classList.add('active');
        if (titleEl) titleEl.textContent = 'Step 2: Target Program & Doubts';
        if (countEl) countEl.textContent = 'Step 2 of 2';
        if (fillEl) fillEl.style.width = '90%';
        if (nextBtn) nextBtn.innerHTML = `<i class="fa-solid fa-check"></i> Complete Setup`;
      }
    } else if (onboarding.step === 3 && isSenior) {
      document.getElementById('wizardStep3Senior')?.classList.add('active');
      if (titleEl) titleEl.textContent = 'Step 3: Real Living Expenses';
      if (countEl) countEl.textContent = 'Step 3 of 4';
      if (fillEl) fillEl.style.width = '75%';
      if (backBtn) backBtn.style.display = 'inline-flex';
      if (nextBtn) nextBtn.innerHTML = `Next Step <i class="fa-solid fa-arrow-right"></i>`;
    } else if (onboarding.step === 4 && isSenior) {
      document.getElementById('wizardStep4Senior')?.classList.add('active');
      if (titleEl) titleEl.textContent = 'Step 4: Agent & Treatment Details';
      if (countEl) countEl.textContent = 'Step 4 of 4';
      if (fillEl) fillEl.style.width = '95%';
      if (backBtn) backBtn.style.display = 'inline-flex';
      if (nextBtn) nextBtn.innerHTML = `<i class="fa-solid fa-check"></i> Submit Feedback`;
    } else if (onboarding.step === 5) {
      // Celebratory Screen
      document.getElementById('wizardStepCelebration')?.classList.add('active');
      if (titleEl) titleEl.textContent = '🎉 All Done!';
      if (countEl) countEl.textContent = 'Completed';
      if (fillEl) fillEl.style.width = '100%';
      if (footerControls) footerControls.style.display = 'none';
    }
  }

  window.onboardNextStep = async () => {
    const isSenior = onboarding.role === 'senior_student';

    if (onboarding.step === 1) {
      // 1. Validate Custom Desired Username / Public Alias
      const desiredUser = document.getElementById('customDesiredUsername')?.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!desiredUser || desiredUser.length < 3) {
        showToast('Please choose a valid public username (at least 3 characters).');
        document.getElementById('customDesiredUsername')?.focus();
        return;
      }
      onboarding.desiredUsername = desiredUser;
      if (state.currentUser) {
        state.currentUser.username = desiredUser;
        state.currentUser.display_name = '@' + desiredUser;
      }

      // 2. Validate Student Verification Protocol (Silent, discrete check)
      const dobVal = document.getElementById('studentDobInput')?.value;
      const proofType = document.getElementById('studentProofType')?.value || 'student_id';
      const proofVal = document.getElementById('studentProofValue')?.value.trim();
      const isOathChecked = document.getElementById('antiAgentOathCheck')?.checked;

      if (window.securityService) {
        const check = window.securityService.validateAgeAndStudentStatus(dobVal, proofType, proofVal, isOathChecked);
        if (!check.allowed) {
          showToast(check.message);
          return;
        }
        onboarding.verifiedAge = check.age;
        onboarding.studentProof = `${proofType}:${proofVal}`;
        onboarding.dob = dobVal;

        // Confidential Identity Vault Isolation (Admin Eyes Only)
        if (state.currentUser) {
          window.securityService.recordStudentVerification({
            id: state.currentUser.id,
            username: desiredUser,
            realName: state.currentUser.real_name || state.currentUser.display_name,
            email: state.currentUser.email,
            dob: dobVal,
            verifiedAge: check.age,
            proofType: proofType,
            proofValue: proofVal,
            country: document.getElementById('onboardCountrySelect')?.value || 'Canada',
            university: 'Enrolled Student'
          });
        }
      }

      onboarding.country = document.getElementById('onboardCountrySelect')?.value || 'Canada';
      onboarding.step = 2;
      updateOnboardingStepUI();
    } else if (onboarding.step === 2) {
      if (isSenior) {
        const uni = document.getElementById('onboardUni')?.value.trim();
        const city = document.getElementById('onboardCity')?.value.trim();
        const course = document.getElementById('onboardCourse')?.value.trim();
        if (!uni || !city) {
          showToast('Please enter your university and city/area.');
          return;
        }
        onboarding.step = 3;
        updateOnboardingStepUI();
      } else {
        // Aspirant finished step 2
        await saveAspirantOnboardingData();
        onboarding.step = 5;
        updateOnboardingStepUI();
      }
    } else if (onboarding.step === 3 && isSenior) {
      onboarding.step = 4;
      updateOnboardingStepUI();
    } else if (onboarding.step === 4 && isSenior) {
      // Senior finished step 4
      await saveSeniorOnboardingData();
      onboarding.step = 5;
      updateOnboardingStepUI();
    }
  };

  window.onboardPrevStep = () => {
    if (onboarding.step > 1) {
      onboarding.step--;
      updateOnboardingStepUI();
    }
  };

  async function saveSeniorOnboardingData() {
    const uni = document.getElementById('onboardUni')?.value.trim() || 'University Abroad';
    const city = document.getElementById('onboardCity')?.value.trim() || 'Abroad City';
    const course = document.getElementById('onboardCourse')?.value.trim() || 'MS Computer Science & Software Systems';
    const intake = document.getElementById('onboardIntake')?.value.trim() || '2024';
    const envNotes = document.getElementById('onboardEnvNotes')?.value.trim() || 'Great area, keep warm in winter!';
    const rent = document.getElementById('onboardRent')?.value || '850';
    const food = document.getElementById('onboardFood')?.value || '250';
    const transitFee = document.getElementById('onboardTransitFee')?.value || '130';
    const hiddenExpenses = document.getElementById('onboardHiddenExpenses')?.value.trim() || 'None';

    const agentName = document.getElementById('onboardAgentName')?.value.trim();
    const agentCity = document.getElementById('onboardAgentCity')?.value.trim() || city;
    const agentRating = document.getElementById('onboardAgentRating')?.value || '3';
    const hiddenCharges = document.getElementById('onboardHiddenCharge')?.value.trim() || 'None reported';
    const treatment = document.getElementById('onboardTreatment')?.value.trim() || 'Overall okay process.';
    const goldenTip = document.getElementById('onboardGoldenTip')?.value.trim() || 'Do your own research!';

    // 1. Update Current User object & LocalStorage
    state.currentUser.role = 'senior_student';
    state.currentUser.destination_country = onboarding.country;
    state.currentUser.current_university = uni;
    state.currentUser.college = uni;
    state.currentUser.city = city;
    state.currentUser.place = city;
    state.currentUser.course = course;
    state.currentUser.intake_year = intake;
    state.currentUser.agent_used = agentName || 'Self-Applied';
    state.currentUser.bio = `${uni} • ${course} (${city}). Area Safety: ${onboarding.safetyRating}/5. Real Rent: $${rent}/mo. Golden tip: "${goldenTip}"`;
    state.currentUser.has_completed_onboarding = true;
    localStorage.setItem('abroad_shield_user', JSON.stringify(state.currentUser));

    // 2. Publish Review to Supabase abroad_agency_reviews if agent specified
    if (agentName) {
      try {
        await window.supabaseService.submitAgencyReview({
          agency_name: agentName,
          branch_city: agentCity,
          student_id: state.currentUser.id,
          student_name: state.currentUser.display_name,
          student_handle: state.currentUser.username,
          is_anonymous: false,
          destination_country: onboarding.country,
          rating: parseInt(agentRating, 10),
          treatment_summary: treatment.substring(0, 80) + '...',
          what_they_promised: `Promised smooth visa and living cost under $500/mo.`,
          what_actually_happened: `Actual shared rent is $${rent}/mo and groceries $${food}/mo. Jobs in ${city} are ${onboarding.jobReality}.`,
          hidden_charges_taken: hiddenCharges,
          threat_or_pressure: treatment,
          recommended: parseInt(agentRating, 10) >= 3
        });
      } catch (e) {
        console.warn('Review publish err:', e);
      }
    }

    // 3. Publish Environment & Cost guide to abroad_discussions
    try {
      await window.supabaseService.submitDiscussion({
        country: onboarding.country,
        category: 'Living Expenses & Rent',
        author_id: state.currentUser.id,
        author_name: state.currentUser.display_name,
        author_handle: state.currentUser.username,
        author_role: `Senior @ ${uni} (${city})`,
        author_avatar: state.currentUser.avatar_url,
        title: `📍 Ground Truth Guide for ${city}: Safety (${onboarding.safetyRating}/5), Jobs & Real $${rent}/mo Rent`,
        content: `Hey juniors! Here is the authentic breakdown for ${uni} in ${city} (${onboarding.country}):

1. AREA SAFETY & TRANSIT:
- Safety Rating: ${onboarding.safetyRating}/5 stars
- Transit Accessibility: ${onboarding.transitRating}/5 stars
- Atmosphere: ${envNotes}

2. REAL EXPENSES (NOT AGENT FANTASY):
- Shared Room Rent: $${rent}/month
- Groceries & Meals: $${food}/month
- Transit Pass: $${transitFee}/month
- Hidden Fees: ${hiddenExpenses}

3. PART-TIME JOBS REALITY:
- Ground Reality: ${onboarding.jobReality}

4. ADVICE REGARDING AGENTS:
${agentName ? `I used ${agentName} (${agentCity}). Rating: ${agentRating}/5. Tip: ${goldenTip}` : `Tip: ${goldenTip}`}

DM me directly on AbroadShield if you have any questions!`,
        tags: [onboarding.country, city, 'EnvironmentGuide', 'LivingCost']
      });
    } catch (e) {
      console.warn('Discussion publish err:', e);
    }

    // Update UI
    updateUserHeaderUI();
    incrementCountryStudentCount(onboarding.country);

    // Confidential Identity Vault recording (Admin Only)
    if (window.securityService && state.currentUser) {
      window.securityService.recordStudentVerification({
        id: state.currentUser.id,
        username: state.currentUser.username,
        realName: state.currentUser.real_name || state.currentUser.display_name,
        email: state.currentUser.email,
        dob: onboarding.dob || 'Confidential',
        verifiedAge: onboarding.verifiedAge || 23,
        proofType: 'Senior Student ID Proof',
        proofValue: onboarding.studentProof || 'VERIFIED-SENIOR',
        country: onboarding.country,
        university: uni
      });
    }

    const celebrationEl = document.getElementById('seniorImpactSummary');
    if (celebrationEl) {
      celebrationEl.textContent = `Your review of "${agentName || 'Your Agency'}" & Area Guide for ${city} are now LIVE!`;
    }
  }

  async function saveAspirantOnboardingData() {
    const program = document.getElementById('aspirantProgram')?.value.trim() || 'Higher Studies';
    const intake = document.getElementById('aspirantIntake')?.value.trim() || 'Upcoming Intake';
    const agentSpoken = document.getElementById('aspirantAgentSpoken')?.value.trim();
    const biggestFear = document.getElementById('aspirantBiggestFear')?.value.trim();

    state.currentUser.role = 'aspirant';
    state.currentUser.destination_country = onboarding.country;
    state.currentUser.bio = `Aspirant targeting ${program} (${intake}) in ${onboarding.country}.`;
    state.currentUser.has_completed_onboarding = true;
    localStorage.setItem('abroad_shield_user', JSON.stringify(state.currentUser));

    // If they have doubts or questions, post question to club feed
    if (biggestFear) {
      try {
        await window.supabaseService.submitDiscussion({
          country: onboarding.country,
          category: 'Agent Truth & Scams',
          author_id: state.currentUser.id,
          author_name: state.currentUser.display_name,
          author_handle: state.currentUser.username,
          author_role: `Aspirant for ${intake}`,
          author_avatar: state.currentUser.avatar_url,
          title: `❓ Question for Seniors in ${onboarding.country}: ${program}`,
          content: `${biggestFear}
${agentSpoken ? `\n(An agent from "${agentSpoken}" spoke to me regarding this).` : ''}

Looking for verified seniors currently studying there to share advice!`,
          tags: [onboarding.country, 'AspirantQuestion', program.split(' ')[0]]
        });
      } catch (e) {
        console.warn('Aspirant question err:', e);
      }
    }

    updateUserHeaderUI();
    incrementCountryStudentCount(onboarding.country);

    // Confidential Identity Vault recording (Admin Only)
    if (window.securityService && state.currentUser) {
      window.securityService.recordStudentVerification({
        id: state.currentUser.id,
        username: state.currentUser.username,
        realName: state.currentUser.real_name || state.currentUser.display_name,
        email: state.currentUser.email,
        dob: onboarding.dob || 'Confidential',
        verifiedAge: onboarding.verifiedAge || 21,
        proofType: 'Aspirant Proof',
        proofValue: onboarding.studentProof || 'VERIFIED-ASPIRANT',
        country: onboarding.country,
        university: `Targeting ${program}`
      });
    }
  }

  // 13. Admin Confidential Information Vault
  function setupAdminVault() {
    window.openAdminVaultModal = () => {
      openModal('modalAdminVault');
      const gate = document.getElementById('adminPasskeyGate');
      const dash = document.getElementById('adminVaultDashboard');
      const passInp = document.getElementById('inputAdminPasskey');
      const errEl = document.getElementById('adminPasskeyError');
      if (errEl) errEl.style.display = 'none';

      if (state.adminVaultUnlocked) {
        if (gate) gate.style.display = 'none';
        if (dash) dash.style.display = 'block';
        window.renderAdminVaultTable();
      } else {
        if (gate) gate.style.display = 'block';
        if (dash) dash.style.display = 'none';
        if (passInp) {
          passInp.value = '';
          setTimeout(() => passInp.focus(), 150);
        }
      }
    };

    window.unlockAdminVault = () => {
      const passInp = document.getElementById('inputAdminPasskey');
      const errEl = document.getElementById('adminPasskeyError');
      const passkey = passInp?.value || '';

      if (window.securityService && window.securityService.verifyAdminPasskey(passkey)) {
        state.adminVaultUnlocked = true;
        if (errEl) errEl.style.display = 'none';
        const gate = document.getElementById('adminPasskeyGate');
        const dash = document.getElementById('adminVaultDashboard');
        if (gate) gate.style.display = 'none';
        if (dash) dash.style.display = 'block';
        window.renderAdminVaultTable();
        showToast('🔓 Confidential Admin Vault Decrypted.');
      } else {
        if (errEl) errEl.style.display = 'block';
      }
    };

    window.lockAdminVault = () => {
      state.adminVaultUnlocked = false;
      const gate = document.getElementById('adminPasskeyGate');
      const dash = document.getElementById('adminVaultDashboard');
      if (gate) gate.style.display = 'block';
      if (dash) dash.style.display = 'none';
      const passInp = document.getElementById('inputAdminPasskey');
      if (passInp) passInp.value = '';
      closeModal();
      if (window.location.pathname.toLowerCase().includes('/admin') || window.location.hash.toLowerCase() === '#admin') {
        window.history.pushState(null, '', '/');
      }
      showToast('🔒 Admin Vault Locked.');
    };

    window.renderAdminVaultTable = () => {
      const tbody = document.getElementById('adminVaultTableBody');
      if (!tbody) return;

      const records = window.securityService ? window.securityService.getAdminConfidentialRecords() : [];
      if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">No student records registered yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = records.map(r => `
        <tr>
          <td>
            <span class="admin-table-alias">@${escapeHtml(r.username)}</span>
          </td>
          <td>
            <div style="font-weight: 700;">${escapeHtml(r.realName || 'Student')}</div>
            <div class="admin-table-email">${escapeHtml(r.email)}</div>
            ${r.mobileNumber ? `
              <div style="font-size: 0.73rem; margin-top: 3px; display: flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-phone" style="font-size: 0.68rem; color: var(--cyan-bright);"></i> ${escapeHtml(r.mobileNumber)}
                ${r.sharePhonePublicly ? '<span style="color: #6ee7b7; font-size: 0.65rem; font-weight: 800; background: rgba(16,185,129,0.18); padding: 1px 5px; border-radius: 4px;">[Public]</span>' : '<span style="color: #94a3b8; font-size: 0.65rem; font-weight: 800; background: rgba(148,163,184,0.18); padding: 1px 5px; border-radius: 4px;">[Private 🔒]</span>'}
              </div>
            ` : '<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">No phone added</div>'}
          </td>
          <td>
            <div>${r.verifiedAge || 22} yrs</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(r.dob || 'Confidential')}</div>
          </td>
          <td>
            <div style="font-size: 0.76rem; font-weight: 600;">${escapeHtml(r.proofType || 'Student ID')}</div>
            <code style="font-size: 0.72rem; color: var(--cyan-bright);">${escapeHtml(r.proofValue || 'VERIFIED')}</code>
          </td>
          <td>
            <strong>${escapeHtml(r.country || 'Canada')}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(r.university || '')}</div>
          </td>
          <td>
            <span class="admin-hash-code">${escapeHtml(r.deviceId ? r.deviceId.substring(0, 16) + '...' : 'dev_84f9...')}</span>
          </td>
          <td>
            <span style="display: inline-flex; align-items: center; gap: 4px; color: #6ee7b7; font-size: 0.75rem; font-weight: 700;">
              <i class="fa-solid fa-circle-check"></i> ${escapeHtml(r.status || 'Verified')}
            </span>
          </td>
        </tr>
      `).join('');
    };

    window.exportAdminVaultCSV = () => {
      const records = window.securityService ? window.securityService.getAdminConfidentialRecords() : [];
      let csv = 'Public Alias,Real Name,Google Email,Mobile Number,Public Mobile Sharing,DOB,Verified Age,Proof Type,Proof Value,Country,University,Device Hash,Status\n';
      records.forEach(r => {
        csv += `"${r.username}","${r.realName || ''}","${r.email}","${r.mobileNumber || ''}","${r.sharePhonePublicly ? 'YES (Public)' : 'NO (Confidential)'}","${r.dob || ''}","${r.verifiedAge || ''}","${r.proofType || ''}","${r.proofValue || ''}","${r.country}","${r.university || ''}","${r.deviceId || ''}","${r.status || 'Verified'}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `abroadshield_confidential_vault_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('📄 Confidential CSV Exported Successfully.');
    };

    // Auto-open Admin login when accessing /admin or #admin
    function checkAdminRoute() {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      if (path === '/admin' || path.startsWith('/admin') || hash === '#admin') {
        window.openAdminVaultModal();
      }
    }

    setTimeout(checkAdminRoute, 120);
    window.addEventListener('popstate', checkAdminRoute);
    window.addEventListener('hashchange', checkAdminRoute);

    // Enter key submit in passkey field
    document.getElementById('inputAdminPasskey')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.unlockAdminVault();
      }
    });

    // Keyboard shortcut: Ctrl + Shift + A to open Admin Login
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        window.openAdminVaultModal();
      }
    });
  }

  // 13B. Professional Mobile Side Menu / Drawer (Android & iPhone Ergonomics)
  function initMobileMenu() {
    // Open Drawer
    window.openMobileMenu = () => {
      const drawer = document.getElementById('mobileSideDrawer');
      const backdrop = document.getElementById('mobileDrawerBackdrop');
      if (drawer) drawer.classList.add('active');
      if (backdrop) backdrop.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Synchronize drawer tab & country active indicators
      document.querySelectorAll('.drawer-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === state.activeTab);
      });
      document.querySelectorAll('.drawer-country-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.country === state.activeCountry);
      });

      // Update drawer counters
      const drawerCountReviews = document.getElementById('drawerCountReviews');
      if (drawerCountReviews) drawerCountReviews.textContent = state.reviews ? state.reviews.length : 0;
      const drawerCountFeed = document.getElementById('drawerCountFeed');
      if (drawerCountFeed) drawerCountFeed.textContent = state.discussions ? state.discussions.length : 0;
      const drawerCountSeniors = document.getElementById('drawerCountSeniors');
      if (drawerCountSeniors) drawerCountSeniors.textContent = state.profiles ? state.profiles.length : 0;

      updateDrawerAuthUI();
    };

    // Close Drawer
    window.closeMobileMenu = () => {
      const drawer = document.getElementById('mobileSideDrawer');
      const backdrop = document.getElementById('mobileDrawerBackdrop');
      if (drawer) drawer.classList.remove('active');
      if (backdrop) backdrop.classList.remove('active');
      document.body.style.overflow = '';
    };

    // Mobile Tab Navigation
    window.mobileNavigateTab = (tabId) => {
      switchTab(tabId);
      document.querySelectorAll('.drawer-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabId);
      });
      window.closeMobileMenu();

      // Smooth scroll to selected view content for ergonomic mobile view
      const targetView = document.getElementById(`view-${tabId}`);
      if (targetView) {
        setTimeout(() => {
          targetView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    };

    // Mobile Country Quick Selector
    window.mobileSelectCountry = (country) => {
      state.activeCountry = country;
      document.querySelectorAll('.country-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.country === country);
      });
      document.querySelectorAll('.drawer-country-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.country === country);
      });
      const globalSel = document.getElementById('globalCountryDropdownSelect');
      if (globalSel) globalSel.value = country;

      loadData();
      window.closeMobileMenu();
      showToast(`🌐 Filtered Destination: ${country}`);
    };

    // Android & iPhone Touch Swipe-Left to Close Gesture Support
    const drawerEl = document.getElementById('mobileSideDrawer');
    if (drawerEl) {
      let touchStartX = 0;
      let touchStartY = 0;

      drawerEl.addEventListener('touchstart', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          touchStartX = e.changedTouches[0].clientX;
          touchStartY = e.changedTouches[0].clientY;
        }
      }, { passive: true });

      drawerEl.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          const touchEndX = e.changedTouches[0].clientX;
          const touchEndY = e.changedTouches[0].clientY;
          const diffX = touchStartX - touchEndX;
          const diffY = Math.abs(touchStartY - touchEndY);

          // If swiped left by 45px+ and horizontal swipe was dominant, dismiss drawer
          if (diffX > 45 && diffY < 120) {
            window.closeMobileMenu();
          }
        }
      }, { passive: true });
    }

    // Keyboard 'Escape' closes drawer
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const drawer = document.getElementById('mobileSideDrawer');
        if (drawer && drawer.classList.contains('active')) {
          window.closeMobileMenu();
        }
      }
    });

    // Auto-close drawer if screen orientation rotates or window widens past mobile breakpoint
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) {
        window.closeMobileMenu();
      }
    });

    updateDrawerAuthUI();
  }

  // Drawer Auth Card Display Logic (Anonymous Handle & Confidential ID)
  function updateDrawerAuthUI() {
    const card = document.getElementById('drawerAuthCard');
    if (!card) return;

    if (state.currentUser && state.currentUser.is_google) {
      const avatar = state.currentUser.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
      const roleText = state.currentUser.role === 'senior_student' ? 'Senior Mentor' : 'Aspirant Student';
      const countryText = state.currentUser.destination_country || 'Global';

      card.innerHTML = `
        <div class="drawer-user-info">
          <img src="${avatar}" alt="User Avatar" class="drawer-user-avatar">
          <div class="drawer-user-details">
            <span class="drawer-user-handle">@${escapeHtml(state.currentUser.username || 'Student')}</span>
            <span class="drawer-user-meta">${escapeHtml(roleText)} • ${escapeHtml(countryText)}</span>
            <span class="drawer-user-privacy-tag"><i class="fa-solid fa-shield-halved"></i> Real ID Confidential</span>
          </div>
        </div>
        <button type="button" class="drawer-profile-btn" onclick="window.closeMobileMenu(); openModal('modalUserProfile')">
          <i class="fa-solid fa-id-card"></i> Student Profile
        </button>
      `;
    } else {
      card.innerHTML = `
        <div class="drawer-guest-banner">
          <div class="drawer-guest-icon"><i class="fa-brands fa-google"></i></div>
          <div class="drawer-guest-info">
            <strong>Student Google Verification</strong>
            <span>Verified students only • Real identity hidden</span>
          </div>
        </div>
        <button type="button" class="drawer-login-btn" onclick="window.closeMobileMenu(); openModal('modalGoogleAuth')">
          <i class="fa-brands fa-google"></i> Sign In with Google
        </button>
      `;
    }
  }

  window.finishOnboarding = () => {
    closeModal();
    const pill = document.querySelector(`.country-pill[data-country="${onboarding.country}"]`);
    if (pill) pill.click();
    loadData();
    updateChatAuthUI();
    if (state.pendingChatSeniorId) {
      const pendingId = state.pendingChatSeniorId;
      state.pendingChatSeniorId = null;
      const senior = state.profiles.find(p => p.id === pendingId);
      switchTab('chat');
      if (senior) selectChatUser(senior);
    }
    showToast(`🎉 Onboarding complete! Welcome to AbroadShield Club.`);
  };

  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }



  window.switchTabAndScrollScanner = () => {
    switchTab('scanner');
    document.getElementById('agentLieScannerSection')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Toast Helper
  function showToast(message) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--cyan-bright);"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }
});
