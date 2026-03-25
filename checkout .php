<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit();
}

/* ── M-Pesa credentials — replace with your real Daraja keys ── */
define('MPESA_CONSUMER_KEY',    'zrCoXnngQZ1LHT6Yy1JUTyc3iVa1dnTJoD6eDEW4oVucrtWy');
define('MPESA_CONSUMER_SECRET', 'WBviC8JrU0CmaPQUtKNqHv3TjvJjxwefFANZOrIkxUO3U19M9OcoynfPrt3tQdoS');
define('MPESA_SHORTCODE',       '174379');      // sandbox shortcode — change to your real one for production
define('MPESA_PASSKEY',         'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'); // sandbox passkey
define('MPESA_CALLBACK_URL',    'https://kevinmk.infinityfree.me/callback.php'); // must be public URL
define('MPESA_SANDBOX',         true);  // set false for production

$baseUrl = MPESA_SANDBOX ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke';

/* ── Parse input ────────────────────────────────────────────── */
$input = json_decode(file_get_contents("php://input"), true);
$name  = trim($input['name']  ?? '');
$phone = trim($input['phone'] ?? '');
$items = $input['items']      ?? [];
$total = floatval($input['total'] ?? 0);

if (!$name || !$phone || empty($items) || $total <= 0) {
    http_response_code(400);
    echo json_encode(["error" => "Missing required fields"]);
    exit();
}

/* ── Normalise phone to 254XXXXXXXXX ─────────────────────────── */
$phone = preg_replace('/\D/', '', $phone);
if (substr($phone, 0, 1) === '0')      $phone = '254' . substr($phone, 1);
elseif (substr($phone, 0, 3) !== '254') $phone = '254' . $phone;

if (strlen($phone) !== 12) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid phone number. Use format 07XXXXXXXX"]);
    exit();
}

/* ── Database connection ────────────────────────────────────── */
$conn = new mysqli(
    "sql210.infinityfree.com",
    "if0_41239991",
    "Kevin542007",
    "if0_41239991_ecommerce"
);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit();
}

/* ── Create tables if needed ────────────────────────────────── */
$conn->query("CREATE TABLE IF NOT EXISTS orders (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100)  NOT NULL,
    phone      VARCHAR(20)   NOT NULL,
    total      DECIMAL(10,2) NOT NULL,
    status     ENUM('pending','paid','failed') DEFAULT 'pending',
    mpesa_ref  VARCHAR(100)  DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

$conn->query("CREATE TABLE IF NOT EXISTS order_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    order_id   INT           NOT NULL,
    product_id INT           NOT NULL,
    name       VARCHAR(200)  NOT NULL,
    quantity   INT           NOT NULL,
    price      DECIMAL(10,2) NOT NULL
)");

/* ── Save order ─────────────────────────────────────────────── */
$stmt = $conn->prepare("INSERT INTO orders (name, phone, total) VALUES (?, ?, ?)");
$stmt->bind_param("ssd", $name, $phone, $total);
if (!$stmt->execute()) {
    echo json_encode(["error" => "Failed to save order"]);
    exit();
}
$orderId = $conn->insert_id;
$stmt->close();

$stmt = $conn->prepare("INSERT INTO order_items (order_id, product_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)");
foreach ($items as $item) {
    $pid   = intval($item['id']);
    $iname = $item['name'];
    $iqty  = intval($item['qty']);
    $iprice = floatval($item['price']);
    $stmt->bind_param("iisid", $orderId, $pid, $iname, $iqty, $iprice);
    $stmt->execute();
}
$stmt->close();

/* ── M-Pesa: get access token ───────────────────────────────── */
$ch = curl_init($baseUrl . '/oauth/v1/generate?grant_type=client_credentials');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_USERPWD        => MPESA_CONSUMER_KEY . ':' . MPESA_CONSUMER_SECRET,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_TIMEOUT        => 15,
]);
$tokenData   = json_decode(curl_exec($ch), true);
$accessToken = $tokenData['access_token'] ?? null;

if (!$accessToken) {
    /* Order saved but STK push could not start */
    echo json_encode([
        "order_id" => $orderId,
        "success"  => false,
        "error"    => "Could not connect to M-Pesa. Check your API credentials.",
        "message"  => "Your order has been saved. Contact us to complete payment."
    ]);
    exit();
}

/* ── M-Pesa: STK Push ───────────────────────────────────────── */
$timestamp = date('YmdHis');
$password  = base64_encode(MPESA_SHORTCODE . MPESA_PASSKEY . $timestamp);
$amount    = max(1, intval(ceil($total)));

$payload = [
    "BusinessShortCode" => MPESA_SHORTCODE,
    "Password"          => $password,
    "Timestamp"         => $timestamp,
    "TransactionType"   => "CustomerPayBillOnline",
    "Amount"            => $amount,
    "PartyA"            => $phone,
    "PartyB"            => MPESA_SHORTCODE,
    "PhoneNumber"       => $phone,
    "CallBackURL"       => MPESA_CALLBACK_URL,
    "AccountReference"  => "DRIPSHOP-" . $orderId,
    "TransactionDesc"   => "Drip Shop Order #" . $orderId
];

$ch = curl_init($baseUrl . '/mpesa/stkpush/v1/processrequest');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $accessToken, 'Content-Type: application/json'],
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_TIMEOUT        => 30,
]);
$stkData = json_decode(curl_exec($ch), true);

if (isset($stkData['ResponseCode']) && $stkData['ResponseCode'] === '0') {
    echo json_encode([
        "order_id"         => $orderId,
        "success"          => true,
        "checkout_request" => $stkData['CheckoutRequestID'],
        "message"          => "Payment request sent to your phone. Enter your M-Pesa PIN."
    ]);
} else {
    $errMsg = $stkData['errorMessage'] ?? $stkData['ResponseDescription'] ?? 'STK Push failed';
    echo json_encode([
        "order_id" => $orderId,
        "success"  => false,
        "error"    => $errMsg,
        "message"  => "Order saved but payment failed. Contact us with Order #" . $orderId
    ]);
}

$conn->close();
