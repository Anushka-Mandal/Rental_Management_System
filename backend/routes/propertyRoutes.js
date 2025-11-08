const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Get all properties
router.get('/', async (req, res) => {
    try {
        const [properties] = await pool.query('SELECT * FROM Property');
        console.log('Fetched properties:', properties); // Debug log
        res.json(properties);
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({ message: error.message });
    }
});

// Add new property
router.post('/', async (req, res) => {
    try {
        const { name, location, TotalRooms, OwnerID } = req.body;
        const [result] = await pool.query(
            'INSERT INTO Property (name, location, TotalRooms, OwnerID) VALUES (?, ?, ?, ?)',
            [name, location, TotalRooms, OwnerID]
        );
        res.status(201).json({ PropertyID: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update property
router.put('/:id', async (req, res) => {
    try {
        const { name, location, TotalRooms, OwnerID } = req.body;
        const [result] = await pool.query(
            'UPDATE Property SET name = ?, location = ?, TotalRooms = ? WHERE PropertyID = ? AND OwnerID = ?',
            [name, location, TotalRooms, req.params.id, OwnerID]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Property not found or unauthorized' });
        }
        
        res.json({ message: 'Property updated successfully' });
    } catch (error) {
        console.error('Error updating property:', error);
        res.status(500).json({ message: error.message });
    }
});

// Update property
router.put('/:id', async (req, res) => {
    try {
        const { name, location, TotalRooms, OwnerID } = req.body;
        const [result] = await pool.query(
            'UPDATE Property SET name = ?, location = ?, TotalRooms = ? WHERE PropertyID = ? AND OwnerID = ?',
            [name, location, TotalRooms, req.params.id, OwnerID]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Property not found or unauthorized' });
        }
        
        res.json({ message: 'Property updated successfully' });
    } catch (error) {
        console.error('Error updating property:', error);
        res.status(500).json({ message: error.message });
    }
});

// Delete property
router.delete('/:id', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        console.log('Delete request received for property:', {
            id: req.params.id,
            type: typeof req.params.id
        });

        // First check if the property exists
        const [properties] = await conn.query('SELECT * FROM Property WHERE PropertyID = ?', [req.params.id]);
        console.log('Found properties:', properties);

        if (properties.length === 0) {
            await conn.rollback();
            return res.status(404).json({ 
                message: 'Property not found',
                requestedId: req.params.id
            });
        }

        // Delete associated rooms first
        const [roomResult] = await conn.query('DELETE FROM Room WHERE PropertyID = ?', [req.params.id]);
        console.log('Deleted associated rooms:', roomResult);

        // Then delete the property
        const [propertyResult] = await conn.query('DELETE FROM Property WHERE PropertyID = ?', [req.params.id]);
        console.log('Delete property result:', propertyResult);

        if (propertyResult.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ 
                message: 'Property could not be deleted',
                requestedId: req.params.id
            });
        }

        await conn.commit();
        res.status(200).json({ 
            message: 'Property and associated rooms deleted successfully',
            deletedId: req.params.id,
            roomsDeleted: roomResult.affectedRows,
            propertyDeleted: propertyResult.affectedRows
        });
    } catch (error) {
        await conn.rollback();
        console.error('Error deleting property:', error);
        res.status(500).json({ 
            message: 'Failed to delete property',
            error: error.message,
            code: error.code,
            requestedId: req.params.id
        });
    } finally {
        conn.release();
    }
});

module.exports = router;