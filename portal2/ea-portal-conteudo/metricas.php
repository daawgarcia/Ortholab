<?php
/**
 * Resultados do portal: registra o uso (acessos, aulas, downloads, posts, sistemas)
 * e mostra um painel para a diretoria em Portal do Credenciado → Resultados.
 * Guarda só o necessário: quem (ID), o quê e quando. Acessos da equipe ficam marcados à parte.
 */
if (!defined('ABSPATH')) exit;

const EAP_MET_DB = 2;

function eap_met_tabela() { global $wpdb; return $wpdb->prefix . 'eap_eventos'; }

add_action('init', function () {
    if ((int) get_option('eap_met_db') >= EAP_MET_DB) return;
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $t = eap_met_tabela();
    dbDelta("CREATE TABLE $t (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        quando datetime NOT NULL,
        user_id bigint(20) unsigned NOT NULL DEFAULT 0,
        equipe tinyint(1) NOT NULL DEFAULT 0,
        tipo varchar(20) NOT NULL,
        obj bigint(20) unsigned NOT NULL DEFAULT 0,
        extra varchar(100) NOT NULL DEFAULT '',
        PRIMARY KEY  (id),
        KEY tipo_quando (tipo,quando),
        KEY user_quando (user_id,quando)
    ) " . $wpdb->get_charset_collate() . ";");
    update_option('eap_met_db', EAP_MET_DB, false);
    add_option('eap_novo_desde', time(), '', false); // o selo "Novo" vale para o que for publicado daqui em diante
}, 5);

/** Registra um evento do usuário logado. */
function eap_evento($tipo, $obj = 0, $extra = '') {
    $uid = get_current_user_id();
    if (!$uid) return;
    global $wpdb;
    $wpdb->insert(eap_met_tabela(), [
        'quando' => current_time('mysql'), 'user_id' => $uid, 'equipe' => current_user_can('edit_pages') ? 1 : 0,
        'tipo' => substr(sanitize_key($tipo), 0, 20), 'obj' => (int) $obj, 'extra' => substr(sanitize_text_field($extra), 0, 100),
    ]);
}

// acesso do dia, páginas vistas e aula aberta
add_action('template_redirect', function () {
    if (!is_user_logged_in() || is_admin() || wp_doing_ajax() || !empty($_GET['eap_ir'])) return;
    $uid = get_current_user_id();
    $hoje = current_time('Y-m-d');
    if (get_user_meta($uid, 'eap_acesso_dia', true) !== $hoje) {
        update_user_meta($uid, 'eap_acesso_dia', $hoje);
        eap_evento('acesso');
    }
    if (time() - (int) get_user_meta($uid, 'eap_ultimo_acesso', true) > 10 * MINUTE_IN_SECONDS) update_user_meta($uid, 'eap_ultimo_acesso', time()); // grava no máximo a cada 10 min
    $o = get_queried_object();
    if ($o instanceof WP_Post && $o->post_type === 'page') {
        eap_evento('pagina', $o->ID, $o->post_name);
        if ($o->post_name === 'video-aulas' && !empty($_GET['aula'])) {
            $a = get_post((int) $_GET['aula']);
            if ($a && $a->post_type === 'ea_aula' && $a->post_status === 'publish') {
                eap_evento('aula', $a->ID);
                update_user_meta($uid, 'eap_ultima_aula', $a->ID);
            }
        }
    }
}, 20);

// cliques registrados pelo navegador (downloads e posts)
add_action('wp_ajax_eap_evento', function () {
    if (!check_ajax_referer('eap_evento', '_n', false)) wp_die('', 403);
    $tipo = sanitize_key($_POST['tipo'] ?? '');
    if (!in_array($tipo, ['download', 'post', 'post_baixar', 'whats', 'orcamento'], true)) wp_die('', 400);
    $uid = get_current_user_id();
    $k = 'eap_ev_rl_' . $uid; $n = (int) get_transient($k);
    if ($n > 300) wp_die('', 429);
    set_transient($k, $n + 1, HOUR_IN_SECONDS);
    eap_evento($tipo, (int) ($_POST['obj'] ?? 0), (string) wp_unslash($_POST['extra'] ?? ''));
    wp_die('ok');
});

add_action('wp_footer', function () {
    if (!is_user_logged_in()) return;
    $c = wp_json_encode(['u' => admin_url('admin-ajax.php'), 'n' => wp_create_nonce('eap_evento')]);
    echo "<script>(function(){var C=$c,P=0;function ev(t,o,x){try{var f=new FormData();f.append('action','eap_evento');f.append('_n',C.n);f.append('tipo',t);f.append('obj',o||0);f.append('extra',x||'');navigator.sendBeacon?navigator.sendBeacon(C.u,f):fetch(C.u,{method:'POST',body:f,keepalive:true});}catch(e){}}window.eapEvento=ev;document.addEventListener('click',function(e){var a=e.target.closest('[data-eap-mat]');if(a){ev('download',a.getAttribute('data-eap-mat'));return;}var p=e.target.closest('[data-eap-post]');if(p){P=p.getAttribute('data-id')||0;ev('post',P);return;}if(e.target.closest('[data-eap-baixar]')){ev('post_baixar',P);return;}var w=e.target.closest('[data-eap-whats]');if(w){ev('whats',0,w.getAttribute('data-eap-whats'));}},true);})();</script>";
}, 50);

/* ------------------------------------------------------------------ aulas assistidas (na conta, vale em qualquer aparelho) */
function eap_aulas_feitas($uid = 0) {
    $v = get_user_meta($uid ?: get_current_user_id(), 'eap_aulas_feitas', true);
    return is_array($v) ? array_values(array_map('intval', $v)) : [];
}
add_action('wp_ajax_eap_feitas', function () {
    if (!check_ajax_referer('eap_feitas', '_n', false)) wp_die('', 403);
    $ids = array_filter(array_map('intval', explode(',', (string) ($_POST['ids'] ?? ''))));
    $ids = array_values(array_filter(array_unique($ids), fn($id) => get_post_type($id) === 'ea_aula'));
    $uid = get_current_user_id();
    $antes = (string) get_user_meta($uid, 'eap_curso_concluido_em', true);
    update_user_meta($uid, 'eap_aulas_feitas', array_slice($ids, 0, 2000));
    $agora = function_exists('eap_curso_concluido') ? eap_curso_concluido($uid) : '';
    wp_send_json_success(['n' => count($ids), 'curso' => (bool) $agora, 'novo' => $agora && !$antes]);
});

/* ------------------------------------------------------------------ painel */
add_action('admin_menu', function () {
    add_submenu_page('eap-portal', 'Resultados do portal', '📊 Resultados', 'edit_pages', 'eap-resultados', function () {
        try { eap_resultados_pagina(); } catch (\Throwable $e) { echo '<div class="notice notice-error"><p>Erro no painel: ' . esc_html($e->getMessage() . ' (linha ' . $e->getLine() . ')') . '</p></div>'; }
    }, 0);
}, 20);

/** Último acesso conhecido: o do portal novo ou, antes dele, o registrado pelo Ultimate Member. */
function eap_met_ultimos() {
    global $wpdb;
    $equipe = get_users(['capability' => 'edit_pages', 'fields' => 'ID']);
    $excl = $equipe ? 'WHERE u.ID NOT IN (' . implode(',', array_map('intval', $equipe)) . ')' : '';
    return $wpdb->get_results("SELECT u.ID, u.display_name, u.user_email, u.user_registered,
        GREATEST(COALESCE(MAX(CASE WHEN m.meta_key='eap_ultimo_acesso' THEN CAST(m.meta_value AS UNSIGNED) END),0),
                 COALESCE(MAX(CASE WHEN m.meta_key='_um_last_login' THEN (CASE WHEN m.meta_value REGEXP '^[0-9]+$' THEN CAST(m.meta_value AS UNSIGNED) ELSE UNIX_TIMESTAMP(m.meta_value) END) END),0)) AS ultimo
        FROM {$wpdb->users} u LEFT JOIN {$wpdb->usermeta} m ON m.user_id=u.ID AND m.meta_key IN ('eap_ultimo_acesso','_um_last_login')
        $excl GROUP BY u.ID");
}

function eap_met_csv_inativos() {
    if (!current_user_can('edit_pages') || !check_admin_referer('eap_met_csv')) wp_die('Sem permissão');
    $dias = max(1, (int) ($_GET['dias'] ?? 60));
    $lim = time() - $dias * DAY_IN_SECONDS;
    nocache_headers();
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="credenciados-sem-acesso-' . $dias . '-dias.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Nome', 'E-mail', 'CRO', 'WhatsApp', 'Último acesso', 'Cadastrado em'], ';');
    foreach (eap_met_ultimos() as $r) {
        if ((int) $r->ultimo >= $lim) continue;
        $cro = function_exists('eap_dado_atual') ? eap_dado_atual($r->ID, 'cro') : '';
        $wh = function_exists('eap_dado_atual') ? eap_dado_atual($r->ID, 'whats') : '';
        fputcsv($out, [$r->display_name, $r->user_email, $cro, $wh, (int) $r->ultimo > 0 ? wp_date('d/m/Y', (int) $r->ultimo) : 'nunca registrado', wp_date('d/m/Y', strtotime($r->user_registered))], ';');
    }
    exit;
}
add_action('admin_post_eap_met_csv', 'eap_met_csv_inativos');


/** Histórico mensal de antes do portal novo: logins do Log de atividades e novos cadastros. */
function eap_met_historico($meses = 6) {
    global $wpdb;
    $equipe = array_map('intval', get_users(['capability' => 'edit_pages', 'fields' => 'ID']));
    $excl = $equipe ? ' AND user_id NOT IN (' . implode(',', $equipe) . ')' : '';
    $inicio = strtotime(wp_date('Y-m-01 00:00:00', strtotime('-' . ($meses - 1) . ' months', strtotime(wp_date('Y-m-15')))));
    $linhas = [];
    for ($i = 0; $i < $meses; $i++) {
        $k = wp_date('Y-m', strtotime("+$i months", $inicio + 15 * DAY_IN_SECONDS));
        $linhas[$k] = ['ativos' => null, 'logins' => null, 'novos' => 0, 'portal' => 0];
    }
    $log = $wpdb->prefix . 'aryo_activity_log';
    $tem_log = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $log)) === $log;
    $desde_log = null;
    if ($tem_log) {
        $desde_log = (int) $wpdb->get_var("SELECT MIN(hist_time) FROM $log WHERE action = 'logged_in'");
        $tz = wp_date('P');
        $r = $wpdb->get_results($wpdb->prepare("SELECT DATE_FORMAT(CONVERT_TZ(FROM_UNIXTIME(hist_time), @@session.time_zone, %s), '%%Y-%%m') m, COUNT(DISTINCT user_id) a, COUNT(*) n FROM $log WHERE action = 'logged_in' AND hist_time >= %d $excl GROUP BY m", $tz, $inicio));
        foreach ($r as $x) if (isset($linhas[$x->m])) { $linhas[$x->m]['ativos'] = (int) $x->a; $linhas[$x->m]['logins'] = (int) $x->n; }
        // meses cobertos pelo log sem nenhum login contam como zero
        foreach ($linhas as $k => &$l) if ($l['ativos'] === null && $desde_log && strtotime($k . '-28') >= $desde_log) { $l['ativos'] = 0; $l['logins'] = 0; }
        unset($l);
    }
    $r = $wpdb->get_results($wpdb->prepare("SELECT DATE_FORMAT(user_registered, '%%Y-%%m') m, COUNT(*) n FROM {$wpdb->users} WHERE user_registered >= %s GROUP BY m", gmdate('Y-m-d H:i:s', $inicio)));
    foreach ($r as $x) if (isset($linhas[$x->m])) $linhas[$x->m]['novos'] = (int) $x->n;
    $t = eap_met_tabela();
    $r = $wpdb->get_results($wpdb->prepare("SELECT DATE_FORMAT(quando, '%%Y-%%m') m, COUNT(DISTINCT user_id) n FROM $t WHERE tipo = 'acesso' AND equipe = 0 AND quando >= %s GROUP BY m", wp_date('Y-m-d H:i:s', $inicio)));
    foreach ($r as $x) if (isset($linhas[$x->m])) $linhas[$x->m]['portal'] = (int) $x->n;
    return ['linhas' => $linhas, 'tem_log' => $tem_log, 'desde_log' => $desde_log];
}

function eap_resultados_pagina() {
    global $wpdb;
    $t = eap_met_tabela();
    $dias = (int) ($_GET['dias'] ?? 30);
    if (!in_array($dias, [7, 30, 90], true)) $dias = 30;
    $equipe = !empty($_GET['equipe']);
    $desde = wp_date('Y-m-d 00:00:00', time() - ($dias - 1) * DAY_IN_SECONDS);
    $f = $wpdb->prepare('quando >= %s', $desde) . ($equipe ? '' : ' AND equipe = 0');
    $conta = fn($tipo, $distinto = false) => (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(" . ($distinto ? 'DISTINCT user_id' : '*') . ") FROM $t WHERE tipo = %s AND $f", $tipo));
    $top = fn($tipo, $n = 8) => $wpdb->get_results($wpdb->prepare("SELECT obj, COUNT(*) n, COUNT(DISTINCT user_id) p FROM $t WHERE tipo = %s AND obj > 0 AND $f GROUP BY obj ORDER BY n DESC LIMIT %d", $tipo, $n));

    $ativos = $conta('acesso', true);
    $acessos = $conta('acesso');
    $downloads = $conta('download');
    $aulas = $conta('aula');
    $posts = $conta('post_baixar');
    $sistemas = $wpdb->get_results("SELECT extra, COUNT(*) n FROM $t WHERE tipo = 'sistema' AND $f GROUP BY extra ORDER BY n DESC");
    $tot_sis = array_sum(array_map(fn($s) => (int) $s->n, $sistemas));
    $est = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'ea_estimativa' AND post_status = 'private' AND post_date >= %s", $desde));

    // credenciados por último acesso
    $agora = time();
    $base = get_transient('eap_met_base');
    if (!is_array($base)) {
    $ult = eap_met_ultimos();
    $faixas = ['30' => 0, '90' => 0, '180' => 0, 'mais' => 0, 'nunca' => 0];
    foreach ($ult as $r) {
        $u = (int) $r->ultimo;
        if (!$u) $faixas['nunca']++;
        elseif ($u >= $agora - 30 * DAY_IN_SECONDS) $faixas['30']++;
        elseif ($u >= $agora - 90 * DAY_IN_SECONDS) $faixas['90']++;
        elseif ($u >= $agora - 180 * DAY_IN_SECONDS) $faixas['180']++;
        else $faixas['mais']++;
    }
    $base = ['faixas' => $faixas, 'total' => count($ult)];
    set_transient('eap_met_base', $base, 30 * MINUTE_IN_SECONDS); // a conta da base inteira roda no máximo a cada 30 min
    }
    $faixas = $base['faixas'];
    $total_cred = $base['total'];

    // gráfico: credenciados por dia
    $por_dia = $wpdb->get_results("SELECT DATE(quando) d, COUNT(DISTINCT user_id) n FROM $t WHERE tipo = 'acesso' AND $f GROUP BY DATE(quando)", OBJECT_K);
    $serie = [];
    for ($i = $dias - 1; $i >= 0; $i--) { $d = wp_date('Y-m-d', $agora - $i * DAY_IN_SECONDS); $serie[$d] = isset($por_dia[$d]) ? (int) $por_dia[$d]->n : 0; }
    $max = max(1, ...array_values($serie ?: [0]));

    $paginas = $wpdb->get_results("SELECT extra, COUNT(*) n FROM $t WHERE tipo = 'pagina' AND $f GROUP BY extra ORDER BY n DESC LIMIT 8");
    $nomes_pag = ['area-do-credenciado' => 'Início', 'video-aulas' => 'Vídeo aulas', 'downloads' => 'Downloads', 'marketing' => 'Marketing', 'suporte' => 'Suporte', 'eaclub' => 'Clube de vantagens', 'simulador-de-estimativa-e-pacote' => 'Estimativa e pacote (IA)', 'indicacao-de-uso-ea-air' => 'Prognóstico EA AIR (IA)', 'confirmar-dados' => 'Confirmar dados'];
    $nomes_sis = ['ortholab' => 'Ortholab', 'rewards' => 'Esthetic Rewards', 'enviofacil' => 'Envio Fácil'];
    $avisos = get_posts(['post_type' => 'ea_aviso', 'post_status' => 'publish', 'numberposts' => 5]);

    $url = fn($d, $e) => add_query_arg(['page' => 'eap-resultados', 'dias' => $d, 'equipe' => $e ? 1 : null], admin_url('admin.php'));
    $csv = fn($d) => wp_nonce_url(add_query_arg(['action' => 'eap_met_csv', 'dias' => $d], admin_url('admin-post.php')), 'eap_met_csv');
    $num = fn($n) => number_format_i18n((int) $n);
    $pct = fn($a, $b) => $b ? round($a * 100 / $b) : 0;
    ?>
    <style>
      .eapr{max-width:1180px;font-size:14px}.eapr h1{display:flex;align-items:center;gap:10px}
      .eapr__barra{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0 22px}
      .eapr__barra a{padding:6px 14px;border-radius:999px;border:1px solid #c9d3e6;text-decoration:none;color:#1b2433;background:#fff}
      .eapr__barra a.on{background:#2f6fe4;border-color:#2f6fe4;color:#fff}.eapr__barra .sep{flex:1}
      .eapr__cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:22px}
      .eapr__card{background:#fff;border:1px solid #e4e8f0;border-radius:14px;padding:16px 18px}
      .eapr__card b{display:block;font-size:30px;line-height:1.1;color:#0d1f42;margin:6px 0 2px}.eapr__card span{color:#5b6576;font-size:13px}
      .eapr__card--ia b{color:#d9861c}
      .eapr__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:16px}
      .eapr__box{background:#fff;border:1px solid #e4e8f0;border-radius:14px;padding:18px 20px}
      .eapr__box h2{font-size:15px;margin:0 0 12px}.eapr__box p.d{color:#5b6576;margin:-6px 0 12px;font-size:12.5px}
      .eapr__lista{margin:0;padding:0;list-style:none}.eapr__lista li{display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid #f0f2f7}
      .eapr__lista li:last-child{border:0}.eapr__lista span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .eapr__lista em{font-style:normal;color:#5b6576;font-size:12.5px}.eapr__lista b{min-width:42px;text-align:right}
      .eapr__vazio{color:#8a93a3;padding:10px 0}
      .eapr__graf{display:flex;align-items:flex-end;gap:3px;height:150px;padding-top:8px}
      .eapr__graf i{flex:1;background:linear-gradient(#3fa2f2,#2f6fe4);border-radius:4px 4px 0 0;min-height:2px;position:relative}
      .eapr__graf i:hover::after{content:attr(data-t);position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:#0d1f42;color:#fff;font-style:normal;font-size:11px;padding:3px 7px;border-radius:6px;white-space:nowrap;margin-bottom:4px}
      .eapr__eixo{display:flex;justify-content:space-between;color:#8a93a3;font-size:11.5px;margin-top:6px}
      .eapr__faixas{display:flex;height:16px;border-radius:999px;overflow:hidden;margin:6px 0 14px}
      .eapr__leg{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px}.eapr__leg div{display:flex;align-items:center;gap:8px}
      .eapr__leg i{width:10px;height:10px;border-radius:3px;display:inline-block}.eapr__leg b{margin-left:auto}
      .eapr__meses{display:flex;gap:14px;align-items:flex-end;height:170px;padding-top:6px}.eapr__mes{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%}
      .eapr__mes-barras{flex:1;width:100%;display:flex;gap:5px;align-items:flex-end;justify-content:center}.eapr__mes-barras i{width:34%;max-width:34px;border-radius:5px 5px 0 0}.eapr__mes-barras i.a{background:#2f6fe4}.eapr__mes-barras i.n{background:#f2a33a}.eapr__mes b{font-size:12px;color:#5b6576;font-weight:600}
      .eapr__nota{color:#5b6576;font-size:12.5px;margin-top:18px}
    </style>
    <div class="wrap eapr">
      <h1>📊 Resultados do portal</h1>
      <div class="eapr__barra">
        <?php foreach ([7 => 'Últimos 7 dias', 30 => 'Últimos 30 dias', 90 => 'Últimos 90 dias'] as $d => $r) : ?>
          <a class="<?php echo $d === $dias ? 'on' : ''; ?>" href="<?php echo esc_url($url($d, $equipe)); ?>"><?php echo esc_html($r); ?></a>
        <?php endforeach; ?>
        <span class="sep"></span>
        <label><input type="checkbox" <?php checked($equipe); ?> onchange="location.href=<?php echo esc_attr(wp_json_encode($url($dias, !$equipe))); ?>"> Incluir acessos da equipe</label>
      </div>

      <div class="eapr__cards">
        <div class="eapr__card"><span>Credenciados que entraram</span><b><?php echo $num($ativos); ?></b><span>de <?php echo $num($total_cred); ?> cadastrados</span></div>
        <div class="eapr__card"><span>Acessos (dias com visita)</span><b><?php echo $num($acessos); ?></b><span><?php echo $ativos ? number_format_i18n($acessos / $ativos, 1) . ' por credenciado' : '—'; ?></span></div>
        <div class="eapr__card"><span>Materiais baixados</span><b><?php echo $num($downloads); ?></b><span>downloads</span></div>
        <div class="eapr__card"><span>Aulas abertas</span><b><?php echo $num($aulas); ?></b><span>vídeo aulas</span></div>
        <div class="eapr__card"><span>Posts baixados</span><b><?php echo $num($posts); ?></b><span>para redes sociais</span></div>
        <div class="eapr__card eapr__card--ia"><span>Estimativas (IA)</span><b><?php echo $num($est); ?></b><span>enviadas para vendas</span></div>
        <div class="eapr__card"><span>Entradas nos sistemas</span><b><?php echo $num($tot_sis); ?></b><span>sem digitar senha</span></div>
      </div>
      <?php
      $marca_un = (int) $wpdb->get_var("SELECT COUNT(*) FROM $t WHERE tipo = 'post_baixar' AND extra = 'marca' AND $f");
      $marca_zip = (int) $wpdb->get_var("SELECT COUNT(*) FROM $t WHERE tipo = 'post_baixar' AND extra = 'marca_zip' AND $f");
      $orc = $conta('orcamento');
      $cert = $conta('certificado');
      $concl = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key = 'eap_curso_concluido_em'");
      $com_marca = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key = 'eap_marca' AND meta_value <> ''");
      ?>
      <h2 style="font-size:15px;margin:4px 0 12px">Ferramentas do dentista</h2>
      <div class="eapr__cards">
        <div class="eapr__card"><span>Posts baixados com a marca</span><b><?php echo $num($marca_un); ?></b><span>um a um, no período</span></div>
        <div class="eapr__card"><span>Pacotes ZIP com a marca</span><b><?php echo $num($marca_zip); ?></b><span>no período</span></div>
        <div class="eapr__card"><span>Consultórios com marca</span><b><?php echo $num($com_marca); ?></b><span>cadastrada (total)</span></div>
        <div class="eapr__card eapr__card--ia"><span>Orçamentos para pacientes</span><b><?php echo $num($orc); ?></b><span>gerados no período</span></div>
        <div class="eapr__card"><span>Curso do Credenciado</span><b><?php echo $num($concl); ?></b><span>concluíram (total)</span></div>
        <div class="eapr__card"><span>Certificados emitidos</span><b><?php echo $num($cert); ?></b><span>no período</span></div>
      </div>

      <div class="eapr__grid">
        <div class="eapr__box" style="grid-column:1/-1">
          <h2>Credenciados no portal por dia</h2>
          <div class="eapr__graf"><?php foreach ($serie as $d => $n) echo '<i style="height:' . max(1, round($n * 100 / $max)) . '%" data-t="' . esc_attr(wp_date('d/m', strtotime($d)) . ': ' . $n) . '"></i>'; ?></div>
          <div class="eapr__eixo"><span><?php echo esc_html(wp_date('d/m', strtotime(array_key_first($serie)))); ?></span><span>hoje</span></div>
        </div>
      </div>

      <div class="eapr__grid">
        <div class="eapr__box">
          <h2>Materiais mais baixados</h2>
          <?php $l = $top('download'); if (!$l) echo '<div class="eapr__vazio">Ainda sem downloads no período.</div>'; else { echo '<ul class="eapr__lista">'; foreach ($l as $r) echo '<li><span>' . esc_html(get_the_title($r->obj) ?: '#' . $r->obj) . '</span><em>' . $num($r->p) . ' pessoas</em><b>' . $num($r->n) . '</b></li>'; echo '</ul>'; } ?>
        </div>
        <div class="eapr__box">
          <h2>Aulas mais vistas</h2>
          <?php $l = $top('aula'); if (!$l) echo '<div class="eapr__vazio">Ainda sem aulas abertas no período.</div>'; else { echo '<ul class="eapr__lista">'; foreach ($l as $r) echo '<li><span>' . esc_html(get_the_title($r->obj) ?: '#' . $r->obj) . '</span><em>' . $num($r->p) . ' pessoas</em><b>' . $num($r->n) . '</b></li>'; echo '</ul>'; } ?>
        </div>
        <div class="eapr__box">
          <h2>Posts para redes mais baixados</h2>
          <?php $l = $top('post_baixar'); if (!$l) echo '<div class="eapr__vazio">Ainda sem posts baixados no período.</div>'; else { echo '<ul class="eapr__lista">'; foreach ($l as $r) echo '<li><span>' . esc_html(get_the_title($r->obj) ?: '#' . $r->obj) . '</span><em>' . $num($r->p) . ' pessoas</em><b>' . $num($r->n) . '</b></li>'; echo '</ul>'; } ?>
        </div>
        <div class="eapr__box">
          <h2>Páginas mais visitadas</h2>
          <?php if (!$paginas) echo '<div class="eapr__vazio">Ainda sem visitas no período.</div>'; else { echo '<ul class="eapr__lista">'; foreach ($paginas as $r) echo '<li><span>' . esc_html($nomes_pag[$r->extra] ?? $r->extra) . '</span><b>' . $num($r->n) . '</b></li>'; echo '</ul>'; } ?>
        </div>
        <div class="eapr__box">
          <h2>Entradas nos sistemas pelo portal</h2>
          <p class="d">Cliques que abriram o sistema já logado, sem pedir senha.</p>
          <?php if (!$sistemas) echo '<div class="eapr__vazio">Ainda sem entradas no período.</div>'; else { echo '<ul class="eapr__lista">'; foreach ($sistemas as $r) echo '<li><span>' . esc_html($nomes_sis[$r->extra] ?? $r->extra) . '</span><b>' . $num($r->n) . '</b></li>'; echo '</ul>'; } ?>
        </div>
        <div class="eapr__box">
          <h2>Avisos</h2>
          <?php if (!$avisos) echo '<div class="eapr__vazio">Nenhum aviso publicado.</div>'; else { echo '<ul class="eapr__lista">'; foreach ($avisos as $a) { $v = (int) get_post_meta($a->ID, '_eap_vistos', true); $c = (int) get_post_meta($a->ID, '_eap_cliques', true); echo '<li><span>' . esc_html(get_the_title($a)) . '</span><em>' . $num($c) . ' cliques</em><b>' . $num($v) . '</b></li>'; } echo '</ul><p class="d" style="margin:8px 0 0">Número em destaque: credenciados que viram.</p>'; } ?>
        </div>
      </div>


      <?php $h = eap_met_historico(6); $mx = 1; foreach ($h['linhas'] as $l) $mx = max($mx, (int) $l['ativos'], (int) $l['novos']);
      $mes = fn($k) => ucfirst(wp_date('M/y', strtotime($k . '-15'))); ?>
      <div class="eapr__grid">
        <div class="eapr__box" style="grid-column:1/-1">
          <h2>Últimos 6 meses</h2>
          <p class="d">Credenciados que fizeram login em cada mês (registro do Log de atividades do portal) e novos cadastros no mês. Não inclui a equipe.</p>
          <div class="eapr__meses">
            <?php foreach ($h['linhas'] as $k => $l) : ?>
              <div class="eapr__mes">
                <div class="eapr__mes-barras">
                  <i class="a" style="height:<?php echo $l['ativos'] === null ? 0 : max(2, round($l['ativos'] * 100 / $mx)); ?>%" title="<?php echo esc_attr('Entraram: ' . ($l['ativos'] ?? 'sem registro')); ?>"></i>
                  <i class="n" style="height:<?php echo max(2, round($l['novos'] * 100 / $mx)); ?>%" title="<?php echo esc_attr('Novos cadastros: ' . $l['novos']); ?>"></i>
                </div>
                <b><?php echo esc_html($mes($k)); ?></b>
              </div>
            <?php endforeach; ?>
          </div>
          <div class="eapr__leg" style="grid-template-columns:auto auto;justify-content:start;margin:10px 0 14px"><div><i style="background:#2f6fe4"></i>Credenciados que entraram</div><div><i style="background:#f2a33a"></i>Novos cadastros</div></div>
          <table class="widefat striped" style="max-width:760px">
            <thead><tr><th>Mês</th><th>Credenciados que entraram</th><th>Logins</th><th>Logins por credenciado</th><th>Novos cadastros</th></tr></thead>
            <tbody><?php foreach (array_reverse($h['linhas'], true) as $k => $l) : ?>
              <tr><td><b><?php echo esc_html($mes($k)); ?></b></td>
                <td><?php echo $l['ativos'] === null ? '<span style="color:#8a93a3">sem registro</span>' : $num($l['ativos']); ?></td>
                <td><?php echo $l['logins'] === null ? '—' : $num($l['logins']); ?></td>
                <td><?php echo ($l['ativos'] ?? 0) ? number_format_i18n($l['logins'] / $l['ativos'], 1) : '—'; ?></td>
                <td><?php echo $num($l['novos']); ?></td></tr>
            <?php endforeach; ?></tbody>
          </table>
          <p class="d" style="margin:10px 0 0"><?php echo $h['tem_log'] ? ($h['desde_log'] ? 'O Log de atividades tem registros desde ' . esc_html(wp_date('d/m/Y', $h['desde_log'])) . '. Meses antes disso aparecem como “sem registro”.' : 'O Log de atividades ainda não tem logins registrados.') : 'O plugin Log de atividades não está instalado; só os novos cadastros aparecem.'; ?></p>
        </div>
      </div>
      <div class="eapr__grid">
        <div class="eapr__box" style="grid-column:1/-1">
          <h2>Credenciados pelo último acesso</h2>
          <p class="d">Visão de toda a base (não depende do período acima). Quem não entra há muito tempo é um bom alvo para a equipe comercial reativar.</p>
          <?php $cores = ['30' => '#22a565', '90' => '#3fa2f2', '180' => '#f2a33a', 'mais' => '#e2574c', 'nunca' => '#b8c0cf'];
          $rot = ['30' => 'Entraram nos últimos 30 dias', '90' => 'Entre 31 e 90 dias', '180' => 'Entre 91 e 180 dias', 'mais' => 'Há mais de 180 dias', 'nunca' => 'Sem acesso registrado']; ?>
          <div class="eapr__faixas"><?php foreach ($faixas as $k => $n) if ($n) echo '<span style="width:' . ($n * 100 / max(1, $total_cred)) . '%;background:' . $cores[$k] . '" title="' . esc_attr($rot[$k] . ': ' . $n) . '"></span>'; ?></div>
          <div class="eapr__leg"><?php foreach ($faixas as $k => $n) echo '<div><i style="background:' . $cores[$k] . '"></i>' . esc_html($rot[$k]) . '<b>' . $num($n) . ' <em style="font-weight:400;color:#8a93a3">(' . $pct($n, $total_cred) . '%)</em></b></div>'; ?></div>
          <p style="margin:16px 0 0"><a class="button" href="<?php echo esc_url($csv(60)); ?>">Baixar planilha: sem acesso há mais de 60 dias</a> <a class="button" href="<?php echo esc_url($csv(180)); ?>">Sem acesso há mais de 180 dias</a></p>
        </div>
      </div>
      <p class="eapr__nota">Os números de uso começaram a ser contados em <?php echo esc_html(wp_date('d/m/Y', (int) get_option('eap_novo_desde', time()))); ?>. O último acesso de antes disso vem do registro de login do portal antigo. Por padrão, os acessos da equipe (quem edita o portal) não entram na conta.</p>
    </div>
    <?php
}
