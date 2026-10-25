<?php
// ================= CONFIGURA AQUÍ =================
// Email al que te llega un aviso con cada lead nuevo (déjalo vacío para no recibir avisos)
const EMAIL_AVISO = 'diegocolungoteam@gmail.com';
// Clave para descargar tus leads en Excel/CSV desde ver-leads.php?clave=TU_CLAVE
// Pon una larga y que solo sepas tú. Mientras esté vacía, la descarga está desactivada
const CLAVE_LEADS = '';
// ===================================================

// Los leads se guardan en este fichero. Empieza con un bloqueo de PHP para que
// nadie pueda leerlo desde el navegador aunque sepa la dirección
const FICHERO_LEADS = __DIR__ . '/leads-guardados.php';
const CABECERA_LEADS = "<?php http_response_code(404); exit; ?>\n";

const CAMPOS_LEAD = ['fecha', 'nombre', 'email', 'perfil', 'edad', 'situacion', 'momento',
  'entreno', 'sueno', 'semana', 'probado', 'analitica', 'causa', 'compromiso', 'origen'];
