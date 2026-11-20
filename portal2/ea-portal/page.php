<?php
/** Páginas internas (conteúdo atual dentro do layout novo). */
if (!defined('ABSPATH')) exit;
get_header();
// páginas-aplicativo (simuladores com IA): título curto e sem a "caixa" branca, porque já têm o próprio cartão
$apps = [
    'simulador-de-estimativa-e-pacote' => ['Estimativa e pacote – Alinhadores', 'Powered by AI · selecione os objetivos do tratamento e receba a estimativa e o pacote indicado.'],
    'indicacao-de-uso-ea-air' => ['Prognóstico ronco e apneia – EA AIR', 'Powered by AI · responda às perguntas e receba o prognóstico do paciente.'],
    'simulador-ia' => ['Simulador IA', 'Powered by AI'],
    'calculadora-de-lucro' => ['Calculadora de lucro', ''],
];
while (have_posts()) : the_post();
  $slug = get_post_field('post_name');
  $app = $apps[$slug] ?? null;
  eapt_faixa($app ? $app[0] : get_the_title(), $app ? $app[1] : '');
  echo '<section class="eap-conteudo' . ($app ? ' eap-conteudo--app' : '') . '"><div class="eap-wrap">';
  the_content();
  echo '</div></section>';
endwhile;
get_footer();
