(function () {
  "use strict";

  /* ★★★ 운영 설정 — 여기만 수정하면 됨 ★★★ */
  // discount50 전용 타입폼 (2026-07-11 생성, impact-me용 nY7F5abi 와 별도)
  var TYPEFORM = "https://artin1ife.typeform.com/to/NN0cEjOV";

  // 남은 쿠폰 연출: 시작값에서 보는 동안 실시간으로 1~2장씩 감소 (재방문 시 이어짐, 바닥값에서 정지)
  var SEATS_TOTAL = 100;
  var SEATS_START = 63;             // ★ 시작 장수 — 캠페인 리셋 시 여기만 조정
  var SEATS_FLOOR = 21;             // ★ 이 밑으로는 안 내려감

  // 실시간 시청자 연출 (플로팅 배지)
  var VIEWERS_MIN = 3600;
  var VIEWERS_MAX = 4800;

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

  /* ===== 남은 쿠폰 실시간 감소 연출 =====
     - 시작값(SEATS_START)에서 12~35초 간격으로 1~2장씩 감소
     - localStorage로 재방문 시 이어짐 (숫자가 다시 늘어나 보이는 일 없음)
     - SEATS_FLOOR에서 정지 */
  (function () {
    var els = document.querySelectorAll(".seats-left-text");
    if (!els.length) return;
    var KEY = "d50_seats";
    var val = parseInt(localStorage.getItem(KEY) || "0", 10);
    if (!val || val > SEATS_START || val < SEATS_FLOOR) val = SEATS_START;

    function render(flash) {
      els.forEach(function (el) {
        el.textContent = val;
        if (flash) {
          el.classList.remove("seat-drop");
          void el.offsetWidth; // 애니메이션 재시작
          el.classList.add("seat-drop");
        }
      });
      document.querySelectorAll(".seats-fill").forEach(function (f) {
        // 게이지 = "남은" 비율 — 쿠폰이 줄면 바도 같이 줄어듦
        f.style.width = Math.round(val / SEATS_TOTAL * 100) + "%";
        if (flash) {
          f.classList.remove("bar-flash");
          void f.offsetWidth;
          f.classList.add("bar-flash");
        }
      });
    }
    function save() { try { localStorage.setItem(KEY, String(val)); } catch (e) {} }
    function schedule() { setTimeout(tick, 9000 + Math.random() * 14000); } // 9~23초 간격
    function tick() {
      if (val > SEATS_FLOOR) {
        val -= (Math.random() < 0.25 ? 2 : 1);
        if (val < SEATS_FLOOR) val = SEATS_FLOOR;
        save();
        render(true);
      }
      schedule();
    }
    render(false);
    save();
    // 첫 감소는 진입 5초 이내 — 들어오자마자 "방금 누가 받아갔다"는 인상
    setTimeout(tick, 2500 + Math.random() * 2000);
  })();

  /* ===== 실시간 시청자 플로팅 배지 (숫자 랜덤워크) ===== */
  (function () {
    var el = document.getElementById("viewerCount");
    if (!el) return;
    var v = 3950 + Math.floor(Math.random() * 320);
    function render() { el.textContent = v.toLocaleString("ko-KR"); }
    function tick() {
      var delta = Math.floor(Math.random() * 29) - 13; // -13 ~ +15 (살짝 증가 편향)
      v = Math.max(VIEWERS_MIN, Math.min(VIEWERS_MAX, v + delta));
      render();
      setTimeout(tick, 3500 + Math.random() * 5000);
    }
    render();
    setTimeout(tick, 2500);
  })();

  /* 타입폼 URL 빌더 — 랜딩 UTM/클릭ID 전달 (impact-me와 동일한 검증된 방식) */
  var FORWARD_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
  function buildTypeformUrl() {
    var src = new URLSearchParams(location.search), parts = [];
    // 스타일 A/B 구분(2026-07-22): /style(.html)=기존형(검정·빨강), 그 외(index)=신규형(부드러운 상세) → utm_source로 타입폼 전달 → 시트 '랜딩' 열 기록
    var hero = /\/style(?:\.html)?(?:$|[?#])/i.test(location.pathname) ? "기존형" : "신규형";
    FORWARD_KEYS.forEach(function (k) {
      var v = (k === "utm_source") ? hero : src.get(k);
      if (v) parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
    });
    return TYPEFORM + (parts.length ? "?" + parts.join("&") : "");
  }

  /* 모든 CTA → 타입폼 이동 + 퍼널용 cta_click 발사 */
  (function () {
    var placeholder = TYPEFORM.indexOf("XXXXXXXX") !== -1;
    var url = buildTypeformUrl();
    document.querySelectorAll(".js-typeform").forEach(function (a) {
      if (!placeholder) a.setAttribute("href", url);
      a.addEventListener("click", function (e) {
        // 전환(Lead)은 타입폼 완료 시 발사. 랜딩에선 퍼널용 cta_click만.
        trackEvent("cta_click", { location: a.getAttribute("data-cta") || "cta", label: (a.textContent || "").trim() });
        if (placeholder) {
          e.preventDefault();
          console.warn("[discount50] TYPEFORM URL이 아직 플레이스홀더입니다. main.js 상단에서 교체하세요.");
          var orig = a.textContent;
          a.textContent = "신청 페이지 준비 중입니다";
          setTimeout(function () { a.textContent = orig; }, 1800);
        }
      });
    });
  })();

  /* 마퀴 카드 16장 생성 후 2배 복제(무한 루프) */
  (function () {
    var track = document.getElementById("lookTrack");
    if (!track) return;
    var REVIEWS = [
      ["김*준", "어깨라인부터 달라지니까 옷이 사는 느낌이에요."],
      ["이*호", "처음으로 거울 보는 게 즐거워졌습니다."],
      ["박*우", "컬러 하나 바꿨을 뿐인데 인상이 확 변했어요."],
      ["정*민", "회사에서 무슨 일 있냐는 소리 들었습니다 ㅎㅎ"],
      ["최*석", "막연했던 스타일 고민이 한 번에 정리됐어요."],
      ["강*현", "핏 잡는 법 배우고 나서 옷값이 아깝지 않아요."],
      ["윤*탁", "소개팅 자리에서 자신감이 생기더라고요."],
      ["임*규", "헤어까지 같이 봐주셔서 완성도가 다릅니다."],
      ["한*결", "내 장점이 뭔지 처음 알게 됐어요."],
      ["오*진", "사진 찍을 때 더 이상 피하지 않게 됐습니다."],
      ["서*빈", "비포 애프터 보고 제가 더 놀랐어요."],
      ["남*철", "딱 필요한 것만 짚어주셔서 효율적이었어요."],
      ["조*영", "친구들이 스타일리스트 붙였냐고 묻습니다."],
      ["배*훈", "어색할까 걱정했는데 정말 편하게 진행됐어요."],
      ["문*기", "퍼스널컬러 진단 받고 쇼핑이 쉬워졌어요."],
      ["신*우", "한 번의 디렉팅으로 방향이 완전히 잡혔습니다."]
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

  /* ===== 스크롤 뎁스별 sticky CTA 등장 (2026-07-21 개편) =====
     히어로에서 스크롤 두어 번 하면(히어로 문구가 화면 위로 지나가면) 하단 CTA가 나타난다.
     (원본 index/style은 style.css에 초기 숨김 규칙이 없어 항상 표시, 영향 없음) */
  (function () {
    var sticky = document.getElementById("stickyCta");
    if (!sticky) return;
    var target = document.querySelector(".hero-sub") || document.querySelector(".hero");
    if (!target || !("IntersectionObserver" in window)) { sticky.classList.add("is-shown"); return; }
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (en) { sticky.classList.toggle("is-shown", !en.isIntersecting); });
    }, { threshold: 0, rootMargin: "-200px 0px -10% 0px" });
    so.observe(target);
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
