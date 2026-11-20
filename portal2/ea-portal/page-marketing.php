<?php
/** Marketing: posts prontos para as redes (em destaque) + materiais para baixar. */
if (!defined('ABSPATH')) exit;
require get_stylesheet_directory() . '/templates-materiais.php';
add_action('eapt_antes_materiais', function () {
    $posts = post_type_exists('ea_post') ? get_posts(['post_type' => 'ea_post', 'numberposts' => 24, 'orderby' => ['menu_order' => 'ASC', 'date' => 'DESC']]) : [];
    if (!$posts) return;
    echo '<div class="eap-sec-tit"><h2>Posts prontos para suas redes</h2><span>Clique para ver, copiar a legenda e baixar</span></div><div class="eap-posts">';
    foreach ($posts as $p) {
        $img = eapt_thumb_url($p->ID, 'large');
        $full = eapt_thumb_url($p->ID, 'full');
        if (!$img) continue;
        echo '<button type="button" class="eap-post-card" data-eap-post data-img="' . esc_url($full) . '" data-titulo="' . esc_attr(get_the_title($p)) . '" data-legenda="' . esc_attr($p->post_excerpt) . '">';
        echo '<img src="' . esc_url($img) . '" alt="' . esc_attr(get_the_title($p)) . '" loading="lazy"></button>';
    }
    echo '</div>';
    echo '<div class="eap-modal" data-eap-modal hidden><div class="eap-modal__caixa"><button type="button" class="eap-modal__x" data-eap-fechar aria-label="Fechar">×</button>'
        . '<img data-eap-modal-img alt=""><div class="eap-modal__lado"><strong data-eap-modal-tit></strong><p data-eap-modal-leg></p>'
        . '<div class="eap-modal__acoes"><button type="button" class="eap-btn eap-btn--linha" data-eap-copiar-leg>Copiar legenda</button>'
        . '<a class="eap-btn eap-btn--cheio" data-eap-baixar download>Baixar imagem</a></div></div></div></div>';
    echo '<div class="eap-sec-tit eap-sec-tit--mat"><h2>Materiais para baixar</h2></div>';
});
eapt_materiais('Marketing', 'Marketing', 'Posts, folders, vídeos e logotipo para divulgar o tratamento com Esthetic Aligner.');
