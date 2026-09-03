/* ==========================================================================
   REAL ME — 랜딩페이지 스크립트
   ========================================================================== */
(function () {
  'use strict';

  /* ========================================================================
     [!] 미확정 데이터 필드 (PRD §8) — 배포 전 반드시 실제 값으로 교체할 것.
         현재 값은 데모용 임시값이며, 여기만 고치면 페이지 전체에 반영된다.
         교체 체크리스트: PLACEHOLDERS.md
     ======================================================================== */
  var DATA = {
    // D1 — 예약금: 플랜과 무관하게 2만원 고정 (실제 결제 페이지 realme-booking-A.html 기준)
    depositFinding: '2만원',
    depositOneday:  '2만원',
    depositSeason:  '2만원',

    // D2 — 시즌 관리 플랜 가격 및 구성
    seasonWas:  '',
    seasonNow:  '100만원 이상',
    seasonTerm: '연 4회 · 시즌별',

    // D3 — 오픈 프로모션 마감일 (지나면 취소선 가격/프로모션 문구 제거 필수)
    promoEnd:     '9월 30일',
    promoEndISO:  '2026-09-30',

    // D4 — 역별 도보 소요 시간
    walkShort:  '4',
    walkJamsil: '8번 출구 도보 6분',
    walkSongpa: '2번 출구 도보 4분',

    // 기타 미확정
    address: '[배포 전 상세 주소 입력]'
  };

  var PLAN_LABEL = { finding: '파인딩 플랜', oneday: '원데이 플랜', season: '멤버십' };
  var PLAN_DEPOSIT = { finding: DATA.depositFinding, oneday: DATA.depositOneday, season: DATA.depositSeason };

  /* ---------------------------------------------------------------------
     계측 — PRD §12.2 이벤트 스키마
     실제 GA4/Amplitude 연동 시 window.dataLayer 소비 또는 아래 track() 교체.
     --------------------------------------------------------------------- */
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    params = params || {};
    var payload = Object.assign({ event: event }, params);
    window.dataLayer.push(payload);
    try { if (typeof window.gtag === 'function') window.gtag('event', event, params); } catch (e) {}
    try {
      if (typeof window.fbq === 'function') {
        var metaMap = { form_submit: 'InitiateCheckout' };
        if (metaMap[event]) window.fbq('track', metaMap[event], params);
        else window.fbq('trackCustom', event, params);
      }
    } catch (e) {}
    if (window.console && console.debug) console.debug('[track]', event, params);
  }

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  var canObserve = 'IntersectionObserver' in window;

  /* ---------------------------------------------------------------------
     1. 미확정 데이터 주입
     --------------------------------------------------------------------- */
  function injectData() {
    document.querySelectorAll('[data-field]').forEach(function (el) {
      var key = el.getAttribute('data-field');
      if (Object.prototype.hasOwnProperty.call(DATA, key)) el.textContent = DATA[key];
    });
  }

  /* ---------------------------------------------------------------------
     2. 내비 스크롤 상태
     --------------------------------------------------------------------- */
  function initNav() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------------------
     3. 모바일 고정 하단 바 — 히어로를 지나면 노출, 예약 폼에 닿으면 숨김
     --------------------------------------------------------------------- */
  function initStickyBar() {
    var bar = document.getElementById('sticky-bar');
    var hero = document.querySelector('.hero');
    var booking = document.getElementById('booking');
    if (!bar || !hero || !booking) return;

    var pastHero = false, atBooking = false;
    var apply = function () {
      var show = pastHero && !atBooking;
      bar.hidden = !show;
      document.body.classList.toggle('has-sticky-bar', show);
    };

    new IntersectionObserver(function (entries) {
      pastHero = !entries[0].isIntersecting;
      apply();
    }, { rootMargin: '-64px 0px 0px 0px' }).observe(hero);

    new IntersectionObserver(function (entries) {
      atBooking = entries[0].isIntersecting;
      apply();
    }, { threshold: 0.08 }).observe(booking);
  }

  /* ---------------------------------------------------------------------
     4. CTA 클릭 계측 + 패키지 CTA → 플랜 자동 선택
     --------------------------------------------------------------------- */
  function initCTAs() {
    var planSelect = document.getElementById('f-plan');

    document.querySelectorAll('[data-cta]').forEach(function (el) {
      el.addEventListener('click', function () {
        track('cta_click', { position: el.getAttribute('data-cta') });

        var plan = el.getAttribute('data-select-plan');
        if (plan && planSelect) {
          planSelect.value = plan;
          planSelect.dispatchEvent(new Event('change', { bubbles: true }));
          track('plan_select', { plan: plan });
          // 폼으로 이동한 뒤 선택된 플랜을 시각적으로 인지시킨다
          window.setTimeout(function () { planSelect.focus({ preventScroll: true }); }, 400);
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     5. FAQ 펼침 계측 (§12.2 faq_open — 반박 우선순위 가설 검증용)
     --------------------------------------------------------------------- */
  function initFAQ() {
    document.querySelectorAll('.qa').forEach(function (qa) {
      var summary = qa.querySelector('summary');
      var panel = qa.querySelector('.qa__a');

      // 계측은 toggle에 둔다 — 프로그래매틱 변경까지 한 번씩만 잡힌다
      qa.addEventListener('toggle', function () {
        if (qa.open) track('faq_open', { index: Number(qa.getAttribute('data-faq')) });
      });

      if (!panel) return;
      var animating = false;

      summary.addEventListener('click', function (e) {
        if (reduceMotion()) return;   // 네이티브 즉시 토글에 맡긴다
        e.preventDefault();
        if (animating) return;
        animating = true;

        var done = function () {
          panel.removeEventListener('transitionend', onEnd);
          animating = false;
        };
        var onEnd = function (ev) {
          if (ev.propertyName !== 'height') return;
          if (qa.open) panel.style.height = 'auto';
          else { qa.open = false; panel.style.height = ''; }
          done();
        };

        if (!qa.open) {
          qa.open = true;                       // toggle 발화 → 계측
          panel.style.height = '0px';
          panel.addEventListener('transitionend', onEnd);
          requestAnimationFrame(function () {
            panel.style.height = panel.scrollHeight + 'px';
          });
        } else {
          panel.style.height = panel.scrollHeight + 'px';
          panel.addEventListener('transitionend', onEnd);
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { panel.style.height = '0px'; });
          });
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     9. 스크롤 리빌 — CSS의 초기 은닉 셀렉터와 목록이 일치해야 한다
     --------------------------------------------------------------------- */
  var REVEAL_SELECTOR = [
    '.hero .eyebrow', '.hero__h1', '.hero__body', '.hero .cta-block', '.rating-line', '.hero__media',
    '.stats__head', '.stat',
    '.section-head', '.feature__text', '.feature__media',
    '.review-card', '.plan',
    '.qa',
    '.final-cta__h2', '.final-cta__body', '.final-cta .cta-block',
    '.form', '.footer__col'
  ].join(', ');

  function initReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll(REVEAL_SELECTOR));
    if (!els.length) return;

    // 같은 부모를 공유하는 형제끼리만 순차 지연을 준다
    var seen = [];
    var counts = [];
    els.forEach(function (el) {
      var parent = el.parentElement;
      var i = seen.indexOf(parent);
      if (i === -1) { seen.push(parent); counts.push(0); i = seen.length - 1; }
      el.style.setProperty('--d', (counts[i] * 70) + 'ms');
      counts[i] += 1;
    });

    if (reduceMotion() || !canObserve) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------------
     10. 스탯 카운트업 — 스크린리더에는 최종값만 읽히도록 분리
     --------------------------------------------------------------------- */
  function initCounters() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
    if (!els.length || reduceMotion() || !canObserve) return;  // 마크업에 이미 최종값이 있다

    var format = function (el, value) {
      var dec = Number(el.getAttribute('data-decimals') || 0);
      var out = value.toFixed(dec);
      if (el.hasAttribute('data-comma')) out = Number(out).toLocaleString('ko-KR');
      return out;
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);

        // 낭독용 정적 사본을 남기고 카운터는 접근성 트리에서 제외
        var sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = el.textContent;
        el.parentNode.insertBefore(sr, el);
        el.setAttribute('aria-hidden', 'true');

        var target = parseFloat(el.getAttribute('data-count'));
        var duration = 1200;
        var start = null;

        var step = function (ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / duration, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = format(el, target * eased);
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = format(el, target);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });

    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------------
     6. 섹션 도달률 + pricing_view
     --------------------------------------------------------------------- */
  function initScrollDepth() {
    var seen = {};
    var sections = [
      ['.hero', 'hero'], ['.stats', 'stats'], ['#benefits', 'benefits'],
      ['#reviews', 'reviews'], ['#pricing', 'pricing'], ['#faq', 'faq'],
      ['.final-cta', 'final'], ['#booking', 'booking']
    ];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var name = entry.target.getAttribute('data-section');
        if (seen[name]) return;
        seen[name] = true;
        track('scroll_depth', { section: name });
        if (name === 'pricing') track('pricing_view', {});
      });
    }, { threshold: 0.35 });

    sections.forEach(function (pair) {
      var el = document.querySelector(pair[0]);
      if (!el) return;
      el.setAttribute('data-section', pair[1]);
      io.observe(el);
    });
  }

  /* ---------------------------------------------------------------------
     7. 예약 폼
     --------------------------------------------------------------------- */
  function initForm() {
    var form = document.getElementById('booking-form');
    if (!form) return;
    var status = document.getElementById('form-status');
    var planSelect = document.getElementById('f-plan');
    var started = false;

    // form_start — 첫 입력 시 1회
    form.addEventListener('input', function () {
      if (started) return;
      started = true;
      track('form_start', { plan: planSelect ? planSelect.value : '' });
    }, { once: false });

    if (planSelect) {
      planSelect.addEventListener('change', function () {
        if (planSelect.value) track('plan_select', { plan: planSelect.value });
      });
    }

    function setError(id, on) {
      var input = document.getElementById(id);
      var msg = form.querySelector('[data-error-for="' + id + '"]');
      if (input) input.setAttribute('aria-invalid', on ? 'true' : 'false');
      if (msg) msg.hidden = !on;
    }

    function validate() {
      var bad = [];

      var name = document.getElementById('f-name');
      var nameBad = !name.value.trim();
      setError('f-name', nameBad); if (nameBad) bad.push(name);

      var phone = document.getElementById('f-phone');
      var digits = phone.value.replace(/\D/g, '');
      var phoneBad = !(digits.length >= 10 && digits.length <= 11);
      setError('f-phone', phoneBad); if (phoneBad) bad.push(phone);

      ['f-plan'].forEach(function (id) {
        var el = document.getElementById(id);
        var isBad = !el.value;
        setError(id, isBad); if (isBad) bad.push(el);
      });

      var privacy = document.getElementById('f-privacy');
      var privacyBad = !privacy.checked;
      setError('f-privacy', privacyBad); if (privacyBad) bad.push(privacy);

      return bad;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = validate();

      if (bad.length) {
        status.hidden = false;
        status.setAttribute('data-tone', 'error');
        status.textContent = '입력하지 않은 항목이 있습니다. 표시된 항목을 확인해주세요.';
        bad[0].focus();
        return;
      }

      var plan = planSelect.value;
      var submitBtn = form.querySelector('button[type="submit"]');
      track('form_submit', { plan: plan });

      /* --------------------------------------------------------------
         이 폼은 사전 정보 수집용입니다. 실제 예약금 결제는 기존에 검증된
         realme-booking-A.html(PayApp 결제 연동)에서 진행합니다.
         → 여기서 모은 정보(플랜·방문일·시간·예산·메시지)는 상담 준비용으로
           리드 캡처 시트에 먼저 저장하고, 결제 페이지로 넘겨줍니다.
         예약금은 플랜과 무관하게 2만원 고정 — 이 페이지 문구와 결제 페이지가
         일치합니다 (2026-08-21 확정). -------------------------------------- */
      var GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbyx44RhfrZcUuwg-d1JThbG6lJ65FWQBPGJO5pvbsouYAxs0ylLJP9Bru4iysfJaZxS/exec';
      try {
        var payload = JSON.stringify({
          name: document.getElementById('f-name').value.trim(),
          phone: document.getElementById('f-phone').value.trim().replace(/\D/g, ''),
          plan: plan,
          message: document.getElementById('f-message').value.trim(),
          landing: 'the-way',
          consent_privacy: true,
          consent_marketing: document.getElementById('f-marketing').checked,
          submitted_at: new Date().toISOString()
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(GOOGLE_SHEET_URL, new Blob([payload], { type: 'text/plain' }));
        } else {
          fetch(GOOGLE_SHEET_URL, { method: 'POST', body: payload, keepalive: true, mode: 'no-cors' }).catch(function () {});
        }
      } catch (e) { if (window.console) console.error('lead-capture 실패', e); }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '예약 페이지로 이동 중...'; }
      status.hidden = false;
      status.removeAttribute('data-tone');
      status.textContent =
        PLAN_LABEL[plan] + ' 예약 정보가 접수되었습니다. 예약금 결제 페이지로 이동합니다.';
      status.scrollIntoView({ block: 'center', behavior: 'smooth' });

      window.setTimeout(function () {
        window.location.href = '/realme-booking-A.html?landing=the-way&plan=' + encodeURIComponent(plan);
      }, 900);
    });
  }

  /* ---------------------------------------------------------------------
     8. 프로모션 마감 자동 점검 — 마감일이 지나면 콘솔 경고 (§6.5 표기 규칙)
     --------------------------------------------------------------------- */
  function checkPromo() {
    if (!DATA.promoEndISO) return;
    var end = new Date(DATA.promoEndISO + 'T23:59:59');
    if (new Date() > end && window.console) {
      console.warn('[REAL ME] 오픈 프로모션이 종료되었습니다(' + DATA.promoEndISO + '). ' +
        '취소선 가격 표기와 "오픈 프로모션" 문구를 반드시 제거하세요. (표시광고법)');
    }
  }

  /* --------------------------------------------------------------------- */
  function init() {
    injectData();
    initNav();
    initStickyBar();
    initCTAs();
    initFAQ();
    initScrollDepth();
    initForm();
    checkPromo();
    initReveal();
    initCounters();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
