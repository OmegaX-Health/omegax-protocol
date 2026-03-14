// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { InertiaPlugin } from "gsap/InertiaPlugin";

import styles from "./dot-grid.module.css";

gsap.registerPlugin(InertiaPlugin);

type MouseEventHandler = (event: MouseEvent) => void;

const throttle = (func: MouseEventHandler, limit: number): MouseEventHandler => {
  let lastCall = 0;

  return (event: MouseEvent) => {
    const now = performance.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      return func(event);
    }
    return undefined;
  };
};

type Rgb = {
  r: number;
  g: number;
  b: number;
};

function hexToRgb(color: string): Rgb | null {
  const trimmed = color.trim();

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const nums = rgbMatch[1].split(",").map((value) => Number.parseFloat(value.trim()));
    if (nums.length >= 3 && nums.every((value) => Number.isFinite(value))) {
      return {
        r: Math.max(0, Math.min(255, Math.round(nums[0]))),
        g: Math.max(0, Math.min(255, Math.round(nums[1]))),
        b: Math.max(0, Math.min(255, Math.round(nums[2]))),
      };
    }
    return null;
  }

  const long = trimmed.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (long) {
    return {
      r: parseInt(long[1], 16),
      g: parseInt(long[2], 16),
      b: parseInt(long[3], 16),
    };
  }

  const short = trimmed.match(/^#([a-f\d])([a-f\d])([a-f\d])$/i);
  if (!short) return null;

  return {
    r: Number.parseInt(short[1] + short[1], 16),
    g: Number.parseInt(short[2] + short[2], 16),
    b: Number.parseInt(short[3] + short[3], 16),
  };
}

function resolveThemeColor(input: string | undefined, fallback: string): string {
  if (!input) return fallback;

  const varMatch = input.match(/^var\((--[^)]+)\)$/);
  if (!varMatch) return input;

  if (typeof document === "undefined") return fallback;

  const value = getComputedStyle(document.documentElement).getPropertyValue(varMatch[1]).trim();
  return value || fallback;
}

function parseColorWithFallback(input: string | undefined, fallback: string): { value: string; rgb: Rgb } {
  const value = resolveThemeColor(input, fallback);
  const rgb = hexToRgb(value);
  if (rgb) return { value, rgb };

  const fallbackRgb = hexToRgb(fallback);
  return { value: fallback, rgb: fallbackRgb ?? { r: 0, g: 0, b: 0 } };
}

interface DotGridProps {
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  activeColor?: string;
  proximity?: number;
  speedTrigger?: number;
  shockRadius?: number;
  shockStrength?: number;
  maxSpeed?: number;
  resistance?: number;
  returnDuration?: number;
  className?: string;
  style?: CSSProperties;
}

interface Dot {
  cx: number;
  cy: number;
  xOffset: number;
  yOffset: number;
  _inertiaApplied: boolean;
}

interface PointerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  lastTime: number;
  lastX: number;
  lastY: number;
}

const FALLBACK_BASE_COLOR = "#1a6bff";
const FALLBACK_ACTIVE_COLOR = "#4f8dff";

const DotGrid = ({
  dotSize = 5,
  gap = 15,
  baseColor = "var(--accent)",
  activeColor = "var(--accent-strong)",
  proximity = 120,
  speedTrigger = 100,
  shockRadius = 250,
  shockStrength = 5,
  maxSpeed = 5000,
  resistance = 750,
  returnDuration = 1.5,
  className = "",
  style,
}: DotGridProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dotsRef = useRef<Dot[]>([]);
  const pointerRef = useRef<PointerState>({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    lastTime: 0,
    lastX: 0,
    lastY: 0,
  });

  const { value: resolvedBaseColor, rgb: baseRgb } = parseColorWithFallback(baseColor, FALLBACK_BASE_COLOR);
  const { rgb: activeRgb } = parseColorWithFallback(activeColor, FALLBACK_ACTIVE_COLOR);

  const circlePath = useMemo(() => {
    if (typeof window === "undefined" || !window.Path2D) return null;
    const path = new window.Path2D();
    path.arc(0, 0, dotSize / 2, 0, Math.PI * 2);
    return path;
  }, [dotSize]);

  const buildGrid = useCallback(() => {
    const wrap = wrapperRef.current;
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !section || !canvas) return;

    const parentRects = [
      section.parentElement?.getBoundingClientRect(),
      section.parentElement?.parentElement?.getBoundingClientRect(),
      section.getBoundingClientRect(),
      wrap.getBoundingClientRect(),
    ].filter(Boolean) as DOMRect[];
    const validRects = parentRects.filter((rect) => rect.width > 0 && rect.height > 0);
    if (!validRects.length) return;

    const hostRect = validRects.reduce((maxRect, currentRect) => {
      const maxArea = maxRect.width * maxRect.height;
      const currentArea = currentRect.width * currentRect.height;
      return currentArea > maxArea ? currentRect : maxRect;
    }, validRects[0]);
    if (!hostRect) return;

    const width = Math.ceil(hostRect.width);
    const height = Math.ceil(hostRect.height);
    if (!width || !height) return;

    section.style.width = `${width}px`;
    section.style.height = `${height}px`;
    wrap.style.width = `${width}px`;
    wrap.style.height = `${height}px`;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const cols = Math.floor((width + gap) / (dotSize + gap));
    const rows = Math.floor((height + gap) / (dotSize + gap));
    const cell = dotSize + gap;
    const gridW = cell * cols - gap;
    const gridH = cell * rows - gap;
    const extraX = width - gridW;
    const extraY = height - gridH;
    const startX = extraX / 2 + dotSize / 2;
    const startY = extraY / 2 + dotSize / 2;

    const dots: Dot[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cx = startX + x * cell;
        const cy = startY + y * cell;
        dots.push({ cx, cy, xOffset: 0, yOffset: 0, _inertiaApplied: false });
      }
    }
    dotsRef.current = dots;
  }, [dotSize, gap]);

  useEffect(() => {
    if (!circlePath) return;

    let rafId = 0;
    const proxSq = proximity * proximity;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { x: px, y: py } = pointerRef.current;

      for (const dot of dotsRef.current) {
        const ox = dot.cx + dot.xOffset;
        const oy = dot.cy + dot.yOffset;
        const dx = dot.cx - px;
        const dy = dot.cy - py;
        const dsq = dx * dx + dy * dy;

        let color = resolvedBaseColor;
        if (dsq <= proxSq) {
          const dist = Math.sqrt(dsq);
          const mix = 1 - dist / proximity;
          const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * mix);
          const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * mix);
          const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * mix);
          color = `rgb(${r},${g},${b})`;
        }

        ctx.save();
        ctx.translate(ox, oy);
        ctx.fillStyle = color;
        ctx.fill(circlePath);
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [baseRgb, activeRgb, circlePath, proximity, resolvedBaseColor]);

  useEffect(() => {
    buildGrid();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(buildGrid);
      wrapperRef.current && ro.observe(wrapperRef.current);
    } else {
      window.addEventListener("resize", buildGrid);
    }

    return () => {
      if (ro) {
        ro.disconnect();
      } else {
        window.removeEventListener("resize", buildGrid);
      }
    };
  }, [buildGrid]);

  const onMove = useCallback(
    (event: MouseEvent) => {
      if (!canvasRef.current) return;

      const now = performance.now();
      const pr = pointerRef.current;
      const dt = pr.lastTime ? now - pr.lastTime : 16;
      const dx = event.clientX - pr.lastX;
      const dy = event.clientY - pr.lastY;
      let vx = (dx / dt) * 1000;
      let vy = (dy / dt) * 1000;
      let speed = Math.hypot(vx, vy);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        vx *= scale;
        vy *= scale;
        speed = maxSpeed;
      }

      pr.lastTime = now;
      pr.lastX = event.clientX;
      pr.lastY = event.clientY;
      pr.vx = vx;
      pr.vy = vy;
      pr.speed = speed;

      const rect = canvasRef.current.getBoundingClientRect();
      pr.x = event.clientX - rect.left;
      pr.y = event.clientY - rect.top;

      for (const dot of dotsRef.current) {
        const dist = Math.hypot(dot.cx - pr.x, dot.cy - pr.y);
        if (speed > speedTrigger && dist < proximity && !dot._inertiaApplied) {
          dot._inertiaApplied = true;
          gsap.killTweensOf(dot);
          const pushX = dot.cx - pr.x + vx * 0.005;
          const pushY = dot.cy - pr.y + vy * 0.005;
          gsap.to(dot, {
            inertia: { xOffset: pushX, yOffset: pushY, resistance },
            onComplete: () => {
              gsap.to(dot, {
                xOffset: 0,
                yOffset: 0,
                duration: returnDuration,
                ease: "elastic.out(1,0.75)",
              });
              dot._inertiaApplied = false;
            },
          });
        }
      }
    },
    [maxSpeed, speedTrigger, proximity, returnDuration, resistance]
  );

  const onClick = useCallback(
    (event: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;

      for (const dot of dotsRef.current) {
        const dist = Math.hypot(dot.cx - cx, dot.cy - cy);
        if (dist < shockRadius && !dot._inertiaApplied) {
          dot._inertiaApplied = true;
          gsap.killTweensOf(dot);
          const falloff = Math.max(0, 1 - dist / shockRadius);
          const pushX = (dot.cx - cx) * shockStrength * falloff;
          const pushY = (dot.cy - cy) * shockStrength * falloff;

          gsap.to(dot, {
            inertia: { xOffset: pushX, yOffset: pushY, resistance },
            onComplete: () => {
              gsap.to(dot, {
                xOffset: 0,
                yOffset: 0,
                duration: returnDuration,
                ease: "elastic.out(1,0.75)",
              });
              dot._inertiaApplied = false;
            },
          });
        }
      }
    },
    [shockRadius, shockStrength, returnDuration, resistance]
  );

  useEffect(() => {
    const throttledMove = throttle(onMove, 50);
    window.addEventListener("mousemove", throttledMove, { passive: true });
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("mousemove", throttledMove);
      window.removeEventListener("click", onClick);
    };
  }, [onMove, onClick]);

  return (
    <section ref={sectionRef} className={`${styles.dotGrid} ${className}`} style={style}>
      <div ref={wrapperRef} className={styles.dotGridWrap}>
        <canvas ref={canvasRef} className={styles.dotGridCanvas} />
      </div>
    </section>
  );
};

export default DotGrid;
