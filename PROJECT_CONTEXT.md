# Project Context and Design

## 1. Project Purpose
The **Learning Log** is a personal, highly structured, and categorized knowledge-base application. It is designed to be a frictionless place to document technical learnings, concepts, and discussions. 

Instead of relying on a complex backend database like Firebase Firestore, this project deliberately uses **Git-tracked Markdown files**. This ensures that notes are version-controlled, can be edited offline in an IDE, and can be hosted statically for maximum performance and zero cost.

## 2. Technical Stack
- **Frontend**: Vite + Vanilla JavaScript (No React/Vue overhead).
- **Markdown Parsing**: `marked.js` (for parsing `.md` to HTML) and `DOMPurify` (for security sanitization).
- **Syntax Highlighting**: `highlight.js` (Atom One Dark theme).
- **Hosting**: Firebase Hosting (Classic).

## 3. Architecture & Data Flow
The application is a Single Page Application (SPA). 

### The Catalog (`public/docs/catalog.json`)
Since there is no backend database, `catalog.json` acts as the source of truth for the application's structure. It contains an array of categories, each with an icon, color, and an array of topics (Markdown file paths).
When the app loads, `src/main.js` fetches `catalog.json` and dynamically generates the sidebar navigation.

### Markdown Storage
All learning logs are stored in `public/docs/<category>/<filename>.md`.
When a user clicks a link in the sidebar, the app intercepts the click, updates the URL Hash, fetches the raw Markdown file from the `public/` directory, parses it, and injects it into the main content area.

## 4. UI/UX Design (Aesthetics)
The application adheres to premium, modern web design principles:
- **Theme**: Deep dark mode (`#0d1117` background).
- **Glassmorphism**: The sidebar and mobile headers use translucent backgrounds with CSS `backdrop-filter: blur()`.
- **Typography**: Google Fonts 'Inter' for clean, readable UI text, and 'Fira Code' for code blocks.
- **Responsiveness**: Fully responsive. On mobile, the sidebar is hidden behind a hamburger menu and uses a dark overlay backdrop.

## 5. Automated Agent Integration
This repository is deeply integrated with a custom Antigravity skill (`add-learning-log`). 
The AI agent is aware of this repository and is permitted to:
1. Auto-discover missing topics from conversation history.
2. Generate Markdown files and dynamically create new category folders if required.
3. Update `catalog.json`.
4. Run standard Git commands (`add`, `commit`, `push`).
5. Trigger Firebase deployments automatically (`npm run deploy`).

## 6. Future Roadmap
- **AI Q&A Agent**: An upcoming feature to embed an AI agent directly into the UI that will read the `public/docs/` markdown files and generate interactive Q&A flashcards to test the user's knowledge.
