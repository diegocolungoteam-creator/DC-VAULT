<?php
// Descarga todos los leads en CSV (se abre en Excel o Google Sheets): ver-leads.php?clave=TU_CLAVE
require __DIR__ . '/config-leads.php';

if (CLAVE_LEADS === '' || !hash_equals(CLAVE_LEADS, (string) ($_GET['clave'] ?? ''))) {
  http_response_code(404); exit;
}

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="leads-primex-' . date('Y-m-d') . '.csv"');
$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF"); // para que Excel lea bien tildes y eñes
fputcsv($out, CAMPOS_LEAD, ';');

if (file_exists(FICHERO_LEADS)) {
  foreach (file(FICHERO_LEADS, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $i => $linea) {
    if ($i === 0) continue; // cabecera de bloqueo
    $lead = json_decode($linea, true);
    if (!is_array($lead)) continue;
    $fila = [];
    foreach (CAMPOS_LEAD as $campo) {
      $v = (string) ($lead[$campo] ?? '');
      // Evita que Excel ejecute fórmulas metidas en un campo
      if ($v !== '' && strpbrk($v[0], '=+-@') !== false) $v = "'" . $v;
      $fila[] = $v;
    }
    fputcsv($out, $fila, ';');
  }
}
