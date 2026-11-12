<?php
// =============================================================================
// BACKEND REST API ENDPOINTS FOR RUANG HOMESTAY
// =============================================================================

// Set response headers to return UTF-8 encoded JSON to the frontend client
header("Content-Type: application/json; charset=UTF-8");

// Load the shared database connection instance
require_once "db.php";

/** @var mysqli $conn */

// Retrieve requested action name from URL query parameter (e.g., api.php?action=get_all)
$action = $_GET['action'] ?? '';

// Decode the raw JSON request body payload sent via POST requests
$input  = json_decode(file_get_contents("php://input"), true) ?? [];

// Helper function to set the HTTP status code, output a JSON payload, and terminate the script
function send($data, $code = 200) {
    http_response_code($code);
    exit(json_encode($data));
}

// -----------------------------------------------------------------------------
// ACTION 1: GET ALL DATA (Users, Homestays, and Bookings for state synchronization)
// -----------------------------------------------------------------------------
if ($action === 'get_all') {
    // Query registered users in ascending order of ID
    $users = $conn->query("SELECT id, name, email, contact, role, status FROM users ORDER BY id ASC")->fetch_all(MYSQLI_ASSOC);

    // Query homestay properties and format comma-separated and newline-separated strings into arrays
    $homestays = [];
    $hRes = $conn->query("SELECT id, owner_id AS ownerId, name, location, price_per_night AS pricePerNight, capacity, description, facilities, images, type, status, rating, reviews FROM homestays ORDER BY id ASC");
    while ($h = $hRes->fetch_assoc()) {
        // Cast numeric types for clean JSON consumption
        $h['pricePerNight'] = (float)$h['pricePerNight'];
        $h['capacity']      = (int)$h['capacity'];
        // Split comma-delimited facilities into a clean array
        $h['facilities']    = array_map('trim', explode(',', $h['facilities']));
        // Split newline-delimited image paths into an array; fallback to default image if empty
        $h['images']        = array_filter(array_map('trim', explode("\n", $h['images']))) ?: ["images/PalmHouse.jpg"];
        $homestays[] = $h;
    }

    // Query all bookings ordered chronologically with the newest bookings first
    $bookings = [];
    $bRes = $conn->query("SELECT id, user_id AS userId, homestay_id AS homestayId, customer_name AS customerName, customer_email AS customerEmail, customer_contact AS customerContact, check_in_date AS checkInDate, check_out_date AS checkOutDate, number_of_guests AS numberOfGuests, nightly_rate AS nightlyRate, total_amount AS totalAmount, status, created_at AS createdAt FROM bookings ORDER BY created_at DESC");
    while ($b = $bRes->fetch_assoc()) {
        $b['numberOfGuests'] = (int)$b['numberOfGuests'];
        $b['nightlyRate']    = (float)$b['nightlyRate'];
        $b['totalAmount']    = (float)$b['totalAmount'];
        $bookings[] = $b;
    }

    // Send complete database snapshot back to frontend
    send(["status" => "success", "users" => $users, "homestays" => $homestays, "bookings" => $bookings]);
}

// -----------------------------------------------------------------------------
// ACTION 2: USER LOGIN (Email lookup and status validation)
// -----------------------------------------------------------------------------
if ($action === 'login') {
    // Use prepared statements to prevent SQL injection vulnerabilities
    $stmt = $conn->prepare("SELECT id, name, email, contact, role, status FROM users WHERE email = ?");
    $stmt->bind_param("s", $input['email']);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

    // Check if account exists
    if (!$user) send(["status" => "error", "message" => "No account found with this email."], 401);
    // Block disabled accounts from logging in
    if ($user['status'] === 'Disabled') send(["status" => "error", "message" => "This account is disabled."], 403);
    
    send(["status" => "success", "user" => $user]);
}

// -----------------------------------------------------------------------------
// ACTION 3: CREATE BOOKING (Server-side date validation, pricing, & record creation)
// -----------------------------------------------------------------------------
if ($action === 'create_booking') {
    // Generate a unique booking reference code (e.g., HB-A1B2C3)
    $id     = 'HB-' . strtoupper(substr(uniqid(), -6));
    $userId = $input['userId'] ?? 'customer-1';
    $guests = (int)($input['numberOfGuests'] ?? 1);
    
    // Strict date parsing using UTC to prevent timezone drift
    $checkIn = DateTimeImmutable::createFromFormat('!Y-m-d', $input['checkInDate'] ?? '', new DateTimeZone('UTC'));
    $checkOut = DateTimeImmutable::createFromFormat('!Y-m-d', $input['checkOutDate'] ?? '', new DateTimeZone('UTC'));
    
    // Validate date integrity and verify checkout date is strictly after checkin
    if (!$checkIn || !$checkOut || $checkIn->format('Y-m-d') !== ($input['checkInDate'] ?? '') ||
        $checkOut->format('Y-m-d') !== ($input['checkOutDate'] ?? '') || $checkOut <= $checkIn) {
        send(["status" => "error", "message" => "Check-out must be after a valid check-in date."], 400);
    }
    
    // Read the base price directly from the database rather than trusting client-submitted rates
    $priceStmt = $conn->prepare("SELECT price_per_night FROM homestays WHERE id = ?");
    $homestayId = $input['homestayId'] ?? '';
    $priceStmt->bind_param("s", $homestayId);
    $priceStmt->execute();
    $homestay = $priceStmt->get_result()->fetch_assoc();
    if (!$homestay) send(["status" => "error", "message" => "Homestay not found."], 404);
    
    // Calculate total price using integer cents to prevent floating-point inaccuracies
    $rate = (float)$homestay['price_per_night'];
    $baseCents = (int)round($rate * 100);
    $nightCount = (int)$checkIn->diff($checkOut)->days;
    $subtotalCents = 0;
    
    // Iterate through each occupied night; apply a 10% surcharge on weekend nights (Sunday=0, Saturday=6)
    for ($day = $checkIn; $day < $checkOut; $day = $day->modify('+1 day')) {
        $isWeekend = in_array((int)$day->format('w'), [0, 6], true);
        $subtotalCents += $baseCents + ($isWeekend ? (int)round($baseCents * 0.1) : 0);
    }
    
    // Apply a 5% discount on the entire subtotal if booking duration is 3 nights or more
    $discountCents = $nightCount >= 3 ? (int)round($subtotalCents * 0.05) : 0;
    $total = ($subtotalCents - $discountCents) / 100;
    $status = 'Pending';

    // Insert booking record into MySQL database
    $stmt = $conn->prepare("INSERT INTO bookings (id, user_id, homestay_id, customer_name, customer_email, customer_contact, check_in_date, check_out_date, number_of_guests, nightly_rate, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssssssidds", $id, $userId, $input['homestayId'], $input['customerName'], $input['customerEmail'], $input['customerContact'], $input['checkInDate'], $input['checkOutDate'], $guests, $rate, $total, $status);

    if ($stmt->execute()) send(["status" => "success", "bookingId" => $id]);
    send(["status" => "error", "message" => $stmt->error], 400);
}

// -----------------------------------------------------------------------------
// ACTION 4: UPDATE BOOKING STATUS (e.g., Pending -> Confirmed -> Completed / Cancelled)
// -----------------------------------------------------------------------------
if ($action === 'update_booking_status') {
    $stmt = $conn->prepare("UPDATE bookings SET status = ? WHERE id = ?");
    $stmt->bind_param("ss", $input['status'], $input['id']);
    $stmt->execute();
    send(["status" => "success"]);
}

// -----------------------------------------------------------------------------
// ACTION 5: UPDATE USER STATUS (Admin Action: Enable / Disable accounts)
// -----------------------------------------------------------------------------
if ($action === 'set_user_status') {
    $stmt = $conn->prepare("UPDATE users SET status = ? WHERE id = ?");
    $stmt->bind_param("ss", $input['status'], $input['id']);
    $stmt->execute();
    send(["status" => "success"]);
}

// -----------------------------------------------------------------------------
// ACTION 6: UPDATE HOMESTAY DETAILS (Room Owner Portal Edit Action)
// -----------------------------------------------------------------------------
if ($action === 'update_homestay') {
    // Normalize facilities and image inputs into delimiter-separated text strings
    $facilities = is_array($input['facilities'] ?? null) ? implode(', ', $input['facilities']) : trim($input['facilities'] ?? '');
    $images     = is_array($input['images'] ?? null) ? implode("\n", $input['images']) : trim($input['images'] ?? '');
    $price      = (float)($input['pricePerNight'] ?? 0);
    $capacity   = (int)($input['capacity'] ?? 1);

    // Update the homestay record scoped strictly to the authenticated owner's ID
    $stmt = $conn->prepare("UPDATE homestays SET name = ?, location = ?, price_per_night = ?, capacity = ?, type = ?, description = ?, facilities = ?, images = ?, status = ? WHERE id = ? AND owner_id = ?");
    $stmt->bind_param("ssdisssssss", $input['name'], $input['location'], $price, $capacity, $input['type'], $input['description'], $facilities, $images, $input['status'], $input['id'], $input['ownerId']);

    if ($stmt->execute()) send(["status" => "success", "message" => "Homestay updated successfully"]);
    send(["status" => "error", "message" => $stmt->error], 400);
}

// -----------------------------------------------------------------------------
// ACTION 7: DELETE BOOKING (Admin & Owner Action to remove records)
// -----------------------------------------------------------------------------
if ($action === 'delete_booking') {
    $stmt = $conn->prepare("DELETE FROM bookings WHERE id = ?");
    $stmt->bind_param("s", $input['id']);

    if ($stmt->execute()) send(["status" => "success"]);
    send(["status" => "error", "message" => $stmt->error], 400);
}

// Fallback response for unhandled action requests
send(["status" => "error", "message" => "Unknown action"], 404);
?>
