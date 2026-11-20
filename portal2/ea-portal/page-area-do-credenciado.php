<?php
/** Área do Credenciado: painel inicial. */
if (!defined('ABSPATH')) exit;
get_header();
$u = wp_get_current_user();
$nome = trim($u->first_name) ?: $u->display_name;
?>
<section class="eap-boasvindas">
  <div class="eap-wrap">
    <p class="eap-boasvindas__oi">Olá, <?php echo esc_html($nome); ?> 👋</p>
    <h1>Área do Credenciado</h1>
    <p>Tudo o que você precisa para trabalhar com Esthetic Aligner.</p>
  </div>
</section>

<section class="eap-wrap eap-ia">
  <div class="eap-ia__tag"><span></span>Powered by AI</div>
  <div class="eap-ia__grid">
    <a class="eap-ia__card" href="<?php echo esc_url(home_url('/simulador-de-estimativa-e-pacote/')); ?>">
      <span class="eap-ia__ic"><?php echo eapt_icone('calc'); ?></span>
      <span class="eap-ia__txt"><strong>Estimativa e pacote – Alinhadores</strong>
        <em>Selecione os objetivos do tratamento e receba a estimativa e o pacote indicado.</em></span>
      <span class="eap-seta">→</span>
    </a>
    <a class="eap-ia__card eap-ia__card--air" href="<?php echo esc_url(home_url('/indicacao-de-uso-ea-air/')); ?>">
      <span class="eap-ia__ic"><?php echo eapt_icone('sono'); ?></span>
      <span class="eap-ia__txt"><strong>Prognóstico ronco e apneia – EA AIR</strong>
        <em>Responda às perguntas e receba o prognóstico do paciente.</em></span>
      <span class="eap-seta">→</span>
    </a>
  </div>
</section>

<section class="eap-wrap eap-atalhos">
  <?php foreach (eapt_atalhos() as $a) : [$tit, $desc, $url, $ic] = $a; $ext = !empty($a[4]); ?>
    <a class="eap-atalho" href="<?php echo esc_url($url); ?>"<?php echo $ext ? ' target="_blank" rel="noopener"' : ''; ?>>
      <span class="eap-atalho__ic"><?php echo eapt_icone($ic); ?></span>
      <strong><?php echo esc_html($tit); ?><?php echo $ext ? ' <small>↗</small>' : ''; ?></strong>
      <em><?php echo esc_html($desc); ?></em>
    </a>
  <?php endforeach; ?>
</section>

<?php if (function_exists('eap_aulas_por_trilha')) :
  $novas = get_posts(['post_type' => 'ea_aula', 'numberposts' => 4, 'orderby' => 'date', 'order' => 'DESC']);
  if ($novas) : ?>
<section class="eap-wrap eap-novas">
  <div class="eap-sec-tit"><h2>Aulas mais recentes</h2><a href="<?php echo esc_url(home_url('/video-aulas/')); ?>">Ver todas →</a></div>
  <div class="eap-cards-aula">
    <?php foreach ($novas as $a) : $capa = eap_video_capa($a->ID); ?>
      <a class="eap-card-aula" href="<?php echo esc_url(add_query_arg('aula', $a->ID, home_url('/video-aulas/'))); ?>">
        <span class="eap-card-aula__capa"<?php echo $capa ? ' style="background-image:url(' . esc_url($capa) . ')"' : ''; ?>><i>▶</i></span>
        <strong><?php echo esc_html(get_the_title($a)); ?></strong>
        <?php $t = get_the_terms($a, 'ea_trilha'); if ($t && !is_wp_error($t)) echo '<em>' . esc_html($t[0]->name) . '</em>'; ?>
      </a>
    <?php endforeach; ?>
  </div>
</section>
<?php endif; endif; ?>
<?php get_footer();
