'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import './InfiniteSpiral.css';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const modulo = (value: number, divisor: number): number =>
  ((value % divisor) + divisor) % divisor;

const smoothstep = (min: number, max: number, value: number): number => {
  const x = clamp((value - min) / (max - min || 1), 0, 1);
  return x * x * (3 - 2 * x);
};

export interface SpiralItem {
  id?: string;
  src?: string;
  alt?: string;
  href?: string;
  target?: string;
  label?: string;
  tag?: string;
  title?: string;
  stat?: string;
  description?: string;
  article?: string;
  content?: React.ReactNode;
}

export interface InfiniteSpiralProps {
  items?: (string | SpiralItem)[];
  speed?: number;
  direction?: 'up' | 'down';
  animationMode?: 'auto' | 'drag' | 'scroll' | 'all';
  radius?: number;
  cardWidth?: number;
  cardHeight?: number;
  verticalSpacing?: number;
  perspective?: number;
  cardsPerTurn?: number;
  rotation?: number;
  cardTilt?: number;
  cardRadius?: number;
  centerScale?: number;
  edgeFade?: number;
  edgeBlur?: number;
  pauseOnHover?: boolean;
  imageFit?: 'cover' | 'contain';
  grayscale?: number;
  className?: string;
  style?: React.CSSProperties;
  onItemClick?: (item: SpiralItem, index: number) => void;
}

export const InfiniteSpiral: React.FC<InfiniteSpiralProps> = ({
  items = [],
  speed = 0.55,
  direction = 'up',
  animationMode = 'all',
  radius = 200,
  cardWidth = 240,
  cardHeight = 150,
  verticalSpacing = 72,
  perspective = 1100,
  cardsPerTurn = 7,
  rotation = 0,
  cardTilt = 0,
  cardRadius = 14,
  centerScale = 1.18,
  edgeFade = 0.3,
  edgeBlur = 5,
  pauseOnHover = true,
  imageFit = 'cover',
  grayscale = 0,
  className = '',
  style,
  onItemClick,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const progressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const autoSpeedRef = useRef(0);
  const hoveredRef = useRef(false);
  const visibleRef = useRef(true);
  const draggingRef = useRef(false);
  const lastPointerYRef = useRef(0);
  const dragMovedRef = useRef(false);

  const normalizedItems = useMemo<SpiralItem[]>(
    () =>
      items.map((item, index) =>
        typeof item === 'string'
          ? { src: item, alt: `Spiral card ${index + 1}` }
          : { alt: `Spiral card ${index + 1}`, ...item }
      ),
    [items]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root || normalizedItems.length === 0) return;

    let frameId: number;
    let previousTime = performance.now();
    let bounds = root.getBoundingClientRect();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scrollEnabled = animationMode === 'scroll' || animationMode === 'all';
    const scrollSpeedMultiplier = Math.max(speed, 0) / 0.55;
    let lastScrollY = window.scrollY;

    const resizeObserver = new ResizeObserver(() => {
      bounds = root.getBoundingClientRect();
    });
    resizeObserver.observe(root);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry) visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.02 }
    );
    intersectionObserver.observe(root);

    const handleScroll = () => {
      const nextScrollY = window.scrollY;
      const scrollDelta = nextScrollY - lastScrollY;
      lastScrollY = nextScrollY;
      if (!scrollEnabled || !visibleRef.current || scrollDelta === 0) return;
      targetProgressRef.current += clamp(
        (scrollDelta * scrollSpeedMultiplier) / Math.max(verticalSpacing * 2, 1),
        -1.5,
        1.5
      );
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const render = (time: number) => {
      const delta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;

      const autoEnabled = animationMode === 'auto' || animationMode === 'all';
      const motionPaused = draggingRef.current || (pauseOnHover && hoveredRef.current);
      const directionMultiplier = direction === 'down' ? -1 : 1;
      const desiredAutoSpeed =
        autoEnabled && visibleRef.current && !reducedMotion.matches && !motionPaused
          ? speed * directionMultiplier
          : 0;
      const speedBlend = 1 - Math.exp(-delta * 7);
      autoSpeedRef.current += (desiredAutoSpeed - autoSpeedRef.current) * speedBlend;
      targetProgressRef.current += autoSpeedRef.current * delta;

      const followBlend = 1 - Math.exp(-delta * (draggingRef.current ? 22 : 11));
      progressRef.current += (targetProgressRef.current - progressRef.current) * followBlend;

      const count = normalizedItems.length;
      const half = count / 2;
      const width = Math.max(bounds.width, 1);
      const height = Math.max(bounds.height, 1);
      const fit = Math.min(1, width / (cardWidth * 2.5), height / (cardHeight * 2.2));
      const responsiveRadius = Math.min(radius, Math.max(80, width * 0.38)) * fit;
      const fadeStart = clamp(1 - edgeFade, 0, 0.98);
      const turnSize = Math.max(cardsPerTurn, 1);

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        let offset = index - progressRef.current;
        offset = modulo(offset + half, count) - half;

        const edge = Math.min(Math.abs(offset) / Math.max(half, 1), 1);
        const opacity = 1 - smoothstep(fadeStart, 1, edge);
        const focus = 1 - Math.min(Math.abs(offset) / Math.max(turnSize * 0.65, 1), 1);
        const scale = (1 + (centerScale - 1) * focus) * fit;
        const angle = offset * (360 / turnSize) + rotation;
        const angleRadians = (angle * Math.PI) / 180;
        const x = Math.sin(angleRadians) * responsiveRadius;
        const z = Math.cos(angleRadians) * responsiveRadius;
        const depthScale = clamp(perspective / Math.max(perspective - z, 1), 0.72, 1.45);
        const visualScale = scale * depthScale;
        const depth = (z / Math.max(responsiveRadius, 1) + 1) / 2;
        const blur = edgeBlur * smoothstep(0.35, 1, edge);

        card.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${
          offset * verticalSpacing * fit
        }px, 0) rotateZ(${cardTilt}deg) scale(${visualScale})`;
        card.style.opacity = opacity.toFixed(3);
        card.style.filter = blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : 'none';
        card.style.zIndex = String(Math.round(depth * 100000) + index);
        card.style.pointerEvents = opacity > 0.25 ? 'auto' : 'none';
      });

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [
    normalizedItems,
    speed,
    direction,
    animationMode,
    radius,
    perspective,
    cardWidth,
    cardHeight,
    verticalSpacing,
    cardsPerTurn,
    rotation,
    cardTilt,
    centerScale,
    edgeFade,
    edgeBlur,
    pauseOnHover,
  ]);

  const rootStyle: React.CSSProperties = {
    perspective: `${perspective}px`,
    ['--infinite-spiral-card-width' as string]: `${cardWidth}px`,
    ['--infinite-spiral-card-height' as string]: `${cardHeight}px`,
    ['--infinite-spiral-card-radius' as string]: `${cardRadius}px`,
    cursor: animationMode === 'drag' || animationMode === 'all' ? 'grab' : 'default',
    touchAction: animationMode === 'drag' || animationMode === 'all' ? 'pan-x' : 'auto',
    userSelect: animationMode === 'drag' || animationMode === 'all' ? 'none' : 'auto',
    ...style,
  };

  const dragEnabled = animationMode === 'drag' || animationMode === 'all';

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.currentTarget.style.cursor = dragEnabled ? 'grab' : 'default';
  };

  return (
    <div
      ref={rootRef}
      className={`infinite-spiral ${className}`.trim()}
      style={rootStyle}
      onMouseEnter={() => {
        hoveredRef.current = true;
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
      }}
      onPointerDown={(event) => {
        if (!dragEnabled || event.button !== 0) return;
        draggingRef.current = true;
        dragMovedRef.current = false;
        lastPointerYRef.current = event.clientY;
        targetProgressRef.current = progressRef.current;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.style.cursor = 'grabbing';
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        const pointerDelta = event.clientY - lastPointerYRef.current;
        lastPointerYRef.current = event.clientY;
        if (Math.abs(pointerDelta) > 0.5) dragMovedRef.current = true;
        targetProgressRef.current -= pointerDelta / Math.max(verticalSpacing, 1);
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onClickCapture={(event) => {
        if (!dragMovedRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        dragMovedRef.current = false;
      }}
    >
      <div className="infinite-spiral__stage" role="list" aria-label="Infinite spiral gallery">
        {normalizedItems.map((item, index) => {
          const commonProps = {
            key: item.id ?? `${item.title ?? item.src}-${index}`,
            ref: (node: HTMLAnchorElement | HTMLDivElement | null) => {
              cardRefs.current[index] = node;
            },
            className: "infinite-spiral__item group p-3.5",
            style: { width: cardWidth, height: cardHeight, borderRadius: cardRadius },
            role: "listitem",
            "aria-label": item.label ?? item.title ?? item.alt,
            onClick: () => {
              if (!dragMovedRef.current && onItemClick) {
                onItemClick(item, index);
              }
            },
          };

          const cardInner = (
            <>
              {item.src && (
                <img
                  className="infinite-spiral__image"
                  src={item.src}
                  alt={item.alt}
                  loading={index < 6 ? 'eager' : 'lazy'}
                  draggable={false}
                  style={{
                    width: cardWidth,
                    height: cardHeight,
                    maxWidth: 'none',
                    maxHeight: 'none',
                    objectFit: imageFit,
                    filter: `grayscale(${Math.min(1, Math.max(0, grayscale))})`,
                  }}
                />
              )}

              {item.content ? (
                item.content
              ) : (
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between gap-1.5">
                    {item.tag && (
                      <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.625rem] font-bold tracking-wider uppercase text-primary">
                        {item.tag}
                      </span>
                    )}
                    {item.article && (
                      <span className="font-mono text-[0.625rem] text-primary/70">
                        {item.article}
                      </span>
                    )}
                  </div>

                  <div className="my-auto py-1">
                    {item.stat && (
                      <p className="font-display text-lg sm:text-xl font-black text-rose-500 tracking-tight">
                        {item.stat}
                      </p>
                    )}
                    {item.title && (
                      <p className="font-display text-xs sm:text-sm font-bold text-foreground line-clamp-1 mt-0.5">
                        {item.title}
                      </p>
                    )}
                    {item.description && (
                      <p className="text-[0.6875rem] leading-snug text-muted-foreground line-clamp-2 mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[0.6rem] text-muted-foreground/80 border-t border-border/40 pt-1">
                    <span>Historic Record</span>
                    <span className="text-primary font-medium group-hover:underline">Inspect file →</span>
                  </div>
                </div>
              )}
            </>
          );

          return item.href ? (
            <a
              {...commonProps}
              href={item.href}
              target={item.target}
              rel={item.target === '_blank' ? 'noreferrer' : undefined}
            >
              {cardInner}
            </a>
          ) : (
            <div {...commonProps}>{cardInner}</div>
          );
        })}
      </div>
    </div>
  );
};

export default InfiniteSpiral;
