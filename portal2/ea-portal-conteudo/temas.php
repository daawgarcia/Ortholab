<?php
/**
 * Temas dos materiais (Downloads / Marketing).
 * Um tema é uma subseção: em "Seções de materiais", crie o tema com "Ascendente" = Downloads
 * e marque-o no material. A ordem dos temas vem do campo "Ordem" do tema.
 */
if (!defined('ABSPATH')) exit;

/** Temas (subseções) de uma seção, na ordem definida. */
function eap_temas_da_secao($secao_id) {
    $temas = get_terms(['taxonomy' => 'ea_secao', 'parent' => (int) $secao_id, 'hide_empty' => false]);
    if (is_wp_error($temas)) return [];
    usort($temas, function ($a, $b) {
        $oa = (int) get_term_meta($a->term_id, 'eap_ordem', true);
        $ob = (int) get_term_meta($b->term_id, 'eap_ordem', true);
        return $oa <=> $ob ?: strcasecmp($a->name, $b->name);
    });
    return $temas;
}

// campo "Ordem" no cadastro do tema
add_action('ea_secao_add_form_fields', function () {
    echo '<div class="form-field"><label for="eap_ordem">Ordem</label><input name="eap_ordem" id="eap_ordem" type="number" value="100"><p>Menor aparece primeiro. Para um tema de Downloads, escolha "Downloads" em Ascendente.</p></div>';
});
add_action('ea_secao_edit_form_fields', function ($t) {
    echo '<tr class="form-field"><th><label for="eap_ordem">Ordem</label></th><td><input name="eap_ordem" id="eap_ordem" type="number" value="' . esc_attr((int) get_term_meta($t->term_id, 'eap_ordem', true)) . '"><p class="description">Menor aparece primeiro.</p></td></tr>';
});
foreach (['created_ea_secao', 'edited_ea_secao'] as $gancho) {
    add_action($gancho, function ($id) {
        if (isset($_POST['eap_ordem'])) update_term_meta($id, 'eap_ordem', (int) $_POST['eap_ordem']);
    });
}
add_filter('manage_edit-ea_secao_columns', function ($c) { $c['eap_ordem'] = 'Ordem'; return $c; });
add_filter('manage_ea_secao_custom_column', function ($s, $col, $id) {
    return $col === 'eap_ordem' ? (string) (int) get_term_meta($id, 'eap_ordem', true) : $s;
}, 10, 3);

/**
 * Lê os títulos (h1–h6) das páginas antigas de Downloads e Marketing e coloca cada
 * material no tema em que aparecia. Pode rodar de novo sem duplicar.
 */
function eap_organizar_temas() {
    global $wpdb;
    $n_temas = 0; $n_mat = 0;
    foreach ([['downloads', 'Downloads'], ['marketing', 'Marketing']] as [$slug, $nome]) {
        $pg = get_page_by_path($slug);
        $sec = get_term_by('name', $nome, 'ea_secao');
        if (!$pg || !$sec) continue;
        $c = preg_replace_callback('~link="url:([^|"]+)[^"]*"~', fn($m) => 'link="' . rawurldecode($m[1]) . '"', $pg->post_content);
        preg_match_all('~<h[1-6][^>]*>(.*?)</h[1-6]>|(?:href|link)="([^"]+)"~is', $c, $mm, PREG_SET_ORDER);
        $tema = 0; $ord_tema = 0; $pos = 0;
        foreach ($mm as $m) {
            if (isset($m[1]) && $m[1] !== '') {
                $titulo = trim(html_entity_decode(wp_strip_all_tags($m[1])));
                if ($titulo === '') continue;
                $ord_tema += 10;
                $existe = term_exists($titulo, 'ea_secao', $sec->term_id);
                if (!$existe) { $existe = wp_insert_term($titulo, 'ea_secao', ['parent' => $sec->term_id]); $n_temas++; }
                if (is_wp_error($existe)) { $tema = 0; continue; }
                $tema = (int) (is_array($existe) ? $existe['term_id'] : $existe);
                if (get_term_meta($tema, 'eap_ordem', true) === '') update_term_meta($tema, 'eap_ordem', $ord_tema);
                continue;
            }
            if (!$tema || empty($m[2])) continue;
            $arq = basename(parse_url(html_entity_decode($m[2]), PHP_URL_PATH) ?: '');
            if (strlen($arq) < 5) continue;
            $ids = $wpdb->get_col($wpdb->prepare(
                "SELECT pm.post_id FROM {$wpdb->postmeta} pm JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                 WHERE p.post_type = 'ea_material' AND pm.meta_key = '_eap_arquivo' AND pm.meta_value LIKE %s",
                '%/' . $wpdb->esc_like($arq)
            ));
            foreach ($ids as $id) {
                $pos += 10;
                $atuais = wp_get_object_terms($id, 'ea_secao', ['fields' => 'ids']);
                $atuais = array_filter((array) $atuais, function ($t) use ($sec) { $tt = get_term($t, 'ea_secao'); return $tt && (int) $tt->parent !== (int) $sec->term_id; });
                wp_set_object_terms($id, array_values(array_unique(array_merge($atuais, [(int) $sec->term_id, $tema]))), 'ea_secao');
                wp_update_post(['ID' => $id, 'menu_order' => $pos]);
                $n_mat++;
            }
        }
    }
    return sprintf('Temas organizados: %d tema(s) novo(s), %d material(is) colocados nos temas.', $n_temas, $n_mat);
}

add_action('admin_post_eap_organizar_temas', function () {
    if (!current_user_can('manage_options') || !check_admin_referer('eap_organizar_temas')) wp_die('Sem permissão.');
    $r = eap_organizar_temas();
    wp_safe_redirect(add_query_arg(['page' => 'eap-importar', 'temas' => rawurlencode($r)], admin_url('admin.php')));
    exit;
});

add_action('admin_notices', function () {
    $s = get_current_screen();
    if (!$s || strpos($s->id, 'eap-importar') === false) return;
    if (!empty($_GET['temas'])) echo '<div class="notice notice-success"><p>' . esc_html(wp_unslash($_GET['temas'])) . '</p></div>';
    echo '<div class="notice notice-info"><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" style="padding:8px 0">'
        . wp_nonce_field('eap_organizar_temas', '_wpnonce', true, false)
        . '<input type="hidden" name="action" value="eap_organizar_temas">'
        . '<b>Temas dos Downloads e Marketing:</b> separa os materiais pelos mesmos títulos das páginas antigas. '
        . '<button class="button">Organizar por temas</button></form></div>';
});
