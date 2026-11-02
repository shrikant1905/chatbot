import React from 'react';

/**
 * Background3D:
 * Provides an animated 3D perspective background with dynamic ambient light orbs,
 * cybernetic depth grid, and floating particles for a sci-fi glassmorphic chat experience.
 */
export function Background3D({ activeTheme = 'dark' }) {
  return (
    <div className="bg-3d-scene" aria-hidden="true">
      {/* Dynamic 3D Wallpaper Image Layer */}
      <div className="bg-3d-wallpaper" />

      {/* 3D Depth Lighting Orbs */}
      <div className="bg-3d-orb orb-primary" />
      <div className="bg-3d-orb orb-cyan" />
      <div className="bg-3d-orb orb-violet" />
      <div className="bg-3d-orb orb-amber" />

      {/* 3D Perspective Cybernetic Grid Plane */}
      <div className="bg-3d-grid-plane">
        <div className="bg-3d-grid-lines" />
      </div>

      {/* Floating 3D Cosmic Dust / Light Particles */}
      <div className="bg-3d-particles">
        <span className="p-dot dot-1" />
        <span className="p-dot dot-2" />
        <span className="p-dot dot-3" />
        <span className="p-dot dot-4" />
        <span className="p-dot dot-5" />
        <span className="p-dot dot-6" />
        <span className="p-dot dot-7" />
        <span className="p-dot dot-8" />
        <span className="p-dot dot-9" />
        <span className="p-dot dot-10" />
      </div>

      {/* Radial Vignette & Glass Contrast Shield */}
      <div className="bg-3d-vignette" />
    </div>
  );
}

