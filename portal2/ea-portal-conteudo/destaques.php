<?php
/**
 * Destaques do início: o bloco no fim da página inicial.
 * A equipe escolhe o que aparece: posts de marketing recentes, aulas recentes,
 * ou itens escolhidos a dedo (estrela ★ na coluna "Início" das listas).
 */
if (!defined('ABSPATH')) exit;

const EAP_TIPOS_DESTAQUE = ['ea_post', 'ea_aula', 'ea_material', 'ea_parceiro'];

function eap_destaque_cfg() {
    $c = get_option('eap_destaque', []);
    return wp_parse_args(is_array($c) ? $c : [], ['modo' => 'posts', 'titulo' => '', 'qtd' => 4]);
}

function eap_destaque_modos() {
    return [
        'posts'    => ['Posts de marketing mais recentes', 'Posts para suas redes', '/marketing/'],
        'aulas'    => ['Aulas mais recentes', 'Aulas mais recentes', '/video-aulas/'],
        'marcados' => ['Escolhidos por nós (itens marcados com ★)', 'Destaques', ''],
    ];
}

/** O que o tema mostra: ['titulo','link','modo','itens'=>WP_Post[]]. */
function eap_destaques_inicio() {
    $c = eap_destaque_cfg();
    $modos = eap_destaque_modos();
    $modo = isset($modos[$c['modo']]) ? $c['modo'] : 'posts';
    $qtd = max(1, min(12, (int) $c['qtd']));
    if ($modo === 'posts') {
        $itens = get_posts(['post_type' => 'ea_post', 'numberposts' => $qtd, 'orderby' => ['menu_order' => 'ASC', 'date' => 'DESC']]);
    } elseif ($modo === 'aulas') {
        $itens = get_posts(['post_type' => 'ea_aula', 'numberposts' => $qtd, 'orderby' => 'date', 'order' => 'DESC']);
    } else {
        $itens = get_posts(['post_type' => EAP_TIPOS_DESTAQUE, 'numberposts' => $qtd, 'meta_key' => '_eap_inicio', 'orderby' => 'meta_value_num', 'order' => 'ASC']);
    }
    return [
        'modo'   => $modo,
        'titulo' => trim($c['titulo']) ?: $modos[$modo][1],
        'link'   => $modos[$modo][2] ? home_url($modos[$modo][2]) : '',
        'itens'  => $itens,
    ];
}

// ------------------------------------------------------------ página de configuração
add_action('admin_menu', function () {
    add_submenu_page('eap-portal', 'Destaques do início', 'Destaques do início', 'edit_pages', 'eap-destaques', 'eap_destaques_pagina', 2);
}, 15);

function eap_destaques_pagina() {
    if (!current_user_can('edit_pages')) return;
    if (isset($_POST['eap_dest_n']) && wp_verify_nonce($_POST['eap_dest_n'], 'eap_dest')) {
        $modo = sanitize_key($_POST['modo'] ?? 'posts');
        update_option('eap_destaque', [
            'modo'   => isset(eap_destaque_modos()[$modo]) ? $modo : 'posts',
            'titulo' => sanitize_text_field(wp_unslash($_POST['titulo'] ?? '')),
            'qtd'    => max(1, min(12, (int) ($_POST['qtd'] ?? 4))),
        ], false);
        // ordem dos marcados
        foreach ((array) ($_POST['ordem'] ?? []) as $id => $o) {
            if (current_user_can('edit_post', (int) $id) && get_post_meta((int) $id, '_eap_inicio', true) !== '') update_post_meta((int) $id, '_eap_inicio', (int) $o);
        }
        echo '<div class="notice notice-success is-dismissible"><p>Salvo. O início do portal já mostra a nova seleção.</p></div>';
    }
    $c = eap_destaque_cfg();
    $marcados = get_posts(['post_type' => EAP_TIPOS_DESTAQUE, 'numberposts' => 50, 'post_status' => 'any', 'meta_key' => '_eap_inicio', 'orderby' => 'meta_value_num', 'order' => 'ASC', 'eap_todos' => 1]);
    ?>
    <div class="wrap eap-dest">
      <h1>Destaques do início</h1>
      <p style="font-size:14px;max-width:760px">É o bloco que aparece no fim da página inicial do portal, logo abaixo dos atalhos. Escolha o que mostrar e salve.</p>
      <form method="post">
        <?php wp_nonce_field('eap_dest', 'eap_dest_n'); ?>
        <div class="eap-dest__modos">
          <?php foreach (eap_destaque_modos() as $k => [$nome, $tit]) : ?>
            <label class="eap-dest__modo"><input type="radio" name="modo" value="<?php echo esc_attr($k); ?>" <?php checked($c['modo'], $k); ?>>
              <span><strong><?php echo esc_html($nome); ?></strong>
              <em><?php
                if ($k === 'posts') echo 'Mostra os primeiros posts cadastrados em Posts para redes.';
                elseif ($k === 'aulas') echo 'Mostra as últimas aulas cadastradas.';
                else echo 'Misture o que quiser: aulas, posts, materiais e parceiros. Marque a ★ na coluna "Início" da lista de cada um.';
              ?></em></span></label>
          <?php endforeach; ?>
        </div>
        <table class="form-table" style="max-width:760px">
          <tr><th><label for="eap-tit">Título do bloco</label></th><td><input id="eap-tit" class="regular-text" name="titulo" value="<?php echo esc_attr($c['titulo']); ?>" placeholder="Deixe em branco para usar o padrão"></td></tr>
          <tr><th><label for="eap-qtd">Quantos itens</label></th><td><select id="eap-qtd" name="qtd"><?php foreach ([4, 8, 12] as $q) echo '<option ' . selected((int) $c['qtd'], $q, false) . '>' . $q . '</option>'; ?></select> <span class="description">Aparecem 4 por linha.</span></td></tr>
        </table>
        <h2>Itens marcados com ★</h2>
        <?php if (!$marcados) : ?>
          <p>Nenhum item marcado ainda. Para marcar, abra
            <a href="<?php echo esc_url(admin_url('edit.php?post_type=ea_aula')); ?>">Vídeo aulas</a>,
            <a href="<?php echo esc_url(admin_url('edit.php?post_type=ea_post')); ?>">Posts para redes</a>,
            <a href="<?php echo esc_url(admin_url('edit.php?post_type=ea_material')); ?>">Materiais</a> ou
            <a href="<?php echo esc_url(admin_url('edit.php?post_type=ea_parceiro')); ?>">Clube de vantagens</a>
            e clique na ☆ da coluna <b>Início</b>.</p>
        <?php else : ?>
          <table class="widefat striped" style="max-width:760px"><thead><tr><th style="width:70px">Ordem</th><th>Item</th><th>Tipo</th><th></th></tr></thead><tbody>
          <?php foreach ($marcados as $p) : $t = get_post_type_object($p->post_type); ?>
            <tr><td><input type="number" name="ordem[<?php echo (int) $p->ID; ?>]" value="<?php echo (int) get_post_meta($p->ID, '_eap_inicio', true); ?>" style="width:60px"></td>
              <td><?php echo esc_html(get_the_title($p)); ?></td><td><?php echo esc_html($t ? $t->labels->singular_name : ''); ?></td>
              <td style="text-align:right"><a class="button" href="<?php echo esc_url(eap_link_estrela($p->ID)); ?>">Tirar do início</a></td></tr>
          <?php endforeach; ?>
          </tbody></table>
          <p class="description">Menor número aparece primeiro.</p>
        <?php endif; ?>
        <p><button class="button button-primary button-hero">Salvar</button></p>
      </form>
    </div>
    <style>
      .eap-dest__modos{display:grid;gap:10px;max-width:760px;margin:16px 0}
      .eap-dest__modo{display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid #dcdfe6;border-radius:12px;padding:14px 18px;cursor:pointer}
      .eap-dest__modo:has(input:checked){border-color:#2f6fe4;box-shadow:0 0 0 1px #2f6fe4;background:#f5f9ff}
      .eap-dest__modo input{margin-top:3px}
      .eap-dest__modo span{display:grid;gap:3px}
      .eap-dest__modo em{font-style:normal;color:#646970;font-size:12.5px}
    </style>
    <?php
}

// ------------------------------------------------------------ estrela nas listas
function eap_link_estrela($post_id) {
    return wp_nonce_url(admin_url('admin-post.php?action=eap_estrela&post=' . (int) $post_id), 'eap_estrela_' . (int) $post_id);
}

function eap_marcar_inicio($id, $marcar) {
    if ($marcar) {
        if (get_post_meta($id, '_eap_inicio', true) === '') {
            global $wpdb;
            $max = (int) $wpdb->get_var("SELECT MAX(CAST(meta_value AS SIGNED)) FROM {$wpdb->postmeta} WHERE meta_key = '_eap_inicio'");
            update_post_meta($id, '_eap_inicio', $max + 10);
        }
    } else {
        delete_post_meta($id, '_eap_inicio');
    }
}

add_action('admin_post_eap_estrela', function () {
    $id = (int) ($_GET['post'] ?? 0);
    if (!$id || !current_user_can('edit_post', $id) || !wp_verify_nonce($_GET['_wpnonce'] ?? '', 'eap_estrela_' . $id)) wp_die('Sem permissão.');
    eap_marcar_inicio($id, get_post_meta($id, '_eap_inicio', true) === '');
    wp_safe_redirect(wp_get_referer() ?: admin_url('edit.php?post_type=' . get_post_type($id)));
    exit;
});

foreach (EAP_TIPOS_DESTAQUE as $tipo) {
    add_filter("manage_{$tipo}_posts_columns", function ($c) {
        $n = [];
        foreach ($c as $k => $v) { $n[$k] = $v; if ($k === 'title') $n['eap_inicio'] = 'Início'; }
        if (!isset($n['eap_inicio'])) $n['eap_inicio'] = 'Início';
        return $n;
    }, 20);
    add_action("manage_{$tipo}_posts_custom_column", function ($col, $id) {
        if ($col !== 'eap_inicio') return;
        $on = get_post_meta($id, '_eap_inicio', true) !== '';
        echo '<a href="' . esc_url(eap_link_estrela($id)) . '" class="eap-estrela' . ($on ? ' is-on' : '') . '" title="' . ($on ? 'Tirar dos destaques do início' : 'Mostrar nos destaques do início') . '">' . ($on ? '★' : '☆') . '</a>';
    }, 10, 2);
    add_filter("bulk_actions-edit-{$tipo}", function ($a) {
        $a['eap_inicio_sim'] = 'Destacar no início ★';
        $a['eap_inicio_nao'] = 'Tirar do início';
        return $a;
    });
    add_filter("handle_bulk_actions-edit-{$tipo}", function ($url, $acao, $ids) {
        if (!in_array($acao, ['eap_inicio_sim', 'eap_inicio_nao'], true)) return $url;
        foreach ($ids as $id) if (current_user_can('edit_post', $id)) eap_marcar_inicio((int) $id, $acao === 'eap_inicio_sim');
        return $url;
    }, 10, 3);
}

add_action('admin_head', function () {
    $s = get_current_screen();
    if (!$s || !in_array($s->post_type, EAP_TIPOS_DESTAQUE, true)) return;
    echo '<style>.column-eap_inicio{width:56px;text-align:center}.eap-estrela{font-size:20px;text-decoration:none;color:#c3c4c7;line-height:1}.eap-estrela.is-on{color:#f0a020}.eap-estrela:hover{color:#f0a020}</style>';
});

add_action('post_submitbox_misc_actions', function ($post) {
    if (!in_array($post->post_type, EAP_TIPOS_DESTAQUE, true)) return;
    wp_nonce_field('eap_ini_box', 'eap_ini_box_n');
    echo '<div class="misc-pub-section"><label><input type="checkbox" name="eap_inicio" value="1" ' . checked(get_post_meta($post->ID, '_eap_inicio', true) !== '', true, false) . '> <b>★ Destacar no início</b></label></div>';
});
add_action('save_post', function ($id, $post) {
    if (!in_array($post->post_type, EAP_TIPOS_DESTAQUE, true)) return;
    if (!isset($_POST['eap_ini_box_n']) || !wp_verify_nonce($_POST['eap_ini_box_n'], 'eap_ini_box')) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    eap_marcar_inicio($id, !empty($_POST['eap_inicio']));
}, 10, 2);
