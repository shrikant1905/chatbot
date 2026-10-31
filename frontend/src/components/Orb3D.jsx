import React, { useState, useRef, useEffect } from 'react';

/**
 * Interactive 3D Holographic Orb Component
 * Features dynamic cursor-following 3D perspective tilt,
 * levitating float physics, and pulsating chromatic back-glow.
 */
export function Orb3D({ size = 180, interactive = true, className = '' }) {
  const containerRef = useRef(null);
  const [transformStyle, setTransformStyle] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!interactive) return;

    const el = containerRef.current;
    if (!el) return;

    const handleMouseMove = (e) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Distance from center (-1 to 1)
      const mouseX = (e.clientX - centerX) / (rect.width * 1.5);
      const mouseY = (e.clientY - centerY) / (rect.height * 1.5);

      const rotateY = Math.max(-25, Math.min(25, mouseX * 28));
      const rotateX = Math.max(-25, Math.min(25, -mouseY * 28));

      setTransformStyle(
        `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.06, 1.06, 1.06)`
      );
    };

    const handleMouseEnter = () => {
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
      setTransformStyle('perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    };

    window.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [interactive]);

  return (
    <div
      ref={containerRef}
      className={`orb-3d-stage ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`
      }}
    >
      {/* Dynamic Multi-Color Chromatic Back-Glow */}
      <div className="orb-back-glow" />

      {/* 3D Levitating & Tilting Sphere Container */}
      <div
        className={`orb-3d-sphere ${isHovered ? 'hovered' : 'floating'}`}
        style={{
          transform: isHovered && transformStyle ? transformStyle : undefined
        }}
      >
        <img
          src="/assets/kiaan-orb-3d.png"
          alt="Kiaan AI 3D Core"
          className="orb-3d-image"
          draggable="false"
        />

        {/* Dynamic Specular Glass Glint */}
        <div className="orb-specular-shimmer" />
      </div>

      {/* Soft Grounding Caustic Shadow */}
      <div className="orb-ground-shadow" />
    </div>
  );
}

