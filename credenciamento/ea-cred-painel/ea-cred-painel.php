<?php
/**
 * Plugin Name: EA Credenciamento – Painel de vendas
 * Description: Layout do site de credenciamento no padrão Esthetic Aligner e cadastro da Agenda de cursos e do Clube de vantagens pelo time de vendas (enviados automaticamente ao Portal do Credenciado).
 * Version: 1.0.0
 * Author: Esthetic Aligner
 */
if (!defined('ABSPATH')) exit;

const EACP_OPCAO = 'eacp_config';
const EACP_CAP = 'ea_create_partners';
const EACP_LOGO = 'https://portal2.estheticaligner.com.br/wp-content/uploads/ea_esthetic-aligner_branco_circuloazul.png';

function eacp_cfg() {
    $c = get_option(EACP_OPCAO, []);
    return array_merge(['url' => 'https://portal2.estheticaligner.com.br/wp-json/ea-portal/v1', 'chave' => ''], is_array($c) ? $c : []);
}
function eacp_pode() { return is_user_logged_in() && (current_user_can(EACP_CAP) || current_user_can('manage_options')); }

/** Chamada à API do portal. */
function eacp_api($metodo, $rota, $dados = null) {
    $c = eacp_cfg();
    if (!$c['chave']) return new WP_Error('config', 'A conexão com o portal ainda não foi configurada. Avise o administrador.');
    $args = ['method' => $metodo, 'timeout' => 40, 'headers' => ['Authorization' => 'Bearer ' . $c['chave'], 'Accept' => 'application/json']];
    if ($dados !== null) { $args['headers']['Content-Type'] = 'application/json'; $args['body'] = wp_json_encode($dados); }
    $r = wp_remote_request(untrailingslashit($c['url']) . $rota, $args);
    if (is_wp_error($r)) return new WP_Error('rede', 'Não foi possível falar com o portal agora. Tente de novo em instantes.');
    $j = json_decode(wp_remote_retrieve_body($r), true);
    $cod = wp_remote_retrieve_response_code($r);
    if ($cod >= 400) return new WP_Error('api', is_array($j) && !empty($j['message']) ? $j['message'] : 'O portal recusou o pedido (' . $cod . ').');
    return $j;
}

// ------------------------------------------------------------ configuração (admin)
add_action('admin_menu', function () {
    add_submenu_page('ea-credenciamento', 'Agenda e Clube', 'Agenda e Clube', 'manage_options', 'eacp-config', 'eacp_config_pagina');
}, 30);
function eacp_config_pagina() {
    if (isset($_POST['eacp_salvar']) && check_admin_referer('eacp_config')) {
        $c = eacp_cfg();
        $c['url'] = esc_url_raw(trim(wp_unslash($_POST['url'] ?? ''))) ?: $c['url'];
        $nova = trim(sanitize_text_field(wp_unslash($_POST['chave'] ?? '')));
        if ($nova !== '') $c['chave'] = $nova;
        update_option(EACP_OPCAO, $c, false);
        $t = eacp_api('GET', '/opcoes');
        echo is_wp_error($t) ? '<div class="notice notice-error"><p>Salvo, mas a conexão falhou: ' . esc_html($t->get_error_message()) . '</p></div>' : '<div class="notice notice-success"><p>Conexão com o portal funcionando ✓</p></div>';
    }
    $c = eacp_cfg();
    ?>
    <div class="wrap"><h1>Agenda de cursos e Clube de vantagens</h1>
    <p>O time de vendas cadastra cursos e parceiros na página do credenciamento (abas <b>Agenda de cursos</b> e <b>Clube de vantagens</b>) e tudo é enviado automaticamente ao Portal do Credenciado e ao site.</p>
    <form method="post"><?php wp_nonce_field('eacp_config'); ?>
      <table class="form-table">
        <tr><th>Endereço da API do portal</th><td><input type="url" name="url" value="<?php echo esc_attr($c['url']); ?>" class="regular-text" style="width:520px"><p class="description">Quando o portal novo for para o endereço oficial, troque para https://portal.estheticaligner.com.br/wp-json/ea-portal/v1</p></td></tr>
        <tr><th>Chave de acesso</th><td><input type="password" name="chave" value="" placeholder="<?php echo $c['chave'] ? '•••••••• (já configurada — deixe em branco para manter)' : 'Cole a chave do portal'; ?>" style="width:520px" autocomplete="off"><p class="description">No portal: Portal do Credenciado → Integrações → Copiar.</p></td></tr>
      </table>
      <p><button class="button button-primary" name="eacp_salvar" value="1">Salvar e testar a conexão</button></p>
    </form></div>
    <?php
}

// ------------------------------------------------------------ layout do site (todas as páginas públicas)
add_filter('template_include', function ($t) {
    if (is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST) || is_feed() || is_robots()) return $t;
    return __DIR__ . '/app.php';
}, 99);
add_filter('show_admin_bar', fn($v) => current_user_can('manage_options') ? $v : false);
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('eacp-fontes', 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Open+Sans:wght@400;500;600;700&display=swap', [], null);
    wp_enqueue_style('eacp', plugins_url('assets/painel.css', __FILE__), [], '1.0.0');
}, 99);
add_filter('login_redirect', fn($to, $req, $u) => (!is_wp_error($u) && $u && !user_can($u, 'manage_options')) ? home_url('/') : $to, 10, 3);

// ------------------------------------------------------------ gravação (formulários do painel)
function eacp_voltar($aba, $msg, $erro = false, $extra = []) {
    $q = array_merge(['aba' => $aba, ($erro ? 'erro' : 'ok') => $msg], $extra);
    wp_safe_redirect(add_query_arg(array_map('rawurlencode', $q), home_url('/'))); exit;
}
function eacp_imagem_enviada() {
    if (empty($_FILES['imagem']['tmp_name']) || !is_uploaded_file($_FILES['imagem']['tmp_name'])) return [];
    $tipo = wp_check_filetype_and_ext($_FILES['imagem']['tmp_name'], $_FILES['imagem']['name']);
    if (!in_array($tipo['type'] ?? '', ['image/jpeg', 'image/png', 'image/webp'], true)) return ['erro' => 'A imagem precisa ser JPG, PNG ou WEBP.'];
    if (filesize($_FILES['imagem']['tmp_name']) > 5 * 1024 * 1024) return ['erro' => 'A imagem pode ter no máximo 5 MB.'];
    return ['imagem_base64' => 'data:' . $tipo['type'] . ';base64,' . base64_encode(file_get_contents($_FILES['imagem']['tmp_name']))];
}
add_action('admin_post_eacp_curso', function () {
    if (!eacp_pode() || !check_admin_referer('eacp_curso')) wp_die('Sem permissão.');
    $id = (int) ($_POST['id'] ?? 0);
    $t = fn($k) => trim(sanitize_text_field(wp_unslash($_POST[$k] ?? '')));
    if (!empty($_POST['excluir']) && $id) { $r = eacp_api('DELETE', '/cursos/' . $id); is_wp_error($r) ? eacp_voltar('agenda', $r->get_error_message(), true) : eacp_voltar('agenda', 'Curso removido da agenda.'); }
    $d = ['titulo' => $t('titulo'), 'descricao' => sanitize_textarea_field(wp_unslash($_POST['descricao'] ?? '')), 'data' => $t('data'), 'fim' => $t('fim'), 'hora_inicio' => $t('hora_inicio'), 'hora_fim' => $t('hora_fim'),
        'formato' => $t('formato'), 'cidade' => $t('cidade'), 'local' => $t('local'), 'ministrado_por' => $t('ministrado_por'), 'link' => $t('link'), 'texto_botao' => $t('texto_botao') ?: 'Inscreva-se',
        'situacao' => $t('situacao'), 'destaque' => !empty($_POST['destaque']), 'publicado' => empty($_POST['rascunho'])];
    if ($d['titulo'] === '' || !preg_match('~^\d{4}-\d{2}-\d{2}$~', $d['data'])) eacp_voltar('agenda', 'Preencha pelo menos o nome do curso e a data.', true, ['editar' => $id ?: 'novo']);
    $img = eacp_imagem_enviada(); if (!empty($img['erro'])) eacp_voltar('agenda', $img['erro'], true, ['editar' => $id ?: 'novo']);
    $r = eacp_api('POST', '/cursos' . ($id ? '/' . $id : ''), $d + $img);
    is_wp_error($r) ? eacp_voltar('agenda', $r->get_error_message(), true, ['editar' => $id ?: 'novo']) : eacp_voltar('agenda', $id ? 'Curso atualizado no portal e no site.' : 'Curso publicado no portal e no site.');
});
add_action('admin_post_eacp_parceiro', function () {
    if (!eacp_pode() || !check_admin_referer('eacp_parceiro')) wp_die('Sem permissão.');
    $id = (int) ($_POST['id'] ?? 0);
    $t = fn($k) => trim(sanitize_text_field(wp_unslash($_POST[$k] ?? '')));
    if (!empty($_POST['excluir']) && $id) { $r = eacp_api('DELETE', '/parceiros/' . $id); is_wp_error($r) ? eacp_voltar('clube', $r->get_error_message(), true) : eacp_voltar('clube', 'Parceiro removido do clube.'); }
    $d = ['nome' => $t('nome'), 'descricao' => sanitize_textarea_field(wp_unslash($_POST['descricao'] ?? '')), 'beneficio' => $t('beneficio'), 'cupom' => $t('cupom'),
        'link' => $t('link'), 'texto_botao' => $t('texto_botao') ?: 'Ir para o site', 'categoria' => $t('categoria'), 'publicado' => empty($_POST['rascunho'])];
    if ($d['nome'] === '') eacp_voltar('clube', 'Preencha o nome do parceiro.', true, ['editar' => $id ?: 'novo']);
    $img = eacp_imagem_enviada(); if (!empty($img['erro'])) eacp_voltar('clube', $img['erro'], true, ['editar' => $id ?: 'novo']);
    $r = eacp_api('POST', '/parceiros' . ($id ? '/' . $id : ''), $d + $img);
    is_wp_error($r) ? eacp_voltar('clube', $r->get_error_message(), true, ['editar' => $id ?: 'novo']) : eacp_voltar('clube', $id ? 'Parceiro atualizado no portal.' : 'Parceiro publicado no portal.');
});
