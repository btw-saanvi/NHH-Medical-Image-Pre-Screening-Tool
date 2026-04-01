import { useEffect, useRef } from 'react';

/* ─── Cursor glow ─────────────────────────────────────────────── */
function CursorGlow() {
  const dotRef  = useRef(null);
  const ringRef = useRef(null);
  const mouse   = useRef({ x: 0, y: 0 });
  const ring    = useRef({ x: 0, y: 0 });
  const raf     = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
    };
    const animate = () => {
      ring.current.x += (mouse.current.x - ring.current.x) * 0.12;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.12;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ring.current.x}px, ${ring.current.y}px)`;
      }
      raf.current = requestAnimationFrame(animate);
    };
    window.addEventListener('mousemove', onMove);
    raf.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <>
      <div ref={dotRef}  className="cursor-dot"  />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}

/* ─── Click ripple ────────────────────────────────────────────── */
function ClickRipple() {
  useEffect(() => {
    const handler = (e) => {
      const ripple = document.createElement('div');
      ripple.className = 'click-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top  = `${e.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);
  return null;
}

/* ─── Magnetic buttons ────────────────────────────────────────── */
function MagneticButtons() {
  useEffect(() => {
    const SELECTORS = '.btn-primary, .dash-refresh-btn, .promo-cta, .page-btn';
    const els = document.querySelectorAll(SELECTORS);

    const handlers = [];
    els.forEach((el) => {
      const onMove = (e) => {
        const rect  = el.getBoundingClientRect();
        const cx    = rect.left + rect.width  / 2;
        const cy    = rect.top  + rect.height / 2;
        const dx    = (e.clientX - cx) * 0.22;
        const dy    = (e.clientY - cy) * 0.22;
        el.style.transform = `translate(${dx}px, ${dy}px) scale(1.04)`;
      };
      const onLeave = () => {
        el.style.transform = '';
      };
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', onLeave);
      handlers.push({ el, onMove, onLeave });
    });

    return () => {
      handlers.forEach(({ el, onMove, onLeave }) => {
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseleave', onLeave);
        el.style.transform = '';
      });
    };
  });   // re-run every render so new buttons get wired up

  return null;
}

/* ─── 3-D card tilt ───────────────────────────────────────────── */
function CardTilt() {
  useEffect(() => {
    const CARD_SEL = '.stat-card, .sidebar-card, .feature-card, .archive-card, .detail-card';
    const cards = document.querySelectorAll(CARD_SEL);
    const handlers = [];

    cards.forEach((card) => {
      const onMove = (e) => {
        const rect   = card.getBoundingClientRect();
        const x      = e.clientX - rect.left;
        const y      = e.clientY - rect.top;
        const cx     = rect.width  / 2;
        const cy     = rect.height / 2;
        const rotX   = ((y - cy) / cy) * -8;
        const rotY   = ((x - cx) / cx) *  8;
        card.style.transform   = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
        card.style.transition  = 'transform 0.06s linear, box-shadow 0.2s';
        card.style.boxShadow   = `${-rotY * 0.5}px ${rotX * 0.5}px 28px rgba(108,99,255,0.18)`;
        // Shine overlay
        const shine = card.querySelector('.card-shine');
        if (shine) {
          shine.style.opacity    = '1';
          shine.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.18) 0%, transparent 70%)`;
        }
      };
      const onLeave = () => {
        card.style.transform  = '';
        card.style.boxShadow  = '';
        card.style.transition = 'transform 0.45s ease, box-shadow 0.45s ease';
        const shine = card.querySelector('.card-shine');
        if (shine) shine.style.opacity = '0';
      };

      // Inject a shine div
      if (!card.querySelector('.card-shine')) {
        const shine = document.createElement('div');
        shine.className = 'card-shine';
        card.appendChild(shine);
      }

      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
      handlers.push({ card, onMove, onLeave });
    });

    return () => {
      handlers.forEach(({ card, onMove, onLeave }) => {
        card.removeEventListener('mousemove', onMove);
        card.removeEventListener('mouseleave', onLeave);
        card.style.transform = card.style.boxShadow = '';
      });
    };
  });

  return null;
}

/* ─── Aurora blob ─────────────────────────────────────────────── */
function AuroraBlob() {
  return (
    <div className="aurora-stage" aria-hidden="true">
      <div className="aurora-blob a1" />
      <div className="aurora-blob a2" />
      <div className="aurora-blob a3" />
    </div>
  );
}

/* ─── Main export ─────────────────────────────────────────────── */
export default function SiteEffects() {
  return (
    <>
      <AuroraBlob />
      <CursorGlow />
      <ClickRipple />
      <MagneticButtons />
      <CardTilt />
    </>
  );
}
