<?php
$url = 'https://script.google.com/macros/s/AKfycbzBJ__fMnqREXfHEykgO8xZnrnoz4onXyC4OpkzYCJ5IuUaG_4olRXKkEbczY7eDCU54Q/exec';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if ($response === false || $httpCode !== 200) {
    http_response_code(502);
    echo json_encode(['error' => 'Gagal fetch', 'code' => $httpCode]);
    exit;
}

echo $response;
