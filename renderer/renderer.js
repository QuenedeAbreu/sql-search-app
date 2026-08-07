const fileListEl = document.getElementById('fileList');
const searchInput = document.getElementById('search');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

let files = [];
let currentFile = null;
let matches = [];
let currentMatchIndex = 0;
let currentDir = null;
let fileContentCache = {};
let isNewFile = false;
let sortDesc = true;
let watching = true;
let isDark = true;

const themeBtn = document.getElementById('toggleTheme');
const watchBtn = document.getElementById('toggleWatch');

if (watchBtn) {
  watchBtn.onclick = async () => {
    watching = await window.api.toggleWatch();
    watchBtn.innerText = watching ? '⏸️ Pausar' : '▶️ Retomar';
  };
}

function applyTheme() {
  if (isDark) {
    document.body.classList.remove('light');
    monaco.editor.setTheme('vs-dark');
    themeBtn.innerText = '🌙';
  } else {
    document.body.classList.add('light');
    monaco.editor.setTheme('vs');
    themeBtn.innerText = '☀️';
  }

  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}
themeBtn.onclick = () => {
  isDark = !isDark;
  applyTheme();
};

function getLanguage(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();

  const map = {
    sql: 'sql',
    html: 'html',
    htm: 'html',
    js: 'javascript',
    ts: 'typescript',
    css: 'css',
    json: 'json',
    xml: 'xml',
    md: 'markdown',
    txt: 'plaintext'
  };

  return map[ext] || 'plaintext';
}

function formatDate(date) {
  return new Date(date).toLocaleString('pt-BR');
}
const menuBtn = document.getElementById('toggleSidebar');

const folderInfo = document.getElementById('folderInfo');
function updateTopbarHeight() {
  const topbar = document.querySelector('.top-bar');
  const height = topbar.offsetHeight;

  document.documentElement.style.setProperty('--topbar-height', height + 'px');
}
window.addEventListener('load', () => {
  updateTopbarHeight();
  setTimeout(updateTopbarHeight, 50);
  setTimeout(updateTopbarHeight, 150);
});
window.addEventListener('resize', updateTopbarHeight);

const overlay = document.getElementById('overlay');

overlay.onclick = () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
  menuBtn.classList.remove('active');
};



const sidebar = document.getElementById('fileList');
let sidebarVisible = true;

// document.getElementById('toggleSidebar').onclick = () => {
//   sidebarVisible = !sidebarVisible;

//   if (window.innerWidth <= 800) {
//     sidebar.classList.toggle('open');
//     overlay.classList.toggle('show');
//   } else {
//     sidebar.style.display = sidebarVisible ? 'block' : 'none';
//   }
// };

menuBtn.onclick = () => {
  menuBtn.classList.toggle('active');

  if (window.innerWidth <= 800) {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  } else {
    sidebarVisible = !sidebarVisible;
    sidebar.style.display = sidebarVisible ? 'block' : 'none';
  }
};


window.addEventListener('resize', () => {
  if (window.innerWidth > 800) {
    sidebar.classList.remove('open');
    sidebar.style.display = 'block';
  } else {
    sidebar.style.display = 'block'; // mantém no fluxo
  }
});

document.getElementById('newFile').onclick = () => {
  currentFile = null;
  isNewFile = true;

  window.editorInstance.setValue('');
};
document.getElementById('saveFile').onclick = async () => {
  const content = window.editorInstance.getValue();
  if (isNewFile || !currentFile) {
    const path = await window.api.saveAsFile(content);
    if (path) {
      isNewFile = false;
      currentFile = { path, name: path.split('\\').pop() };
      await loadFiles();
    }
    return;
  }

  await window.api.saveFile(currentFile.path, content);
};

document.getElementById('saveAs').onclick = async () => {
  const content = window.editorInstance.getValue();
  const path = await window.api.saveAsFile(content);
  if (path) {
    isNewFile = false;
    currentFile = { path, name: path.split('\\').pop() };
    await loadFiles();
  }
};

document.getElementById('selectFolder').onclick = async () => {
  const selectedDir = await window.api.selectFolder();
  if (!selectedDir) return;

  currentDir = selectedDir;

  // AGORA sim salva
  await window.api.saveLastFolder(currentDir);
  const parts = currentDir.split(/[/\\]/); // funciona Windows e Linux
  const folderName = parts[parts.length - 1];

  folderInfo.innerHTML = `
    📂 <strong>${folderName}</strong>
    <span style="color: #888"> — ${currentDir}</span>
  `;

  fileContentCache = {};

  await loadFiles();
  window.api.watchFolder(currentDir);
};

window.api.onFolderUpdate(async (changedPath) => {
  if (!watching) return;
  await loadFiles();
  // se o arquivo aberto foi alterado → recarrega
  if (currentFile && currentFile.path === changedPath) {
    const content = await window.api.readFileContent(currentFile.path);

    window.editorInstance.setValue(content);

    applySearch(); // mantém destaque
  }
});

async function loadFiles() {
  files = await window.api.readFiles(currentDir);
  renderList();
}

async function renderList() {
  fileListEl.innerHTML = '';

  const term = searchInput.value.toLowerCase();
  let filtered = [];

  for (const file of files) {
    if (!term) {
      filtered.push(file);
      continue;
    }

    if (file.name.toLowerCase().includes(term)) {
      filtered.push(file);
      continue;
    }

    let content = fileContentCache[file.path];

    if (!content) {
      content = await window.api.readFileContent(file.path);
      fileContentCache[file.path] = content;
    }

    if (content.toLowerCase().includes(term)) {
      filtered.push(file);
    }
  }


  filtered.sort((a, b) => {
    return sortDesc
      ? new Date(b.createdAt) - new Date(a.createdAt)
      : new Date(a.createdAt) - new Date(b.createdAt);
  });
  const grouped = {};
  filtered.forEach(file => {
    const relPath = (file.relativePath || '').replace(/\\/g, '/');
    const folderPath = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : '/';
    if (!grouped[folderPath]) grouped[folderPath] = [];
    grouped[folderPath].push(file);
  });

  Object.keys(grouped).sort().forEach(folderPath => {
    const folderFiles = grouped[folderPath];
    const isRoot = folderPath === '/';

    const folderHeader = document.createElement('div');
    folderHeader.className = 'folder-header';
    folderHeader.innerHTML = `<span>📁 ${isRoot ? 'Raiz' : folderPath}</span> <span class="arrow">▶</span>`;

    const folderContainer = document.createElement('div');
    folderContainer.className = 'folder-container';
    
    if (term || isRoot) {
       folderContainer.style.display = 'block';
       folderHeader.classList.add('open');
       const arrow = folderHeader.querySelector('.arrow');
       if (arrow) arrow.textContent = '▼';
    }

    folderHeader.onclick = () => {
      folderHeader.classList.toggle('open');
      const arrow = folderHeader.querySelector('.arrow');
      if (folderHeader.classList.contains('open')) {
         folderContainer.style.display = 'block';
         arrow.textContent = '▼';
      } else {
         folderContainer.style.display = 'none';
         arrow.textContent = '▶';
      }
    };

    fileListEl.appendChild(folderHeader);

    folderFiles.forEach(file => {
      const div = document.createElement('div');
      div.className = 'file-item accordion-item';
      if (currentFile && currentFile.path === file.path) {
        div.classList.add('active');
      }
      
      let displayName = file.name;
      if (term) {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        displayName = displayName.replace(regex, '<mark style="background-color: #ffeb3b; color: black; border-radius: 2px; padding: 0 2px;">$1</mark>');
      }

      div.innerHTML = `
      <div style="margin-bottom: 4px; font-weight: bold;">${displayName}</div>
      <small style="color: #888">
      Criado: ${formatDate(file.createdAt)} </br>
      Modificado: ${formatDate(file.modifiedAt)}
      </small>
      `;
      div.onclick = () => {
        document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
        openFile(file);
        if (window.innerWidth <= 800) {
          sidebar.classList.remove('open');
          overlay.classList.remove('show');
          menuBtn.classList.remove('active');
        }
      };
      folderContainer.appendChild(div);
    });

    fileListEl.appendChild(folderContainer);
  });
}

async function openFile(file) {
  const loading = document.getElementById('loadingOverlay');
  if (loading) loading.style.display = 'flex';

  try {
    currentFile = file;

    const content = await window.api.readFileContent(file.path);

    const language = getLanguage(file.name);

    const model = window.editorInstance.getModel();

    monaco.editor.setModelLanguage(model, language);

    window.editorInstance.setValue(content);

    applySearch();
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

searchInput.oninput = async () => {
  await renderList();
  applySearch();
};

function applySearch() {
  const term = searchInput.value;
  const model = window.editorInstance.getModel();
  if (!model) return;
  if (matches.length) {
    window.editorInstance.deltaDecorations(matches, []);
    matches = [];
  }
  if (!term) {
    window.currentMatches = [];
    return;
  }
  const newMatches = model.findMatches(
    term,
    true,
    false,
    false,
    null,
    true
  );
  matches = window.editorInstance.deltaDecorations(
    [],
    newMatches.map((m, i) => ({
      range: m.range,
      options: {
        className: i === currentMatchIndex
          ? 'highlight-active'
          : 'highlight'
      }
    }))
  );

  window.currentMatches = newMatches;

  if (newMatches.length) {
    currentMatchIndex = 0;
    goToMatch(newMatches[0]);
  }
}

function goToMatch(match) {
  window.editorInstance.revealRangeInCenter(match.range);
  window.editorInstance.setSelection(match.range);
}

nextBtn.onclick = () => {
  if (!window.currentMatches?.length) return;
  currentMatchIndex = (currentMatchIndex + 1) % window.currentMatches.length;
  applySearch(); //re-renderiza highlights
  goToMatch(window.currentMatches[currentMatchIndex]);
};
prevBtn.onclick = () => {
  if (!window.currentMatches?.length) return;
  currentMatchIndex =
    (currentMatchIndex - 1 + window.currentMatches.length) %
    window.currentMatches.length;
  applySearch(); // re-renderiza highlights
  goToMatch(window.currentMatches[currentMatchIndex]);
};

window.addEventListener('load', async () => {
  const savedTheme = localStorage.getItem('theme');
  let dir = await window.api.getLastFolder();
  // fallback para pasta padrão
  if (!dir) {
    dir = await window.api.getDefaultFolder();
  }
  if (!dir) return;

  currentDir = dir;

  const parts = currentDir.split(/[/\\]/);
  const folderName = parts[parts.length - 1];

  folderInfo.innerHTML = `
    📂 <strong>${folderName}</strong>
    <span style="color: #888"> — ${currentDir}</span>
  `;

  fileContentCache = {};
  if (savedTheme === 'light') {
    isDark = false;
  }
  applyTheme();
  await loadFiles();
  window.api.watchFolder(currentDir);
});
