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

<?php if (function_exists('eap_passos') && eapt_visivel('primeiros-passos') && !get_user_meta(get_current_user_id(), 'eap_passos_ocultos', true)) :
  $ps = eap_passos(); $feitos = count(array_filter($ps, fn($p) => $p[3])); $tot = count($ps);
  if ($tot && $feitos < $tot) : ?>
<section class="eap-wrap">
  <div class="eap-passos" data-eap-passos>
    <div class="eap-passos__topo">
      <div><strong>Primeiros passos no portal</strong><span><?php echo (int) $feitos; ?> de <?php echo (int) $tot; ?> concluídos</span></div>
      <div class="eap-passos__barra"><i style="width:<?php echo round($feitos * 100 / $tot); ?>%"></i></div>
      <button type="button" class="eap-passos__x" data-eap-passos-ocultar data-n="<?php echo esc_attr(wp_create_nonce('eap_ferr')); ?>" title="Não mostrar mais">Ocultar</button>
    </div>
    <ol class="eap-passos__lista">
      <?php foreach ($ps as $k => [$tit, $desc, $url, $ok]) : ?>
        <li class="<?php echo $ok ? 'is-ok' : ''; ?>"><a href="<?php echo esc_url($url); ?>"<?php echo $k === 'app' ? ' data-eap-app-link' : ''; ?><?php echo $k === 'caso' ? ' target="_blank" rel="noopener"' : ''; ?>><i><?php echo $ok ? '✓' : ''; ?></i><span><b><?php echo esc_html($tit); ?></b><em><?php echo esc_html($desc); ?></em></span></a></li>
      <?php endforeach; ?>
    </ol>
  </div>
</section>
<script>(function(){var b=document.querySelector('[data-eap-passos-ocultar]');if(!b)return;b.addEventListener('click',function(){var f=new FormData();f.append('action','eap_passos_ocultar');f.append('_n',b.getAttribute('data-n'));fetch('<?php echo esc_url(admin_url('admin-ajax.php')); ?>',{method:'POST',body:f,credentials:'same-origin'});document.querySelector('[data-eap-passos]').closest('section').remove();});})();</script>
<?php endif; endif; ?>

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

<?php if (function_exists('eap_curso_concluido') && eap_curso_concluido() && eapt_visivel('video-aulas')) : ?><section class="eap-wrap"><?php eapt_cert_faixa('eap-cert-faixa--inicio'); ?></section><?php endif; ?>
<?php $cont = (eapt_visivel('continuar') && eapt_visivel('video-aulas')) ? eapt_ultima_aula() : null; $ult = $cont ? $cont['aula'] : null; if ($ult) :
  $capa = function_exists('eap_video_capa') ? eap_video_capa($ult->ID) : ''; $tt = get_the_terms($ult, 'ea_trilha'); ?>
<section class="eap-wrap">
  <a class="eap-continuar" href="<?php echo esc_url(add_query_arg('aula', $ult->ID, home_url('/video-aulas/'))); ?>">
    <span class="eap-continuar__capa"<?php echo $capa ? ' style="background-image:url(' . esc_url($capa) . ')"' : ''; ?>><i>▶</i></span>
    <span class="eap-continuar__txt"><small><?php echo esc_html($cont['rotulo']); ?></small><strong><?php echo esc_html(get_the_title($ult)); ?></strong><?php if ($tt && !is_wp_error($tt)) echo '<em>' . esc_html($tt[0]->name) . '</em>'; ?></span>
    <span class="eap-btn eap-btn--cheio">Continuar →</span>
  </a>
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
