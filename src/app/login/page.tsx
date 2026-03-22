'use client';

import { useState, useRef, useEffect } from 'react';

// ── Robot constants ────────────────────────────────────────────────────────────
const VW = 300, VH = 330;
const HCX = 150, HCY = 160;
const LE = { cx: 110, cy: 150 };
const RE = { cx: 190, cy: 150 };
const ESW = 66, ESH = 54, EHH = 27;
const PR = 14, MT = 12;
const LBROW = { x: 109, y: 115 };
const RBROW = { x: 191, y: 115 };

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ── Idle expression presets ───────────────────────────────────────────────────
// { bL, bR: brow angles, mEY: mouth endpoint Y, mCY: control Y, lid: extra lid closure }
const EXPRS = [
  { bL:  0,  bR:  0,  mEY: 214, mCY: 230, lid: 0.00 }, // 0: happy
  { bL:  0,  bR:  0,  mEY: 218, mCY: 218, lid: 0.00 }, // 1: neutral (flat mouth)
  { bL: -8,  bR:  6,  mEY: 220, mCY: 211, lid: 0.42 }, // 2: suspicious
  { bL:  4,  bR:  4,  mEY: 221, mCY: 214, lid: 0.55 }, // 3: bored
  { bL:-13,  bR:  6,  mEY: 217, mCY: 223, lid: 0.20 }, // 4: thinking (1 brow)
];
const IDLE_SEQ = [0, 0, 0, 0, 1, 0, 0, 2, 0, 3, 0, 0, 4, 0, 0]; // weighted random pool

export default function LoginPage() {
  const [showPw, setShowPw]         = useState(false);
  const [pwFocused, setPwFocused]   = useState(false);
  const [loginState, setLoginState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [isShaking, setIsShaking]   = useState(false);
  const [isPoked, setIsPoked]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');

  const svgRef    = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const cRafRef   = useRef<number>(0);

  const mousePos    = useRef({ x: -1, y: -1 });
  const lPupil      = useRef({ x: 0, y: 0 });
  const rPupil      = useRef({ x: 0, y: 0 });
  const blinkProg   = useRef(0);
  const blinkPhase  = useRef<'idle' | 'closing' | 'opening'>('idle');
  const blinkTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pwRef       = useRef(false);

  // Smooth expression values (current interpolated state)
  const sMEY  = useRef(214);   // mouth endpoint Y
  const sMCY  = useRef(230);   // mouth control Y
  const sBL   = useRef(0);     // left brow angle
  const sBR   = useRef(0);     // right brow angle
  const sDim  = useRef(0);     // eye dim 0=bright 1=off
  const sLid  = useRef(0);     // extra eyelid from expression
  const sPwCl = useRef(0);     // eyelid from password focus

  // Idle expression state
  const idleExpr = useRef(EXPRS[0]);
  const exprTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Error
  const errorAmt = useRef(0);
  const errorDir = useRef<1 | -1 | 0>(0);

  // Poke
  const pokeAmt = useRef(0);
  const pokeDir = useRef<1 | -1 | 0>(0);

  useEffect(() => { pwRef.current = pwFocused; }, [pwFocused]);

  // ── Error animation trigger ──────────────────────────────────────────────────
  useEffect(() => {
    if (loginState === 'error') {
      setIsShaking(true);
      errorDir.current = 1;
      const t1 = setTimeout(() => { errorDir.current = -1; }, 1200);
      const t2 = setTimeout(() => { setIsShaking(false); setLoginState('idle'); }, 2800);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [loginState]);

  // ── Form submit ──────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loginState === 'loading') return;
    setLoginState('loading');
    setErrorMsg('');
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message ?? 'Credenciales incorrectas');
        setLoginState('error');
      } else {
        window.location.href = '/';
      }
    } catch {
      setErrorMsg('Error de conexión');
      setLoginState('error');
    }
  }

  // ── Poke handler ─────────────────────────────────────────────────────────────
  function handlePoke() {
    if (errorDir.current !== 0 || pokeDir.current !== 0) return;
    pokeDir.current = 1;
    setIsPoked(true);
    setTimeout(() => { pokeDir.current = -1; }, 350);
    setTimeout(() => { setIsPoked(false); }, 700);
  }

  // ── Canvas: estrellas + ondas espaciales ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width  = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    interface Star { x: number; y: number; r: number; phase: number; speed: number; }
    let stars: Star[] = [];
    function initStars() {
      stars = Array.from({ length: 220 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.4 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.8,
      }));
    }
    initStars();
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; initStars(); };
    window.addEventListener('resize', onResize);

    const waves = [
      { color: [80,  120, 255], a: 0.07, amp: 55, freq: 0.0040, spd: 0.35, yF: 0.20 },
      { color: [120,  50, 220], a: 0.05, amp: 75, freq: 0.0030, spd: 0.28, yF: 0.38 },
      { color: [0,   180, 220], a: 0.05, amp: 45, freq: 0.0050, spd: 0.45, yF: 0.55 },
      { color: [180,  30, 160], a: 0.04, amp: 65, freq: 0.0035, spd: 0.22, yF: 0.70 },
      { color: [40,  130, 255], a: 0.06, amp: 85, freq: 0.0025, spd: 0.32, yF: 0.85 },
      { color: [200,  80, 100], a: 0.03, amp: 50, freq: 0.0045, spd: 0.40, yF: 0.12 },
    ];

    let t = 0;
    function draw() {
      ctx!.clearRect(0, 0, w, h);
      for (const s of stars) {
        const op = 0.25 + 0.55 * Math.sin(t * s.speed + s.phase);
        ctx!.beginPath(); ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(210,225,255,${op})`; ctx!.fill();
      }
      for (const wv of waves) {
        const yBase = h * wv.yF; const [r, g, b] = wv.color;
        ctx!.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const y = yBase + Math.sin(x * wv.freq + t * wv.spd) * wv.amp;
          x === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
        }
        ctx!.strokeStyle = `rgba(${r},${g},${b},${wv.a})`; ctx!.lineWidth = 1.5; ctx!.stroke();
        ctx!.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const y = yBase + Math.sin(x * wv.freq * 2 + t * wv.spd * 1.3 + 1) * (wv.amp * 0.35);
          x === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
        }
        ctx!.strokeStyle = `rgba(${r},${g},${b},${wv.a * 0.5})`; ctx!.lineWidth = 0.8; ctx!.stroke();
      }
      t += 0.018;
      cRafRef.current = requestAnimationFrame(draw);
    }
    cRafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(cRafRef.current); window.removeEventListener('resize', onResize); };
  }, []);

  // ── Robot animation RAF ───────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const lpEl     = svg.querySelector<SVGCircleElement>('#lp');
    const rpEl     = svg.querySelector<SVGCircleElement>('#rp');
    const ltEl     = svg.querySelector<SVGRectElement>('#lt');
    const lbEl     = svg.querySelector<SVGRectElement>('#lb');
    const rtEl     = svg.querySelector<SVGRectElement>('#rt');
    const rbEl     = svg.querySelector<SVGRectElement>('#rb');
    const scanEl   = svg.querySelector<SVGRectElement>('#scan');
    const lBrowEl  = svg.querySelector<SVGGElement>('#lbrow');
    const rBrowEl  = svg.querySelector<SVGGElement>('#rbrow');
    const mouthEl  = svg.querySelector<SVGPathElement>('#mouth');
    const leRing   = svg.querySelector<SVGRectElement>('#le-ring');
    const reRing   = svg.querySelector<SVGRectElement>('#re-ring');
    const lIris    = svg.querySelector<SVGRectElement>('#l-iris');
    const rIris    = svg.querySelector<SVGRectElement>('#r-iris');
    const errBubEl = svg.querySelector<SVGGElement>('#err-bub');
    const lCatchEl = svg.querySelector<SVGEllipseElement>('#l-catch');
    const rCatchEl = svg.querySelector<SVGEllipseElement>('#r-catch');

    const onMove = (e: MouseEvent) => { mousePos.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMove);

    function getTarget(eye: { cx: number; cy: number }) {
      if (mousePos.current.x < 0) return { x: 0, y: 0 };
      const rect = svg!.getBoundingClientRect();
      if (!rect.width) return { x: 0, y: 0 };
      const sx = ((mousePos.current.x - rect.left) / rect.width)  * VW;
      const sy = ((mousePos.current.y - rect.top)  / rect.height) * VH;
      const dx = sx - eye.cx, dy = sy - eye.cy;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) return { x: 0, y: 0 };
      const f = Math.min(d / 80, 1) * MT;
      return { x: (dx / d) * f, y: (dy / d) * f };
    }

    // ── Blink scheduler ────────────────────────────────────────────────────────
    function scheduleBlink() {
      blinkTimer.current = setTimeout(() => { blinkPhase.current = 'closing'; }, 1800 + Math.random() * 3200);
    }
    scheduleBlink();

    // ── Idle expression scheduler ─────────────────────────────────────────────
    function scheduleExpr() {
      exprTimer.current = setTimeout(() => {
        // pick a random non-happy expression
        const idx = IDLE_SEQ[Math.floor(Math.random() * IDLE_SEQ.length)];
        if (idx !== 0) {
          idleExpr.current = EXPRS[idx];
          // return to happy after 2-4s
          setTimeout(() => {
            idleExpr.current = EXPRS[0];
            scheduleExpr();
          }, 2200 + Math.random() * 2000);
        } else {
          scheduleExpr();
        }
      }, 5000 + Math.random() * 7000);
    }
    scheduleExpr();

    let scanY = 0;

    function tick() {
      const pw   = pwRef.current;

      // ── Error progress ──────────────────────────────────────────────────────
      if (errorDir.current === 1)       errorAmt.current = Math.min(errorAmt.current + 0.045, 1);
      else if (errorDir.current === -1) {
        errorAmt.current = Math.max(errorAmt.current - 0.025, 0);
        if (errorAmt.current <= 0) errorDir.current = 0;
      }
      const errP = errorAmt.current;

      // ── Poke progress ───────────────────────────────────────────────────────
      if (pokeDir.current === 1)       pokeAmt.current = Math.min(pokeAmt.current + 0.14, 1);
      else if (pokeDir.current === -1) {
        pokeAmt.current = Math.max(pokeAmt.current - 0.07, 0);
        if (pokeAmt.current <= 0) pokeDir.current = 0;
      }
      const poke = pokeAmt.current;

      // ── Determine expression targets ────────────────────────────────────────
      const expr = idleExpr.current;
      let tBL   = expr.bL,  tBR   = expr.bR;
      let tMEY  = expr.mEY, tMCY  = expr.mCY;
      let tDim  = 0,        tLid  = expr.lid;

      if (pw) {
        // Password: eyes go dark, face goes serious
        tBL  = 5;   tBR  = -5;
        tMEY = 218; tMCY = 218; // flat/serious mouth
        tDim = 1;   tLid = 0.42;
      }

      if (poke > 0.01 && errP < 0.1) {
        // Poke: brows shoot up, wide eyes, big smile
        tBL  = lerp(tBL,  -26, poke);
        tBR  = lerp(tBR,   26, poke);
        tMEY = lerp(tMEY, 210, poke);
        tMCY = lerp(tMCY, 234, poke);
        tDim = 0; tLid = 0;
      }

      // Error overrides everything (handled below via errP blend)

      // ── Smooth lerp toward targets ──────────────────────────────────────────
      sBL.current  = lerp(sBL.current,  tBL,  0.08);
      sBR.current  = lerp(sBR.current,  tBR,  0.08);
      sMEY.current = lerp(sMEY.current, tMEY, 0.06);
      sMCY.current = lerp(sMCY.current, tMCY, 0.06);
      sDim.current = lerp(sDim.current, tDim, 0.07);
      sLid.current = lerp(sLid.current, tLid, 0.07);

      // ── Error blends OVER everything ────────────────────────────────────────
      const finalBL   = lerp(sBL.current,  20,  errP);
      const finalBR   = lerp(sBR.current, -20,  errP);
      const finalMEY  = lerp(sMEY.current, 222, errP);
      const finalMCY  = lerp(sMCY.current, 207, errP);
      const finalDim  = lerp(sDim.current, 0,   Math.min(errP * 4, 1)); // error un-dims (eyes turn red instead)

      // ── Pupils ──────────────────────────────────────────────────────────────
      // During password: freeze pupils looking down (don't track cursor)
      const lt = (pw && !errP) ? { x: -2, y: 8 } : getTarget(LE);
      const rt = (pw && !errP) ? { x:  2, y: 8 } : getTarget(RE);
      lPupil.current.x = lerp(lPupil.current.x, lt.x, 0.1);
      lPupil.current.y = lerp(lPupil.current.y, lt.y, 0.1);
      rPupil.current.x = lerp(rPupil.current.x, rt.x, 0.1);
      rPupil.current.y = lerp(rPupil.current.y, rt.y, 0.1);
      const lpx = LE.cx + lPupil.current.x, lpy = LE.cy + lPupil.current.y;
      const rpx = RE.cx + rPupil.current.x, rpy = RE.cy + rPupil.current.y;
      lpEl?.setAttribute('cx', String(lpx)); lpEl?.setAttribute('cy', String(lpy));
      rpEl?.setAttribute('cx', String(rpx)); rpEl?.setAttribute('cy', String(rpy));

      // Catchlights follow pupil
      lCatchEl?.setAttribute('cx', String(lpx + 5)); lCatchEl?.setAttribute('cy', String(lpy - 5));
      rCatchEl?.setAttribute('cx', String(rpx + 5)); rCatchEl?.setAttribute('cy', String(rpy - 5));

      // ── Eye brightness (dim on password, red on error) ──────────────────────
      const eR = Math.round(lerp(102, 255, errP));
      const eG = Math.round(lerp(221,  45, errP));
      const eB = Math.round(lerp(139,  45, errP));
      const brightness = 1 - finalDim;
      lpEl?.setAttribute('fill', `rgb(${eR},${eG},${eB})`);
      rpEl?.setAttribute('fill', `rgb(${eR},${eG},${eB})`);
      lpEl?.setAttribute('opacity', String(brightness));
      rpEl?.setAttribute('opacity', String(brightness));
      leRing?.setAttribute('stroke', `rgb(${eR},${eG},${eB})`);
      reRing?.setAttribute('stroke', `rgb(${eR},${eG},${eB})`);
      leRing?.setAttribute('opacity', String(brightness * 0.92));
      reRing?.setAttribute('opacity', String(brightness * 0.92));
      lIris?.setAttribute('opacity', String(brightness * 0.85));
      rIris?.setAttribute('opacity', String(brightness * 0.85));
      lCatchEl?.setAttribute('opacity', String(brightness));
      rCatchEl?.setAttribute('opacity', String(brightness));

      // Pupil dilates on error/poke
      const pr = Math.round(lerp(PR, PR + 4, Math.max(errP, poke * 0.5)));
      lpEl?.setAttribute('r', String(pr)); rpEl?.setAttribute('r', String(pr));

      // ── Blink (suppress during error) ──────────────────────────────────────
      if (errP < 0.2) {
        if (blinkPhase.current === 'closing') {
          blinkProg.current = Math.min(blinkProg.current + 0.15, 1);
          if (blinkProg.current >= 1) blinkPhase.current = 'opening';
        } else if (blinkPhase.current === 'opening') {
          blinkProg.current = Math.max(blinkProg.current - 0.1, 0);
          if (blinkProg.current <= 0) { blinkPhase.current = 'idle'; scheduleBlink(); }
        }
      }

      // ── Eyelids (blink + password + expression)
      sPwCl.current = lerp(sPwCl.current, pw ? 0.82 : 0, 0.07);
      const prog = Math.max(blinkProg.current, sPwCl.current, sLid.current);
      const topY = (LE.cy - EHH) - EHH + prog * EHH;
      const botY = (LE.cy + EHH) - prog * EHH;
      ltEl?.setAttribute('y', String(topY)); lbEl?.setAttribute('y', String(botY));
      rtEl?.setAttribute('y', String(topY)); rbEl?.setAttribute('y', String(botY));

      // ── Eyebrows ────────────────────────────────────────────────────────────
      lBrowEl?.setAttribute('transform', `rotate(${-finalBL}, ${LBROW.x}, ${LBROW.y})`);
      rBrowEl?.setAttribute('transform', `rotate(${finalBR},  ${RBROW.x}, ${RBROW.y})`);

      // ── Mouth ────────────────────────────────────────────────────────────────
      mouthEl?.setAttribute('d', `M 122 ${finalMEY} Q 150 ${finalMCY} 178 ${finalMEY}`);

      // ── Scan line ───────────────────────────────────────────────────────────
      scanY = (scanY + 0.8) % 210;
      scanEl?.setAttribute('y',       String(55 + scanY));
      scanEl?.setAttribute('opacity', String(0.04 + 0.06 * Math.sin(scanY * 0.06)));

      // ── Error bubble ────────────────────────────────────────────────────────
      errBubEl?.setAttribute('opacity', String(errP > 0.5 ? Math.min((errP - 0.5) * 5, 1) : 0));

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMove);
      clearTimeout(blinkTimer.current);
      clearTimeout(exprTimer.current);
    };
  }, []);

  const robotCls = [
    'robot-wrap',
    isShaking ? 'robot-error' : isPoked ? 'robot-poke' : 'robot-float',
  ].join(' ');

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap');

        .ms      { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block;line-height:1;text-transform:none;letter-spacing:normal;white-space:nowrap; }
        .ms-fill { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block;line-height:1;text-transform:none;letter-spacing:normal;white-space:nowrap; }

        @keyframes robot-float {
          0%   { transform: translateY(0)    rotate(0deg); }
          20%  { transform: translateY(-8px) rotate(1.8deg); }
          50%  { transform: translateY(-22px) rotate(0deg); }
          80%  { transform: translateY(-8px) rotate(-1.8deg); }
          100% { transform: translateY(0)    rotate(0deg); }
        }
        /* Error shake: cartoon rotation + translate */
        @keyframes robot-error {
          0%   { transform: rotate(0deg)   translateX(0); }
          10%  { transform: rotate(-9deg)  translateX(-7px); }
          20%  { transform: rotate(9deg)   translateX(7px); }
          30%  { transform: rotate(-7deg)  translateX(-5px); }
          40%  { transform: rotate(7deg)   translateX(5px); }
          55%  { transform: rotate(-4deg)  translateX(-3px); }
          70%  { transform: rotate(4deg)   translateX(3px); }
          85%  { transform: rotate(-2deg)  translateX(-1px); }
          100% { transform: rotate(0deg)   translateX(0); }
        }
        /* Poke bounce: scale + quick tilt */
        @keyframes robot-poke {
          0%   { transform: scale(1)    rotate(0deg); }
          20%  { transform: scale(1.11) rotate(-6deg); }
          40%  { transform: scale(0.93) rotate(6deg); }
          60%  { transform: scale(1.05) rotate(-3deg); }
          80%  { transform: scale(0.97) rotate(2deg); }
          100% { transform: scale(1)    rotate(0deg); }
        }
        @keyframes glow-pulse {
          0%,100% { opacity:.55; } 50% { opacity:1; }
        }
        @keyframes ear-l { 0%,100%{opacity:.3;}  30%{opacity:.9;} }
        @keyframes ear-r { 0%,40%,100%{opacity:.3;} 70%{opacity:.9;} }
        @keyframes nebula-1 {
          0%  {transform:translate(0,0) scale(1);}
          33% {transform:translate(-6%,8%) scale(1.15);}
          66% {transform:translate(5%,-6%) scale(.9);}
          100%{transform:translate(0,0) scale(1);}
        }
        @keyframes nebula-2 { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(8%,6%) scale(1.2);} }
        @keyframes nebula-3 {
          0%  {transform:translate(0,0) scale(1);}
          40% {transform:translate(-5%,-8%) scale(1.1);}
          80% {transform:translate(6%,4%) scale(.95);}
          100%{transform:translate(0,0) scale(1);}
        }
        @keyframes ind-glow {
          0%,100%{box-shadow:0 0 6px 2px rgba(102,221,139,.4);}
          50%{box-shadow:0 0 16px 6px rgba(102,221,139,.65);}
        }
        @keyframes card-in { from{opacity:0;transform:translateY(18px);} to{opacity:1;transform:translateY(0);} }

        .robot-float { animation: robot-float 4.5s ease-in-out infinite; transform-origin: center bottom; }
        .robot-error { animation: robot-error 0.55s cubic-bezier(.36,.07,.19,.97) both; transform-origin: center; }
        .robot-poke  { animation: robot-poke  0.50s cubic-bezier(.36,.07,.19,.97) both; transform-origin: center; }
        .glow-pulse  { animation: glow-pulse 2.5s ease-in-out infinite; }
        .ear-l       { animation: ear-l 3s ease-in-out infinite; }
        .ear-r       { animation: ear-r 3s ease-in-out infinite 1.5s; }
        .nebula-1    { animation: nebula-1 24s ease-in-out infinite; }
        .nebula-2    { animation: nebula-2 30s ease-in-out infinite reverse; }
        .nebula-3    { animation: nebula-3 20s ease-in-out infinite; }
        .ind-glow    { animation: ind-glow 2.5s ease-in-out infinite; }
        .card-in     { animation: card-in .55s cubic-bezier(.22,1,.36,1) both; }

        .robot-wrap  { cursor: pointer; }
        @media (max-width:767px) { .robot-wrap { display:none !important; } }

        .login-input {
          width:100%; background:rgba(15,20,35,.8);
          border:1px solid rgba(185,199,228,.1); border-radius:8px;
          padding:14px 14px 14px 44px; color:#e5e2e1;
          font-family:'Inter',sans-serif; font-size:14px; outline:none;
          transition:border-color .2s,box-shadow .2s;
        }
        .login-input::placeholder { color:#2d3a50; }
        .login-input:focus { border-color:rgba(185,199,228,.35); box-shadow:0 0 0 3px rgba(185,199,228,.07); }
        .login-btn {
          width:100%; background:linear-gradient(135deg,#b9c7e4 0%,#74829d 100%);
          border:none; border-radius:8px; padding:15px; color:#0d1c32;
          font-family:'Manrope',sans-serif; font-weight:700; font-size:14px;
          letter-spacing:.06em; cursor:pointer;
          transition:opacity .15s,transform .1s,box-shadow .2s;
          box-shadow:0 4px 20px rgba(185,199,228,.18);
        }
        .login-btn:hover  { opacity:.85; box-shadow:0 6px 30px rgba(185,199,228,.28); }
        .login-btn:active { transform:scale(.985); }
        .login-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
      `}</style>

      <div style={{ position:'fixed', inset:0, zIndex:9999, background:'#030610', fontFamily:"'Inter',sans-serif", display:'flex', flexDirection:'column', overflow:'hidden' }}>

        <canvas ref={canvasRef} style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}/>

        {/* Nebulas */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:1 }}>
          <div className="nebula-1" style={{ position:'absolute', top:'-25%', left:'-20%', width:'65%', height:'65%', borderRadius:'50%', background:'radial-gradient(circle,rgba(90,50,220,.22) 0%,transparent 70%)', filter:'blur(70px)' }}/>
          <div className="nebula-2" style={{ position:'absolute', bottom:'-25%', right:'-15%', width:'70%', height:'70%', borderRadius:'50%', background:'radial-gradient(circle,rgba(0,150,220,.18) 0%,transparent 70%)', filter:'blur(85px)' }}/>
          <div className="nebula-3" style={{ position:'absolute', top:'25%', left:'25%', width:'55%', height:'55%', borderRadius:'50%', background:'radial-gradient(circle,rgba(170,25,140,.13) 0%,transparent 70%)', filter:'blur(100px)' }}/>
          <div className="nebula-1" style={{ position:'absolute', top:'55%', left:'-8%', width:'42%', height:'42%', borderRadius:'50%', background:'radial-gradient(circle,rgba(20,90,200,.14) 0%,transparent 70%)', filter:'blur(75px)', animationDelay:'6s' }}/>
        </div>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:2, background:'radial-gradient(ellipse at 50% 50%,transparent 15%,rgba(3,6,16,.65) 100%)' }}/>

        {/* Header */}
        <header style={{ position:'relative', zIndex:10, background:'rgba(3,6,16,.85)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(185,199,228,.06)', display:'flex', justifyContent:'center', alignItems:'center', padding:'18px 32px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span className="ms-fill" style={{ color:'#b9c7e4', fontSize:26 }}>shield_with_heart</span>
            <span style={{ fontFamily:'Manrope', fontWeight:800, letterSpacing:'.15em', fontSize:14, color:'#b9c7e4' }}>THE DIGITAL VAULT</span>
          </div>
        </header>

        <main style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 6vw 80px', position:'relative', zIndex:5, gap:'5vw' }}>

          {/* Login card */}
          <div style={{ width:'100%', maxWidth:420, flexShrink:0 }} className="card-in">
            <div style={{ textAlign:'center', marginBottom:36 }}>
              <h1 style={{ fontFamily:'Manrope', fontWeight:800, fontSize:36, letterSpacing:'-.02em', color:'#e5e2e1', margin:'0 0 6px' }}>FINOCA</h1>
              <p style={{ color:'#74829d', fontWeight:600, letterSpacing:'.22em', fontSize:11, textTransform:'uppercase', margin:0 }}>CENTRO FINANCIERO</p>
            </div>

            <div style={{ background:'rgba(8,12,24,.78)', backdropFilter:'blur(28px)', border:'1px solid rgba(185,199,228,.1)', borderRadius:12, padding:32, boxShadow:'0 12px 50px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.04)' }}>
              {errorMsg && (
                <div style={{ background:'rgba(255,50,50,.08)', border:'1px solid rgba(255,80,80,.25)', borderRadius:8, padding:'10px 14px', marginBottom:20, fontSize:13, color:'#ff8080', textAlign:'center', letterSpacing:'.02em' }}>
                  {errorMsg}
                </div>
              )}
              <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>
                <div>
                  <label style={{ display:'block', marginBottom:8, fontSize:10, fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', color:'#2d3a50' }}>Usuario</label>
                  <div style={{ position:'relative' }}>
                    <span className="ms" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#74829d', fontSize:19, pointerEvents:'none' }}>person</span>
                    <input className="login-input" type="text" placeholder="Ingresa tu usuario" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)}/>
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', marginBottom:8, fontSize:10, fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', color:'#2d3a50' }}>Contraseña</label>
                  <div style={{ position:'relative' }}>
                    <span className="ms" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#74829d', fontSize:19, pointerEvents:'none' }}>lock</span>
                    <input
                      className="login-input"
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      style={{ paddingRight:44 }}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setPwFocused(true)}
                      onBlur={() => setPwFocused(false)}
                    />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#4a5568', cursor:'pointer', padding:0, display:'flex', alignItems:'center', transition:'color .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#b9c7e4')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#4a5568')}
                    >
                      <span className="ms" style={{ fontSize:19 }}>{showPw ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>
                <button className="login-btn" type="submit" disabled={loginState === 'loading'} style={{ marginTop:6 }}>
                  {loginState === 'loading' ? 'VERIFICANDO...' : 'INGRESAR AL DASHBOARD'}
                </button>
              </form>
            </div>

            <div style={{ marginTop:24, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <div className="ind-glow" style={{ width:7, height:7, borderRadius:'50%', background:'#66dd8b' }}/>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.22em', textTransform:'uppercase', color:'#1e2a3a' }}>Sistema Seguro &amp; Encriptado</span>
            </div>
          </div>

          {/* ── Robot head — clickable ── */}
          <div className={robotCls} onClick={handlePoke} style={{ flexShrink:0, filter:'drop-shadow(0 0 40px rgba(102,221,139,.18))' }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VW} ${VH}`}
              width={360}
              height={Math.round(360 * VH / VW)}
              style={{ display:'block', overflow:'visible' }}
            >
              <defs>
                <filter id="gg" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="4" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="hg" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="12"/></filter>
                <filter id="cg" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="1.5" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <clipPath id="lc"><rect x={LE.cx - ESW/2} y={LE.cy - EHH} width={ESW} height={ESH} rx={22}/></clipPath>
                <clipPath id="rc"><rect x={RE.cx - ESW/2} y={RE.cy - EHH} width={ESW} height={ESH} rx={22}/></clipPath>
                <clipPath id="hc"><rect x={28} y={55} width={244} height={210} rx={72}/></clipPath>
                <radialGradient id="hgrad" cx="38%" cy="26%" r="72%">
                  <stop offset="0%"   stopColor="#1e2d46"/>
                  <stop offset="60%"  stopColor="#0e1a2e"/>
                  <stop offset="100%" stopColor="#050c1a"/>
                </radialGradient>
                <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="rgba(200,220,255,0.15)"/>
                  <stop offset="40%"  stopColor="rgba(200,220,255,0.00)"/>
                  <stop offset="100%" stopColor="rgba(10,20,60,0.22)"/>
                </linearGradient>
              </defs>

              <ellipse cx={150} cy={302} rx={90} ry={16} fill="rgba(0,20,80,.28)" filter="url(#hg)"/>
              <rect x={10} y={38} width={280} height={244} rx={90} fill="rgba(80,120,255,.07)" filter="url(#hg)" className="glow-pulse"/>
              <rect x={22} y={50} width={256} height={224} rx={82} fill="none" stroke="rgba(185,199,228,.08)" strokeWidth="1" className="glow-pulse"/>

              {/* Head */}
              <rect x={28} y={55} width={244} height={210} rx={72} fill="url(#hgrad)" stroke="#b9c7e4" strokeWidth="1.4" opacity=".96"/>
              <rect x={28} y={55} width={244} height={210} rx={72} fill="url(#rim)"/>
              <path d="M 78 65 Q 150 50 222 65" fill="none" stroke="rgba(210,225,255,.28)" strokeWidth="3.5" strokeLinecap="round"/>

              {/* Scan line */}
              <g clipPath="url(#hc)">
                <rect id="scan" x={28} y={55} width={244} height={5} fill="rgba(102,221,139,.55)" opacity=".05"/>
              </g>

              {/* Ear vents */}
              {([
                { bx: 12,  lx: 28,  side: -1 as const, c: 'ear-l' },
                { bx: 276, lx: 272, side:  1 as const, c: 'ear-r' },
              ] as const).map(({ bx, lx, side, c }, i) => (
                <g key={i}>
                  <line x1={lx} y1={HCY} x2={bx + side * 14} y2={HCY} stroke="#b9c7e4" strokeWidth="1" opacity=".2"/>
                  <rect x={bx - 9} y={HCY - 12} width={18} height={24} rx={5} fill="url(#hgrad)" stroke="#b9c7e4" strokeWidth=".9"/>
                  <circle cx={bx} cy={HCY} r={5}  fill="none" stroke="#66dd8b" strokeWidth="1.2" filter="url(#gg)" className={c}/>
                  <circle cx={bx} cy={HCY} r={2}  fill="#66dd8b" filter="url(#gg)" className={c}/>
                </g>
              ))}

              {/* Antenna */}
              <line x1={150} y1={55} x2={150} y2={24} stroke="#b9c7e4" strokeWidth="1.8" opacity=".65"/>
              <line x1={141} y1={36} x2={150} y2={24} stroke="#b9c7e4" strokeWidth="1.2" opacity=".3"/>
              <circle cx={150} cy={15} r={12}  fill="none" stroke="#66dd8b" strokeWidth="1.8" filter="url(#gg)" className="glow-pulse"/>
              <circle cx={150} cy={15} r={6.5} fill="#66dd8b" filter="url(#gg)" className="glow-pulse"/>

              {/* Eyebrow plates */}
              <g id="lbrow">
                <rect x={74} y={108} width={70} height={15} rx={7.5} fill="url(#hgrad)" stroke="#b9c7e4" strokeWidth="1.2"/>
                <circle cx={84}  cy={115.5} r={3.5} fill="rgba(185,199,228,.12)" stroke="#b9c7e4" strokeWidth=".6"/>
                <circle cx={134} cy={115.5} r={3.5} fill="rgba(185,199,228,.12)" stroke="#b9c7e4" strokeWidth=".6"/>
                <rect x={90} y={110} width={40} height={4} rx={2} fill="rgba(185,199,228,.08)"/>
              </g>
              <g id="rbrow">
                <rect x={156} y={108} width={70} height={15} rx={7.5} fill="url(#hgrad)" stroke="#b9c7e4" strokeWidth="1.2"/>
                <circle cx={166} cy={115.5} r={3.5} fill="rgba(185,199,228,.12)" stroke="#b9c7e4" strokeWidth=".6"/>
                <circle cx={216} cy={115.5} r={3.5} fill="rgba(185,199,228,.12)" stroke="#b9c7e4" strokeWidth=".6"/>
                <rect x={170} y={110} width={40} height={4} rx={2} fill="rgba(185,199,228,.08)"/>
              </g>

              {/* Eye sockets */}
              <rect x={LE.cx - ESW/2} y={LE.cy - EHH} width={ESW} height={ESH} rx={22} fill="#010408" stroke="rgba(185,199,228,.18)" strokeWidth="1.2"/>
              <rect x={RE.cx - ESW/2} y={RE.cy - EHH} width={ESW} height={ESH} rx={22} fill="#010408" stroke="rgba(185,199,228,.18)" strokeWidth="1.2"/>

              {/* Eye glow rings */}
              <rect id="le-ring" x={LE.cx - ESW/2 + 3} y={LE.cy - EHH + 3} width={ESW - 6} height={ESH - 6} rx={20} fill="none" stroke="#66dd8b" strokeWidth="2" filter="url(#gg)" opacity=".92"/>
              <rect id="re-ring" x={RE.cx - ESW/2 + 3} y={RE.cy - EHH + 3} width={ESW - 6} height={ESH - 6} rx={20} fill="none" stroke="#66dd8b" strokeWidth="2" filter="url(#gg)" opacity=".92"/>

              {/* Iris */}
              <rect id="l-iris" x={LE.cx - ESW/2 + 9} y={LE.cy - EHH + 9} width={ESW - 18} height={ESH - 18} rx={16} fill="rgba(102,221,139,.15)"/>
              <rect id="r-iris" x={RE.cx - ESW/2 + 9} y={RE.cy - EHH + 9} width={ESW - 18} height={ESH - 18} rx={16} fill="rgba(102,221,139,.15)"/>
              <rect x={LE.cx - ESW/2 + 13} y={LE.cy - EHH + 13} width={ESW - 26} height={ESH - 26} rx={12} fill="none" stroke="rgba(102,221,139,.14)" strokeWidth=".8"/>
              <rect x={RE.cx - ESW/2 + 13} y={RE.cy - EHH + 13} width={ESW - 26} height={ESH - 26} rx={12} fill="none" stroke="rgba(102,221,139,.14)" strokeWidth=".8"/>

              {/* Pupils */}
              <circle id="lp" cx={LE.cx} cy={LE.cy} r={PR} fill="#66dd8b" filter="url(#gg)"/>
              <circle id="rp" cx={RE.cx} cy={RE.cy} r={PR} fill="#66dd8b" filter="url(#gg)"/>

              {/* Catchlights */}
              <ellipse id="l-catch" cx={LE.cx + 5} cy={LE.cy - 5} rx={5} ry={4} fill="rgba(255,255,255,.90)" filter="url(#cg)"/>
              <ellipse id="r-catch" cx={RE.cx + 5} cy={RE.cy - 5} rx={5} ry={4} fill="rgba(255,255,255,.90)" filter="url(#cg)"/>

              {/* Eyelids */}
              <g clipPath="url(#lc)">
                <rect id="lt" x={LE.cx - ESW/2} y={96}  width={ESW} height={EHH} fill="#010408"/>
                <rect id="lb" x={LE.cx - ESW/2} y={177} width={ESW} height={EHH} fill="#010408"/>
              </g>
              <g clipPath="url(#rc)">
                <rect id="rt" x={RE.cx - ESW/2} y={96}  width={ESW} height={EHH} fill="#010408"/>
                <rect id="rb" x={RE.cx - ESW/2} y={177} width={ESW} height={EHH} fill="#010408"/>
              </g>

              {/* Cheek blush */}
              <ellipse cx={58}  cy={188} rx={22} ry={13} fill="rgba(200,110,160,.07)"/>
              <ellipse cx={242} cy={188} rx={22} ry={13} fill="rgba(200,110,160,.07)"/>

              {/* Nose */}
              <circle cx={150} cy={197} r={3.5} fill="rgba(185,199,228,.12)"/>
              <circle cx={150} cy={197} r={1.5} fill="rgba(185,199,228,.22)"/>

              {/* Mouth */}
              <path id="mouth" d="M 122 214 Q 150 230 178 214"
                fill="none" stroke="#b9c7e4" strokeWidth="2.2" strokeLinecap="round" opacity=".42"/>

              {/* Circuit traces */}
              {([-1, 1] as const).map(s => (
                <g key={s} opacity=".16">
                  <line x1={HCX + s * 38} y1={HCY + 32} x2={HCX + s * 56} y2={HCY + 32} stroke="#b9c7e4" strokeWidth=".6"/>
                  <circle cx={HCX + s * 56} cy={HCY + 32} r={2}   fill="none" stroke="#b9c7e4" strokeWidth=".6"/>
                  <line x1={HCX + s * 56} y1={HCY + 32} x2={HCX + s * 56} y2={HCY + 46} stroke="#b9c7e4" strokeWidth=".6"/>
                  <circle cx={HCX + s * 56} cy={HCY + 46} r={1.4} fill="#66dd8b" opacity=".5"/>
                </g>
              ))}

              {/* Corner bolts */}
              {([[60, 80], [240, 80], [58, 240], [242, 240]] as const).map(([cx, cy], i) => (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={5.5} fill="url(#hgrad)" stroke="#b9c7e4" strokeWidth=".7"/>
                  <circle cx={cx} cy={cy} r={2}   fill="rgba(185,199,228,.2)"/>
                </g>
              ))}

              {/* Error bubble */}
              <g id="err-bub" opacity="0">
                <circle cx={254} cy={58} r={24} fill="rgba(255,55,55,.14)" stroke="rgba(255,90,90,.5)" strokeWidth="1.5"/>
                <circle cx={254} cy={58} r={19} fill="none" stroke="rgba(255,90,90,.18)" strokeWidth=".8"/>
                <text x={254} y={66} textAnchor="middle" fill="#ff7070"
                  fontSize="24" fontFamily="Manrope,sans-serif" fontWeight="800">!</text>
              </g>

            </svg>
          </div>

        </main>

        {/* Footer */}
        <footer style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:10, background:'rgba(3,6,16,.82)', backdropFilter:'blur(12px)', borderTop:'1px solid rgba(185,199,228,.05)', display:'flex', justifyContent:'space-around', alignItems:'center', padding:'10px 24px 20px' }}>
          {([
            { icon: 'lock',            label: 'Seguridad', active: true  },
            { icon: 'contact_support', label: 'Soporte',   active: false },
            { icon: 'gavel',           label: 'Legal',     active: false },
          ] as const).map(item => (
            <a key={item.label} href="#" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'8px 14px', borderRadius:8, textDecoration:'none', color:item.active?'#66dd8b':'#1e2a3a', background:item.active?'rgba(102,221,139,.05)':'transparent' }}>
              <span className="ms" style={{ fontSize:20 }}>{item.icon}</span>
              <span style={{ fontFamily:'Inter', fontSize:9, fontWeight:600, letterSpacing:'.15em', textTransform:'uppercase' }}>{item.label}</span>
            </a>
          ))}
        </footer>

      </div>
    </>
  );
}
