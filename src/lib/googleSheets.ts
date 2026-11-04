export interface GoogleSheetImportResult {
  spreadsheetTitle: string;
  sheetName: string;
  totalRows: number;
  records: any[];
}

// Extract Spreadsheet ID from full URL or return ID directly
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  
  // Detect separator: tab vs semicolon vs comma from first few lines
  const firstLines = csvText.slice(0, 1000);
  const tabCount = (firstLines.match(/\t/g) || []).length;
  const semiCount = (firstLines.match(/;/g) || []).length;
  const commaCount = (firstLines.match(/,/g) || []).length;

  let separator = ",";
  if (tabCount > semiCount && tabCount > commaCount) {
    separator = "\t";
  } else if (semiCount > commaCount) {
    separator = ";";
  }

  let curRow: string[] = [];
  let curField = "";
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      curField += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === separator && !insideQuotes) {
      curRow.push(curField.trim());
      curField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      curRow.push(curField.trim());
      if (curRow.some((f) => f.length > 0)) {
        result.push(curRow);
      }
      curRow = [];
      curField = "";
    } else {
      curField += char;
    }
  }

  if (curField.length > 0 || curRow.length > 0) {
    curRow.push(curField.trim());
    if (curRow.some((f) => f.length > 0)) {
      result.push(curRow);
    }
  }

  return result;
}

// Fetch spreadsheet metadata and values
export async function fetchSpreadsheetData(
  spreadsheetInput: string,
  accessToken?: string | null
): Promise<GoogleSheetImportResult> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetInput);
  if (!spreadsheetId) {
    throw new Error("ID ou URL da Planilha inválido.");
  }

  let rows: string[][] = [];
  let spreadsheetTitle = "Planilha do Google";
  let sheetName = "Efetivo";

  // Try Google Sheets API if accessToken is provided
  if (accessToken) {
    try {
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        spreadsheetTitle = metaData.properties?.title || "Planilha do Google";
        const sheets = metaData.sheets || [];
        if (sheets.length > 0) {
          sheetName = sheets[0].properties?.title || "Sheet1";
        }

        const encodedSheetName = encodeURIComponent(sheetName);
        let valRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodedSheetName}'!A1:ZZ5000`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!valRes.ok) {
          // Fallback to range without sheet name or without single quotes
          valRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheetName}!A1:ZZ5000`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
        }

        if (valRes.ok) {
          const valData = await valRes.json();
          rows = valData.values || [];
        }
      }
    } catch (e) {
      console.warn("Google Sheets API failed, fallback to CSV export:", e);
    }
  }

  // Fallback to CSV export or Server Proxy if API didn't return rows or no token provided
  if (!rows || rows.length === 0) {
    const gidMatch = spreadsheetInput.match(/gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : "1260062010";

    const csvUrls = [
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`
    ];

    let csvSuccess = false;
    for (const url of csvUrls) {
      try {
        const reqHeaders: Record<string, string> = {};
        if (accessToken) {
          reqHeaders["Authorization"] = `Bearer ${accessToken}`;
        }

        let csvRes = await fetch(url, { headers: reqHeaders });
        if (!csvRes.ok && accessToken) {
          // Retry without Authorization header in case public URL rejects Bearer token
          csvRes = await fetch(url);
        }

        if (csvRes.ok) {
          const csvText = await csvRes.text();
          if (!csvText.trim().startsWith("<!DOCTYPE") && !csvText.trim().startsWith("<html")) {
            const parsed = parseCSV(csvText);
            if (parsed && parsed.length >= 2) {
              rows = parsed;
              csvSuccess = true;
              break;
            }
          }
        }
      } catch (err) {
        console.warn(`Failed CSV fetch from ${url}:`, err);
      }
    }

    // If client fetch was blocked by CORS or auth, try server proxy endpoint /api/fetch-sheet
    if (!csvSuccess && (!rows || rows.length === 0)) {
      try {
        const proxyRes = await fetch("/api/fetch-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: spreadsheetInput, token: accessToken }),
        });

        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          if (proxyData.rows && proxyData.rows.length >= 2) {
            rows = proxyData.rows;
            if (proxyData.spreadsheetTitle) spreadsheetTitle = proxyData.spreadsheetTitle;
            if (proxyData.sheetName) sheetName = proxyData.sheetName;
            csvSuccess = true;
          } else if (proxyData.csvText) {
            const parsed = parseCSV(proxyData.csvText);
            if (parsed && parsed.length >= 2) {
              rows = parsed;
              if (proxyData.spreadsheetTitle) spreadsheetTitle = proxyData.spreadsheetTitle;
              csvSuccess = true;
            }
          }
        }
      } catch (err) {
        console.warn("Server proxy fetch failed:", err);
      }
    }

    if (!csvSuccess && (!rows || rows.length === 0)) {
      throw new Error("Não foi possível acessar a planilha. Verifique se o link está correto e se o compartilhamento no Google Drive está definido como 'Qualquer pessoa com o link' ou se você está conectado à sua conta do Google.");
    }
  }

  if (rows.length < 2) {
    throw new Error("A planilha selecionada está vazia ou contém apenas cabeçalhos.");
  }

  // Find header row (first row with recognizable header keywords like NOME, POSTO, CARGO, RG, CPF, etc.)
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const rowCells = rows[r].map((c) => (c || "").toString().trim().toUpperCase());
    const matchCount = rowCells.filter(
      (cell) =>
        cell.includes("NOME") ||
        cell.includes("POSTO") ||
        cell.includes("CARGO") ||
        cell.includes("DIVISÃO") ||
        cell.includes("DIVISAO") ||
        cell.includes("RG") ||
        cell.includes("CPF") ||
        cell.includes("FPP") ||
        cell.includes("FCE") ||
        cell.includes("CONTATO") ||
        cell.includes("TELEFONE") ||
        cell.includes("Nº") ||
        cell.includes("N°")
    ).length;

    if (matchCount >= 1) {
      headerRowIndex = r;
      break;
    }
  }

  const rawHeaders = rows[headerRowIndex].map((h) => (h || "").trim());
  const records: any[] = [];

  const normalizeHeader = (h: string) => h.toUpperCase().replace(/\s+/g, " ").trim();

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c.trim())) continue;

    const obj: Record<string, any> = {};
    rawHeaders.forEach((h, idx) => {
      if (!h) return;
      let val: any = row[idx] !== undefined ? row[idx].trim() : null;

      const norm = normalizeHeader(h);
      if (norm === "Nº" || norm === "N°" || norm === "NO" || norm === "NUMERO" || norm === "#" || norm === "IDENTIFICADOR") {
        const numVal = parseInt(val, 10);
        const parsedVal = isNaN(numVal) ? (i - headerRowIndex) : numVal;
        val = String(parsedVal).padStart(2, "0");
      } else if (norm === "VALOR" && val) {
        const cleanVal = val.replace(/[^\d,. -]/g, "").replace(".", "").replace(",", ".");
        const parsedFloat = parseFloat(cleanVal);
        val = isNaN(parsedFloat) ? val : parsedFloat;
      }

      obj[h] = val !== "" && val !== null ? val : null;
    });

    // Validate military member name
    const nameVal = String(
      obj["NOME"] || obj["Nome"] || obj["nome"] || obj["NOME COMPLETO"] || obj["Nome Completo"] || obj["Colaborador"] || ""
    ).trim();

    if (!nameVal) continue;

    const upperName = nameVal.toUpperCase();
    if (
      upperName.startsWith("TOTAL") ||
      upperName.startsWith("SUBTOTAL") ||
      upperName.startsWith("LEGENDA") ||
      upperName.startsWith("FONTE") ||
      upperName.startsWith("OBSERV") ||
      upperName.startsWith("QUADRO") ||
      upperName === "NOME" ||
      upperName === "N/A"
    ) {
      continue;
    }

    if (!/[a-zA-ZáéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]/.test(nameVal)) {
      continue;
    }

    obj["NOME"] = nameVal;

    const puestoVal = obj["POSTO/GRAD.  CARGO"] || obj["POSTO/GRAD. CARGO"] || obj["POSTO/GRAD."] || obj["POSTO"] || obj["CARGO"] || obj["Posto/Grad."] || obj["Posto"] || obj["Cargo"] || "";
    if (puestoVal) {
      obj["POSTO/GRAD.  CARGO"] = puestoVal;
      obj["POSTO/GRAD. CARGO"] = puestoVal;
    }

    const siglaVal = obj["SIGLA DIVISÃO"] || obj["SIGLA DIVISAO"] || obj["SIGLA"] || obj["Sigla"] || obj["DIVISÃO"] || obj["DIVISAO"] || obj["Divisão"] || "";
    if (siglaVal) {
      obj["SIGLA DIVISÃO"] = siglaVal;
    }

    const divVal = obj["DIVISÃO"] || obj["DIVISAO"] || obj["Divisão"] || siglaVal || "";
    if (divVal) {
      obj["DIVISÃO"] = divVal;
    }

    const genVal = obj["GÊNERO"] || obj["GENERO"] || obj["Gênero"] || obj["Genero"] || obj["SEXO"] || obj["Sexo"] || "";
    if (genVal) {
      obj["GÊNERO"] = genVal;
    }

    const tipoVal = obj["TIPO"] || obj["Tipo"] || obj["VÍNCULO"] || obj["Vinculo"] || "";
    if (tipoVal) {
      obj["TIPO"] = tipoVal;
    }

    const fppVal = obj["FPP/FCE"] || obj["FPP"] || obj["FCE"] || obj["GRATIFICAÇÃO"] || obj["Gratificação"] || obj["FPP / FCE"] || "";
    if (fppVal) {
      obj["FPP/FCE"] = fppVal;
    }

    const telVal = obj["TELEFONE"] || obj["Telefone"] || obj["CONTATO"] || obj["Contato"] || obj["E-MAIL"] || obj["Email"] || "";
    if (telVal) {
      obj["TELEFONE"] = telVal;
    }

    const guerraVal = obj["NOME DE GUERRA"] || obj["GUERRA"] || obj["Guerra"] || obj["Nome de Guerra"] || "";
    if (guerraVal) {
      obj["NOME DE GUERRA"] = guerraVal;
    }

    // Number sequentially based on valid member index ("01", "02", ..., "317")
    const formattedNum = String(records.length + 1).padStart(2, "0");
    obj["Nº"] = formattedNum;
    obj["N°"] = formattedNum;
    obj["identificador"] = formattedNum;

    records.push(obj);
  }

  return {
    spreadsheetTitle,
    sheetName,
    totalRows: records.length,
    records,
  };
}

// Export records to a new Google Spreadsheet
export async function createGoogleSpreadsheet(
  title: string,
  records: any[],
  accessToken: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  if (!records || records.length === 0) {
    throw new Error("Nenhum registro para exportar.");
  }

  // 1. Determine headers
  const headerSet = new Set<string>();
  // Default main headers in preferred order
  const priorityHeaders = [
    "Nº",
    "TIPO",
    "POSTO/GRAD.  CARGO",
    "QPM",
    "NOME",
    "RG",
    "ID-META4",
    "CPF",
    "NOME DE GUERRA",
    "DATA DE INCLUSÃO",
    "DIVISÃO",
    "SIGLA DIVISÃO",
    "DATA DE NASCIMENTO",
    "GÊNERO",
    "E-MAIL",
    "TELEFONE",
  ];

  records.forEach((r) => {
    Object.keys(r).forEach((k) => headerSet.add(k));
  });

  const allKeys = Array.from(headerSet);
  const orderedHeaders = [
    ...priorityHeaders.filter((h) => headerSet.has(h)),
    ...allKeys.filter((k) => !priorityHeaders.includes(k)),
  ];

  // 2. Build values matrix
  const values: any[][] = [orderedHeaders];

  records.forEach((r) => {
    const row = orderedHeaders.map((h) => {
      const val = r[h];
      if (val === null || val === undefined) return "";
      return String(val);
    });
    values.push(row);
  });

  // 3. Create Spreadsheet via API
  const createRes = await fetch(
    "https://sheets.googleapis.com/v4/spreadsheets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: title || `Efetivo Casa Militar - ${new Date().toLocaleDateString("pt-BR")}`,
        },
        sheets: [
          {
            properties: {
              title: "EFETIVO TOTAL CM",
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(
      err.error?.message || "Falha ao criar nova planilha no Google Sheets."
    );
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl = createdData.spreadsheetUrl;

  // 4. Update values
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'EFETIVO TOTAL CM'!A1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: "'EFETIVO TOTAL CM'!A1",
        majorDimension: "ROWS",
        values,
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(
      err.error?.message || "Falha ao preencher dados na planilha do Google."
    );
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
  };
}
