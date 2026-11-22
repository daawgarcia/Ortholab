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
    <?php if (isset($_GET['dados'])) : ?><p class="eap-ok-msg">✓ Dados confirmados. Obrigado!</p><?php endif; ?>
  </div>
</section>

<?php $ia1 = eapt_visivel('ia-estimativa'); $ia2 = eapt_visivel('ia-ronco'); if ($ia1 || $ia2) : ?>
<section class="eap-wrap eap-ia">
  <div class="eap-ia__tag"><span></span>Powered by AI</div>
  <div class="eap-ia__grid<?php echo ($ia1 && $ia2) ? '' : ' eap-ia__grid--um'; ?>">
    <?php if ($ia1) : ?><a class="eap-ia__card" href="<?php echo esc_url(home_url('/simulador-de-estimativa-e-pacote/')); ?>">
      <span class="eap-ia__ic"><?php echo eapt_icone('calc'); ?></span>
      <span class="eap-ia__txt"><strong>Estimativa e pacote – Alinhadores</strong>
        <em>Selecione os objetivos do tratamento e receba a estimativa e o pacote indicado.</em></span>
      <span class="eap-seta">→</span>
    </a><?php endif; ?>
    <?php if ($ia2) : ?><a class="eap-ia__card eap-ia__card--air" href="<?php echo esc_url(home_url('/indicacao-de-uso-ea-air/')); ?>">
      <span class="eap-ia__ic"><?php echo eapt_icone('sono'); ?></span>
      <span class="eap-ia__txt"><strong>Prognóstico ronco e apneia – EA AIR</strong>
        <em>Responda às perguntas e receba o prognóstico do paciente.</em></span>
      <span class="eap-seta">→</span>
    </a><?php endif; ?>
  </div>
</section>
<?php endif; ?>

<section class="eap-wrap eap-atalhos">
  <?php foreach (eapt_atalhos() as $a) : [$tit, $desc, $url, $ic] = $a; $ext = !empty($a[4]); ?>
    <a class="eap-atalho" href="<?php echo esc_url($url); ?>"<?php echo $ext ? ' target="_blank" rel="noopener"' : ''; ?>>
      <span class="eap-atalho__ic"><?php echo eapt_icone($ic); ?></span>
      <strong><?php echo esc_html($tit); ?><?php echo $ext ? ' <small>↗</small>' : ''; ?></strong>
      <em><?php echo esc_html($desc); ?></em>
    </a>
  <?php endforeach; ?>
</section>

<?php if (function_exists('eap_destaques_inicio') && eapt_visivel('aulas-recentes')) :
  $d = eap_destaques_inicio();
  if ($d['itens']) : ?>
<section class="eap-wrap eap-novas">
  <div class="eap-sec-tit"><h2><?php echo esc_html($d['titulo']); ?></h2><?php if ($d['link']) : ?><a href="<?php echo esc_url($d['link']); ?>">Ver todos →</a><?php endif; ?></div>
  <div class="eap-dcards<?php echo $d['modo'] === 'posts' ? ' eap-dcards--posts' : ''; ?>">
    <?php foreach ($d['itens'] as $it) eapt_card_destaque($it); ?>
  </div>
</section>
<?php eapt_modal_post(); endif; endif; ?>
<?php get_footer();
