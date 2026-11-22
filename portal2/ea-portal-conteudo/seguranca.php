<?php
/**
 * Segurança do portal.
 *  1. Arquivos (PDF, ZIP, vídeos, planilhas…) em /wp-content/uploads só abrem para quem está logado.
 *     Exceções: nomes listados em "Arquivos públicos" (ex.: termos de uso).
 *  2. Sem Pixel do Facebook no portal (área logada de dentistas; LGPD).
 *  3. A API do WordPress (wp/v2) não responde para quem não está logado.
 *  4. Cabeçalhos de proteção e bloqueio de readme/license.
 */
if (!defined('ABSPATH')) exit;

const EAP_SEG_VERSAO = '1';
const EAP_SEG_EXT = 'pdf|zip|rar|7z|mp4|mov|m4v|webm|docx?|xlsx?|pptx?|csv|stl|dcm';

function eap_seg_publicos() {
    $v = get_option('eap_arquivos_publicos', null);
    if ($v === null || $v === false) $v = "termos-e-condicoes.pdf";
    return array_filter(array_map('trim', preg_split('/[\r\n,]+/', strtolower((string) $v))));
}

// ------------------------------------------------------------ .htaccess
function eap_seg_htaccess() {
    if (!function_exists('insert_with_markers')) require_once ABSPATH . 'wp-admin/includes/misc.php';
    $regras = [
        '<IfModule mod_rewrite.c>',
        'RewriteEngine On',
        'RewriteCond %{REQUEST_FILENAME} -f',
        'RewriteRule ^wp-content/uploads/(.+\.(?:' . EAP_SEG_EXT . '))$ index.php?eap_arquivo=$1 [L,QSA,NC]',
        'RewriteRule ^(readme\.html|license\.txt|wp-config-sample\.php)$ - [F,L,NC]',
        '</IfModule>',
    ];
    return insert_with_markers(ABSPATH . '.htaccess', 'EA Portal - seguranca', $regras);
}
add_action('admin_init', function () {
    if (get_option('eap_seg_versao') === EAP_SEG_VERSAO || !current_user_can('manage_options')) return;
    if (eap_seg_htaccess()) update_option('eap_seg_versao', EAP_SEG_VERSAO, false);
});

// ------------------------------------------------------------ portão dos arquivos
add_action('init', function () {
    if (!isset($_GET['eap_arquivo'])) return;
    $rel = ltrim(str_replace("\0", '', wp_unslash((string) $_GET['eap_arquivo'])), '/');
    $up = wp_get_upload_dir();
    $base = realpath($up['basedir']);
    $arq = $base ? realpath($base . '/' . $rel) : false;
    if (!$arq || strpos($arq, $base . DIRECTORY_SEPARATOR) !== 0 || !is_file($arq) || !preg_match('~\.(?:' . EAP_SEG_EXT . ')$~i', $arq)) {
        status_header(404); nocache_headers(); exit('Arquivo não encontrado.');
    }
    $publico = in_array(strtolower(basename($arq)), eap_seg_publicos(), true);
    if (!$publico && !is_user_logged_in()) {
        nocache_headers();
        wp_safe_redirect(add_query_arg('login', 'arquivo', home_url('/')));
        exit;
    }
    eap_seg_enviar($arq, $publico);
}, 0);

function eap_seg_enviar($arq, $publico) {
    @set_time_limit(0);
    while (ob_get_level()) ob_end_clean();
    $tam = filesize($arq);
    $tipo = wp_check_filetype($arq);
    $mime = $tipo['type'] ?: 'application/octet-stream';
    $inline = preg_match('~^(application/pdf|video/|image/)~', $mime);
    $ini = 0; $fim = $tam - 1; $parcial = false;
    if (!empty($_SERVER['HTTP_RANGE']) && preg_match('/bytes=(\d*)-(\d*)/', $_SERVER['HTTP_RANGE'], $m)) {
        if ($m[1] === '' && $m[2] !== '') { $ini = max(0, $tam - (int) $m[2]); }
        else { $ini = (int) $m[1]; if ($m[2] !== '') $fim = min((int) $m[2], $tam - 1); }
        if ($ini > $fim || $ini >= $tam) { status_header(416); header('Content-Range: bytes */' . $tam); exit; }
        $parcial = true;
    }
    status_header($parcial ? 206 : 200);
    header('Content-Type: ' . $mime);
    header('Accept-Ranges: bytes');
    header('Content-Length: ' . ($fim - $ini + 1));
    if ($parcial) header("Content-Range: bytes $ini-$fim/$tam");
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . str_replace('"', '', basename($arq)) . '"');
    header('Cache-Control: ' . ($publico ? 'public, max-age=3600' : 'private, no-store, max-age=0'));
    header('X-Content-Type-Options: nosniff');
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', filemtime($arq)) . ' GMT');
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') exit;
    $h = fopen($arq, 'rb');
    fseek($h, $ini);
    $falta = $fim - $ini + 1;
    while ($falta > 0 && !feof($h) && !connection_aborted()) {
        $bloco = fread($h, min(1048576, $falta));
        echo $bloco; flush();
        $falta -= strlen($bloco);
    }
    fclose($h);
    exit;
}

// aviso na tela de login quando veio de um arquivo
add_action('wp_footer', function () {
    if (!is_user_logged_in() && ($_GET['login'] ?? '') === 'arquivo') {
        echo '<div style="position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:9999;background:#112654;color:#fff;padding:10px 18px;border-radius:12px;font:600 14px/1.4 sans-serif">Entre com seu login para abrir o arquivo.</div>';
    }
});

// ------------------------------------------------------------ sem Pixel do Facebook no portal
add_action('template_redirect', function () {
    if (is_admin() || wp_doing_ajax() || isset($_GET['eap_arquivo'])) return;
    ob_start(function ($html) {
        if (stripos($html, 'fbq') === false && stripos($html, 'fbevents') === false && stripos($html, 'facebook.com/tr') === false) return $html;
        $padroes = [
            '~<!--\s*(?:Facebook|Meta) Pixel Code\s*-->.*?<!--\s*End (?:Facebook|Meta) Pixel Code\s*-->~is',
            '~<script\b[^>]*>(?:(?!</script>).)*?(?:\bfbq\b|fbevents\.js)(?:(?!</script>).)*</script>~is',
            '~<noscript>(?:(?!</noscript>).)*facebook\.com/tr(?:(?!</noscript>).)*</noscript>~is',
            '~<script\b[^>]*connect\.facebook\.net[^>]*>\s*</script>~is',
        ];
        foreach ($padroes as $p) {
            $novo = preg_replace($p, '', $html);
            if (is_string($novo)) $html = $novo; // em caso de erro do regex, mantém a página intacta
        }
        return $html;
    });
}, 0);

// ------------------------------------------------------------ API só para logados
add_filter('rest_pre_dispatch', function ($res, $server, $req) {
    if ($res !== null || is_user_logged_in()) return $res;
    $rota = $req->get_route();
    if (strpos($rota, '/wp/v2') === 0 || strpos($rota, '/oembed') === 0) {
        return new WP_Error('rest_login', 'Entre no portal para acessar.', ['status' => 401]);
    }
    return $res;
}, 10, 3);
add_filter('xmlrpc_enabled', '__return_false');

// ------------------------------------------------------------ cabeçalhos
add_action('send_headers', function () {
    if (is_ssl()) header('Strict-Transport-Security: max-age=31536000');
    header('X-Frame-Options: SAMEORIGIN');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
});
add_action('admin_init', function () {
    if (headers_sent()) return;
    header('X-Frame-Options: SAMEORIGIN');
    header('X-Content-Type-Options: nosniff');
});
remove_action('wp_head', 'wp_generator');
add_filter('the_generator', '__return_empty_string');

// ------------------------------------------------------------ configuração (arquivos públicos)
add_action('admin_menu', function () {
    add_submenu_page('eap-portal', 'Segurança', 'Segurança', 'manage_options', 'eap-seguranca', 'eap_seg_pagina', 30);
}, 20);
function eap_seg_pagina() {
    if (isset($_POST['eap_seg_n']) && wp_verify_nonce($_POST['eap_seg_n'], 'eap_seg')) {
        update_option('eap_arquivos_publicos', sanitize_textarea_field(wp_unslash($_POST['publicos'] ?? '')), false);
        $ok = eap_seg_htaccess();
        echo '<div class="notice notice-' . ($ok ? 'success' : 'error') . '"><p>' . ($ok ? 'Salvo.' : 'Não consegui gravar o .htaccess — fale com o suporte técnico.') . '</p></div>';
    }
    ?>
    <div class="wrap"><h1>Segurança do portal</h1>
      <ul style="list-style:disc;padding-left:20px;font-size:14px">
        <li>Arquivos (PDF, ZIP, vídeos, planilhas, apresentações) só abrem para quem está logado.</li>
        <li>O Pixel do Facebook não é carregado no portal.</li>
        <li>A API do WordPress não responde para visitantes sem login.</li>
        <li>Cabeçalhos de proteção ativos (HTTPS obrigatório, sem embutir em outros sites).</li>
      </ul>
      <form method="post"><?php wp_nonce_field('eap_seg', 'eap_seg_n'); ?>
        <h2>Arquivos públicos</h2>
        <p>Nomes de arquivos que podem abrir sem login (um por linha), por exemplo arquivos com link no site ou em e-mails.</p>
        <textarea name="publicos" rows="6" class="large-text code"><?php echo esc_textarea(implode("\n", eap_seg_publicos())); ?></textarea>
        <p><button class="button button-primary">Salvar</button></p>
      </form>
    </div>
    <?php
}

// ------------------------------------------------------------ limite de tentativas de login
// 5 senhas erradas para o mesmo e-mail/usuário em 15 min → pausa de 15 min.
// (Sem bloqueio por IP: atrás da CDN vários dentistas podem aparecer com o mesmo IP.)
function eap_seg_chave($username) {
    return 'eap_lg2_' . md5(strtolower(trim((string) $username)));
}
function eap_seg_bloqueado($username) {
    return (bool) get_transient(eap_seg_chave($username) . '_b');
}
add_filter('authenticate', function ($user, $username, $password) {
    if ($username !== '' && $username !== null && eap_seg_bloqueado($username)) {
        return new WP_Error('eap_bloqueado', '<strong>Acesso pausado:</strong> muitas tentativas com senha errada. Tente de novo em 15 minutos ou use “Esqueci minha senha”.');
    }
    return $user;
}, 99, 3);
add_action('wp_login_failed', function ($username, $erro = null) {
    static $contado = false; // conta uma vez por tentativa, mesmo que o gancho dispare mais de uma vez
    if ($contado) return;
    $contado = true;
    if (is_wp_error($erro) && $erro->get_error_code() === 'eap_bloqueado') return;
    $k = eap_seg_chave($username);
    $n = (int) get_transient($k) + 1;
    set_transient($k, $n, 15 * MINUTE_IN_SECONDS);
    if ($n >= 5) {
        set_transient($k . '_b', 1, 15 * MINUTE_IN_SECONDS);
        if ($n === 5) error_log('[EA Portal] login pausado para ' . sanitize_user($username));
    }
}, 5, 2);
add_action('wp_login', function ($login) {
    delete_transient(eap_seg_chave($login));
    delete_transient(eap_seg_chave($login) . '_b');
}, 10, 1);
// limpa contadores da versão anterior (que bloqueava por IP)
add_action('init', function () {
    if (get_option('eap_lg_limpo') === '2') return;
    global $wpdb;
    $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '\\_transient\\_eap\\_lg\\_%' OR option_name LIKE '\\_transient\\_timeout\\_eap\\_lg\\_%'");
    update_option('eap_lg_limpo', '2', false);
});
// mesma mensagem para usuário inexistente e senha errada (não revela quem tem cadastro)
add_filter('login_errors', function ($msg) {
    if (strpos($msg, 'Acesso pausado') !== false || ($_REQUEST['action'] ?? 'login') !== 'login') return $msg;
    return '<strong>Erro:</strong> e-mail ou senha incorretos.';
});
