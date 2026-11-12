<?php
// =============================================================================
// DATABASE CONFIGURATION & CONNECTION (MySQL via MySQLi)
// =============================================================================

// Define database server credentials for local development in XAMPP
$host     = "localhost";
$username = "root";       // Default XAMPP MySQL superuser
$password = "";           // Default XAMPP MySQL password (empty by default)
$database = "ruang_db";   // Target database name storing users, homestays, and bookings

// Initialize a new MySQLi connection instance
$conn = new mysqli($host, $username, $password, $database);

// Verify if the connection succeeded; if an error occurred, abort and return a 500 JSON response
if ($conn->connect_error) {
    http_response_code(500);
    die(json_encode(["status" => "error", "message" => "Database connection failed: " . $conn->connect_error]));
}

// Enforce UTF-8 multibyte encoding to properly store special characters and emojis
$conn->set_charset("utf8mb4");
?>