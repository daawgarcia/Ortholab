<?php
/**
 * Ferramentas do dentista: certificado do Curso do Credenciado.
 * O certificado é liberado quando todas as aulas da categoria "Curso do Credenciado" estão marcadas como assistidas.
 */
if (!defined('ABSPATH')) exit;

const EAP_CURSO_NOME = 'Curso do Credenciado';

function eap_curso_ids() {
    $t = get_term_by('name', EAP_CURSO_NOME, 'ea_trilha');
    if (!$t) return [];
    return array_map('intval', get_posts(['post_type' => 'ea_aula', 'numberposts' => -1, 'fields' => 'ids', 'post_status' => 'publish', 'tax_query' => [['taxonomy' => 'ea_trilha', 'terms' => $t->term_id]]]));
}

/** Data (Y-m-d) em que concluiu o curso, ou '' se ainda não concluiu. */
function eap_curso_concluido($uid = 0) {
    $uid = $uid ?: get_current_user_id();
    $data = (string) get_user_meta($uid, 'eap_curso_concluido_em', true);
    if ($data) return $data;
    $ids = eap_curso_ids();
    if (!$ids || !function_exists('eap_aulas_feitas')) return '';
    if (array_diff($ids, eap_aulas_feitas($uid))) return '';
    $data = current_time('Y-m-d');
    update_user_meta($uid, 'eap_curso_concluido_em', $data);
    if (function_exists('eap_evento')) eap_evento('curso_concluido');
    return $data;
}

function eap_data_extenso($ymd) {
    $m = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    [$a, $mm, $d] = array_map('intval', explode('-', $ymd));
    return $d . ' de ' . $m[$mm] . ' de ' . $a;
}

function eap_nome_certificado($uid = 0) {
    $uid = $uid ?: get_current_user_id();
    $n = (string) get_user_meta($uid, 'eap_nome_certificado', true);
    if ($n) return $n;
    $u = get_userdata($uid);
    return $u ? (trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name) : '';
}

add_action('wp_ajax_eap_certificado', function () {
    if (!check_ajax_referer('eap_feitas', '_n', false)) wp_send_json_error('sessao', 403);
    $data = eap_curso_concluido();
    if (!$data) wp_send_json_error('incompleto', 400);
    $nome = trim(preg_replace('/\s+/', ' ', sanitize_text_field(wp_unslash($_POST['nome'] ?? ''))));
    if (mb_strlen($nome) < 5) wp_send_json_error('nome', 400);
    $nome = mb_substr($nome, 0, 80);
    update_user_meta(get_current_user_id(), 'eap_nome_certificado', $nome);
    if (function_exists('eap_evento')) eap_evento('certificado');
    wp_send_json_success(['nome' => $nome, 'data' => eap_data_extenso($data)]);
});
