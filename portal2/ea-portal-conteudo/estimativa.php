<?php
/**
 * Estimativa e pacote (Powered by AI): o resultado vai por e-mail para a gerente de vendas
 * e fica guardado em "Estimativas recebidas". Antes ia para uma planilha do Google sem retorno.
 */
if (!defined('ABSPATH')) exit;

const EAP_EST_PAGINA = 'simulador-de-estimativa-e-pacote';

add_action('init', function () {
    register_post_type('ea_estimativa', [
        'labels' => ['name' => 'Estimativas recebidas', 'singular_name' => 'Estimativa', 'all_items' => 'Estimativas recebidas', 'not_found' => 'Nenhuma estimativa ainda.'],
        'public' => false, 'show_ui' => true, 'show_in_menu' => 'eap-portal', 'supports' => ['title'],
        'capabilities' => ['create_posts' => 'do_not_allow'], 'map_meta_cap' => true, 'show_in_rest' => false,
    ]);
});

function eap_est_email() {
    $v = get_option('eap_estimativa_email', '');
    return is_email($v) ? $v : '';
}

// configuração: e-mail da gerente de vendas
add_action('admin_menu', function () {
    add_submenu_page('eap-portal', 'E-mail das estimativas', 'E-mail das estimativas', 'edit_pages', 'eap-estimativa', function () {
        if (isset($_POST['eap_est_n']) && wp_verify_nonce($_POST['eap_est_n'], 'eap_est')) {
            $e = sanitize_email(wp_unslash($_POST['email'] ?? ''));
            update_option('eap_estimativa_email', is_email($e) ? $e : '', false);
            echo '<div class="notice notice-success"><p>Salvo.</p></div>';
        }
        echo '<div class="wrap"><h1>E-mail das estimativas</h1><p style="max-width:680px">Quando um dentista conclui a <b>Estimativa e pacote – Alinhadores</b>, o resultado vai para este e-mail e fica guardado em <a href="' . esc_url(admin_url('edit.php?post_type=ea_estimativa')) . '">Estimativas recebidas</a>.</p>'
            . '<form method="post">' . wp_nonce_field('eap_est', 'eap_est_n', true, false)
            . '<p><input type="email" name="email" class="regular-text" value="' . esc_attr(eap_est_email()) . '" placeholder="gerente.vendas@estheticaligner.com.br"></p>'
            . '<p><button class="button button-primary">Salvar</button></p></form></div>';
    });
}, 25);

// recebe o resultado (só dentista logado)
add_action('wp_ajax_eap_estimativa', function () {
    if (!check_ajax_referer('eap_estimativa', '_n', false)) wp_send_json_error('sessao', 403);
    $u = wp_get_current_user();
    // limite: 20 envios por hora por usuário
    $k = 'eap_est_rl_' . $u->ID;
    $n = (int) get_transient($k);
    if ($n >= 20) wp_send_json_error('limite', 429);
    set_transient($k, $n + 1, HOUR_IN_SECONDS);

    $txt = fn($c, $max = 160) => mb_substr(sanitize_text_field(wp_unslash($_POST[$c] ?? '')), 0, $max);
    $campos = [
        'dentista' => 'Dentista (informado)', 'telefone' => 'Telefone', 'email' => 'E-mail', 'paciente' => 'Paciente',
        'apinhamento' => 'Apinhamento', 'linhamedia' => 'Linha média', 'rotanterior' => 'Rotação anterior',
        'rotposterior' => 'Rotação posterior', 'intrusao' => 'Intrusão/extrusão', 'vertical' => 'Vertical', 'classe' => 'Classe',
        'score' => 'Pontuação', 'resultado' => 'Pacote indicado',
    ];
    $d = [];
    foreach ($campos as $c => $rot) $d[$c] = $txt($c);
    if ($d['resultado'] === '') wp_send_json_error('vazio', 400);

    $meta = function ($chave) use ($u) {
        foreach (['eap_' . $chave, $chave] as $m) { $v = get_user_meta($u->ID, $m, true); if ($v) return $v; }
        return '';
    };
    $conta = [
        'Nome no cadastro' => trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name,
        'E-mail do cadastro' => $u->user_email,
        'CRO' => trim($meta('cro') . ' ' . $meta('cro_uf')),
        'WhatsApp do cadastro' => $meta('whats'),
    ];

    $titulo = $d['resultado'] . ' – ' . ($conta['Nome no cadastro'] ?: $d['dentista']) . ($d['paciente'] ? ' – paciente ' . $d['paciente'] : '');
    $id = wp_insert_post(['post_type' => 'ea_estimativa', 'post_status' => 'private', 'post_title' => mb_substr($titulo, 0, 190), 'post_author' => $u->ID]);
    if ($id && !is_wp_error($id)) {
        foreach ($d as $c => $v) update_post_meta($id, '_' . $c, $v);
        update_post_meta($id, '_conta', $conta);
    }

    $para = eap_est_email();
    $enviado = false;
    if ($para) {
        $linhas = '';
        foreach ($conta as $rot => $v) $linhas .= '<tr><td style="padding:6px 10px;color:#5b6576">' . esc_html($rot) . '</td><td style="padding:6px 10px"><b>' . esc_html($v ?: '—') . '</b></td></tr>';
        foreach ($campos as $c => $rot) $linhas .= '<tr><td style="padding:6px 10px;color:#5b6576">' . esc_html($rot) . '</td><td style="padding:6px 10px"><b>' . esc_html($d[$c] ?: '—') . '</b></td></tr>';
        $html = '<div style="font-family:Arial,sans-serif;max-width:620px">'
            . '<h2 style="color:#0d1f42;margin:0 0 6px">Nova estimativa – ' . esc_html($d['resultado']) . '</h2>'
            . '<p style="color:#5b6576;margin:0 0 14px">Feita no Portal do Credenciado em ' . esc_html(wp_date('d/m/Y \à\s H:i')) . ' (horário de Brasília).</p>'
            . '<table style="border-collapse:collapse;width:100%;border:1px solid #e4e8f0">' . $linhas . '</table>'
            . '<p style="margin-top:14px"><a href="' . esc_url(admin_url('edit.php?post_type=ea_estimativa')) . '">Ver todas as estimativas</a></p></div>';
        $headers = ['Content-Type: text/html; charset=UTF-8'];
        if (is_email($u->user_email)) $headers[] = 'Reply-To: ' . str_replace(["\r", "\n"], '', $conta['Nome no cadastro']) . ' <' . $u->user_email . '>';
        $enviado = wp_mail($para, 'Nova estimativa: ' . $titulo, $html, $headers);
        if ($id) update_post_meta($id, '_email_status', $enviado ? 'enviado' : 'falhou');
    }
    wp_send_json_success(['ok' => true, 'email' => $enviado]);
});

// na página da estimativa: troca o envio para a planilha pelo envio interno
add_action('wp_footer', function () {
    if (!is_user_logged_in() || !is_page(EAP_EST_PAGINA)) return;
    $cfg = wp_json_encode(['url' => admin_url('admin-ajax.php'), 'n' => wp_create_nonce('eap_estimativa')]);
    echo "<script>(function(){var C=$cfg;window.enviarDados=function(dentista,telefone,paciente,email,score,resultado){var L=(typeof labels!=='undefined'&&labels)?labels:(window.labels||{});var f=new FormData();f.append('action','eap_estimativa');f.append('_n',C.n);var d={dentista:dentista,telefone:telefone,paciente:paciente,email:email,score:score,resultado:resultado};['apinhamento','linhamedia','rotanterior','rotposterior','intrusao','vertical','classe'].forEach(function(k){d[k]=L[k]||'';});Object.keys(d).forEach(function(k){f.append(k,d[k]==null?'':String(d[k]));});fetch(C.url,{method:'POST',body:f,credentials:'same-origin'}).catch(function(){});};})();</script>";
}, 99);

// lista no admin
add_filter('manage_ea_estimativa_posts_columns', fn($c) => ['cb' => $c['cb'], 'title' => 'Estimativa', 'eap_res' => 'Pacote', 'eap_tel' => 'Contato', 'eap_mail' => 'E-mail para vendas', 'date' => 'Data']);
add_action('manage_ea_estimativa_posts_custom_column', function ($col, $id) {
    if ($col === 'eap_res') echo esc_html(get_post_meta($id, '_resultado', true));
    if ($col === 'eap_tel') echo esc_html(trim(get_post_meta($id, '_telefone', true) . '  ' . get_post_meta($id, '_email', true)));
    if ($col === 'eap_mail') { $s = get_post_meta($id, '_email_status', true); echo $s === 'enviado' ? '✓ enviado' : ($s === 'falhou' ? '✗ falhou' : '— sem e-mail configurado'); }
}, 10, 2);
add_action('add_meta_boxes_ea_estimativa', function () {
    add_meta_box('eap_est_dados', 'Respostas', function ($post) {
        $conta = (array) get_post_meta($post->ID, '_conta', true);
        echo '<table class="widefat striped">';
        foreach ($conta as $r => $v) echo '<tr><td style="width:220px">' . esc_html($r) . '</td><td><b>' . esc_html($v ?: '—') . '</b></td></tr>';
        foreach (['dentista' => 'Dentista (informado)', 'telefone' => 'Telefone', 'paciente' => 'Paciente', 'apinhamento' => 'Apinhamento', 'linhamedia' => 'Linha média', 'rotanterior' => 'Rotação anterior', 'rotposterior' => 'Rotação posterior', 'intrusao' => 'Intrusão/extrusão', 'vertical' => 'Vertical', 'classe' => 'Classe', 'score' => 'Pontuação', 'resultado' => 'Pacote indicado'] as $c => $r)
            echo '<tr><td>' . esc_html($r) . '</td><td><b>' . esc_html(get_post_meta($post->ID, '_' . $c, true) ?: '—') . '</b></td></tr>';
        echo '</table>';
    }, 'ea_estimativa', 'normal', 'high');
});
