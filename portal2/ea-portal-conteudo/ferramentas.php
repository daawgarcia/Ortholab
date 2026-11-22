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
    $m = ['nome' => $t('nome'), 'whats' => $t('whats', 30), 'insta' => ltrim($t('insta', 40), '@'), 'site' => $t('site', 60), 'cor' => in_array($_POST['cor'] ?? '', ['auto', 'claro', 'escuro', 'azul'], true) ? $_POST['cor'] : 'auto', 'logo' => ''];
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

/* ------------------------------------------------------------------ primeiros passos do credenciado */
function eap_passos($uid = 0) {
    global $wpdb;
    $uid = $uid ?: get_current_user_id();
    $t = function_exists('eap_met_tabela') ? eap_met_tabela() : '';
    $ev = [];
    if ($t) foreach ($wpdb->get_results($wpdb->prepare("SELECT tipo, extra FROM $t WHERE user_id = %d AND tipo IN ('post_baixar','sistema','app') GROUP BY tipo, extra", $uid)) as $r) $ev[$r->tipo . ':' . $r->extra] = 1;
    $tem = fn($tipo, $extra = null) => $extra === null ? (bool) array_filter(array_keys($ev), fn($k) => strpos($k, $tipo . ':') === 0) : isset($ev[$tipo . ':' . $extra]);
    $est = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'ea_estimativa' AND post_status = 'private' AND post_author = %d", $uid));
    $p = [
        'curso'      => ['Assista ao Curso do Credenciado', 'As 13 aulas liberam o seu certificado.', home_url('/video-aulas/?trilha=curso-do-credenciado'), function_exists('eap_curso_concluido') && eap_curso_concluido($uid), 'video-aulas'],
        'marca'      => ['Cadastre a marca do seu consultório', 'Logo e WhatsApp, uma vez só: entram nos posts e no orçamento.', home_url('/marketing/#minha-marca'), !empty(eap_marca($uid)['nome']), 'marketing'],
        'estimativa' => ['Faça uma estimativa com IA', 'Veja o pacote indicado e gere o orçamento com a sua marca.', home_url('/simulador-de-estimativa-e-pacote/'), $est > 0, 'ia-estimativa'],
        'post'       => ['Baixe um post para suas redes', 'Pronto para postar, com a sua marca.', home_url('/marketing/'), $tem('post_baixar'), 'posts-marketing'],
        'caso'       => ['Envie um caso pelo Envio Fácil', 'Os arquivos do paciente já identificados pelo portal.', home_url('/?eap_ir=enviofacil'), $tem('sistema', 'enviofacil'), 'enviofacil'],
        'app'        => ['Instale o portal no celular', 'Abra direto da tela inicial, como um app.', '#instalar', $tem('app'), ''],
    ];
    if (function_exists('eap_visivel')) $p = array_filter($p, fn($x) => !$x[4] || eap_visivel($x[4]));
    return $p;
}
add_action('wp_ajax_eap_passos_ocultar', function () {
    if (!check_ajax_referer('eap_ferr', '_n', false)) wp_send_json_error('', 403);
    update_user_meta(get_current_user_id(), 'eap_passos_ocultos', 1);
    wp_send_json_success();
});

/* ------------------------------------------------------------------ pesquisa de satisfação (0 a 10) */
add_action('init', function () {
    register_post_type('ea_pesquisa', ['labels' => ['name' => 'Pesquisa de satisfação', 'singular_name' => 'Resposta'], 'public' => false, 'show_ui' => true, 'show_in_menu' => 'eap-portal',
        'capabilities' => ['create_posts' => 'do_not_allow'], 'map_meta_cap' => true, 'supports' => ['title']]);
});
add_filter('manage_ea_pesquisa_posts_columns', fn($c) => ['cb' => $c['cb'], 'title' => 'Credenciado', 'eap_nota' => 'Nota', 'eap_coment' => 'Comentário', 'date' => 'Data']);
add_action('manage_ea_pesquisa_posts_custom_column', function ($col, $id) {
    if ($col === 'eap_nota') { $n = (int) get_post_meta($id, '_nota', true); echo '<b style="color:' . ($n >= 9 ? '#22a565' : ($n >= 7 ? '#d9861c' : '#e2574c')) . '">' . $n . '</b>'; }
    if ($col === 'eap_coment') echo esc_html(get_post_field('post_content', $id));
}, 10, 2);

/** Mostra a pesquisa a partir do 3º dia de uso, no máximo a cada 90 dias; "agora não" adia 14 dias. */
function eap_pesquisa_mostrar($uid = 0) {
    $uid = $uid ?: get_current_user_id();
    if (!$uid || (function_exists('eap_visivel') && !eap_visivel('pesquisa'))) return false;
    if (isset($_GET['eap_pesquisa']) && user_can($uid, 'edit_pages')) return true; // para a equipe testar/mostrar
    if ((int) get_user_meta($uid, 'eap_pesquisa_ate', true) > time()) return false;
    global $wpdb;
    $dias = function_exists('eap_met_tabela') ? (int) $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM ' . eap_met_tabela() . " WHERE user_id = %d AND tipo = 'acesso'", $uid)) : 0;
    return $dias >= 3;
}
add_action('wp_ajax_eap_pesquisa', function () {
    if (!check_ajax_referer('eap_ferr', '_n', false)) wp_send_json_error('', 403);
    $uid = get_current_user_id();
    if (($_POST['acao'] ?? '') === 'depois') { update_user_meta($uid, 'eap_pesquisa_ate', time() + 14 * DAY_IN_SECONDS); wp_send_json_success(); }
    $nota = (int) ($_POST['nota'] ?? -1);
    if ($nota < 0 || $nota > 10) wp_send_json_error('nota', 400);
    $u = wp_get_current_user();
    $id = wp_insert_post(['post_type' => 'ea_pesquisa', 'post_status' => 'private', 'post_author' => $uid,
        'post_title' => (trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name) . ' – nota ' . $nota,
        'post_content' => mb_substr(sanitize_textarea_field(wp_unslash($_POST['coment'] ?? '')), 0, 1000)]);
    if ($id && !is_wp_error($id)) { update_post_meta($id, '_nota', $nota); update_post_meta($id, '_equipe', user_can($uid, 'edit_pages') ? 1 : 0); }
    update_user_meta($uid, 'eap_pesquisa_ate', time() + 90 * DAY_IN_SECONDS);
    wp_send_json_success();
});

/* ------------------------------------------------------------------ limpar meus dados de teste (equipe) */
add_action('admin_post_eap_limpar_testes', function () {
    if (!current_user_can('edit_pages') || !check_admin_referer('eap_limpar_testes')) wp_die('Sem permissão');
    global $wpdb;
    $uid = get_current_user_id();
    foreach (['eap_marca', 'eap_valores', 'eap_curso_concluido_em', 'eap_nome_certificado', 'eap_ultima_aula', 'eap_avisos_vistos', 'eap_passos_ocultos', 'eap_pesquisa_ate', 'eap_acesso_dia', 'eap_ultimo_acesso'] as $k) delete_user_meta($uid, $k);
    update_user_meta($uid, 'eap_aulas_feitas', []); // fica "vazio, mas definido": o navegador não reenvia marcações antigas
    if (function_exists('eap_met_tabela')) $wpdb->query('DELETE FROM ' . eap_met_tabela() . ' WHERE equipe = 1 OR user_id = ' . (int) $uid);
    foreach (get_posts(['post_type' => 'ea_ia_log', 'post_status' => 'any', 'numberposts' => -1, 'meta_key' => '_equipe', 'meta_value' => 1, 'fields' => 'ids']) as $p) wp_delete_post($p, true);
    foreach (get_posts(['post_type' => 'ea_pesquisa', 'post_status' => 'any', 'numberposts' => -1, 'meta_key' => '_equipe', 'meta_value' => 1, 'fields' => 'ids']) as $p) wp_delete_post($p, true);
    if (!empty($_GET['avisos'])) foreach (get_posts(['post_type' => 'ea_aviso', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids']) as $p) { update_post_meta($p, '_eap_vistos', 0); update_post_meta($p, '_eap_cliques', 0); } // só antes de lançar
    foreach (get_posts(['post_type' => 'ea_estimativa', 'post_status' => 'private', 'author' => $uid, 'numberposts' => -1, 'fields' => 'ids']) as $p) wp_trash_post($p);
    delete_transient('eap_met_base');
    wp_safe_redirect(admin_url('admin.php?page=eap-resultados&limpo=1'));
    exit;
});
