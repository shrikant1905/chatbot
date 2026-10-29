# Kiaan AI — Premium Chatbot Frontend UI

A production-quality, visually stunning AI chatbot frontend built with **React**, **Vite**, modern **CSS variables**, and **React Icons**.

---

## ⚡ Tech Stack

- **Framework**: React 18
- **Bundler & Tooling**: Vite 6
- **Language**: JavaScript (ESM + JSX)
- **Styling**: Pure CSS3 with semantic CSS custom properties (Variables), responsive layout, smooth transitions, and dark/light design tokens
- **Icons**: `react-icons` (Feather Icons)
- **Dependencies**: Minimal, zero bloated frameworks, no Tailwind, no TypeScript

---

## 🎨 Design Vision & Brand Identity

- **Brand**: **Kiaan AI**
- **Monogram**: Distinctive faceted geometric monogram with glowing blue-violet gradients (`#6366f1` / `#8b5cf6` / `#4f46e5`)
- **Themes**:
  - **Dark Mode**: Deep obsidian and charcoal surfaces (`#090a10`, `#141724`), subtle borders, glowing ambient aura, high legibility.
  - **Light Mode**: Pristine crisp off-white (`#f8fafc`, `#ffffff`), dark slate typography (`#0f172a`), balanced shadows.
  - **System Theme**: Automatically tracks operating system preferences (`prefers-color-scheme`).

---

## 🚀 Key UI Features

### 1. Left Navigation Sidebar
- **Brand Header**: Kiaan AI logo monogram, brand title, and "PRO" badge.
- **New Chat**: Primary gradient button with `⌘K` / `Ctrl+K` keyboard shortcut.
- **Real-time Search**: Search conversations with live filtering and clear button.
- **Categorized History**: Time-grouped sections (`Today`, `Yesterday`, `Previous 7 Days`).
- **Interactive Management**: Inline renaming and deletion with accessible confirmation modal.
- **Collapsible Layout**: Desktop sidebar can collapse to icon-only mode; on mobile screens (≤768px), it transitions into a smooth slide-in drawer with backdrop overlay.
- **User Profile**: Profile avatar and membership status at bottom.

### 2. Main Conversation Workspace
- **Header**: Responsive hamburger button, current conversation title, AI model selector dropdown (`Kiaan Ultra 4.5`, `Kiaan Pro 3.5`, `Kiaan Code Alpha`), quick theme toggle, and options dropdown menu.
- **Max Reading Width**: Centered 840px reading container ensuring readability.
- **Rich Message Experience**:
  - Headings (`h1`, `h2`, `h3`)
  - Bold, italics, blockquotes
  - Unordered and ordered lists
  - Inline code formatting
  - Syntax-styled code blocks with language header and 1-click **Copy Code** button with checkmark feedback
  - Responsive markdown tables with striped borders and horizontal scroll wrappers
  - Action toolbars: Copy message, Edit/Retry prompt in composer, and UI Regenerate action

### 3. Bottom Message Composer
- **Auto-expanding Multiline Textarea**: Expands naturally up to 200px max height.
- **Keyboard Navigation**: `Enter` to send, `Shift + Enter` for new lines.
- **Smart Submit State**: Send button is disabled on empty input and active when text is present.
- **Visual Placeholders**: Attachment icon, Voice input icon, and Web search toggle with informative UI toasts.
- **Floating Dock**: Gradient backdrop ensures composer never obscures messages.

### 4. Premium Welcome Screen
- Shown on empty / newly initiated conversations.
- Hero brand symbol with ambient pulsing glow.
- Heading: *"Hello, I'm Kiaan AI."*
- Subheading: *"Your intelligent space for ideas, answers, creativity, and productivity."*
- 4 interactive suggestion cards that populate the composer upon click.

### 5. Settings Modal
- Appearance switcher (Light / Dark / System).
- Interface preferences (Timestamps, Code block line numbers, Sound effects preview).
- About modal displaying version `v1.0.0 (Frontend Preview)`.

---

## 📁 Project Structure

```
chatbot/
├── index.html                  # HTML entry with Plus Jakarta Sans & JetBrains Mono
├── package.json                # Project dependencies and npm scripts
├── vite.config.js              # Vite configuration
├── public/
│   └── favicon.svg             # Kiaan AI brand SVG favicon
├── src/
│   ├── main.jsx                # React root mount and stylesheet imports
│   ├── App.jsx                 # Theme provider and top-level root
│   ├── hooks/
│   │   └── useTheme.js         # Theme manager (Dark/Light/System + LocalStorage)
│   ├── components/
│   │   ├── Sidebar.jsx         # Collapsible & mobile navigation sidebar
│   │   ├── ChatHeader.jsx      # Workspace header, model selector, options
│   │   ├── WelcomeScreen.jsx   # Hero welcome screen with suggestion cards
│   │   ├── SuggestionCard.jsx  # Interactive suggestion card component
│   │   ├── ChatMessage.jsx     # User & Assistant message bubble with actions
│   │   ├── MarkdownRenderer.jsx# Custom parser for headings, lists, code & tables
│   │   ├── MessageComposer.jsx # Multiline auto-expanding composer dock
│   │   ├── ThemeToggle.jsx     # Quick 1-click theme switch
│   │   ├── SettingsModal.jsx   # Preference settings modal dialog
│   │   └── ConfirmModal.jsx    # Accessible confirmation modal for delete/clear
│   ├── layouts/
│   │   └── AppLayout.jsx       # Layout container wrapper
│   ├── pages/
│   │   └── ChatPage.jsx        # Primary conversation coordinator
│   ├── utils/
│   │   └── sampleData.js       # Pre-configured demo chats and suggestions
│   └── styles/
│       ├── variables.css       # Complete dark & light design tokens
│       ├── global.css          # Reset, baseline typography, custom scrollbars
│       ├── layout.css          # Sidebar, header, workspace, mobile drawer
│       ├── chat.css            # Welcome screen, message bubbles, composer dock
│       └── components.css      # Modals, dropdowns, switches, toasts
└── dist/                       # Production build output
```

---

## 💻 Commands to Run the Project

### Start Development Server:
```bash
npm run dev
```

### Build for Production:
```bash
npm run build
```

### Preview Production Build:
```bash
npm run preview
```

---

## 🔒 Scope & Backend Integration Readiness

This phase is strictly **Frontend UI Only**:
- Demonstration conversations are managed in client-side state.
- Submissions add the prompt to local conversation state along with a clearly labeled UI preview notice.
- When ready for full backend integration, the state in [`src/pages/ChatPage.jsx`](file:///c:/kiaan%20project/jonny/chatbot/src/pages/ChatPage.jsx) can be connected directly to your API service (e.g. streaming SSE endpoints, WebSocket, or REST API) without modifying component layouts.

