import React, { useState } from 'react';
import { FiDownload, FiMaximize2, FiCopy, FiCheck, FiX, FiImage } from 'react-icons/fi';

export function ImageGenerationCard({ imageUrl, prompt, filename, onShowToast }) {
  const [copied, setCopied] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleCopyPrompt = (e) => {
    e.stopPropagation();
    if (!prompt) return;
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    onShowToast?.('Prompt copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || `kiaanai-art-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      onShowToast?.('Image download started!');
    } catch (err) {
      // Fallback
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <>
      <div className="image-gen-card">
        {/* Loading skeleton placeholder before image load */}
        {!loaded && (
          <div className="image-gen-skeleton">
            <FiImage className="skeleton-icon" />
            <span>Rendering high-resolution art...</span>
          </div>
        )}

        <img
          src={imageUrl}
          alt={prompt || 'Generated art by Stable Diffusion'}
          className={`image-gen-preview ${loaded ? 'visible' : 'hidden'}`}
          onLoad={() => setLoaded(true)}
          onClick={() => setLightboxOpen(true)}
          title="Click to view fullscreen"
        />

        {/* Hover overlay with quick actions */}
        {loaded && (
          <div className="image-gen-actions-overlay">
            <button
              type="button"
              className="image-action-pill"
              onClick={handleDownload}
              title="Download image"
              aria-label="Download image"
            >
              <FiDownload /> Download
            </button>
            <button
              type="button"
              className="image-action-pill"
              onClick={() => setLightboxOpen(true)}
              title="View full size"
              aria-label="View full size"
            >
              <FiMaximize2 /> Zoom
            </button>
            {prompt && (
              <button
                type="button"
                className="image-action-pill"
                onClick={handleCopyPrompt}
                title="Copy prompt"
                aria-label="Copy prompt"
              >
                {copied ? <FiCheck /> : <FiCopy />} Prompt
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox Fullscreen Modal */}
      {lightboxOpen && (
        <div
          className="image-lightbox-backdrop"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="lightbox-close-btn"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close fullscreen"
            >
              <FiX />
            </button>
            <img src={imageUrl} alt={prompt} className="lightbox-img" />
            {prompt && <p className="lightbox-prompt-caption">"{prompt}"</p>}
          </div>
        </div>
      )}
    </>
  );
}

