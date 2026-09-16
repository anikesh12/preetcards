import React from "react";

/**
 * CustomizedCardTemplate
 *
 * Polaroid-style photo frame layout decorated with balloons, confetti,
 * a cake and a party hat, rendered with the app's celebratory palette.
 *
 * Used in two places:
 *  - mode="preview": small style-picker thumbnail (decorations auto-scaled down)
 *  - mode="full":    actual card view rendering
 */

// Matches the app's existing celebratory color tokens — do not introduce new hex values.
const PALETTE = {
  coral: "#FF6F91",
  gold: "#FFC75F",
  plum: "#2E1F3B",
  cream: "#FFFBF5",
};

function Balloon({ color, style }) {
  return (
    <div className="cct-decor cct-decor-balloon" style={style}>
      <svg viewBox="0 0 64 84" width="100%" height="100%" aria-hidden="true">
        <ellipse cx="32" cy="30" rx="28" ry="30" fill={color} />
        <path
          d="M32 60 L27 68 L37 68 Z"
          fill={color}
        />
        <line
          x1="32"
          y1="68"
          x2="32"
          y2="84"
          stroke={PALETTE.plum}
          strokeWidth="1.5"
          strokeDasharray="2 3"
        />
        <ellipse
          cx="22"
          cy="18"
          rx="7"
          ry="10"
          fill="#FFFFFF"
          opacity="0.25"
        />
      </svg>
    </div>
  );
}

function Confetti({ className = "", style }) {
  const shapes = [
    { fill: PALETTE.coral, r: "circle" },
    { fill: PALETTE.gold, r: "rect" },
    { fill: PALETTE.plum, r: "rect" },
    { fill: PALETTE.gold, r: "circle" },
    { fill: PALETTE.coral, r: "rect" },
  ];

  return (
    <div className={`cct-decor cct-decor-confetti ${className}`.trim()} style={style}>
      <svg viewBox="0 0 120 60" width="100%" height="100%" aria-hidden="true">
        {shapes.map((s, i) => {
          const x = (i * 120) / shapes.length + 8;
          const y = (i % 2 === 0 ? 10 : 34) + (i * 3) % 10;
          const rotation = (i * 37) % 360;
          return s.r === "circle" ? (
            <circle key={i} cx={x} cy={y} r="4" fill={s.fill} />
          ) : (
            <rect
              key={i}
              x={x - 4}
              y={y - 4}
              width="8"
              height="8"
              fill={s.fill}
              transform={`rotate(${rotation} ${x} ${y})`}
            />
          );
        })}
      </svg>
    </div>
  );
}

function Cake({ style }) {
  return (
    <div className="cct-decor cct-decor-cake" style={style}>
      <svg viewBox="0 0 100 90" width="100%" height="100%" aria-hidden="true">
        <rect x="15" y="45" width="70" height="35" rx="6" fill={PALETTE.coral} />
        <rect x="15" y="45" width="70" height="10" fill={PALETTE.gold} />
        <rect x="30" y="25" width="40" height="22" rx="4" fill={PALETTE.gold} />
        <rect x="46" y="6" width="4" height="20" fill="#E8A93A" />
        <path d="M48 2 C44 6 52 10 48 14" stroke={PALETTE.coral} strokeWidth="3" fill="none" />
        <circle cx="30" cy="60" r="3" fill={PALETTE.cream} />
        <circle cx="45" cy="65" r="3" fill={PALETTE.cream} />
        <circle cx="60" cy="60" r="3" fill={PALETTE.cream} />
        <circle cx="72" cy="66" r="3" fill={PALETTE.cream} />
      </svg>
    </div>
  );
}

function PartyHat({ style }) {
  return (
    <div className="cct-decor cct-decor-hat" style={style}>
      <svg viewBox="0 0 60 70" width="100%" height="100%" aria-hidden="true">
        <polygon points="30,2 55,64 5,64" fill={PALETTE.plum} />
        <polygon points="30,2 55,64 5,64" fill={PALETTE.coral} opacity="0.15" />
        <circle cx="30" cy="20" r="4" fill={PALETTE.gold} />
        <circle cx="24" cy="34" r="3" fill={PALETTE.cream} />
        <circle cx="38" cy="40" r="3" fill={PALETTE.gold} />
        <circle cx="30" cy="52" r="3" fill={PALETTE.cream} />
        <circle cx="30" cy="2" r="5" fill={PALETTE.gold} />
      </svg>
    </div>
  );
}

function Polaroid({ src, alt, rotation, index }) {
  return (
    <div
      className="cct-polaroid"
      style={{ transform: `rotate(${rotation}deg)`, zIndex: index }}
    >
      <div className="cct-polaroid-photo">
        {src ? (
          <img src={src} alt={alt} loading="lazy" />
        ) : (
          <div className="cct-polaroid-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="cct-polaroid-caption" />
    </div>
  );
}

const ROTATIONS = [-6, 4, -3, 7, -8, 3];

export default function CustomizedCardTemplate({
  recipientName = "Friend",
  message = "",
  photos = [],
  mode = "full",
  className = "",
}) {
  const isPreview = mode === "preview";
  const displayPhotos = photos.length > 0 ? photos.slice(0, 6) : [null, null];

  return (
    <div
      className={`cct-root ${isPreview ? "cct-root--preview" : ""} ${className}`.trim()}
    >
      <style>{`
        .cct-root {
          position: relative;
          width: 100%;
          min-height: 100%;
          box-sizing: border-box;
          padding: 28px 20px 36px;
          border-radius: 20px;
          overflow: hidden;
          background: linear-gradient(160deg, ${PALETTE.cream} 0%, #FFF3E4 100%);
          font-family: 'Poppins', system-ui, -apple-system, sans-serif;
          color: ${PALETTE.plum};
          isolation: isolate;
        }
        .cct-root--preview {
          padding: 14px 10px 18px;
          border-radius: 12px;
        }
        .cct-decor {
          position: absolute;
          pointer-events: none;
          z-index: 0;
        }
        .cct-root--preview .cct-decor {
          transform: scale(0.6);
        }
        .cct-decor-balloon {
          width: 56px;
          height: 74px;
        }
        .cct-decor-confetti {
          width: 140px;
          height: 70px;
        }
        .cct-decor-cake {
          width: 90px;
          height: 80px;
        }
        .cct-decor-hat {
          width: 54px;
          height: 62px;
        }
        .cct-decor-balloon-left {
          top: -10px;
          left: -14px;
        }
        .cct-decor-balloon-right {
          top: -6px;
          right: -10px;
        }
        .cct-decor-hat-right {
          top: 6px;
          right: 8px;
        }
        .cct-decor-confetti-top {
          top: 0;
          left: 50%;
          transform: translateX(-50%);
        }
        .cct-root--preview .cct-decor-confetti-top {
          transform: translateX(-50%) scale(0.6);
        }
        .cct-decor-cake-bottom {
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
        }
        .cct-root--preview .cct-decor-cake-bottom {
          transform: translateX(-50%) scale(0.6);
        }
        .cct-content {
          position: relative;
          z-index: 1;
        }
        .cct-heading {
          margin: 0 0 4px;
          text-align: center;
          font-weight: 700;
          font-size: ${isPreview ? "14px" : "clamp(24px, 5vw, 36px)"};
          color: ${PALETTE.gold};
          text-shadow: 1px 1px 0 ${PALETTE.plum}, -1px -1px 0 ${PALETTE.plum},
            1px -1px 0 ${PALETTE.plum}, -1px 1px 0 ${PALETTE.plum};
          line-height: 1.2;
        }
        .cct-message-panel {
          margin: ${isPreview ? "8px" : "16px"} auto;
          max-width: 90%;
          background: #FFFFFF;
          border-radius: ${isPreview ? "8px" : "16px"};
          box-shadow: 0 4px 14px rgba(46, 31, 59, 0.12);
          padding: ${isPreview ? "8px 10px" : "16px 20px"};
          white-space: pre-wrap;
          font-size: ${isPreview ? "8px" : "16px"};
          line-height: 1.5;
          color: ${PALETTE.plum};
          text-align: center;
        }
        .cct-gallery {
          display: grid;
          grid-template-columns: repeat(${isPreview ? 2 : 3}, 1fr);
          gap: ${isPreview ? "10px" : "22px"};
          margin-top: ${isPreview ? "10px" : "24px"};
          justify-items: center;
        }
        .cct-polaroid {
          background: #FFFFFF;
          padding: ${isPreview ? "4px 4px 10px" : "10px 10px 26px"};
          border-radius: 4px;
          box-shadow: 0 6px 12px rgba(46, 31, 59, 0.18);
          width: 100%;
          max-width: ${isPreview ? "60px" : "160px"};
          transition: transform 0.2s ease;
        }
        .cct-polaroid-photo {
          width: 100%;
          aspect-ratio: 1 / 1;
          overflow: hidden;
          background: ${PALETTE.cream};
          border-radius: 2px;
        }
        .cct-polaroid-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .cct-polaroid-placeholder {
          width: 100%;
          height: 100%;
          background: repeating-linear-gradient(
            45deg,
            ${PALETTE.cream},
            ${PALETTE.cream} 6px,
            #FFF0DC 6px,
            #FFF0DC 12px
          );
        }
      `}</style>

      {/* Decorative graphics */}
      <Balloon
        color={PALETTE.coral}
        style={{ position: "absolute" }}
        className="cct-decor-balloon-left"
      />
      <div className="cct-decor cct-decor-balloon cct-decor-balloon-left">
        <Balloon color={PALETTE.coral} style={{ position: "static" }} />
      </div>
      <div className="cct-decor cct-decor-balloon cct-decor-balloon-right">
        <Balloon color={PALETTE.gold} style={{ position: "static" }} />
      </div>
      <div className="cct-decor cct-decor-hat cct-decor-hat-right">
        <PartyHat style={{ position: "static" }} />
      </div>
      <Confetti className="cct-decor-confetti-top" />
      <div className="cct-decor cct-decor-cake cct-decor-cake-bottom">
        <Cake style={{ position: "static" }} />
      </div>

      <div className="cct-content">
        <h1 className="cct-heading">Happy Birthday, {recipientName}!</h1>

        {message ? (
          <div className="cct-message-panel">{message}</div>
        ) : null}

        <div className="cct-gallery">
          {displayPhotos.map((src, i) => (
            <Polaroid
              key={src || `placeholder-${i}`}
              src={src}
              alt={src ? `Photo ${i + 1} for ${recipientName}` : "Photo placeholder"}
              rotation={ROTATIONS[i % ROTATIONS.length]}
              index={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}