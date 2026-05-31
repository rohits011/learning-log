# Firebase Basics

Firebase is a backend-as-a-service (BaaS) platform developed by Google that provides serverless tools to build, deploy, and scale web and mobile applications quickly. It abstracts away server management, infrastructure scaling, and database provisioning, allowing developers to focus entirely on front-end features and business logic.

---

## How Firebase Helps Us

1. **Rapid Prototyping & Development**: Firebase handles databases, authentication, file storage, and hosting out of the box with unified, easy-to-use SDKs.
2. **Serverless Scaling**: Core services like Cloud Firestore and Cloud Functions scale automatically from zero to millions of users without requiring manual server scaling or load balancer setup.
3. **Built-in Security**: You can define read/write permissions directly on database and storage layers using Firebase Security Rules, eliminating the need to write backend validation routes for basic operations.
4. **Hosting & CDN**: Firebase Hosting serves static and dynamic web content over a globally distributed CDN with automatic SSL certificates.
5. **Analytics & Diagnostics**: Services like Google Analytics for Firebase and Firebase Crashlytics track user engagement, session data, and application stability automatically.

---

## Application Setup

Here is how Firebase is integrated and configured in this application:

### 1. SDK Installation
We installed the core Firebase SDK npm package:
```bash
npm install firebase
```

### 2. Secure Configuration (`.env`)
To protect our API keys and database identifiers from being committed to public Git repositories, we store them in a local `.env` file at the project root. Since this project is powered by **Vite**, we prefix all exposed client-side environment variables with `VITE_`:

```ini
# .env (Excluded from Git)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

> [!WARNING]
> **Client-Side Exposure**: Storing keys in `.env` protects them from version control, but Vite embeds them into the compiled JavaScript bundle delivered to the user's browser. Always enforce strict Firebase Security Rules on your databases and restrict your API keys in the Google Cloud Console.

We also created `.env.example` as a template for other developers working on the repository:
```ini
# .env.example (Tracked in Git)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
...
```

And added `.env` to `.gitignore`:
```text
# Environment variables
.env
.env.local
```

### 3. Firebase Initialization
We created `src/firebase.js` to initialize the app and retrieve the Google Analytics service:

```javascript
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };
```

---

## Deployment Configuration

This site is deployed to **Firebase Hosting**. 

### Initializing Hosting
Hosting was initialized using the Firebase CLI:
```bash
firebase init hosting
```
During initialization:
- **Public directory**: Configured to `dist` (Vite's build output folder).
- **Single-page app**: Yes (rewrites all requests to `/index.html`).

This generated the following `firebase.json` configuration file:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Deploying Updates
The deployment process is bundled in our `package.json` scripts:
```json
"deploy": "npm run build && npx -y firebase-tools@latest deploy"
```
To build the application and deploy it live, run:
```bash
npm run deploy
```
This builds your latest code using Vite and uploads the `dist` directory to Firebase's CDN hosting servers.
