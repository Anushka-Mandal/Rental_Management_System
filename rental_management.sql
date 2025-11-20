-- Drop database if it exists (optional for clean testing)
DROP DATABASE IF EXISTS rental_management;
CREATE DATABASE rental_management;
USE rental_management;

-- ------------------------------
-- Owner Table
-- ------------------------------
CREATE TABLE Owner (
    OwnerID INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    address VARCHAR(255)
);

-- ------------------------------
-- Property Table
-- ------------------------------
CREATE TABLE Property (
    PropertyID INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    location VARCHAR(100),
    TotalRooms INT,
    OwnerID INT,
    FOREIGN KEY (OwnerID)
        REFERENCES Owner(OwnerID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- ------------------------------
-- Room Table
-- ------------------------------
CREATE TABLE Room (
    RoomID INT AUTO_INCREMENT PRIMARY KEY,
    BedCount INT,
    OccupiedBeds INT DEFAULT 0,
    RentAmount DECIMAL(10, 2),
    RoomType VARCHAR(50),
    PropertyID INT,
    FOREIGN KEY (PropertyID)
        REFERENCES Property(PropertyID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- ------------------------------
-- Tenant Table
-- ------------------------------
CREATE TABLE Tenant (
    TenantID INT AUTO_INCREMENT PRIMARY KEY,
    CheckInDate DATE,
    CheckOutDate DATE,
    PaymentStatus VARCHAR(50),
    RoomID INT NOT NULL,
    OwnerID INT NOT NULL,
    FOREIGN KEY (RoomID)
        REFERENCES Room(RoomID)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (OwnerID)
        REFERENCES Owner(OwnerID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


CREATE TABLE Tenant_Name (
    TenantID INT,
    FirstName VARCHAR(50),
    MiddleName VARCHAR(50),
    LastName VARCHAR(50),
    PRIMARY KEY (TenantID),
    FOREIGN KEY (TenantID)
        REFERENCES Tenant(TenantID)
        ON DELETE CASCADE
);


-- ------------------------------
-- Staff Table
-- ------------------------------
CREATE TABLE Staff (
    StaffID INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    role VARCHAR(50),
    contact VARCHAR(100),
    AvailabilityStatus VARCHAR(50)
);

-- ------------------------------
-- Payment Table
-- ------------------------------
CREATE TABLE Payment (
    PaymentID INT AUTO_INCREMENT PRIMARY KEY,
    Amount DECIMAL(10, 2),
    Date DATE,
    Status VARCHAR(50),
    PaymentMode VARCHAR(50),
    TenantID INT,
    FOREIGN KEY (TenantID)
        REFERENCES Tenant(TenantID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- ------------------------------
-- ServiceRequest Table
-- ------------------------------
CREATE TABLE ServiceRequest (
    RequestID INT AUTO_INCREMENT PRIMARY KEY,
    Category VARCHAR(50),
    Description TEXT,
    Status VARCHAR(50),
    DateRaised DATE,
    DateResolved DATE,
    TenantID INT,
    StaffID INT,
    FOREIGN KEY (TenantID)
        REFERENCES Tenant(TenantID)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (StaffID)
        REFERENCES Staff(StaffID)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

-- ------------------------------
-- Feedback Table
-- ------------------------------
CREATE TABLE Feedback (
    TenantID INT,
    FeedbackNo INT,
    Category VARCHAR(50),
    Message TEXT,
    Rating INT,
    DateSubmitted DATE,
    PRIMARY KEY (TenantID, FeedbackNo),
    FOREIGN KEY (TenantID)
        REFERENCES Tenant(TenantID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

DELIMITER //
CREATE TRIGGER before_feedback_insert
BEFORE INSERT ON Feedback
FOR EACH ROW
BEGIN
    DECLARE next_no INT;
    SELECT IFNULL(MAX(FeedbackNo), 0) + 1 INTO next_no
    FROM Feedback
    WHERE TenantID = NEW.TenantID;
    SET NEW.FeedbackNo = next_no;
END //
DELIMITER ;

-- ------------------------------
-- Tenant_Email Table
-- ------------------------------
CREATE TABLE tenant_Email (
    tenant_Email VARCHAR(255),
    TenantID INT,
    PRIMARY KEY (TenantID, tenant_Email),
    FOREIGN KEY (TenantID) REFERENCES Tenant(TenantID) 
    ON DELETE CASCADE
);

-- ------------------------------
-- Tenant_Phone Table
-- ------------------------------
CREATE TABLE tenant_Phone (
    tenant_Phone VARCHAR(20),
    TenantID INT,
    PRIMARY KEY (TenantID, tenant_Phone),
    FOREIGN KEY (TenantID) REFERENCES Tenant(TenantID) 
    ON DELETE CASCADE
);

-- ------------------------------
-- TenantUses Table
-- ------------------------------
CREATE TABLE Tenantuses (
    UsageID INT,
    TenantID INT,
    PRIMARY KEY (UsageID, TenantID),
    FOREIGN KEY (UsageID) REFERENCES AmenityUsage(UsageID),
    FOREIGN KEY (TenantID) REFERENCES Tenant(TenantID)
);

-- ------------------------------
-- Requests Table
-- ------------------------------
CREATE TABLE requests (
    RequestID INT,
    TenantID INT,
    PRIMARY KEY (RequestID, TenantID),
    FOREIGN KEY (RequestID) REFERENCES ServiceRequest(RequestID),
    FOREIGN KEY (TenantID) REFERENCES Tenant(TenantID)
);

show tables;

USE rental_management;

select * from Owner;
select * from property;
select * from Tenant;
select * from room;

-- triggers 

-- update the occupied beds in a room when tenant inserted
DELIMITER //
CREATE TRIGGER after_tenant_insert_update_room
AFTER INSERT ON Tenant
FOR EACH ROW
BEGIN
    IF NEW.RoomID IS NOT NULL THEN
        UPDATE Room
        SET OccupiedBeds = OccupiedBeds + 1
        WHERE RoomID = NEW.RoomID;
    END IF;
END //
DELIMITER ;

select * from room;

-- Handle Tenant Deletion trigger, updates the occupied beds
DELIMITER //
CREATE TRIGGER after_tenant_delete_update_room
AFTER DELETE ON Tenant
FOR EACH ROW
BEGIN
    IF OLD.RoomID IS NOT NULL THEN
        UPDATE Room
        SET OccupiedBeds = OccupiedBeds - 1
        WHERE RoomID = OLD.RoomID;
    END IF;
END //
DELIMITER ;

-- triggers to handle duplicate email and phone

ALTER TABLE tenant_Phone 
ADD CONSTRAINT uq_tenant_phone UNIQUE (tenant_Phone);

ALTER TABLE tenant_Email 
ADD CONSTRAINT uq_tenant_email UNIQUE (tenant_Email);

-- STEP 3: CREATE NEW PHONE TRIGGERS
-- ============================================================
DELIMITER //

-- Prevent duplicate phone on INSERT
CREATE TRIGGER tenant_phone_no_duplicate
BEFORE INSERT ON tenant_Phone
FOR EACH ROW
BEGIN
    SET NEW.tenant_Phone = TRIM(NEW.tenant_Phone);
    IF EXISTS (
        SELECT 1 
        FROM tenant_Phone 
        WHERE tenant_Phone = NEW.tenant_Phone
          AND TenantID <> NEW.TenantID
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'This phone number is already assigned to another tenant.';
    END IF;
END;
//
-- Prevent duplicate phone on UPDATE
CREATE TRIGGER tenant_phone_no_duplicate_update
BEFORE UPDATE ON tenant_Phone
FOR EACH ROW
BEGIN
    SET NEW.tenant_Phone = TRIM(NEW.tenant_Phone);
    IF EXISTS (
        SELECT 1 
        FROM tenant_Phone 
        WHERE tenant_Phone = NEW.tenant_Phone
          AND TenantID <> NEW.TenantID
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'This phone number is already assigned to another tenant.';
    END IF;
END;
//

DELIMITER ;
-- STEP 4: CREATE NEW EMAIL TRIGGERS
-- ============================================================
DELIMITER //

-- Prevent duplicate email on INSERT
CREATE TRIGGER tenant_email_no_duplicate
BEFORE INSERT ON tenant_Email
FOR EACH ROW
BEGIN
    SET NEW.tenant_Email = LOWER(TRIM(NEW.tenant_Email));
    IF EXISTS (
        SELECT 1 
        FROM tenant_Email 
        WHERE LOWER(TRIM(tenant_Email)) = NEW.tenant_Email
          AND TenantID <> NEW.TenantID
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'This email address is already assigned to another tenant.';
    END IF;
END;
//

-- Prevent duplicate email on UPDATE
CREATE TRIGGER tenant_email_no_duplicate_update
BEFORE UPDATE ON tenant_Email
FOR EACH ROW
BEGIN
    SET NEW.tenant_Email = LOWER(TRIM(NEW.tenant_Email));
    IF EXISTS (
        SELECT 1 
        FROM tenant_Email 
        WHERE LOWER(TRIM(tenant_Email)) = NEW.tenant_Email
          AND TenantID <> NEW.TenantID
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'This email address is already assigned to another tenant.';
    END IF;
END;
//

DELIMITER ;


-- PROCEDURE to assign staff to request
DELIMITER //

CREATE PROCEDURE AssignStaffToRequest (
    request_id_in INT,
    staff_id_in INT
)
BEGIN
    -- Check if the request and staff exist (optional but good practice)
    IF NOT EXISTS (SELECT 1 FROM ServiceRequest WHERE RequestID = request_id_in) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Service Request ID not found.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM Staff WHERE StaffID = staff_id_in) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Staff ID not found.';
    END IF;

    -- Update the ServiceRequest with the StaffID and change the Status
    UPDATE ServiceRequest
    SET
        StaffID = staff_id_in,
        Status = 'In Progress' -- Update status to reflect assignment
    WHERE
        RequestID = request_id_in;
        
    SELECT 'Staff successfully assigned to Service Request and status updated to "In Progress".' AS StatusMessage;
END //

-- calculate total rent due
DELIMITER //

CREATE FUNCTION GetTotalRentDue(tenant_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    DECLARE total_due DECIMAL(10,2);

    SELECT 
        CASE 
            WHEN t.PaymentStatus = 'Pending' THEN 
                (DATEDIFF(t.CheckOutDate, t.CheckInDate) * (r.RentAmount / 30))
            ELSE 
                0
        END
    INTO total_due
    FROM Tenant t
    JOIN Room r ON t.RoomID = r.RoomID
    WHERE t.TenantID = tenant_id;

    RETURN total_due;
END //

DELIMITER ;


show tables;

-- ------------------------------
-- Insert Owners
-- ------------------------------
INSERT INTO Owner (name, address) VALUES
('Rajesh Sharma', '12 Green Street, Mumbai'),
('Anita Verma', '45 Lake View Road, Pune');

-- ------------------------------
-- Insert Properties (2 per Owner)
-- ------------------------------
INSERT INTO Property (name, location, TotalRooms, OwnerID) VALUES
('Sunrise Residency', 'Andheri, Mumbai', 3, 1),
('Palm Heights', 'Bandra, Mumbai', 3, 1),
('Blue Horizon', 'Koregaon Park, Pune', 3, 2),
('Hilltop Enclave', 'Baner, Pune', 3, 2);

-- ------------------------------
-- Insert Rooms (3 per Property)
-- ------------------------------
INSERT INTO Room (BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID) VALUES
-- Sunrise Residency
(2, 0, 15000, 'Single', 1),
(3, 0, 20000, 'Double', 1),
(1, 0, 12000, 'Studio', 1),

-- Palm Heights
(2, 0, 16000, 'Single', 2),
(3, 0, 21000, 'Double', 2),
(1, 0, 13000, 'Studio', 2),

-- Blue Horizon
(2, 0, 14000, 'Single', 3),
(3, 0, 19000, 'Double', 3),
(1, 0, 11000, 'Studio', 3),

-- Hilltop Enclave
(2, 0, 15500, 'Single', 4),
(3, 0, 20500, 'Double', 4),
(1, 0, 12500, 'Studio', 4);

-- ------------------------------
-- Insert Tenants (5 tenants)
-- ------------------------------

-- trigger test for inserting and deleting tenant
INSERT INTO Tenant (CheckInDate, CheckOutDate, PaymentStatus, RoomID, OwnerID) VALUES
('2025-10-01', '2026-03-01', 'Pending', 1, 1),
('2025-09-15', '2026-02-15', 'Paid', 4, 1),
('2025-08-10', '2026-01-10', 'Pending', 7, 2),
('2025-10-10', '2026-04-10', 'Paid', 9, 2),
('2025-09-01', '2026-02-28', 'Pending', 10, 2),
('2025-10-10', '2026-01-10', 'Pending', 3, 2);

INSERT INTO Tenant (CheckInDate, CheckOutDate, PaymentStatus, RoomID, OwnerID) VALUES
('2025-10-01', '2026-03-01', 'Pending', 1, 1);
select * from room;
-- Step 1: Delete the tenant added above
DELETE FROM Tenant WHERE TenantID = 5;

-- triggers for phone
-- Step 2: Assign unique phone numbers
INSERT INTO tenant_Phone VALUES ('9999999999', 2);
INSERT INTO tenant_Phone VALUES ('8888888888', 3);

-- Step 3: Try to update the 2nd tenant’s phone number to an existing one
UPDATE tenant_Phone
SET tenant_Phone = '9999999999'
WHERE TenantID = 3;

-- triggers for email
-- Step 1: Assign unique emails
INSERT INTO tenant_Email VALUES ('alice@example.com', 2);
INSERT INTO tenant_Email VALUES ('bob@example.com', 3);

-- Step 2: Attempt to assign an existing email to another tenant
UPDATE tenant_Email
SET tenant_Email = 'alice@example.com'
WHERE TenantID = 3;


select * from Owner;
select * from property;
select * from Tenant;
select * from room;

-- assign staff to request
-- Step 1: Add a staff member
INSERT INTO Staff (name, role, contact, AvailabilityStatus)
VALUES ('Ravi Kumar', 'Cleaner', '9876543210', 'Available');

-- Step 2: Add a service request
INSERT INTO ServiceRequest (Category, Description, Status, DateRaised, TenantID)
VALUES ('Cleaning', 'Room needs deep cleaning', 'Pending', CURDATE(), 2);

-- Step 3: Assign staff using the procedure
CALL AssignStaffToRequest(1, 1);

SELECT * FROM ServiceRequest;

select * from staff;
select * from tenant;
select * from Tenant_Name;

SELECT GetTotalRentDue(1) AS TotalDue;
SELECT GetTotalRentDue(2) AS TotalDue;
SELECT GetTotalRentDue(3) AS TotalDue;
SELECT GetTotalRentDue(4) AS TotalDue;
SELECT GetTotalRentDue(5) AS TotalDue;
SELECT GetTotalRentDue(10) AS TotalDue;

INSERT INTO Tenant_Name (TenantID, FirstName, MiddleName, LastName) VALUES
(LAST_INSERT_ID(), 'Vivek', 'Ramesh', 'Patil');

INSERT INTO Tenant_Name (TenantID, FirstName, MiddleName, LastName) VALUES
(2, 'Ram', NULL, 'Kumar');

select * from payment;
DELETE FROM tenant_Phone WHERE tenant_Phone = '08040602911' AND TenantID <> 11;

-- Try duplicate phone
INSERT INTO tenant_Phone (TenantID, tenant_Phone)
VALUES (12, '08040602911');
-- ❌ should give error 45000: This phone number is already assigned to another tenant.

-- Try duplicate email
INSERT INTO tenant_Email (TenantID, tenant_Email)
VALUES (12, 'BIDISHA.PAUL10@gmail.com');
-- ❌ should also throw error (case-insensitive)

