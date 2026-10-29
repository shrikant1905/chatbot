import React from 'react';
import { SUGGESTIONS } from '../utils/sampleData';
import { SuggestionCard } from './SuggestionCard';
import { FiZap } from 'react-icons/fi';

export function WelcomeScreen({ onSelectPrompt }) {
  return (
    <div className="welcome-screen-wrapper">
      <div className="welcome-brand-symbol">
        <FiZap />
      </div>

      <h1 className="welcome-heading">
        Hello, I'm <span className="welcome-gradient-text">Kiaan AI</span>.
      </h1>

      <p className="welcome-subheading">
        Your intelligent space for ideas, answers, creativity, and productivity.
      </p>

      <div className="suggestions-grid">
        {SUGGESTIONS.map((card) => (
          <SuggestionCard
            key={card.id}
            card={card}
            onSelect={onSelectPrompt}
          />
        ))}
      </div>
    </div>
  );
}
