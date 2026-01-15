const DIR_TXT = "./dir.txt";

const elListing = document.getElementById("listing");
const elToc = document.getElementById("toc");
const elQ = document.getElementById("q");
const elClear = document.getElementById("clear");

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

  // Filter by hiding lines that don't match (simple and very “txt”)
  const lines = rendered.split("\n");
  const kept = lines.filter(l => l.toLowerCase().includes(query) || l.startsWith("== ") || l.startsWith("[#"));
  elListing.innerHTML = kept.join("\n");
}

async function main(){
  const res = await fetch(DIR_TXT, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load dir.txt: ${res.status}`);
  const text = await res.text();

  const sections = parse(text);
  rendered = render(sections);

  elListing.innerHTML = rendered;

  elQ.addEventListener("input", () => applyFilter(elQ.value));
  elClear.addEventListener("click", () => {
    elQ.value = "";
    applyFilter("");
    elQ.focus();
  });

  // Jump handling (for the [#id] markers)
  window.addEventListener("hashchange", () => {
    // purely cosmetic; the PRE will include markers
  });
}

main().catch(err => {
  elListing.textContent = String(err);
});
