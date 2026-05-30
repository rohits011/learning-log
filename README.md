# Learning Log

A personal, statically built, responsive documentation website tailored for storing and categorizing technical learning notes. Built with Vite and Vanilla JS.

## Architecture

This project deliberately avoids a complex database (like Firestore) in favor of **Git-tracked Markdown files**. This approach provides built-in version control, offline capabilities within an IDE, and extremely fast static hosting.

### The File Structure

```text
public/docs/
  ├── java/
  │    └── concurrency-basics.md
  ├── python/
  │    └── python-idioms.md
  ├── ai/
  │    └── llm-internals.md
  ├── cyber/
  │    └── owasp-top-10.md
  └── catalog.json
```

- **Markdown Files**: All notes are stored as standard `.md` files grouped by category folders.
- **`catalog.json`**: This JSON file acts as the database mapping. The frontend reads this file to build the dynamic sidebar.

#### Example `catalog.json` Entry:
```json
{
  "category": "Java",
  "icon": "☕",
  "color": "#f89820",
  "topics": [
    {
      "title": "Concurrency Basics",
      "path": "java/concurrency-basics.md"
    }
  ]
}
```

## Available Commands

In the project directory, you can run:

### `npm run dev`
Starts the Vite local development server. Open the provided `localhost` link to preview your changes in real-time.

### `npm run build`
Compiles the application and moves the static assets into the `dist/` directory.

### `npm run deploy`
Builds the project and immediately deploys the static files to Firebase Hosting.

## Firebase Setup & Deployment

If this is your first time setting up Firebase on a new machine, follow these steps to connect your local environment to your Firebase project:

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```
2. **Login to Firebase**:
   ```bash
   firebase login
   ```
   *(This will open a browser window for authentication)*
3. **Initialize the Project** (if not already done):
   ```bash
   firebase init hosting
   ```
   - Select "Use an existing project" or "Create a new project".
   - Set the public directory to `dist`.
   - Configure as a single-page app: `Yes`.
   - Set up automatic builds and deploys with GitHub: `No` (for now).

Once authenticated, the automated skill will be able to run `npm run deploy` successfully.

## Automated Workflow (Antigravity Skill)

This project is paired with a custom AI agent skill (`add-learning-log`). 
Whenever new topics are discussed, the agent is configured to:
1. Parse the topic and create the respective `.md` file.
2. Create new category folders dynamically if they do not exist.
3. Update the `catalog.json` mapping.
4. Run `git add .`, `git commit`, and `git push`.
5. Automatically trigger `npm run deploy` to publish the changes live.