<?php
/**
 * Avisos para os dentistas (divulgar curso, evento, novidade).
 * A equipe cria em Portal do Credenciado → Avisos. O dentista vê ao entrar no portal:
 *  - "Janela": aparece no meio da tela, uma vez por dentista (até ele fechar).
 *  - "Faixa": barra no topo de todas as páginas, até ele fechar.
 * Cada aviso tem período (de/até), botão opcional e contagem de quem viu e clicou.
 */
if (!defined('ABSPATH')) exit;

add_action('init', function () {
    register_post_type('ea_aviso', [
        'labels' => ['name' => 'Avisos', 'singular_name' => 'Aviso', 'add_new' => 'Novo aviso', 'add_new_item' => 'Novo aviso para os dentistas', 'edit_item' => 'Editar aviso', 'all_items' => 'Avisos', 'not_found' => 'Nenhum aviso ainda.'],
        'public' => false, 'show_ui' => true, 'show_in_menu' => 'eap-portal',
        'supports' => ['title', 'editor', 'thumbnail'], 'show_in_rest' => false, 'menu_icon' => 'dashicons-megaphone',
    ]);
});

function eap_aviso_meta($id) {
    return [
        'formato' => get_post_meta($id, '_eap_formato', true) ?: 'janela',
        'btn_txt' => get_post_meta($id, '_eap_btn_txt', true),
        'btn_url' => get_post_meta($id, '_eap_btn_url', true),
        'de'      => get_post_meta($id, '_eap_de', true),
        'ate'     => get_post_meta($id, '_eap_ate', true),
        'versao'  => (int) get_post_meta($id, '_eap_versao', true),
        'vistos'  => (int) get_post_meta($id, '_eap_vistos', true),
        'cliques' => (int) get_post_meta($id, '_eap_cliques', true),
    ];
}

function eap_aviso_no_periodo($m) {
    $hoje = wp_date('Y-m-d');
    if ($m['de'] && $hoje < $m['de']) return false;
    if ($m['ate'] && $hoje > $m['ate']) return false;
    return true;
}

// ------------------------------------------------------------ cadastro
add_action('add_meta_boxes_ea_aviso', function () {
    add_meta_box('eap_aviso', 'Como e quando mostrar', 'eap_aviso_box', 'ea_aviso', 'normal', 'high');
});

function eap_aviso_box($post) {
    $m = eap_aviso_meta($post->ID);
    wp_nonce_field('eap_aviso_box', 'eap_aviso_n');
    ?>
    <style>.eap-av td{padding:8px 10px;vertical-align:top}.eap-av label.op{display:inline-flex;gap:6px;margin-right:18px;align-items:center}.eap-av .d{color:#646970;font-size:12.5px}</style>
    <table class="eap-av">
      <tr><td><b>Formato</b></td><td>
        <label class="op"><input type="radio" name="eap_formato" value="janela" <?php checked($m['formato'], 'janela'); ?>> Janela no meio da tela</label>
        <label class="op"><input type="radio" name="eap_formato" value="faixa" <?php checked($m['formato'], 'faixa'); ?>> Faixa no topo</label>
        <div class="d">A janela aparece uma vez para cada dentista. A faixa fica no topo até ele fechar.</div></td></tr>
      <tr><td><b>Período</b></td><td>de <input type="date" name="eap_de" value="<?php echo esc_attr($m['de']); ?>"> até <input type="date" name="eap_ate" value="<?php echo esc_attr($m['ate']); ?>">
        <div class="d">Em branco = começa já / não tem fim. Depois da data final o aviso some sozinho.</div></td></tr>
      <tr><td><b>Botão</b></td><td><input type="text" name="eap_btn_txt" value="<?php echo esc_attr($m['btn_txt']); ?>" placeholder="Ex.: Quero me inscrever" style="width:220px">
        <input type="url" name="eap_btn_url" value="<?php echo esc_attr($m['btn_url']); ?>" placeholder="https://… (link da inscrição)" style="width:360px">
        <div class="d">Opcional. Sem link, o aviso só tem o botão de fechar.</div></td></tr>
      <?php if ($post->post_status === 'publish') : ?>
      <tr><td><b>Mostrar de novo</b></td><td><label class="op"><input type="checkbox" name="eap_reenviar" value="1"> Mostrar outra vez para quem já fechou</label></td></tr>
      <tr><td><b>Resultado</b></td><td>Visto por <b><?php echo (int) $m['vistos']; ?></b> dentista(s) · <b><?php echo (int) $m['cliques']; ?></b> clique(s) no botão</td></tr>
      <?php endif; ?>
    </table>
    <p class="d">O texto do aviso é o conteúdo acima. Uma imagem destacada (à direita) aparece no topo da janela. Para ver como fica antes de publicar, salve como rascunho e use o link “Pré-visualizar no portal”.</p>
    <?php if ($post->ID && $post->post_status !== 'auto-draft') : ?>
      <p><a class="button" target="_blank" href="<?php echo esc_url(add_query_arg('eap_aviso_ver', $post->ID, home_url('/area-do-credenciado/'))); ?>">Pré-visualizar no portal</a></p>
    <?php endif;
}

add_action('save_post_ea_aviso', function ($id) {
    if (!isset($_POST['eap_aviso_n']) || !wp_verify_nonce($_POST['eap_aviso_n'], 'eap_aviso_box')) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (!current_user_can('edit_post', $id)) return;
    update_post_meta($id, '_eap_formato', ($_POST['eap_formato'] ?? '') === 'faixa' ? 'faixa' : 'janela');
    foreach (['de', 'ate'] as $k) {
        $v = sanitize_text_field($_POST['eap_' . $k] ?? '');
        update_post_meta($id, '_eap_' . $k, preg_match('~^\d{4}-\d{2}-\d{2}$~', $v) ? $v : '');
    }
    update_post_meta($id, '_eap_btn_txt', sanitize_text_field(wp_unslash($_POST['eap_btn_txt'] ?? '')));
    update_post_meta($id, '_eap_btn_url', esc_url_raw($_POST['eap_btn_url'] ?? ''));
    if (!empty($_POST['eap_reenviar'])) {
        update_post_meta($id, '_eap_versao', (int) get_post_meta($id, '_eap_versao', true) + 1);
        update_post_meta($id, '_eap_vistos', 0);
        update_post_meta($id, '_eap_cliques', 0);
    }
});

add_filter('manage_ea_aviso_posts_columns', function ($c) {
    return ['cb' => $c['cb'], 'title' => 'Aviso', 'eap_formato' => 'Formato', 'eap_periodo' => 'Período', 'eap_situacao' => 'No portal', 'eap_res' => 'Visto / cliques'];
});
add_action('manage_ea_aviso_posts_custom_column', function ($col, $id) {
    $m = eap_aviso_meta($id);
    $fmt = fn($d) => $d ? wp_date('d/m/Y', strtotime($d . ' 12:00')) : '';
    if ($col === 'eap_formato') echo $m['formato'] === 'faixa' ? 'Faixa no topo' : 'Janela';
    if ($col === 'eap_periodo') echo esc_html(($m['de'] ? $fmt($m['de']) : 'já') . ' → ' . ($m['ate'] ? $fmt($m['ate']) : 'sem fim'));
    if ($col === 'eap_situacao') {
        $on = get_post_status($id) === 'publish' && eap_aviso_no_periodo($m);
        $txt = get_post_status($id) !== 'publish' ? 'Rascunho' : ($on ? 'No ar' : (($m['de'] && wp_date('Y-m-d') < $m['de']) ? 'Agendado' : 'Encerrado'));
        echo '<span style="display:inline-block;padding:3px 10px;border-radius:99px;font-weight:600;font-size:12px;background:' . ($on ? '#e7f6ec;color:#1a7f37' : '#f0f0f1;color:#646970') . '">' . esc_html($txt) . '</span>';
    }
    if ($col === 'eap_res') echo (int) $m['vistos'] . ' / ' . (int) $m['cliques'];
}, 10, 2);

// ------------------------------------------------------------ portal
function eap_avisos_para($user_id) {
    $vistos = (array) get_user_meta($user_id, 'eap_avisos_vistos', true);
    $out = [];
    foreach (get_posts(['post_type' => 'ea_aviso', 'numberposts' => 10, 'orderby' => 'date', 'order' => 'DESC']) as $p) {
        $m = eap_aviso_meta($p->ID);
        if (!eap_aviso_no_periodo($m)) continue;
        if (isset($vistos[$p->ID]) && (int) $vistos[$p->ID] >= $m['versao']) continue;
        $out[] = [$p, $m];
    }
    return $out;
}

function eap_aviso_html($p, $m, $previa = false) {
    $img = has_post_thumbnail($p) ? (function_exists('eapt_thumb_url') ? eapt_thumb_url($p->ID, 'large') : get_the_post_thumbnail_url($p, 'large')) : '';
    $btn = ($m['btn_txt'] && $m['btn_url']) ? '<a class="eap-aviso__btn" href="' . esc_url($m['btn_url']) . '" target="_blank" rel="noopener" data-eap-aviso-clique>' . esc_html($m['btn_txt']) . '</a>' : '';
    $attrs = ' data-eap-aviso="' . (int) $p->ID . '" data-v="' . (int) $m['versao'] . '"' . ($previa ? ' data-previa="1"' : '');
    if ($m['formato'] === 'faixa') {
        return '<div class="eap-aviso-faixa"' . $attrs . '><div class="eap-wrap"><span class="eap-aviso-faixa__ic">📣</span><span class="eap-aviso-faixa__txt"><strong>' . esc_html(get_the_title($p)) . '</strong> '
            . esc_html(wp_trim_words(wp_strip_all_tags($p->post_content), 24)) . '</span>' . $btn
            . '<button type="button" class="eap-aviso__x" data-eap-aviso-fechar aria-label="Fechar">×</button></div></div>';
    }
    return '<div class="eap-aviso-janela"' . $attrs . ' hidden><div class="eap-aviso-janela__caixa" role="dialog" aria-modal="true">'
        . '<button type="button" class="eap-aviso__x" data-eap-aviso-fechar aria-label="Fechar">×</button>'
        . ($img ? '<img class="eap-aviso-janela__img" src="' . esc_url($img) . '" alt="">' : '')
        . '<div class="eap-aviso-janela__corpo"><span class="eap-aviso-janela__tag">Aviso Esthetic Aligner</span><h3>' . esc_html(get_the_title($p)) . '</h3>'
        . '<div class="eap-aviso-janela__txt">' . wp_kses_post(wpautop($p->post_content)) . '</div>'
        . '<div class="eap-aviso-janela__acoes">' . $btn . '<button type="button" class="eap-aviso__depois" data-eap-aviso-fechar>Fechar</button></div></div></div></div>';
}

add_action('wp_footer', 'eap_avisos_render', 1);
function eap_avisos_render() {
    static $feito = false;
    if ($feito || !is_user_logged_in() || is_admin()) return;
    if (function_exists('eap_precisa_confirmar') && eap_precisa_confirmar(get_current_user_id())) return;
    $feito = true;
    $lista = [];
    $previa = (int) ($_GET['eap_aviso_ver'] ?? 0);
    if ($previa && current_user_can('edit_post', $previa) && get_post_type($previa) === 'ea_aviso') {
        $lista[] = [get_post($previa), eap_aviso_meta($previa), true];
    } else {
        foreach (eap_avisos_para(get_current_user_id()) as [$p, $m]) $lista[] = [$p, $m, false];
    }
    if (!$lista) return;
    $janela = false;
    foreach ($lista as [$p, $m, $pv]) {
        if ($m['formato'] === 'janela') { if ($janela) continue; $janela = true; }
        echo eap_aviso_html($p, $m, $pv);
    }
    $ajax = admin_url('admin-ajax.php');
    $n = wp_create_nonce('eap_aviso');
    ?>
    <script>
    (function () {
      var ajax = <?php echo wp_json_encode($ajax); ?>, nonce = <?php echo wp_json_encode($n); ?>;
      function marcar(el, tipo) {
        if (el.getAttribute('data-previa')) return;
        var fd = new FormData(); fd.append('action', 'eap_aviso'); fd.append('_n', nonce);
        fd.append('id', el.getAttribute('data-eap-aviso')); fd.append('v', el.getAttribute('data-v')); fd.append('tipo', tipo);
        if (navigator.sendBeacon) navigator.sendBeacon(ajax, fd); else fetch(ajax, { method: 'POST', body: fd, credentials: 'same-origin' });
      }
      document.querySelectorAll('[data-eap-aviso]').forEach(function (el) {
        var faixa = el.classList.contains('eap-aviso-faixa');
        if (faixa) { var h = document.querySelector('header.eap-topo') || document.querySelector('header'); if (h && h.parentNode && el.parentNode !== h.parentNode) h.parentNode.insertBefore(el, h.nextSibling); }
        else { setTimeout(function () { el.hidden = false; document.body.style.overflow = 'hidden'; }, 700); }
        marcar(el, 'visto');
        function fechar() { el.remove(); if (!faixa) document.body.style.overflow = ''; }
        el.querySelectorAll('[data-eap-aviso-fechar]').forEach(function (b) { b.addEventListener('click', function () { marcar(el, 'fechou'); fechar(); }); });
        var c = el.querySelector('[data-eap-aviso-clique]'); if (c) c.addEventListener('click', function () { marcar(el, 'clique'); setTimeout(fechar, 200); });
        if (!faixa) { el.addEventListener('click', function (e) { if (e.target === el) { marcar(el, 'fechou'); fechar(); } }); document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.contains(el)) { marcar(el, 'fechou'); fechar(); } }); }
      });
    })();
    </script>
    <?php
}

add_action('wp_ajax_eap_aviso', function () {
    if (!wp_verify_nonce($_POST['_n'] ?? '', 'eap_aviso')) wp_die('', '', 403);
    $id = (int) ($_POST['id'] ?? 0); $v = (int) ($_POST['v'] ?? 0); $tipo = sanitize_key($_POST['tipo'] ?? '');
    if (get_post_type($id) !== 'ea_aviso') wp_die('', '', 400);
    $uid = get_current_user_id();
    $chave = 'eap_aviso_' . $id . '_' . $v;
    $feito = (array) get_user_meta($uid, 'eap_avisos_acoes', true);
    if ($tipo === 'visto' && empty($feito[$chave . '_v'])) { update_post_meta($id, '_eap_vistos', (int) get_post_meta($id, '_eap_vistos', true) + 1); $feito[$chave . '_v'] = 1; }
    if ($tipo === 'clique' && empty($feito[$chave . '_c'])) { update_post_meta($id, '_eap_cliques', (int) get_post_meta($id, '_eap_cliques', true) + 1); $feito[$chave . '_c'] = 1; }
    update_user_meta($uid, 'eap_avisos_acoes', array_slice($feito, -200, null, true));
    // janela: some depois de vista; faixa: some quando fecha ou clica
    $m = eap_aviso_meta($id);
    if ($tipo !== 'visto' || $m['formato'] === 'janela') {
        $vistos = (array) get_user_meta($uid, 'eap_avisos_vistos', true);
        $vistos[$id] = $v;
        update_user_meta($uid, 'eap_avisos_vistos', $vistos);
    }
    wp_die('ok');
});
