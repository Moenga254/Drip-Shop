<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$conn = new mysqli("sql210.infinityfree.com", "if0_41239991", "Kevin542007", "if0_41239991_ecommerce");

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed: " . $conn->connect_error]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

// ─── GET — Fetch all products OR single product by ?id= ───────────────────────
if ($method === 'GET') {
    header("Content-Type: application/json");

    // Single product
    if (isset($_GET['id']) && (int)$_GET['id'] > 0) {
        $id   = (int) $_GET['id'];
        $stmt = $conn->prepare("SELECT * FROM products WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $product = $result->fetch_assoc();

        if ($product) {
            echo json_encode($product);
        } else {
            http_response_code(404);
            echo json_encode(["error" => "Product not found"]);
        }

        $stmt->close();
        exit();
    }

    // All products
    $result = $conn->query("SELECT * FROM products");

    if (!$result) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to fetch products"]);
        exit();
    }

    $products = [];
    while ($row = $result->fetch_assoc()) {
        $products[] = $row;
    }

    echo json_encode($products);

    // ─── POST — Create a new product ─────────────────────────────────────────────
} elseif ($method === 'POST') {
    header("Content-Type: application/json");

    $name        = trim($_POST['name']        ?? '');
    $description = trim($_POST['description'] ?? '');
    $price       = $_POST['price']            ?? '';

    if (empty($name) || empty($description) || $price === '') {
        http_response_code(400);
        echo json_encode(["error" => "Missing required fields: name, description, price"]);
        exit();
    }

    $imagePath = '';
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = 'uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

        $ext     = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
        $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

        if (!in_array(strtolower($ext), $allowed)) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid image type. Allowed: jpg, jpeg, png, webp, gif"]);
            exit();
        }

        $filename  = uniqid('product_', true) . '.' . $ext;
        $imagePath = $uploadDir . $filename;

        if (!move_uploaded_file($_FILES['image']['tmp_name'], $imagePath)) {
            http_response_code(500);
            echo json_encode(["error" => "Failed to save image"]);
            exit();
        }
    } else {
        http_response_code(400);
        echo json_encode(["error" => "Product image is required"]);
        exit();
    }

    $stmt = $conn->prepare(
        "INSERT INTO products (name, description, price, image) VALUES (?, ?, ?, ?)"
    );
    $stmt->bind_param("ssds", $name, $description, $price, $imagePath);

    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode([
            "message" => "Product created successfully",
            "id"      => $conn->insert_id,
            "image"   => $imagePath
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to create product"]);
    }

    $stmt->close();

    // ─── PUT — Update an existing product ────────────────────────────────────────
} elseif ($method === 'PUT') {
    header("Content-Type: application/json");

    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(["error" => "Invalid or missing product ID"]);
        exit();
    }

    $input = json_decode(file_get_contents("php://input"), true);

    if (
        empty($input['name']) ||
        empty($input['description']) ||
        !isset($input['price']) ||
        empty($input['image'])
    ) {
        http_response_code(400);
        echo json_encode(["error" => "Missing required fields"]);
        exit();
    }

    $stmt = $conn->prepare(
        "UPDATE products SET name = ?, description = ?, price = ?, image = ? WHERE id = ?"
    );
    $stmt->bind_param("ssdsi", $input['name'], $input['description'], $input['price'], $input['image'], $id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            echo json_encode(["message" => "Product updated successfully"]);
        } else {
            http_response_code(404);
            echo json_encode(["error" => "Product not found or no changes made"]);
        }
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to update product"]);
    }

    $stmt->close();

    // ─── DELETE — Delete a product by ID ─────────────────────────────────────────
} elseif ($method === 'DELETE') {
    header("Content-Type: application/json");

    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(["error" => "Invalid or missing product ID"]);
        exit();
    }

    $stmt = $conn->prepare("DELETE FROM products WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            echo json_encode(["message" => "Product deleted successfully"]);
        } else {
            http_response_code(404);
            echo json_encode(["error" => "Product not found"]);
        }
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to delete product"]);
    }

    $stmt->close();
} else {
    header("Content-Type: application/json");
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
}

$conn->close();
