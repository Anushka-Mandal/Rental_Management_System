import express from "express";
import mysql from "mysql2";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// MySQL connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: " ",
    database: "rental_management"
});

const pool = require("./config/db");

app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await pool.query("SHOW TABLES");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


db.connect(err => {
    if (err) {
        console.error("DB connection error:", err);
        return;
    }
    console.log("Connected to MySQL database");
});

// -------------------- ROUTES --------------------

// --- Owner ---
app.get("/Owner", (req, res) => {
    db.query("SELECT * FROM Owner", (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

// Owner login endpoint
app.post("/Owner/login", (req, res) => {
    console.log("[Owner Login] Request body:", req.body);
    const { name, ownerID } = req.body;
    if (!name || !ownerID) {
        console.log("[Owner Login] Missing fields:", { name: !!name, ownerID: !!ownerID });
        return res.status(400).json({ error: "Name and OwnerID are required" });
    }
    const q = "SELECT * FROM Owner WHERE OwnerID = ? AND name = ?";
    console.log("[Owner Login] Executing query:", q);
    console.log("[Owner Login] Parameters:", [ownerID, name]);
    db.query(q, [ownerID, name], (err, results) => {
        if (err) {
            console.error("[Owner Login] Database error:", err);
            return res.status(500).json(err);
        }
        if (results.length === 0) {
            console.log("[Owner Login] No matching owner found");
            return res.status(401).json({ error: "Invalid owner credentials" });
        }
        console.log("[Owner Login] Found owner:", results[0]);
        res.json({ owner: results[0] });
    });
});

app.post("/Owner", (req, res) => {
    const { OwnerID, name, phone, email, address } = req.body;
    if (!OwnerID || !name || !phone || !email || !address) {
        return res.status(400).json({ error: "All fields are required" });
    }
    const q = "INSERT INTO Owner (OwnerID, name, phone, email, address) VALUES (?, ?, ?, ?, ?)";
    db.query(q, [OwnerID, name, phone, email, address], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Owner added successfully", id: OwnerID });
    });
});

// --- Property ---
app.get("/Property", (req, res) => {
    db.query("SELECT * FROM Property", (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

app.post("/Property", (req, res) => {
    const { name, location, TotalRooms, OwnerID } = req.body;

    if (!name || !location || !TotalRooms || !OwnerID) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const q = "INSERT INTO Property (name, location, TotalRooms, OwnerID) VALUES (?, ?, ?, ?)";
    const params = [name, location, TotalRooms, OwnerID];

    db.query(q, params, (err, result) => {
        if (err) {
            if (err.code === "ER_NO_REFERENCED_ROW_2") {
                return res.status(400).json({ error: "Invalid OwnerID provided" });
            }
            return res.status(500).json({ error: "Failed to add property" });
        }
        res.json({
            message: "Property added successfully",
            PropertyID: result.insertId,
        });
    });
});


// --- Room ---
app.get("/Room", (req, res) => {
    db.query("SELECT * FROM Room", (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

app.post("/Room", (req, res) => {
    const { BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID } = req.body;
    const q = "INSERT INTO Room (BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID) VALUES (?, ?, ?, ?, ?)";
    db.query(q, [BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Room added", RoomID: result.insertId });
    });
});

// Update room
app.put("/Room/:id", (req, res) => {
    const { id } = req.params;
    const { BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID } = req.body;
    const q = "UPDATE Room SET BedCount = ?, OccupiedBeds = ?, RentAmount = ?, RoomType = ?, PropertyID = ? WHERE RoomID = ?";
    db.query(q, [BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID, id], (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to update room" });
        if (result.affectedRows === 0) return res.status(404).json({ error: "Room not found" });
        res.json({ message: "Room updated successfully" });
    });
});

// Delete room
app.delete("/Room/:id", (req, res) => {
    const { id } = req.params;
    const q = "DELETE FROM Room WHERE RoomID = ?";
    db.query(q, [id], (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to delete room" });
        if (result.affectedRows === 0) return res.status(404).json({ error: "Room not found" });
        res.json({ message: "Room deleted successfully" });
    });
});

// --- Tenant ---
// --- Tenant total rent due (via SQL function) ---
app.get("/Tenant/:id/TotalDue", (req, res) => {
    const { id } = req.params;
    const q = "SELECT GetTotalRentDue(?) AS TotalDue";
    db.query(q, [id], (err, result) => {
        if (err) {
            console.error("[GET /Tenant/:id/TotalDue] Error:", err);
            return res.status(500).json({ error: "Error fetching total rent due" });
        }
        res.json({ TotalDue: result[0]?.TotalDue || 0 });
    });
});

// --- Tenant ---
// --- Tenant ---
app.get("/Tenant", (req, res) => {
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
            -- provide aliases that some frontends expect
            COALESCE(GROUP_CONCAT(DISTINCT tp.tenant_Phone SEPARATOR ', '), '') AS Contact,
            COALESCE(GROUP_CONCAT(DISTINCT te.tenant_Email SEPARATOR ', '), '') AS Email
        FROM Tenant t
        LEFT JOIN Tenant_Name tn ON t.TenantID = tn.TenantID
        LEFT JOIN tenant_Phone tp ON t.TenantID = tp.TenantID
        LEFT JOIN tenant_Email te ON t.TenantID = te.TenantID
        GROUP BY t.TenantID
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error("[GET /Tenant] Error:", err);
            return res.status(500).json({ error: "Failed to fetch tenants" });
        }
        res.json(result);
    });
});


app.post("/Tenant", (req, res) => {
    

    const {
        firstName,
        middleName = '',
        lastName,
        phones = [],
        emails = [],  // fixed name
        CheckInDate,
        CheckOutDate,
        PaymentStatus = 'Pending',
        RoomID,
        OwnerID  // required field
    } = req.body;


    if (!firstName || !lastName || !Array.isArray(phones) || phones.length === 0 ||
        !Array.isArray(emails) || emails.length === 0 || !CheckInDate || !RoomID || !OwnerID) {
        return res.status(400).json({
            error: "Missing required fields: firstName, lastName, phones, emails, CheckInDate, RoomID, OwnerID"
        });
    }

    const qTenant = "INSERT INTO Tenant (CheckInDate, CheckOutDate, PaymentStatus, RoomID, OwnerID) VALUES (?, ?, ?, ?, ?)";
    const tenantParams = [CheckInDate, CheckOutDate, PaymentStatus, RoomID, OwnerID];

    db.query(qTenant, tenantParams, (err, result) => {
        if (err) {
            console.error("[Tenant POST] Error inserting into Tenant:", err);
            if (err.code === "ER_NO_REFERENCED_ROW_2") {
                return res.status(400).json({ error: "Invalid RoomID or OwnerID" });
            }
            return res.status(500).json(err);
        }

        const newTenantID = result.insertId;
        console.log(`[Tenant POST] Tenant base record created with ID: ${newTenantID}`);

        // Insert into Tenant_Name
        const qName = "INSERT INTO Tenant_Name (TenantID, FirstName, MiddleName, LastName) VALUES (?, ?, ?, ?)";
        db.query(qName, [newTenantID, firstName, middleName, lastName], (err) => {
            if (err) {
                db.query("DELETE FROM Tenant WHERE TenantID = ?", [newTenantID]);
                return res.status(500).json({ error: "Failed to insert tenant name" });
            }

            const phoneInserts = phones.map(p => new Promise((resolve, reject) => {
                db.query("INSERT INTO tenant_Phone (TenantID, tenant_Phone) VALUES (?, ?)", [newTenantID, p], err => {
                    if (err) return reject(err);
                    resolve();
                });
            }));

            const emailInserts = emails.map(e => new Promise((resolve, reject) => {
                db.query("INSERT INTO tenant_Email (TenantID, tenant_Email) VALUES (?, ?)", [newTenantID, e], err => {
                    if (err) return reject(err);
                    resolve();
                });
            }));

            Promise.all([...phoneInserts, ...emailInserts])
                .then(() => {
                    // After successful inserts, fetch the tenant row with aggregated phones/emails
                    const fetchQuery = `
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
                        WHERE t.TenantID = ?
                        GROUP BY t.TenantID
                    `;
                    db.query(fetchQuery, [newTenantID], (err, rows) => {
                        if (err) {
                            console.error("[Tenant POST] Error fetching new tenant:", err);
                            return res.status(500).json({ message: "Tenant added but failed to fetch assembled tenant", TenantID: newTenantID });
                        }
                        res.json({ message: "Tenant added successfully", tenant: rows[0] });
                    });
                })
                .catch(err => {
                    db.query("DELETE FROM Tenant_Name WHERE TenantID = ?", [newTenantID]);
                    db.query("DELETE FROM Tenant WHERE TenantID = ?", [newTenantID]);
                    console.error("[Tenant POST] Error inserting contact info:", err);
                    res.status(500).json({ error: "Failed to insert contact info" });
                });
        });
    });
});

// Update tenant (basic info + name + phones/emails)
app.put('/Tenant/:tenantID', (req, res) => {
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

    // Update Tenant table
    const qUpdateTenant = `UPDATE Tenant SET CheckInDate = ?, CheckOutDate = ?, PaymentStatus = ?, RoomID = ?, OwnerID = ? WHERE TenantID = ?`;
    const tenantParams = [CheckInDate, CheckOutDate, PaymentStatus, RoomID, OwnerID, tenantID];

    db.query(qUpdateTenant, tenantParams, (err) => {
        if (err) {
            console.error('[PUT /Tenant/:tenantID] Error updating Tenant:', err);
            return res.status(500).json({ error: 'Failed to update tenant' });
        }

        // Update name
        const qUpdateName = `UPDATE Tenant_Name SET FirstName = ?, MiddleName = ?, LastName = ? WHERE TenantID = ?`;
        db.query(qUpdateName, [firstName, middleName, lastName, tenantID], (err) => {
            if (err) {
                console.error('[PUT /Tenant/:tenantID] Error updating Tenant_Name:', err);
                return res.status(500).json({ error: 'Failed to update tenant name' });
            }

            // Replace phones and emails: delete existing, then insert provided
            const deletePhones = `DELETE FROM tenant_Phone WHERE TenantID = ?`;
            const deleteEmails = `DELETE FROM tenant_Email WHERE TenantID = ?`;

            db.query(deletePhones, [tenantID], (err) => {
                if (err) {
                    console.error('[PUT /Tenant/:tenantID] Error deleting old phones:', err);
                    return res.status(500).json({ error: 'Failed to update phones' });
                }

                db.query(deleteEmails, [tenantID], (err) => {
                    if (err) {
                        console.error('[PUT /Tenant/:tenantID] Error deleting old emails:', err);
                        return res.status(500).json({ error: 'Failed to update emails' });
                    }

                    const phoneInserts = phones.map(p => new Promise((resolve, reject) => {
                        db.query('INSERT INTO tenant_Phone (TenantID, tenant_Phone) VALUES (?, ?)', [tenantID, p], (err) => {
                            if (err) return reject(err);
                            resolve();
                        });
                    }));

                    const emailInserts = emails.map(e => new Promise((resolve, reject) => {
                        db.query('INSERT INTO tenant_Email (TenantID, tenant_Email) VALUES (?, ?)', [tenantID, e], (err) => {
                            if (err) return reject(err);
                            resolve();
                        });
                    }));

                    Promise.all([...phoneInserts, ...emailInserts])
                        .then(() => {
                            // Return updated assembled tenant row
                            const fetchQuery = `
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
                                WHERE t.TenantID = ?
                                GROUP BY t.TenantID
                            `;
                            db.query(fetchQuery, [tenantID], (err, rows) => {
                                if (err) {
                                    console.error('[PUT /Tenant/:tenantID] Error fetching updated tenant:', err);
                                    return res.status(500).json({ message: 'Tenant updated but failed to fetch assembled tenant' });
                                }
                                res.json({ message: 'Tenant updated successfully', tenant: rows[0] });
                            });
                        })
                        .catch(err => {
                            console.error('[PUT /Tenant/:tenantID] Error inserting new contact info:', err);
                            res.status(500).json({ error: 'Failed to insert updated contact info' });
                        });
                });
            });
        });
    });
});

// Patch tenant payment status only (convenience endpoint)
app.patch('/Tenant/:tenantID/status', (req, res) => {
    const tenantID = req.params.tenantID;
    const { PaymentStatus } = req.body;
    if (!PaymentStatus) return res.status(400).json({ error: 'PaymentStatus required' });
    const q = 'UPDATE Tenant SET PaymentStatus = ? WHERE TenantID = ?';
    db.query(q, [PaymentStatus, tenantID], (err, result) => {
        if (err) {
            console.error('[PATCH /Tenant/:tenantID/status] Error updating PaymentStatus:', err);
            return res.status(500).json({ error: 'Failed to update payment status' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Tenant not found' });
        res.json({ message: 'PaymentStatus updated' });
    });
});

// Delete tenant and related contact/name records
app.delete('/Tenant/:tenantID', (req, res) => {
    const tenantID = req.params.tenantID;
    // Delete phones, emails, name, then tenant
    const deletePhones = `DELETE FROM tenant_Phone WHERE TenantID = ?`;
    const deleteEmails = `DELETE FROM tenant_Email WHERE TenantID = ?`;
    const deleteName = `DELETE FROM Tenant_Name WHERE TenantID = ?`;
    const deleteTenant = `DELETE FROM Tenant WHERE TenantID = ?`;

    db.query(deletePhones, [tenantID], (err) => {
        if (err) {
            console.error('[DELETE /Tenant/:tenantID] Error deleting phones:', err);
            return res.status(500).json({ error: 'Failed to delete tenant phones' });
        }
        db.query(deleteEmails, [tenantID], (err) => {
            if (err) {
                console.error('[DELETE /Tenant/:tenantID] Error deleting emails:', err);
                return res.status(500).json({ error: 'Failed to delete tenant emails' });
            }
            db.query(deleteName, [tenantID], (err) => {
                if (err) {
                    console.error('[DELETE /Tenant/:tenantID] Error deleting name:', err);
                    return res.status(500).json({ error: 'Failed to delete tenant name' });
                }
                db.query(deleteTenant, [tenantID], (err, result) => {
                    if (err) {
                        console.error('[DELETE /Tenant/:tenantID] Error deleting tenant:', err);
                        return res.status(500).json({ error: 'Failed to delete tenant' });
                    }
                    if (result.affectedRows === 0) {
                        return res.status(404).json({ error: 'Tenant not found' });
                    }
                    res.json({ message: 'Tenant deleted successfully' });
                });
            });
        });
    });
});


// --- Staff ---
app.get("/Staff", (req, res) => {
    const q = `
        SELECT StaffID, name, role, contact, AvailabilityStatus 
        FROM Staff 
        WHERE AvailabilityStatus = 'Available' 
        ORDER BY name
    `;
    
    db.query(q, (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

app.post("/Staff", (req, res) => {
    const { StaffID, name, role, contact, AvailabilityStatus } = req.body;
    const q = "INSERT INTO Staff (StaffID, name, role, contact, AvailabilityStatus) VALUES (?, ?, ?, ?, ?)";
    db.query(q, [StaffID, name, role, contact, AvailabilityStatus], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Staff added", id: StaffID });
    });
});

// --- Payment ---
app.get("/Payment", (req, res) => {
    db.query("SELECT * FROM Payment", (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

// --- Full Payment + Auto Update Tenant Status ---
app.post("/Payment", (req, res) => {
    const { TenantID, PaymentMode } = req.body;

    if (!TenantID || !PaymentMode) {
        return res.status(400).json({ error: "TenantID and PaymentMode are required" });
    }

    // Step 1: Get total due using SQL function
    const q1 = "SELECT GetTotalRentDue(?) AS TotalDue";
    db.query(q1, [TenantID], (err, result) => {
        if (err) {
            console.error("[POST /Payment] Error calculating total due:", err);
            return res.status(500).json({ error: "Failed to calculate rent due" });
        }

        const totalDue = result[0]?.TotalDue || 0;
        const date = new Date();

        // Step 2: Insert full payment
        const q2 = `
            INSERT INTO Payment (TenantID, Amount, Date, PaymentMode, Status)
            VALUES (?, ?, ?, ?, 'Paid')
        `;
        db.query(q2, [TenantID, totalDue, date, PaymentMode], (err2) => {
            if (err2) {
                console.error("[POST /Payment] Error inserting payment:", err2);
                return res.status(500).json({ error: "Failed to record payment" });
            }

            // Step 3: Mark tenant as Paid
            const q3 = "UPDATE Tenant SET PaymentStatus = 'Paid' WHERE TenantID = ?";
            db.query(q3, [TenantID], (err3) => {
                if (err3) {
                    console.error("[POST /Payment] Error updating tenant status:", err3);
                    return res.status(500).json({ error: "Failed to update tenant status" });
                }

                res.json({
                    message: "Payment successful",
                    amount: totalDue
                });
            });
        });
    });
});


// --- ServiceRequest ---
// Get service requests - supports filtering by owner or tenant
app.get("/ServiceRequest", (req, res) => {
    const { ownerId, tenantId } = req.query;
    let query = `
        SELECT 
            sr.RequestID,
            sr.Category,
            sr.Description,
            sr.Status,
            sr.DateRaised,
            sr.DateResolved,
            sr.TenantID,
            CONCAT_WS(' ', tn.FirstName, tn.MiddleName, tn.LastName) as TenantName,
            t.RoomID,
            t.OwnerID,
            s.StaffID,
            s.name as StaffName,
            s.contact as StaffContact,
            s.role as StaffRole
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

    db.query(query, params, (err, data) => {
        if (err) return res.status(500).json({ error: "Failed to fetch service requests" });
        res.json(data);
    });

});

app.post("/ServiceRequest", (req, res) => {
    const { Category, Description, TenantID, DateRaised } = req.body;

    if (!Category || !Description || !TenantID || !DateRaised) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const q = `
        INSERT INTO ServiceRequest (
            Category, 
            Description, 
            Status, 
            DateRaised, 
            TenantID
        )
        VALUES (?, ?, 'Pending', ?, ?)
    `;

    db.query(q, [Category, Description, DateRaised, TenantID], (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to add service request" });
        res.json({ message: "Service request added successfully", RequestID: result.insertId });
    });
});

// Update service request status and staff assignment
app.put("/ServiceRequest/:requestId", (req, res) => {
    const { requestId } = req.params;
    const { Status, StaffID } = req.body;

    let updateFields = [];
    let params = [];

    if (Status) {
        updateFields.push("Status = ?");
        params.push(Status);
    }
    
    if (StaffID !== undefined) { // Allow null for removing staff
        updateFields.push("StaffID = ?");
        params.push(StaffID);
    }

    if (Status === 'Completed') {
        updateFields.push("DateResolved = NOW()");
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
    }

    const q = `
        UPDATE ServiceRequest 
        SET ${updateFields.join(", ")}
        WHERE RequestID = ?
    `;

    // Add requestId as the last parameter
    params.push(requestId);

    console.log("Executing update query:", q, "with params:", params);

    db.query(q, params, (err, result) => {
        if (err) {
            console.error("Error updating service request:", err);
            return res.status(500).json({ error: "Failed to update service request" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Service request not found" });
        }
        res.json({ message: "Service request updated successfully" });
    });
});

// Legacy endpoint for marking as resolved
app.patch("/ServiceRequest/:requestId/resolve", (req, res) => {
    const { requestId } = req.params;
    const { DateResolved, StaffID } = req.body;

    if (!DateResolved) {
        return res.status(400).json({ error: "Resolution date is required" });
    }

    const q = `
        UPDATE ServiceRequest 
        SET Status = 'Completed',
            DateResolved = ?,
            StaffID = ?
        WHERE RequestID = ?
    `;

    db.query(q, [DateResolved, StaffID, requestId], (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to update service request" });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Service request not found" });
        }
        res.json({ message: "Service request resolved" });
    });
});


// backend/routes/tenant.js
app.get("/Tenant/:tenantID/all", (req, res) => {
    const tenantID = req.params.tenantID;
    console.log("[GET /Tenant/:tenantID/all] Fetching data for tenant:", tenantID);

    const queryAsync = (q, params = []) => new Promise((resolve, reject) => {
        console.log("[queryAsync] Executing query:", q, "with params:", params);
        db.query(q, params, (err, rows) => {
            if (err) {
                console.error("[queryAsync] Error:", err);
                reject(err);
            } else {
                console.log("[queryAsync] Got results:", rows?.length || 0, "rows");
                resolve(rows);
            }
        });
    });

    const tenantQuery = `
      SELECT 
        t.TenantID,
        tn.FirstName,
        tn.MiddleName,
        tn.LastName,
        CONCAT_WS(' ', tn.FirstName, tn.MiddleName, tn.LastName) AS FullName,
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
      WHERE t.TenantID = ?
      GROUP BY t.TenantID
      LIMIT 1
    `;

    // Explicit queries to debug missing data
    const paymentsQuery = "SELECT * FROM Payment WHERE TenantID = ?";
    const requestsQuery = "SELECT * FROM ServiceRequest WHERE TenantID = ?";
    const feedbackQuery = "SELECT * FROM Feedback WHERE TenantID = ?";

    Promise.all([
        queryAsync(tenantQuery, [tenantID]),
        queryAsync(paymentsQuery, [tenantID]),
        queryAsync(requestsQuery, [tenantID]),
        queryAsync(feedbackQuery, [tenantID])
    ]).then(([tenantRows, payments, requests, feedbacks]) => {
        console.log("[GET /Tenant/:tenantID/all] Data fetched:");
        console.log("- Tenant:", tenantRows?.length ? "Found" : "Not found");
        console.log("- Payments:", payments?.length || 0);
        console.log("- Requests:", requests?.length || 0);
        console.log("- Feedback:", feedbacks?.length || 0);

        const tenant = (tenantRows && tenantRows.length) ? tenantRows[0] : null;
        if (!tenant) {
            return res.status(404).json({ error: "Tenant not found" });
        }

        res.json({
            tenant,
            payments,
            requests,
            feedbacks
        });
    }).catch(err => {
        console.error("[GET /Tenant/:tenantID/all] Error:", err);
        res.status(500).json({ error: "Failed to fetch tenant data", details: err.message });
    });
});

// Validate tenant login
app.post("/Tenant/login", (req, res) => {
    const { name, tenantID } = req.body;

    console.log('[Tenant Login] Request body:', req.body);

    if (!name || !tenantID) {
        // removed console.warn to avoid warning logs
        return res.status(400).json({ error: "Name and TenantID are required" });
    }

    const q = `
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
      WHERE t.TenantID = ? AND CONCAT_WS(' ', tn.FirstName, tn.MiddleName, tn.LastName) = ?
      GROUP BY t.TenantID
      LIMIT 1
    `;

    console.log('[Tenant Login] Executing query (assembled tenant):', q.trim());
    console.log('[Tenant Login] Parameters:', [tenantID, name]);

    db.query(q, [tenantID, name], (err, results) => {
        if (err) {
            console.error('[Tenant Login] Database error:', err);
            return res.status(500).json({ error: 'Database error during tenant login' });
        }

        if (!results || results.length === 0) {
            // replaced console.warn with info log
            console.log('[Tenant Login] Login failed for TenantID:', tenantID, 'name:', name);
            return res.status(401).json({ error: "Invalid tenant credentials" });
        }

        console.log('[Tenant Login] Login successful for TenantID:', tenantID);
        res.json({ tenant: results[0] });
    });
});


// Update Property
app.put("/Property/:id", (req, res) => {
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

    db.query(q, [name, location, TotalRooms, OwnerID, id], (err, result) => {
        if (err) {
            console.error("[PUT /Property/:id] Error:", err);
            return res.status(500).json({ error: "Failed to update property" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Property not found" });
        }
        res.json({ message: "Property updated successfully" });
    });
});

// Delete Property
app.delete("/Property/:id", (req, res) => {
    const { id } = req.params;

    // First delete all rooms associated with this property
    const deleteRooms = `DELETE FROM Room WHERE PropertyID = ?`;
    
    db.query(deleteRooms, [id], (err) => {
        if (err) {
            console.error("[DELETE /Property/:id] Error deleting associated rooms:", err);
            return res.status(500).json({ error: "Failed to delete associated rooms" });
        }

        // Then delete the property
        const deleteProperty = `DELETE FROM Property WHERE PropertyID = ?`;
        db.query(deleteProperty, [id], (err, result) => {
            if (err) {
                console.error("[DELETE /Property/:id] Error:", err);
                return res.status(500).json({ error: "Failed to delete property" });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Property not found" });
            }
            res.json({ message: "Property and all associated rooms deleted successfully" });
        });
    });
});


// --- Feedback ---
app.get("/Feedback", (req, res) => {
  db.query("SELECT * FROM Feedback", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.post("/Feedback", (req, res) => {
  const { Category, Message, Rating, TenantID } = req.body;
  
  if (!Category || !Message || !Rating || !TenantID) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const q = `
    INSERT INTO Feedback (Category, Message, Rating, TenantID, DateSubmitted)
    VALUES (?, ?, ?, ?, CURDATE())
  `;

  db.query(q, [Category, Message, Rating, TenantID], (err, result) => {
    if (err) {
      console.error("[POST /Feedback] Database error:", err);
      return res.status(500).json({ error: "Database error adding feedback" });
    }
    res.json({ message: "Feedback added successfully", FeedbackID: result.insertId });
  });
});




// -------------------- SERVER --------------------
app.listen(5002, () => {
    console.log("Backend running on port 5002");
});
