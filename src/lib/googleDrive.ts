export function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export async function createDriveFolder(
  folderName: string,
  accessToken: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.error?.message || "Falha ao criar pasta no Google Drive."
    );
  }

  const data = await res.json();
  return {
    id: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
  };
}

export async function uploadFileToDriveFolder(
  folderId: string,
  fileName: string,
  fileContent: string | Blob,
  mimeType: string,
  accessToken: string
) {
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" })
  );
  formData.append(
    "file",
    typeof fileContent === "string"
      ? new Blob([fileContent], { type: mimeType })
      : fileContent
  );

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err.error?.message || "";
    if (res.status === 404 || message.includes("File not found")) {
      throw new Error(
        `A pasta do Google Drive (ID: ${folderId}) não foi encontrada ou sua conta não possui permissão de escrita nela. Verifique o acesso da sua conta Google ou crie uma nova pasta.`
      );
    }
    throw new Error(
      message || `Falha ao enviar arquivo "${fileName}" para o Google Drive.`
    );
  }

  return await res.json();
}

export async function syncProjectToDriveFolder(
  folderInput: string,
  accessToken: string,
  onProgress?: (msg: string) => void
): Promise<{ uploadedFiles: number; folderUrl: string }> {
  let folderId = extractDriveFolderId(folderInput);
  
  if (!folderId) {
    throw new Error("ID ou URL da pasta do Google Drive inválido.");
  }

  if (onProgress) onProgress("Buscando arquivos do projeto...");

  const res = await fetch("/api/project-files");
  if (!res.ok) {
    throw new Error("Erro ao obter a lista de arquivos do projeto no servidor.");
  }

  const { files } = await res.json();
  const filePaths = Object.keys(files);

  if (filePaths.length === 0) {
    throw new Error("Nenhum arquivo encontrado para sincronizar.");
  }

  let uploaded = 0;
  for (const relPath of filePaths) {
    const content = files[relPath];
    let mimeType = "text/plain";
    if (relPath.endsWith(".json")) mimeType = "application/json";
    else if (relPath.endsWith(".html")) mimeType = "text/html";
    else if (relPath.endsWith(".ts") || relPath.endsWith(".tsx")) mimeType = "text/typescript";
    else if (relPath.endsWith(".css")) mimeType = "text/css";
    else if (relPath.endsWith(".md")) mimeType = "text/markdown";

    const driveFileName = relPath.replace(/\//g, "_");

    if (onProgress) {
      onProgress(`Enviando ${uploaded + 1}/${filePaths.length}: ${driveFileName}...`);
    }

    await uploadFileToDriveFolder(folderId, driveFileName, content, mimeType, accessToken);
    uploaded++;
  }

  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  return { uploadedFiles: uploaded, folderUrl };
}

// Generate standalone HTML report file for the Efetivo Militar dashboard
export function generateDashboardHtmlReport(data: any[], customTitle?: string): string {
  const title = customTitle || `Relatório do Efetivo Militar - Casa Militar (${new Date().toLocaleDateString("pt-BR")})`;
  const now = new Date().toLocaleString("pt-BR");

  let totalEfetivo = data.length;
  let totalComGrat = 0;
  let valorTotal = 0;
  const divCounts: Record<string, number> = {};
  const postoCounts: Record<string, number> = {};

  data.forEach((r) => {
    const div = (r["DIVISÃO"] || r["SIGLA DIVISÃO"] || "—").toString().trim();
    divCounts[div] = (divCounts[div] || 0) + 1;

    const posto = (r["POSTO/GRAD.  CARGO"] || r["POSTO"] || "—").toString().trim();
    postoCounts[posto] = (postoCounts[posto] || 0) + 1;

    const grat = (r["FPP/FCE"] || r["GRATIFICAÇÃO"] || "").toString().trim();
    if (grat) totalComGrat++;

    const val = Number(r["VALOR"]) || 0;
    valorTotal += val;
  });

  const jsonRows = JSON.stringify(data);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --bg: #0f0f11;
      --card-bg: #161618;
      --border: rgba(236, 236, 237, 0.12);
      --text: #ececed;
      --muted: #9a9a9e;
      --accent: #10b981;
      --blue: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      padding: 24px;
      line-height: 1.5;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    .header-title h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      text-transform: uppercase;
      color: #ffffff;
    }
    .header-title p {
      font-size: 13px;
      color: var(--muted);
      margin-top: 4px;
    }
    .actions { display: flex; gap: 10px; }
    .btn {
      background: #1e1e22;
      color: var(--text);
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover { background: #2a2a30; border-color: rgba(255,255,255,0.25); }
    .btn-emerald { background: rgba(16, 185, 129, 0.15); color: #34d399; border-color: rgba(16, 185, 129, 0.3); }
    .btn-emerald:hover { background: rgba(16, 185, 129, 0.25); }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px 20px;
    }
    .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); font-weight: 700; }
    .stat-value { font-size: 28px; font-weight: 800; color: #ffffff; margin-top: 4px; }
    .stat-sub { font-size: 12px; color: var(--accent); margin-top: 2px; }

    .filter-bar {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }
    .filter-bar input, .filter-bar select {
      background: #0f0f11;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 13px;
      outline: none;
    }
    .filter-bar input { flex: 1; min-width: 220px; }
    .filter-bar select { min-width: 160px; }

    .table-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }
    th {
      background: #121214;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(236, 236, 237, 0.06);
      white-space: nowrap;
    }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(255,255,255,0.08);
    }
    .badge-grat { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-div { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }

    @media print {
      body { background: #ffffff; color: #000000; padding: 0; }
      .btn, .filter-bar { display: none; }
      .stat-card, .table-container { border-color: #ccc; background: #fff; }
      th { background: #f0f0f0; color: #000; }
      td { border-bottom-color: #ddd; color: #000; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-title">
        <h1>Batalhão Insight — Casa Militar</h1>
        <p>Relatório de Efetivo Militar • Gerado em ${now}</p>
      </div>
      <div class="actions">
        <button class="btn btn-emerald" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total do Efetivo</div>
        <div class="stat-value">${totalEfetivo}</div>
        <div class="stat-sub">Militares cadastrados</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Com Gratificação</div>
        <div class="stat-value">${totalComGrat}</div>
        <div class="stat-sub">${totalEfetivo > 0 ? ((totalComGrat/totalEfetivo)*100).toFixed(1) : 0}% do efetivo</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Gratificações</div>
        <div class="stat-value">R$ ${valorTotal.toLocaleString("pt-BR")}</div>
        <div class="stat-sub">Investimento mensal</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Divisões Ativas</div>
        <div class="stat-value">${Object.keys(divCounts).length}</div>
        <div class="stat-sub">Unidades operacionais</div>
      </div>
    </div>

    <div class="filter-bar">
      <input type="text" id="searchInput" placeholder="🔍 Buscar por nome, posto, divisão, RG ou contato..." onkeyup="filterData()" />
      <select id="divSelect" onchange="filterData()">
        <option value="">Todas as Divisões</option>
        ${Object.keys(divCounts).sort().map(d => `<option value="${d}">${d} (${divCounts[d]})</option>`).join("")}
      </select>
      <select id="postoSelect" onchange="filterData()">
        <option value="">Todos os Postos/Cargos</option>
        ${Object.keys(postoCounts).sort().map(p => `<option value="${p}">${p} (${postoCounts[p]})</option>`).join("")}
      </select>
    </div>

    <div class="table-container">
      <table id="dataTable">
        <thead>
          <tr>
            <th>Nº</th>
            <th>NOME</th>
            <th>POSTO / GRADUAÇÃO</th>
            <th>ID-META4</th>
            <th>RG</th>
            <th>CPF</th>
            <th>DIVISÃO</th>
            <th>DATA DE INCLUSÃO - PM</th>
          </tr>
        </thead>
        <tbody id="tableBody">
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const rawData = ${jsonRows};

    function renderTable(data) {
      const tbody = document.getElementById("tableBody");
      if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--muted);">Nenhum militar encontrado com os filtros selecionados.</td></tr>';
        return;
      }

      tbody.innerHTML = data.map((r, i) => {
        const num = r["Nº"] || r["N°"] || String(i + 1).padStart(2, "0");
        const nome = r["NOME"] || "—";
        const posto = r["POSTO/GRAD.  CARGO"] || r["POSTO/GRAD. CARGO"] || r["POSTO"] || "—";
        const idMeta4 = r["ID-META4"] || r["ID_META4"] || r["ID META4"] || r["META4"] || "—";
        const rg = r["RG"] || r["Rg"] || r["rg"] || "—";
        const cpf = r["CPF"] || r["Cpf"] || r["cpf"] || "—";
        const div = r["DIVISÃO"] || r["SIGLA DIVISÃO"] || "—";
        const dataInc = r["DATA DE INCLUSÃO - PM"] || r["Data de Inclusão - PM"] || r["DATA DE INCLUSÃO"] || r["DATA DE INCLUSAO"] || r["Data de Inclusão"] || r["DATA INCLUSÃO"] || "—";

        return \`<tr>
          <td style="font-family: monospace; color: var(--muted);">\${num}</td>
          <td style="font-weight: 600; color: #fff;">\${nome}</td>
          <td>\${posto}</td>
          <td style="font-family: monospace; color: var(--muted);">\${idMeta4}</td>
          <td style="font-family: monospace; color: var(--muted);">\${rg}</td>
          <td style="font-family: monospace; color: var(--muted);">\${cpf}</td>
          <td><span class="badge badge-div">\${div}</span></td>
          <td style="font-family: monospace; color: var(--muted);">\${dataInc}</td>
        </tr>\`;
      }).join("");
    }

    function filterData() {
      const q = document.getElementById("searchInput").value.toLowerCase();
      const div = document.getElementById("divSelect").value;
      const posto = document.getElementById("postoSelect").value;

      const filtered = rawData.filter(r => {
        const rowStr = JSON.stringify(r).toLowerCase();
        const matchesQuery = !q || rowStr.includes(q);
        const matchesDiv = !div || (r["DIVISÃO"] || r["SIGLA DIVISÃO"] || "").toString().trim() === div;
        const matchesPosto = !posto || (r["POSTO/GRAD.  CARGO"] || r["POSTO"] || "").toString().trim() === posto;
        return matchesQuery && matchesDiv && matchesPosto;
      });

      renderTable(filtered);
    }

    renderTable(rawData);
  </script>
</body>
</html>`;
}

// Export Dashboard HTML report directly into a Google Drive Folder or root Google Drive
export async function exportHtmlToDriveFolder(
  folderInput: string,
  accessToken: string,
  data: any[],
  customTitle?: string
): Promise<{ fileUrl: string; fileName: string; id: string }> {
  let folderId = extractDriveFolderId(folderInput);

  // If no valid folder ID provided or empty, create a new folder automatically
  if (!folderId || folderId === folderInput.trim()) {
    try {
      const newFolder = await createDriveFolder(
        `Efetivo_CasaMilitar_Relatorios_${new Date().toISOString().slice(0, 10)}`,
        accessToken
      );
      folderId = newFolder.id;
    } catch (err) {
      console.warn("Could not create dedicated folder, attempting upload to root folder:", err);
      // Fallback: search or use folderId as root if folder creation fails
    }
  }

  const fileName = `Relatorio_Efetivo_CasaMilitar_${new Date().toISOString().slice(0, 10)}.html`;
  const htmlContent = generateDashboardHtmlReport(data, customTitle);

  const res = await uploadFileToDriveFolder(
    folderId,
    fileName,
    htmlContent,
    "text/html",
    accessToken
  );

  const fileUrl = res.webViewLink || `https://drive.google.com/file/d/${res.id}/view`;
  return { fileUrl, fileName, id: res.id };
}
