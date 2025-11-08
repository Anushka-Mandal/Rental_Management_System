const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Get all rooms
router.get('/', async (req, res) => {
    try {
        const [rooms] = await pool.query('SELECT * FROM Room');
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get rooms by property
router.get('/property/:propertyId', async (req, res) => {
    try {
        const [rooms] = await pool.query('SELECT * FROM Room WHERE PropertyID = ?', [req.params.propertyId]);
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add new room
router.post('/', async (req, res) => {
    try {
        const { BedCount, RentAmount, RoomType, PropertyID } = req.body;
        const [result] = await pool.query(
            'INSERT INTO Room (BedCount, OccupiedBeds, RentAmount, RoomType, PropertyID) VALUES (?, 0, ?, ?, ?)',
            [BedCount, RentAmount, RoomType, PropertyID]
        );
        res.status(201).json({ RoomID: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete room
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM Room WHERE RoomID = ?', [req.params.id]);
        res.status(200).json({ message: 'Room deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;