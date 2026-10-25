<?php
// Recibe el lead del funnel, lo guarda en leads-guardados.php y te avisa por email
require __DIR__ . '/config-leads.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{"ok":false}'; exit; }
// Honeypot: los bots rellenan este campo oculto, las personas no
if (!empty($_POST['bot-field'])) { echo '{"ok":true}'; exit; }

$lead = [];
foreach (CAMPOS_LEAD as $campo) {
  $valor = isset($_POST[$campo]) ? trim((string) $_POST[$campo]) : '';
  $lead[$campo] = mb_substr(preg_replace('/[\r\n\t]+/', ' ', $valor), 0, 500);
}
$lead['fecha'] = date('Y-m-d H:i:s');

if (mb_strlen($lead['nombre']) < 2 || !filter_var($lead['email'], FILTER_VALIDATE_EMAIL)) {
  http_response_code(422); echo '{"ok":false}'; exit;
}

$nuevo = !file_exists(FICHERO_LEADS);
$f = fopen(FICHERO_LEADS, 'a');
if (!$f) { http_response_code(500); echo '{"ok":false}'; exit; }
flock($f, LOCK_EX);
if ($nuevo) fwrite($f, CABECERA_LEADS);
fwrite($f, json_encode($lead, JSON_UNESCAPED_UNICODE) . "\n");
flock($f, LOCK_UN);
fclose($f);

if (EMAIL_AVISO !== '') {
  $texto = "Nuevo lead del funnel PRIME-X\n\n";
  foreach ($lead as $k => $v) $texto .= ucfirst($k) . ": $v\n";
    $host = preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
  $cabeceras = "From: PRIME-X <no-reply@$host>\r\nReply-To: {$lead['email']}\r\nContent-Type: text/plain; charset=utf-8";
  @mail(EMAIL_AVISO, '=?UTF-8?B?' . base64_encode("Nuevo lead PRIME-X: {$lead['nombre']} ({$lead['perfil']})") . '?=', $texto, $cabeceras);
}

echo '{"ok":true}';
