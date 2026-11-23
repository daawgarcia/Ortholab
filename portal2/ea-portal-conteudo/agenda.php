<?php
/**
 * Agenda de cursos: cursos presenciais, masterclasses e webinars.
 * A equipe cadastra em Portal do Credenciado → Agenda de cursos (título, imagem, data, horário,
 * local, link de inscrição). A página /agenda-de-cursos/ monta tudo sozinha e esconde o que já passou.
 */
if (!defined('ABSPATH')) exit;

add_action('init', function () {
    register_post_type('ea_curso', [
        'labels' => ['name' => 'Agenda de cursos', 'singular_name' => 'Curso', 'add_new' => 'Novo curso', 'add_new_item' => 'Novo curso na agenda', 'edit_item' => 'Editar curso', 'all_items' => '📅 Agenda de cursos', 'not_found' => 'Nenhum curso na agenda.', 'featured_image' => 'Imagem do curso', 'set_featured_image' => 'Escolher imagem do curso'],
        'public' => false, 'show_ui' => true, 'show_in_menu' => 'eap-portal',
        'supports' => ['title', 'editor', 'thumbnail'], 'show_in_rest' => false,
    ]);
});

const EAP_AG_STATUS = ['abertas' => 'Inscrições abertas', 'ultimas' => 'Últimas vagas', 'breve' => 'Inscrições em breve', 'esgotado' => 'Vagas esgotadas'];
const EAP_AG_MOD = ['presencial' => 'Presencial', 'online' => 'Online', 'hibrido' => 'Presencial e online'];

function eap_ag_meta($id) {
    $g = fn($k, $d = '') => (string) (get_post_meta($id, '_eap_ag_' . $k, true) ?: $d);
    return ['data' => $g('data'), 'fim' => $g('fim'), 'hi' => $g('hi'), 'hf' => $g('hf'), 'mod' => $g('mod', 'presencial'), 'cidade' => $g('cidade'), 'local' => $g('local'),
        'quem' => $g('quem'), 'link' => $g('link'), 'btn' => $g('btn', 'Inscreva-se'), 'status' => $g('status', 'abertas'), 'destaque' => $g('destaque')];
}

/** Link de inscrição: aceita URL ou só o número de WhatsApp. */
function eap_ag_link($m, $titulo) {
    $l = trim($m['link']);
    if ($l === '') return '';
    if (preg_match('~^[\d\s()+-]{10,}$~', $l)) {
        $n = preg_replace('~\D~', '', $l); if (strlen($n) <= 11) $n = '55' . ltrim($n, '0');
        return 'https://wa.me/' . $n . '?text=' . rawurlencode('Olá! Quero me inscrever: ' . $titulo);
    }
    return $l;
}

function eap_ag_dia($ymd) { return (int) substr($ymd, 8, 2); }
function eap_ag_mes_curto($ymd) { return ['', 'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][(int) substr($ymd, 5, 2)] ?? ''; }
function eap_ag_data_longa($m) {
    if (!$m['data']) return '';
    $sem = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    $meses = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    $fmt = function ($ymd, $ano = true) use ($meses) { [$a, $mm, $d] = array_map('intval', explode('-', $ymd)); return $d . ' de ' . $meses[$mm] . ($ano ? ' de ' . $a : ''); };
    if ($m['fim'] && $m['fim'] > $m['data']) {
        $mesmo_mes = substr($m['fim'], 0, 7) === substr($m['data'], 0, 7);
        return ($mesmo_mes ? eap_ag_dia($m['data']) : $fmt($m['data'], false)) . ' a ' . $fmt($m['fim']);
    }
    return $sem[(int) date('w', strtotime($m['data']))] . ', ' . $fmt($m['data']);
}
function eap_ag_hora($h) { if (!$h) return ''; [$hh, $mm] = array_map('intval', explode(':', $h)); return $hh . 'h' . ($mm ? sprintf('%02d', $mm) : ''); }
function eap_ag_horario($m) { if (!$m['hi']) return ''; return $m['hf'] ? 'das ' . eap_ag_hora($m['hi']) . ' às ' . eap_ag_hora($m['hf']) : 'às ' . eap_ag_hora($m['hi']); }

/** Link "Adicionar ao Google Agenda". */
function eap_ag_gcal($p, $m) {
    if (!$m['data']) return '';
    $d = str_replace('-', '', $m['data']); $f = str_replace('-', '', $m['fim'] ?: $m['data']);
    $hi = $m['hi'] ? str_replace(':', '', $m['hi']) . '00' : ''; $hf = $m['hf'] ? str_replace(':', '', $m['hf']) . '00' : '';
    $datas = $hi ? $d . 'T' . $hi . '/' . $f . 'T' . ($hf ?: $hi) : $d . '/' . date('Ymd', strtotime(($m['fim'] ?: $m['data']) . ' +1 day'));
    $onde = trim(($m['mod'] === 'online' ? 'Online' : $m['local']) . ($m['cidade'] ? ' – ' . $m['cidade'] : ''), ' –');
    return 'https://calendar.google.com/calendar/render?' . http_build_query(['action' => 'TEMPLATE', 'text' => get_the_title($p), 'dates' => $datas, 'ctz' => 'America/Sao_Paulo', 'location' => $onde, 'details' => 'Esthetic Aligner · ' . home_url('/agenda-de-cursos/')], '', '&', PHP_QUERY_RFC3986);
}

/** ['proximos' => [...], 'passados' => [...]] em ordem de data. */
function eap_ag_cursos() {
    $hoje = wp_date('Y-m-d');
    $todos = get_posts(['post_type' => 'ea_curso', 'post_status' => 'publish', 'numberposts' => 200, 'meta_key' => '_eap_ag_data', 'orderby' => 'meta_value', 'order' => 'ASC']);
    $prox = $pass = [];
    foreach ($todos as $p) { $m = eap_ag_meta($p->ID); if (($m['fim'] ?: $m['data']) >= $hoje) $prox[] = $p; else $pass[] = $p; }
    return ['proximos' => $prox, 'passados' => array_slice(array_reverse($pass), 0, 6)];
}

// ------------------------------------------------------------ cadastro
add_action('add_meta_boxes_ea_curso', function () {
    add_meta_box('eap_ag', 'Data, local e inscrição', 'eap_ag_box', 'ea_curso', 'normal', 'high');
});
function eap_ag_box($post) {
    $m = eap_ag_meta($post->ID);
    wp_nonce_field('eap_ag_box', 'eap_ag_n');
    $op = fn($lista, $atual) => implode('', array_map(fn($k, $v) => '<option value="' . esc_attr($k) . '"' . selected($atual, $k, false) . '>' . esc_html($v) . '</option>', array_keys($lista), $lista));
    ?>
    <style>.eap-ag td{padding:8px 10px;vertical-align:top}.eap-ag input[type=text],.eap-ag input[type=url]{width:420px;max-width:100%}.eap-ag .d{color:#646970;font-size:12.5px;margin-top:4px}</style>
    <table class="eap-ag">
      <tr><td><b>Data</b></td><td><input type="date" name="eap_ag_data" value="<?php echo esc_attr($m['data']); ?>" required> até <input type="date" name="eap_ag_fim" value="<?php echo esc_attr($m['fim']); ?>"><div class="d">A data final só é necessária para cursos de mais de um dia. Depois que o curso passa, ele sai sozinho da agenda.</div></td></tr>
      <tr><td><b>Horário</b></td><td>das <input type="time" name="eap_ag_hi" value="<?php echo esc_attr($m['hi']); ?>"> às <input type="time" name="eap_ag_hf" value="<?php echo esc_attr($m['hf']); ?>"></td></tr>
      <tr><td><b>Formato</b></td><td><select name="eap_ag_mod"><?php echo $op(EAP_AG_MOD, $m['mod']); ?></select></td></tr>
      <tr><td><b>Cidade</b></td><td><input type="text" name="eap_ag_cidade" value="<?php echo esc_attr($m['cidade']); ?>" placeholder="Ex.: São Paulo – SP"></td></tr>
      <tr><td><b>Local</b></td><td><input type="text" name="eap_ag_local" value="<?php echo esc_attr($m['local']); ?>" placeholder="Ex.: Hotel Pestana, Rua Tutóia, 77 (ou Zoom)"></td></tr>
      <tr><td><b>Ministrado por</b></td><td><input type="text" name="eap_ag_quem" value="<?php echo esc_attr($m['quem']); ?>" placeholder="Ex.: Dr. Fulano de Tal"></td></tr>
      <tr><td><b>Inscrição</b></td><td><input type="text" name="eap_ag_link" value="<?php echo esc_attr($m['link']); ?>" placeholder="Link (Zoom, formulário…) ou número de WhatsApp"><br>
        Texto do botão: <input type="text" name="eap_ag_btn" value="<?php echo esc_attr($m['btn']); ?>" style="width:200px"><div class="d">Se colocar só um número de WhatsApp, o botão já abre a conversa com o nome do curso.</div></td></tr>
      <tr><td><b>Situação</b></td><td><select name="eap_ag_status"><?php echo $op(EAP_AG_STATUS, $m['status']); ?></select></td></tr>
      <tr><td><b>Destaque</b></td><td><label><input type="checkbox" name="eap_ag_destaque" value="1" <?php checked($m['destaque'], '1'); ?>> Mostrar em destaque no topo da agenda</label><div class="d">Sem nenhum destaque marcado, o topo mostra o próximo curso.</div></td></tr>
    </table>
    <p class="d">O texto acima (opcional) aparece como descrição do curso. A imagem do curso fica em “Imagem do curso”, à direita; o ideal é quadrada (como um post de Instagram).</p>
    <?php
}
add_action('save_post_ea_curso', function ($id) {
    if (!isset($_POST['eap_ag_n']) || !wp_verify_nonce($_POST['eap_ag_n'], 'eap_ag_box')) return;
    if ((defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || !current_user_can('edit_post', $id)) return;
    $t = fn($k) => sanitize_text_field(wp_unslash($_POST['eap_ag_' . $k] ?? ''));
    foreach (['data', 'fim'] as $k) update_post_meta($id, '_eap_ag_' . $k, preg_match('~^\d{4}-\d{2}-\d{2}$~', $t($k)) ? $t($k) : '');
    foreach (['hi', 'hf'] as $k) update_post_meta($id, '_eap_ag_' . $k, preg_match('~^\d{2}:\d{2}$~', $t($k)) ? $t($k) : '');
    update_post_meta($id, '_eap_ag_mod', isset(EAP_AG_MOD[$t('mod')]) ? $t('mod') : 'presencial');
    update_post_meta($id, '_eap_ag_status', isset(EAP_AG_STATUS[$t('status')]) ? $t('status') : 'abertas');
    foreach (['cidade', 'local', 'quem', 'btn'] as $k) update_post_meta($id, '_eap_ag_' . $k, mb_substr($t($k), 0, 160));
    $l = trim($t('link'));
    update_post_meta($id, '_eap_ag_link', preg_match('~^[\d\s()+-]{10,}$~', $l) ? $l : esc_url_raw($l));
    update_post_meta($id, '_eap_ag_destaque', empty($_POST['eap_ag_destaque']) ? '' : '1');
});

// colunas da lista
add_filter('manage_ea_curso_posts_columns', fn($c) => ['cb' => $c['cb'], 'title' => 'Curso', 'eap_data' => 'Data', 'eap_onde' => 'Onde', 'eap_sit' => 'Situação', 'eap_cliq' => 'Cliques em inscrição']);
add_action('manage_ea_curso_posts_custom_column', function ($col, $id) {
    $m = eap_ag_meta($id);
    if ($col === 'eap_data') { echo esc_html($m['data'] ? date('d/m/Y', strtotime($m['data'])) . ($m['fim'] ? ' a ' . date('d/m/Y', strtotime($m['fim'])) : '') : '—'); if ($m['data'] && ($m['fim'] ?: $m['data']) < wp_date('Y-m-d')) echo ' <em style="color:#999">(já passou)</em>'; }
    if ($col === 'eap_onde') echo esc_html(EAP_AG_MOD[$m['mod']] . ($m['cidade'] ? ' · ' . $m['cidade'] : ''));
    if ($col === 'eap_sit') echo esc_html(EAP_AG_STATUS[$m['status']] ?? '') . ($m['destaque'] ? ' ⭐' : '');
    if ($col === 'eap_cliq') { global $wpdb; $t = function_exists('eap_met_tabela') ? eap_met_tabela() : ''; echo $t ? (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT user_id) FROM $t WHERE tipo='agenda' AND obj=%d", $id)) . ' dentista(s)' : '—'; }
}, 10, 2);
add_action('pre_get_posts', function ($q) {
    if (is_admin() && $q->is_main_query() && ($q->get('post_type') === 'ea_curso') && !$q->get('orderby')) { $q->set('meta_key', '_eap_ag_data'); $q->set('orderby', 'meta_value'); $q->set('order', 'DESC'); }
});
add_action('admin_notices', function () {
    $s = get_current_screen();
    if ($s && $s->id === 'edit-ea_curso') echo '<div class="notice notice-info"><p>Os cursos aparecem em <a href="' . esc_url(home_url('/agenda-de-cursos/')) . '" target="_blank">/agenda-de-cursos/</a> em ordem de data. Cursos que já passaram saem da agenda sozinhos (ficam em “Cursos que já aconteceram”).</p></div>';
});

/** Importa uma vez os cursos da agenda do site antigo (com as imagens). */
add_action('admin_post_eap_agenda_importar', function () {
    if (!current_user_can('edit_pages') || !check_admin_referer('eap_agenda_importar')) wp_die('Sem permissão.');
    if (get_option('eap_agenda_importado')) { wp_safe_redirect(admin_url('edit.php?post_type=ea_curso')); exit; }
    require_once ABSPATH . 'wp-admin/includes/media.php'; require_once ABSPATH . 'wp-admin/includes/file.php'; require_once ABSPATH . 'wp-admin/includes/image.php';
    $w = '5511951461804';
    $lista = [
        ['Webinar Esthetic Aligner – IA na prática odontológica', '2026-11-12', '20:00', '', 'online', '', 'Zoom', 'https://us06web.zoom.us/meeting/register/Qdy91lB8S7SMiVq1Y93hfw', 'https://estheticaligner.com.br/wp-content/uploads/2026/10/ia-na-pratica-odontologica-2-1024x1024.png'],
        ['Masterclass Esthetic Aligner – São Paulo', '2026-12-03', '08:00', '12:00', 'presencial', 'São Paulo – SP', '', $w, 'https://estheticaligner.com.br/wp-content/uploads/2024/06/curso.jpg'],
        ['Ronco e Apneia do Sono – São Paulo', '2026-12-03', '14:00', '18:00', 'presencial', 'São Paulo – SP', '', $w, 'https://estheticaligner.com.br/wp-content/uploads/2025/04/black-blue-dynamic-freelancer-online-webinar-instagram-post-1024x1024.png'],
    ];
    foreach ($lista as [$tit, $data, $hi, $hf, $mod, $cid, $local, $link, $img]) {
        $id = wp_insert_post(['post_type' => 'ea_curso', 'post_status' => 'publish', 'post_title' => $tit]);
        if (!$id || is_wp_error($id)) continue;
        foreach (['data' => $data, 'hi' => $hi, 'hf' => $hf, 'mod' => $mod, 'cidade' => $cid, 'local' => $local, 'link' => $link, 'btn' => 'Inscreva-se', 'status' => 'abertas'] as $k => $v) update_post_meta($id, '_eap_ag_' . $k, $v);
        $a = media_sideload_image($img, $id, $tit, 'id');
        if (!is_wp_error($a)) set_post_thumbnail($id, $a);
    }
    update_option('eap_agenda_importado', time(), false);
    wp_safe_redirect(admin_url('edit.php?post_type=ea_curso')); exit;
});
