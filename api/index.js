import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://jybjzbtgpnhkdyofayji.supabase.co";
const supabaseKey = process.env.SUPABASE_SECRET_KEY || "sb_secret_UIkjVs1M3xJP2EgPXqRjdw_zC88aiJg";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url, method } = req;
  const path = url.replace(/\?.*$/, ""); // Remove query params for matching

  try {
    // GET /api/invoices
    if (path === "/api/invoices" && method === "GET") {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const invoices = (data || []).map((row) => ({
        rowIndex: 0,
        id: row.id,
        date: row.date,
        customerName: row.customer_name,
        customerEmail: row.customer_email || "",
        hotelName: row.hotel_name || "",
        totalAmount: Number(row.total_amount || 0),
        amountPaid: Number(row.amount_paid || 0),
        paymentDate: row.payment_date || "",
        balance: Number(row.balance || 0),
        status: row.status || "Pending",
        notes: row.notes || "",
        items: row.items || [],
        payments: row.payments || [],
      }));

      return res.status(200).json(invoices);
    }

    // POST /api/invoices
    if (path === "/api/invoices" && method === "POST") {
      const inv = req.body;
      if (!inv.id || !inv.date || !inv.customerName) {
        return res.status(400).json({ error: "Missing required invoice fields" });
      }

      const { data, error } = await supabase
        .from("invoices")
        .insert({
          id: inv.id,
          date: inv.date,
          customer_name: inv.customerName,
          customer_email: inv.customerEmail || "",
          hotel_name: inv.hotelName || "",
          total_amount: Number(inv.totalAmount || 0),
          amount_paid: Number(inv.amountPaid || 0),
          payment_date: inv.paymentDate || "",
          balance: Number(inv.balance || 0),
          status: inv.status || "Pending",
          notes: inv.notes || "",
          items: inv.items || [],
          payments: inv.payments || [],
        })
        .select();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    // PUT /api/invoices/:id
    const putMatch = path.match(/^\/api\/invoices\/(.+)$/);
    if (putMatch && method === "PUT") {
      const id = putMatch[1];
      const inv = req.body;

      const { data, error } = await supabase
        .from("invoices")
        .update({
          date: inv.date,
          customer_name: inv.customerName,
          customer_email: inv.customerEmail || "",
          hotel_name: inv.hotelName || "",
          total_amount: Number(inv.totalAmount || 0),
          amount_paid: Number(inv.amountPaid || 0),
          payment_date: inv.paymentDate || "",
          balance: Number(inv.balance || 0),
          status: inv.status || "Pending",
          notes: inv.notes || "",
          items: inv.items || [],
          payments: inv.payments || [],
        })
        .eq("id", id)
        .select();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    // DELETE /api/invoices/:id
    const deleteMatch = path.match(/^\/api\/invoices\/(.+)$/);
    if (deleteMatch && method === "DELETE") {
      const id = deleteMatch[1];
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // GET /api/settings/:uid
    const settingsGetMatch = path.match(/^\/api\/settings\/(.+)$/);
    if (settingsGetMatch && method === "GET") {
      const uid = settingsGetMatch[1];
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("firebase_uid", uid)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return res.status(200).json(data || null);
    }

    // POST /api/settings
    if (path === "/api/settings" && method === "POST") {
      const settings = req.body;
      if (!settings.firebase_uid) {
        return res.status(400).json({ error: "Missing firebase_uid" });
      }

      const { data: existing } = await supabase
        .from("user_settings")
        .select("id")
        .eq("firebase_uid", settings.firebase_uid)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("user_settings")
          .update({ ...settings, updated_at: new Date().toISOString() })
          .eq("firebase_uid", settings.firebase_uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_settings")
          .insert({
            ...settings,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      }

      return res.status(200).json({ success: true });
    }

    // POST /api/sync-booking-sheet
    if (path === "/api/sync-booking-sheet" && method === "POST") {
      const { invoiceId, customerName, items, spreadsheetId, sheetName, accessToken } = req.body;

      if (!invoiceId || !customerName || !items || !spreadsheetId || !sheetName || !accessToken) {
        return res.status(400).json({ error: "Missing required fields for sheet sync" });
      }

      let cleanSpreadsheetId = spreadsheetId.trim();
      if (cleanSpreadsheetId.includes("docs.google.com/spreadsheets")) {
        const matches = cleanSpreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (matches && matches[1]) {
          cleanSpreadsheetId = matches[1];
        }
      }

      const sheetRange = `'${sheetName}'!A:H`;
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}/values/${encodeURIComponent(sheetRange)}`;

      const readResponse = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      let nextId = 1;
      if (readResponse.ok) {
        const readData = await readResponse.json();
        const existingRows = readData.values || [];
        for (let i = 1; i < existingRows.length; i++) {
          const row = existingRows[i];
          if (row && row[3]) {
            const idNum = parseInt(row[3], 10);
            if (!isNaN(idNum) && idNum >= nextId) {
              nextId = idNum + 1;
            }
          }
        }
      } else {
        const errBody = await readResponse.text();
        throw new Error(`Failed to read spreadsheet (${readResponse.status}): ${errBody}`);
      }

      // Delete existing rows for this invoice
      const fullReadResponse = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (fullReadResponse.ok) {
        const fullData = await fullReadResponse.json();
        const allRows = fullData.values || [];

        const sheetMetaResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (sheetMetaResponse.ok) {
          const sheetMeta = await sheetMetaResponse.json();
          const targetSheet = sheetMeta.sheets?.find((s) => s.properties?.title === sheetName);
          const sheetId = targetSheet?.properties?.sheetId || 0;

          const rowsToDelete = [];
          for (let i = 1; i < allRows.length; i++) {
            if (allRows[i] && allRows[i][5] === invoiceId) {
              rowsToDelete.push(i);
            }
          }

          if (rowsToDelete.length > 0) {
            const deleteRequests = rowsToDelete
              .sort((a, b) => b - a)
              .map((rowIdx) => ({
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: rowIdx,
                    endIndex: rowIdx + 1,
                  },
                },
              }));

            await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}:batchUpdate`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ requests: deleteRequests }),
              }
            );

            const reReadResponse = await fetch(readUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (reReadResponse.ok) {
              const reReadData = await reReadResponse.json();
              const remainingRows = reReadData.values || [];
              nextId = 1;
              for (let i = 1; i < remainingRows.length; i++) {
                const row = remainingRows[i];
                if (row && row[3]) {
                  const idNum = parseInt(row[3], 10);
                  if (!isNaN(idNum) && idNum >= nextId) {
                    nextId = idNum + 1;
                  }
                }
              }
            }
          }
        }
      }

      // Build new rows
      const newRows = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const formatDate = (dateStr) => {
          if (!dateStr) return "";
          try {
            const d = new Date(dateStr);
            return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
          } catch {
            return dateStr;
          }
        };

        newRows.push([
          formatDate(item.checkIn),
          formatDate(item.checkOut),
          String(item.nights || 1),
          String(nextId + i),
          customerName,
          invoiceId,
          String(item.quantity || 1),
          item.roomType || "",
        ]);
      }

      // Append new rows
      if (newRows.length > 0) {
        const appendRange = encodeURIComponent(`'${sheetName}'!A1`);
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`;

        const appendResponse = await fetch(appendUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: newRows }),
        });

        if (!appendResponse.ok) {
          const errorData = await appendResponse.json().catch(() => ({}));
          throw new Error(errorData.error?.message || "Failed to append booking rows");
        }
      }

      return res.status(200).json({ success: true, rowsAdded: newRows.length, startId: nextId });
    }

    // GET /api/lookup-invoice/:invoiceNumber
    const lookupMatch = path.match(/^\/api\/lookup-invoice\/(.+)$/);
    if (lookupMatch && method === "GET") {
      const invoiceNumber = decodeURIComponent(lookupMatch[1]);
      if (!invoiceNumber || !invoiceNumber.trim()) {
        return res.status(400).json({ error: "Invoice number is required" });
      }

      const { data: settingsData, error: settingsError } = await supabase
        .from("user_settings")
        .select("*")
        .limit(1)
        .single();

      if (settingsError || !settingsData) {
        return res.status(500).json({ error: "No spreadsheet configuration found. Admin needs to connect a spreadsheet in Settings." });
      }

      const spreadsheetSettings = settingsData.spreadsheet_settings;
      const accessToken = settingsData.firebase_token;

      if (!spreadsheetSettings || !spreadsheetSettings.spreadsheetId) {
        return res.status(500).json({ error: "No spreadsheet connected. Admin needs to configure the spreadsheet in Settings." });
      }

      if (!accessToken) {
        return res.status(500).json({ error: "No access token available. Admin needs to sign in to refresh the connection." });
      }

      const spreadsheetId = spreadsheetSettings.spreadsheetId;
      const sheetRange = encodeURIComponent("'MASTER'!A:J");
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetRange}`;

      const sheetResponse = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!sheetResponse.ok) {
        const errBody = await sheetResponse.text();
        if (sheetResponse.status === 401 || sheetResponse.status === 403) {
          return res.status(401).json({ error: "Access token expired. Admin needs to sign in again." });
        }
        return res.status(500).json({ error: `Failed to read spreadsheet (${sheetResponse.status})` });
      }

      const sheetData = await sheetResponse.json();
      const allRows = sheetData.values || [];

      if (allRows.length === 0) {
        return res.status(200).json({ invoiceNumber, rows: [], total: 0 });
      }

      const refValue = `REF-${invoiceNumber.trim()}`;
      const matchingRows = [];
      let totalDue = 0;

      for (let i = 1; i < allRows.length; i++) {
        const row = allRows[i];
        if (!row || row.length === 0) continue;

        const refCol = (row[9] || "").trim();
        if (refCol === refValue) {
          matchingRows.push({
            room: row[0] || "",
            checkIn: row[1] || "",
            checkout: row[2] || "",
            nights: parseInt(row[3]) || 0,
            roomPrice: parseFloat(row[4]) || 0,
            total: parseFloat(row[5]) || 0,
            sum: parseFloat(row[6]) || 0,
            due: parseFloat(row[7]) || 0,
            group: row[8] || "",
            ref: row[9] || "",
          });
          totalDue += parseFloat(row[7]) || 0;
        }
      }

      let grandTotal = 0;
      for (const row of matchingRows) {
        grandTotal += row.total;
      }

      return res.status(200).json({
        invoiceNumber,
        refValue,
        group: matchingRows.length > 0 ? matchingRows[0].group : "",
        rows: matchingRows,
        totalAmount: grandTotal,
        totalDue,
        headers: ["Room", "Check In", "Checkout", "Nights", "Room Price", "Total", "Sum", "DUE", "GROUP", "REF#"],
      });
    }

    // Route not found
    return res.status(404).json({ error: "API route not found" });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
