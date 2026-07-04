'use client';

import { useEffect, useRef } from 'react';

export default function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 300ms ease';
        el.style.opacity = '1';
      });
    });

    const fadeOutTimer = setTimeout(() => {
      el.style.transition = 'opacity 300ms ease';
      el.style.opacity = '0';
    }, 3700);

    const finishTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 4000);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@700;800&display=swap');
        .pichat-splash {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          background: #000;
          display: grid;
          place-items: center;
          z-index: 999999;
          overflow: hidden;
        }
        .pichat-splash-inner {
          position: relative;
          width: min(100vw, 430px);
          height: min(100vh, 932px);
          overflow: hidden;
          background:
            linear-gradient(rgba(170,190,210,.075) 1px, transparent 1px),
            linear-gradient(90deg, rgba(170,190,210,.075) 1px, transparent 1px),
            radial-gradient(circle at 50% 42%, rgba(44,70,98,.28) 0%, transparent 36%),
            linear-gradient(180deg, #081522 0%, #06111e 100%);
          background-size: 32px 32px, 32px 32px, 100% 100%, 100% 100%;
        }
        .pichat-center {
          position: absolute;
          left: 50%;
          top: 47%;
          transform: translate(-50%, -50%);
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 2;
        }
        .pichat-mark {
          width: 118px;
          height: 118px;
          display: grid;
          place-items: center;
          filter: drop-shadow(0 0 6px rgba(255,255,255,.26)) drop-shadow(0 0 14px rgba(255,255,255,.10));
        }
        .pichat-wordmark {
          margin-top: 42px;
          font-family: 'League Spartan', system-ui, sans-serif;
          font-size: clamp(48px, 15vw, 68px);
          line-height: .82;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -2px;
          text-shadow: 0 5px 16px rgba(0,0,0,.38);
        }
        .pichat-tagline {
          margin-top: 28px;
          width: 100%;
          padding: 0 22px;
          color: rgba(240,244,248,.88);
          font-size: clamp(10px, 3vw, 12px);
          line-height: 1.25;
          letter-spacing: 4.2px;
          font-weight: 600;
          text-align: center;
          white-space: nowrap;
          text-shadow: 0 0 8px rgba(255,255,255,.10);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        @media (max-width: 380px) {
          .pichat-tagline { font-size: 10px; letter-spacing: 3.2px; padding: 0 16px; white-space: normal; }
        }
      `}</style>
      <div
        ref={ref}
        className="pichat-splash"
        style={{ opacity: 0 }}
        aria-label="PiChat splash screen"
      >
        <div className="pichat-splash-inner">
          {/* Background SVG geometry */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            viewBox="0 0 430 932"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <style>{`
                .g{fill:none;stroke:rgba(232,238,246,.28);stroke-width:1.15;vector-effect:non-scaling-stroke;}
                .gs{fill:none;stroke:rgba(232,238,246,.18);stroke-width:.9;vector-effect:non-scaling-stroke;}
                .d{fill:rgba(232,238,246,.58);}
              `}</style>
            </defs>

            {/* top-left blueprint square system */}
            <g opacity=".74">
              <line x1="-4" y1="54" x2="164" y2="54" className="gs" strokeDasharray="4 8"/>
              <line x1="25" y1="0" x2="25" y2="272" className="gs" strokeDasharray="4 8"/>
              <rect className="g" x="25" y="54" width="140" height="140"/>
              <rect className="g" x="67" y="88" width="54" height="54"/>
              <path className="gs" d="M25 194L165 54M25 54L165 194"/>
              <path className="gs" d="M67 142L121 88M67 88L121 142"/>
              <circle className="d" cx="25" cy="54" r="2.3"/>
              <circle className="d" cx="165" cy="54" r="2.3"/>
              <circle className="d" cx="25" cy="194" r="2.3"/>
              <circle className="d" cx="165" cy="194" r="2.3"/>
              <circle className="d" cx="95" cy="54" r="1.35"/>
              <circle className="d" cx="95" cy="194" r="1.35"/>
              <circle className="d" cx="25" cy="124" r="1.35"/>
              <circle className="d" cx="165" cy="124" r="1.35"/>
            </g>

            {/* bottom-right blueprint square system */}
            <g opacity=".74">
              <line x1="212" y1="865" x2="430" y2="865" className="gs" strokeDasharray="4 8"/>
              <line x1="397" y1="642" x2="397" y2="932" className="gs" strokeDasharray="4 8"/>
              <rect className="g" x="274" y="710" width="140" height="140"/>
              <rect className="g" x="343" y="762" width="62" height="62"/>
              <path className="gs" d="M274 850L414 710M274 710L414 850"/>
              <path className="gs" d="M343 824L405 762M343 762L405 824"/>
              <circle className="d" cx="274" cy="710" r="2.3"/>
              <circle className="d" cx="414" cy="710" r="2.3"/>
              <circle className="d" cx="274" cy="850" r="2.3"/>
              <circle className="d" cx="414" cy="850" r="2.3"/>
              <circle className="d" cx="344" cy="710" r="1.35"/>
              <circle className="d" cx="344" cy="850" r="1.35"/>
              <circle className="d" cx="274" cy="780" r="1.35"/>
              <circle className="d" cx="414" cy="780" r="1.35"/>
            </g>

            {/* sparse reference dots */}
            <circle className="d" cx="215" cy="255" r="1.55" opacity=".75"/>
            <circle className="d" cx="215" cy="650" r="1.55" opacity=".75"/>
          </svg>

          {/* Center content */}
          <section className="pichat-center">
            <div className="pichat-mark">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="-94 -94 188 188"
                width="118"
                height="118"
                role="img"
                aria-label="PiChat logo"
              >
                <rect x="-90" y="-90" width="180" height="180"
                  fill="none" stroke="#FFFFFF" strokeWidth="4"
                  shapeRendering="geometricPrecision"/>
                <circle cx="0" cy="0" r="82"
                  fill="none" stroke="#FFFFFF" strokeWidth="3.5"
                  shapeRendering="geometricPrecision"/>
                <g fill="#FFFFFF" shapeRendering="crispEdges">
                  <rect x="-30" y="-45" width="60" height="7"/>
                  <rect x="-30" y="-45" width="7" height="90"/>
                  <rect x="23" y="-45" width="7" height="90"/>
                </g>
              </svg>
            </div>
            <h1 className="pichat-wordmark">PiChat</h1>
            <p className="pichat-tagline">GATEWAY TO KNOWLEDGE</p>
          </section>
        </div>
      </div>
    </>
  );
}
