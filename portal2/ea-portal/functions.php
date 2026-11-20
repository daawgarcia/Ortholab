<?php
/**
 * EA Portal do Credenciado – tema-filho do Jupiter.
 */
if (!defined('ABSPATH')) exit;

define('EAPT_VERSION', '1.0.0');
define('EAPT_LOGO', content_url('/uploads/ea_esthetic-aligner_branco_circuloazul.png'));
define('EAPT_SITE_PACIENTE', 'https://estheticaligner.com.br/');
define('EAPT_ORTHOLAB', 'https://ortholab.estheticaligner.com.br/');

add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    register_nav_menus(['ea_portal_menu' => 'Menu do portal (topo)']);
});

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('eapt-fontes', 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Open+Sans:wght@400;500;600;700&display=swap', [], null);
    // versão = data do arquivo, para o CDN/cache trocar sempre que o arquivo mudar
    $dir = get_stylesheet_directory();
    wp_enqueue_style('eapt-portal', get_stylesheet_directory_uri() . '/assets/portal.css', [], (string) filemtime($dir . '/assets/portal.css'));
    wp_enqueue_script('eapt-portal', get_stylesheet_directory_uri() . '/assets/portal.js', [], (string) filemtime($dir . '/assets/portal.js'), true);
}, 100);

/* ------------------------------------------------------------------ acesso: o portal é só para credenciados */
function eapt_pagina_livre() {
    if (is_front_page() || is_404()) return true;
    $livres = ['resgatar-senha', 'password-reset', 'register', 'cookies-e-anuncios', 'termos-e-condicoes-2', 'account'];
    $obj = get_queried_object();
    return $obj instanceof WP_Post && in_array($obj->post_name, $livres, true);
}

add_action('template_redirect', function () {
    if (is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST) || is_feed()) return;
    // logado na tela inicial -> vai direto para a Área do Credenciado
    if (is_front_page() && is_user_logged_in() && !isset($_GET['entrar'])) {
        wp_safe_redirect(home_url('/area-do-credenciado/'));
        exit;
    }
    if (!is_user_logged_in() && !eapt_pagina_livre()) {
        $volta = (is_ssl() ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        wp_safe_redirect(add_query_arg('redirect_to', rawurlencode($volta), home_url('/')));
        exit;
    }
}, 1);

// login com erro volta para a tela de login do portal (e não para o wp-login padrão)
add_action('wp_login_failed', function () {
    $ref = wp_get_referer();
    if ($ref && strpos($ref, 'wp-login') === false && strpos($ref, 'wp-admin') === false) {
        wp_safe_redirect(add_query_arg('login', 'erro', remove_query_arg('login', $ref)));
        exit;
    }
});
add_filter('authenticate', function ($user, $username, $password) {
    if (isset($_POST['eapt_login']) && (empty($username) || empty($password))) {
        wp_safe_redirect(add_query_arg('login', 'vazio', home_url('/')));
        exit;
    }
    return $user;
}, 1, 3);

// depois do login: credenciado vai para a área dele; equipe também (o painel continua em /wp-admin)
add_filter('login_redirect', function ($to, $requested, $user) {
    if (is_wp_error($user)) return $to;
    if ($requested && strpos($requested, 'wp-admin') === false) return $requested;
    return user_can($user, 'edit_pages') && strpos((string) $requested, 'wp-admin') !== false ? $to : home_url('/area-do-credenciado/');
}, 20, 3);

// sem barra preta do WordPress para os credenciados
add_filter('show_admin_bar', fn($show) => current_user_can('edit_pages') ? $show : false);

/* ------------------------------------------------------------------ ambiente de teste: e-mails não saem para os dentistas */
add_filter('pre_wp_mail', function ($retorno, $atts) {
    $host = parse_url(home_url(), PHP_URL_HOST);
    if ($host !== 'portal2.estheticaligner.com.br') return $retorno;
    $para = is_array($atts['to']) ? implode(', ', $atts['to']) : $atts['to'];
    remove_all_filters('pre_wp_mail');
    wp_mail('testeortholab2@estheticaligner.com.br', '[portal2 – era para: ' . $para . '] ' . $atts['subject'], $atts['message'], $atts['headers'] ?? '', $atts['attachments'] ?? []);
    return true;
}, 10, 2);

// portal2 não aparece no Google
add_filter('wp_robots', function ($r) {
    if (parse_url(home_url(), PHP_URL_HOST) === 'portal2.estheticaligner.com.br') { $r['noindex'] = true; $r['nofollow'] = true; }
    return $r;
});

/* ------------------------------------------------------------------ itens do menu e da Área do Credenciado */
function eapt_icone($nome) {
    $i = [
        'calc' => '<path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 3v3h8V6H8Zm0 6h2v2H8v-2Zm3 0h2v2h-2v-2Zm3 0h2v5h-2v-5Zm-6 3h2v2H8v-2Zm3 0h2v2h-2v-2Z"/>',
        'sono' => '<path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z"/><path d="M14 4h4l-4 4h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
        'play' => '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm6 2.5v5l4.5-2.5L10 7.5ZM3 20h18v1.5H3V20Z"/>',
        'lab' => '<path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-6v2h3v2H7v-2h3v-2H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v8h14V6H5Zm2 2h6v1.5H7V8Zm0 3h10v1.5H7V11Z"/>',
        'suporte' => '<path d="M12 3a8 8 0 0 0-8 8v4a3 3 0 0 0 3 3h1v-7H6a6 6 0 0 1 12 0h-2v7h1.5a2.5 2.5 0 0 1-2.4 2H13v1.5h2.1A4 4 0 0 0 19 18v-7a8 8 0 0 0-7-8Z"/>',
        'download' => '<path d="M12 3v10.2l3.6-3.6 1.1 1.1L12 16.4l-4.7-4.7 1.1-1.1L12 13.2V3h0Zm-8 15h16v2.5H4V18Z"/>',
        'mkt' => '<path d="M3 10v4h3l6 4V6L6 10H3Zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z"/>',
        'dica' => '<path d="M9 21h6v-1.5H9V21Zm3-19a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2Z"/>',
        'clube' => '<path d="M12 2 9.2 8.3 2.3 9l5.2 4.6L6 20.4 12 17l6 3.4-1.5-6.8L21.7 9l-6.9-.7L12 2Z"/>',
        'loja' => '<path d="M4 4h16l-1.2 6H5.2L4 4Zm1.5 8h13l-.8 8H6.3l-.8-8ZM9 14v4h1.5v-4H9Zm4.5 0v4H15v-4h-1.5Z"/>',
        'webinar' => '<path d="M3 5h18v11H3V5Zm2 2v7h14V7H5Zm3 11h8v2H8v-2Z"/><circle cx="12" cy="10.5" r="2.2"/>',
        'podcast' => '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Zm-6 9h1.6a4.4 4.4 0 0 0 8.8 0H18a6 6 0 0 1-5.2 5.9V20h3v1.5h-7.6V20h3v-3.1A6 6 0 0 1 6 11Z"/>',
        'fin' => '<path d="M3 6h18v12H3V6Zm2 2v8h14V8H5Zm7 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM6 10h2v1.5H6V10Zm10 2.5h2V14h-2v-1.5Z"/>',
        'sair' => '<path d="M10 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-9v-2h9V5h-9V3Zm1.6 5.4L15.2 12l-3.6 3.6-1.1-1.1 1.7-1.7H3v-1.6h9.2l-1.7-1.7 1.1-1.1Z"/>',
        'paciente' => '<path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 1.8c-4.2 0-8 2.1-8 5.2V21h16v-2c0-3.1-3.8-5.2-8-5.2Z"/>',
    ];
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' . ($i[$nome] ?? '') . '</svg>';
}

function eapt_atalhos() {
    return [
        ['Vídeo aulas', 'Curso do credenciado, webinars, mentorias, dicas clínicas e podcast.', home_url('/video-aulas/'), 'play'],
        ['Ortholab', 'Envio de casos, documentação digital e acompanhamento do paciente.', EAPT_ORTHOLAB, 'lab', true],
        ['Downloads', 'Guia de início rápido, fichas, checagem 3D, preços e serviços, manuais.', home_url('/downloads/'), 'download'],
        ['Marketing', 'Folders, vídeos e posts para divulgar o tratamento.', home_url('/marketing/'), 'mkt'],
        ['Suporte ao credenciado', 'Dúvidas frequentes e chamado com nossa equipe de ortodontistas.', home_url('/suporte/'), 'suporte'],
        ['Clube de vantagens', 'Descontos e benefícios com parceiros Esthetic Aligner.', home_url('/eaclub/'), 'clube'],
        ['Área financeira', 'Consulte todos os seus títulos em um só lugar.', home_url('/financeiro/'), 'fin'],
        ['Esthetic Aligner Store', 'Confira nossa loja.', home_url('/esthetic-aligner-store/'), 'loja'],
    ];
}

function eapt_menu() {
    return [
        ['Início', home_url('/area-do-credenciado/'), 'area-do-credenciado'],
        ['Vídeo aulas', home_url('/video-aulas/'), 'video-aulas'],
        ['Downloads', home_url('/downloads/'), 'downloads'],
        ['Marketing', home_url('/marketing/'), 'marketing'],
        ['Suporte', home_url('/suporte/'), 'suporte'],
        ['Ortholab', EAPT_ORTHOLAB, ''],
    ];
}

function eapt_ativo($slug) {
    if (!$slug) return false;
    $obj = get_queried_object();
    return $obj instanceof WP_Post && $obj->post_name === $slug;
}

/** Faixa de título das páginas internas. */
function eapt_faixa($titulo, $sub = '') {
    echo '<section class="eap-faixa"><div class="eap-wrap"><h1>' . esc_html($titulo) . '</h1>';
    if ($sub) echo '<p>' . esc_html($sub) . '</p>';
    echo '</div></section>';
}

// título da aba
add_filter('document_title_separator', fn() => '·');

// páginas antigas de aula/webinar levam para a aula no novo player
add_action('template_redirect', function () {
    if (!is_page() || !is_user_logged_in()) return;
    $id = get_queried_object_id();
    $a = get_posts(['post_type' => 'ea_aula', 'meta_key' => '_eap_legado', 'meta_value' => 'page-' . $id, 'numberposts' => 1, 'fields' => 'ids']);
    if ($a) { wp_safe_redirect(add_query_arg('aula', $a[0], home_url('/video-aulas/'))); exit; }
}, 5);
