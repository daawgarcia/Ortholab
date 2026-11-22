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
    if (is_user_logged_in() && function_exists('eap_ferr_cfg') && (is_page('marketing') || is_page('simulador-de-estimativa-e-pacote'))) {
        wp_enqueue_script('eapt-marca', get_stylesheet_directory_uri() . '/assets/eap-marca.js', ['eapt-ferramentas'], (string) filemtime($dir . '/assets/eap-marca.js'), true);
        wp_add_inline_script('eapt-marca', 'window.EAP_FERR=' . wp_json_encode(eap_ferr_cfg()) . ';', 'before');
    }
    if (is_user_logged_in()) wp_enqueue_script('eapt-ferramentas', get_stylesheet_directory_uri() . '/assets/eap-ferramentas.js', [], (string) filemtime($dir . '/assets/eap-ferramentas.js'), true);
    if (is_user_logged_in() && function_exists('eap_aulas_feitas')) {
        wp_add_inline_script('eapt-portal', 'window.EAP_FEITAS=' . wp_json_encode(['tem' => metadata_exists('user', get_current_user_id(), 'eap_aulas_feitas'), 'ids' => array_map('strval', eap_aulas_feitas()), 'u' => admin_url('admin-ajax.php'), 'n' => wp_create_nonce('eap_feitas')]) . ';', 'before');
    }
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
    if (is_front_page() && is_user_logged_in() && !isset($_GET['entrar']) && !isset($_GET['eap_confirmar'])) {
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
add_action('wp_login_failed', function ($username = '', $erro = null) {
    $ref = wp_get_referer();
    if ($ref && strpos($ref, 'wp-login') === false && strpos($ref, 'wp-admin') === false) {
        $tipo = (is_wp_error($erro) && $erro->get_error_code() === 'eap_bloqueado') ? 'bloqueado' : 'erro';
        wp_safe_redirect(add_query_arg('login', $tipo, remove_query_arg('login', $ref)));
        exit;
    }
}, 10, 2);
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
    // tira cópias (Cc/Bcc) para nada sair do ambiente de teste; anota no assunto quem receberia
    $hs = $atts['headers'] ?? [];
    if (!is_array($hs)) $hs = preg_split('/\r?\n/', (string) $hs);
    $copias = [];
    $hs = array_values(array_filter($hs, function ($h) use (&$copias) {
        if (preg_match('/^\s*(cc|bcc)\s*:(.*)$/i', (string) $h, $m)) { $copias[] = trim($m[2]); return false; }
        return true;
    }));
    $extra = $copias ? ' + cópia: ' . implode(', ', $copias) : '';
    remove_all_filters('pre_wp_mail');
    wp_mail('testeortholab2@estheticaligner.com.br', '[portal2 – era para: ' . $para . $extra . '] ' . $atts['subject'], $atts['message'], $hs, $atts['attachments'] ?? []);
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
    $todos = [
        ['Vídeo aulas', 'Curso do credenciado, webinars, mentorias, dicas clínicas e podcast.', home_url('/video-aulas/'), 'play', false, 'video-aulas'],
        ['Ortholab', 'Envio de casos, documentação digital e acompanhamento do paciente.', eapt_link_ortholab(), 'lab', true, 'ortholab'],
        ['Esthetic Rewards', 'Seus pontos, categoria e prêmios do programa de fidelidade.', eapt_link_rewards(), 'clube', true, 'rewards'],
        ['Enviar caso – Envio Fácil', 'Mande os arquivos do paciente (STL, fotos ou ZIP) já identificado pelo portal.', home_url('/?eap_ir=enviofacil'), 'download', true, 'enviofacil'],
        ['Downloads', 'Guia de início rápido, fichas, checagem 3D, preços e serviços, manuais.', home_url('/downloads/'), 'download', false, 'downloads'],
        ['Marketing', 'Folders, vídeos e posts para divulgar o tratamento.', home_url('/marketing/'), 'mkt', false, 'marketing'],
        ['Suporte ao credenciado', 'Dúvidas frequentes e chamado com nossa equipe de ortodontistas.', home_url('/suporte/'), 'suporte', false, 'suporte'],
        ['Clube de vantagens', 'Descontos e benefícios com parceiros Esthetic Aligner.', home_url('/eaclub/'), 'loja', false, 'clube'],
        // Área financeira (consulta de títulos) oculta até a integração funcionar
        ['Esthetic Aligner Store', 'Confira nossa loja.', home_url('/esthetic-aligner-store/'), 'loja', false, 'store'],
        ['Dicas clínicas', 'Vídeos curtos com dicas práticas para o dia a dia.', add_query_arg('trilha', 'dicas-clinicas', home_url('/video-aulas/')), 'dica', false, 'dicas'],
    ];
    return array_values(array_filter($todos, fn($a) => eapt_visivel($a[5])));
}

/** Seção ligada em "O que aparece no portal" (plugin). Sem o plugin, tudo aparece. */
function eapt_visivel($chave) {
    return !function_exists('eap_visivel') || eap_visivel($chave);
}

function eapt_menu() {
    $todos = [
        ['Início', home_url('/area-do-credenciado/'), 'area-do-credenciado', ''],
        ['Vídeo aulas', home_url('/video-aulas/'), 'video-aulas', 'video-aulas'],
        ['Downloads', home_url('/downloads/'), 'downloads', 'downloads'],
        ['Marketing', home_url('/marketing/'), 'marketing', 'marketing'],
        ['Suporte', home_url('/suporte/'), 'suporte', 'suporte'],
        ['Clube', home_url('/eaclub/'), 'eaclub', 'clube'],
        ['Ortholab', eapt_link_ortholab(), '', 'ortholab'],
    ];
    return array_values(array_filter($todos, fn($m) => !$m[3] || eapt_visivel($m[3])));
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

// título da aba na tela de login
add_filter('pre_get_document_title', fn($t) => is_front_page() ? 'Portal do Credenciado · Esthetic Aligner' : $t, 99);
add_filter('wpseo_title', fn($t) => is_front_page() ? 'Portal do Credenciado · Esthetic Aligner' : $t, 99);

/* ------------------------------------------------------------------ login único */
function eapt_link_ortholab() {
    $l = function_exists('eap_sso_link') ? eap_sso_link('ortholab') : '';
    return $l ?: EAPT_ORTHOLAB;
}
function eapt_link_rewards() {
    $l = function_exists('eap_sso_link') ? eap_sso_link('rewards') : '';
    return $l ?: 'https://pontos.estheticaligner.com.br/';
}
// Área financeira oculta por enquanto
add_action('template_redirect', function () {
    if (is_page('financeiro') && !current_user_can('edit_pages')) { wp_safe_redirect(home_url('/area-do-credenciado/')); exit; }
}, 4);

/**
 * URL de imagem que funciona com o plugin de mídia protegida.
 * O plugin troca os tamanhos intermediários por /secure-media/<arquivo>/, que dá 404.
 * Aqui montamos o endereço direto do arquivo em /wp-content/uploads.
 */
function eapt_img_url($att_id, $tam = 'large') {
    $att_id = (int) $att_id;
    if (!$att_id) return '';
    $meta = wp_get_attachment_metadata($att_id);
    $up   = wp_get_upload_dir();
    if (!empty($meta['file'])) {
        $dir = dirname($meta['file']);
        $dir = ($dir === '.' || $dir === '') ? '' : trailingslashit($dir);
        if ($tam !== 'full' && !empty($meta['sizes'][$tam]['file'])) {
            return trailingslashit($up['baseurl']) . $dir . $meta['sizes'][$tam]['file'];
        }
        return trailingslashit($up['baseurl']) . $meta['file'];
    }
    return (string) wp_get_attachment_url($att_id);
}
function eapt_thumb_url($post_id, $tam = 'large') {
    return eapt_img_url(get_post_thumbnail_id($post_id), $tam);
}


/** Janela de visualização dos posts (Marketing e destaques do início). */
function eapt_modal_post() {
    static $feito = false;
    if ($feito) return;
    $feito = true;
    echo '<div class="eap-modal" data-eap-modal hidden><div class="eap-modal__caixa"><button type="button" class="eap-modal__x" data-eap-fechar aria-label="Fechar">×</button>'
        . '<img data-eap-modal-img alt=""><div class="eap-modal__lado"><strong data-eap-modal-tit></strong><p data-eap-modal-leg></p>'
        . '<div class="eap-modal__acoes"><button type="button" class="eap-btn eap-btn--linha" data-eap-copiar-leg>Copiar legenda</button>'
        . '<a class="eap-btn eap-btn--cheio" data-eap-baixar download>Baixar imagem</a></div></div></div></div>';
}

/** Um cartão dos destaques do início, conforme o tipo do item. */
function eapt_card_destaque($p) {
    $tit = get_the_title($p);
    switch ($p->post_type) {
        case 'ea_post':
            $img = eapt_thumb_url($p->ID, 'large'); $full = eapt_thumb_url($p->ID, 'full');
            if (!$img) return;
            echo '<div role="button" tabindex="0" class="eap-dcard eap-dcard--post" data-eap-post data-id="' . (int) $p->ID . '" data-img="' . esc_url($full) . '" data-titulo="' . esc_attr($tit) . '" data-legenda="' . esc_attr($p->post_excerpt) . '">'
                . '<span class="eap-dcard__capa" style="background-image:url(' . esc_url($img) . ')">' . eapt_novo($p, 'eap-novo--canto') . '</span>'
                . '<strong>' . esc_html($tit) . '</strong><em>Post para redes · ver e baixar</em></div>';
            return;
        case 'ea_aula':
            $capa = function_exists('eap_video_capa') ? eap_video_capa($p->ID) : '';
            $t = get_the_terms($p, 'ea_trilha');
            echo '<a class="eap-dcard eap-dcard--aula" href="' . esc_url(add_query_arg('aula', $p->ID, home_url('/video-aulas/'))) . '">'
                . '<span class="eap-dcard__capa"' . ($capa ? ' style="background-image:url(' . esc_url($capa) . ')"' : '') . '><i>▶</i>' . eapt_novo($p, 'eap-novo--canto') . '</span>'
                . '<strong>' . esc_html($tit) . '</strong><em>' . esc_html(($t && !is_wp_error($t)) ? $t[0]->name : 'Vídeo aula') . '</em></a>';
            return;
        case 'ea_material':
            $url = get_post_meta($p->ID, '_eap_arquivo', true);
            $ext = strtoupper(pathinfo(parse_url($url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION)) ?: 'LINK';
            if (strlen($ext) > 4) $ext = 'LINK';
            echo '<a class="eap-dcard eap-dcard--mat" href="' . esc_url($url) . '" target="_blank" rel="noopener" data-eap-mat="' . (int) $p->ID . '">'
                . '<span class="eap-dcard__capa"><b class="eap-material__tipo eap-tipo-' . esc_attr(strtolower($ext)) . '">' . esc_html($ext) . '</b>' . eapt_novo($p, 'eap-novo--canto') . '</span>'
                . '<strong>' . esc_html($tit) . '</strong><em>Material para baixar</em></a>';
            return;
        case 'ea_parceiro':
            $logo = function_exists('eap_parceiro_logo') ? eap_parceiro_logo($p->ID) : '';
            echo '<a class="eap-dcard eap-dcard--parc" href="' . esc_url(home_url('/eaclub/')) . '">'
                . '<span class="eap-dcard__capa"' . ($logo ? ' style="background-image:url(' . esc_url($logo) . ')"' : '') . '></span>'
                . '<strong>' . esc_html($tit) . '</strong><em>' . esc_html(wp_trim_words($p->post_excerpt, 10) ?: 'Clube de vantagens') . '</em></a>';
            return;
    }
}


/* ------------------------------------------------------------------ telas de senha (wp-login.php) com a cara do portal */
add_action('login_enqueue_scripts', function () {
    wp_enqueue_style('eapt-fontes', 'https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Open+Sans:wght@400;600&display=swap', [], null);
    $logo = esc_url(EAPT_LOGO);
    echo '<style>
    body.login{background:linear-gradient(135deg,#0d1f42 0%,#16305f 45%,#2f6fe4 100%) fixed!important;font-family:"Open Sans",system-ui,sans-serif;color:#1b2433;min-height:100vh;display:flex;align-items:center;justify-content:center}
    body.login #login{width:min(420px,92vw);padding:0;margin:0 auto}
    body.login h1 a{background:url(' . $logo . ') no-repeat center/contain!important;background-color:transparent!important;width:230px!important;height:70px!important;margin:0 auto 18px!important;box-shadow:none!important}
    body.login #nav{display:none!important}
    body.login form{background:#fff!important;border:0!important;border-radius:18px!important;box-shadow:0 24px 60px rgba(0,0,0,.25)!important;padding:28px 26px!important;margin-top:0!important}
    body.login label{font-weight:600;color:#0d1f42;font-size:14px}
    body.login input[type=text],body.login input[type=email],body.login input[type=password]{border:1.5px solid #e4e8f0!important;border-radius:12px!important;padding:10px 13px!important;font-size:16px!important;box-shadow:none!important;background:#fafbfd!important;min-height:46px}
    body.login input:focus{border-color:#2f6fe4!important;box-shadow:0 0 0 3px rgba(47,111,228,.15)!important}
    body.login .button-primary{background:linear-gradient(120deg,#2f6fe4,#3fa2f2)!important;border:0!important;border-radius:999px!important;padding:8px 22px!important;min-height:44px!important;font-weight:700!important;font-family:Montserrat,sans-serif;text-shadow:none!important;box-shadow:0 6px 16px rgba(47,111,228,.3)!important;float:none!important;width:100%;margin-top:6px!important}
    body.login .message,body.login .notice,body.login #login_error{border-radius:12px!important;border-left-width:4px!important;box-shadow:0 8px 20px rgba(0,0,0,.12)!important;font-size:14px}
    body.login #nav,body.login #backtoblog{text-align:center;padding:0!important;margin:14px 0 0!important}
    body.login #nav a,body.login #backtoblog a{color:#fff!important;font-weight:600;font-size:14px;opacity:.9}
    body.login #nav a:hover,body.login #backtoblog a:hover{opacity:1;text-decoration:underline}
    body.login .language-switcher,body.login .privacy-policy-page-link{display:none}
    body.login .eapt-login-tit{font-family:Montserrat,sans-serif;color:#fff;text-align:center;font-size:20px;margin:0 0 6px}
    body.login .eapt-login-sub{color:rgba(255,255,255,.8);text-align:center;font-size:14px;margin:0 0 18px}
    body.login .reset-pass-submit{display:flex;flex-direction:column;gap:8px}
    body.login .reset-pass-submit .button{width:100%;margin:0!important}
    body.login .wp-pwd .button.wp-hide-pw{border-radius:10px;height:44px}
    </style>';
});
add_filter('login_headerurl', fn() => home_url('/'));
add_filter('login_headertext', fn() => 'Esthetic Aligner – Portal do Credenciado');
add_filter('login_title', function ($titulo) {
    $acao = $_REQUEST['action'] ?? '';
    $nomes = ['lostpassword' => 'Esqueci minha senha', 'retrievepassword' => 'Esqueci minha senha', 'rp' => 'Nova senha', 'resetpass' => 'Nova senha'];
    return ($nomes[$acao] ?? 'Entrar') . ' · Portal do Credenciado';
});
add_filter('login_message', function ($msg) {
    $acao = $_REQUEST['action'] ?? 'login';
    if (in_array($acao, ['lostpassword', 'retrievepassword'], true) && empty($_GET['checkemail'])) {
        return '<p class="eapt-login-tit">Esqueci minha senha</p><p class="eapt-login-sub">Digite o e-mail do seu cadastro. Vamos enviar um link para você criar uma nova senha.</p>';
    }
    if (in_array($acao, ['rp', 'resetpass'], true)) {
        return '<p class="eapt-login-tit">Crie sua nova senha</p><p class="eapt-login-sub">Use pelo menos 8 caracteres, misturando letras e números.</p>';
    }
    return $msg;
});
// "Voltar" leva ao login do portal, não ao site
add_filter('login_site_html_link', fn() => '<a href="' . esc_url(home_url('/')) . '">← Voltar para o login do portal</a>');
// depois de pedir o link, volta para a tela de login do portal com aviso
add_filter('lostpassword_redirect', fn() => add_query_arg('login', 'link-enviado', home_url('/')));


/** Selo "Novo": itens publicados nos últimos 15 dias (só o que entrou depois da estreia do portal). */
function eapt_novo($p, $classe = '') {
    $p = get_post($p);
    if (!$p) return '';
    $data = strtotime($p->post_date_gmt . ' UTC');
    $desde = max(time() - 15 * DAY_IN_SECONDS, (int) get_option('eap_novo_desde', time()));
    return $data >= $desde ? '<span class="eap-novo ' . esc_attr($classe) . '">Novo</span>' : '';
}

/** Última aula aberta pelo dentista, para o "Continue assistindo" do início. */
function eapt_ultima_aula() {
    $id = (int) get_user_meta(get_current_user_id(), 'eap_ultima_aula', true);
    if (!$id || !function_exists('eap_aulas_por_trilha')) return null;
    $feitas = function_exists('eap_aulas_feitas') ? eap_aulas_feitas() : [];
    if (!in_array($id, $feitas, true)) {
        $a = get_post($id);
        return ($a && $a->post_type === 'ea_aula' && $a->post_status === 'publish' && empty(get_post_meta($a->ID, '_eap_oculto', true))) ? ['aula' => $a, 'rotulo' => 'Continue de onde parou'] : null;
    }
    // já assistiu a última: sugere a próxima ainda não assistida (primeiro na mesma categoria, depois nas seguintes)
    $todas = [];
    foreach (eap_aulas_por_trilha() as $g) foreach ($g['aulas'] as $a) $todas[] = $a;
    $pos = array_search($id, array_map(fn($a) => $a->ID, $todas), true);
    if ($pos === false) return null;
    for ($i = $pos + 1; $i < count($todas); $i++) {
        if (!in_array($todas[$i]->ID, $feitas, true)) return ['aula' => $todas[$i], 'rotulo' => 'Próxima aula'];
    }
    return null;
}

/** Botão flutuante de WhatsApp com os canais do suporte e a mensagem já com nome e CRO. */
add_action('wp_footer', function () {
    if (!is_user_logged_in() || is_admin() || !eapt_visivel('whats') || !function_exists('eap_suporte_cfg') || eapt_pagina_livre()) return;
    $canais = array_values(array_filter(eap_suporte_cfg()['canais'], fn($c) => !empty($c['whats'])));
    if (!$canais) return;
    $u = wp_get_current_user();
    $nome = trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name;
    $cro = function_exists('eap_dado_atual') ? eap_dado_atual($u->ID, 'cro') : '';
    $ic = '<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><path fill="#fff" d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.2.6 4.4 1.7 6.3L3.2 29l7.3-1.9c1.8 1 3.9 1.5 5.9 1.5h.1c7 0 12.7-5.7 12.7-12.6S23 3 16 3zm0 23.1c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.3 1.1 1.2-4.2-.3-.4a10.4 10.4 0 0 1-1.6-5.6C5.2 9.8 10 5.1 16 5.1c5.8 0 10.6 4.7 10.6 10.5S21.8 26.1 16 26.1zm5.8-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.4c.2.2 2.4 3.6 5.7 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg>';
    echo '<div class="eap-whats" data-eap-whats-box><div class="eap-whats__painel" hidden><div class="eap-whats__topo"><strong>Fale com a Esthetic Aligner</strong><span>Escolha o assunto. A mensagem já vai com seu nome e CRO.</span></div>';
    foreach ($canais as $c) {
        $msg = 'Olá! Sou ' . $nome . ($cro ? ' (CRO ' . $cro . ')' : '') . ', credenciado(a) Esthetic Aligner. Falo pelo Portal do Credenciado sobre ' . mb_strtolower($c['titulo']) . ': ';
        echo '<a href="' . esc_url(eap_whats_link($c['whats']) . '?text=' . rawurlencode($msg)) . '" target="_blank" rel="noopener" data-eap-whats="' . esc_attr($c['titulo']) . '"><b>' . esc_html($c['titulo']) . '</b><em>' . esc_html($c['texto']) . '</em></a>';
    }
    echo '</div><button type="button" class="eap-whats__bt" aria-label="Falar no WhatsApp" data-eap-whats-bt>' . $ic . '<span>Precisa de ajuda?</span></button></div>';
    echo "<script>(function(){var b=document.querySelector('[data-eap-whats-bt]'),p=document.querySelector('.eap-whats__painel');if(!b)return;b.addEventListener('click',function(e){e.stopPropagation();p.hidden=!p.hidden;});document.addEventListener('click',function(e){if(!e.target.closest('[data-eap-whats-box]'))p.hidden=true;});})();</script>";
}, 60);

/* ------------------------------------------------------------------ app no celular (PWA) */
function eapt_pwa_icone($tam) {
    return content_url('/uploads/' . ($tam === 'apple' ? 'ea-app-apple-180.png' : 'ea-app-' . $tam . '.png'));
}
add_action('init', function () {
    if (empty($_GET['eap_pwa'])) return;
    $o = $_GET['eap_pwa'];
    if ($o === 'manifest') {
        header('Content-Type: application/manifest+json; charset=utf-8');
        header('Cache-Control: public, max-age=3600');
        echo wp_json_encode([
            'name' => 'Portal do Credenciado – Esthetic Aligner', 'short_name' => 'EA Portal',
            'description' => 'Aulas, materiais, marketing, suporte e sistemas da Esthetic Aligner.',
            'start_url' => '/area-do-credenciado/?origem=app', 'scope' => '/', 'display' => 'standalone',
            'background_color' => '#ffffff', 'theme_color' => '#2f6fe4', 'lang' => 'pt-BR', 'id' => '/area-do-credenciado/',
            'icons' => [
                ['src' => eapt_pwa_icone('192'), 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => eapt_pwa_icone('512'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => eapt_pwa_icone('512'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
            ],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($o === 'sw') {
        header('Content-Type: application/javascript; charset=utf-8');
        header('Service-Worker-Allowed: /');
        header('Cache-Control: no-cache');
        // não guarda páginas (o conteúdo é do credenciado logado); só mostra um aviso quando estiver sem internet
        echo "self.addEventListener('install',function(){self.skipWaiting();});"
            . "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});"
            . "self.addEventListener('fetch',function(e){if(e.request.mode!=='navigate')return;e.respondWith(fetch(e.request).catch(function(){return new Response('<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\"><title>Sem conexão</title><body style=\"font-family:system-ui;text-align:center;padding:60px 24px;color:#1b2433\"><h2>Sem conexão com a internet</h2><p>Confira sua conexão e tente de novo.</p><button onclick=\"location.reload()\" style=\"background:#2f6fe4;color:#fff;border:0;border-radius:999px;padding:12px 22px;font-size:15px\">Tentar de novo</button>',{headers:{'Content-Type':'text/html; charset=utf-8'}});}));});";
        exit;
    }
}, 1);

add_action('wp_head', function () {
    echo '<link rel="manifest" href="' . esc_url(home_url('/?eap_pwa=manifest')) . '">' . "\n"
        . '<meta name="theme-color" content="#2f6fe4">' . "\n"
        . '<link rel="apple-touch-icon" href="' . esc_url(eapt_pwa_icone('apple')) . '">' . "\n"
        . '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">' . "\n"
        . '<meta name="apple-mobile-web-app-title" content="EA Portal"><meta name="apple-mobile-web-app-status-bar-style" content="default">' . "\n";
}, 2);

add_action('wp_footer', function () {
    $sw = esc_url(home_url('/?eap_pwa=sw'));
    echo "<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('$sw',{scope:'/'}).catch(function(){});});}</script>";
    if (!is_user_logged_in() || eapt_pagina_livre()) return;
    $icone = esc_url(eapt_pwa_icone('192'));
    $compart = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="vertical-align:-3px"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
    ?>
    <div class="eap-app-faixa" data-eap-app-faixa hidden>
      <img src="<?php echo $icone; ?>" alt="">
      <span><strong>Tenha o portal no celular</strong><em>Abra direto da tela inicial, como um app.</em></span>
      <button type="button" class="eap-btn eap-btn--cheio" data-eap-app-abrir>Instalar</button>
      <button type="button" class="eap-app-faixa__x" data-eap-app-fechar aria-label="Agora não">×</button>
    </div>
    <div class="eap-modal eap-app-modal" data-eap-app-modal hidden><div class="eap-modal__caixa">
      <button type="button" class="eap-modal__x" data-eap-app-x aria-label="Fechar">×</button>
      <div class="eap-app-modal__topo"><img src="<?php echo $icone; ?>" alt=""><div><strong>Instale o portal no seu celular</strong><span>Grátis, sem loja de aplicativos. O ícone da Esthetic Aligner fica na tela inicial e o portal abre em tela cheia, já logado.</span></div></div>
      <div class="eap-app-abas" role="tablist"><button type="button" data-eap-app-aba="android">Android</button><button type="button" data-eap-app-aba="ios">iPhone</button></div>
      <ol class="eap-app-passos" data-eap-app-passos="android">
        <li>Abra o portal no <b>Google Chrome</b> e entre com seu login.</li>
        <li>Toque nos <b>três pontinhos ⋮</b>, no canto de cima à direita.</li>
        <li>Toque em <b>“Instalar app”</b> (em alguns celulares aparece <b>“Adicionar à tela inicial”</b>).</li>
        <li>Confirme em <b>“Instalar”</b>. Pronto: o ícone <b>EA Portal</b> aparece na tela inicial.</li>
      </ol>
      <ol class="eap-app-passos" data-eap-app-passos="ios" hidden>
        <li>Abra o portal no <b>Safari</b> e entre com seu login.</li>
        <li>Toque no botão <b>Compartilhar</b> <?php echo $compart; ?> na barra de baixo da tela.</li>
        <li>Role a lista e toque em <b>“Adicionar à Tela de Início”</b>.</li>
        <li>Toque em <b>“Adicionar”</b>, no canto de cima. Pronto: o ícone <b>EA Portal</b> aparece na tela inicial.</li>
        <li class="eap-app-dica">Usa o Chrome no iPhone? O botão Compartilhar <?php echo $compart; ?> fica no canto de cima, ao lado do endereço. O resto é igual.</li>
      </ol>
      <button type="button" class="eap-btn eap-btn--cheio eap-app-instalar" data-eap-app-instalar hidden>Instalar agora</button>
    </div></div>
    <script>(function(){
      var ua=navigator.userAgent, ios=/iphone|ipad|ipod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),
          cel=ios||/android|mobile/i.test(ua), app=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone,
          faixa=document.querySelector('[data-eap-app-faixa]'), modal=document.querySelector('[data-eap-app-modal]'),
          btInst=modal.querySelector('[data-eap-app-instalar]'), pedido=null, K='eap-app-faixa-fechada';
      function aba(q){modal.querySelectorAll('[data-eap-app-aba]').forEach(function(b){b.classList.toggle('is-ativo',b.getAttribute('data-eap-app-aba')===q);});
        modal.querySelectorAll('[data-eap-app-passos]').forEach(function(o){o.hidden=o.getAttribute('data-eap-app-passos')!==q;});
        btInst.hidden=!(pedido&&q==='android');}
      function abrir(){aba(ios?'ios':'android');modal.hidden=false;document.body.style.overflow='hidden';}
      function fechar(){modal.hidden=true;document.body.style.overflow='';}
      window.eapAppAbrir=abrir;
      modal.querySelectorAll('[data-eap-app-aba]').forEach(function(b){b.addEventListener('click',function(){aba(b.getAttribute('data-eap-app-aba'));});});
      modal.addEventListener('click',function(e){if(e.target===modal||e.target.hasAttribute('data-eap-app-x'))fechar();});
      window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();pedido=e;});
      function instalar(){if(!pedido){abrir();return;}pedido.prompt();pedido.userChoice.then(function(){pedido=null;faixa.hidden=true;fechar();});}
      btInst.addEventListener('click',instalar);
      document.querySelectorAll('[data-eap-app-link]').forEach(function(a){a.hidden=!!app;a.addEventListener('click',function(e){e.preventDefault();abrir();});});
      if(app){try{if(!localStorage.getItem('eap-app-ev')&&window.eapEvento){window.eapEvento('app');localStorage.setItem('eap-app-ev','1');}}catch(e){}}
      window.addEventListener('appinstalled',function(){window.eapEvento&&window.eapEvento('app');});
      var fechada=0;try{fechada=+localStorage.getItem(K)||0;}catch(e){}
      if(cel&&!app&&Date.now()-fechada>20*864e5){faixa.hidden=false;}
      faixa.querySelector('[data-eap-app-abrir]').addEventListener('click',function(){pedido&&!ios?instalar():abrir();});
      faixa.querySelector('[data-eap-app-fechar]').addEventListener('click',function(){faixa.hidden=true;try{localStorage.setItem(K,Date.now());}catch(e){}});
    })();</script>
    <?php
}, 55);


/* ------------------------------------------------------------------ certificado do Curso do Credenciado */
function eapt_cert_faixa($classe = '') {
    if (!function_exists('eap_curso_concluido')) return;
    $ok = eap_curso_concluido();
    echo '<div class="eap-cert-faixa ' . esc_attr($classe) . '" data-eap-cert-faixa' . ($ok ? '' : ' hidden') . '><span class="eap-cert-faixa__ic">🎓</span>'
        . '<span class="eap-cert-faixa__txt"><strong>Parabéns! Você concluiu o Curso do Credenciado.</strong><em>Seu certificado está pronto para baixar.</em></span>'
        . '<button type="button" class="eap-btn eap-btn--cheio" data-eap-cert-abrir>Baixar certificado</button></div>';
}
add_action('wp_footer', function () {
    if (!is_user_logged_in() || !function_exists('eap_nome_certificado') || !(is_page('video-aulas') || is_page('area-do-credenciado'))) return;
    $tpl_novo = wp_get_upload_dir()['basedir'] . '/certificado-credenciamento-ea.jpg'; // modelo com o logo atual (enviado pelo painel)
    $cfg = ['tpl' => file_exists($tpl_novo) ? content_url('/uploads/certificado-credenciamento-ea.jpg') : get_stylesheet_directory_uri() . '/assets/certificado.jpg', 'fonte' => 'https://fonts.gstatic.com/s/alexbrush/v23/SZc83FzrJKuqFbwMKk6EhUXz7Q.woff2'];
    ?>
    <div class="eap-modal eap-cert-modal" data-eap-cert-modal hidden><div class="eap-modal__caixa">
      <button type="button" class="eap-modal__x" data-eap-cert-x aria-label="Fechar">×</button>
      <div class="eap-cert-modal__ic">🎓</div>
      <strong class="eap-cert-modal__tit" data-eap-cert-tit>Certificado do Curso do Credenciado</strong>
      <p>Confira seu nome <b>exatamente como deve aparecer</b> no certificado (nome completo, com acentos).</p>
      <label class="eap-cert-modal__campo"><span>Nome no certificado</span><input type="text" maxlength="80" data-eap-cert-nome value="<?php echo esc_attr(eap_nome_certificado()); ?>" autocomplete="name"></label>
      <p class="eap-cert-modal__erro" data-eap-cert-erro hidden></p>
      <button type="button" class="eap-btn eap-btn--cheio eap-cert-modal__bt" data-eap-cert-gerar>Gerar certificado (PDF)</button>
      <small>A data é a do dia em que você concluiu as aulas. Se precisar, você pode gerar de novo quando quiser.</small>
    </div></div>
    <script>(function(){
      var C=<?php echo wp_json_encode($cfg); ?>, m=document.querySelector('[data-eap-cert-modal]'), inp=m.querySelector('[data-eap-cert-nome]'),
          bt=m.querySelector('[data-eap-cert-gerar]'), err=m.querySelector('[data-eap-cert-erro]'), tit=m.querySelector('[data-eap-cert-tit]');
      function abrir(festa){tit.textContent=festa?'Parabéns! Você concluiu o curso 🎉':'Certificado do Curso do Credenciado';err.hidden=true;m.hidden=false;document.body.style.overflow='hidden';setTimeout(function(){inp.focus();},50);}
      function fechar(){m.hidden=true;document.body.style.overflow='';}
      window.eapCertAbrir=abrir;
      document.addEventListener('click',function(e){if(e.target.closest('[data-eap-cert-abrir]'))abrir(false);});
      m.addEventListener('click',function(e){if(e.target===m||e.target.hasAttribute('data-eap-cert-x'))fechar();});
      function erro(t){err.textContent=t;err.hidden=false;bt.disabled=false;bt.textContent='Gerar certificado (PDF)';}
      bt.addEventListener('click',function(){
        var nome=inp.value.trim().replace(/\s+/g,' ');
        if(nome.split(' ').length<2||nome.length<5){erro('Digite seu nome completo.');return;}
        bt.disabled=true;bt.textContent='Gerando…';
        var S=window.EAP_FEITAS,f=new FormData();f.append('action','eap_certificado');f.append('_n',S.n);f.append('nome',nome);
        fetch(S.u,{method:'POST',body:f,credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){
          if(!j.success){erro(j.data==='incompleto'?'Marque todas as aulas do Curso do Credenciado como assistidas para liberar o certificado.':'Não foi possível gerar agora. Tente de novo.');return;}
          return Promise.all([EAPF.img(C.tpl),EAPF.fonte('Alex Brush',C.fonte)]).then(function(r){
            var im=r[0],c=document.createElement('canvas');c.width=im.width;c.height=im.height;var x=c.getContext('2d'),k=im.width/842;
            x.drawImage(im,0,0);x.fillStyle='#1f3b6e';x.textAlign='center';x.textBaseline='alphabetic';
            EAPF.textoCabe(x,j.data.nome,421*k,285*k,440*k,Math.round(50*k),'"Alex Brush", cursive');
            EAPF.textoCabe(x,j.data.data,581*k,481*k,215*k,Math.round(25*k),'"Alex Brush", cursive');
            EAPF.baixar(EAPF.pdf([c],842,595),'Certificado Esthetic Aligner - '+j.data.nome+'.pdf');
            bt.disabled=false;bt.textContent='Baixar de novo';
          });
        }).catch(function(){erro('Não foi possível gerar agora. Tente de novo.');});
      });
    })();</script>
    <?php
}, 56);

add_action('wp_footer', function () { if (is_user_logged_in() && is_page('simulador-de-estimativa-e-pacote')) echo '<span data-eap-orc-pagina hidden></span>'; }, 1);


/* ------------------------------------------------------------------ pesquisa de satisfação */
add_action('wp_footer', function () {
    if (!is_user_logged_in() || is_admin() || eapt_pagina_livre() || !function_exists('eap_pesquisa_mostrar') || !eap_pesquisa_mostrar()) return;
    // não disputa a atenção com um aviso em janela que ainda vai aparecer
    if (!isset($_GET['eap_pesquisa']) && function_exists('eap_avisos_para') && array_filter(eap_avisos_para(get_current_user_id()), fn($x) => $x[1]['formato'] === 'janela')) return;
    ?>
    <div class="eap-nps" data-eap-nps hidden>
      <button type="button" class="eap-nps__x" data-eap-nps-depois aria-label="Agora não">×</button>
      <div data-eap-nps-p1>
        <strong>De 0 a 10, quanto o portal te ajuda no dia a dia?</strong>
        <div class="eap-nps__notas"><?php for ($i = 0; $i <= 10; $i++) echo '<button type="button" data-nota="' . $i . '">' . $i . '</button>'; ?></div>
        <div class="eap-nps__leg"><span>Nada</span><span>Muito</span></div>
      </div>
      <div data-eap-nps-p2 hidden>
        <strong data-eap-nps-tit>Obrigado! O que podemos melhorar?</strong>
        <textarea rows="3" maxlength="1000" placeholder="Opcional: conte o que faria o portal ainda mais útil para você." data-eap-nps-txt></textarea>
        <button type="button" class="eap-btn eap-btn--cheio" data-eap-nps-enviar>Enviar</button>
      </div>
      <div data-eap-nps-p3 hidden><strong>Obrigado pela resposta! 💙</strong><span>Ela vai direto para a nossa equipe.</span></div>
    </div>
    <script>(function(){
      var b=document.querySelector('[data-eap-nps]'),n=-1,U=<?php echo wp_json_encode(admin_url('admin-ajax.php')); ?>,N=<?php echo wp_json_encode(wp_create_nonce('eap_ferr')); ?>;
      function env(d){var f=new FormData();f.append('action','eap_pesquisa');f.append('_n',N);Object.keys(d).forEach(function(k){f.append(k,d[k]);});return fetch(U,{method:'POST',body:f,credentials:'same-origin'});}
      setTimeout(function(){b.hidden=false;},<?php echo isset($_GET['eap_pesquisa']) ? 300 : 8000; ?>);
      b.querySelector('[data-eap-nps-depois]').addEventListener('click',function(){b.hidden=true;if(n<0)env({acao:'depois'});});
      b.querySelectorAll('[data-nota]').forEach(function(x){x.addEventListener('click',function(){n=+x.getAttribute('data-nota');
        b.querySelector('[data-eap-nps-tit]').textContent=n>=9?'Que bom! O que você mais gosta no portal?':(n>=7?'Obrigado! O que falta para ser nota 10?':'Obrigado pela sinceridade. O que podemos melhorar?');
        b.querySelector('[data-eap-nps-p1]').hidden=true;b.querySelector('[data-eap-nps-p2]').hidden=false;});});
      b.querySelector('[data-eap-nps-enviar]').addEventListener('click',function(){var t=b.querySelector('[data-eap-nps-txt]').value;
        env({nota:n,coment:t}).then(function(){b.querySelector('[data-eap-nps-p2]').hidden=true;b.querySelector('[data-eap-nps-p3]').hidden=false;setTimeout(function(){b.hidden=true;},3500);});});
    })();</script>
    <?php
}, 57);


/* ------------------------------------------------------------------ Assistente EA (chat) */
add_action('wp_footer', function () {
    if (!is_user_logged_in() || is_admin() || eapt_pagina_livre() || !function_exists('eap_ia_pode') || !eap_ia_pode()) return;
    $u = wp_get_current_user(); $nome = trim($u->first_name) ?: $u->display_name;
    $sup = function_exists('eap_suporte_cfg') ? eap_suporte_cfg()['canais'] : [];
    $wa = ''; $lab = '';
    foreach ($sup as $c) { if (!$wa && !empty($c['whats'])) $wa = eap_whats_link($c['whats']); if (!$lab && stripos($c['titulo'], 'labor') !== false && !empty($c['whats'])) $lab = eap_whats_link($c['whats']); }
    $cfg = ['u' => admin_url('admin-ajax.php'), 'n' => wp_create_nonce('eap_ia'), 'sup' => $wa, 'lab' => $lab ?: $wa, 'nome' => $nome];
    ?>
    <button type="button" class="eap-ia-bt" data-eap-ia-bt aria-label="Assistente EA"><span>✨</span><b>Assistente EA</b></button>
    <div class="eap-ia-chat" data-eap-ia hidden>
      <div class="eap-ia-chat__topo"><div><strong>✨ Assistente EA</strong><span>Respostas com base no conteúdo do portal</span></div><button type="button" data-eap-ia-x aria-label="Fechar">×</button></div>
      <div class="eap-ia-chat__msgs" data-eap-ia-msgs>
        <div class="eap-ia-m eap-ia-m--ia">Olá, <?php echo esc_html($nome); ?>! Pergunte sobre o sistema Esthetic Aligner, protocolos, materiais e o uso do portal. Eu respondo com o conteúdo oficial e mostro a fonte.</div>
        <div class="eap-ia-sug" data-eap-ia-sug><button type="button">Como envio um caso?</button><button type="button">Como funciona a checagem 3D?</button><button type="button">Onde encontro a ficha de documentação?</button></div>
      </div>
      <form class="eap-ia-chat__form" data-eap-ia-form><textarea rows="1" maxlength="600" placeholder="Escreva sua pergunta…" data-eap-ia-txt></textarea><button type="submit" aria-label="Enviar">➤</button></form>
      <small class="eap-ia-chat__aviso">O assistente não faz diagnóstico nem substitui a avaliação clínica.</small>
    </div>
    <script>(function(){
      var C=<?php echo wp_json_encode($cfg); ?>, box=document.querySelector('[data-eap-ia]'), bt=document.querySelector('[data-eap-ia-bt]'), msgs=box.querySelector('[data-eap-ia-msgs]'),
          form=box.querySelector('[data-eap-ia-form]'), txt=box.querySelector('[data-eap-ia-txt]'), hist=[], ocupado=false;
      function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
      function fmt(t){t=esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');var l=t.split('\n'),o='',lista=false;l.forEach(function(x){var m=x.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/);if(m){if(!lista){o+='<ul>';lista=true;}o+='<li>'+m[1]+'</li>';}else{if(lista){o+='</ul>';lista=false;}if(x.trim())o+='<p>'+x+'</p>';}});return o+(lista?'</ul>':'');}
      function add(html,cls){var d=document.createElement('div');d.className='eap-ia-m '+cls;d.innerHTML=html;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d;}
      function abrir(){box.hidden=false;bt.hidden=true;setTimeout(function(){txt.focus();},50);}
      bt.addEventListener('click',abrir); box.querySelector('[data-eap-ia-x]').addEventListener('click',function(){box.hidden=true;bt.hidden=false;});
      box.querySelectorAll('[data-eap-ia-sug] button').forEach(function(b){b.addEventListener('click',function(){perguntar(b.textContent);});});
      txt.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit?form.requestSubmit():form.dispatchEvent(new Event('submit'));}});
      form.addEventListener('submit',function(e){e.preventDefault();perguntar(txt.value);});
      function perguntar(p){p=(p||'').trim();if(!p||ocupado)return;ocupado=true;txt.value='';var s=box.querySelector('[data-eap-ia-sug]');if(s)s.remove();
        add(esc(p),'eap-ia-m--eu');var esp=add('<span class="eap-ia-dig"><i></i><i></i><i></i></span> Procurando no conteúdo do portal…','eap-ia-m--ia eap-ia-m--esp');
        var f=new FormData();f.append('action','eap_ia_perguntar');f.append('_n',C.n);f.append('pergunta',p);f.append('historico',JSON.stringify(hist));
        fetch(C.u,{method:'POST',body:f,credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){esp.remove();ocupado=false;
          if(!j.success){add(j.data==='limite'?'Você chegou ao limite de perguntas de hoje. Amanhã libera de novo, ou fale com o <a href="'+esc(C.sup)+'" target="_blank" rel="noopener">suporte no WhatsApp</a>.':'Não consegui responder agora. Tente de novo em instantes.','eap-ia-m--ia');return;}
          var d=j.data,h='';
          if(d.status==='ok'){h=fmt(d.texto);if(d.fontes.length){h+='<div class="eap-ia-fontes"><span>Fonte'+(d.fontes.length>1?'s':'')+':</span>'+d.fontes.map(function(x){return '<a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.titulo)+' <em>'+esc(x.tipo)+'</em></a>';}).join('')+'</div>';}
            h+='<div class="eap-ia-aval" data-id="'+d.id+'"><span>Ajudou?</span><button type="button" data-v="1">👍</button><button type="button" data-v="-1">👎</button></div>';
            hist.push({papel:'user',texto:p},{papel:'assistant',texto:d.texto});}
          else if(d.status==='clinico'){h='<p>Para dúvidas sobre um caso ou paciente específico, o melhor é falar direto com o nosso laboratório, que acompanha o planejamento.</p>'+(C.lab?'<a class="eap-ia-acao" href="'+esc(C.lab)+'?text='+encodeURIComponent('Olá! Tenho uma dúvida sobre um caso: '+p)+'" target="_blank" rel="noopener">Falar com o laboratório no WhatsApp</a>':'');}
          else if(d.status==='sem'){h='<p>Não encontrei essa informação no conteúdo do portal, e prefiro não responder sem uma fonte oficial.</p>'+(C.sup?'<a class="eap-ia-acao" href="'+esc(C.sup)+'?text='+encodeURIComponent('Olá! Não encontrei no portal: '+p)+'" target="_blank" rel="noopener">Perguntar ao suporte no WhatsApp</a>':'');}
          else h='<p>Não consegui responder agora. Tente de novo em instantes.</p>';
          add(h,'eap-ia-m--ia');
        }).catch(function(){esp.remove();ocupado=false;add('Sem conexão. Tente de novo.','eap-ia-m--ia');});}
      msgs.addEventListener('click',function(e){var b=e.target.closest('.eap-ia-aval button');if(!b)return;var w=b.parentNode,f=new FormData();f.append('action','eap_ia_avaliar');f.append('_n',C.n);f.append('id',w.getAttribute('data-id'));f.append('v',b.getAttribute('data-v'));fetch(C.u,{method:'POST',body:f,credentials:'same-origin'});w.innerHTML='<span>Obrigado pelo retorno!</span>';});
    })();</script>
    <?php
}, 58);
