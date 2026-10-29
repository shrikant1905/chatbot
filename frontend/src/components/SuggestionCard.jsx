import React from 'react';
import { FiEdit3, FiCpu, FiCode, FiStar, FiArrowRight } from 'react-icons/fi';

const ICON_MAP = {
  Feather: FiEdit3,
  Atom: FiCpu,
  Code: FiCode,
  Sparkles: FiStar
};

export function SuggestionCard({ card, onSelect }) {
  const IconComponent = ICON_MAP[card.icon] || FiStar;

  return (
    <div
      className="suggestion-card"
      onClick={() => onSelect(card.prompt)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(card.prompt);
        }
      }}
      aria-label={`${card.title}: ${card.description}`}
    >
      <div className="suggestion-icon-wrapper">
        <IconComponent />
      </div>
      <div className="suggestion-content">
        <div className="suggestion-title">{card.title}</div>
        <div className="suggestion-desc">{card.description}</div>
      </div>
    </div>
  );
}
