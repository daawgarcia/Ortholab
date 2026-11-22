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

/* ------------------------------------------------------------------ minha marca (posts e orçamento) e meus valores */
function eap_marca($uid = 0) {
    $m = get_user_meta($uid ?: get_current_user_id(), 'eap_marca', true);
    return is_array($m) ? $m : [];
}
function eap_valores($uid = 0) {
    $v = get_user_meta($uid ?: get_current_user_id(), 'eap_valores', true);
    return array_merge(['unidade' => '', 'mid' => '', 'full' => '', 'parcelas' => '12', 'entrada' => '', 'pagamento' => 'Cartão de crédito, Pix ou boleto', 'validade' => '15', 'obs' => ''], is_array($v) ? $v : []);
}
add_action('wp_ajax_eap_marca', function () {
    if (!check_ajax_referer('eap_ferr', '_n', false)) wp_send_json_error('sessao', 403);
    $t = fn($k, $max = 80) => mb_substr(trim(sanitize_text_field(wp_unslash($_POST[$k] ?? ''))), 0, $max);
    $m = ['nome' => $t('nome'), 'whats' => $t('whats', 30), 'insta' => ltrim($t('insta', 40), '@'), 'site' => $t('site', 60), 'cor' => in_array($_POST['cor'] ?? '', ['claro', 'escuro', 'azul'], true) ? $_POST['cor'] : 'claro', 'logo' => ''];
    $logo = (string) wp_unslash($_POST['logo'] ?? '');
    if ($logo !== '') {
        if (strlen($logo) > 600000 || !preg_match('~^data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)$~', $logo, $mm)) wp_send_json_error('logo', 400);
        $bin = base64_decode($mm[2], true);
        $info = $bin ? @getimagesizefromstring($bin) : false;
        if (!$info || !in_array($info['mime'], ['image/png', 'image/jpeg'], true) || $info[0] > 1200 || $info[1] > 1200) wp_send_json_error('logo', 400);
        $m['logo'] = $logo;
    }
    update_user_meta(get_current_user_id(), 'eap_marca', $m);
    wp_send_json_success($m);
});
add_action('wp_ajax_eap_valores', function () {
    if (!check_ajax_referer('eap_ferr', '_n', false)) wp_send_json_error('sessao', 403);
    $v = eap_valores();
    foreach (array_keys($v) as $k) if (isset($_POST[$k])) $v[$k] = mb_substr(trim(sanitize_text_field(wp_unslash($_POST[$k]))), 0, $k === 'obs' ? 400 : 60);
    update_user_meta(get_current_user_id(), 'eap_valores', $v);
    wp_send_json_success($v);
});
function eap_ferr_cfg() {
    $u = wp_get_current_user();
    $cro = function_exists('eap_dado_atual') ? eap_dado_atual($u->ID, 'cro') : '';
    return ['u' => admin_url('admin-ajax.php'), 'n' => wp_create_nonce('eap_ferr'), 'marca' => eap_marca() ?: null, 'valores' => eap_valores(),
        'dentista' => ['nome' => trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name, 'cro' => $cro, 'whats' => function_exists('eap_dado_atual') ? eap_dado_atual($u->ID, 'whats') : '']];
}
