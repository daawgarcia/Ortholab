<?php
/** Lista de materiais de uma seção (usada por Downloads e Marketing). */
if (!defined('ABSPATH')) exit;
function eapt_materiais($secao, $titulo, $sub) {
    get_header();
    eapt_faixa($titulo, $sub);
    echo '<section class="eap-conteudo"><div class="eap-wrap">';
    do_action('eapt_antes_materiais');
    $itens = [];
    $t = get_term_by('name', $secao, 'ea_secao');
    if ($t) $itens = get_posts(['post_type' => 'ea_material', 'numberposts' => -1, 'tax_query' => [['taxonomy' => 'ea_secao', 'terms' => $t->term_id]], 'orderby' => ['menu_order' => 'ASC', 'title' => 'ASC']]);
    if ($itens) {
        // agrupa pelos temas (subseções); o que não tem tema vai em "Outros materiais"
        $temas = ($t && function_exists('eap_temas_da_secao')) ? eap_temas_da_secao($t->term_id) : [];
        $grupos = [];
        foreach ($temas as $tm) $grupos[$tm->term_id] = ['nome' => $tm->name, 'itens' => []];
        $outros = [];
        foreach ($itens as $m) {
            $ids = wp_get_object_terms($m->ID, 'ea_secao', ['fields' => 'ids']);
            $achou = false;
            foreach ((array) $ids as $tid) if (isset($grupos[$tid])) { $grupos[$tid]['itens'][] = $m; $achou = true; break; }
            if (!$achou) $outros[] = $m;
        }
        $grupos = array_filter($grupos, fn($g) => $g['itens']);
        if ($outros) $grupos['outros'] = ['nome' => $grupos ? 'Outros materiais' : '', 'itens' => $outros];

        echo '<div class="eap-mat-topo">';
        echo '<input class="eap-busca" type="search" placeholder="Buscar material…" data-eap-busca-mat>';
        if (count($grupos) > 1) {
            echo '<div class="eap-filtros" data-eap-chips-mat><button type="button" class="is-ativo" data-tema="">Todos</button>';
            foreach ($grupos as $k => $g) echo '<button type="button" data-tema="' . esc_attr($k) . '">' . esc_html($g['nome']) . '</button>';
            echo '</div>';
        }
        echo '</div>';
        foreach ($grupos as $k => $g) {
            echo '<div class="eap-mat-grupo" data-eap-grupo="' . esc_attr($k) . '">';
            if ($g['nome']) echo '<h3 class="eap-mat-grupo__tit">' . esc_html($g['nome']) . ' <small>' . count($g['itens']) . '</small></h3>';
            echo '<div class="eap-materiais">';
            foreach ($g['itens'] as $m) eapt_material_item($m);
            echo '</div></div>';
        }
    } else {
        // ainda sem cadastro: mostra a página antiga
        while (have_posts()) { the_post(); the_content(); }
    }
    echo '</div></section>';
    get_footer();
}

function eapt_material_item($m) {
    $url = get_post_meta($m->ID, '_eap_arquivo', true);
    $ext = strtoupper(pathinfo(parse_url($url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION)) ?: 'LINK';
    if (strlen($ext) > 4) $ext = 'LINK';
    $tam = function_exists('eap_tamanho_arquivo') ? eap_tamanho_arquivo($url) : '';
    echo '<a class="eap-material" href="' . esc_url($url) . '" target="_blank" rel="noopener" data-eap-mat>';
    echo '<span class="eap-material__tipo eap-tipo-' . esc_attr(strtolower($ext)) . '">' . esc_html($ext) . '</span>';
    echo '<span class="eap-material__txt"><strong>' . esc_html(get_the_title($m)) . '</strong>';
    if ($m->post_excerpt || $tam) echo '<em>' . esc_html(trim($m->post_excerpt . ($m->post_excerpt && $tam ? ' · ' : '') . $tam)) . '</em>';
    echo '</span><span class="eap-material__baixar">' . eapt_icone('download') . 'Baixar</span></a>';
}
