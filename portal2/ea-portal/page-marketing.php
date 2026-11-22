<?php
/** Marketing: posts prontos para as redes (em destaque) + materiais para baixar. */
if (!defined('ABSPATH')) exit;
require get_stylesheet_directory() . '/templates-materiais.php';
add_action('eapt_antes_materiais', function () {
    $posts = post_type_exists('ea_post') ? get_posts(['post_type' => 'ea_post', 'numberposts' => 24, 'orderby' => ['menu_order' => 'ASC', 'date' => 'DESC']]) : [];
    if (!$posts || !eapt_visivel('posts-marketing')) return;
    echo '<div class="eap-sec-tit"><h2>Posts prontos para suas redes</h2><span>Clique para ver, copiar a legenda e baixar</span></div><div class="eap-posts">';
    foreach ($posts as $p) {
        $img = eapt_thumb_url($p->ID, 'large');
        $full = eapt_thumb_url($p->ID, 'full');
        if (!$img) continue;
        echo '<div role="button" tabindex="0" class="eap-post-card" data-eap-post data-id="' . (int) $p->ID . '" data-img="' . esc_url($full) . '" data-titulo="' . esc_attr(get_the_title($p)) . '" data-legenda="' . esc_attr($p->post_excerpt) . '">';
        echo eapt_novo($p, 'eap-novo--canto') . '<img src="' . esc_url($img) . '" alt="' . esc_attr(get_the_title($p)) . '" loading="lazy"></div>';
    }
    echo '</div>';
    eapt_modal_post();
    echo '<div class="eap-sec-tit eap-sec-tit--mat"><h2>Materiais para baixar</h2></div>';
});
eapt_materiais('Marketing', 'Marketing', 'Posts, folders, vídeos e logotipo para divulgar o tratamento com Esthetic Aligner.');
