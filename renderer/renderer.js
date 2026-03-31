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

const watchBtn = document.getElementById('toggleWatch');

if (watchBtn) {
  watchBtn.onclick = async () => {
    watching = await window.api.toggleWatch();
    watchBtn.innerText = watching ? '⏸️ Pausar' : '▶️ Retomar';
  };
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
  filtered.forEach(file => {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `
    <div>${file.name}</div>
    <small style="color: #888">
    Criado: ${formatDate(file.createdAt)} </br>
    Modificado: ${formatDate(file.modifiedAt)}
  </small>
`;
    div.onclick = () => {
      openFile(file);
      // fecha menu no mobile
      if (window.innerWidth <= 800) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
        menuBtn.classList.remove('active');
      }
    };
    fileListEl.appendChild(div);
  });
}

async function openFile(file) {
  currentFile = file;

  const content = await window.api.readFileContent(file.path);

  window.editorInstance.setValue(content);

  applySearch();
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

  await loadFiles();
  window.api.watchFolder(currentDir);
});
