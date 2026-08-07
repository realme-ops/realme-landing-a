(function () {
  "use strict";

  /* ★★★ 운영 설정 — 여기만 수정하면 됨 ★★★ */
  // 예약퍼널(find-me) 전환(2026-08-06): 타입폼이 아니라 일반 예약 페이지로 직행.
  // 새 예약 페이지가 생기면 이 URL만 교체하면 됨.
  var BOOKING_URL = "https://find-me.real-me.co.kr/realme-booking-A.html";

  /* 통합 이벤트: GA4(gtag) + 메타픽셀(fbq) */
  function trackEvent(name, params) {
    params = params || {};
    try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: name }, params)); } catch (e) {}
    try { if (typeof window.gtag === "function") window.gtag("event", name, params); } catch (e) {}
    try {
      if (typeof window.fbq === "function") {
        var map = { form_submit: "Lead" };
        if (map[name]) window.fbq("track", map[name], params);
        else window.fbq("trackCustom", name, params);
      }
    } catch (e) {}
  }
  window.trackEvent = trackEvent;

  /* 스크롤 리빌 */
  var reveal = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveal.forEach(function (el) { io.observe(el); });
  } else { reveal.forEach(function (el) { el.classList.add("is-visible"); }); }

  /* 모든 CTA → 예약 페이지 이동 + 퍼널용 cta_click
     광고 utm(캠페인·소재명)을 예약 페이지까지 전달 — 소재별 추적용.
     utm_source는 랜딩 식별자 'story'로 고정.
     (2026-08-06 예약퍼널 전환: 타입폼 → realme-booking-A. 픽셀 Lead 발사는 제거 —
      예약퍼널의 리드 시점은 CTA 클릭이 아니라 예약페이지 이벤트(InitiateCheckout)라 여기서 쏘면 이중집계.) */
  (function () {
    var FORWARD_KEYS = ["utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];
    function buildBookingUrl() {
      var parts = ["utm_source=story"];
      try {
        var src = new URLSearchParams(location.search);
        FORWARD_KEYS.forEach(function (k) {
          var v = src.get(k);
          if (v) parts.push(k + "=" + encodeURIComponent(v));
        });
      } catch (e) {}
      return BOOKING_URL + "?" + parts.join("&");
    }
    var url = buildBookingUrl();
    document.querySelectorAll(".js-booking").forEach(function (a) {
      a.setAttribute("href", url);
      a.addEventListener("click", function () {
        trackEvent("cta_click", { location: a.getAttribute("data-cta") || "cta", label: (a.textContent || "").trim() });
      });
    });
  })();

  /* 마퀴 카드 16장 생성 후 2배 복제(무한 루프) */
  (function () {
    var track = document.getElementById("lookTrack");
    if (!track) return;
    var REVIEWS = [
      ["김*준", "소개팅 나가면 애프터가 오기 시작했어요."],
      ["이*호", "첫인상이 달라지니 대화 분위기부터 편해졌어요."],
      ["박*우", "컬러 하나 바꿨을 뿐인데 '느낌 있다'는 말을 들어요."],
      ["정*민", "만난 지 3주 만에 여자친구가 생겼습니다 ㅎㅎ"],
      ["최*석", "소개팅 자리에서 자신감이 완전히 달라졌어요."],
      ["강*현", "프로필 사진부터 바꾸니 매칭률이 확 올랐어요."],
      ["윤*탁", "상대가 먼저 다음 약속을 잡자고 하더라고요."],
      ["임*규", "헤어까지 봐주셔서 데이트룩 고민이 사라졌어요."],
      ["한*결", "결혼 상대를 진지하게 만나기 시작했습니다."],
      ["오*진", "데이트 사진 찍는 게 더는 부담스럽지 않아요."],
      ["서*빈", "소개팅 성공률이 이렇게 달라질 줄 몰랐어요."],
      ["남*철", "상견례 자리 코디까지 챙겨주셔서 든든했어요."],
      ["조*영", "여자친구가 스타일 좋아졌다고 먼저 칭찬해요."],
      ["배*훈", "어색할까 걱정했는데 연애 상담까지 받은 기분이에요."],
      ["문*기", "퍼스널컬러 알고 나서 데이트룩이 쉬워졌어요."],
      ["신*우", "한 번의 디렉팅으로 연애 준비가 끝났습니다."]
    ];
    function set() {
      var s = "";
      for (var i = 1; i <= 16; i++) {
        var rv = REVIEWS[i - 1];
        s += '<div class="look-card">' +
               '<div class="imgslot" data-label="look-' + i + '.jpg">' +
               '<img src="images/look-' + i + '.jpg" alt="스타일 ' + i + '" onerror="this.style.display=\'none\'"></div>' +
               '<div class="look-cap"><div class="lc-top"><span class="lc-name">' + rv[0] + '</span>' +
               '<span class="lc-stars">★★★★★</span></div><p>' + rv[1] + '</p></div>' +
             '</div>';
      }
      return s;
    }
    track.innerHTML = set() + set();
  })();

  /* 비포/애프터 슬라이더 */
  (function () {
    var track = document.getElementById("baTrack");
    if (!track) return;
    var n = track.children.length, cur = 0, timer = null;
    var dotsWrap = document.getElementById("baDots");
    for (var i = 0; i < n; i++) { var d = document.createElement("div"); d.className = "dot" + (i === 0 ? " active" : ""); d.dataset.i = i; dotsWrap.appendChild(d); }
    var dots = dotsWrap.children;
    function go(k) { cur = (k + n) % n; track.style.transform = "translateX(-" + (cur * 100) + "%)"; for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("active", i === cur); }
    function next() { go(cur + 1); }
    function start() { stop(); timer = setInterval(next, 3500); }
    function stop() { if (timer) clearInterval(timer); }
    document.getElementById("baNext").onclick = function () { next(); start(); };
    document.getElementById("baPrev").onclick = function () { go(cur - 1); start(); };
    for (var j = 0; j < dots.length; j++) dots[j].onclick = function () { go(+this.dataset.i); start(); };
    var x0 = null;
    track.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    track.addEventListener("touchend", function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { dx < 0 ? next() : go(cur - 1); } x0 = null; start(); }, { passive: true });
    start();
  })();

  /* ===== 페이지의 절반을 읽은 뒤 sticky CTA 등장 ===== */
  (function () {
    var sticky = document.getElementById("stickyCta");
    if (!sticky) return;
    var ticking = false;
    function updateSticky() {
      var doc = document.documentElement;
      var depth = (doc.scrollTop + window.innerHeight) / doc.scrollHeight;
      sticky.classList.toggle("is-shown", depth >= 0.5);
      ticking = false;
    }
    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateSticky);
    }
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    updateSticky();
  })();

  /* ===== 서비스 단계 이미지 캐러셀 (STEP 1·2·3) 클릭/점/스와이프 (자동 슬라이드 없음) ===== */
  (function () {
    var cars = document.querySelectorAll(".svc-carousel");
    if (!cars.length) return;
    Array.prototype.forEach.call(cars, function (car) {
      var track = car.querySelector(".svc-ctrack");
      if (!track) return;
      var n = track.children.length;
      var dotsWrap = car.querySelector(".svc-dots");
      var cur = 0, timer = null;
      // 슬라이드 1장이면 컨트롤 숨기고 종료
      if (n <= 1) {
        var pv0 = car.querySelector(".svc-nav.prev"), nx0 = car.querySelector(".svc-nav.next");
        if (pv0) pv0.style.display = "none";
        if (nx0) nx0.style.display = "none";
        return;
      }
      for (var i = 0; i < n; i++) {
        var d = document.createElement("span");
        d.className = "d" + (i === 0 ? " active" : "");
        d.setAttribute("data-i", i);
        dotsWrap.appendChild(d);
      }
      var dots = dotsWrap.children;
      function go(k) {
        cur = (k + n) % n;
        track.style.transform = "translateX(-" + (cur * 100) + "%)";
        for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("active", i === cur);
      }
      function next() { go(cur + 1); }
      // 자동 슬라이드 없음: 클릭·점·스와이프로만 이동 (2026-07-21 사용자 요청)
      var prev = car.querySelector(".svc-nav.prev"), nx = car.querySelector(".svc-nav.next");
      if (prev) prev.onclick = function () { go(cur - 1); };
      if (nx) nx.onclick = function () { next(); };
      for (var j = 0; j < dots.length; j++) dots[j].onclick = function () { go(+this.getAttribute("data-i")); };
      var x0 = null;
      track.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      track.addEventListener("touchend", function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { dx < 0 ? next() : go(cur - 1); } x0 = null; }, { passive: true });
    });
  })();

  /* ===== 쇼룸 갤러리 마퀴: 트랙을 복제해 끊김 없이 흐르게 ===== */
  (function () {
    var track = document.getElementById("shroomTrack");
    if (!track) return;
    track.innerHTML += track.innerHTML; // 2배 복제 → CSS translateX(-50%) 루프가 seamless
  })();
})();
