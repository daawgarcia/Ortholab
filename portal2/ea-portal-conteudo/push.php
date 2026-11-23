<?php
/**
 * Notificações no celular (Web Push) — sem serviço externo.
 *  - O dentista ativa no portal (Android/computador direto; iPhone com o portal instalado na tela inicial).
 *  - Programadas: Portal do Credenciado → 🔔 Notificações (data/hora, repetição, público).
 *  - Automáticas: inatividade, curso parado, certificado, lembrete de curso da agenda e resumo diário de novidades.
 *  - Regras: no máximo 1 por dia por dentista (programadas passam na frente), só das 8h às 20h.
 * Criptografia do padrão Web Push (RFC 8291, aes128gcm) e assinatura VAPID (RFC 8292) feitas com o OpenSSL do PHP.
 */
if (!defined('ABSPATH')) exit;

const EAP_PUSH_CATS = ['novidades' => 'Novidades (aulas, posts e materiais novos)', 'cursos' => 'Cursos e eventos', 'lembretes' => 'Lembretes (aulas paradas, tempo sem acessar)'];

// ------------------------------------------------------------ tabelas
function eap_push_tabelas() {
    global $wpdb;
    return [$wpdb->prefix . 'eap_push_subs', $wpdb->prefix . 'eap_push_log'];
}
add_action('init', function () {
    if (get_option('eap_push_db') === '2') return;
    global $wpdb;
    [$s, $l] = eap_push_tabelas();
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $c = $wpdb->get_charset_collate();
    dbDelta("CREATE TABLE $s (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint(20) unsigned NOT NULL,
        endpoint text NOT NULL,
        ehash char(40) NOT NULL,
        p256dh varchar(120) NOT NULL,
        auth varchar(60) NOT NULL,
        aparelho varchar(60) NOT NULL DEFAULT '',
        criado datetime NOT NULL,
        ultimo_ok datetime NULL,
        falhas smallint NOT NULL DEFAULT 0,
        PRIMARY KEY  (id),
        UNIQUE KEY ehash (ehash),
        KEY user_id (user_id)
    ) $c;");
    dbDelta("CREATE TABLE $l (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint(20) unsigned NOT NULL,
        quando datetime NOT NULL,
        origem varchar(40) NOT NULL,
        entregue tinyint(1) NOT NULL DEFAULT 0,
        clicado datetime NULL,
        PRIMARY KEY  (id),
        KEY user_quando (user_id, quando),
        KEY origem (origem)
    ) $c;");
    update_option('eap_push_db', '2', false);
}, 5);

// ------------------------------------------------------------ chaves VAPID e utilitários
function eap_b64u($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function eap_b64u_dec($s) { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)); }
function eap_push_suportado() { return function_exists('openssl_pkey_derive') && function_exists('hash_hkdf') && in_array('aes-128-gcm', openssl_get_cipher_methods(), true); }

function eap_push_vapid() {
    $v = get_option('eap_push_vapid');
    if (is_array($v) && !empty($v['priv']) && !empty($v['pub'])) return $v;
    $k = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if (!$k) return null;
    openssl_pkey_export($k, $pem);
    $d = openssl_pkey_get_details($k);
    $v = ['priv' => $pem, 'pub' => eap_b64u("\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT))];
    update_option('eap_push_vapid', $v, false);
    return $v;
}
/** Chave pública P-256 crua (65 bytes) → recurso OpenSSL. */
function eap_push_pub_pem($raw) {
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $raw;
    return openssl_pkey_get_public("-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n");
}
/** Assinatura ES256: DER do OpenSSL → r||s (64 bytes). */
function eap_push_der2raw($der) {
    $p = 2; if (ord($der[1]) & 0x80) $p += ord($der[1]) & 0x7f;
    $lr = ord($der[$p + 1]); $r = substr($der, $p + 2, $lr); $p += 2 + $lr;
    $ls = ord($der[$p + 1]); $s = substr($der, $p + 2, $ls);
    $r = str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT); $s = str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
    return $r . $s;
}
function eap_push_jwt($endpoint) {
    $v = eap_push_vapid();
    $u = wp_parse_url($endpoint);
    $h = eap_b64u(wp_json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $c = eap_b64u(wp_json_encode(['aud' => $u['scheme'] . '://' . $u['host'], 'exp' => time() + 12 * 3600, 'sub' => 'mailto:marketing@estheticaligner.com.br']));
    openssl_sign("$h.$c", $sig, $v['priv'], OPENSSL_ALGO_SHA256);
    return "$h.$c." . eap_b64u(eap_push_der2raw($sig));
}
/** Criptografa a mensagem para uma assinatura (RFC 8291 / aes128gcm). */
function eap_push_cifrar($texto, $p256dh, $auth) {
    $ua = eap_b64u_dec($p256dh); $seg = eap_b64u_dec($auth);
    if (strlen($ua) !== 65 || strlen($seg) !== 16) return null;
    $eph = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    $d = openssl_pkey_get_details($eph);
    $as = "\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);
    $ecdh = openssl_pkey_derive(eap_push_pub_pem($ua), $eph, 32);
    if (!$ecdh) return null;
    $ikm = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . $ua . $as, $seg);
    $sal = random_bytes(16);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $sal);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $sal);
    $cifra = openssl_encrypt($texto . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    return $sal . pack('N', 4096) . chr(65) . $as . $cifra . $tag;
}
/** Envia para uma assinatura. Retorna 'ok', 'expirada' ou 'erro'. */
function eap_push_enviar_sub($sub, $dados) {
    $corpo = eap_push_cifrar(wp_json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $sub->p256dh, $sub->auth);
    if ($corpo === null) return 'erro';
    $r = wp_remote_post($sub->endpoint, ['timeout' => 15, 'body' => $corpo, 'headers' => [
        'Content-Type' => 'application/octet-stream', 'Content-Encoding' => 'aes128gcm', 'TTL' => '86400', 'Urgency' => 'normal',
        'Authorization' => 'vapid t=' . eap_push_jwt($sub->endpoint) . ', k=' . eap_push_vapid()['pub'],
    ]]);
    global $wpdb; [$t] = eap_push_tabelas();
    $cod = is_wp_error($r) ? 0 : (int) wp_remote_retrieve_response_code($r);
    if ($cod >= 200 && $cod < 300) { $wpdb->update($t, ['ultimo_ok' => current_time('mysql'), 'falhas' => 0], ['id' => $sub->id]); return 'ok'; }
    if (in_array($cod, [404, 410], true)) { $wpdb->delete($t, ['id' => $sub->id]); return 'expirada'; }
    $wpdb->query($wpdb->prepare("UPDATE $t SET falhas = falhas + 1 WHERE id = %d", $sub->id));
    $wpdb->query("DELETE FROM $t WHERE falhas >= 8");
    return 'erro';
}

// ------------------------------------------------------------ preferências e envio a um dentista
function eap_push_prefs($uid) {
    $p = get_user_meta($uid, 'eap_push_prefs', true);
    return is_array($p) ? $p : array_keys(EAP_PUSH_CATS);
}
function eap_push_recebeu_hoje($uid) {
    global $wpdb; [, $l] = eap_push_tabelas();
    return (bool) $wpdb->get_var($wpdb->prepare("SELECT 1 FROM $l WHERE user_id = %d AND quando >= %s AND entregue = 1 LIMIT 1", $uid, wp_date('Y-m-d 00:00:00')));
}
/**
 * Envia uma notificação a um dentista (todos os aparelhos dele).
 * $forcar = ignora o limite de 1 por dia (programadas e testes).
 */
function eap_push_para($uid, $titulo, $texto, $url, $origem, $cat = '', $forcar = false) {
    global $wpdb; [$t, $l] = eap_push_tabelas();
    if ($cat && !in_array($cat, eap_push_prefs($uid), true)) return 0;
    if (!$forcar && eap_push_recebeu_hoje($uid)) return 0;
    $subs = $wpdb->get_results($wpdb->prepare("SELECT * FROM $t WHERE user_id = %d", $uid));
    if (!$subs) return 0;
    $wpdb->insert($l, ['user_id' => $uid, 'quando' => current_time('mysql'), 'origem' => mb_substr($origem, 0, 40)]);
    $log = (int) $wpdb->insert_id;
    $url = add_query_arg('eap_push', $log, $url ?: home_url('/area-do-credenciado/'));
    $dados = ['title' => wp_strip_all_tags($titulo), 'body' => wp_strip_all_tags($texto), 'url' => $url, 'tag' => 'eap-' . $log, 'icon' => function_exists('eapt_pwa_icone') ? eapt_pwa_icone('192') : ''];
    $ok = 0;
    foreach ($subs as $s) if (eap_push_enviar_sub($s, $dados) === 'ok') $ok++;
    if ($ok) $wpdb->update($l, ['entregue' => 1], ['id' => $log]); else $wpdb->delete($l, ['id' => $log]);
    return $ok ? 1 : 0;
}
function eap_push_usuarios() {
    global $wpdb; [$t] = eap_push_tabelas();
    return array_map('intval', $wpdb->get_col("SELECT DISTINCT user_id FROM $t"));
}
function eap_push_horario_ok() { $h = (int) wp_date('G'); return $h >= 8 && $h < 20; }

// ------------------------------------------------------------ ativação pelo dentista
add_action('wp_ajax_eap_push_sub', function () {
    if (!check_ajax_referer('eap_push', '_n', false)) wp_send_json_error('sessao', 403);
    global $wpdb; [$t] = eap_push_tabelas();
    $uid = get_current_user_id();
    if (($_POST['acao'] ?? '') === 'prefs') {
        $p = array_values(array_intersect(array_keys(EAP_PUSH_CATS), array_map('sanitize_key', (array) ($_POST['cats'] ?? []))));
        update_user_meta($uid, 'eap_push_prefs', $p);
        wp_send_json_success(['prefs' => $p]);
    }
    $s = json_decode(wp_unslash($_POST['sub'] ?? ''), true);
    $ep = esc_url_raw($s['endpoint'] ?? '');
    if (!$ep || strpos($ep, 'https://') !== 0) wp_send_json_error('assinatura', 400);
    if (($_POST['acao'] ?? '') === 'sair') { $wpdb->delete($t, ['ehash' => sha1($ep), 'user_id' => $uid]); wp_send_json_success(); }
    $p256 = preg_replace('~[^A-Za-z0-9_-]~', '', (string) ($s['keys']['p256dh'] ?? ''));
    $au = preg_replace('~[^A-Za-z0-9_-]~', '', (string) ($s['keys']['auth'] ?? ''));
    if (strlen(eap_b64u_dec($p256)) !== 65 || strlen(eap_b64u_dec($au)) !== 16) wp_send_json_error('chaves', 400);
    $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $ap = stripos($ua, 'iphone') !== false || stripos($ua, 'ipad') !== false ? 'iPhone' : (stripos($ua, 'android') !== false ? 'Android' : 'Computador');
    $wpdb->query($wpdb->prepare("INSERT INTO $t (user_id, endpoint, ehash, p256dh, auth, aparelho, criado) VALUES (%d, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), falhas = 0", $uid, $ep, sha1($ep), $p256, $au, $ap, current_time('mysql')));
    if (function_exists('eap_evento')) eap_evento('push_ativou', 0, $ap);
    $boas = !get_user_meta($uid, 'eap_push_boas_vindas', true);
    if ($boas) { update_user_meta($uid, 'eap_push_boas_vindas', 1); eap_push_para($uid, 'Notificações ativadas ✓', 'Você vai receber aqui os avisos de cursos e novidades da Esthetic Aligner.', home_url('/area-do-credenciado/'), 'boas-vindas', '', true); }
    wp_send_json_success(['prefs' => eap_push_prefs($uid)]);
});
// clique na notificação
add_action('init', function () {
    if (empty($_GET['eap_push']) || !is_user_logged_in()) return;
    global $wpdb; [, $l] = eap_push_tabelas();
    $wpdb->query($wpdb->prepare("UPDATE $l SET clicado = %s WHERE id = %d AND user_id = %d AND clicado IS NULL", current_time('mysql'), (int) $_GET['eap_push'], get_current_user_id()));
}, 20);

// ------------------------------------------------------------ notificações programadas (CPT)
add_action('init', function () {
    register_post_type('ea_push', [
        'labels' => ['name' => 'Notificações no celular', 'singular_name' => 'Notificação', 'add_new' => 'Nova notificação', 'add_new_item' => 'Nova notificação no celular', 'edit_item' => 'Editar notificação', 'all_items' => '🔔 Notificações', 'not_found' => 'Nenhuma notificação programada.'],
        'public' => false, 'show_ui' => true, 'show_in_menu' => 'eap-portal', 'supports' => ['title'], 'show_in_rest' => false,
    ]);
});
function eap_push_meta($id) {
    $g = fn($k, $d = '') => (string) (get_post_meta($id, '_eap_p_' . $k, true) ?: $d);
    return ['texto' => $g('texto'), 'link' => $g('link'), 'quando' => $g('quando'), 'repetir' => $g('repetir', 'nao'), 'publico' => $g('publico', 'todos'), 'dias' => (int) $g('dias', '15'),
        'cat' => $g('cat', 'cursos'), 'proximo' => $g('proximo'), 'enviados' => (int) $g('enviados', '0'), 'ultimo' => $g('ultimo')];
}
const EAP_PUSH_PUBLICO = ['todos' => 'Todos que ativaram', 'sem_curso' => 'Quem ainda não concluiu o Curso do Credenciado', 'inativos' => 'Quem não acessa o portal há X dias'];
const EAP_PUSH_REPETIR = ['nao' => 'Não repetir (envio único)', 'diaria' => 'Todo dia', 'semanal' => 'Toda semana, no mesmo dia e horário', 'mensal' => 'Todo mês, no mesmo dia e horário'];

add_action('add_meta_boxes_ea_push', function () { add_meta_box('eap_push', 'Mensagem, quando e para quem', 'eap_push_box', 'ea_push', 'normal', 'high'); });
function eap_push_box($post) {
    $m = eap_push_meta($post->ID);
    wp_nonce_field('eap_push_box', 'eap_push_n');
    $op = fn($l, $a) => implode('', array_map(fn($k, $v) => '<option value="' . esc_attr($k) . '"' . selected($a, $k, false) . '>' . esc_html($v) . '</option>', array_keys($l), $l));
    $quando = $m['quando'] ? str_replace(' ', 'T', substr($m['quando'], 0, 16)) : wp_date('Y-m-d\TH:i', time() + 3600);
    ?>
    <style>.eap-pu td{padding:8px 10px;vertical-align:top}.eap-pu .d{color:#646970;font-size:12.5px;margin-top:4px}.eap-pu input[type=text],.eap-pu input[type=url],.eap-pu textarea{width:520px;max-width:100%}.eap-pu-prev{display:flex;gap:10px;align-items:flex-start;background:#f6f7f7;border-radius:12px;padding:12px 14px;max-width:420px;font-family:system-ui}.eap-pu-prev img{width:38px;height:38px;border-radius:8px}.eap-pu-prev b{display:block}</style>
    <p class="d" style="color:#646970">O título acima é o título da notificação (curto, até ~40 letras).</p>
    <table class="eap-pu">
      <tr><td><b>Texto</b></td><td><textarea name="eap_p_texto" rows="2" maxlength="160" required placeholder="Ex.: Inscrições abertas para a Masterclass de 03/12 em São Paulo. Garanta sua vaga!"><?php echo esc_textarea($m['texto']); ?></textarea><div class="d">Até ~120 letras aparecem bem no celular.</div></td></tr>
      <tr><td><b>Abrir ao tocar</b></td><td><input type="url" name="eap_p_link" value="<?php echo esc_attr($m['link']); ?>" placeholder="<?php echo esc_attr(home_url('/agenda-de-cursos/')); ?>"><div class="d">Página do portal que abre ao tocar. Em branco = início do portal.</div></td></tr>
      <tr><td><b>Enviar em</b></td><td><input type="datetime-local" name="eap_p_quando" value="<?php echo esc_attr($quando); ?>" required> <select name="eap_p_repetir"><?php echo $op(EAP_PUSH_REPETIR, $m['repetir']); ?></select><div class="d">Envios só acontecem das 8h às 20h; fora disso, saem às 8h seguintes.</div></td></tr>
      <tr><td><b>Para quem</b></td><td><select name="eap_p_publico"><?php echo $op(EAP_PUSH_PUBLICO, $m['publico']); ?></select> X = <input type="number" name="eap_p_dias" value="<?php echo (int) $m['dias']; ?>" min="1" max="365" style="width:70px"> dias
        <div class="d">Tipo: <select name="eap_p_cat"><?php echo $op(EAP_PUSH_CATS, $m['cat']); ?></select> — quem desligou esse tipo nas preferências não recebe.</div></td></tr>
      <?php if ($post->post_status === 'publish') : ?><tr><td><b>Situação</b></td><td><?php echo $m['proximo'] ? 'Próximo envio: <b>' . esc_html(mysql2date('d/m/Y H:i', $m['proximo'])) . '</b>' : 'Concluída'; ?> · Enviada para <b><?php echo (int) $m['enviados']; ?></b> dentista(s) no total<?php echo $m['ultimo'] ? ' · último envio ' . esc_html(mysql2date('d/m/Y H:i', $m['ultimo'])) : ''; ?> · <?php echo (int) eap_push_cliques('camp-' . $post->ID); ?> toque(s)</td></tr><?php endif; ?>
    </table>
    <p><b>Prévia</b></p>
    <div class="eap-pu-prev"><img src="<?php echo esc_url(function_exists('eapt_pwa_icone') ? eapt_pwa_icone('192') : ''); ?>" alt=""><div><b data-pu-t><?php echo esc_html($post->post_title ?: 'Título da notificação'); ?></b><span data-pu-x><?php echo esc_html($m['texto'] ?: 'Texto da notificação'); ?></span></div></div>
    <script>(function(){var t=document.getElementById('title'),x=document.querySelector('[name=eap_p_texto]');function u(){document.querySelector('[data-pu-t]').textContent=(t&&t.value)||'Título da notificação';document.querySelector('[data-pu-x]').textContent=x.value||'Texto da notificação';}if(t)t.addEventListener('input',u);x.addEventListener('input',u);})();</script>
    <p class="d" style="color:#646970">Publique para agendar. Para testar antes, salve e use “Enviar teste para mim” na lista de notificações.</p>
    <?php
}
add_action('save_post_ea_push', function ($id) {
    if (!isset($_POST['eap_push_n']) || !wp_verify_nonce($_POST['eap_push_n'], 'eap_push_box') || (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || !current_user_can('edit_post', $id)) return;
    $t = fn($k) => sanitize_text_field(wp_unslash($_POST['eap_p_' . $k] ?? ''));
    update_post_meta($id, '_eap_p_texto', mb_substr(sanitize_textarea_field(wp_unslash($_POST['eap_p_texto'] ?? '')), 0, 200));
    update_post_meta($id, '_eap_p_link', esc_url_raw($t('link')));
    $q = preg_match('~^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$~', $t('quando')) ? str_replace('T', ' ', $t('quando')) . ':00' : current_time('mysql');
    $antes = get_post_meta($id, '_eap_p_quando', true);
    update_post_meta($id, '_eap_p_quando', $q);
    update_post_meta($id, '_eap_p_repetir', isset(EAP_PUSH_REPETIR[$t('repetir')]) ? $t('repetir') : 'nao');
    update_post_meta($id, '_eap_p_publico', isset(EAP_PUSH_PUBLICO[$t('publico')]) ? $t('publico') : 'todos');
    update_post_meta($id, '_eap_p_dias', max(1, min(365, (int) $t('dias'))));
    update_post_meta($id, '_eap_p_cat', isset(EAP_PUSH_CATS[$t('cat')]) ? $t('cat') : 'cursos');
    if ($antes !== $q || !get_post_meta($id, '_eap_p_proximo', true)) update_post_meta($id, '_eap_p_proximo', $q);
});
function eap_push_cliques($origem) {
    global $wpdb; [, $l] = eap_push_tabelas();
    return (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $l WHERE origem = %s AND clicado IS NOT NULL", $origem));
}
add_filter('manage_ea_push_posts_columns', fn($c) => ['cb' => $c['cb'], 'title' => 'Notificação', 'eap_q' => 'Próximo envio', 'eap_p' => 'Para quem', 'eap_r' => 'Resultado', 'eap_t' => '']);
add_action('manage_ea_push_posts_custom_column', function ($col, $id) {
    $m = eap_push_meta($id);
    if ($col === 'eap_q') echo $m['proximo'] ? esc_html(mysql2date('d/m/Y H:i', $m['proximo'])) . ($m['repetir'] !== 'nao' ? '<br><small>' . esc_html(EAP_PUSH_REPETIR[$m['repetir']]) . '</small>' : '') : '<em>Concluída</em>';
    if ($col === 'eap_p') echo esc_html(str_replace('X dias', $m['dias'] . ' dias', EAP_PUSH_PUBLICO[$m['publico']] ?? ''));
    if ($col === 'eap_r') echo (int) $m['enviados'] . ' enviada(s) · ' . eap_push_cliques('camp-' . $id) . ' toque(s)';
    if ($col === 'eap_t') echo '<a class="button button-small" href="' . esc_url(wp_nonce_url(admin_url('admin-post.php?action=eap_push_teste&id=' . $id), 'eap_push_teste')) . '">Enviar teste para mim</a>';
}, 10, 2);
add_action('admin_post_eap_push_teste', function () {
    if (!current_user_can('edit_pages') || !check_admin_referer('eap_push_teste')) wp_die('Sem permissão.');
    $id = (int) ($_GET['id'] ?? 0);
    $m = $id ? eap_push_meta($id) : [];
    $ok = eap_push_para(get_current_user_id(), $id ? get_the_title($id) : 'Teste de notificação', $id ? $m['texto'] : 'Se você está vendo isto, as notificações do portal estão funcionando.', $id ? $m['link'] : '', 'teste', '', true);
    wp_safe_redirect(add_query_arg('eap_teste', $ok ? 'ok' : 'sem', wp_get_referer() ?: admin_url('edit.php?post_type=ea_push'))); exit;
});
add_action('admin_notices', function () {
    $s = get_current_screen();
    if (!$s || !in_array($s->id, ['edit-ea_push', 'ea_push'], true)) return;
    if (isset($_GET['eap_teste'])) echo $_GET['eap_teste'] === 'ok' ? '<div class="notice notice-success"><p>Teste enviado para os seus aparelhos ✓</p></div>' : '<div class="notice notice-warning"><p>Você ainda não ativou as notificações em nenhum aparelho. Abra o portal no celular e toque em “Ativar notificações”.</p></div>';
    if ($s->id === 'edit-ea_push') { global $wpdb; [$t] = eap_push_tabelas(); $n = (int) $wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM $t");
        echo '<div class="notice notice-info"><p><b>' . $n . '</b> dentista(s) com notificações ativadas. Envios só das 8h às 20h; no máximo 1 por dia por dentista (as programadas passam na frente). <a href="' . esc_url(admin_url('admin.php?page=eap-push-auto')) . '">Automáticas e resultados →</a></p></div>'; }
    if (!eap_push_suportado()) echo '<div class="notice notice-error"><p>O servidor não tem os recursos de criptografia necessários para as notificações (OpenSSL com ECDH). Fale com a hospedagem.</p></div>';
});

/** Público de uma notificação programada. */
function eap_push_publico($m) {
    $ids = eap_push_usuarios();
    if ($m['publico'] === 'sem_curso' && function_exists('eap_curso_concluido')) $ids = array_values(array_filter($ids, fn($u) => !get_user_meta($u, 'eap_curso_concluido_em', true)));
    if ($m['publico'] === 'inativos') { $lim = time() - $m['dias'] * DAY_IN_SECONDS; $ids = array_values(array_filter($ids, fn($u) => (int) get_user_meta($u, 'eap_ultimo_acesso', true) < $lim)); }
    return $ids;
}
function eap_push_proximo($m) {
    $p = strtotime($m['proximo']);
    $map = ['diaria' => '+1 day', 'semanal' => '+1 week', 'mensal' => '+1 month'];
    if (!isset($map[$m['repetir']])) return '';
    do { $p = strtotime($map[$m['repetir']], $p); } while ($p <= current_time('timestamp'));
    return date('Y-m-d H:i:s', $p);
}

// ------------------------------------------------------------ automáticas (configuração)
function eap_push_auto() {
    $d = [
        'inativ_on' => 1, 'inativ' => [
            ['dias' => 7, 'titulo' => 'Sentimos sua falta 👋', 'texto' => 'Faz uma semana que você não acessa o portal. Veja as novidades da Esthetic Aligner.'],
            ['dias' => 15, 'titulo' => 'Tem novidade esperando por você', 'texto' => 'Aulas, materiais e posts novos no Portal do Credenciado. Dá uma olhada!'],
            ['dias' => 30, 'titulo' => 'Seu portal Esthetic Aligner', 'texto' => 'Faz um mês que você não aparece. Confira a agenda de cursos e os materiais novos.'],
        ],
        'curso_on' => 1, 'curso_dias' => 5, 'curso_titulo' => 'Continue o Curso do Credenciado', 'curso_texto' => 'Você parou na aula {feitas} de {total}. Faltam poucas para o seu certificado!',
        'cert_on' => 1,
        'agenda_on' => 1, 'agenda_dias' => 3,
        'novid_on' => 1, 'novid_tipos' => ['ea_aula', 'ea_curso', 'ea_post', 'ea_material'],
    ];
    $o = get_option('eap_push_auto', []);
    return array_merge($d, is_array($o) ? $o : []);
}
const EAP_PUSH_TIPOS = ['ea_aula' => 'aula nova', 'ea_curso' => 'curso na agenda', 'ea_post' => 'post novo', 'ea_material' => 'material novo'];

// novidades: entram numa fila e saem no resumo do dia
add_action('transition_post_status', function ($novo, $velho, $post) {
    if ($novo !== 'publish' || $velho === 'publish' || !isset(EAP_PUSH_TIPOS[$post->post_type])) return;
    $f = get_option('eap_push_fila', []); $f = is_array($f) ? $f : [];
    $f[] = ['tipo' => $post->post_type, 'id' => $post->ID, 'titulo' => $post->post_title];
    update_option('eap_push_fila', array_slice($f, -50), false);
}, 10, 3);
// certificado
add_action('updated_user_meta', function ($mid, $uid, $chave) { if ($chave === 'eap_curso_concluido_em') eap_push_cert($uid); }, 10, 3);
add_action('added_user_meta', function ($mid, $uid, $chave) { if ($chave === 'eap_curso_concluido_em') eap_push_cert($uid); }, 10, 3);
function eap_push_cert($uid) {
    if (!eap_push_auto()['cert_on']) return;
    eap_push_para($uid, 'Seu certificado está pronto 🎓', 'Parabéns por concluir o Curso do Credenciado! Toque para baixar o certificado.', home_url('/video-aulas/?trilha=curso-do-credenciado'), 'auto-cert', '', true);
}

// ------------------------------------------------------------ rotina (a cada 15 min)
add_filter('cron_schedules', function ($s) { $s['eap_15min'] = ['interval' => 900, 'display' => 'A cada 15 minutos']; return $s; });
add_action('init', function () { if (!wp_next_scheduled('eap_push_tick')) wp_schedule_event(time() + 120, 'eap_15min', 'eap_push_tick'); });
add_action('eap_push_tick', 'eap_push_rodar');
function eap_push_rodar() {
    if (!eap_push_suportado() || !eap_push_horario_ok() || get_transient('eap_push_lock')) return;
    set_transient('eap_push_lock', 1, 600);
    @set_time_limit(300);
    $agora = current_time('mysql');
    // 1) programadas
    foreach (get_posts(['post_type' => 'ea_push', 'post_status' => 'publish', 'numberposts' => 20, 'meta_query' => [['key' => '_eap_p_proximo', 'value' => $agora, 'compare' => '<=', 'type' => 'DATETIME'], ['key' => '_eap_p_proximo', 'value' => '', 'compare' => '!=']]]) as $p) {
        $m = eap_push_meta($p->ID); $n = 0;
        foreach (eap_push_publico($m) as $u) $n += eap_push_para($u, $p->post_title, $m['texto'], $m['link'], 'camp-' . $p->ID, $m['cat'], true);
        update_post_meta($p->ID, '_eap_p_enviados', $m['enviados'] + $n);
        update_post_meta($p->ID, '_eap_p_ultimo', $agora);
        update_post_meta($p->ID, '_eap_p_proximo', eap_push_proximo($m));
    }
    // 2) automáticas: uma vez por dia, a partir das 10h
    if ((int) wp_date('G') >= 10 && get_option('eap_push_auto_dia') !== wp_date('Y-m-d')) {
        update_option('eap_push_auto_dia', wp_date('Y-m-d'), false);
        eap_push_automaticas();
    }
    delete_transient('eap_push_lock');
}
function eap_push_automaticas() {
    $c = eap_push_auto();
    $users = eap_push_usuarios();
    // resumo de novidades
    $fila = get_option('eap_push_fila', []);
    if ($c['novid_on'] && is_array($fila) && $fila) {
        $fila = array_values(array_filter($fila, fn($i) => in_array($i['tipo'], (array) $c['novid_tipos'], true) && get_post_status($i['id']) === 'publish'));
        if ($fila) {
            $cont = array_count_values(array_column($fila, 'tipo'));
            $partes = []; foreach ($cont as $tp => $n) $partes[] = $n . ' ' . ($n > 1 ? str_replace(['aula nova', 'curso na agenda', 'post novo', 'material novo'], ['aulas novas', 'cursos na agenda', 'posts novos', 'materiais novos'], EAP_PUSH_TIPOS[$tp]) : EAP_PUSH_TIPOS[$tp]);
            $um = count($fila) === 1;
            $tit = $um ? 'Novidade no portal: ' . mb_substr($fila[0]['titulo'], 0, 60) : count($fila) . ' novidades no portal';
            $txt = $um ? 'Toque para ver no Portal do Credenciado.' : ucfirst(implode(', ', $partes)) . '. Toque para ver.';
            $link = $um ? ['ea_aula' => add_query_arg('aula', $fila[0]['id'], home_url('/video-aulas/')), 'ea_curso' => home_url('/agenda-de-cursos/'), 'ea_post' => home_url('/marketing/'), 'ea_material' => home_url('/downloads/')][$fila[0]['tipo']] : home_url('/area-do-credenciado/');
            $cat = $um && $fila[0]['tipo'] === 'ea_curso' ? 'cursos' : 'novidades';
            foreach ($users as $u) eap_push_para($u, $tit, $txt, $link, 'auto-novid', $cat);
        }
        update_option('eap_push_fila', [], false);
    }
    // lembrete de curso da agenda (X dias antes)
    if ($c['agenda_on'] && function_exists('eap_ag_cursos')) {
        $alvo = wp_date('Y-m-d', time() + (int) $c['agenda_dias'] * DAY_IN_SECONDS);
        foreach (eap_ag_cursos()['proximos'] as $p) {
            $m = eap_ag_meta($p->ID);
            if ($m['data'] !== $alvo || $m['status'] === 'esgotado') continue;
            $txt = ucfirst(eap_ag_data_longa($m)) . ($m['hi'] ? ', ' . eap_ag_horario($m) : '') . ($m['cidade'] ? ' · ' . $m['cidade'] : '') . '.';
            foreach ($users as $u) eap_push_para($u, 'Em ' . (int) $c['agenda_dias'] . ' dias: ' . mb_substr($p->post_title, 0, 50), $txt, home_url('/agenda-de-cursos/'), 'auto-agenda-' . $p->ID, 'cursos');
        }
    }
    // curso parado
    if ($c['curso_on'] && function_exists('eap_curso_ids')) {
        $ids = eap_curso_ids(); $total = count($ids);
        foreach ($users as $u) {
            if (!$total || get_user_meta($u, 'eap_curso_concluido_em', true)) continue;
            $feitas = count(array_intersect($ids, eap_aulas_feitas($u)));
            if ($feitas < 1) continue;
            $quando = (int) get_user_meta($u, 'eap_ultima_aula_em', true);
            if (!$quando || $quando > time() - (int) $c['curso_dias'] * DAY_IN_SECONDS) continue;
            if (get_user_meta($u, 'eap_push_curso_av', true) == $feitas) continue; // um lembrete por etapa
            $txt = strtr($c['curso_texto'], ['{feitas}' => $feitas, '{total}' => $total]);
            if (eap_push_para($u, $c['curso_titulo'], $txt, home_url('/video-aulas/?trilha=curso-do-credenciado'), 'auto-curso', 'lembretes')) update_user_meta($u, 'eap_push_curso_av', $feitas);
        }
    }
    // inatividade (cada degrau uma vez por período sem acesso)
    if ($c['inativ_on']) {
        foreach ($users as $u) {
            $ult = (int) get_user_meta($u, 'eap_ultimo_acesso', true);
            if (!$ult) continue;
            $dias = (int) floor((time() - $ult) / DAY_IN_SECONDS);
            $feito = (array) get_user_meta($u, 'eap_push_inativ', true);
            if (($feito['desde'] ?? 0) != $ult) $feito = ['desde' => $ult, 'n' => []];
            $deg = null; foreach ((array) $c['inativ'] as $d) if (!empty($d['dias']) && $dias >= (int) $d['dias'] && !in_array((int) $d['dias'], $feito['n'], true)) $deg = $d;
            if (!$deg) continue;
            if (eap_push_para($u, $deg['titulo'], $deg['texto'], home_url('/area-do-credenciado/'), 'auto-inativ-' . (int) $deg['dias'], 'lembretes')) {
                foreach ((array) $c['inativ'] as $d) if ((int) $d['dias'] <= (int) $deg['dias']) $feito['n'][] = (int) $d['dias'];
                update_user_meta($u, 'eap_push_inativ', $feito);
            }
        }
    }
}

// ------------------------------------------------------------ página: automáticas e resultados
add_action('admin_menu', function () {
    add_submenu_page('eap-portal', 'Notificações automáticas', '🔔 Automáticas', 'edit_pages', 'eap-push-auto', 'eap_push_auto_pagina', 60);
}, 30);
function eap_push_auto_pagina() {
    if (isset($_POST['eap_push_auto_salvar']) && check_admin_referer('eap_push_auto')) {
        $t = fn($k) => sanitize_text_field(wp_unslash($_POST[$k] ?? ''));
        $in = [];
        foreach ((array) ($_POST['inativ'] ?? []) as $d) { $dd = (int) ($d['dias'] ?? 0); if ($dd > 0) $in[] = ['dias' => $dd, 'titulo' => sanitize_text_field(wp_unslash($d['titulo'] ?? '')), 'texto' => sanitize_text_field(wp_unslash($d['texto'] ?? ''))]; }
        usort($in, fn($a, $b) => $a['dias'] <=> $b['dias']);
        update_option('eap_push_auto', ['inativ_on' => !empty($_POST['inativ_on']), 'inativ' => $in, 'curso_on' => !empty($_POST['curso_on']), 'curso_dias' => max(1, (int) $t('curso_dias')), 'curso_titulo' => $t('curso_titulo'), 'curso_texto' => $t('curso_texto'),
            'cert_on' => !empty($_POST['cert_on']), 'agenda_on' => !empty($_POST['agenda_on']), 'agenda_dias' => max(1, (int) $t('agenda_dias')), 'novid_on' => !empty($_POST['novid_on']),
            'novid_tipos' => array_values(array_intersect(array_keys(EAP_PUSH_TIPOS), (array) ($_POST['novid_tipos'] ?? [])))], false);
        echo '<div class="notice notice-success"><p>Salvo.</p></div>';
    }
    $c = eap_push_auto();
    global $wpdb; [$t, $l] = eap_push_tabelas();
    $ativos = (int) $wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM $t");
    $ap = $wpdb->get_results("SELECT aparelho, COUNT(*) n FROM $t GROUP BY aparelho", OBJECT_K);
    $d30 = wp_date('Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS);
    $env = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $l WHERE entregue = 1 AND quando >= %s", $d30));
    $cli = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $l WHERE clicado IS NOT NULL AND quando >= %s", $d30));
    $por = $wpdb->get_results($wpdb->prepare("SELECT origem, COUNT(*) n, SUM(clicado IS NOT NULL) c FROM $l WHERE entregue = 1 AND quando >= %s GROUP BY origem ORDER BY n DESC LIMIT 12", $d30));
    $nome = function ($o) { if (strpos($o, 'camp-') === 0) return '📅 ' . get_the_title((int) substr($o, 5)); $m = ['auto-novid' => '✨ Resumo de novidades', 'auto-curso' => '🎓 Curso parado', 'auto-cert' => '🎓 Certificado pronto', 'boas-vindas' => '👋 Boas-vindas', 'teste' => '🧪 Testes']; if (isset($m[$o])) return $m[$o]; if (strpos($o, 'auto-inativ-') === 0) return '⏰ ' . substr($o, 12) . ' dias sem acessar'; if (strpos($o, 'auto-agenda-') === 0) return '📍 Lembrete: ' . get_the_title((int) substr($o, 12)); return $o; };
    ?>
    <div class="wrap"><h1>🔔 Notificações no celular</h1>
    <?php if (!eap_push_suportado()) echo '<div class="notice notice-error"><p>O servidor não tem os recursos de criptografia necessários. Fale com a hospedagem (PHP com OpenSSL e ECDH).</p></div>'; ?>
    <style>.eap-pk{display:flex;gap:14px;flex-wrap:wrap;margin:14px 0 22px}.eap-pk div{background:#fff;border:1px solid #dcdcde;border-radius:10px;padding:14px 18px;min-width:150px}.eap-pk b{display:block;font-size:26px}.eap-pa td{padding:8px 10px;vertical-align:top}.eap-pa input[type=text]{width:420px}.eap-pa .d{color:#646970;font-size:12.5px}</style>
    <div class="eap-pk">
      <div><b><?php echo $ativos; ?></b>dentistas com notificações</div>
      <div><b><?php echo (int) ($ap['Android']->n ?? 0); ?> · <?php echo (int) ($ap['iPhone']->n ?? 0); ?> · <?php echo (int) ($ap['Computador']->n ?? 0); ?></b>Android · iPhone · computador</div>
      <div><b><?php echo $env; ?></b>enviadas (30 dias)</div>
      <div><b><?php echo $env ? round($cli / $env * 100) : 0; ?>%</b>tocaram (<?php echo $cli; ?>)</div>
    </div>
    <p><a class="button button-primary" href="<?php echo esc_url(admin_url('post-new.php?post_type=ea_push')); ?>">+ Programar notificação</a> <a class="button" href="<?php echo esc_url(admin_url('edit.php?post_type=ea_push')); ?>">Ver programadas</a> <a class="button" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=eap_push_teste'), 'eap_push_teste')); ?>">Enviar teste para mim</a></p>
    <?php if ($por) : ?><h2>Últimos 30 dias</h2><table class="widefat striped" style="max-width:720px"><thead><tr><th>Notificação</th><th>Enviadas</th><th>Toques</th></tr></thead><tbody><?php foreach ($por as $r) echo '<tr><td>' . esc_html($nome($r->origem)) . '</td><td>' . (int) $r->n . '</td><td>' . (int) $r->c . '</td></tr>'; ?></tbody></table><?php endif; ?>
    <form method="post"><?php wp_nonce_field('eap_push_auto'); ?>
    <h2>Automáticas</h2>
    <p class="description">Regras para todas: no máximo 1 notificação por dia por dentista, só das 8h às 20h. As automáticas rodam uma vez por dia, a partir das 10h. O dentista escolhe no portal quais tipos quer receber.</p>
    <table class="eap-pa">
      <tr><td><label><input type="checkbox" name="novid_on" value="1" <?php checked($c['novid_on']); ?>> <b>Resumo de novidades</b></label></td><td>Avisa quando publicar: <?php foreach (EAP_PUSH_TIPOS as $k => $v) echo '<label style="margin-right:12px"><input type="checkbox" name="novid_tipos[]" value="' . esc_attr($k) . '" ' . checked(in_array($k, (array) $c['novid_tipos'], true), true, false) . '> ' . esc_html($v) . '</label>'; ?><div class="d">Tudo o que for publicado no dia vira uma notificação só no dia seguinte (“3 novidades no portal: 1 aula nova, 2 posts novos”).</div></td></tr>
      <tr><td><label><input type="checkbox" name="agenda_on" value="1" <?php checked($c['agenda_on']); ?>> <b>Lembrete de curso</b></label></td><td><input type="number" name="agenda_dias" value="<?php echo (int) $c['agenda_dias']; ?>" min="1" max="30" style="width:60px"> dias antes de cada curso da agenda (menos os esgotados).</td></tr>
      <tr><td><label><input type="checkbox" name="curso_on" value="1" <?php checked($c['curso_on']); ?>> <b>Curso parado</b></label></td><td>Quem começou o Curso do Credenciado e está há <input type="number" name="curso_dias" value="<?php echo (int) $c['curso_dias']; ?>" min="1" max="60" style="width:60px"> dias sem assistir.<br>
        Título <input type="text" name="curso_titulo" value="<?php echo esc_attr($c['curso_titulo']); ?>"><br>Texto <input type="text" name="curso_texto" value="<?php echo esc_attr($c['curso_texto']); ?>"><div class="d">{feitas} e {total} viram os números do dentista.</div></td></tr>
      <tr><td><label><input type="checkbox" name="cert_on" value="1" <?php checked($c['cert_on']); ?>> <b>Certificado pronto</b></label></td><td>Na hora em que ele conclui o curso.</td></tr>
      <tr><td><label><input type="checkbox" name="inativ_on" value="1" <?php checked($c['inativ_on']); ?>> <b>Tempo sem acessar</b></label></td><td>
        <?php $lin = array_values((array) $c['inativ']); while (count($lin) < 4) $lin[] = ['dias' => '', 'titulo' => '', 'texto' => ''];
        foreach ($lin as $i => $d) echo '<div style="margin-bottom:8px"><input type="number" name="inativ[' . $i . '][dias]" value="' . esc_attr($d['dias']) . '" min="1" max="365" style="width:60px" placeholder="dias"> dias · <input type="text" name="inativ[' . $i . '][titulo]" value="' . esc_attr($d['titulo']) . '" placeholder="Título" style="width:220px"> <input type="text" name="inativ[' . $i . '][texto]" value="' . esc_attr($d['texto']) . '" placeholder="Texto" style="width:420px"></div>'; ?>
        <div class="d">Cada etapa vai uma vez por período sem acesso; quando o dentista volta ao portal, recomeça. Deixe os dias em branco para apagar uma linha.</div></td></tr>
    </table>
    <p><button class="button button-primary" name="eap_push_auto_salvar" value="1">Salvar automáticas</button></p></form></div>
    <?php
}

// ------------------------------------------------------------ configuração para o navegador do dentista
function eap_push_cfg_js() {
    if (!is_user_logged_in() || !eap_push_suportado() || (function_exists('eap_visivel') && !eap_visivel('push'))) return null;
    $v = eap_push_vapid();
    if (!$v) return null;
    return ['u' => admin_url('admin-ajax.php'), 'n' => wp_create_nonce('eap_push'), 'k' => $v['pub'], 'prefs' => eap_push_prefs(get_current_user_id()), 'cats' => EAP_PUSH_CATS];
}
