/* ============================================================
   日耗仓 · 主题轮播
   自动滚动 + 点状指示器 + 一屏一卡（scroll-snap 吸附）
   ============================================================ */
(function () {
  'use strict';

  var INTERVAL = 2000; // 自动轮播间隔（毫秒）

  function initCarousel() {
    var carousels = document.querySelectorAll('.theme-carousel');
    carousels.forEach(function (carousel) {
      if (carousel.getAttribute('data-carousel-ready') === '1') return;
      carousel.setAttribute('data-carousel-ready', '1');

      var slides = carousel.querySelectorAll('.theme-slide');
      if (slides.length < 2) return;

      var index = 0;
      var timer = null;

      // 构建点状指示器
      var dotsWrap = document.createElement('div');
      dotsWrap.className = 'theme-dots';
      var dots = [];
      for (var i = 0; i < slides.length; i++) {
        (function (idx) {
          var d = document.createElement('button');
          d.type = 'button';
          d.className = 'theme-dot' + (idx === 0 ? ' active' : '');
          d.setAttribute('aria-label', '切换至第 ' + (idx + 1) + ' 个主题');
          d.addEventListener('click', function () {
            goTo(idx);
            restart();
          });
          dotsWrap.appendChild(d);
          dots.push(d);
        })(i);
      }
      carousel.insertAdjacentElement('afterend', dotsWrap);

      // 单步距离 = 卡片宽度 + 间距
      function stepWidth() {
        var slide = slides[0].getBoundingClientRect().width;
        var gap = parseFloat(getComputedStyle(carousel).gap) || 0;
        return slide + gap;
      }

      function goTo(i, behavior) {
        index = (i + slides.length) % slides.length;
        carousel.scrollTo({ left: index * stepWidth(), behavior: behavior || 'smooth' });
        syncDots();
      }

      function syncDots() {
        dots.forEach(function (d, di) {
          d.classList.toggle('active', di === index);
        });
      }

      function next() {
        if (index >= slides.length - 1) {
          goTo(0, 'auto'); // 循环播放：末屏瞬间回到首屏
        } else {
          goTo(index + 1);
        }
      }

      function play() {
        if (timer !== null) return;
        timer = window.setInterval(next, INTERVAL);
      }
      function pause() {
        if (timer !== null) {
          window.clearInterval(timer);
          timer = null;
        }
      }
      function restart() {
        pause();
        play();
      }

      // 用户滑动时同步 index（scroll-snap 保证一屏一卡）
      carousel.addEventListener('scroll', function () {
        var i = Math.round(carousel.scrollLeft / stepWidth());
        if (i !== index) {
          index = i;
          syncDots();
        }
      }, { passive: true });

      // 悬停 / 触摸 / 拖拽时暂停，离开后继续
      ['mouseenter', 'pointerdown', 'touchstart'].forEach(function (ev) {
        carousel.addEventListener(ev, pause);
      });
      ['mouseleave', 'pointerup', 'touchend'].forEach(function (ev) {
        carousel.addEventListener(ev, play);
      });

      // 视口变化时保持当前卡对齐
      window.addEventListener('resize', function () {
        carousel.scrollTo({ left: index * stepWidth(), behavior: 'instant' });
      });

      play();
    });
  }

  // mkdocs-material 即时导航兼容
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarousel);
  } else {
    initCarousel();
  }
  document.addEventListener('DOMContentSwitch', initCarousel);
})();
