<?php
/**
 * Radar de reativação: toda segunda-feira, às 8h, manda para vendas a lista de credenciados para contatar na semana,
 * com o motivo e uma mensagem de WhatsApp pronta. Também dá para ver e enviar na hora em Portal do Credenciado → Radar de vendas.
 */
if (!defined('ABSPATH')) exit;

function eap_radar_cfg() {
    $c = get_option('eap_radar');
    $padrao = ['ativo' => 1, 'para' => function_exists('eap_est_email') ? eap_est_email() : '', 'cc' => function_exists('eap_est_cc') ? implode(', ', eap_est_cc()) : '', 'assinatura' => 'Tamires', 'qtd' => 10];
    return is_array($c) ? array_merge($padrao, $c) : $padrao;
}

/** Monta a lista da semana: quentes primeiro (estimativa sem caso), depois quem concluiu o curso sem caso, depois quem sumiu. */
function eap_radar_lista() {
    global $wpdb;
    $cfg = eap_radar_cfg();
    $qtd = max(1, min(50, (int) $cfg['qtd']));
    $t = function_exists('eap_met_tabela') ? eap_met_tabela() : '';
    $equipe = array_map('intval', get_users(['capability' => 'edit_pages', 'fields' => 'ID']));
    $agora = time();
    $recente = fn($uid) => (int) get_user_meta($uid, 'eap_radar_em', true) > $agora - 28 * DAY_IN_SECONDS; // não repete quem já foi para a lista há menos de 4 semanas
    $com_caso = $t ? array_map('intval', $wpdb->get_col("SELECT DISTINCT user_id FROM $t WHERE tipo = 'sistema' AND extra IN ('enviofacil','ortholab')")) : [];
    $lista = []; $usados = [];
    $add = function ($uid, $motivo, $tipo) use (&$lista, &$usados, $equipe, $recente, $qtd) {
        if (count($lista) >= $qtd || isset($usados[$uid]) || in_array($uid, $equipe, true) || $recente($uid)) return;
        $u = get_userdata($uid); if (!$u) return;
        $usados[$uid] = 1;
        $lista[] = ['id' => $uid, 'u' => $u, 'motivo' => $motivo, 'tipo' => $tipo];
    };
    // 1) fez estimativa nos últimos 30 dias e não abriu o Envio Fácil/Ortholab depois
    $est = $wpdb->get_results($wpdb->prepare("SELECT post_author, MAX(post_date) d, COUNT(*) n FROM {$wpdb->posts} WHERE post_type = 'ea_estimativa' AND post_status = 'private' AND post_date >= %s GROUP BY post_author ORDER BY d DESC", wp_date('Y-m-d H:i:s', $agora - 30 * DAY_IN_SECONDS)));
    foreach ($est as $r) {
        $depois = $t ? (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE user_id = %d AND tipo = 'sistema' AND extra IN ('enviofacil','ortholab') AND quando >= %s", $r->post_author, $r->d)) : 0;
        if (!$depois) $add((int) $r->post_author, 'Fez ' . ($r->n > 1 ? $r->n . ' estimativas' : 'uma estimativa') . ' com IA em ' . wp_date('d/m', strtotime($r->d)) . ' e ainda não enviou caso', 'estimativa');
    }
    // 2) concluiu o Curso do Credenciado e nunca enviou caso pelo portal
    foreach ($wpdb->get_results("SELECT user_id, meta_value d FROM {$wpdb->usermeta} WHERE meta_key = 'eap_curso_concluido_em' ORDER BY meta_value DESC LIMIT 200") as $r) {
        if (!in_array((int) $r->user_id, $com_caso, true)) $add((int) $r->user_id, 'Concluiu o Curso do Credenciado em ' . wp_date('d/m', strtotime($r->d)) . ' e ainda não enviou o primeiro caso', 'curso');
    }
    // 3) sumiu: último acesso entre 45 e 180 dias atrás (ainda dá para recuperar), do mais recente para o mais antigo
    if (count($lista) < $qtd && function_exists('eap_met_ultimos')) {
        $sumidos = array_filter(eap_met_ultimos(), fn($r) => (int) $r->ultimo > 0 && (int) $r->ultimo <= $agora - 45 * DAY_IN_SECONDS && (int) $r->ultimo >= $agora - 180 * DAY_IN_SECONDS);
        usort($sumidos, fn($a, $b) => (int) $b->ultimo <=> (int) $a->ultimo);
        foreach ($sumidos as $r) { if (count($lista) >= $qtd) break; $add((int) $r->ID, 'Não entra no portal desde ' . wp_date('d/m/Y', (int) $r->ultimo) . ' (' . floor(($agora - (int) $r->ultimo) / DAY_IN_SECONDS) . ' dias)', 'sumiu'); }
    }
    // dados de contato e mensagem pronta
    foreach ($lista as &$it) {
        $u = $it['u'];
        $nome = trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name;
        $primeiro = ucfirst(mb_strtolower(strtok(trim($u->first_name) ?: $nome, ' ')));
        $it['nome'] = $nome;
        $it['email'] = $u->user_email;
        $it['cro'] = function_exists('eap_dado_atual') ? eap_dado_atual($u->ID, 'cro') : '';
        $it['whats'] = function_exists('eap_dado_atual') ? eap_dado_atual($u->ID, 'whats') : '';
        $ass = $cfg['assinatura'] ? $cfg['assinatura'] . ', da Esthetic Aligner' : 'a equipe da Esthetic Aligner';
        $msg = [
            'estimativa' => "Olá, $primeiro! Aqui é $ass. Vi que você fez uma estimativa no Portal do Credenciado para um paciente. Posso te ajudar a dar o próximo passo com esse caso?",
            'curso'      => "Olá, $primeiro! Aqui é $ass. Parabéns por concluir o Curso do Credenciado! Que tal enviarmos juntos o seu primeiro caso? Estou à disposição para ajudar.",
            'sumiu'      => "Olá, $primeiro! Tudo bem? Aqui é $ass. Faz um tempo que não nos falamos e temos novidades no Portal do Credenciado: posts prontos com a sua marca, estimativa de pacote com IA e envio de casos mais simples. Posso te mostrar em 5 minutos?",
        ][$it['tipo']];
        $it['msg'] = $msg;
        $it['link'] = ($it['whats'] && function_exists('eap_whats_link')) ? eap_whats_link($it['whats']) . '?text=' . rawurlencode($msg) : '';
        unset($it['u']);
    }
    return $lista;
}

function eap_radar_html($lista) {
    $rot = ['estimativa' => ['🔥 Lead quente', '#e2574c'], 'curso' => ['🎓 Recém-formado', '#2f6fe4'], 'sumiu' => ['💤 Reativar', '#8a93a3']];
    $h = '<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2433;max-width:720px">'
        . '<h2 style="color:#2f6fe4;margin:0 0 6px">Radar de vendas – semana de ' . esc_html(wp_date('d/m/Y')) . '</h2>'
        . '<p style="color:#5b6576;margin:0 0 18px">' . count($lista) . ' credenciados para contatar esta semana, em ordem de prioridade. Toque em “Abrir WhatsApp” para enviar a mensagem pronta (você pode editar antes).</p>';
    if (!$lista) $h .= '<p>Nenhum credenciado na lista esta semana.</p>';
    foreach ($lista as $i => $it) {
        [$tag, $cor] = $rot[$it['tipo']];
        $h .= '<div style="border:1px solid #e4e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px">'
            . '<div style="font-size:12px;font-weight:bold;color:' . $cor . '">' . ($i + 1) . '. ' . esc_html($tag) . '</div>'
            . '<div style="font-size:16px;font-weight:bold;margin:4px 0">' . esc_html($it['nome']) . ($it['cro'] ? ' <span style="font-weight:normal;color:#5b6576;font-size:13px">· CRO ' . esc_html($it['cro']) . '</span>' : '') . '</div>'
            . '<div style="font-size:13.5px;color:#5b6576;margin-bottom:8px">' . esc_html($it['motivo']) . '</div>'
            . '<div style="font-size:13px;margin-bottom:10px">' . esc_html($it['email']) . ($it['whats'] ? ' · ' . esc_html($it['whats']) : '') . '</div>'
            . ($it['link'] ? '<a href="' . esc_url($it['link']) . '" style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;font-weight:bold;padding:9px 16px;border-radius:999px;font-size:14px">Abrir WhatsApp com a mensagem</a>' : '<span style="font-size:13px;color:#8a93a3">Sem WhatsApp no cadastro: use o e-mail.</span>')
            . '</div>';
    }
    return $h . '<p style="color:#8a93a3;font-size:12px;margin-top:16px">Enviado automaticamente pelo Portal do Credenciado. Quem aparece na lista não volta a aparecer nas próximas 4 semanas. Ajustes em Portal do Credenciado → Radar de vendas.</p></div>';
}

function eap_radar_enviar() {
    $cfg = eap_radar_cfg();
    $para = array_filter(array_map('trim', explode(',', (string) $cfg['para'])), 'is_email');
    if (!$para) return false;
    $lista = eap_radar_lista();
    $headers = ['Content-Type: text/html; charset=UTF-8'];
    foreach (array_filter(array_map('trim', explode(',', (string) $cfg['cc'])), 'is_email') as $c) $headers[] = 'Cc: ' . $c;
    $ok = wp_mail($para, 'Radar de vendas: ' . count($lista) . ' credenciados para contatar esta semana', eap_radar_html($lista), $headers);
    if ($ok) foreach ($lista as $it) update_user_meta($it['id'], 'eap_radar_em', time());
    update_option('eap_radar_ultimo', ['quando' => time(), 'n' => count($lista), 'ok' => $ok], false);
    return $ok;
}

// agenda: toda segunda às 8h (horário do site)
add_action('init', function () {
    if (!wp_next_scheduled('eap_radar_semanal')) {
        $prox = new DateTime('next monday 08:00', wp_timezone());
        wp_schedule_event($prox->getTimestamp(), 'weekly', 'eap_radar_semanal');
    }
});
add_action('eap_radar_semanal', function () { if (eap_radar_cfg()['ativo']) eap_radar_enviar(); });

add_action('admin_menu', function () {
    add_submenu_page('eap-portal', 'Radar de vendas', '📡 Radar de vendas', 'edit_pages', 'eap-radar', 'eap_radar_pagina', 1);
}, 21);

function eap_radar_pagina() {
    $msg = '';
    if (isset($_POST['eap_radar_salvar']) && check_admin_referer('eap_radar')) {
        $lim = fn($v) => implode(', ', array_filter(array_map('sanitize_email', array_map('trim', explode(',', wp_unslash($v)))), 'is_email'));
        update_option('eap_radar', ['ativo' => empty($_POST['ativo']) ? 0 : 1, 'para' => $lim($_POST['para'] ?? ''), 'cc' => $lim($_POST['cc'] ?? ''), 'assinatura' => sanitize_text_field(wp_unslash($_POST['assinatura'] ?? '')), 'qtd' => max(1, min(50, (int) ($_POST['qtd'] ?? 10)))], false);
        $msg = 'Configurações salvas.';
    }
    if (isset($_POST['eap_radar_agora']) && check_admin_referer('eap_radar')) $msg = eap_radar_enviar() ? 'Radar enviado agora por e-mail.' : 'Não foi possível enviar: confira o e-mail de destino.';
    if (!empty($_GET['diag']) && current_user_can('manage_options')) { // diagnóstico temporário: campos com telefone
        global $wpdb; $out = [];
        foreach ($wpdb->get_results($wpdb->prepare("SELECT meta_key, meta_value FROM {$wpdb->usermeta} WHERE user_id = %d", (int) $_GET['diag'])) as $m) {
            $d = preg_replace('/\D/', '', (string) $m->meta_value);
            if (strlen($d) >= 8 && strlen($d) <= 14 && strlen((string) $m->meta_value) < 40) $out[] = $m->meta_key . ' = ' . substr($d, 0, 2) . '…' . substr($d, -2) . ' (' . strlen($d) . ')';
        }
        $keys = $wpdb->get_col("SELECT meta_key FROM {$wpdb->usermeta} WHERE meta_key REGEXP 'fone|phone|cel|whats|tel|mobile' GROUP BY meta_key ORDER BY COUNT(*) DESC LIMIT 30");
        echo '<pre id="eapdiag">' . esc_html(implode("\n", $out) . "\n--\n" . implode(', ', $keys)) . '</pre>';
    }
    $cfg = eap_radar_cfg();
    $lista = eap_radar_lista();
    $ult = get_option('eap_radar_ultimo');
    $prox = wp_next_scheduled('eap_radar_semanal');
    ?>
    <div class="wrap" style="max-width:980px">
      <h1>📡 Radar de vendas</h1>
      <?php if ($msg) echo '<div class="notice notice-success"><p>' . esc_html($msg) . '</p></div>'; ?>
      <p>Toda segunda-feira às 8h, a equipe comercial recebe por e-mail a lista de credenciados para contatar na semana, com o motivo e uma mensagem de WhatsApp pronta. Ordem de prioridade: <b>🔥 fez estimativa com IA e não enviou caso</b> → <b>🎓 concluiu o curso e não enviou o primeiro caso</b> → <b>💤 não entra há 45 a 180 dias</b>. Quem entra na lista não volta nas 4 semanas seguintes.</p>
      <p class="description">Próximo envio automático: <b><?php echo $prox ? esc_html(wp_date('d/m/Y \à\s H:i', $prox)) : '—'; ?></b><?php if (is_array($ult)) echo ' · Último envio: ' . esc_html(wp_date('d/m/Y H:i', $ult['quando'])) . ' (' . (int) $ult['n'] . ' nomes' . ($ult['ok'] ? '' : ', falhou') . ')'; ?></p>
      <form method="post" style="background:#fff;border:1px solid #e4e8f0;border-radius:12px;padding:16px 18px;margin:16px 0"><?php wp_nonce_field('eap_radar'); ?>
        <table class="form-table" style="margin:0"><tbody>
          <tr><th>Envio automático</th><td><label><input type="checkbox" name="ativo" value="1" <?php checked($cfg['ativo']); ?>> Ligado (toda segunda às 8h)</label></td></tr>
          <tr><th>Para</th><td><input type="text" name="para" class="regular-text" value="<?php echo esc_attr($cfg['para']); ?>"></td></tr>
          <tr><th>Cópia</th><td><input type="text" name="cc" class="regular-text" value="<?php echo esc_attr($cfg['cc']); ?>"> <span class="description">separe por vírgula</span></td></tr>
          <tr><th>Quem assina a mensagem</th><td><input type="text" name="assinatura" class="regular-text" value="<?php echo esc_attr($cfg['assinatura']); ?>"> <span class="description">ex.: Tamires → “Aqui é Tamires, da Esthetic Aligner”</span></td></tr>
          <tr><th>Nomes por semana</th><td><input type="number" name="qtd" min="1" max="50" value="<?php echo (int) $cfg['qtd']; ?>" style="width:80px"></td></tr>
        </tbody></table>
        <p style="margin:12px 0 0"><button class="button button-primary" name="eap_radar_salvar" value="1">Salvar</button> <button class="button" name="eap_radar_agora" value="1" onclick="return confirm('Enviar o radar agora para <?php echo esc_js($cfg['para']); ?>?')">Enviar o radar agora</button></p>
      </form>
      <h2>Lista desta semana (prévia)</h2>
      <?php echo eap_radar_html($lista); ?>
    </div>
    <?php
}
