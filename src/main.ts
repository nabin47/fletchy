import './style.css';

function render(root: HTMLElement): void {
  root.innerHTML = `
    <img src="${import.meta.env.BASE_URL}favicon.svg" width="96" height="96" alt="" />
    <h1>${__APP_NAME__}</h1>
    <p>Hello! The game is on its way.</p>
    <p class="version">v${__APP_VERSION__}</p>
  `;
}

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');
render(root);
window.__fletchy = { ready: true, version: __APP_VERSION__ };
