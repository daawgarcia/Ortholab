<?php
/**
 * Login único (SSO) entre Portal do Credenciado, Ortholab 2 e Esthetic Rewards.
 * Token curto assinado com o segredo compartilhado (o mesmo nos três sistemas):
 *   v1.<payload base64url>.<HMAC-SHA256 base64url>
 * Quem recebe acha o cadastro por e-mail; senão CPF (11 dígitos); senão CRO + primeiro nome.
 */
if (!defined('ABSPATH')) exit;

function eap_sso_cfg($k) {
    $padrao = [
        'segredo' => '',
        'ortholab' => 'https://ortholab2.estheticaligner.com.br',
        'rewards' => 'https://pontos.estheticaligner.com.br',
        'ortholab_ativo' => '1',
    ];
    $v = get_option('eap_sso_' . $k, null);
    return ($v === null || $v === false) ? $padrao[$k] : $v;
}

function eap_b64url($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function eap_b64url_dec($s) { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)); }
function eap_digitos($v) { return preg_replace('/\D/', '', (string) $v); }
function eap_primeiro_nome($v) {
    $v = remove_accents(strtolower(trim((string) $v)));
    $v = preg_replace('/^(dra?|dr\(a\))\.?\s+/', '', $v);
    $p = preg_split('/\s+/', $v);
    return $p[0] ?? '';
}

function eap_sso_gerar($user, $destino) {
    $seg = eap_sso_cfg('segredo');
    if (!$seg) return '';
    $agora = time();
    $p = [
        'e' => strtolower($user->user_email), 'nm' => trim($user->first_name . ' ' . $user->last_name) ?: $user->display_name,
        'cpf' => eap_sso_meta_digitos($user->ID, 'cpf'), 'cro' => eap_sso_meta_digitos($user->ID, 'cro'),
        'o' => 'portal', 'd' => $destino, 'iat' => $agora, 'exp' => $agora + 90, 'n' => eap_b64url(random_bytes(12)),
    ];
    if (strlen($p['cpf']) !== 11) $p['cpf'] = '';
    $b = eap_b64url(wp_json_encode($p));
    return 'v1.' . $b . '.' . eap_b64url(hash_hmac('sha256', 'v1.' . $b, $seg, true));
}

function eap_sso_verificar($token, $destino) {
    $seg = eap_sso_cfg('segredo');
    $partes = explode('.', (string) $token);
    if (!$seg || count($partes) !== 3 || $partes[0] !== 'v1') return null;
    $esp = eap_b64url(hash_hmac('sha256', 'v1.' . $partes[1], $seg, true));
    if (!hash_equals($esp, $partes[2])) return null;
    $p = json_decode(eap_b64url_dec($partes[1]), true);
    if (!is_array($p) || empty($p['exp']) || $p['exp'] < time() || ($p['iat'] ?? 0) > time() + 30 || ($p['d'] ?? '') !== $destino) return null;
    if (empty($p['e']) && empty($p['cpf']) && empty($p['cro'])) return null;
    $chave = 'eap_sso_n_' . md5($p['n'] ?? '');
    if (get_transient($chave)) return null; // link já usado
    set_transient($chave, 1, 300);
    return $p;
}

/** Primeiro campo do usuário cujo nome contém $tipo (cpf, cro), só dígitos. */
function eap_sso_meta_digitos($uid, $tipo) {
    global $wpdb;
    $vals = $wpdb->get_col($wpdb->prepare("SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = %d AND meta_key LIKE %s", $uid, '%' . $wpdb->esc_like($tipo) . '%'));
    foreach ($vals as $v) { $d = eap_digitos($v); if (strlen($d) >= 3) return $d; }
    return '';
}

function eap_sso_achar_usuario($p) {
    global $wpdb;
    if (!empty($p['e'])) { $u = get_user_by('email', $p['e']); if ($u) return $u; }
    if (!empty($p['cpf']) && strlen($p['cpf']) === 11) {
        $ids = $wpdb->get_col($wpdb->prepare("SELECT DISTINCT user_id FROM {$wpdb->usermeta} WHERE meta_key LIKE %s AND REGEXP_REPLACE(meta_value, '[^0-9]', '') = %s LIMIT 2", '%cpf%', $p['cpf']));
        if (count($ids) === 1) return get_user_by('id', $ids[0]);
    }
    if (!empty($p['cro']) && strlen($p['cro']) >= 3 && !empty($p['nm'])) {
        $ids = $wpdb->get_col($wpdb->prepare("SELECT DISTINCT user_id FROM {$wpdb->usermeta} WHERE meta_key LIKE %s AND REGEXP_REPLACE(meta_value, '[^0-9]', '') = %s LIMIT 20", '%cro%', $p['cro']));
        $pn = eap_primeiro_nome($p['nm']);
        $ok = [];
        foreach ($ids as $id) { $u = get_user_by('id', $id); if ($u && eap_primeiro_nome(trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name) === $pn) $ok[] = $u; }
        if (count($ok) === 1) return $ok[0];
    }
    return null;
}

// chegada: ?eap_sso=TOKEN (vindo do Ortholab 2)
add_action('init', function () {
    if (empty($_GET['eap_sso'])) return;
    $p = eap_sso_verificar(wp_unslash($_GET['eap_sso']), 'portal');
    if (!$p) { wp_safe_redirect(add_query_arg('login', 'sso-expirado', home_url('/'))); exit; }
    $u = eap_sso_achar_usuario($p);
    if (!$u) { wp_safe_redirect(add_query_arg('login', 'sso-nao-encontrado', home_url('/'))); exit; }
    wp_set_current_user($u->ID);
    wp_set_auth_cookie($u->ID, true);
    do_action('wp_login', $u->user_login, $u);
    wp_safe_redirect(home_url('/area-do-credenciado/'));
    exit;
}, 1);

// saída: ?eap_ir=ortholab | rewards (logado)
add_action('template_redirect', function () {
    if (empty($_GET['eap_ir'])) return;
    $dest = sanitize_key($_GET['eap_ir']);
    if (!in_array($dest, ['ortholab', 'rewards'], true)) return;
    if (!is_user_logged_in()) { wp_safe_redirect(home_url('/')); exit; }
    $t = eap_sso_gerar(wp_get_current_user(), $dest);
    $base = untrailingslashit(eap_sso_cfg($dest));
    if (!$t) { wp_redirect($dest === 'ortholab' ? $base . '/login' : $base . '/'); exit; }
    $url = $dest === 'ortholab' ? $base . '/api/auth/sso/entrar?t=' . rawurlencode($t) : $base . '/sso?t=' . rawurlencode($t);
    wp_redirect($url);
    exit;
}, 0);

// tela de configuração
add_action('admin_menu', function () {
    add_submenu_page('eap-portal', 'Login único', 'Login único', 'manage_options', 'eap-sso', 'eap_sso_pagina');
});
function eap_sso_pagina() {
    if (isset($_POST['eap_sso_salvar']) && check_admin_referer('eap_sso')) {
        if (!empty($_POST['segredo'])) update_option('eap_sso_segredo', sanitize_text_field(wp_unslash($_POST['segredo'])), false);
        update_option('eap_sso_ortholab', esc_url_raw(wp_unslash($_POST['ortholab'] ?? '')));
        update_option('eap_sso_rewards', esc_url_raw(wp_unslash($_POST['rewards'] ?? '')));
        update_option('eap_sso_ortholab_ativo', empty($_POST['ortholab_ativo']) ? '0' : '1');
        echo '<div class="notice notice-success"><p>Configuração salva.</p></div>';
    }
    $tem = eap_sso_cfg('segredo') !== '';
    ?>
    <div class="wrap"><h1>Login único (Portal ↔ Ortholab ↔ Rewards)</h1>
    <p>O dentista logado aqui entra direto no Ortholab e no Esthetic Rewards (e vice-versa). O cadastro é reconhecido pelo e-mail; se não bater, pelo CPF; se não bater, pelo CRO + primeiro nome.</p>
    <form method="post"><?php wp_nonce_field('eap_sso'); ?>
    <table class="form-table">
      <tr><th>Chave compartilhada</th><td><input type="password" name="segredo" class="regular-text" autocomplete="new-password" placeholder="<?php echo $tem ? 'configurada — deixe em branco para manter' : 'cole aqui a mesma chave dos outros sistemas'; ?>"><p class="description">Tem que ser idêntica no Ortholab 2 e no Rewards.</p></td></tr>
      <tr><th>Endereço do Ortholab</th><td><input type="url" name="ortholab" class="regular-text" value="<?php echo esc_attr(eap_sso_cfg('ortholab')); ?>">
        <label style="margin-left:10px"><input type="checkbox" name="ortholab_ativo" value="1" <?php checked(eap_sso_cfg('ortholab_ativo'), '1'); ?>> usar login único no botão "Ortholab"</label></td></tr>
      <tr><th>Endereço do Rewards</th><td><input type="url" name="rewards" class="regular-text" value="<?php echo esc_attr(eap_sso_cfg('rewards')); ?>"></td></tr>
    </table>
    <p><button class="button button-primary" name="eap_sso_salvar" value="1">Salvar</button></p></form></div>
    <?php
}

/** Links usados pelo tema. */
function eap_sso_link($dest) {
    if ($dest === 'ortholab' && eap_sso_cfg('ortholab_ativo') !== '1') return '';
    return eap_sso_cfg('segredo') ? home_url('/?eap_ir=' . $dest) : '';
}
