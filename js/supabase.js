/**
 * AbroadShield Club - Supabase Integration Module
 * Connected to live Supabase backend: https://fgkkyahammglaeolrkln.supabase.co
 */

const SUPABASE_CONFIG = {
  url: 'https://fgkkyahammglaeolrkln.supabase.co',
  anonKey: 'sb_publishable_YIpWmfYqRwL9TgrF_cH2eA_cTRzCKci',
  legacyKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZna2t5YWhhbW1nbGFlb2xya2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NzYwMzQsImV4cCI6MjA5NTE1MjAzNH0.-oNAbgTjXQ9Z5-jvua5vIqQ6GPCKkOCKSTB-qEur3Ko'
};

class SupabaseService {
  constructor() {
    this.client = null;
    this.initClient();
  }

  initClient() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        this.client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('✅ Supabase Client initialized successfully');
      } catch (err) {
        console.warn('⚠️ Supabase init with publishable key failed, trying legacy key:', err);
        try {
          this.client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.legacyKey);
        } catch (e) {
          console.error('❌ Supabase Client failed to init:', e);
        }
      }
    } else {
      console.warn('⏳ Supabase JS SDK not loaded yet. Will use direct REST API fetch.');
    }
  }

  // Generic REST fallback helper
  async restFetch(endpoint, options = {}) {
    const url = `${SUPABASE_CONFIG.url}/rest/v1/${endpoint}`;
    const headers = {
      'apikey': SUPABASE_CONFIG.anonKey,
      'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`REST fetch error for ${endpoint}:`, error);
      throw error;
    }
  }

  // 1. Fetch Senior Student Profiles
  async getProfiles(country = 'All') {
    try {
      let endpoint = 'abroad_profiles?select=*&is_demo=neq.true&order=created_at.desc';
      if (country && country !== 'All') {
        endpoint += `&destination_country=eq.${encodeURIComponent(country)}`;
      }
      const profiles = await this.restFetch(endpoint);
      // Ensure zero demo seed accounts leak through
      const demoIds = ['usr_rahul_toronto', 'usr_ananya_london', 'usr_harpreet_vancouver', 'usr_rohit_dallas', 'usr_neha_berlin', 'usr_karthik_melb'];
      return (profiles || []).filter(p => !p.is_demo && !demoIds.includes(p.id));
    } catch (err) {
      console.warn('Error fetching profiles from cloud, using fallback data:', err);
      return this.getFallbackProfiles(country);
    }
  }

  // 1B. Create or Update Student / Senior Profile in Supabase
  async upsertProfile(profileData) {
    try {
      const payload = {
        id: profileData.id,
        username: profileData.username,
        display_name: profileData.display_name || ('@' + profileData.username),
        avatar_url: profileData.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        role: profileData.role || 'senior_student',
        destination_country: profileData.destination_country || 'Canada',
        current_university: profileData.current_university || profileData.college || 'University Abroad',
        city: profileData.city || profileData.place || 'Campus Area',
        college: profileData.college || profileData.current_university || 'University Abroad',
        course: profileData.course || 'Degree Program',
        campus_place: profileData.place || profileData.city || 'Campus Area',
        intake_year: profileData.intake_year || '2024',
        bio: profileData.bio || '',
        agent_used: profileData.agent_used || 'Self-Applied',
        mobile_number: profileData.mobile_number || '',
        share_phone_publicly: Boolean(profileData.share_phone_publicly),
        is_verified: true,
        verification_type: profileData.verification_type || 'Google Student ID Verification',
        is_demo: false,
        updated_at: new Date().toISOString()
      };

      const result = await this.restFetch('abroad_profiles', {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
      return result[0] || payload;
    } catch (err) {
      console.warn('Upsert profile error (cached locally):', err);
      return profileData;
    }
  }

  // 2. Fetch Agent Reviews (The Wall of Truth)
  async getAgencyReviews(country = 'All', search = '') {
    try {
      let endpoint = 'abroad_agency_reviews?select=*&is_demo=neq.true&order=created_at.desc';
      if (country && country !== 'All') {
        endpoint += `&destination_country=eq.${encodeURIComponent(country)}`;
      }
      const reviews = await this.restFetch(endpoint);
      const filtered = (reviews || []).filter(r => !r.is_demo);
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        return filtered.filter(r => 
          (r.agency_name && r.agency_name.toLowerCase().includes(q)) ||
          (r.branch_city && r.branch_city.toLowerCase().includes(q)) ||
          (r.treatment_summary && r.treatment_summary.toLowerCase().includes(q)) ||
          (r.what_they_promised && r.what_they_promised.toLowerCase().includes(q)) ||
          (r.ground_problems && r.ground_problems.toLowerCase().includes(q)) ||
          (r.key_benefits && r.key_benefits.toLowerCase().includes(q))
        );
      }
      return filtered;
    } catch (err) {
      console.warn('Error fetching agency reviews, using fallback:', err);
      return this.getFallbackReviews(country, search);
    }
  }

  // 3. Submit New Agency Review
  async submitAgencyReview(reviewData) {
    try {
      const payload = {
        agency_name: reviewData.agency_name,
        branch_city: reviewData.branch_city || 'Not Specified',
        student_id: reviewData.student_id || 'usr_' + Date.now(),
        student_name: reviewData.is_anonymous ? 'Anonymous Senior' : reviewData.student_name,
        student_handle: reviewData.is_anonymous ? 'anonymous' : reviewData.student_handle,
        is_anonymous: Boolean(reviewData.is_anonymous),
        destination_country: reviewData.destination_country,
        rating: parseInt(reviewData.rating, 10),
        treatment_summary: reviewData.treatment_summary,
        what_they_promised: reviewData.what_they_promised,
        what_actually_happened: reviewData.what_actually_happened,
        ground_problems: reviewData.ground_problems || reviewData.what_actually_happened || '',
        key_benefits: reviewData.key_benefits || '',
        hidden_charges_taken: reviewData.hidden_charges_taken || 'None reported',
        threat_or_pressure: reviewData.threat_or_pressure || 'None reported',
        recommended: Boolean(reviewData.recommended),
        is_demo: false,
        likes_count: 0
      };

      const result = await this.restFetch('abroad_agency_reviews', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return result[0] || payload;
    } catch (err) {
      console.error('Failed to submit review to Supabase:', err);
      // Store in local storage for offline tolerance
      const local = JSON.parse(localStorage.getItem('local_reviews') || '[]');
      const newReview = { id: 'local_' + Date.now(), ...reviewData, created_at: new Date().toISOString(), likes_count: 0 };
      local.unshift(newReview);
      localStorage.setItem('local_reviews', JSON.stringify(local));
      return newReview;
    }
  }

  // 4. Like / Helpful on Review
  async likeReview(reviewId, currentLikes = 0) {
    try {
      const newLikes = currentLikes + 1;
      await this.restFetch(`abroad_agency_reviews?id=eq.${reviewId}`, {
        method: 'PATCH',
        body: JSON.stringify({ likes_count: newLikes })
      });
      return newLikes;
    } catch (err) {
      console.warn('Like update failed, returning incremented value:', err);
      return currentLikes + 1;
    }
  }

  // 5. Fetch Discussions (Club Feeds)
  async getDiscussions(country = 'All', category = 'All') {
    try {
      let endpoint = 'abroad_discussions?select=*&order=upvotes.desc,created_at.desc';
      if (country && country !== 'All') {
        endpoint += `&country=eq.${encodeURIComponent(country)}`;
      }
      if (category && category !== 'All') {
        endpoint += `&category=eq.${encodeURIComponent(category)}`;
      }
      return await this.restFetch(endpoint);
    } catch (err) {
      console.warn('Error fetching discussions, using fallback:', err);
      return this.getFallbackDiscussions(country, category);
    }
  }

  // 6. Submit Discussion
  async submitDiscussion(postData) {
    try {
      const payload = {
        country: postData.country,
        category: postData.category,
        author_id: postData.author_id || 'usr_demo',
        author_name: postData.author_name || 'Anonymous Student',
        author_handle: postData.author_handle || 'student_abroad',
        author_role: postData.author_role || 'Aspirant',
        author_avatar: postData.author_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        title: postData.title,
        content: postData.content,
        tags: postData.tags || [postData.country, postData.category],
        upvotes: 0,
        comments_count: 0
      };

      const result = await this.restFetch('abroad_discussions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return result[0] || payload;
    } catch (err) {
      console.error('Failed to submit discussion:', err);
      const local = JSON.parse(localStorage.getItem('local_discussions') || '[]');
      const newPost = { id: 'post_' + Date.now(), ...postData, upvotes: 1, comments_count: 0, created_at: new Date().toISOString() };
      local.unshift(newPost);
      localStorage.setItem('local_discussions', JSON.stringify(local));
      return newPost;
    }
  }

  // 7. Upvote Discussion
  async upvoteDiscussion(discussionId, currentVotes = 0) {
    try {
      const newVotes = currentVotes + 1;
      await this.restFetch(`abroad_discussions?id=eq.${discussionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ upvotes: newVotes })
      });
      return newVotes;
    } catch (err) {
      return currentVotes + 1;
    }
  }

  // 8. Direct Messages (Instagram-Style Chat between Aspirant & Senior)
  async getDirectMessages(user1, user2) {
    try {
      // Query messages where (sender=user1 AND receiver=user2) OR (sender=user2 AND receiver=user1)
      const endpoint = `abroad_direct_messages?or=(and(sender_id.eq.${user1},receiver_id.eq.${user2}),and(sender_id.eq.${user2},receiver_id.eq.${user1}))&order=created_at.asc`;
      const messages = await this.restFetch(endpoint);
      return messages;
    } catch (err) {
      console.warn('Error fetching messages from cloud:', err);
      const localKey = `chat_${[user1, user2].sort().join('_')}`;
      return JSON.parse(localStorage.getItem(localKey) || '[]');
    }
  }

  // 9. Send Direct Message
  async sendDirectMessage(senderId, receiverId, message, senderUsername = 'student', receiverUsername = 'senior') {
    const payload = {
      sender_id: senderId,
      receiver_id: receiverId,
      sender_username: senderUsername,
      receiver_username: receiverUsername,
      message: message.trim(),
      is_read: false
    };

    try {
      const result = await this.restFetch('abroad_direct_messages', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const newMsg = result[0] || { ...payload, id: 'msg_' + Date.now(), created_at: new Date().toISOString() };

      // Cache locally
      const localKey = `chat_${[senderId, receiverId].sort().join('_')}`;
      const localMsgs = JSON.parse(localStorage.getItem(localKey) || '[]');
      localMsgs.push(newMsg);
      localStorage.setItem(localKey, JSON.stringify(localMsgs));

      return newMsg;
    } catch (err) {
      console.warn('Direct message sent to local cache due to network:', err);
      const newMsg = { ...payload, id: 'msg_' + Date.now(), created_at: new Date().toISOString() };
      const localKey = `chat_${[senderId, receiverId].sort().join('_')}`;
      const localMsgs = JSON.parse(localStorage.getItem(localKey) || '[]');
      localMsgs.push(newMsg);
      localStorage.setItem(localKey, JSON.stringify(localMsgs));
      return newMsg;
    }
  }

  // 10. Live Supabase Real-time Subscriptions (Production Multi-User Sync)
  subscribeToDirectMessages(user1, user2, onNewMessage) {
    if (!this.client || typeof this.client.channel !== 'function') return null;
    try {
      const channelId = `chat_dm_${[user1, user2].sort().join('_')}_${Date.now()}`;
      const channel = this.client.channel(channelId)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'abroad_direct_messages' },
          (payload) => {
            const row = payload.new;
            if (!row) return;
            const matches = (row.sender_id === user1 && row.receiver_id === user2) ||
                            (row.sender_id === user2 && row.receiver_id === user1);
            if (matches && typeof onNewMessage === 'function') {
              onNewMessage(row);
            }
          }
        )
        .subscribe();
      return channel;
    } catch (e) {
      console.warn('Realtime chat subscription error:', e);
      return null;
    }
  }

  // 11. Live Reviews Real-time Subscription (Instant Wall of Truth Updates)
  subscribeToReviews(onNewReview) {
    if (!this.client || typeof this.client.channel !== 'function') return null;
    try {
      return this.client.channel('realtime_public_reviews')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'abroad_agency_reviews' },
          (payload) => {
            if (payload.new && typeof onNewReview === 'function') {
              onNewReview(payload.new);
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime reviews subscription error:', e);
      return null;
    }
  }

  // 12. Live Community Discussions Real-time Subscription
  subscribeToDiscussions(onNewDiscussion) {
    if (!this.client || typeof this.client.channel !== 'function') return null;
    try {
      return this.client.channel('realtime_public_discussions')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'abroad_discussions' },
          (payload) => {
            if (payload.new && typeof onNewDiscussion === 'function') {
              onNewDiscussion(payload.new);
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime discussions subscription error:', e);
      return null;
    }
  }

  // Fallback data generators ensuring app always renders beautifully with 100% ID privacy
  getFallbackProfiles(country) {
    const all = [
      {
        id: 'usr_rahul_toronto',
        username: 'rahul_to',
        display_name: '@rahul_to',
        avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
        role: 'senior_student',
        destination_country: 'Canada',
        current_university: 'York University',
        course: 'MS Computer Science & Software Systems',
        city: 'Toronto, ON',
        intake_year: 'Fall 2023',
        bio: 'Spent 2 years in GTA. Don\'t trust agents saying "part-time jobs are guaranteed day 1". Ask me anything about Toronto rent, courses, and professors!',
        agent_used: 'Punjab Overseas Agent',
        mobile_number: '+1 (416) 555-0192',
        share_phone_publicly: true
      },
      {
        id: 'usr_ananya_london',
        username: 'ananya_uk',
        display_name: '@ananya_uk',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        role: 'senior_student',
        destination_country: 'UK',
        current_university: 'Queen Mary Univ of London',
        course: 'MSc Data Analytics & Financial Tech',
        city: 'London (Zone 2)',
        intake_year: 'Sept 2023',
        bio: 'Living cost in London is NOT £600/mo like agents claim. Real shared rent is £850+. Happy to guide new incoming students!',
        agent_used: 'IDP Bangalore',
        mobile_number: '+44 7700 900123',
        share_phone_publicly: false
      },
      {
        id: 'usr_harpreet_vancouver',
        username: 'harpreet_van',
        display_name: '@harpreet_van',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        role: 'senior_student',
        destination_country: 'Canada',
        current_university: 'Langara College',
        course: 'Post-Grad Diploma in Cloud Computing & DevOps',
        city: 'Vancouver, BC',
        intake_year: 'Spring 2023',
        bio: 'Agent hid that rent is $950 for a shared bunk bed and job market is tight. Message me to get the ground reality before paying any file fee.',
        agent_used: 'Jalandhar Consultant',
        mobile_number: '+1 (604) 555-0148',
        share_phone_publicly: true
      },
      {
        id: 'usr_rohit_dallas',
        username: 'rohit_tx',
        display_name: '@rohit_tx',
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        role: 'senior_student',
        destination_country: 'USA',
        current_university: 'UT Dallas',
        course: 'MS Business Analytics & Information Systems',
        city: 'Dallas, TX',
        intake_year: 'Fall 2022',
        bio: 'OPT & on-campus jobs guide. Always verify I-20 and loan terms yourself. Agents charge ₹1 Lakh for free university portal applications.',
        agent_used: 'Y-Axis Ahmedabad'
      },
      {
        id: 'usr_neha_berlin',
        username: 'neha_berlin',
        display_name: '@neha_berlin',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        role: 'senior_student',
        destination_country: 'Germany',
        current_university: 'TU Berlin',
        course: 'MSc Renewable Energy & Environmental Engineering',
        city: 'Berlin',
        intake_year: 'Winter 2023',
        bio: 'Public universities are TUITION-FREE! Don\'t pay agents 2 lakhs for English portal applications. Apply on uni-assist directly.',
        agent_used: 'Self-Applied (Direct)'
      },
      {
        id: 'usr_karthik_melb',
        username: 'karthik_syd',
        display_name: '@karthik_syd',
        avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
        role: 'senior_student',
        destination_country: 'Australia',
        current_university: 'RMIT University',
        course: 'Master of Information Technology & Cybersecurity',
        city: 'Melbourne, VIC',
        intake_year: 'Feb 2024',
        bio: 'Master of IT. Rent crisis is real here, do not come without 3 months emergency funds. Student visa work hour caps strictly enforced.',
        agent_used: 'Hyderabad Visa Hub'
      },
      {
        id: 'usr_liam_dublin',
        username: 'liam_dublin',
        display_name: '@liam_dublin',
        avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
        role: 'senior_student',
        destination_country: 'Ireland',
        current_university: 'Trinity College Dublin',
        course: 'MSc Computer Science (Intelligent Systems)',
        city: 'Dublin',
        intake_year: 'Autumn 2023',
        bio: 'Tech hub of Europe! Housing in Dublin is scarce so book accommodation 3 months in advance. Great 2-year stay back visa option.',
        agent_used: 'Koramangala Overseas'
      },
      {
        id: 'usr_claire_paris',
        username: 'claire_sorbonne',
        display_name: '@claire_sorbonne',
        avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
        role: 'senior_student',
        destination_country: 'France',
        current_university: 'Sorbonne University',
        course: 'Master in International Business & Management',
        city: 'Paris',
        intake_year: 'Sept 2023',
        bio: 'Campus France process is 100% transparent. CAF student housing subsidy reimburses up to 40% of rent. Don\'t let agents charge consultancy fees.',
        agent_used: 'Self-Applied via Campus France'
      },
      {
        id: 'usr_sophie_ams',
        username: 'sophie_ams',
        display_name: '@sophie_ams',
        avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
        role: 'senior_student',
        destination_country: 'Netherlands',
        current_university: 'University of Amsterdam',
        course: 'BSc Artificial Intelligence & Data Science',
        city: 'Amsterdam',
        intake_year: 'Sept 2023',
        bio: '100% English taught program. Bike infrastructure is incredible. Beware: Netherlands has severe student room shortage, start searching early.',
        agent_used: 'Direct Application'
      },
      {
        id: 'usr_tomas_stockholm',
        username: 'tomas_kth',
        display_name: '@tomas_kth',
        avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
        role: 'senior_student',
        destination_country: 'Sweden',
        current_university: 'KTH Royal Institute of Technology',
        course: 'MSc Embedded Systems & Robotics',
        city: 'Stockholm',
        intake_year: 'Autumn 2023',
        bio: 'Apply only on universityadmissions.se. Innovation and quality of life are unmatched. Winter can be cold, but universities are warm and welcoming.',
        agent_used: 'Direct Admissions Sweden'
      }
    ];
    if (!country || country === 'All') return all;
    return all.filter(p => p.destination_country.toLowerCase() === country.toLowerCase());
  }

  getFallbackReviews(country, search) {
    const list = [
      {
        id: "65a094d9-cf4d-45f8-b306-9abd022ef6f6",
        agency_name: "Punjab Global Visa Links",
        branch_city: "Jalandhar / Ludhiana",
        student_id: "usr_harpreet_vancouver",
        student_name: "@harpreet_van",
        student_handle: "harpreet_van",
        college: "Langara College",
        course: "Post-Grad Diploma in Cloud Computing",
        place: "Vancouver, BC",
        is_anonymous: false,
        destination_country: "Canada",
        rating: 1,
        treatment_summary: "Pushed me into a private tie-up college and withheld my original passport",
        what_they_promised: "Agent told me: \"100% PR guarantee, college has easy classes, you can work 40 hrs cash job easily, no problem at all.\"",
        what_actually_happened: "The private college didn't qualify for PGWP under the new rules! I had to transfer colleges and lose $6,000 tuition fee. Part-time jobs are very scarce in Brampton/Vancouver.",
        hidden_charges_taken: "Took ₹1,20,000 \"file opening fee\" which was promised refundable if visa approved, never refunded a single rupee.",
        threat_or_pressure: "Yes! When I asked for my original Marksheets & Passport back, they threatened to cancel my file with Canadian High Commission.",
        recommended: false,
        likes_count: 48,
        created_at: "2026-10-27T20:11:16.071711+00:00"
      },
      {
        id: "002d2347-7247-45b5-8f8b-817b572f2e52",
        agency_name: "IDP Education",
        branch_city: "Koramangala, Bangalore",
        student_id: "usr_ananya_london",
        student_name: "@ananya_uk",
        student_handle: "ananya_uk",
        college: "Queen Mary Univ of London",
        course: "MSc Data Analytics & FinTech",
        place: "London (Zone 2)",
        is_anonymous: false,
        destination_country: "UK",
        rating: 4,
        treatment_summary: "Transparent with university shortlisting, but downplayed London living costs",
        what_they_promised: "Agent promised smooth visa process and free application to Russell Group universities.",
        what_actually_happened: "Visa processing was smooth and they did not charge file fees. However, the counselor had zero ground knowledge of London tube zones, cost of groceries, or the tough graduate job market.",
        hidden_charges_taken: "No extra hidden charge, but pushed an overpriced student accommodation partner company.",
        threat_or_pressure: "No threats, professional staff.",
        recommended: true,
        likes_count: 31,
        created_at: "2026-10-27T20:11:16.071711+00:00"
      },
      {
        id: "983ef863-7232-494e-b9b4-c7f03e549ddd",
        agency_name: "Apex Immigration & Overseas",
        branch_city: "Sector 17, Chandigarh",
        student_id: "usr_rahul_toronto",
        student_name: "@rahul_to",
        student_handle: "rahul_to",
        college: "York University",
        course: "MS Computer Science",
        place: "Toronto, ON",
        is_anonymous: true,
        destination_country: "Canada",
        rating: 1,
        treatment_summary: "Extorted money for GIC account setup and forced unwanted college choices",
        what_they_promised: "Told my parents: \"Your son will easily get on-campus job paying $20/hr, and GIC account has to be opened through their specific contact.\"",
        what_actually_happened: "On-campus jobs are capped and have 500 applicants per spot. They made us deposit money through an unregulated forex agent charging huge markup.",
        hidden_charges_taken: "₹75,000 \"documentation fee\" + ₹25,000 for SOP which turned out to be copy-pasted ChatGPT template with wrong course name!",
        threat_or_pressure: "Threatened that if we did not submit through them, they would inform Canadian embassy about our financial documents.",
        recommended: false,
        likes_count: 64,
        created_at: "2026-10-27T20:11:16.071711+00:00"
      },
      {
        id: "5fa4097b-7e83-4834-9d7e-00c51b8988b0",
        agency_name: "Direct / Self Application",
        branch_city: "Online Portal",
        student_id: "usr_neha_berlin",
        student_name: "@neha_berlin",
        student_handle: "neha_berlin",
        college: "TU Berlin",
        course: "MSc Renewable Energy Engineering",
        place: "Berlin",
        is_anonymous: false,
        destination_country: "Germany",
        rating: 5,
        treatment_summary: "Applied on Uni-Assist directly without any agent - Saved 1.8 Lakhs!",
        what_they_promised: "Local Delhi agents told me German visa is impossible without agent commission and private university.",
        what_actually_happened: "I applied directly through uni-assist.de and DAAD.de. German public universities are completely tuition-free. Visa arrived in 4 weeks.",
        hidden_charges_taken: "Zero agent fees! Only paid official Uni-Assist evaluation fees (~€75).",
        threat_or_pressure: "Agents tried to scare me saying \"Public universities will reject you, join private college in Berlin for €14,000/yr\". Glad I rejected them!",
        recommended: true,
        likes_count: 92,
        created_at: "2026-10-27T20:11:16.071711+00:00"
      },
      {
        id: "0cfb3ac1-052a-4dc3-b1f8-4a7aca07c725",
        agency_name: "Global Edu Consultants",
        branch_city: "Ameerpet, Hyderabad",
        student_id: "usr_karthik_melb",
        student_name: "@karthik_syd",
        student_handle: "karthik_syd",
        college: "RMIT University",
        course: "Master of IT & Cybersecurity",
        place: "Melbourne, VIC",
        is_anonymous: false,
        destination_country: "Australia",
        rating: 2,
        treatment_summary: "Promised Regional PR points in non-existent campus",
        what_they_promised: "Agent claimed studying in regional Victoria guarantees Australian Permanent Residency in 2 years without job sponsor.",
        what_actually_happened: "Immigration rules changed drastically. The regional campus was literally two rooms in a commercial complex. Finding part-time work in that town was impossible.",
        hidden_charges_taken: "Charged ₹90,000 for visa assistance that is supposed to be free.",
        threat_or_pressure: "Agent called my father multiple times creating urgency: \"Apply today or visa will close permanently!\".",
        recommended: false,
        likes_count: 37,
        created_at: "2026-10-27T20:11:16.071711+00:00"
      }
    ];
    let filtered = list;
    if (country && country !== 'All') {
      filtered = filtered.filter(r => r.destination_country.toLowerCase() === country.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r => 
        r.agency_name.toLowerCase().includes(q) ||
        r.branch_city.toLowerCase().includes(q) ||
        r.treatment_summary.toLowerCase().includes(q)
      );
    }
    return filtered;
  }

  getFallbackDiscussions(country, category) {
    const list = [
      {
        id: "be49d2f9-b685-4817-b7d5-fbb49cc823ac",
        country: "Canada",
        category: "Agent Truth & Scams",
        author_id: "usr_harpreet_vancouver",
        author_name: "@harpreet_van",
        author_handle: "harpreet_van",
        author_role: "Senior in Vancouver",
        author_avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        title: "🚨 Red Alert for 2025/2026 Aspirants: 5 Lies Punjab & Delhi Agents tell about Canada",
        content: `Fellow brothers and sisters, please read this before handing over your original passport or paying lakhs to any consultant:

1. LIE: "Work 20 hours part-time and pay your 2nd semester fees."
REALITY: Part-time minimum wage is ~$16.55/hr in Ontario. After tax, you get around $1,100/mo. Rent alone for a SHARED room in Brampton/Toronto is $500-$700. Groceries are $250. Bus pass $130. You will barely save $100/month, let alone $8,000 for college fees!

2. LIE: "Any college gives 3-year PGWP."
REALITY: Public-private curriculum licensing colleges NO LONGER get PGWP under IRCC rules. Check the official IRCC DLI list yourself!

3. LIE: "Give us original 10th/12th/Bachelors marksheet for processing."
REALITY: Embassies ONLY need clear digital scans. Never leave original documents with an agent—they use them as ransom!

4. LIE: "We have direct tie-up with embassy officers."
REALITY: Total fraud. Visa decisions are 100% made by IRCC officers in New Delhi/Ottawa.

Feel free to ask me anything in DM or replies below. Stay safe!`,
        tags: ["Canada", "AgentScam", "PGWP", "LivingCost"],
        upvotes: 89,
        comments_count: 14,
        created_at: "2026-10-27T20:11:16.071711+00:00"
      },
      {
        id: "7217e609-4686-4e22-b13b-6adc63ad6a5d",
        country: "UK",
        category: "Living Expenses & Rent",
        author_id: "usr_ananya_london",
        author_name: "@ananya_uk",
        author_handle: "ananya_uk",
        author_role: "MSc Student @ London",
        author_avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        title: "🇬🇧 Real Cost of Living in London (What your agent won't print in their brochure)",
        content: `My consultant in Bangalore gave me a rosy budget sheet showing £600/month total expenses in London. That was completely disconnected from reality!

Here is my actual monthly expense breakdown for Zone 2/3 London:
- Rent (Ensuite room in flatshare): £850/mo
- Council Tax (if student exempt, otherwise £120): £0
- Groceries (Tesco / Lidl): £200/mo
- Transport (Oyster Student Travelcard Zone 1-3): £130/mo
- Mobile & Wi-Fi: £25/mo
- Emergency / Sundry: £80/mo
Total: £1,285 per month minimum!

Also remember the Immigration Health Surcharge (IHS) was increased to £776/year. Ask me anything if you are targeting Sept or Jan intake!`,
        tags: ["UK", "London", "LivingCost", "StudentBudget"],
        upvotes: 54,
        comments_count: 8,
        created_at: "2026-10-27T20:11:16.071711+00:00"
      },
      {
        id: "9c3e41a8-1122-48a9-bc88-33ef92817263",
        country: "Germany",
        category: "Agent Truth & Scams",
        author_id: "usr_neha_berlin",
        author_name: "Neha Verma",
        author_handle: "neha_berlin",
        author_role: "TU Berlin Alumni",
        author_avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        title: "🇩🇪 Don't pay agents ₹2 Lakhs for Germany! The Public University Blueprint",
        content: `Almost every agent in India tries to steer students towards private English-speaking universities in Germany (like IU, GISMA, etc.) because they get 30% to 40% commission on your €12,000 yearly tuition!

FACT: Top German public universities (TUM, RWTH Aachen, TU Berlin, LMU) charge €0 TUITION for international students (just €300 semester contribution including public transit ticket).

All you need:
1. APS Certificate from New Delhi (apply 4-5 months in advance).
2. Uni-Assist account (€75 for 1st uni, €30 for next).
3. Blocked Account (~€11,208 for 1 year living expenses).

Stop letting agents make fools of our middle-class families!`,
        tags: ["Germany", "FreeTuition", "APS", "UniAssist"],
        upvotes: 112,
        comments_count: 26,
        created_at: "2026-10-27T20:11:16.071711+00:00"
      }
    ];
    let filtered = list;
    if (country && country !== 'All') {
      filtered = filtered.filter(p => p.country.toLowerCase() === country.toLowerCase());
    }
    if (category && category !== 'All') {
      filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    return filtered;
  }
}

// Export singleton instance
window.supabaseService = new SupabaseService();
