const FILES_DIR = "./files/";
// Lista inicial de arquivos conhecidos para tentar descobrir
// Atualize esta lista quando adicionar novos arquivos .txt na pasta files/
const FILES_TO_TRY = ["recomendati0n.txt"];

let FILES_LIST = [];

const elListing = document.getElementById("listing");
const elToc = document.getElementById("toc");
const elFileIndex = document.getElementById("file-index");
const elErrorContainer = document.getElementById("error-container");
const elQ = document.getElementById("q");
const elClear = document.getElementById("clear");

let currentFile = "";
let model = []; // [{type:'heading'|'link'|'text', ...}]
let rendered = ""; // string pre-rendered with anchors

function slugify(s){
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

function isUrl(line){
  return /^https?:\/\/\S+$/i.test(line.trim());
}

function parse(text){
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  let current = { title: "Unsorted", id: "unsorted", items: [] };
  const sections = [current];

  for (const raw of lines){
    const line = raw.trim();

    if (!line){
      current.items.push({ type: "blank" });
      continue;
    }

    if (line.startsWith("# ")){
      const title = line.slice(2).trim();
      const id = slugify(title) || "section";
      current = { title, id, items: [] };
      sections.push(current);
      continue;
    }

    if (isUrl(line)){
      current.items.push({ type: "link", url: line });
      continue;
    }

    // free text / notes
    current.items.push({ type: "text", text: raw });
  }

  return sections;
}

function render(sections){
  // Build TOC
  elToc.innerHTML = sections
    .filter(s => s.items.some(i => i.type !== "blank"))
    .map(s => `<a href="#${s.id}">${escapeHtml(s.title)}</a>`)
    .join("");

  // Render in one PRE, but with anchor-like markers + HTML links
  // Note: we keep the "txt feel" by using PRE and short separators.
  const out = [];
  for (const s of sections){
    out.push(`\n== ${s.title} ==`);
    out.push(`[#${s.id}]\n`);
    for (const it of s.items){
      if (it.type === "blank"){
        out.push("");
      } else if (it.type === "text"){
        out.push(escapeHtml(it.text));
      } else if (it.type === "link"){
        const u = it.url;
        // show as clickable while retaining plain URL appearance
        out.push(`<a href="${u}" rel="noreferrer noopener" target="_blank">${u}</a>`);
      }
    }
  }
  return out.join("\n");
}

function applyFilter(q){
  const query = (q || "").toLowerCase().trim();
  if (!query){
    elListing.innerHTML = rendered;
    return;
  }

  // Filter by hiding lines that don't match (simple and very "txt")
  const lines = rendered.split("\n");
  const kept = lines.filter(l => l.toLowerCase().includes(query) || l.startsWith("== ") || l.startsWith("[#"));
  elListing.innerHTML = kept.join("\n");
}

function renderFileIndex(files, current){
  elFileIndex.innerHTML = files
    .map(f => {
      const isActive = f === current;
      const className = isActive ? "active" : "";
      return `<a href="#${f}" class="${className}" data-file="${f}">${escapeHtml(f)}</a>`;
    })
    .join("");
  
  // Add click handlers
  elFileIndex.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const file = a.getAttribute("data-file");
      if (file && file !== currentFile) {
        loadFile(file);
      }
    });
  });
}

function showError(){
  elListing.style.display = "none";
  elErrorContainer.style.display = "block";
  
  // Create iframe with Neko HTML to avoid document.write() issues
  const nekoHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline' 'unsafe-eval' https://webneko.net; style-src 'unsafe-inline'; img-src https://webneko.net;">
  <script>NekoType="pink"</script>
</head>
<body style="margin:0;padding:10px;background:transparent;">
  <h1 id=nl style="margin:0;padding:0;"><script src="https://webneko.net/n20171213.js"></script><a href="https://webneko.net" style="color:#a7ffb5;text-decoration:none;">Neko</a></h1>
</body>
</html>`;
  
  elErrorContainer.innerHTML = `
    <p>oops, i don't know but look at the cat</p>
    <iframe id="neko-iframe" style="border:none;width:100%;min-height:100px;background:transparent;" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
  `;
  
  const iframe = document.getElementById("neko-iframe");
  if (iframe) {
    iframe.srcdoc = nekoHtml;
  }
}

async function loadFile(filename){
  currentFile = filename;
  const filePath = `${FILES_DIR}${filename}`;
  
  elListing.style.display = "block";
  elErrorContainer.style.display = "none";
  elListing.textContent = `Loading ${filename}…`;
  
  // Check if we're using file:// protocol (CORS will block fetch)
  const isFileProtocol = window.location.protocol === 'file:';
  if (isFileProtocol) {
    elListing.innerHTML = `
      <p style="color: var(--warn);">⚠️ Este site precisa ser servido via HTTP/HTTPS para funcionar.</p>
      <p style="color: var(--dim);">Use um servidor web local (ex: <code>python -m http.server</code> ou <code>npx serve</code>)</p>
      <p style="color: var(--dim);">Ou abra via: <code>http://localhost:8000/dir/index.html</code></p>
    `;
    return;
  }
  
  try {
    const res = await fetch(filePath, { cache: "no-store" });
    
    if (!res.ok) {
      showError();
      return;
    }
    const text = await res.text();

    const sections = parse(text);
    rendered = render(sections);
    elListing.innerHTML = rendered;
    
    // Update file index to show active file
    renderFileIndex(FILES_LIST, currentFile);
    
    // Update URL hash
    window.location.hash = filename;
    
    // Clear filter when switching files
    elQ.value = "";
    applyFilter("");
  } catch (err) {
    showError();
  }
}

async function discoverFiles(){
  const discoveredFiles = [];
  
  // Check if we're running from file:// protocol (CORS will block)
  const isFileProtocol = window.location.protocol === 'file:';
  
  // If file protocol, we can't use fetch, so just use the known files list
  if (isFileProtocol) {
    FILES_LIST = FILES_TO_TRY;
    return;
  }
  
  // Try to discover files by attempting to load them
  // Start with known files list
  const filesToCheck = [...FILES_TO_TRY];
  
  // Try each file and see if it exists
  // Use Promise.allSettled to try all files in parallel
  const checks = filesToCheck.map(async (filename) => {
    try {
      const filePath = `${FILES_DIR}${filename}`;
      // Try HEAD first (faster), fallback to GET if HEAD fails
      let res = await fetch(filePath, { method: "HEAD", cache: "no-store" }).catch(() => null);
      if (!res || !res.ok) {
        // If HEAD failed, try GET (some servers don't support HEAD)
        res = await fetch(filePath, { method: "GET", cache: "no-store" });
      }
      if (res.ok) {
        return filename;
      }
    } catch (err) {
      // File doesn't exist or can't be accessed
    }
    return null;
  });
  
  const results = await Promise.allSettled(checks);
  results.forEach((result) => {
    if (result.status === "fulfilled" && result.value) {
      discoveredFiles.push(result.value);
    }
  });
  
  // If we found files, use them; otherwise use the initial list as fallback
  if (discoveredFiles.length > 0) {
    FILES_LIST = discoveredFiles;
  } else {
    // Fallback: use the initial list (will show errors if files don't exist)
    FILES_LIST = FILES_TO_TRY;
  }
}

async function main(){
  // Discover files automatically
  await discoverFiles();
  
  // Render file index
  renderFileIndex(FILES_LIST, "");
  
  // Determine which file to load from URL hash or default
  const hash = window.location.hash.slice(1);
  const defaultFile = FILES_LIST[0];
  const fileToLoad = hash && FILES_LIST.includes(hash) ? hash : defaultFile;
  
  // Load the file
  if (fileToLoad) {
    await loadFile(fileToLoad);
  }

  elQ.addEventListener("input", () => applyFilter(elQ.value));
  elClear.addEventListener("click", () => {
    elQ.value = "";
    applyFilter("");
    elQ.focus();
  });

  // Handle hash changes (for direct links to files)
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.slice(1);
    if (hash && FILES_LIST.includes(hash) && hash !== currentFile) {
      loadFile(hash);
    }
  });
}

main().catch(err => {
  showError();
});
