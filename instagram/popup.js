// popup.js

async function fetchAllPosts() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SCT_GET_ALL" }, (res) => resolve(res?.posts || []));
  });
}

function renderSummary(posts) {
  document.getElementById("totalPosts").textContent = posts.length;

  const byKey = {};
  for (const p of posts) {
    const key = `${p.platform} — ${p.profile}`;
    byKey[key] = (byKey[key] || 0) + 1;
  }

  const container = document.getElementById("breakdown");
  container.innerHTML = "";
  const entries = Object.entries(byKey).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:#888;">Ainda sem dados. Abre um perfil e navega normalmente.</p>';
    return;
  }
  for (const [key, count] of entries) {
    const row = document.createElement("div");
    row.className = "breakdown-row";
    row.innerHTML = `<span>${key}</span><span>${count}</span>`;
    container.appendChild(row);
  }
}

function buildMonthlySummary(posts) {
  const map = {};
  for (const p of posts) {
    const key = `${p.platform}|${p.profile}|${p.month}`;
    if (!map[key]) {
      map[key] = {
        Rede: p.platform,
        Perfil: p.profile,
        Mês: p.month,
        Publicações: 0,
        "Total Likes": 0,
        "Total Comentários": 0, 
        "Partilhas": 0
      };
    }
    map[key].Publicações += 1;
    map[key]["Total Likes"] += p.likes || 0;
    map[key]["Total Comentários"] += p.comments || 0;
    map[key]["Partilhas"] += p.shares || 0;
  }
  const rows = Object.values(map).map((r) => ({
    ...r,
    "Média Likes/Post": r.Publicações ? Math.round((r["Total Likes"] / r.Publicações) * 10) / 10 : 0,
    "Média Comentários/Post": r.Publicações ? Math.round((r["Total Comentários"] / r.Publicações) * 10) / 10 : 0
  }));
  rows.sort((a, b) => (a.Rede + a.Perfil + a.Mês).localeCompare(b.Rede + b.Perfil + b.Mês));
  return rows;
}

function buildFormatSummary(posts) {
  const map = {};
  for (const p of posts) {
    const key = `${p.platform}|${p.profile}|${p.format || "Desconhecido"}`;
    if (!map[key]) {
      map[key] = { Rede: p.platform, Perfil: p.profile, Formato: p.format || "Desconhecido", Publicações: 0 };
    }
    map[key].Publicações += 1;
  }
  const rows = Object.values(map);
  rows.sort((a, b) => b.Publicações - a.Publicações);
  return rows;
}

function buildCategorySummary(posts) {
  const map = {};
  for (const p of posts) {
    const key = `${p.platform}|${p.profile}|${p.category || "Não classificado"}`;
    if (!map[key]) {
      map[key] = { Rede: p.platform, Perfil: p.profile, Categoria: p.category || "Não classificado", Publicações: 0 };
    }
    map[key].Publicações += 1;
  }
  const rows = Object.values(map);
  rows.sort((a, b) => b.Publicações - a.Publicações);
  return rows;
}

function buildRawData(posts) {
  return posts.map((p) => ({
    Rede: p.platform,
    Perfil: p.profile,
    Mês: p.month,
    Data: p.dateISO ? new Date(p.dateISO).toLocaleDateString("pt-PT") : "Desconhecida",
    Likes: p.likes ?? "",
    Comentários: p.comments ?? "",
    Comentários: p.shares ?? "",
    Formato: p.format || "",
    Categoria: p.category || "",
    Texto: p.textSnippet || "",
    URL: p.url || ""
  }));
}

async function exportToExcel() {
  const posts = await fetchAllPosts();
  if (posts.length === 0) {
    alert("Ainda não há dados capturados. Navega num perfil suportado primeiro.");
    return;
  }

  const wb = XLSX.utils.book_new();

  const wsMonthly = XLSX.utils.json_to_sheet(buildMonthlySummary(posts));
  XLSX.utils.book_append_sheet(wb, wsMonthly, "Resumo Mensal");

  const wsFormat = XLSX.utils.json_to_sheet(buildFormatSummary(posts));
  XLSX.utils.book_append_sheet(wb, wsFormat, "Formatos");

  const wsCategory = XLSX.utils.json_to_sheet(buildCategorySummary(posts));
  XLSX.utils.book_append_sheet(wb, wsCategory, "Categorias de Conteúdo");

  const wsRaw = XLSX.utils.json_to_sheet(buildRawData(posts));
  XLSX.utils.book_append_sheet(wb, wsRaw, "Dados Brutos");

  const filename = `relatorio-redes-sociais-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

document.getElementById("exportBtn").addEventListener("click", exportToExcel);

document.getElementById("refreshBtn").addEventListener("click", async () => {
  const posts = await fetchAllPosts();
  renderSummary(posts);
});

document.getElementById("clearBtn").addEventListener("click", () => {
  if (!confirm("Tens a certeza que queres apagar todos os dados capturados?")) return;
  chrome.runtime.sendMessage({ type: "SCT_CLEAR_ALL" }, () => {
    renderSummary([]);
  });
});

(async function init() {
  const posts = await fetchAllPosts();
  renderSummary(posts);
})();
