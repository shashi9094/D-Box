const express = require('express');
const cors = require('cors');
const app = express();
const db = require('./db/connection');

// CORS middleware (NO app.options("*") needed)
app.use(cors({
    origin: "http://127.0.0.1:5500",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route
app.get('/', (req, res) => {
    res.send('D-Box Server Running...');
});

// Routes
const authRoutes = require('./routes/authRoutes');
const boxRoutes = require('./routes/boxRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/boxes', boxRoutes);

// Start server
app.listen(5000, () => {
    console.log('Server is running on port 5000');
});
module.exports = app;

