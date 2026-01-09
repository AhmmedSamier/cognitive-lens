/* eslint-disable no-undef */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const nonce = '${nonce}';
const vscode = acquireVsCodeApi();
const listContainer = document.getElementById('method-list');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const sortDirectionBtn = document.getElementById('sort-direction-btn');
const sortIcon = document.getElementById('sort-icon');

let allMethods = [];
let config = { threshold: { warning: 15, error: 25 } };
let currentSort = 'line';
let isAscending = true;
let selectedMethodStartIndex = null;

function updateSortIcon() {
  if (isAscending) {
    // Up arrow
    sortIcon.innerHTML =
      '<!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M278.6 438.6L182.6 534.6C170.1 547.1 149.8 547.1 137.3 534.6L41.3 438.6C28.8 426.1 28.8 405.8 41.3 393.3C53.8 380.8 74.1 380.8 86.6 393.3L128 434.7L128 128C128 110.3 142.3 96 160 96C177.7 96 192 110.3 192 128L192 434.7L233.4 393.3C245.9 380.8 266.2 380.8 278.7 393.3C291.2 405.8 291.2 426.1 278.7 438.6zM352 96L384 96C401.7 96 416 110.3 416 128C416 145.7 401.7 160 384 160L352 160C334.3 160 320 145.7 320 128C320 110.3 334.3 96 352 96zM352 224L448 224C465.7 224 480 238.3 480 256C480 273.7 465.7 288 448 288L352 288C334.3 288 320 273.7 320 256C320 238.3 334.3 224 352 224zM352 352L512 352C529.7 352 544 366.3 544 384C544 401.7 529.7 416 512 416L352 416C334.3 416 320 401.7 320 384C320 366.3 334.3 352 352 352zM352 480L576 480C593.7 480 608 494.3 608 512C608 529.7 593.7 544 576 544L352 544C334.3 544 320 529.7 320 494.3 334.3 480 352 480z"/>';
  } else {
    // Down arrow
    sortIcon.innerHTML =
      '<!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M278.6 438.6L182.6 534.6C170.1 547.1 149.8 547.1 137.3 534.6L41.3 438.6C28.8 426.1 28.8 405.8 41.3 393.3C53.8 380.8 74.1 380.8 86.6 393.3L128 434.7L128 128C128 110.3 142.3 96 160 96C177.7 96 192 110.3 192 128L192 434.7L233.4 393.3C245.9 380.8 266.2 380.8 278.7 393.3C291.2 405.8 291.2 426.1 278.7 438.6zM352 544C334.3 544 320 529.7 320 512C320 494.3 334.3 480 352 480L384 480C401.7 480 416 494.3 416 512C416 529.7 401.7 544 384 544L352 544zM352 416C334.3 416 320 401.7 320 384C320 366.3 334.3 352 352 352L448 352C465.7 352 480 366.3 480 384C480 401.7 465.7 416 448 416L352 416zM352 288C334.3 288 320 273.7 320 256C320 238.3 334.3 224 352 224L512 224C529.7 224 544 238.3 544 256C544 273.7 529.7 288 512 288L352 288zM352 160C334.3 160 320 145.7 320 128C320 110.3 334.3 96 352 96L576 96C593.7 96 608 110.3 608 128C608 145.7 593.7 160 576 160L352 160z"/>';
  }
}

function sortData() {
  allMethods.sort((a, b) => {
    let valA, valB;
    switch (currentSort) {
      case 'name':
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        break;
      case 'complexity':
        valA = a.score;
        valB = b.score;
        break;
      case 'line':
      default:
        valA = a.startLine;
        valB = b.startLine;
        break;
    }

    if (valA < valB) return isAscending ? -1 : 1;
    if (valA > valB) return isAscending ? 1 : -1;
    return 0;
  });
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getHighlightedHtml(text, pattern) {
  if (!pattern) return escapeHtml(text);
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  let result = '';
  let patternIdx = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (patternIdx < pattern.length && lowerText[i] === lowerPattern[patternIdx]) {
      result += '<span class="highlight">' + escapeHtml(char) + '</span>';
      patternIdx++;
    } else {
      result += escapeHtml(char);
    }
  }

  if (patternIdx < pattern.length) return null; // No match
  return result;
}

function render(filter = '') {
  listContainer.innerHTML = '';

  // Sort before rendering
  sortData();

  allMethods.forEach((method) => {
    if (method.isCallback) return;

    const highlightedName = getHighlightedHtml(method.name, filter);
    if (highlightedName === null) {
      return;
    }

    const el = document.createElement('div');
    el.className = 'method-item';
    if (method.startIndex === selectedMethodStartIndex) {
      el.classList.add('selected');
    }
    el.id = 'method-' + method.startIndex;

    el.onclick = () => {
      selectedMethodStartIndex = method.startIndex;
      render(searchInput.value); // Re-render to update selection visual
      vscode.postMessage({ type: 'jump', value: method });
    };

    let colorClass = 'complexity-low';
    if (method.score >= config.threshold.error) colorClass = 'complexity-high';
    else if (method.score >= config.threshold.warning) colorClass = 'complexity-medium';

    const icon = document.createElement('div');
    icon.className = 'method-icon ' + colorClass;

    const info = document.createElement('div');
    info.className = 'method-info';

    const name = document.createElement('div');
    name.className = 'method-name';
    name.innerHTML = highlightedName; // Use innerHTML for highlighting

    const details = document.createElement('div');
    details.className = 'method-details';

    let deltaHtml = '';
    if (method.complexityDelta !== undefined && method.complexityDelta !== 0) {
      const sign = method.complexityDelta > 0 ? '+' : '';
      const deltaColor =
        method.complexityDelta > 0
          ? 'var(--vscode-errorForeground)'
          : 'var(--vscode-testing-iconPassed)';
      deltaHtml = ` <span style="color: ${deltaColor}; font-weight: bold;">(${sign}${method.complexityDelta})</span>`;
    }

    details.innerHTML = `Score: ${method.score} ${deltaHtml} (Line: ${method.startLine + 1}) (${method.endLine - method.startLine + 1} lines)`;

    info.appendChild(name);
    info.appendChild(details);

    el.appendChild(icon);
    el.appendChild(info);

    listContainer.appendChild(el);
  });
}

window.addEventListener('message', (event) => {
  const message = event.data;
  switch (message.type) {
    case 'update': {
      allMethods = message.body;
      if (message.config) {
        config = message.config;
      }
      render(searchInput.value);
      break;
    }
    case 'reveal': {
      const methodToReveal = message.body;
      selectedMethodStartIndex = methodToReveal.startIndex;
      render(searchInput.value);
      const el = document.getElementById('method-' + methodToReveal.startIndex);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      break;
    }
  }
});

searchInput.addEventListener('input', (e) => {
  render(e.target.value);
});

sortSelect.addEventListener('change', (e) => {
  currentSort = e.target.value;
  render(searchInput.value);
});

sortDirectionBtn.addEventListener('click', () => {
  isAscending = !isAscending;
  updateSortIcon();
  render(searchInput.value);
});

vscode.postMessage({ type: 'ready' });
