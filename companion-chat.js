// =====================================================
// HONESTLY, E — Companion Chat Widget (marketing / anonymous)
//
// The Sophie-style pill → hero-alongside-thread panel, plus the
// in-widget "be remembered" verify funnel that turns an anonymous
// prospect into a recognized, persistent identity.
//
// SAFETY: this is the on-ramp TO recognition, never a modifier of it.
// It only ever calls the parallel anonymous + bridge endpoints:
//   POST /api/he-chat/anon/message            (anonymous Take-5 chat)
//   POST /api/he-chat/anon/sessions/:id/end   (best-effort summary)
//   POST /api/he-chat/anon/capture-email      (stamp email on anon sessions)
//   POST /api/take5/generate-code             (Twilio SMS code → phone)
//   POST /api/take5/claim                      (phone+code+email → identity)
// It never touches the subscriber recognition pipeline.
//
// Recognition is PHONE-keyed: the phone is the identity, the email rides
// along. No phone → no identity → no recognition. The funnel enforces it.
//
// Usage:  CompanionChat.init({ companion: 'ellis' })   // reads the rest from the map
//         (or pass name/role/image/accent/apiBase to override)
// =====================================================

(function () {
  'use strict';

  const API_BASE = 'https://desta-nation-core-production.up.railway.app';
  const PORTAL_URL = 'https://life.honestly-e.com';
  const CDN = 'https://desta-cdn.creator-17a.workers.dev/desta-nation-assets';
  const R2 = 'https://pub-bd1937786ce445ed93435b74610b5b73.r2.dev';
  const UUID_KEY = 'he_anon_uuid';

  // Self-contained companion identity map (name / role line / hero image /
  // accent). Sourced from the portal config + marketing accent tokens so the
  // widget needs nothing from the page but the slug.
  const COMPANIONS = {
    ellis: { name: 'Ellis', role: 'For the big questions',        image: `${CDN}/honestly-e/images/Ellis.png`,  accent: '#8B6B4A' },
    ellie: { name: 'Ellie', role: 'Plant some seeds, see what takes root', image: `${CDN}/honestly-e/images/Ellie.png`, accent: '#7A8B78' },
    essie: { name: 'Essie', role: 'For young voices',             image: `${R2}/Essie2026.3.png`,               accent: '#8B6B7D' },
    ezra:  { name: 'Ezra',  role: 'Grounded perspective',         image: `${R2}/Ezra2026.png`,                  accent: '#7B6B4A' },
    ellen: { name: 'Ellen', role: 'Your life story',              image: `${R2}/Ellen_Kitchen.png`,             accent: '#7D5A6B' },
    emory: { name: 'Emory', role: 'The truth looks good on you',  image: `${CDN}/honestly-e/images/Emory26.png`, accent: '#6B7B8C' },
    erik:  { name: 'Erik',  role: 'Straightforward support',      image: `${R2}/Erik_Truck.png`,                accent: '#5B7B8C' },
    eddie: { name: 'Eddie', role: 'Real talk',                    image: `${R2}/Eddie2026.png`,                 accent: '#8B7535' },
    elias: { name: 'Elias', role: 'Deepen your perspective',      image: `${CDN}/honestly-e/images/Elias-3.png`, accent: '#C9A24B' },
    ella:  { name: 'Ella',  role: 'Meets you where you are',      image: `${R2}/Ella.png`,                      accent: '#B8493C' },
    elif:  { name: 'Elif',  role: 'Take care of what matters',    image: `${R2}/Elif-LIFE.png`,                 accent: '#4F7470' },
    ember: { name: 'Ember', role: 'Let me get you out of the weeds', image: `${R2}/Ember2.png`,                 accent: '#B5552A' },
  };

  // ---- small helpers ------------------------------------------------
  function uuid() {
    let u = null;
    try { u = localStorage.getItem(UUID_KEY); } catch (e) {}
    if (!u) {
      u = (crypto.randomUUID && crypto.randomUUID()) ||
          ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          }));
      try { localStorage.setItem(UUID_KEY, u); } catch (e) {}
    }
    return u;
  }

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  async function api(path, body, extraHeaders) {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {}),
      body: JSON.stringify(body || {})
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  }

  // ---- widget -------------------------------------------------------
  const CompanionChat = {
    init(cfg) {
      cfg = cfg || {};
      // Resolve legacy slugs (esme.html kept its filename after the Ella rename).
      const ALIASES = { esme: 'ella' };
      let slug = (cfg.companion || document.body.dataset.companionSlug || '').toLowerCase();
      slug = ALIASES[slug] || slug;
      const base = COMPANIONS[slug] || {};
      const c = {
        slug,
        name:  cfg.name  || base.name  || 'E',
        role:  cfg.role  || base.role  || '',
        image: cfg.image || base.image || '',
        accent: cfg.accent || base.accent || '#8B6B4A',
        apiBase: cfg.apiBase || API_BASE,
      };
      if (!slug) { console.warn('[companion-chat] no companion slug; not mounting'); return; }

      const state = {
        sessionId: null,
        sending: false,
        userTurns: 0,
        verified: false,
        bannerShown: false,
        verifyStep: 'phone',  // phone | code | success
        phone: '',
      };

      // ---- DOM ----
      const root = el('div', 'cc-root');
      root.style.setProperty('--cc-accent', c.accent);
      // Flip button text to dark on light accents (e.g. Elias's gold) for legibility.
      (function (hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
        if (!m) return;
        const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        root.style.setProperty('--cc-on-accent', lum > 0.62 ? '#2b2622' : '#fff');
      })(c.accent);

      const pill = el('button', 'cc-pill');
      pill.innerHTML =
        `<img class="cc-pill__avatar" src="${c.image}" alt="${c.name}">` +
        `<span>Chat with ${c.name}</span>`;

      const panel = el('div', 'cc-panel');
      panel.hidden = true;
      panel.innerHTML = `
        <div class="cc-hero" style="background-image:url('${c.image}')">
          <div class="cc-hero__id">
            <div class="cc-hero__name">${c.name}</div>
            <div class="cc-hero__role">${c.role}</div>
          </div>
        </div>
        <div class="cc-main">
          <div class="cc-head">
            <div class="cc-head__title">Chat with ${c.name}</div>
            <button class="cc-close" aria-label="Close">&times;</button>
          </div>
          <div class="cc-thread" role="log"></div>
          <div class="cc-remember" hidden>
            <span class="cc-remember__text">Want ${c.name} to actually remember you next time? It’s free.</span>
            <div><button class="cc-remember__cta">Let ${c.name} remember me</button></div>
          </div>
          <div class="cc-compose">
            <textarea class="cc-input" rows="1" placeholder="Tell ${c.name} what’s on your mind…"></textarea>
            <button class="cc-send">Send</button>
          </div>

          <div class="cc-verify" hidden></div>
        </div>`;

      root.appendChild(pill);
      root.appendChild(panel);
      document.body.appendChild(root);

      // refs
      const thread   = panel.querySelector('.cc-thread');
      const input    = panel.querySelector('.cc-input');
      const sendBtn  = panel.querySelector('.cc-send');
      const closeBtn = panel.querySelector('.cc-close');
      const banner   = panel.querySelector('.cc-remember');
      const bannerBtn= panel.querySelector('.cc-remember__cta');
      const verify   = panel.querySelector('.cc-verify');

      // ---- thread rendering ----
      function addMsg(role, text) {
        const m = el('div', 'cc-msg ' + (role === 'you' ? 'cc-msg--you' : 'cc-msg--them'));
        const b = el('div', 'cc-msg__bubble');
        b.textContent = text;
        m.appendChild(b);
        thread.appendChild(m);
        thread.scrollTop = thread.scrollHeight;
        return m;
      }
      function showTyping() {
        const t = el('div', 'cc-typing', `${c.name} is typing…`);
        thread.appendChild(t);
        thread.scrollTop = thread.scrollHeight;
        return t;
      }

      function maybeShowBanner() {
        if (state.verified || state.bannerShown) return;
        if (state.userTurns >= 2) { banner.hidden = false; state.bannerShown = true; }
      }

      // ---- open / close ----
      function open() {
        pill.hidden = true;
        panel.hidden = false;
        requestAnimationFrame(() => panel.classList.add('cc-open'));
        if (!thread.childElementCount) {
          addMsg('them', `Hi, I’m ${c.name}. What’s on your mind?`);
        }
        input.focus();
      }
      function close() {
        panel.classList.remove('cc-open');
        setTimeout(() => { panel.hidden = true; pill.hidden = false; }, 180);
      }
      pill.addEventListener('click', open);
      closeBtn.addEventListener('click', close);

      // ---- send ----
      async function send() {
        const text = input.value.trim();
        if (!text || state.sending) return;
        state.sending = true;
        sendBtn.disabled = true;
        input.value = '';
        input.style.height = 'auto';
        addMsg('you', text);
        state.userTurns++;
        const typing = showTyping();

        try {
          const { data } = await api('/api/he-chat/anon/message',
            { companion: c.slug, sessionId: state.sessionId, text },
            { 'X-Anon-Session-UUID': uuid() });
          typing.remove();

          if (data.gated) {
            addMsg('them', data.message || 'Let’s keep this going on Honestly, E.');
            // The gate is the strongest moment to invite the free identity link.
            banner.hidden = false; state.bannerShown = true;
          } else if (data.message) {
            state.sessionId = data.sessionId || state.sessionId;
            addMsg('them', data.message.content);
            maybeShowBanner();
          } else {
            addMsg('them', 'Sorry — something hiccuped. Try once more?');
          }
        } catch (e) {
          typing.remove();
          addMsg('them', 'I lost the thread there for a second. Try again?');
        } finally {
          state.sending = false;
          sendBtn.disabled = false;
          input.focus();
        }
      }
      sendBtn.addEventListener('click', send);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 96) + 'px';
      });

      // ---- end session (best effort) ----
      function endSession() {
        if (!state.sessionId) return;
        try {
          const url = `${API_BASE}/api/he-chat/anon/sessions/${state.sessionId}/end`;
          const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
          // sendBeacon can't set the UUID header; fall back to keepalive fetch.
          fetch(url, {
            method: 'POST', keepalive: true,
            headers: { 'Content-Type': 'application/json', 'X-Anon-Session-UUID': uuid() },
            body: JSON.stringify({})
          }).catch(() => {});
        } catch (e) {}
      }
      window.addEventListener('pagehide', endSession);

      // ---- verify funnel (free "be remembered") ----
      function renderVerify() {
        if (state.verifyStep === 'success') {
          verify.innerHTML = `
            <div class="cc-verify__success">
              <div style="font-size:2.4rem">✓</div>
              <div class="cc-verify__title">You’re remembered now.</div>
              <div class="cc-verify__copy">From here on, ${c.name} knows you — every call, every chat, threaded together. Your space is ready.</div>
              <button class="cc-verify__action cc-verify__open">Open your space</button>
            </div>`;
          verify.querySelector('.cc-verify__open').addEventListener('click', () => {
            window.location.href = state.token
              ? `${PORTAL_URL}/#token=${encodeURIComponent(state.token)}`
              : PORTAL_URL;
          });
          return;
        }
        if (state.verifyStep === 'phone') {
          verify.innerHTML = `
            <button class="cc-verify__back">‹ Back to ${c.name}</button>
            <div class="cc-verify__title">Let ${c.name} remember you</div>
            <div class="cc-verify__copy">Your number is the thread that lets ${c.name} find you again — on the phone or here in chat. I’ll text you a code to confirm it. Free, always.</div>
            <div class="cc-field">
              <label>Your mobile number</label>
              <input class="cc-phone" type="tel" inputmode="tel" placeholder="(555) 555-5555" autocomplete="tel">
            </div>
            <button class="cc-verify__action cc-next">Text me a code</button>
            <div class="cc-verify__error"></div>
            <div class="cc-verify__note">No spam, ever. Your number is only used to recognize you. Without it, ${c.name} can’t keep a memory of you.</div>`;
        } else {
          verify.innerHTML = `
            <button class="cc-verify__back">‹ Back</button>
            <div class="cc-verify__title">Enter your code</div>
            <div class="cc-verify__copy">Check your texts — ${c.name} just sent a 6-digit code. Add your email and you’re set.</div>
            <div class="cc-field">
              <label>Code</label>
              <input class="cc-code" type="text" inputmode="numeric" placeholder="123456" autocomplete="one-time-code">
            </div>
            <div class="cc-field">
              <label>Your email</label>
              <input class="cc-email" type="email" placeholder="you@email.com" autocomplete="email">
            </div>
            <button class="cc-verify__action cc-confirm">Confirm &amp; be remembered</button>
            <div class="cc-verify__error"></div>`;
        }
        verify.querySelector('.cc-verify__back').addEventListener('click', () => {
          if (state.verifyStep === 'code') { state.verifyStep = 'phone'; renderVerify(); }
          else closeVerify();
        });
        const errEl = verify.querySelector('.cc-verify__error');

        const nextBtn = verify.querySelector('.cc-next');
        if (nextBtn) nextBtn.addEventListener('click', async () => {
          const phone = verify.querySelector('.cc-phone').value.trim();
          if (phone.replace(/\D/g, '').length < 10) { errEl.textContent = 'Please enter a valid mobile number.'; return; }
          nextBtn.disabled = true; errEl.textContent = '';
          const { ok, data } = await api('/api/take5/generate-code', { phone, companion: c.slug });
          if (ok && data.success) { state.phone = phone; state.verifyStep = 'code'; renderVerify(); }
          else { nextBtn.disabled = false; errEl.textContent = msgFor(data.error) || 'Couldn’t send the text. Try again.'; }
        });

        const confirmBtn = verify.querySelector('.cc-confirm');
        if (confirmBtn) confirmBtn.addEventListener('click', async () => {
          const code = verify.querySelector('.cc-code').value.trim();
          const email = verify.querySelector('.cc-email').value.trim();
          if (!code) { errEl.textContent = 'Enter the code we texted you.'; return; }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Enter a valid email.'; return; }
          confirmBtn.disabled = true; errEl.textContent = '';
          // Stamp the email onto this UUID's anon sessions so the claim threads them in.
          await api('/api/he-chat/anon/capture-email', { email }, { 'X-Anon-Session-UUID': uuid() });
          const { ok, data } = await api('/api/take5/claim', { phone: state.phone, code, email });
          if (ok && data.success) {
            state.verified = true; state.token = data.token || null;
            state.verifyStep = 'success'; renderVerify();
          } else {
            confirmBtn.disabled = false;
            errEl.textContent = (data && data.message) || msgFor(data && data.error) || 'That didn’t go through. Try again.';
          }
        });
      }
      function msgFor(code) {
        return ({
          code_incorrect: 'That code didn’t match. Check the text and try again.',
          no_pending_code: 'That code expired. Tap back and request a new one.',
          invalid_phone: 'Please enter a valid mobile number.',
          sms_failed: 'We couldn’t send the text. Try again.',
        })[code] || '';
      }
      function openVerify() { state.verifyStep = 'phone'; verify.hidden = false; renderVerify(); }
      function closeVerify() { verify.hidden = true; }
      bannerBtn.addEventListener('click', () => { banner.hidden = true; openVerify(); });
    }
  };

  window.CompanionChat = CompanionChat;

  // Auto-init on companion marketing pages (body carries the slug).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CompanionChat.init());
  } else {
    CompanionChat.init();
  }
})();
