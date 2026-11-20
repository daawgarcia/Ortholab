<?php
if (!defined('ABSPATH')) exit;
get_header();
eapt_faixa(get_the_archive_title() ?: get_bloginfo('name'));
echo '<section class="eap-conteudo"><div class="eap-wrap">';
while (have_posts()) { the_post(); echo '<article class="eap-post"><h2><a href="' . esc_url(get_permalink()) . '">' . esc_html(get_the_title()) . '</a></h2>'; the_excerpt(); echo '</article>'; }
echo '</div></section>';
get_footer();
