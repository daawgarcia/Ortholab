<?php
/** Páginas internas (conteúdo atual dentro do layout novo). */
if (!defined('ABSPATH')) exit;
get_header();
while (have_posts()) : the_post();
  eapt_faixa(get_the_title());
  echo '<section class="eap-conteudo"><div class="eap-wrap">';
  the_content();
  echo '</div></section>';
endwhile;
get_footer();
