import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

// Setup marked to use highlight.js
marked.setOptions({
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
});

const navContainer = document.getElementById('nav-container');
const contentArea = document.getElementById('content');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');

// Mobile sidebar toggling
function toggleSidebar() {
  sidebar.classList.toggle('open');
  backdrop.classList.toggle('show');
}
menuToggle.addEventListener('click', toggleSidebar);
backdrop.addEventListener('click', toggleSidebar);

// Fetch catalog and build navigation
async function init() {
  try {
    const res = await fetch('/docs/catalog.json');
    const catalog = await res.json();
    buildSidebar(catalog);
  } catch (error) {
    console.error("Failed to load catalog", error);
    contentArea.innerHTML = `<div class="welcome-screen"><h2>Error Loading Catalog</h2><p>${error.message}</p></div>`;
  }
}

function buildSidebar(catalog) {
  navContainer.innerHTML = '';
  
  catalog.forEach(cat => {
    // Create category section
    const catDiv = document.createElement('div');
    catDiv.className = 'category';
    
    // Header
    const catHeader = document.createElement('div');
    catHeader.className = 'category-header';
    catHeader.innerHTML = `<span style="color: ${cat.color}">${cat.icon}</span> ${cat.category}`;
    catDiv.appendChild(catHeader);
    
    // Topics
    const ul = document.createElement('ul');
    ul.className = 'topic-list';
    
    cat.topics.forEach(topic => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${topic.path}`;
      a.className = 'topic-link';
      a.textContent = topic.title;
      
      a.addEventListener('click', (e) => {
        e.preventDefault();
        // Update URL hash
        window.history.pushState(null, '', `#${topic.path}`);
        loadDocument(topic.path, a);
        if (window.innerWidth <= 768) {
          toggleSidebar();
        }
      });
      
      li.appendChild(a);
      ul.appendChild(li);
    });
    
    catDiv.appendChild(ul);
    navContainer.appendChild(catDiv);
  });

  // Load doc if hash exists
  handleHashChange();
}

async function loadDocument(path, linkElement = null) {
  // Update active states
  document.querySelectorAll('.topic-link').forEach(el => el.classList.remove('active'));
  if (linkElement) {
    linkElement.classList.add('active');
  } else {
    // Find matching link if loaded via direct URL
    const link = document.querySelector(`.topic-link[href="#${path}"]`);
    if (link) link.classList.add('active');
  }

  // Show loading state
  contentArea.innerHTML = `<p style="color: var(--text-muted)">Loading document...</p>`;

  try {
    const res = await fetch(`/docs/${path}`);
    if (!res.ok) throw new Error("Document not found.");
    const markdown = await res.text();
    
    // Parse markdown and sanitize
    const rawHtml = marked.parse(markdown);
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    
    contentArea.innerHTML = cleanHtml;
  } catch (error) {
    console.error(error);
    contentArea.innerHTML = `<div class="welcome-screen"><h2>Document Not Found</h2><p>Could not load <code>${path}</code></p></div>`;
  }
}

function handleHashChange() {
  const hash = window.location.hash.slice(1); // remove '#'
  if (hash) {
    loadDocument(hash);
  } else {
    // Default screen
    contentArea.innerHTML = `
      <div class="welcome-screen">
        <h1>Welcome to your Learning Log</h1>
        <p>Select a topic from the sidebar to start reading.</p>
      </div>
    `;
  }
}

window.addEventListener('popstate', handleHashChange);

// Initialize app
init();
