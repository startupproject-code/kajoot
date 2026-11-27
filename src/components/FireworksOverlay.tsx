import React, { useEffect, useRef, useState } from 'react';
import { FIREWORKS_DURATION_MS } from '../shared/podiumAssets';

interface FireworksOverlayProps {
  burstKey: number;
  durationMs?: number;
}

interface Rocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  color: string;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  size: number;
  color: string;
}

const FIREWORK_COLORS = [
  '#FBBF24', // gold
  '#FDE047', // warm yellow
  '#FB7185', // rose
  '#38BDF8', // sky
  '#A78BFA', // violet
  '#34D399', // emerald
  '#F97316', // amber-orange
];

export const FireworksOverlay: React.FC<FireworksOverlayProps> = ({
  burstKey,
  durationMs = FIREWORKS_DURATION_MS,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (burstKey <= 0) {
      setActive(false);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setActive(false);
      return;
    }

    let rafId = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const rockets: Rocket[] = [];
    const sparks: Spark[] = [];

    const spawnRocket = () => {
      const x = width * (0.15 + Math.random() * 0.7);
      const targetY = height * (0.12 + Math.random() * 0.34);
      const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      rockets.push({
        x,
        y: height * 0.92,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -(5.8 + Math.random() * 2.8),
        targetY,
        color,
      });
    };

    const explode = (x: number, y: number, primaryColor: string) => {
      const secondaryColor =
        FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      const count = 34 + Math.floor(Math.random() * 18);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.18;
        const speed = 1.6 + Math.random() * 3.8;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          decay: 0.015 + Math.random() * 0.016,
          size: 1.8 + Math.random() * 1.8,
          color: i % 3 === 0 ? secondaryColor : primaryColor,
        });
      }
    };

    // Launch initial celebratory volley immediately
    spawnRocket();
    spawnRocket();
    setActive(true);

    const startedAt = performance.now();
    let lastSpawnAt = startedAt;
    let lastFrameAt = startedAt;

    const frame = (now: number) => {
      const elapsed = now - startedAt;
      const dt = Math.min(2.2, (now - lastFrameAt) / 16.67);
      lastFrameAt = now;

      ctx.clearRect(0, 0, width, height);

      if (elapsed < durationMs && now - lastSpawnAt >= 360) {
        lastSpawnAt = now;
        spawnRocket();
        if (Math.random() < 0.45) {
          spawnRocket();
        }
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.vy += 0.06 * dt;

        ctx.save();
        ctx.fillStyle = r.color;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (r.y <= r.targetY || r.vy >= -0.6) {
          explode(r.x, r.y, r.color);
          rockets.splice(i, 1);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.985;
        s.vy = s.vy * 0.985 + 0.055 * dt;
        s.alpha -= s.decay * dt;

        if (s.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, s.alpha);
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (elapsed < durationMs || rockets.length > 0 || sparks.length > 0) {
        rafId = window.requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
        setActive(false);
      }
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro?.disconnect();
      ctx.clearRect(0, 0, width, height);
      setActive(false);
    };
  }, [burstKey, durationMs]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="podium-fireworks-canvas"
      data-active={active ? 'true' : 'false'}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 w-full h-full"
    />
  );
};
