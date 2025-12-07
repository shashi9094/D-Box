const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: "localhost",
    user:"root",
    password: "shashi9094",
    database: "dbox",
    port: 3306
});

connection.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("Database connected successfully.");
    }
});

module.exports = connection;