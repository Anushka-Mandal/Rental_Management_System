import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// Railway-compatible MySQL connection using environment variables
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || " ",
    database: process.env.MYSQL_DATABASE || "railway",
    port: process.env.MYSQL_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
app.get("/test-db", async (req, res) => {
    try {
        const [rows] = await pool.query("SHOW TABLES");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Root route
app.get("/", (req, res) => {
    res.json({
        message: "Rental Management System API",
        status: "running",
        version: "1.0.0",
        endpoints: {
            health: "/health",
            testDb: "/test-db",
            owners: "/Owner",
            properties: "/Property",
            rooms: "/Room",
            tenants: "/Tenant",
            staff: "/Staff",
            payments: "/Payment",
            serviceRequests: "/ServiceRequest",
            feedback: "/Feedback"
        }
    });
});

// Health check endpoint for Railway
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// -------------------- ROUTES --------------------

// --- Owner ---
app.get("/Owner", async (req, res) => {
    try {
        const [data] = await pool.query("SELECT * FROM Owner");
        res.json(data);
    } catch (err) {
        res.status(500).json(err);
    }
});

// Owner login endpoint
app.post("/Owner/login", async (req, res) => {
    console.log("[Owner Login] Request body:", req.body);
    const { name, ownerID } = req.body;
    if (!name || !ownerID) {
        console.log("[Owner Login] Missing fields:", { name: !!name, ownerID: !!ownerID });
        return res.status(400).json({ error: "Name and OwnerID are required" });
    }
    const q = "SELECT * FROM Owner WHERE OwnerID = ? AND name = ?";
    console.log("[Owner Login] Executing query:", q);
    console.log("[Owner Login] Parameters:", [ownerID, name]);
    try {
        const [results] = await pool.query(q, [ownerID, name]);
        if (results.length === 0) {
            console.log("[Owner Login] No matching owner found");
            return res.status(401).json({ error: "Invalid owner credentials" });
        }
        console.log("[Owner Login] Found owner:", results[0]);
        res.json({ owner: results[0] });
    } catch (err) {
        console.error("[Owner Login] Database error:", err);
        res.status(500).json(err);
    }
});

app.post("/Owner", async (req, res) => {
    const { OwnerID, name, phone, email, address } = req.body;
    if (!OwnerID || !name || !phone || !email || !address) {
        return res.status(400).json({ error: "All fields are required" });
    }
    const q = "INSERT INTO Owner (OwnerID, name, phone, email, address) VALUES (?, ?, ?, ?, ?)";
    try {
        const [result] = await pool.query(q, [OwnerID, name, phone, email, address]);
        res.json({ message: "Owner added successfully", id: OwnerID });
    } catch (err) {
        res.status(500).json(err);
    }
});

// --- Property ---
app.get("/Property", async (req, res) => {
    try {
        const [data] = await pool.query("SELECT * FROM Property");
        res.json(data);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post("/Property", async (req, res) => {
    const { name, location, TotalRooms, OwnerID } = req.body;

    if (!name || !location || !TotalRooms || !OwnerID) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const q = "INSERT INTO Property (name, location, TotalRooms, OwnerID) VALUES (?, ?, ?, ?)";
    const params = [name, location, TotalRooms, OwnerID];

    try {
        const [result] = await pool.query(q, params);
        res.json({
            message: "Property added successfully",
            PropertyID: result.insertId,
        });
    } catch (err) {
        if (err.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({ error: "Invalid OwnerID provided" });
        }
        return res.status(500).json({ error: "Failed to add property" });
    }
});

// Update Property
app.put("/Property/:id", async (req, res) => {
    const { id } = req.params;
    const { name, location, TotalRooms, OwnerID } = req.body;

    if (!name || !location || !TotalRooms || !OwnerID) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const q = `
        UPDATE Property 
        SET name = ?, location = ?, TotalRooms = ?, OwnerID = ?
        WHERE PropertyID = ?
    `;

    try {
        const [result] = await pool.query(q, [name, location, TotalRooms, OwnerID, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Property not found" });
        }
        res.json({ message: "Property updated successfully" });
    } catch (err) {
        console.error("[PUT /Property/:id] Error:", err);
        res.status(500).json({ error: "Failed to update property" });
    }
});

// Delete Property
app.delete("/Property/:id", async (req, res) => {
    const { id } = req.params;

    try {
        // First delete all rooms associated with this property
        await pool.query(`DELETE FROM Room WHERE PropertyID = ?`, [id]);

        // Then delete the property
        const [result] = await pool.query(`DELETE FROM Property WHERE PropertyID = ?`, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Property not found" });
        }
        res.json({ message: "Property and all associated rooms deleted successfully" });
    } catch (err) {
        console.error("[DELETE /Property/:id] Error:", err);
        res.status(500).json({ error: "Failed to delete property" });
    }
});

// --- Room ---
app.get("/Room", async (req, res) => {
    try {
        const [data] = await pool.query("SELECT * FROM Room");
        res.json(data);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post("/Room", async (req, res) => {
    const { BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID } = req.body;
    const q = "INSERT INTO Room (BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID) VALUES (?, ?, ?, ?, ?)";
    try {
        const [result] = await pool.query(q, [BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID]);
        res.json({ message: "Room added", RoomID: result.insertId });
    } catch (err) {
        res.status(500).json(err);
    }
});

// Update room
app.put("/Room/:id", async (req, res) => {
    const { id } = req.params;
    const { BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID } = req.body;
    const q = "UPDATE Room SET BedCount = ?, OccupiedBeds = ?, RentAmount = ?, RoomType = ?, PropertyID = ? WHERE RoomID = ?";
    try {
        const [result] = await pool.query(q, [BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID, id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Room not found" });
        res.json({ message: "Room updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update room" });
    }
});

// Delete room
app.delete("/Room/:id", async (req, res) => {
    const { id } = req.params;
    const q = "DELETE FROM Room WHERE RoomID = ?";
    try {
        const [result] = await pool.query(q, [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Room not found" });
        res.json({ message: "Room deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete room" });
    }
});

// --- Tenant total rent due (via SQL function) ---
app.get("/Tenant/:id/TotalDue", async (req, res) => {
    const { id } = req.params;
    const q = "SELECT GetTotalRentDue(?) AS TotalDue";
    try {
        const [result] = await pool.query(q, [id]);
        res.json({ TotalDue: result[0]?.TotalDue || 0 });
    } catch (err) {
        console.error("[GET /Tenant/:id/TotalDue] Error:", err);
        res.status(500).json({ error: "Error fetching total rent due" });
    }
});

// --- Tenant ---
app.get("/Tenant", async (req, res) => {
    const query = `
        SELECT 
            t.TenantID,
            tn.FirstName,
            tn.MiddleName,
            tn.LastName,
            t.CheckInDate,
            t.CheckOutDate,
            t.PaymentStatus,
            t.RoomID,
            t.OwnerID,
            COALESCE(GROUP_CONCAT(DISTINCT tp.tenant_Phone SEPARATOR ', '), '') AS Phones,
            COALESCE(GROUP_CONCAT(DISTINCT te.tenant_Email SEPARATOR ', '), '') AS Emails,
            COALESCE(GROUP_CONCAT(DISTINCT tp.tenant_Phone SEPARATOR ', '), '') AS Contact,
            COALESCE(GROUP_CONCAT(DISTINCT te.tenant_Email SEPARATOR ', '), '') AS Email
        FROM Tenant t
        LEFT JOIN Tenant_Name tn ON t.TenantID = tn.TenantID
        LEFT JOIN tenant_Phone tp ON t.TenantID = tp.TenantID
        LEFT JOIN tenant_Email te ON t.TenantID = te.TenantID
        GROUP BY t.TenantID
    `;

    try {
        const [result] = await pool.query(query);
        res.json(result);
    } catch (err) {
        console.error("[GET /Tenant] Error:", err);
        res.status(500).json({ error: "Failed to fetch tenants" });
    }
});

app.post("/Tenant", async (req, res) => {
    const {
        firstName,
        middleName = '',
        lastName,
        phones = [],
        emails = [],
        CheckInDate,
        CheckOutDate,
        PaymentStatus = 'Pending',
        RoomID,
        OwnerID
    } = req.body;

    if (!firstName || !lastName || !Array.isArray(phones) || phones.length === 0 ||
        !Array.isArray(emails) || emails.length === 0 || !CheckInDate || !RoomID || !OwnerID) {
        return res.status(400).json({
            error: "Missing required fields: firstName, lastName, phones, emails, CheckInDate, RoomID, OwnerID"
        });
    }

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const qTenant = "INSERT INTO Tenant (CheckInDate, CheckOutDate, PaymentStatus, RoomID, OwnerID) VALUES (?, ?, ?, ?, ?)";
        const [result] = await connection.query(qTenant, [CheckInDate, CheckOutDate, PaymentStatus, RoomID, OwnerID]);
        const newTenantID = result.insertId;

        const qName = "INSERT INTO Tenant_Name (TenantID, FirstName, MiddleName, LastName) VALUES (?, ?, ?, ?)";
        await connection.query(qName, [newTenantID, firstName, middleName, lastName]);

        for (const phone of phones) {
            await connection.query("INSERT INTO tenant_Phone (TenantID, tenant_Phone) VALUES (?, ?)", [newTenantID, phone]);
        }

        for (const email of emails) {
            await connection.query("INSERT INTO tenant_Email (TenantID, tenant_Email) VALUES (?, ?)", [newTenantID, email]);
        }

        await connection.commit();

        const fetchQuery = `
            SELECT 
                t.TenantID, tn.FirstName, tn.MiddleName, tn.LastName,
                t.CheckInDate, t.CheckOutDate, t.PaymentStatus, t.RoomID, t.OwnerID,
                COALESCE(GROUP_CONCAT(DISTINCT tp.tenant_Phone SEPARATOR ', '), '') AS Phones,
                COALESCE(GROUP_CONCAT(DISTINCT te.tenant_Email SEPARATOR ', '), '') AS Emails,
                COALESCE(GROUP_CONCAT(DISTINCT tp.tenant_Phone SEPARATOR ', '), '') AS Contact,
                COALESCE(GROUP_CONCAT(DISTINCT te.tenant_Email SEPARATOR ', '), '') AS Email
            FROM Tenant t
            LEFT JOIN Tenant_Name tn ON t.TenantID = tn.TenantID
            LEFT JOIN tenant_Phone tp ON t.TenantID = tp.TenantID
            LEFT JOIN tenant_Email te ON t.TenantID = te.TenantID
            WHERE t.TenantID = ?
            GROUP BY t.TenantID
        `;
        const [rows] = await connection.query(fetchQuery, [newTenantID]);
        res.json({ message: "Tenant added successfully", tenant: rows[0] });
    } catch (err) {
        await connection.rollback();
        console.error("[Tenant POST] Error:", err);
        if (err.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({ error: "Invalid RoomID or OwnerID" });
        }
        res.status(500).json({ error: "Failed to add tenant" });
    } finally {
        connection.release();
    }
});

// Update tenant
app.put('/Tenant/:tenantID', async (req, res) => {
    const tenantID = req.params.tenantID;
    const {
        firstName,
        middleName = '',
        lastName,
        phones = [],
        emails = [],
        CheckInDate,
        CheckOutDate,
        PaymentStatus = 'Pending',
        RoomID,
        OwnerID
    } = req.body;

    if (!firstName || !lastName || !Array.isArray(phones) || !Array.isArray(emails) || !CheckInDate || !RoomID) {
        return res.status(400).json({ error: 'Missing required fields for update' });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        await connection.query(
            `UPDATE Tenant SET CheckInDate = ?, CheckOutDate = ?, PaymentStatus = ?, RoomID = ?, OwnerID = ? WHERE TenantID = ?`,
            [CheckInDate, CheckOutDate, PaymentStatus, RoomID, OwnerID, tenantID]
        );

        await connection.query(
            `UPDATE Tenant_Name SET FirstName = ?, MiddleName = ?, LastName = ? WHERE TenantID = ?`,
            [firstName, middleName, lastName, tenantID]
        );

        await connection.query(`DELETE FROM tenant_Phone WHERE TenantID = ?`, [tenantID]);
        await connection.query(`DELETE FROM tenant_Email WHERE TenantID = ?`, [tenantID]);

        for (const phone of phones) {
            await connection.query('INSERT INTO tenant_Phone (TenantID, tenant_Phone) VALUES (?, ?)', [tenantID, phone]);
        }

        for (const email of emails) {
            await connection.query('INSERT INTO tenant_Email (TenantID, tenant_Email) VALUES (?, ?)', [tenantID, email]);
        }

        await connection.commit();

        const fetchQuery = `
            SELECT 
                t.TenantID, tn.FirstName, tn.MiddleName, tn.LastName,
                t.CheckInDate, t.CheckOutDate, t.PaymentStatus, t.RoomID, t.OwnerID,
                COALESCE(GROUP_CONCAT(DISTINCT tp.tenant_Phone SEPARATOR ', '), '') AS Phones,
                COALESCE(GROUP_CONCAT(DISTINCT te.tenant_Email SEPARATOR ', '), '') AS Emails,
                COALESCE(GROUP_CONCAT(DISTINCT tp.tenant_Phone SEPARATOR ', '), '') AS Contact,
                COALESCE(GROUP_CONCAT(DISTINCT te.tenant_Email SEPARATOR ', '), '') AS Email
            FROM Tenant t
            LEFT JOIN Tenant_Name tn ON t.TenantID = tn.TenantID
            LEFT JOIN tenant_Phone tp ON t.TenantID = tp.TenantID
            LEFT JOIN tenant_Email te ON t.TenantID = te.TenantID
            WHERE t.TenantID = ?
            GROUP BY t.TenantID
        `;
        const [rows] = await connection.query(fetchQuery, [tenantID]);
        res.json({ message: 'Tenant updated successfully', tenant: rows[0] });
    } catch (err) {
        await connection.rollback();
        console.error('[PUT /Tenant/:tenantID] Error:', err);
        res.status(500).json({ error: 'Failed to update tenant' });
    } finally {
        connection.release();
    }
});

// Patch tenant payment status
app.patch('/Tenant/:tenantID/status', async (req, res) => {
    const tenantID = req.params.tenantID;
    const { PaymentStatus } = req.body;
    if (!PaymentStatus) return res.status(400).json({ error: 'PaymentStatus required' });
    
    try {
        const [result] = await pool.query('UPDATE Tenant SET PaymentStatus = ? WHERE TenantID = ?', [PaymentStatus, tenantID]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Tenant not found' });
        res.json({ message: 'PaymentStatus updated' });
    } catch (err) {
        console.error('[PATCH /Tenant/:tenantID/status] Error:', err);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
});

// Delete tenant
app.delete('/Tenant/:tenantID', async (req, res) => {
    const tenantID = req.params.tenantID;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        await connection.query(`DELETE FROM tenant_Phone WHERE TenantID = ?`, [tenantID]);
        await connection.query(`DELETE FROM tenant_Email WHERE TenantID = ?`, [tenantID]);
        await connection.query(`DELETE FROM Tenant_Name WHERE TenantID = ?`, [tenantID]);
        const [result] = await connection.query(`DELETE FROM Tenant WHERE TenantID = ?`, [tenantID]);
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Tenant not found' });
        }
        
        await connection.commit();
        res.json({ message: 'Tenant deleted successfully' });
    } catch (err) {
        await connection.rollback();
        console.error('[DELETE /Tenant/:tenantID] Error:', err);
        res.status(500).json({ error: 'Failed to delete tenant' });
    } finally {
        connection.release();
    }
});

// Tenant login
app.post("/Tenant/login", async (req, res) => {
    const { name, tenantID } = req.body;

    console.log('[Tenant Login] Request body:', req.body);

    if (!name || !tenantID) {
        return res.status(400).json({ error: "Name and TenantID are required" });
    }

    const q = `
      SELECT 
        t.TenantID, tn.FirstName, tn.MiddleName, tn.LastName,
        t.CheckInDate, t.CheckOutDate, t.PaymentStatus, t.RoomID, t.OwnerID,
        COALESCE(GROUP_CONCAT(DISTINCT tp.tenant_Phone SEPARATOR ', '), '') AS Phones,
        COALESCE(GROUP_CONCAT(DISTINCT te.tenant_Email SEPARATOR ', '), '') AS Emails,
        COALESCE(GROUP_CONCAT(DISTINCT tp.tenant_Phone SEPARATOR ', '), '') AS Contact,
        COALESCE(GROUP_CONCAT(DISTINCT te.tenant_Email SEPARATOR ', '), '') AS Email
      FROM Tenant t
      LEFT JOIN Tenant_Name tn ON t.TenantID = tn.TenantID
      LEFT JOIN tenant_Phone tp ON t.TenantID = tp.TenantID
      LEFT JOIN tenant_Email te ON t.TenantID = te.TenantID
      WHERE t.TenantID = ? AND CONCAT_WS(' ', tn.FirstName, tn.MiddleName, tn.LastName) = ?
      GROUP BY t.TenantID
      LIMIT 1
    `;

    try {
        const [results] = await pool.query(q, [tenantID, name]);
        if (!results || results.length === 0) {
            console.log('[Tenant Login] Login failed for TenantID:', tenantID, 'name:', name);
            return res.status(401).json({ error: "Invalid tenant credentials" });
        }
        console.log('[Tenant Login] Login successful for TenantID:', tenantID);
        res.json({ tenant: results[0] });
    } catch (err) {
        console.error('[Tenant Login] Database error:', err);
        res.status(500).json({ error: 'Database error during tenant login' });
    }
});

// Get all tenant data
app.get("/Tenant/:tenantID/all", async (req, res) => {
    const tenantID = req.params.tenantID;
    console.log("[GET /Tenant/:tenantID/all] Fetching data for tenant:", tenantID);

    const tenantQuery = `
      SELECT 
        t.TenantID, tn.FirstName, tn.MiddleName, tn.LastName,
        CONCAT_WS(' ', tn.FirstName, tn.MiddleName, tn.LastName) AS FullName,
        t.CheckInDate, t.CheckOutDate, t.PaymentStatus, t.RoomID, t.OwnerID,
        COALESCE(GROUP_CONCAT(DISTINCT tp.tenant_Phone SEPARATOR ', '), '') AS Phones,
        COALESCE(GROUP_CONCAT(DISTINCT te.tenant_Email SEPARATOR ', '), '') AS Emails,
        COALESCE(GROUP_CONCAT(DISTINCT tp.tenant_Phone SEPARATOR ', '), '') AS Contact,
        COALESCE(GROUP_CONCAT(DISTINCT te.tenant_Email SEPARATOR ', '), '') AS Email
      FROM Tenant t
      LEFT JOIN Tenant_Name tn ON t.TenantID = tn.TenantID
      LEFT JOIN tenant_Phone tp ON t.TenantID = tp.TenantID
      LEFT JOIN tenant_Email te ON t.TenantID = te.TenantID
      WHERE t.TenantID = ?
      GROUP BY t.TenantID
      LIMIT 1
    `;

    try {
        const [tenantRows] = await pool.query(tenantQuery, [tenantID]);
        const [payments] = await pool.query("SELECT * FROM Payment WHERE TenantID = ?", [tenantID]);
        const [requests] = await pool.query("SELECT * FROM ServiceRequest WHERE TenantID = ?", [tenantID]);
        const [feedbacks] = await pool.query("SELECT * FROM Feedback WHERE TenantID = ?", [tenantID]);

        const tenant = tenantRows && tenantRows.length ? tenantRows[0] : null;
        if (!tenant) {
            return res.status(404).json({ error: "Tenant not found" });
        }

        res.json({ tenant, payments, requests, feedbacks });
    } catch (err) {
        console.error("[GET /Tenant/:tenantID/all] Error:", err);
        res.status(500).json({ error: "Failed to fetch tenant data", details: err.message });
    }
});

// --- Staff ---
app.get("/Staff", async (req, res) => {
    const q = `
        SELECT StaffID, name, role, contact, AvailabilityStatus 
        FROM Staff 
        WHERE AvailabilityStatus = 'Available' 
        ORDER BY name
    `;
    
    try {
        const [data] = await pool.query(q);
        res.json(data);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post("/Staff", async (req, res) => {
    const { StaffID, name, role, contact, AvailabilityStatus } = req.body;
    const q = "INSERT INTO Staff (StaffID, name, role, contact, AvailabilityStatus) VALUES (?, ?, ?, ?, ?)";
    try {
        await pool.query(q, [StaffID, name, role, contact, AvailabilityStatus]);
        res.json({ message: "Staff added", id: StaffID });
    } catch (err) {
        res.status(500).json(err);
    }
});

// --- Payment ---
app.get("/Payment", async (req, res) => {
    try {
        const [data] = await pool.query("SELECT * FROM Payment");
        res.json(data);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post("/Payment", async (req, res) => {
    const { TenantID, PaymentMode } = req.body;

    if (!TenantID || !PaymentMode) {
        return res.status(400).json({ error: "TenantID and PaymentMode are required" });
    }

    try {
        const [result] = await pool.query("SELECT GetTotalRentDue(?) AS TotalDue", [TenantID]);
        const totalDue = result[0]?.TotalDue || 0;
        const date = new Date();

        await pool.query(
            `INSERT INTO Payment (TenantID, Amount, Date, PaymentMode, Status) VALUES (?, ?, ?, ?, 'Paid')`,
            [TenantID, totalDue, date, PaymentMode]
        );

        await pool.query("UPDATE Tenant SET PaymentStatus = 'Paid' WHERE TenantID = ?", [TenantID]);

        res.json({ message: "Payment successful", amount: totalDue });
    } catch (err) {
        console.error("[POST /Payment] Error:", err);
        res.status(500).json({ error: "Failed to process payment" });
    }
});

// --- ServiceRequest ---
app.get("/ServiceRequest", async (req, res) => {
    const { ownerId, tenantId } = req.query;
    let query = `
        SELECT 
            sr.RequestID, sr.Category, sr.Description, sr.Status,
            sr.DateRaised, sr.DateResolved, sr.TenantID,
            CONCAT_WS(' ', tn.FirstName, tn.MiddleName, tn.LastName) as TenantName,
            t.RoomID, t.OwnerID,
            s.StaffID, s.name as StaffName, s.contact as StaffContact, s.role as StaffRole
        FROM ServiceRequest sr
        JOIN Tenant t ON sr.TenantID = t.TenantID
        LEFT JOIN Tenant_Name tn ON t.TenantID = tn.TenantID
        LEFT JOIN Staff s ON sr.StaffID = s.StaffID
    `;

    const params = [];
    if (ownerId) {
        query += " WHERE t.OwnerID = ?";
        params.push(ownerId);
    } else if (tenantId) {
        query += " WHERE sr.TenantID = ?";
        params.push(tenantId);
    }

    query += " ORDER BY sr.DateRaised DESC";

    try {
        const [data] = await pool.query(query, params);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch service requests" });
    }
});

app.post("/ServiceRequest", async (req, res) => {
    const { Category, Description, TenantID, DateRaised } = req.body;

    if (!Category || !Description || !TenantID || !DateRaised) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const q = `
        INSERT INTO ServiceRequest (Category, Description, Status, DateRaised, TenantID)
        VALUES (?, ?, 'Pending', ?, ?)
    `;

    try {
        const [result] = await pool.query(q, [Category, Description, DateRaised, TenantID]);
        res.json({ message: "Service request added successfully", RequestID: result.insertId });
    } catch (err) {
        res.status(500).json({ error: "Failed to add service request" });
    }
});

app.put("/ServiceRequest/:requestId", async (req, res) => {
    const { requestId } = req.params;
    const { Status, StaffID } = req.body;

    let updateFields = [];
    let params = [];

    if (Status) {
        updateFields.push("Status = ?");
        params.push(Status);
    }
    
    if (StaffID !== undefined) {
        updateFields.push("StaffID = ?");
        params.push(StaffID);
    }

    if (Status === 'Completed') {
        updateFields.push("DateResolved = NOW()");
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
    }

    const q = `UPDATE ServiceRequest SET ${updateFields.join(", ")} WHERE RequestID = ?`;
    params.push(requestId);

    try {
        const [result] = await pool.query(q, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Service request not found" });
        }
        res.json({ message: "Service request updated successfully" });
    } catch (err) {
        console.error("Error updating service request:", err);
        res.status(500).json({ error: "Failed to update service request" });
    }
});

app.patch("/ServiceRequest/:requestId/resolve", async (req, res) => {
    const { requestId } = req.params;
    const { DateResolved, StaffID } = req.body;

    if (!DateResolved) {
        return res.status(400).json({ error: "Resolution date is required" });
    }

    const q = `
        UPDATE ServiceRequest 
        SET Status = 'Completed', DateResolved = ?, StaffID = ?
        WHERE RequestID = ?
    `;

    try {
        const [result] = await pool.query(q, [DateResolved, StaffID, requestId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Service request not found" });
        }
        res.json({ message: "Service request resolved" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update service request" });
    }
});

// --- Feedback ---
app.get("/Feedback", async (req, res) => {
    try {
        const [data] = await pool.query("SELECT * FROM Feedback");
        res.json(data);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post("/Feedback", async (req, res) => {
    const { Category, Message, Rating, TenantID } = req.body;
    
    if (!Category || !Message || !Rating || !TenantID) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const q = `
        INSERT INTO Feedback (Category, Message, Rating, TenantID, DateSubmitted)
        VALUES (?, ?, ?, ?, CURDATE())
    `;

    try {
        const [result] = await pool.query(q, [Category, Message, Rating, TenantID]);
        res.json({ message: "Feedback added successfully", FeedbackID: result.insertId });
    } catch (err) {
        console.error("[POST /Feedback] Database error:", err);
        res.status(500).json({ error: "Database error adding feedback" });
    }
});

// -------------------- SERVER --------------------
const PORT = process.env.PORT || 5002;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on port ${PORT}`);
});
