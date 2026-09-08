/* ==========================================================================
   REAL ME — the-way 랜딩 스크립트 (원페이지퍼널, 2026-09-03)

   ⚠️ 이 파일을 수정하면 index.html 의 <script src="main.js?v=…"> 버전을 반드시 올릴 것.
      안 올리면 브라우저가 캐시된 옛 main.js 를 계속 써서 수정이 반영되지 않는다.
      (impact-me 에서 2026-08-31 실제로 겪음) 현재 v=20260903b.

   흐름:  하단 폼 입력 → 시트 기록(sendBeacon) → 결제창(create-payment-v2 → PayApp payurl)
          멤버십은 결제 없이 문의 접수만.
   ========================================================================== */
(function () {
  'use strict';

  /* ★★★ 운영 설정 — 여기만 수정하면 됨 ★★★ */
  var LANDING = 'the-way';                       // 명단 F열 '랜딩' 값 · GA4 landing 파라미터
  // 리드 수집 Apps Script (예약금 신청 명단) — secret-checkout · realme-booking-A 와 같은 웹앱
  var GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbyx44RhfrZcUuwg-d1JThbG6lJ65FWQBPGJO5pvbsouYAxs0ylLJP9Bru4iysfJaZxS/exec';
  // 예약금 결제요청 생성 (realmeschedule Supabase) → PayApp payurl
  var CREATE_PAYMENT_URL = 'https://npjudvehidwjofnmsdos.supabase.co/functions/v1/create-payment-v2';
  var DEPOSIT = 20000;

  var DATA = {
    depositFinding: '2만원',
    depositOneday:  '2만원',
    promoEnd:     '9월 30일',
    promoEndISO:  '2026-09-30',
    walkShort:  '4',
    walkJamsil: '8번 출구 도보 6분',
    walkSongpa: '2번 출구 도보 4분',
    address: '서울특별시 송파구 방이동 115-4 3층 리얼미'
  };

  var PLAN_LABEL = { finding: '파인딩 플랜', oneday: '원데이 플랜', membership: '멤버십' };
  var PAY_PLANS  = { finding: true, oneday: true };   // 결제창으로 가는 플랜. 멤버십은 문의만.

  /* ---------------------------------------------------------------------
     계측 — GA4(gtag) + Meta 픽셀(fbq)
     track()는 행동 이벤트용(클릭·FAQ·스크롤). 전환 이벤트는 submit 핸들러에서 명시적으로 쏜다.
     --------------------------------------------------------------------- */
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    params = Object.assign({ landing: LANDING }, params || {});
    window.dataLayer.push(Object.assign({ event: event }, params));
    try { if (typeof window.gtag === 'function') window.gtag('event', event, params); } catch (e) {}
    try { if (typeof window.fbq === 'function') window.fbq('trackCustom', event, params); } catch (e) {}
  }
  function ga(event, params) {   // GA4 전용 (섹션 도달 — Meta 로 보낼 필요 없음)
    try { if (typeof window.gtag === 'function') window.gtag('event', event, Object.assign({ landing: LANDING }, params || {})); } catch (e) {}
  }

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  var canObserve = 'IntersectionObserver' in window;

  /* ---------------------------------------------------------------------
     UTM 보존 — 진입 시 URL 의 utm_* 를 잡아 localStorage 에 남긴다.
     광고 url_tags: utm_source=meta&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.id}}
     → utm_content = 소재, utm_term = 광고세트. 명단 시트에 그대로 기록되어 소재·세트별 예약 귀속에 쓴다.
     --------------------------------------------------------------------- */
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var RM_UTM = (function () {
    var out = {}, got = false;
    try {
      var qs = new URLSearchParams(location.search);
      UTM_KEYS.forEach(function (k) { var v = qs.get(k); if (v) { out[k] = v; got = true; } });
      if (got) localStorage.setItem('tw_utm', JSON.stringify(out));
      else { var saved = localStorage.getItem('tw_utm'); if (saved) out = JSON.parse(saved) || {}; }
    } catch (e) {}
    return out;
  })();

  // utm_source → 명단 E열 '유입경로'. 어휘는 secret-checkout / booking-A 와 동일하게 유지.
  function getInflowChannel() {
    var utm = String(RM_UTM.utm_source || '').toLowerCase();
    var map = {
      threads: 'threads',
      instagram: 'paid ads', youtube: 'paid ads', facebook: 'paid ads', fb: 'paid ads', ig: 'paid ads', meta: 'paid ads',
      google: 'google', blog: 'blog', naver: 'blog', naver_blog: 'blog',
      referral: 'referral', homepage: 'homepage', kakao: 'kakao'
    };
    if (utm) return map[utm] || utm;          // 모르는 값은 원본 그대로 (새 채널 자동 라벨)
    // 구글 광고 클릭(gclid / iOS 인앱 gbraid·wbraid)은 utm_source 없이 오고 인앱은 리퍼러도 비어
    // 'direct'로 찍히므로 먼저 판정 (2026-09-07, impact-me main.js 와 동일 규칙)
    try {
      var gq = new URLSearchParams(location.search);
      if (gq.get('gclid') || gq.get('gbraid') || gq.get('wbraid')) {
        // 캠페인명(접미어 utm_campaign)으로 SA / 리마케팅 / DG 구분 (2026-09-08)
        var gc = String(RM_UTM.utm_campaign || gq.get('utm_campaign') || '').toLowerCase();
        if (/리마케팅|rmk|remarket|^da_/.test(gc)) return 'google_rmk';
        if (/^sa_|search/.test(gc)) return 'google_sa';
        if (/demandgen|^dg_/.test(gc)) return 'google_dg';
        return 'google';
      }
    } catch (e) {}
    var ref = document.referrer || '';
    if (!ref) return 'direct';
    try {
      var rh = new URL(ref).hostname;
      if (rh === location.hostname) return 'findme_main';
      if (rh.indexOf('kakao') !== -1) return 'kakao';
      if (rh.indexOf('google') !== -1) return 'google';
      if (rh.indexOf('naver') !== -1) return 'blog';
      return 'referral';
    } catch (e) { return 'referral'; }
  }

  // 시트 전송 — sendBeacon 은 페이지 이동(결제창 리다이렉트)에도 전송 보장. 반환값 false 면 fetch 로 재시도.
  function sendLead(obj) {
    try {
      var payload = JSON.stringify(obj);
      var ok = false;
      if (navigator.sendBeacon) {
        try { ok = navigator.sendBeacon(GOOGLE_SHEET_URL, new Blob([payload], { type: 'text/plain' })); }
        catch (e) { ok = false; }
      }
      if (!ok) fetch(GOOGLE_SHEET_URL, { method: 'POST', body: payload, keepalive: true, mode: 'no-cors' }).catch(function () {});
    } catch (e) { if (window.console) console.error('lead-capture 실패', e); }
  }

  /* ---------------------------------------------------------------------
     1. 데이터 주입
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
    if (!bar || !hero || !booking || !canObserve) return;

    var pastHero = false, atBooking = false;
    var apply = function () {
      var show = pastHero && !atBooking;
      bar.hidden = !show;
      document.body.classList.toggle('has-sticky-bar', show);
    };
    new IntersectionObserver(function (entries) { pastHero = !entries[0].isIntersecting; apply(); },
      { rootMargin: '-64px 0px 0px 0px' }).observe(hero);
    new IntersectionObserver(function (entries) { atBooking = entries[0].isIntersecting; apply(); },
      { threshold: 0.08 }).observe(booking);
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
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     5. FAQ 펼침 계측
     --------------------------------------------------------------------- */
  function initFAQ() {
    document.querySelectorAll('.qa').forEach(function (qa) {
      var summary = qa.querySelector('summary');
      var panel = qa.querySelector('.qa__a');
      qa.addEventListener('toggle', function () {
        if (qa.open) track('faq_open', { index: Number(qa.getAttribute('data-faq')) });
      });
      if (!panel) return;
      var animating = false;
      summary.addEventListener('click', function (e) {
        if (reduceMotion()) return;
        e.preventDefault();
        if (animating) return;
        animating = true;
        var done = function () { panel.removeEventListener('transitionend', onEnd); animating = false; };
        var onEnd = function (ev) {
          if (ev.propertyName !== 'height') return;
          if (qa.open) panel.style.height = 'auto';
          else { qa.open = false; panel.style.height = ''; }
          done();
        };
        if (!qa.open) {
          qa.open = true;
          panel.style.height = '0px';
          panel.addEventListener('transitionend', onEnd);
          requestAnimationFrame(function () { panel.style.height = panel.scrollHeight + 'px'; });
        } else {
          panel.style.height = panel.scrollHeight + 'px';
          panel.addEventListener('transitionend', onEnd);
          requestAnimationFrame(function () { requestAnimationFrame(function () { panel.style.height = '0px'; }); });
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     6. 섹션 도달 계측 — impact-me 와 동일 규칙 (2026-09-03)
        [data-sec]  섹션 단위: tw_s01_hero … tw_s10_booking
        [data-mark] 히어로 내부 지점: hero_title / hero_body / hero_cta / hero_rating / hero_media
        발사 조건: 요소가 화면 하단 35% 위로 들어오면 1회. GA4 에만 보낸다.
     --------------------------------------------------------------------- */
  function initSectionMarks() {
    var nodes = document.querySelectorAll('[data-sec],[data-mark]');
    if (!nodes.length || !canObserve) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        var name = el.getAttribute('data-sec') || el.getAttribute('data-mark');
        if (name) ga(name);
      });
    }, { threshold: 0, rootMargin: '0px 0px -35% 0px' });
    nodes.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------------
     7. 예약 폼 — 원페이지퍼널
     --------------------------------------------------------------------- */
  function initForm() {
    var form = document.getElementById('booking-form');
    if (!form) return;
    var status = document.getElementById('form-status');
    var planSelect = document.getElementById('f-plan');
    var planHelp = document.getElementById('f-plan-help');
    var submitBtn = document.getElementById('f-submit');
    var micro = document.getElementById('f-microcopy');
    var started = false;
    var busy = false;

    var BTN_PAY = '예약금 20,000원 결제하고 예약하기';
    var BTN_INQ = '멤버십 문의 남기기';
    var MICRO_PAY = '예약금은 컨설팅 비용에서 전액 차감됩니다. 방문 3일 전까지 전액 환불 가능합니다.';
    var MICRO_INQ = '멤버십은 예약금이 없습니다. 담당 디렉터가 연락드려 안내합니다.';

    // 안내 문구(f-microcopy)·도움말(f-plan-help)은 HTML 에서 지워도 폼이 동작해야 한다 — null 가드 (2026-09-04)
    function updatePlanUI() {
      var isInq = planSelect.value === 'membership';
      if (!busy && submitBtn) submitBtn.textContent = isInq ? BTN_INQ : BTN_PAY;
      if (micro) micro.textContent = isInq ? MICRO_INQ : MICRO_PAY;
      if (planHelp) planHelp.hidden = !isInq;
    }

    form.addEventListener('input', function () {
      if (started) return;
      started = true;
      track('form_start', { plan: planSelect.value || '' });
    });
    planSelect.addEventListener('change', function () {
      if (planSelect.value) track('plan_select', { plan: planSelect.value });
      updatePlanUI();
    });
    updatePlanUI();

    function setError(id, on) {
      var input = document.getElementById(id);
      var msg = form.querySelector('[data-error-for="' + id + '"]');
      if (input) input.setAttribute('aria-invalid', on ? 'true' : 'false');
      if (msg) msg.hidden = !on;
    }
    function showStatus(text, tone) {
      status.hidden = false;
      if (tone) status.setAttribute('data-tone', tone); else status.removeAttribute('data-tone');
      status.textContent = text;
    }
    function validate() {
      var bad = [];
      var name = document.getElementById('f-name');
      var nameBad = !name.value.trim();
      setError('f-name', nameBad); if (nameBad) bad.push(name);

      var phone = document.getElementById('f-phone');
      var digits = phone.value.replace(/\D/g, '');
      var phoneBad = !(digits.length >= 10 && digits.length <= 11 && digits.charAt(0) === '0');
      setError('f-phone', phoneBad); if (phoneBad) bad.push(phone);

      var planBad = !planSelect.value;
      setError('f-plan', planBad); if (planBad) bad.push(planSelect);

      var privacy = document.getElementById('f-privacy');
      var privacyBad = !privacy.checked;
      setError('f-privacy', privacyBad); if (privacyBad) bad.push(privacy);
      return bad;
    }

    function setBusy(on, label) {
      busy = on;
      if (!submitBtn) return;
      submitBtn.disabled = on;
      submitBtn.textContent = on ? label : (planSelect.value === 'membership' ? BTN_INQ : BTN_PAY);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var bad = validate();
      if (bad.length) {
        showStatus('입력하지 않은 항목이 있습니다. 표시된 항목을 확인해주세요.', 'error');
        bad[0].focus();
        return;
      }

      var name  = document.getElementById('f-name').value.trim();
      var phone = document.getElementById('f-phone').value.replace(/\D/g, '');
      var plan  = planSelect.value;
      var marketing = document.getElementById('f-marketing').checked;

      var lead = {
        name: name,
        phone: phone,
        inflow_channel: getInflowChannel(),
        landing: LANDING,
        plan: plan,
        plan_label: PLAN_LABEL[plan] || plan,
        utm_source:   RM_UTM.utm_source   || '',
        utm_medium:   RM_UTM.utm_medium   || '',
        utm_campaign: RM_UTM.utm_campaign || '',
        utm_content:  RM_UTM.utm_content  || '',
        utm_term:     RM_UTM.utm_term     || '',
        consent_privacy: true,
        consent_marketing: marketing,
        submitted_at: new Date().toISOString()
      };

      /* ── 멤버십: 문의 접수만 (결제 없음) ── */
      if (!PAY_PLANS[plan]) {
        lead.stage = 'inquiry';
        setBusy(true, '접수 중...');
        sendLead(lead);
        track('membership_inquiry', { plan: plan });
        window.setTimeout(function () {
          setBusy(false);
          form.reset(); updatePlanUI();
          showStatus('멤버십 문의가 접수되었습니다. 담당 디렉터가 연락드려 안내합니다.');
          status.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 600);
        return;
      }

      /* ── 원데이·파인딩: 시트 기록 → 결제창 ── */
      lead.stage = 'payment_click';
      setBusy(true, '결제창 연결 중...');

      // 전환 이벤트 — 광고세트 최적화는 이 페이지만 쏘는 OnePageSubmit 으로 잡을 것.
      // (InitiateCheckout · PaymentClick 은 다른 결제페이지도 쏴서 이 랜딩 단독 판정에는 못 쓴다)
      try {
        if (typeof window.fbq === 'function') {
          window.fbq('track', 'InitiateCheckout', { value: DEPOSIT, currency: 'KRW' });
          window.fbq('trackCustom', 'PaymentClick', { value: DEPOSIT, currency: 'KRW', landing: LANDING, plan: plan });
          window.fbq('trackCustom', 'OnePageSubmit', { value: DEPOSIT, currency: 'KRW', landing: LANDING, plan: plan });
        }
      } catch (err) {}
      ga('begin_checkout', { value: DEPOSIT, currency: 'KRW', plan: plan });
      ga('onepage_submit', { value: DEPOSIT, currency: 'KRW', plan: plan });

      sendLead(lead);   // 결제 여부와 무관하게 먼저 기록 (결제창에서 이탈해도 리드는 남는다)

      fetch(CREATE_PAYMENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, phone: phone, plan: plan })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.payurl) {
            showStatus(PLAN_LABEL[plan] + ' 예약 정보가 접수되었습니다. 결제창으로 이동합니다.');
            window.location.href = res.payurl;
          } else { throw new Error('payurl 없음'); }
        })
        .catch(function (err) {
          if (window.console) console.error('결제 생성 실패', err);
          setBusy(false);
          showStatus('결제창 연결에 실패했습니다. 잠시 후 다시 시도해주세요. 계속 안 되면 카카오톡 채널로 문의해주세요.', 'error');
        });

      // 뒤로가기 등으로 돌아온 경우 버튼 복구
      window.setTimeout(function () { if (busy) setBusy(false); }, 8000);
    });
  }

  /* ---------------------------------------------------------------------
     8. 프로모션 마감 자동 점검
     --------------------------------------------------------------------- */
  function checkPromo() {
    if (!DATA.promoEndISO) return;
    var end = new Date(DATA.promoEndISO + 'T23:59:59');
    if (new Date() > end && window.console) {
      console.warn('[REAL ME] 오픈 프로모션이 종료되었습니다(' + DATA.promoEndISO + '). 취소선 가격 표기와 "오픈 프로모션" 문구를 반드시 제거하세요. (표시광고법)');
    }
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
    var seen = [], counts = [];
    els.forEach(function (el) {
      var parent = el.parentElement;
      var i = seen.indexOf(parent);
      if (i === -1) { seen.push(parent); counts.push(0); i = seen.length - 1; }
      el.style.setProperty('--d', (counts[i] * 70) + 'ms');
      counts[i] += 1;
    });
    if (reduceMotion() || !canObserve) { els.forEach(function (el) { el.classList.add('is-in'); }); return; }
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
     10. 스탯 카운트업
     --------------------------------------------------------------------- */
  function initCounters() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
    if (!els.length || reduceMotion() || !canObserve) return;
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
        var sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = el.textContent;
        el.parentNode.insertBefore(sr, el);
        el.setAttribute('aria-hidden', 'true');
        var target = parseFloat(el.getAttribute('data-count'));
        var duration = 1200, start = null;
        var step = function (ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / duration, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = format(el, target * eased);
          if (p < 1) requestAnimationFrame(step); else el.textContent = format(el, target);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* --------------------------------------------------------------------- */
  // 각 초기화를 따로 감싼다 — 한 곳이 실패해도(예: HTML 에서 요소를 지움) 나머지는 돈다.
  // 2026-09-04: 안내 문구 한 줄을 지웠다가 initForm 이 죽고 initReveal 이 안 돌아 페이지가 통째로 안 보인 사고.
  function init() {
    [injectData, initNav, initStickyBar, initCTAs, initFAQ, initSectionMarks,
     initForm, checkPromo, initReveal, initCounters].forEach(function (fn) {
      try { fn(); } catch (e) { if (window.console) console.error('[the-way] ' + fn.name + ' 실패:', e); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
