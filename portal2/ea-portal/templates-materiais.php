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
        echo '<input class="eap-busca eap-busca--larga" type="search" placeholder="Buscar material…" data-eap-busca-mat>';
        echo '<div class="eap-materiais">';
        foreach ($itens as $m) {
            $url = get_post_meta($m->ID, '_eap_arquivo', true);
            $ext = strtoupper(pathinfo(parse_url($url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION)) ?: 'LINK';
            $tam = function_exists('eap_tamanho_arquivo') ? eap_tamanho_arquivo($url) : '';
            echo '<a class="eap-material" href="' . esc_url($url) . '" target="_blank" rel="noopener" data-eap-mat>';
            echo '<span class="eap-material__tipo eap-tipo-' . esc_attr(strtolower($ext)) . '">' . esc_html($ext) . '</span>';
            echo '<span class="eap-material__txt"><strong>' . esc_html(get_the_title($m)) . '</strong>';
            if ($m->post_excerpt || $tam) echo '<em>' . esc_html(trim($m->post_excerpt . ($m->post_excerpt && $tam ? ' · ' : '') . $tam)) . '</em>';
            echo '</span><span class="eap-material__baixar">' . eapt_icone('download') . 'Baixar</span></a>';
        }
        echo '</div>';
    } else {
        // ainda sem cadastro: mostra a página antiga
        while (have_posts()) { the_post(); the_content(); }
    }
    echo '</div></section>';
    get_footer();
}
