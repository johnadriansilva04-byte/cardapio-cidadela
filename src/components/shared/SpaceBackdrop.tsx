import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Star {
  x: number;
  y: number;
  r: number;
  base: number;
  tw: number;
  phase: number;
  depth: number;
}

interface Streak {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
  max: number;
  width: number;
  hue: number;
  warm: boolean;
}

interface Drifter {
  kind: "planet" | "ship";
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

const MAX_STARS = 260;

/**
 * Fundo espacial vivo: estrelas que brilham e reagem ao ponteiro (paralaxe
 * + repulsão suave), cometas e meteoros cruzando de vez em quando e, raro,
 * um planeta ou uma nave passando devagar. Um toque solta faíscas.
 *
 * Tudo em <canvas>, sem imagem nem rede. Desliga sozinho com
 * `prefers-reduced-motion` (pinta um quadro estático) e pausa quando a aba
 * não está visível, então não consome bateria parado.
 */
export function SpaceBackdrop({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const canvas = el as HTMLCanvasElement;
    const maybe = canvas.getContext("2d");
    if (!maybe) return;
    // Alias não-nulo: os closures internos perdem o narrowing do guard.
    const g = maybe;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let stars: Star[] = [];
    let streaks: Streak[] = [];
    let drifters: Drifter[] = [];
    let sparks: Spark[] = [];

    // Ponteiro suavizado: o alvo vem do evento, o valor persegue com lerp.
    const pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4 };

    let nextStreak = 900;
    let nextDrifter = 12_000;

    function buildStars() {
      const count = Math.min(MAX_STARS, Math.round((w * h) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() < 0.86 ? Math.random() * 0.9 + 0.3 : Math.random() * 1.3 + 1,
        base: 0.25 + Math.random() * 0.55,
        tw: 0.6 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        depth: 0.35 + Math.random() * 0.65,
      }));
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
    }

    function spawnStreak(now: number) {
      // Cometa é lento e longo; meteoro é rápido e curto. Ambos caem na
      // diagonal, como quem risca o céu.
      const meteor = Math.random() < 0.62;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const angle = (Math.random() * 12 + 16) * (Math.PI / 180);
      const speed = meteor ? 780 + Math.random() * 460 : 230 + Math.random() * 180;
      const startY = -20 - Math.random() * h * 0.35;
      const startX =
        Math.random() < 0.5 ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5;
      streaks.push({
        x: startX,
        y: startY,
        vx: Math.sin(angle) * speed * dir,
        vy: Math.cos(angle) * speed,
        len: meteor ? 90 + Math.random() * 90 : 190 + Math.random() * 200,
        life: 0,
        max: (h + 260) / (Math.cos(angle) * speed),
        width: meteor ? 1.6 : 1.1,
        hue: meteor ? 28 + Math.random() * 24 : 186 + Math.random() * 28,
        warm: meteor,
      });
      nextStreak = now + (meteor ? 2600 : 5200) + Math.random() * 5200;
    }

    function spawnDrifter(now: number) {
      const ship = Math.random() < 0.55;
      const dir = Math.random() < 0.5 ? 1 : -1;
      if (ship) {
        const y = h * (0.14 + Math.random() * 0.5);
        drifters.push({
          kind: "ship",
          x: dir > 0 ? -70 : w + 70,
          y,
          vx: dir * (34 + Math.random() * 30),
          vy: 0,
          life: 0,
          max: 16,
          size: 7 + Math.random() * 4,
          hue: 186 + Math.random() * 40,
        });
      } else {
        const size = 34 + Math.random() * 40;
        drifters.push({
          kind: "planet",
          x: dir > 0 ? -size * 3 : w + size * 3,
          y: h * (0.16 + Math.random() * 0.42),
          vx: dir * (9 + Math.random() * 9),
          vy: (Math.random() - 0.5) * 4,
          life: 0,
          max: 34,
          size,
          hue: Math.random() < 0.5 ? 262 + Math.random() * 40 : 188 + Math.random() * 30,
        });
      }
      nextDrifter = now + 24_000 + Math.random() * 34_000;
    }

    function drawStar(s: Star, t: number, px: number, py: number) {
      const tw = Math.sin(t * s.tw + s.phase) * 0.35;
      let alpha = Math.max(0.06, Math.min(1, s.base + tw));
      const ox = px * s.depth * 16;
      const oy = py * s.depth * 16;
      let x = s.x + ox;
      let y = s.y + oy;

      // Interação: perto do ponteiro a estrela acende e é empurrada de leve.
      if (px !== 0 || py !== 0) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const d2 = dx * dx + dy * dy;
        const R = 130;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / R) ** 2;
          alpha = Math.min(1, alpha + f * 0.85);
          x += (dx / d) * f * 16;
          y += (dy / d) * f * 16;
        }
      }

      g.beginPath();
      g.arc(x, y, s.r * (1 + alpha * 0.25), 0, Math.PI * 2);
      g.fillStyle = `rgba(226,240,255,${alpha.toFixed(3)})`;
      g.fill();
    }

    function drawStreak(s: Streak) {
      const d = Math.hypot(s.vx, s.vy) || 1;
      const tx = s.x - (s.vx / d) * s.len;
      const ty = s.y - (s.vy / d) * s.len;
      const fade = Math.sin((s.life / s.max) * Math.PI); // entra e sai
      const grad = g.createLinearGradient(s.x, s.y, tx, ty);
      const head = s.warm ? `rgba(255,214,170,${0.9 * fade})` : `rgba(214,244,255,${0.9 * fade})`;
      grad.addColorStop(0, head);
      grad.addColorStop(
        0.35,
        s.warm ? `rgba(255,170,90,${0.35 * fade})` : `rgba(150,220,255,${0.35 * fade})`,
      );
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.strokeStyle = grad;
      g.lineWidth = s.width;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(tx, ty);
      g.stroke();

      const glow = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, 9);
      glow.addColorStop(0, `hsla(${s.hue},100%,88%,${0.95 * fade})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow;
      g.beginPath();
      g.arc(s.x, s.y, 9, 0, Math.PI * 2);
      g.fill();
    }

    function drawDrifter(d: Drifter, t: number) {
      const fade = Math.sin((d.life / d.max) * Math.PI);
      if (fade <= 0) return;

      if (d.kind === "planet") {
        const y = d.y + Math.sin(t * 0.4) * 3;
        const pg = g.createRadialGradient(
          d.x - d.size * 0.35,
          y - d.size * 0.35,
          d.size * 0.1,
          d.x,
          y,
          d.size,
        );
        pg.addColorStop(0, `hsla(${d.hue},70%,72%,${0.5 * fade})`);
        pg.addColorStop(0.6, `hsla(${d.hue},60%,40%,${0.3 * fade})`);
        pg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = pg;
        g.beginPath();
        g.arc(d.x, y, d.size, 0, Math.PI * 2);
        g.fill();

        // Anel: elipse fina atravessando o planeta.
        g.save();
        g.translate(d.x, y);
        g.rotate(-0.5);
        g.strokeStyle = `hsla(${d.hue + 20},80%,80%,${0.32 * fade})`;
        g.lineWidth = 1.4;
        g.beginPath();
        g.ellipse(0, 0, d.size * 1.6, d.size * 0.42, 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      } else {
        const y = d.y + Math.sin(t * 2.2) * 2.4;
        const dir = Math.sign(d.vx) || 1;
        g.save();
        g.translate(d.x, y);
        if (dir < 0) g.scale(-1, 1);
        // corpo
        g.fillStyle = `rgba(226,240,255,${0.85 * fade})`;
        g.beginPath();
        g.moveTo(d.size, 0);
        g.lineTo(-d.size * 0.7, -d.size * 0.5);
        g.lineTo(-d.size * 0.35, 0);
        g.lineTo(-d.size * 0.7, d.size * 0.5);
        g.closePath();
        g.fill();
        // motor
        const eg = g.createRadialGradient(-d.size * 0.8, 0, 0, -d.size * 0.8, 0, d.size * 2);
        eg.addColorStop(0, `hsla(${d.hue},100%,75%,${0.9 * fade})`);
        eg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = eg;
        g.beginPath();
        g.arc(-d.size * 0.8, 0, d.size * 2, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }

    let raf = 0;
    let last = 0;
    let running = true;

    function frame(now: number) {
      if (!running) return;
      const t = now / 1000;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;

      // Persegue o ponteiro devagar — paralaxe macia, sem solavanco.
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      const px = pointer.x < -1e3 ? 0 : (pointer.x / w - 0.5) * 2;
      const py = pointer.y < -1e3 ? 0 : (pointer.y / h - 0.5) * 2;

      g.clearRect(0, 0, w, h);

      for (const s of stars) drawStar(s, t, px, py);

      if (now > nextStreak) spawnStreak(now);
      for (const s of streaks) {
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        drawStreak(s);
      }
      streaks = streaks.filter((s) => s.life < s.max && s.y < h + 120);

      if (now > nextDrifter) spawnDrifter(now);
      for (const d of drifters) {
        d.life += dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        drawDrifter(d, t);
      }
      drifters = drifters.filter(
        (d) => d.life < d.max && d.x > -d.size * 4 && d.x < w + d.size * 4,
      );

      for (const sp of sparks) {
        sp.life += dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += 26 * dt;
        const f = 1 - sp.life / sp.max;
        g.fillStyle = `rgba(190,235,255,${Math.max(0, f).toFixed(3)})`;
        g.beginPath();
        g.arc(sp.x, sp.y, 1.4 * f + 0.4, 0, Math.PI * 2);
        g.fill();
      }
      sparks = sparks.filter((sp) => sp.life < sp.max);

      raf = requestAnimationFrame(frame);
    }

    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = e.clientX - rect.left;
      pointer.ty = e.clientY - rect.top;
    }

    function onDown(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 130;
        sparks.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0,
          max: 0.5 + Math.random() * 0.5,
        });
      }
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    }

    // ResizeObserver não existe em todo ambiente (jsdom, navegador antigo):
    // cai para o evento `resize` da janela.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas);
    else window.addEventListener("resize", resize);
    resize();

    if (reduce) {
      // Um quadro só: céu parado, sem animação.
      for (const s of stars) drawStar(s, 0, 0, 0);
      return () => {
        if (ro) ro.disconnect();
        else window.removeEventListener("resize", resize);
      };
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-0 h-full w-full", className)}
    />
  );
}
