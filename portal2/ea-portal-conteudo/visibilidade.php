<?php
/**
 * Ocultar / mostrar no portal.
 *  - Seções inteiras (menu, atalhos, cartões do início): página "O que aparece no portal".
 *  - Itens (aulas, materiais, parceiros, posts, perguntas): coluna "No portal" nas listas,
 *    ação em massa e caixinha na tela de edição. Nada é apagado: oculto volta quando quiser.
 */
if (!defined('ABSPATH')) exit;

const EAP_TIPOS_OCULTAVEIS = ['ea_aula', 'ea_material', 'ea_parceiro', 'ea_post', 'faq'];

function eap_secoes_portal() {
    return [
        'ia-estimativa'   => ['Estimativa e pacote – Alinhadores (Powered by AI)', 'Cartão no início', 'simulador-de-estimativa-e-pacote'],
        'ia-ronco'        => ['Prognóstico ronco e apneia – EA AIR (Powered by AI)', 'Cartão no início', 'indicacao-de-uso-ea-air'],
        'video-aulas'     => ['Vídeo aulas', 'Menu, atalho e página', 'video-aulas'],
        'aulas-recentes'  => ['Destaques do início', 'Bloco no fim do início (o conteúdo é escolhido em Destaques do início)', ''],
        'dicas'           => ['Dicas clínicas', 'Atalho no início', ''],
        'enviofacil'      => ['Enviar caso – Envio Fácil', 'Atalho no início', ''],
        'downloads'       => ['Downloads', 'Menu, atalho e página', 'downloads'],
        'marketing'       => ['Marketing', 'Menu, atalho e página', 'marketing'],
        'posts-marketing' => ['Posts prontos para redes', 'Bloco no topo da página Marketing', ''],
        'suporte'         => ['Suporte ao credenciado', 'Menu, atalho e página', 'suporte'],
        'clube'           => ['Clube de vantagens', 'Menu, atalho e página', 'eaclub'],
        'store'           => ['Esthetic Aligner Store', 'Atalho no início', ''],
        'ortholab'        => ['Ortholab', 'Menu e atalho', ''],
        'rewards'         => ['Esthetic Rewards', 'Atalho no início', ''],
    ];
}

function eap_ocultos() {
    $o = get_option('eap_ocultos', []);
    return is_array($o) ? $o : [];
}

/** true se a seção aparece para os dentistas. */
function eap_visivel($chave) {
    return !in_array($chave, eap_ocultos(), true);
}

function eap_item_oculto($post_id) {
    return (bool) get_post_meta($post_id, '_eap_oculto', true);
}

// ------------------------------------------------------------ página de seções
add_action('admin_menu', function () {
    add_submenu_page('eap-portal', 'O que aparece no portal', 'O que aparece no portal', 'edit_pages', 'eap-visibilidade', 'eap_visibilidade_pagina', 1);
}, 15);

function eap_visibilidade_pagina() {
    if (!current_user_can('edit_pages')) return;
    if (isset($_POST['eap_vis_nonce']) && wp_verify_nonce($_POST['eap_vis_nonce'], 'eap_vis')) {
        $mostrar = array_map('sanitize_key', (array) ($_POST['mostrar'] ?? []));
        $ocultos = array_values(array_diff(array_keys(eap_secoes_portal()), $mostrar));
        update_option('eap_ocultos', $ocultos, false);
        echo '<div class="notice notice-success is-dismissible"><p>Salvo. O portal já está atualizado.</p></div>';
    }
    $ocultos = eap_ocultos();
    ?>
    <div class="wrap eap-vis">
      <h1>O que aparece no portal</h1>
      <p style="font-size:14px;max-width:760px">Desligue o que não deve aparecer para os dentistas. Nada é apagado — é só ligar de novo para voltar a mostrar.
      Para esconder um item específico (uma aula, um material, um parceiro, um post ou uma pergunta), use a coluna <b>No portal</b> na lista daquele conteúdo.</p>
      <form method="post">
        <?php wp_nonce_field('eap_vis', 'eap_vis_nonce'); ?>
        <div class="eap-vis__lista">
        <?php foreach (eap_secoes_portal() as $k => [$nome, $onde]) : $on = !in_array($k, $ocultos, true); ?>
          <label class="eap-vis__item<?php echo $on ? '' : ' is-off'; ?>">
            <span class="eap-vis__txt"><strong><?php echo esc_html($nome); ?></strong><em><?php echo esc_html($onde); ?></em></span>
            <span class="eap-vis__estado"><?php echo $on ? 'Visível' : 'Oculto'; ?></span>
            <input type="checkbox" name="mostrar[]" value="<?php echo esc_attr($k); ?>" <?php checked($on); ?>>
            <span class="eap-vis__chave" aria-hidden="true"></span>
          </label>
        <?php endforeach; ?>
        </div>
        <p><button class="button button-primary button-hero">Salvar</button></p>
      </form>
      <h2 style="margin-top:28px">Itens ocultos no momento</h2>
      <?php
      $itens = get_posts(['post_type' => EAP_TIPOS_OCULTAVEIS, 'numberposts' => 200, 'post_status' => 'any', 'meta_key' => '_eap_oculto', 'meta_value' => '1', 'suppress_filters' => true, 'eap_todos' => 1]);
      if (!$itens) echo '<p>Nenhum item oculto.</p>';
      else {
          echo '<table class="widefat striped" style="max-width:760px"><tbody>';
          foreach ($itens as $p) {
              $tipo = get_post_type_object($p->post_type);
              echo '<tr><td>' . esc_html(get_the_title($p)) . '</td><td>' . esc_html($tipo ? $tipo->labels->singular_name : $p->post_type) . '</td><td style="text-align:right"><a class="button" href="' . esc_url(eap_link_alternar($p->ID)) . '">Mostrar de novo</a></td></tr>';
          }
          echo '</tbody></table>';
      }
      ?>
    </div>
    <style>
      .eap-vis__lista{display:grid;gap:10px;max-width:760px;margin:18px 0}
      .eap-vis__item{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #dcdfe6;border-radius:12px;padding:14px 18px;cursor:pointer;position:relative}
      .eap-vis__item.is-off{background:#f6f7f9}
      .eap-vis__item.is-off strong{color:#8a94a6}
      .eap-vis__txt{flex:1;display:grid;gap:2px}
      .eap-vis__txt strong{font-size:14.5px}
      .eap-vis__txt em{font-style:normal;color:#646970;font-size:12.5px}
      .eap-vis__estado{font-size:12px;font-weight:600;color:#1a7f37}
      .is-off .eap-vis__estado{color:#8a94a6}
      .eap-vis__item input{position:absolute;opacity:0;pointer-events:none}
      .eap-vis__chave{width:44px;height:24px;border-radius:99px;background:#c3c4c7;position:relative;transition:.2s;flex:none}
      .eap-vis__chave::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
      .eap-vis__item input:checked + .eap-vis__chave{background:#2f6fe4}
      .eap-vis__item input:checked + .eap-vis__chave::after{left:23px}
    </style>
    <script>
      document.querySelectorAll('.eap-vis__item input').forEach(function(i){i.addEventListener('change',function(){var l=i.closest('.eap-vis__item');l.classList.toggle('is-off',!i.checked);l.querySelector('.eap-vis__estado').textContent=i.checked?'Visível':'Oculto';});});
    </script>
    <?php
}

// ------------------------------------------------------------ itens: coluna, ações e caixinha
function eap_link_alternar($post_id) {
    return wp_nonce_url(admin_url('admin-post.php?action=eap_alternar&post=' . (int) $post_id), 'eap_alternar_' . (int) $post_id);
}

add_action('admin_post_eap_alternar', function () {
    $id = (int) ($_GET['post'] ?? 0);
    if (!$id || !current_user_can('edit_post', $id) || !wp_verify_nonce($_GET['_wpnonce'] ?? '', 'eap_alternar_' . $id)) wp_die('Sem permissão.');
    if (eap_item_oculto($id)) delete_post_meta($id, '_eap_oculto'); else update_post_meta($id, '_eap_oculto', '1');
    wp_safe_redirect(wp_get_referer() ?: admin_url('edit.php?post_type=' . get_post_type($id)));
    exit;
});

foreach (EAP_TIPOS_OCULTAVEIS as $tipo) {
    add_filter("manage_{$tipo}_posts_columns", function ($c) {
        $n = [];
        foreach ($c as $k => $v) { $n[$k] = $v; if ($k === 'title') $n['eap_portal'] = 'No portal'; }
        if (!isset($n['eap_portal'])) $n['eap_portal'] = 'No portal';
        return $n;
    });
    add_action("manage_{$tipo}_posts_custom_column", function ($col, $id) {
        if ($col !== 'eap_portal') return;
        $oc = eap_item_oculto($id);
        echo '<a href="' . esc_url(eap_link_alternar($id)) . '" class="eap-pill ' . ($oc ? 'is-off' : '') . '" title="Clique para ' . ($oc ? 'mostrar' : 'ocultar') . '">' . ($oc ? 'Oculto' : 'Visível') . '</a>';
    }, 10, 2);
    add_filter("bulk_actions-edit-{$tipo}", function ($a) {
        $a['eap_ocultar'] = 'Ocultar do portal';
        $a['eap_mostrar'] = 'Mostrar no portal';
        return $a;
    });
    add_filter("handle_bulk_actions-edit-{$tipo}", function ($url, $acao, $ids) {
        if (!in_array($acao, ['eap_ocultar', 'eap_mostrar'], true)) return $url;
        foreach ($ids as $id) {
            if (!current_user_can('edit_post', $id)) continue;
            if ($acao === 'eap_ocultar') update_post_meta($id, '_eap_oculto', '1'); else delete_post_meta($id, '_eap_oculto');
        }
        return $url;
    }, 10, 3);
}

add_action('admin_head', function () {
    $s = get_current_screen();
    if (!$s || !in_array($s->post_type, EAP_TIPOS_OCULTAVEIS, true)) return;
    echo '<style>.column-eap_portal{width:96px}.eap-pill{display:inline-block;padding:3px 10px;border-radius:99px;background:#e7f6ec;color:#1a7f37;font-weight:600;font-size:12px;text-decoration:none}.eap-pill.is-off{background:#f0f0f1;color:#8a94a6}.eap-pill:hover{filter:brightness(.95)}</style>';
});

add_action('post_submitbox_misc_actions', function ($post) {
    if (!in_array($post->post_type, EAP_TIPOS_OCULTAVEIS, true)) return;
    wp_nonce_field('eap_oc_box', 'eap_oc_box_n');
    echo '<div class="misc-pub-section"><label><input type="checkbox" name="eap_oculto" value="1" ' . checked(eap_item_oculto($post->ID), true, false) . '> <b>Ocultar do portal</b></label></div>';
});
add_action('save_post', function ($id, $post) {
    if (!in_array($post->post_type, EAP_TIPOS_OCULTAVEIS, true)) return;
    if (!isset($_POST['eap_oc_box_n']) || !wp_verify_nonce($_POST['eap_oc_box_n'], 'eap_oc_box')) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (!empty($_POST['eap_oculto'])) update_post_meta($id, '_eap_oculto', '1'); else delete_post_meta($id, '_eap_oculto');
}, 10, 2);

// ------------------------------------------------------------ site: filtra ocultos
add_action('pre_get_posts', function ($q) {
    if (is_admin() || $q->get('eap_todos')) return;
    $tipos = (array) $q->get('post_type');
    if (!array_intersect($tipos, EAP_TIPOS_OCULTAVEIS)) return;
    $mq = (array) $q->get('meta_query');
    $mq[] = ['key' => '_eap_oculto', 'compare' => 'NOT EXISTS'];
    $q->set('meta_query', $mq);
});

// seção oculta: dentista volta ao início; equipe vê um aviso
add_action('template_redirect', function () {
    if (is_admin() || !is_page()) return;
    $slug = get_queried_object() ? get_queried_object()->post_name : '';
    foreach (eap_secoes_portal() as $k => [, , $pg]) {
        if ($pg && $pg === $slug && !eap_visivel($k)) {
            if (current_user_can('edit_pages')) {
                add_action('wp_footer', function () {
                    echo '<div style="position:fixed;left:16px;bottom:16px;z-index:9999;background:#112654;color:#fff;padding:10px 16px;border-radius:12px;font:600 13px/1.4 sans-serif">Esta seção está oculta para os dentistas.</div>';
                });
                return;
            }
            wp_safe_redirect(home_url('/area-do-credenciado/'));
            exit;
        }
    }
});
