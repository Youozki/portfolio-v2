(() => {
  'use strict';
  const S = window.SITE || {};
  const K = window.KIT || {};

  const progress = document.querySelector('#progress span');
  if (progress && S.hasGsap) {
    gsap.to(progress, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.2,
      },
    });
  }

  const sections = [...document.querySelectorAll('main section[id]')];
  const links = [...document.querySelectorAll('.nav__link')];
  if (S.hasGsap) {
    sections.forEach((section) => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: (self) => {
          if (!self.isActive) return;
          links.forEach((link) => link.classList.toggle(
            'is-current',
            link.getAttribute('href') === '#' + section.id
          ));
        },
      });
    });
  }

  S.revealAll && S.revealAll();
  S.navInvert && S.navInvert();
  document.querySelectorAll('.drift').forEach((el) => S.marquee && S.marquee(el));
  K.parallax && K.parallax();
  K.nodes && K.nodes();
  K.chapters && K.chapters();
  ScrollTrigger.refresh();
})();
