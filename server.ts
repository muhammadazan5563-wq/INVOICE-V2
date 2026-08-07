import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import WebSocket from "ws";

// Polyfill WebSocket for Node.js < 22
(globalThis as any).WebSocket = WebSocket;

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase client using server-side keys
const supabaseUrl = process.env.SUPABASE_URL || "https://jybjzbtgpnhkdyofayji.supabase.co";
const supabaseKey = process.env.SUPABASE_SECRET_KEY || "sb_secret_UIkjVs1M3xJP2EgPXqRjdw_zC88aiJg";

if (!supabaseUrl || !supabaseKey) {
  console.warn("WARNING: Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  realtime: {
    params: {
      eventsPerSecond: 0
    }
  },
  global: {
    headers: {}
  }
});

// GET /api/invoices - Retrieve all invoices from Supabase
app.get("/api/invoices", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Map database snake_case fields to camelCase for the frontend React components
    const invoices = (data || []).map((row) => ({
      rowIndex: 0, // Not strictly needed for database row access, but kept for TS interface compatibility
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
      payments: row.payments || []
    }));

    res.json(invoices);
  } catch (error: any) {
    console.error("Error in GET /api/invoices:", error);
    res.status(500).json({ error: error.message || "Failed to fetch invoices" });
  }
});

// POST /api/invoices - Create a new invoice in Supabase
app.post("/api/invoices", async (req, res) => {
  try {
    const inv = req.body;
    if (!inv.id || !inv.date || !inv.customerName) {
      return res.status(400).json({ error: "Missing required invoice fields (id, date, customerName)" });
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
        payments: inv.payments || []
      })
      .select();

    if (error) {
      throw error;
    }

    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error in POST /api/invoices:", error);
    res.status(500).json({ error: error.message || "Failed to create invoice" });
  }
});

// PUT /api/invoices/:id - Update an existing invoice in Supabase
app.put("/api/invoices/:id", async (req, res) => {
  try {
    const { id } = req.params;
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
        payments: inv.payments || []
      })
      .eq("id", id)
      .select();

    if (error) {
      throw error;
    }

    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error in PUT /api/invoices:", error);
    res.status(500).json({ error: error.message || "Failed to update invoice" });
  }
});

// DELETE /api/invoices/:id - Remove or archive invoice from Supabase
app.delete("/api/invoices/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/invoices:", error);
    res.status(500).json({ error: error.message || "Failed to delete invoice" });
  }
});

// GET /api/settings/:uid - Get user settings
app.get("/api/settings/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("firebase_uid", uid)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    res.json(data || null);
  } catch (error: any) {
    console.error("Error in GET /api/settings:", error);
    res.status(500).json({ error: error.message || "Failed to fetch settings" });
  }
});

// POST /api/settings - Save user settings
app.post("/api/settings", async (req, res) => {
  try {
    const settings = req.body;
    if (!settings.firebase_uid) {
      return res.status(400).json({ error: "Missing firebase_uid" });
    }

    // Check if settings exist
    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .eq("firebase_uid", settings.firebase_uid)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("user_settings")
        .update({
          ...settings,
          updated_at: new Date().toISOString(),
        })
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

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error in POST /api/settings:", error);
    res.status(500).json({ error: error.message || "Failed to save settings" });
  }
});

// POST /api/sync-booking-sheet - Sync room booking details to Google Sheets
app.post("/api/sync-booking-sheet", async (req, res) => {
  try {
    const { invoiceId, customerName, items, spreadsheetId, sheetName, accessToken } = req.body;

    console.log("[sync-booking-sheet] Request received:", { invoiceId, customerName, itemCount: items?.length, spreadsheetId, sheetName, hasToken: !!accessToken });

    if (!invoiceId || !customerName || !items || !spreadsheetId || !sheetName || !accessToken) {
      return res.status(400).json({ error: "Missing required fields for sheet sync (invoiceId, customerName, items, spreadsheetId, sheetName, accessToken)" });
    }

    // Extract spreadsheet ID from URL if full URL is provided
    let cleanSpreadsheetId = spreadsheetId.trim();
    if (cleanSpreadsheetId.includes('docs.google.com/spreadsheets')) {
      const matches = cleanSpreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (matches && matches[1]) {
        cleanSpreadsheetId = matches[1];
      }
    }

    // Use the sheet name directly (no encodeURIComponent for the range parameter in the URL path)
    // Google Sheets API expects the sheet name in single quotes if it contains spaces
    const sheetRange = `'${sheetName}'!A:H`;

    // Step 1: Read existing data to determine the next ID in the series
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}/values/${encodeURIComponent(sheetRange)}`;
    console.log("[sync-booking-sheet] Reading sheet:", readUrl);
    
    const readResponse = await fetch(readUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let nextId = 1;
    if (readResponse.ok) {
      const readData = await readResponse.json();
      const existingRows = readData.values || [];
      console.log("[sync-booking-sheet] Existing rows count:", existingRows.length);
      // Find the highest ID in column D (index 3) - skip header row
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
      console.error("[sync-booking-sheet] Failed to read sheet:", readResponse.status, errBody);
      throw new Error(`Failed to read spreadsheet (${readResponse.status}): ${errBody}`);
    }

    // Step 2: First, delete any existing rows for this invoice (REF # column F, index 5)
    const fullReadResponse = await fetch(readUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (fullReadResponse.ok) {
      const fullData = await fullReadResponse.json();
      const allRows = fullData.values || [];
      
      // Get sheet ID for batch update (delete rows)
      const sheetMetaResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (sheetMetaResponse.ok) {
        const sheetMeta = await sheetMetaResponse.json();
        const targetSheet = sheetMeta.sheets?.find((s: any) => s.properties?.title === sheetName);
        const sheetId = targetSheet?.properties?.sheetId || 0;
        console.log("[sync-booking-sheet] Target sheet ID:", sheetId, "for tab:", sheetName);

        // Find row indices where REF # (column F, index 5) matches invoiceId
        const rowsToDelete: number[] = [];
        for (let i = 1; i < allRows.length; i++) {
          if (allRows[i] && allRows[i][5] === invoiceId) {
            rowsToDelete.push(i); // 0-indexed row (header is 0)
          }
        }

        // Delete rows in reverse order to maintain correct indices
        if (rowsToDelete.length > 0) {
          console.log("[sync-booking-sheet] Deleting", rowsToDelete.length, "existing rows for invoice:", invoiceId);
          const deleteRequests = rowsToDelete
            .sort((a, b) => b - a) // Sort descending
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

          // After deleting, re-read to get the correct next ID
          const reReadResponse = await fetch(readUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
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

    // Step 3: Build new rows from invoice items
    // Headers: CHECK IN | CHECK OUT | TOTAL NIGHTS | ID | Group NAME | REF # | ROOMS | ROOM TYPE
    const newRows: string[][] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Format dates as M/D/YYYY for Google Sheets
      const formatDate = (dateStr: string): string => {
        if (!dateStr) return "";
        try {
          const d = new Date(dateStr);
          return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
        } catch {
          return dateStr;
        }
      };

      newRows.push([
        formatDate(item.checkIn),       // CHECK IN
        formatDate(item.checkOut),      // CHECK OUT
        String(item.nights || 1),       // TOTAL NIGHTS
        String(nextId + i),             // ID (auto-increment series)
        customerName,                   // Group NAME
        invoiceId,                      // REF #
        String(item.quantity || 1),     // ROOMS
        item.roomType || "",            // ROOM TYPE
      ]);
    }

    // Step 4: Append the new rows to the sheet
    if (newRows.length > 0) {
      const appendRange = encodeURIComponent(`'${sheetName}'!A1`);
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`;
      console.log("[sync-booking-sheet] Appending", newRows.length, "rows to:", appendUrl);
      console.log("[sync-booking-sheet] Row data:", JSON.stringify(newRows));

      const appendResponse = await fetch(appendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: newRows,
        }),
      });

      if (!appendResponse.ok) {
        const errorData = await appendResponse.json().catch(() => ({}));
        console.error("[sync-booking-sheet] Append failed:", appendResponse.status, JSON.stringify(errorData));
        throw new Error(errorData.error?.message || "Failed to append booking rows to Google Sheets");
      }

      const appendResult = await appendResponse.json();
      console.log("[sync-booking-sheet] Append success:", JSON.stringify(appendResult));
    }

    res.json({ success: true, rowsAdded: newRows.length, startId: nextId });
  } catch (error: any) {
    console.error("Error in POST /api/sync-booking-sheet:", error);
    res.status(500).json({ error: error.message || "Failed to sync booking details to spreadsheet" });
  }
});

// GET /api/lookup-invoice/:invoiceNumber - Public endpoint to lookup invoice from MASTER sheet
app.get("/api/lookup-invoice/:invoiceNumber", async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    if (!invoiceNumber || !invoiceNumber.trim()) {
      return res.status(400).json({ error: "Invoice number is required" });
    }

    // Normalize the invoice number - strip common prefixes so we can match REF-{number}
    let cleanNumber = invoiceNumber.trim();
    // If user typed "REF-001", strip "REF-" prefix
    if (cleanNumber.toUpperCase().startsWith("REF-")) {
      cleanNumber = cleanNumber.substring(4);
    }
    // If user typed "INV-001", strip "INV-" prefix
    if (cleanNumber.toUpperCase().startsWith("INV-")) {
      cleanNumber = cleanNumber.substring(4);
    }

    // Get the first user's settings to retrieve spreadsheet config and token
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

    // Read from MASTER sheet - columns A:J
    const sheetRange = encodeURIComponent("'MASTER'!A:J");
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetRange}`;

    const sheetResponse = await fetch(readUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!sheetResponse.ok) {
      const errBody = await sheetResponse.text();
      console.error("[lookup-invoice] Failed to read MASTER sheet:", sheetResponse.status, errBody);
      if (sheetResponse.status === 401 || sheetResponse.status === 403) {
        return res.status(401).json({ error: "Access token expired. Admin needs to sign in again to refresh the connection." });
      }
      return res.status(500).json({ error: `Failed to read spreadsheet (${sheetResponse.status})` });
    }

    const sheetData = await sheetResponse.json();
    const allRows: string[][] = sheetData.values || [];

    if (allRows.length === 0) {
      return res.json({ invoiceNumber, rows: [], total: 0 });
    }

    // Headers are in the first row
    const headers = allRows[0] || [];

    // Filter rows where column J (index 9) matches "REF-" + cleanNumber
    const refValue = `REF-${cleanNumber}`;
    const matchingRows: any[] = [];
    let totalDue = 0;

    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];
      if (!row || row.length === 0) continue;

      // Column J is index 9 (REF#)
      const refCol = (row[9] || "").trim();
      if (refCol === refValue) {
        const roomNumber = row[0] || "";
        const checkIn = row[1] || "";
        const checkout = row[2] || "";
        const nights = row[3] || "";
        const roomPrice = row[4] || "";
        const total = row[5] || "";
        const sum = row[6] || "";
        const due = row[7] || "";
        const group = row[8] || "";
        const ref = row[9] || "";

        matchingRows.push({
          room: roomNumber,
          checkIn,
          checkout,
          nights: parseInt(nights) || 0,
          roomPrice: parseFloat(roomPrice) || 0,
          total: parseFloat(total) || 0,
          sum: parseFloat(sum) || 0,
          due: parseFloat(due) || 0,
          group,
          ref,
        });

        totalDue += parseFloat(due) || 0;
      }
    }

    // Calculate grand total from the sum column (first matching row usually has it)
    let grandTotal = 0;
    for (const row of matchingRows) {
      grandTotal += row.total;
    }

    res.json({
      invoiceNumber,
      refValue,
      group: matchingRows.length > 0 ? matchingRows[0].group : "",
      rows: matchingRows,
      totalAmount: grandTotal,
      totalDue,
      headers: ["Room", "Check In", "Checkout", "Nights", "Room Price", "Total", "Sum", "DUE", "GROUP", "REF#"],
    });
  } catch (error: any) {
    console.error("Error in GET /api/lookup-invoice:", error);
    res.status(500).json({ error: error.message || "Failed to lookup invoice" });
  }
});

// Vite Middleware & SPA serving configuration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
