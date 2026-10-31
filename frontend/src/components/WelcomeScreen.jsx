import React from 'react';
import { SUGGESTIONS } from '../utils/sampleData';
import { SuggestionCard } from './SuggestionCard';
import { Orb3D } from './Orb3D';

export function WelcomeScreen({ onSelectPrompt }) {
  return (
    <div className="welcome-screen-wrapper">
      <div className="welcome-hero-stage">
        <Orb3D size={150} />
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
