"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

const VB = 1000;

const C = {
  leatherDark:  "#7a4226",
  leatherMid:   "#945d47",
  leatherLight: "#a4694e",
  leatherShine: "#b88067",
  stitchBrown:  "#5e2f1a",
  stripe:       "#fafafa",
  stripeShadow: "#e8e0d4",
  arm:          "#a26c34",
  armShadow:    "#7a4f1f",
  glove:        "#f4f2ee",
  gloveShadow:  "#d8d2c6",
  shoe:         "#fafafa",
  shoeShadow:   "#cdc7bb",
  shoeSole:     "#8a8478",
  brow:         "#7a3d20",
  eyeBlack:     "#1a1410",
  eyeWhite:     "#ffffff",
  mouth:        "#1a0808",
  tongue:       "#c7464a",
  floor:        "#dde2e6",
};

const BODY  = { cx: 500, cy: 480, rx: 200, ry: 270 };
const EYE_L = { cx: 460, cy: 430, rx: 38, ry: 50 };
const EYE_R = { cx: 555, cy: 430, rx: 38, ry: 50 };
const BROW_L = { cx: 460, cy: 360 };
const BROW_R = { cx: 560, cy: 360 };
const MOUTH  = { cx: 500, cy: 555, w: 80, h: 30 };
const ARM_L  = { sx: 320, sy: 550, ex: 260, ey: 660 };
const ARM_R  = { sx: 680, sy: 550, ex: 740, ey: 660 };

function useRaf(cb: (t: number, dt: number) => void) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    let id: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      cbRef.current(now / 1000, dt);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}

function useSpring(target: number, stiffness = 14) {
  const [val, setVal] = useState(target);
  const valRef = useRef(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  useRaf((_, dt) => {
    const k = 1 - Math.exp(-stiffness * dt);
    const next = valRef.current + (targetRef.current - valRef.current) * k;
    if (Math.abs(next - valRef.current) > 0.0001) {
      valRef.current = next;
      setVal(next);
    }
  });
  return val;
}

function useEyeTrack(rectRef: React.RefObject<HTMLDivElement | null>) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = rectRef.current?.getBoundingClientRect();
      if (!r) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.45;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy) || 1;
      const max = 12;
      const ux = (dx / d) * Math.min(max, d / 24);
      const uy = (dy / d) * Math.min(max, d / 36);
      setPos({ x: ux, y: uy });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [rectRef]);
  return pos;
}

function useBlink() {
  const [closed, setClosed] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const wait = 1800 + Math.random() * 4200;
      timer = setTimeout(() => {
        setClosed(1);
        setTimeout(() => setClosed(0), 110);
        if (Math.random() < 0.18) {
          setTimeout(() => setClosed(1), 240);
          setTimeout(() => setClosed(0), 340);
        }
        schedule();
      }, wait);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return closed;
}

function mouthPath(open: number, vowel = 0.5): string {
  const cx = MOUTH.cx, cy = MOUTH.cy;
  const halfW = (MOUTH.w / 2) * (0.55 + 0.45 * vowel);
  const halfH = (MOUTH.h / 2) * Math.max(0.05, open);
  if (open < 0.06) {
    const dip = 5;
    return `M ${cx - halfW} ${cy} Q ${cx} ${cy + dip} ${cx + halfW} ${cy}`;
  }
  const t = halfH * 0.85;
  return [
    `M ${cx - halfW} ${cy}`,
    `Q ${cx} ${cy - t * 0.5} ${cx + halfW} ${cy}`,
    `Q ${cx} ${cy + halfH * 1.05} ${cx - halfW} ${cy}`,
    "Z",
  ].join(" ");
}

function BodyShape() {
  const { cx, cy, rx, ry } = BODY;
  return (
    <>
      <path
        d={`M ${cx} ${cy - ry} C ${cx + rx} ${cy - ry * 0.7} ${cx + rx} ${cy + ry * 0.7} ${cx} ${cy + ry} C ${cx - rx} ${cy + ry * 0.7} ${cx - rx} ${cy - ry * 0.7} ${cx} ${cy - ry} Z`}
        fill="url(#leatherGrad)" stroke={C.leatherDark} strokeWidth="3"
      />
      <path
        d={`M 380 ${cy - ry * 0.6} Q ${cx} ${cy - ry * 0.78} 620 ${cy - ry * 0.6} L 620 ${cy - ry * 0.45} Q ${cx} ${cy - ry * 0.62} 380 ${cy - ry * 0.45} Z`}
        fill={C.stripe}
      />
      <path
        d={`M 380 ${cy + ry * 0.6} Q ${cx} ${cy + ry * 0.78} 620 ${cy + ry * 0.6} L 620 ${cy + ry * 0.72} Q ${cx} ${cy + ry * 0.9} 380 ${cy + ry * 0.72} Z`}
        fill={C.stripe}
      />
      <ellipse cx={cx - 70} cy={cy - 130} rx="30" ry="60" fill={C.leatherShine} opacity="0.45" transform={`rotate(-20 ${cx - 70} ${cy - 130})`} />
      <ellipse cx={cx - 95} cy={cy - 80} rx="8" ry="22" fill="#fff" opacity="0.5" transform={`rotate(-15 ${cx - 95} ${cy - 80})`} />
      <g>
        <rect x={cx + 38} y={cy - 60} width="14" height="180" rx="7" fill={C.stripe} />
        {[-50, -28, -6, 16, 38, 60, 82, 104].map((dy, i) => (
          <rect key={i} x={cx + 32} y={cy + dy} width="26" height="6" rx="3" fill={C.stripe} stroke={C.leatherDark} strokeWidth="1" />
        ))}
      </g>
    </>
  );
}

function Brow({ cx, cy, flip, lift }: { cx: number; cy: number; flip: boolean; lift: number }) {
  const path = flip
    ? `M ${cx - 28} ${cy + 8} Q ${cx} ${cy - 10} ${cx + 28} ${cy + 4}`
    : `M ${cx - 28} ${cy + 4} Q ${cx} ${cy - 10} ${cx + 28} ${cy + 8}`;
  return (
    <g style={{ transform: `translate(0px, ${-lift}px)`, transformOrigin: `${cx}px ${cy}px` }}>
      <path d={path} stroke={C.brow} strokeWidth="14" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Glove({ cx, cy, fist = false }: { cx: number; cy: number; fist?: boolean }) {
  if (!fist) {
    return (
      <g>
        <ellipse cx={cx} cy={cy + 14} rx={56} ry={60} fill="url(#gloveGrad)" stroke={C.gloveShadow} strokeWidth="4" />
        {[-34, -12, 10, 32].map((dx, i) => (
          <rect key={i} x={cx + dx - 11} y={cy - 60} width={22} height={56} rx={11} fill="url(#gloveGrad)" stroke={C.gloveShadow} strokeWidth="4" />
        ))}
        <ellipse cx={cx + 48} cy={cy + 22} rx={16} ry={24} fill="url(#gloveGrad)" stroke={C.gloveShadow} strokeWidth="4" transform={`rotate(40 ${cx + 48} ${cy + 22})`} />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={56} ry={50} fill="url(#gloveGrad)" stroke={C.gloveShadow} strokeWidth="4" />
      {[-28, -9, 10, 29].map((dx, i) => (
        <ellipse key={i} cx={cx + dx} cy={cy - 18} rx={11} ry={15} fill="url(#gloveGrad)" stroke={C.gloveShadow} strokeWidth="3" />
      ))}
      <ellipse cx={cx - 38} cy={cy + 10} rx={15} ry={20} fill="url(#gloveGrad)" stroke={C.gloveShadow} strokeWidth="4" />
    </g>
  );
}

function Shoe({ cx, cy, flip }: { cx: number; cy: number; flip: boolean }) {
  const f = flip ? -1 : 1;
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${f}, 1)`}>
      <path d="M -42 -20 Q -52 -26 -46 4 Q -46 26 -16 30 L 48 30 Q 60 30 60 16 L 60 0 Q 60 -14 40 -18 L 0 -22 Z" fill="url(#shoeGrad)" stroke={C.shoeShadow} strokeWidth="2.5" />
      <path d="M -46 22 L 60 22 L 60 30 Q 60 34 48 34 L -16 34 Q -44 34 -46 22 Z" fill={C.shoeSole} opacity="0.8" />
      <path d="M -14 -12 L 8 -4" stroke={C.shoeShadow} strokeWidth="2.5" />
    </g>
  );
}

interface MascotProps {
  openness?: number;
  vowel?: number;
  waving?: boolean;
  intensity?: number;
  excited?: boolean;
  sizePx?: number;
}

export default function Mascot({
  openness = 0,
  vowel = 0.5,
  waving = false,
  intensity = 0.5,
  excited = false,
  sizePx = 380,
}: MascotProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const eye = useEyeTrack(wrapRef);
  const blink = useBlink();

  const [bobT, setBobT] = useState(0);
  useRaf((t) => setBobT(t));

  const bobSpeed = 1.6 + intensity * 1.4;

  const [waveTs, setWaveTs] = useState(0);
  useEffect(() => {
    if (waving) setWaveTs(performance.now() / 1000);
  }, [waving]);
  const waveAge = bobT - waveTs;
  const waveAngle =
    waveTs > 0 && waveAge < 1.8
      ? Math.sin(waveAge * 14) * Math.exp(-waveAge * 2.0) * 28
      : 0;

  const openSm = useSpring(openness, 30);
  const vowelSm = useSpring(vowel, 14);
  const browLift = (excited ? 6 : 0) + Math.min(openSm, 0.8) * 7;

  const px = eye.x, py = eye.y;
  const lid = blink;
  const armRSwing = Math.sin(bobT * bobSpeed + 0.5) * 1.2 + waveAngle;

  return (
    <div ref={wrapRef} style={{ width: sizePx, height: sizePx }}>
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        width={sizePx}
        height={sizePx}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <radialGradient id="leatherGrad" cx="0.4" cy="0.3" r="0.9">
            <stop offset="0%" stopColor={C.leatherShine} />
            <stop offset="40%" stopColor={C.leatherMid} />
            <stop offset="100%" stopColor={C.leatherDark} />
          </radialGradient>
          <linearGradient id="gloveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.glove} />
            <stop offset="100%" stopColor={C.gloveShadow} />
          </linearGradient>
          <linearGradient id="shoeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.shoe} />
            <stop offset="100%" stopColor={C.shoeShadow} />
          </linearGradient>
          <radialGradient id="floorGrad" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={C.floor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={C.floor} stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="500" cy="900" rx="220" ry="28" fill="url(#floorGrad)" />

        <g style={{ transform: `translate(0px, 0px)`, transformOrigin: `${BODY.cx}px ${BODY.cy + 200}px` }}>
          <g>
            <path d="M 450 720 Q 442 770 432 815" stroke={C.arm} strokeWidth="22" strokeLinecap="round" fill="none" />
            <path d="M 550 720 Q 558 770 568 815" stroke={C.arm} strokeWidth="22" strokeLinecap="round" fill="none" />
            <Shoe cx={420} cy={840} flip={false} />
            <Shoe cx={580} cy={840} flip={true} />
          </g>

          <g style={{ transform: `rotate(${armRSwing}deg)`, transformOrigin: `${ARM_R.sx}px ${ARM_R.sy}px` }}>
            <path
              d={`M ${ARM_R.sx} ${ARM_R.sy} Q ${ARM_R.sx + 60} ${ARM_R.sy + 30} ${ARM_R.ex} ${ARM_R.ey}`}
              stroke={C.arm} strokeWidth="20" strokeLinecap="round" fill="none"
            />
            <Glove cx={ARM_R.ex} cy={ARM_R.ey + 20} fist />
          </g>

          <BodyShape />

          <ellipse cx={EYE_L.cx} cy={EYE_L.cy} rx={EYE_L.rx} ry={EYE_L.ry} fill={C.eyeWhite} stroke={C.stitchBrown} strokeWidth="3" />
          <ellipse cx={EYE_R.cx} cy={EYE_R.cy} rx={EYE_R.rx} ry={EYE_R.ry} fill={C.eyeWhite} stroke={C.stitchBrown} strokeWidth="3" />

          <ellipse cx={EYE_L.cx + px} cy={EYE_L.cy + py + 4} rx="14" ry="20" fill={C.eyeBlack} />
          <ellipse cx={EYE_R.cx + px} cy={EYE_R.cy + py + 4} rx="14" ry="20" fill={C.eyeBlack} />
          <ellipse cx={EYE_L.cx + px - 4} cy={EYE_L.cy + py - 2} rx="4" ry="6" fill="#ffffff" />
          <ellipse cx={EYE_R.cx + px - 4} cy={EYE_R.cy + py - 2} rx="4" ry="6" fill="#ffffff" />

          {lid > 0 && (
            <>
              <ellipse cx={EYE_L.cx} cy={EYE_L.cy} rx={EYE_L.rx + 1} ry={EYE_L.ry + 1} fill="#f5e8d8" />
              <ellipse cx={EYE_R.cx} cy={EYE_R.cy} rx={EYE_R.rx + 1} ry={EYE_R.ry + 1} fill="#f5e8d8" />
              <line x1={EYE_L.cx - EYE_L.rx + 4} y1={EYE_L.cy} x2={EYE_L.cx + EYE_L.rx - 4} y2={EYE_L.cy} stroke={C.stitchBrown} strokeWidth="3" strokeLinecap="round" />
              <line x1={EYE_R.cx - EYE_R.rx + 4} y1={EYE_R.cy} x2={EYE_R.cx + EYE_R.rx - 4} y2={EYE_R.cy} stroke={C.stitchBrown} strokeWidth="3" strokeLinecap="round" />
            </>
          )}

          <Brow cx={BROW_L.cx} cy={BROW_L.cy} flip={false} lift={browLift} />
          <Brow cx={BROW_R.cx} cy={BROW_R.cy} flip={true} lift={browLift * 1.1} />

          <path
            d={mouthPath(openSm, vowelSm)}
            fill={openSm > 0.06 ? C.mouth : "none"}
            stroke={C.mouth} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"
          />
          {openSm > 0.2 && (
            <ellipse
              cx={MOUTH.cx}
              cy={MOUTH.cy + MOUTH.h * openSm * 0.35}
              rx={MOUTH.w * 0.3 * (0.55 + 0.45 * vowelSm)}
              ry={MOUTH.h * openSm * 0.5}
              fill={C.tongue}
              opacity={Math.min(1, (openSm - 0.15) * 3)}
            />
          )}
          {openSm > 0.45 && (
            <rect
              x={MOUTH.cx - MOUTH.w * 0.28}
              y={MOUTH.cy - MOUTH.h * openSm * 0.5}
              width={MOUTH.w * 0.56} height="4"
              fill="#fff" rx={1}
              opacity={Math.min(1, (openSm - 0.4) * 4)}
            />
          )}

          <g style={{ transform: `rotate(${-armRSwing * 0.6}deg)`, transformOrigin: `${ARM_L.sx}px ${ARM_L.sy}px` }}>
            <path
              d={`M ${ARM_L.sx} ${ARM_L.sy} Q ${ARM_L.sx - 60} ${ARM_L.sy + 30} ${ARM_L.ex} ${ARM_L.ey}`}
              stroke={C.arm} strokeWidth="20" strokeLinecap="round" fill="none"
            />
            <Glove cx={ARM_L.ex} cy={ARM_L.ey + 20} fist />
          </g>
        </g>
      </svg>
    </div>
  );
}

export function useTalkAnimation(currentText: string, isTalking: boolean, speed = 1.0) {
  const [openness, setOpenness] = useState(0);
  const [vowel, setVowel] = useState(0.5);
  const lastLenRef = useRef(0);

  useEffect(() => {
    if (!isTalking) {
      setOpenness(0);
      lastLenRef.current = currentText.length;
      return;
    }
    const len = currentText.length;
    const grew = len > lastLenRef.current;
    const newChar = grew ? currentText[len - 1] : "";
    if (grew) {
      const c = (newChar || "").toLowerCase();
      let amp = 0.4 + Math.random() * 0.5;
      if (/[aoæ]/.test(c)) { amp = 0.7 + Math.random() * 0.3; setVowel(0.85); }
      else if (/[eiy]/.test(c)) { amp = 0.45 + Math.random() * 0.2; setVowel(0.25); }
      else if (/[u]/.test(c)) { amp = 0.55 + Math.random() * 0.2; setVowel(0.4); }
      else if (/[ ,.\n!?]/.test(c)) { amp = 0.05; }
      else { setVowel(0.5 + (Math.random() - 0.5) * 0.4); }
      setOpenness(amp);
    }
    lastLenRef.current = len;

    const id = setInterval(() => {
      setOpenness((v) => v * 0.7);
    }, 60 / speed);
    return () => clearInterval(id);
  }, [currentText, isTalking, speed]);

  return { openness, vowel };
}
