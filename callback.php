<?php
/*
 * M-Pesa Callback
 * Safaricom calls this URL automatically after the customer enters their PIN.
 * This URL MUST be publicly accessible (not https://kevinmk.infinityfree.me).
 * Use ngrok during development: ngrok http 80
 */

header("Content-Type: application/json");

/* ── Read callback payload ──────────────────────────────────── */
$raw  = file_get_contents("php://input");
$data = json_decode($raw, true);

/* ── Log for debugging (remove in production) ───────────────── */
file_put_contents(
    __DIR__ . '/mpesa_log.txt',
    date('Y-m-d H:i:s') . "\n" . $raw . "\n\n",
    FILE_APPEND
);

/* ── Parse callback ─────────────────────────────────────────── */
$callback   = $data['Body']['stkCallback'] ?? null;
$resultCode = $callback['ResultCode']      ?? -1;
$metadata   = $callback['CallbackMetadata']['Item'] ?? [];

if (!$callback) {
    http_response_code(400);
    echo json_encode(["ResultCode" => 1, "ResultDesc" => "Invalid callback"]);
    exit();
}

/* ── Extract values from metadata ───────────────────────────── */
$mpesaRef = '';
foreach ($metadata as $item) {
    if ($item['Name'] === 'MpesaReceiptNumber') $mpesaRef = $item['Value'] ?? '';
}

/* ── Extract order ID from AccountReference ─────────────────── */
preg_match('/DRIPSHOP-(\d+)/i', $callback['AccountReference'] ?? '', $match);
$orderId = intval($match[1] ?? 0);

/* ── Update order in DB ─────────────────────────────────────── */
$conn = new mysqli(
    "sql210.infinityfree.com",
    "if0_41239991",
    "Kevin542007",
    "if0_41239991_ecommerce"
);

if (!$conn->connect_error && $orderId > 0) {
    if ($resultCode == 0) {
        /* Payment successful */
        $stmt = $conn->prepare("UPDATE orders SET status='paid', mpesa_ref=? WHERE id=?");
        $stmt->bind_param("si", $mpesaRef, $orderId);
        $stmt->execute();
        $stmt->close();
    } else {
        /* Payment failed or cancelled */
        $stmt = $conn->prepare("UPDATE orders SET status='failed' WHERE id=?");
        $stmt->bind_param("i", $orderId);
        $stmt->execute();
        $stmt->close();
    }
    $conn->close();
}

/* ── Always return 200 to M-Pesa (prevents retries) ─────────── */
echo json_encode(["ResultCode" => 0, "ResultDesc" => "Accepted"]);
