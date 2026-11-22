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
            echo '<div role="button" tabindex="0" class="eap-dcard eap-dcard--post" data-eap-post data-img="' . esc_url($full) . '" data-titulo="' . esc_attr($tit) . '" data-legenda="' . esc_attr($p->post_excerpt) . '">'
                . '<span class="eap-dcard__capa" style="background-image:url(' . esc_url($img) . ')"></span>'
                . '<strong>' . esc_html($tit) . '</strong><em>Post para redes · ver e baixar</em></div>';
            return;
        case 'ea_aula':
            $capa = function_exists('eap_video_capa') ? eap_video_capa($p->ID) : '';
            $t = get_the_terms($p, 'ea_trilha');
            echo '<a class="eap-dcard eap-dcard--aula" href="' . esc_url(add_query_arg('aula', $p->ID, home_url('/video-aulas/'))) . '">'
                . '<span class="eap-dcard__capa"' . ($capa ? ' style="background-image:url(' . esc_url($capa) . ')"' : '') . '><i>▶</i></span>'
                . '<strong>' . esc_html($tit) . '</strong><em>' . esc_html(($t && !is_wp_error($t)) ? $t[0]->name : 'Vídeo aula') . '</em></a>';
            return;
        case 'ea_material':
            $url = get_post_meta($p->ID, '_eap_arquivo', true);
            $ext = strtoupper(pathinfo(parse_url($url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION)) ?: 'LINK';
            if (strlen($ext) > 4) $ext = 'LINK';
            echo '<a class="eap-dcard eap-dcard--mat" href="' . esc_url($url) . '" target="_blank" rel="noopener">'
                . '<span class="eap-dcard__capa"><b class="eap-material__tipo eap-tipo-' . esc_attr(strtolower($ext)) . '">' . esc_html($ext) . '</b></span>'
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
    body.login h1 a{background:url(' . $logo . ') no-repeat center/contain!important;width:220px!important;height:64px!important;margin:0 auto 18px!important;filter:brightness(0) invert(1)}
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
