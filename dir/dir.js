const FILES_DIR = "./files/";
const FILES_TO_TRY = ["recomendati0n.txt"];

let FILES_LIST = [];

let elListing = document.getElementById("listing");
const elToc = document.getElementById("toc");
const elFileIndex = document.getElementById("file-index");
const elErrorContainer = document.getElementById("error-container");
const elQ = document.getElementById("q");
const elClear = document.getElementById("clear");
const elListingOriginal = elListing;

let currentFile = "";
let rendered = "";

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

    current.items.push({ type: "text", text: raw });
  }

  return sections;
}

function render(sections){
  elToc.innerHTML = sections
    .filter(s => s.items.some(i => i.type !== "blank"))
    .map(s => `<a href="#${s.id}">${escapeHtml(s.title)}</a>`)
    .join("");

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

function createNekoIframe(containerId){
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
  
  const iframe = document.createElement("iframe");
  iframe.id = "neko-iframe";
  iframe.style.cssText = "border:none;width:100%;min-height:100px;background:transparent;";
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  iframe.srcdoc = nekoHtml;
  
  const container = document.getElementById(containerId);
  if (container) {
    container.appendChild(iframe);
  }
  
  return iframe;
}

function showError(){
  elListing.style.display = "none";
  elErrorContainer.style.display = "block";
  
  elErrorContainer.innerHTML = `<p>oops, i don't know but look at the cat</p>`;
  createNekoIframe("error-container");
}

function showHomePage(){
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname);
  }
  
  elErrorContainer.style.display = "none";
  elToc.innerHTML = "";
  elQ.value = "";
  currentFile = "";
  renderFileIndex(FILES_LIST, "");
  
  const parent = elListing.parentElement;
  if (elListing.id !== "listing") {
    // We're using a wrapper, restore the original
    parent.replaceChild(elListingOriginal, elListing);
    elListing = elListingOriginal;
  }
  
  elListing.style.display = "block";
  
  const randomContent = `welcome to the mildly organized pile

here you'll find a collection of internet oddities
curated with questionable taste and questionable methods

things that made someone go "hmm"
things that made someone go "why"
things that made someone go "what"

click on a file above to explore
or just stare at the cat for a while

the internet is weird
and that's okay`;

  const wrapper = document.createElement("div");
  wrapper.id = "home-content-wrapper";
  const textPre = document.createElement("pre");
  textPre.style.cssText = "margin:0;white-space:pre-wrap;word-break:break-word;line-height:1.45;";
  textPre.textContent = randomContent;
  wrapper.appendChild(textPre);
  
  const nekoContainer = document.createElement("div");
  nekoContainer.id = "home-neko-container";
  nekoContainer.style.cssText = "margin-top:20px;text-align:center;";
  wrapper.appendChild(nekoContainer);
  parent.replaceChild(wrapper, elListing);
  elListing = wrapper;
  createNekoIframe("home-neko-container");
}

async function loadFile(filename){
  currentFile = filename;
  const filePath = `${FILES_DIR}${filename}`;
  
  elErrorContainer.style.display = "none";
  const parent = elListing.parentElement;
  if (elListing.id !== "listing") {
    // We're using a wrapper, restore the original
    parent.replaceChild(elListingOriginal, elListing);
    elListing = elListingOriginal;
  }
  
  elListing.style.display = "block";
  elListing.textContent = `Loading ${filename}…`;
  
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
    renderFileIndex(FILES_LIST, currentFile);
    window.location.hash = filename;
    elQ.value = "";
    applyFilter("");
  } catch (err) {
    showError();
  }
}

async function discoverFiles(){
  const discoveredFiles = [];
  const isFileProtocol = window.location.protocol === 'file:';
  
  if (isFileProtocol) {
    FILES_LIST = FILES_TO_TRY;
    return;
  }
  
  const filesToCheck = [...FILES_TO_TRY];
  const checks = filesToCheck.map(async (filename) => {
    try {
      const filePath = `${FILES_DIR}${filename}`;
      let res = await fetch(filePath, { method: "HEAD", cache: "no-store" }).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(filePath, { method: "GET", cache: "no-store" });
      }
      if (res.ok) {
        return filename;
      }
    } catch (err) {
    }
    return null;
  });
  
  const results = await Promise.allSettled(checks);
  results.forEach((result) => {
    if (result.status === "fulfilled" && result.value) {
      discoveredFiles.push(result.value);
    }
  });
  
  FILES_LIST = discoveredFiles.length > 0 ? discoveredFiles : FILES_TO_TRY;
}

async function main(){
  await discoverFiles();
  renderFileIndex(FILES_LIST, "");
  
  const hash = window.location.hash.slice(1);
  
  if (hash && FILES_LIST.includes(hash)) {
    await loadFile(hash);
  } else {
    if (hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    showHomePage();
  }

  elQ.addEventListener("input", () => applyFilter(elQ.value));
  elClear.addEventListener("click", () => {
    elQ.value = "";
    applyFilter("");
    elQ.focus();
  });

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.slice(1);
    if (hash && FILES_LIST.includes(hash) && hash !== currentFile) {
      loadFile(hash);
    } else if (!hash) {
      showHomePage();
    }
  });
}

main().catch(err => {
  showError();
});
