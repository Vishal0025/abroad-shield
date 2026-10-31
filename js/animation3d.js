/**
 * AbroadShield Club - 3D Interactive Visual Engine
 * Features:
 * 1. Interactive 3D Holographic Particle Globe (Global Student Hubs)
 * 2. 3D Perspective Card Tilt & Holographic Specular Glare
 * 3. 3D Floating Depth Layering & Tab View Entrances
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    init3DGlobeCanvas();
    init3DCardTiltEngine();
    init3DTabTransitions();
  });

  // ====================================================================
  // 1. Interactive 3D Holographic Particle Globe (Global Student Hubs)
  // ====================================================================
  function init3DGlobeCanvas() {
    const heroCard = document.querySelector('.hero-card');
    if (!heroCard) return;

    // Create Canvas if not already present
    let canvas = document.getElementById('hero3dGlobeCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'hero3dGlobeCanvas';
      canvas.className = 'hero-3d-globe-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      heroCard.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;

    function resize() {
      const rect = heroCard.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    // 3D Point cloud representing the globe
    const GLOBE_RADIUS = Math.min(260, Math.max(160, width * 0.22));
    const NUM_POINTS = 160;
    const points = [];

    // Fibonacci sphere distribution for uniform 3D sphere points
    const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
    for (let i = 0; i < NUM_POINTS; i++) {
      const y = 1 - (i / (NUM_POINTS - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      points.push({
        origX: x * GLOBE_RADIUS,
        origY: y * GLOBE_RADIUS,
        origZ: z * GLOBE_RADIUS,
        x: 0, y: 0, z: 0,
        projX: 0, projY: 0, scale: 0,
        color: i % 7 === 0 ? '#10b981' : (i % 4 === 0 ? '#f59e0b' : '#06b6d4'),
        size: i % 9 === 0 ? 3.5 : (i % 3 === 0 ? 2.5 : 1.8),
        pulse: Math.random() * Math.PI
      });
    }

    // Global Key Hub Cities with pulsing labels (Toronto, London, Dallas, Berlin, Melbourne, Dublin, Paris)
    const KEY_HUBS = [
      { name: '🇨🇦 Toronto', lat: 43.65, lon: -79.38 },
      { name: '🇬🇧 London', lat: 51.50, lon: -0.12 },
      { name: '🇺🇸 Dallas', lat: 32.77, lon: -96.79 },
      { name: '🇩🇪 Berlin', lat: 52.52, lon: 13.40 },
      { name: '🇦🇺 Melbourne', lat: -37.81, lon: 144.96 },
      { name: '🇮🇪 Dublin', lat: 53.34, lon: -6.26 },
      { name: '🇫🇷 Paris', lat: 48.85, lon: 2.35 },
      { name: '🇳🇱 Amsterdam', lat: 52.36, lon: 4.90 },
      { name: '🇸🇪 Stockholm', lat: 59.32, lon: 18.06 },
      { name: '🇸🇬 Singapore', lat: 1.35, lon: 103.81 }
    ];

    const hubPoints = KEY_HUBS.map(hub => {
      const latRad = (hub.lat * Math.PI) / 180;
      const lonRad = (hub.lon * Math.PI) / 180;
      const x = Math.cos(latRad) * Math.sin(lonRad) * GLOBE_RADIUS;
      const y = -Math.sin(latRad) * GLOBE_RADIUS;
      const z = Math.cos(latRad) * Math.cos(lonRad) * GLOBE_RADIUS;
      return {
        name: hub.name,
        origX: x, origY: y, origZ: z,
        x: 0, y: 0, z: 0, projX: 0, projY: 0, scale: 0
      };
    });

    // Rotation Angles & Inertia
    let rotX = 0.2;
    let rotY = 0;
    let targetSpeedY = 0.004;
    let targetSpeedX = 0;
    let currentSpeedY = 0.004;
    let currentSpeedX = 0;
    let mouseInteracting = false;

    heroCard.addEventListener('mousemove', (e) => {
      const rect = heroCard.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / rect.width - 0.5;
      const mouseY = (e.clientY - rect.top) / rect.height - 0.5;
      targetSpeedY = mouseX * 0.02;
      targetSpeedX = -mouseY * 0.015;
      mouseInteracting = true;
    });

    heroCard.addEventListener('mouseleave', () => {
      mouseInteracting = false;
      targetSpeedY = 0.004;
      targetSpeedX = 0;
    });

    // Render Loop
    let animFrameId = null;
    const fov = 420;

    function render3D() {
      ctx.clearRect(0, 0, width, height);

      // Smooth inertia rotation
      currentSpeedY += (targetSpeedY - currentSpeedY) * 0.05;
      currentSpeedX += (targetSpeedX - currentSpeedX) * 0.05;
      rotY += currentSpeedY;
      rotX += currentSpeedX;

      // Restrict rotX to prevent flipping
      rotX = Math.max(-0.6, Math.min(0.6, rotX));

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Center globe on the right portion of the hero card
      const centerX = width > 850 ? width * 0.72 : width * 0.5;
      const centerY = height * 0.5;

      // Project points
      points.forEach(p => {
        // Rotate around Y axis
        let x1 = p.origX * cosY - p.origZ * sinY;
        let z1 = p.origZ * cosY + p.origX * sinY;
        // Rotate around X axis
        let y2 = p.origY * cosX - z1 * sinX;
        let z2 = z1 * cosX + p.origY * sinX;

        p.x = x1;
        p.y = y2;
        p.z = z2;

        const scale = fov / (fov + z2 + GLOBE_RADIUS);
        p.scale = scale;
        p.projX = centerX + x1 * scale;
        p.projY = centerY + y2 * scale;
        p.pulse += 0.04;
      });

      // Draw 3D connecting constellation arcs between nearby points
      const maxDist = GLOBE_RADIUS * 0.42;
      ctx.lineWidth = 0.8;
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        if (p1.z < -GLOBE_RADIUS * 0.3) continue; // skip points hidden on back of globe

        for (let j = i + 1; j < Math.min(i + 14, points.length); j++) {
          const p2 = points[j];
          if (p2.z < -GLOBE_RADIUS * 0.3) continue;

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dz = p1.z - p2.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.28 * Math.max(0.1, (p1.z + GLOBE_RADIUS) / (2 * GLOBE_RADIUS));
            ctx.strokeStyle = `rgba(6, 182, 212, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(p1.projX, p1.projY);
            ctx.lineTo(p2.projX, p2.projY);
            ctx.stroke();
          }
        }
      }

      // Draw sphere points with 3D depth coloring
      points.forEach(p => {
        const depthNorm = (p.z + GLOBE_RADIUS) / (2 * GLOBE_RADIUS); // 0 (back) to 1 (front)
        if (depthNorm < 0.05) return;

        const pulseSize = Math.sin(p.pulse) * 0.8;
        const radius = Math.max(0.8, (p.size + pulseSize) * p.scale);
        const alpha = Math.min(1, Math.max(0.15, depthNorm * 0.95));

        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.projX, p.projY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Glowing outer halo for front-facing prominent nodes
        if (depthNorm > 0.65 && p.size > 2.5) {
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = alpha * 0.4;
          ctx.beginPath();
          ctx.arc(p.projX, p.projY, radius * 2.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Project and draw Key Hub Cities
      hubPoints.forEach(hub => {
        let x1 = hub.origX * cosY - hub.origZ * sinY;
        let z1 = hub.origZ * cosY + hub.origX * sinY;
        let y2 = hub.origY * cosX - z1 * sinX;
        let z2 = z1 * cosX + hub.origY * sinX;

        hub.x = x1; hub.y = y2; hub.z = z2;
        const scale = fov / (fov + z2 + GLOBE_RADIUS);
        hub.scale = scale;
        hub.projX = centerX + x1 * scale;
        hub.projY = centerY + y2 * scale;

        // Only draw city label if hub is facing the viewer
        if (z2 > -GLOBE_RADIUS * 0.1) {
          const alpha = Math.min(1, Math.max(0.2, (z2 + GLOBE_RADIUS * 0.5) / (GLOBE_RADIUS * 1.5)));

          // Beacon dot
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(hub.projX, hub.projY, 4 * scale, 0, Math.PI * 2);
          ctx.fill();

          // Pulsing wave
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1;
          ctx.globalAlpha = alpha * 0.5;
          ctx.beginPath();
          ctx.arc(hub.projX, hub.projY, 9 * scale, 0, Math.PI * 2);
          ctx.stroke();

          // Text pill
          if (scale > 0.75) {
            ctx.font = '600 10px Plus Jakarta Sans, sans-serif';
            const textWidth = ctx.measureText(hub.name).width;
            ctx.fillStyle = 'rgba(11, 17, 32, 0.75)';
            ctx.fillRect(hub.projX + 7, hub.projY - 9, textWidth + 8, 16);
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
            ctx.strokeRect(hub.projX + 7, hub.projY - 9, textWidth + 8, 16);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(hub.name, hub.projX + 11, hub.projY + 3);
          }
        }
      });

      ctx.globalAlpha = 1.0;
      animFrameId = requestAnimationFrame(render3D);
    }

    animFrameId = requestAnimationFrame(render3D);
  }

  // ====================================================================
  // 2. 3D Perspective Card Tilt & Holographic Specular Glare
  // ====================================================================
  function init3DCardTiltEngine() {
    const TILT_SELECTORS = [
      '.hero-card',
      '.senior-profile-card',
      '.review-card',
      '.agent-wall-crowdsource-card',
      '.scanner-card',
      '.admin-stat-card'
    ];

    function attachTilt(el) {
      if (el.dataset.tiltAttached === 'true') return;
      el.dataset.tiltAttached = 'true';

      // Create glare layer if not present
      let glare = el.querySelector('.card-3d-glare');
      if (!glare) {
        glare = document.createElement('div');
        glare.className = 'card-3d-glare';
        glare.setAttribute('aria-hidden', 'true');
        el.appendChild(glare);
      }

      let isHovered = false;
      let reqId = null;
      let targetRotX = 0;
      let targetRotY = 0;
      let currentRotX = 0;
      let currentRotY = 0;
      let glareX = 50;
      let glareY = 50;
      let glareOpacity = 0;

      function updateTransform() {
        if (!isHovered && Math.abs(currentRotX) < 0.05 && Math.abs(currentRotY) < 0.05) {
          el.style.transform = '';
          glare.style.opacity = '0';
          return;
        }

        currentRotX += (targetRotX - currentRotX) * 0.12;
        currentRotY += (targetRotY - currentRotY) * 0.12;

        const maxScale = el.classList.contains('hero-card') ? 1.005 : 1.025;
        el.style.transform = `perspective(1000px) rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg) scale3d(${maxScale}, ${maxScale}, ${maxScale})`;
        
        glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(6, 182, 212, 0.22), transparent 60%)`;
        glare.style.opacity = glareOpacity.toString();

        reqId = requestAnimationFrame(updateTransform);
      }

      el.addEventListener('mouseenter', () => {
        isHovered = true;
        glareOpacity = 1;
        if (!reqId) reqId = requestAnimationFrame(updateTransform);
      });

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const normX = (mouseX / rect.width) * 2 - 1; // -1 to +1
        const normY = (mouseY / rect.height) * 2 - 1; // -1 to +1

        const maxTilt = el.classList.contains('hero-card') ? 3.5 : 7.5;
        targetRotX = -normY * maxTilt;
        targetRotY = normX * maxTilt;

        glareX = Math.round((mouseX / rect.width) * 100);
        glareY = Math.round((mouseY / rect.height) * 100);
      });

      el.addEventListener('mouseleave', () => {
        isHovered = false;
        targetRotX = 0;
        targetRotY = 0;
        glareOpacity = 0;
      });
    }

    // Bind to currently rendered cards
    function bindAllCards() {
      TILT_SELECTORS.forEach(selector => {
        document.querySelectorAll(selector).forEach(attachTilt);
      });
    }
    bindAllCards();

    // Re-bind when dynamic DOM elements are inserted (seniors, reviews, discussions)
    const observer = new MutationObserver(() => {
      bindAllCards();
    });
    const mainContainer = document.querySelector('.main-app-container') || document.body;
    observer.observe(mainContainer, { childList: true, subtree: true });
  }

  // ====================================================================
  // 3. 3D Tab View Transitions
  // ====================================================================
  function init3DTabTransitions() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = `view-${btn.dataset.tab}`;
        const activeView = document.getElementById(targetId);
        if (activeView) {
          activeView.classList.remove('tab-enter-3d');
          void activeView.offsetWidth; // trigger reflow
          activeView.classList.add('tab-enter-3d');
        }
      });
    });
  }

})();
