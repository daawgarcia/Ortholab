<?php
/** Agenda de cursos: destaque do próximo curso + cartões, filtro por formato e cursos que já aconteceram. */
if (!defined('ABSPATH')) exit;
get_header();
$ag = function_exists('eap_ag_cursos') ? eap_ag_cursos() : ['proximos' => [], 'passados' => []];
$prox = $ag['proximos'];
$dest = null;
foreach ($prox as $p) if (eap_ag_meta($p->ID)['destaque']) { $dest = $p; break; }
if (!$dest && $prox) $dest = $prox[0];
$resto = array_values(array_filter($prox, fn($p) => $p !== $dest));
$tem_online = $tem_pres = false;
foreach ($prox as $p) { $mo = eap_ag_meta($p->ID)['mod']; if ($mo !== 'presencial') $tem_online = true; if ($mo !== 'online') $tem_pres = true; }
$wa_geral = 'https://wa.me/5511951461804?text=' . rawurlencode('Olá! Quero saber dos próximos cursos da Esthetic Aligner.');

$ic = [
  'cal'  => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7Zm-2 7h14v10H5V9Z"/></svg>',
  'hora' => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1 3v6l5 3 1-1.6-4-2.4V7h-2Z"/></svg>',
  'pin'  => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>',
  'tela' => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-6v2h3v2H7v-2h3v-2H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v9h14V6H5Z"/></svg>',
  'quem' => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5Z"/></svg>',
];

$cartao = function ($p, $grande = false) use ($ic) {
  $m = eap_ag_meta($p->ID);
  $img = get_the_post_thumbnail_url($p, $grande ? 'large' : 'medium_large');
  $link = eap_ag_link($m, get_the_title($p));
  $esg = $m['status'] === 'esgotado'; $breve = $m['status'] === 'breve';
  $onde = $m['mod'] === 'online' ? ($m['local'] ? 'Online · ' . $m['local'] : 'Online') : trim($m['local'] . ($m['local'] && $m['cidade'] ? ' · ' : '') . $m['cidade']);
  $dias = $m['data'] ? (int) floor((strtotime($m['data']) - strtotime(wp_date('Y-m-d'))) / DAY_IN_SECONDS) : null;
  $falta = $dias === null ? '' : ($dias <= 0 ? 'É hoje!' : ($dias === 1 ? 'É amanhã!' : 'Faltam ' . $dias . ' dias'));
  $desc = trim(wp_strip_all_tags(apply_filters('the_content', $p->post_content)));
  ob_start(); ?>
  <article class="eap-ag-card<?php echo $grande ? ' eap-ag-card--dest' : ''; ?>" data-eap-ag-mod="<?php echo esc_attr($m['mod']); ?>">
    <div class="eap-ag-card__img">
      <?php if ($img) : ?><img src="<?php echo esc_url($img); ?>" alt="<?php echo esc_attr(get_the_title($p)); ?>" loading="lazy"><?php else : ?><span class="eap-ag-card__sem"><?php echo $ic['cal']; ?></span><?php endif; ?>
      <?php if ($m['data']) : ?><span class="eap-ag-data"><b><?php echo eap_ag_dia($m['data']); ?></b><i><?php echo esc_html(eap_ag_mes_curto($m['data'])); ?></i></span><?php endif; ?>
    </div>
    <div class="eap-ag-card__corpo">
      <div class="eap-ag-card__tags">
        <span class="eap-ag-tag eap-ag-tag--<?php echo esc_attr($m['mod']); ?>"><?php echo esc_html(EAP_AG_MOD[$m['mod']] ?? ''); ?></span>
        <span class="eap-ag-tag eap-ag-tag--<?php echo esc_attr($m['status']); ?>"><?php echo esc_html(EAP_AG_STATUS[$m['status']] ?? ''); ?></span>
        <?php if ($grande && $falta) : ?><span class="eap-ag-falta"><?php echo esc_html($falta); ?></span><?php endif; ?>
      </div>
      <h3><?php echo esc_html(get_the_title($p)); ?></h3>
      <ul class="eap-ag-info">
        <?php if ($m['data']) : ?><li><?php echo $ic['cal']; ?><span><?php echo esc_html(ucfirst(eap_ag_data_longa($m))); ?></span></li><?php endif; ?>
        <?php if ($m['hi']) : ?><li><?php echo $ic['hora']; ?><span><?php echo esc_html(ucfirst(eap_ag_horario($m))); ?></span></li><?php endif; ?>
        <?php if ($onde) : ?><li><?php echo $m['mod'] === 'online' ? $ic['tela'] : $ic['pin']; ?><span><?php echo esc_html($onde); ?></span></li><?php endif; ?>
        <?php if ($m['quem']) : ?><li><?php echo $ic['quem']; ?><span><?php echo esc_html($m['quem']); ?></span></li><?php endif; ?>
      </ul>
      <?php if ($desc) : ?><p class="eap-ag-desc"><?php echo esc_html($grande ? wp_trim_words($desc, 60) : wp_trim_words($desc, 26)); ?></p><?php endif; ?>
      <div class="eap-ag-acoes">
        <?php if ($esg) : ?><span class="eap-btn eap-btn--linha is-off">Vagas esgotadas</span>
        <?php elseif ($breve || !$link) : ?><span class="eap-btn eap-btn--linha is-off">Inscrições em breve</span>
        <?php else : ?><a class="eap-btn eap-btn--cheio" href="<?php echo esc_url($link); ?>" target="_blank" rel="noopener" data-eap-ag-insc="<?php echo (int) $p->ID; ?>"><?php echo esc_html($m['btn'] ?: 'Inscreva-se'); ?></a><?php endif; ?>
        <?php if ($g = eap_ag_gcal($p, $m)) : ?><a class="eap-ag-agenda" href="<?php echo esc_url($g); ?>" target="_blank" rel="noopener">+ Adicionar à minha agenda</a><?php endif; ?>
      </div>
    </div>
  </article>
  <?php return ob_get_clean();
};
?>
<section class="eap-faixa eap-ag-topo"><div class="eap-wrap">
  <h1>Agenda de cursos</h1>
  <p>Masterclasses, cursos presenciais e webinars da Esthetic Aligner. Escolha a data e garanta a sua vaga.</p>
</div></section>

<section class="eap-conteudo eap-ag"><div class="eap-wrap">
<?php if (!$prox) : ?>
  <div class="eap-ag-vazio">
    <span class="eap-ag-vazio__ic"><?php echo $ic['cal']; ?></span>
    <h2>Novas datas em breve</h2>
    <p>Estamos preparando os próximos cursos. Enquanto isso, as aulas do portal estão liberadas para você assistir quando quiser.</p>
    <div class="eap-ag-acoes"><a class="eap-btn eap-btn--cheio" href="<?php echo esc_url(home_url('/video-aulas/')); ?>">Ver vídeo aulas</a><a class="eap-btn eap-btn--linha" href="<?php echo esc_url($wa_geral); ?>" target="_blank" rel="noopener" data-eap-whats="agenda">Avise-me das próximas datas</a></div>
  </div>
<?php else : ?>
  <div class="eap-ag-rotulo">Próximo curso</div>
  <?php echo $cartao($dest, true); ?>

  <?php if ($resto) : ?>
    <div class="eap-ag-cab">
      <h2>Próximas datas</h2>
      <?php if ($tem_online && $tem_pres) : ?>
      <div class="eap-ag-filtro" role="group" aria-label="Filtrar por formato">
        <button type="button" class="is-ativo" data-eap-ag-f="">Todos</button>
        <button type="button" data-eap-ag-f="presencial">Presenciais</button>
        <button type="button" data-eap-ag-f="online">Online</button>
      </div>
      <?php endif; ?>
    </div>
    <div class="eap-ag-grade"><?php foreach ($resto as $p) echo $cartao($p); ?></div>
    <p class="eap-ag-nada" hidden>Nenhum curso neste formato por enquanto.</p>
  <?php endif; ?>
<?php endif; ?>

  <div class="eap-ag-cta">
    <div><strong>Quer um curso na sua cidade ou tem dúvidas sobre as inscrições?</strong><span>Fale com a equipe da Esthetic Aligner pelo WhatsApp.</span></div>
    <a class="eap-btn eap-btn--branco" href="<?php echo esc_url($wa_geral); ?>" target="_blank" rel="noopener" data-eap-whats="agenda">Falar no WhatsApp</a>
  </div>

<?php if ($ag['passados']) : ?>
  <details class="eap-ag-pass">
    <summary>Cursos que já aconteceram</summary>
    <ul>
      <?php foreach ($ag['passados'] as $p) : $m = eap_ag_meta($p->ID); ?>
        <li><span><?php echo esc_html($m['data'] ? date('d/m/Y', strtotime($m['data'])) : ''); ?></span><?php echo esc_html(get_the_title($p)); ?><em><?php echo esc_html(EAP_AG_MOD[$m['mod']] ?? ''); ?><?php echo $m['cidade'] ? ' · ' . esc_html($m['cidade']) : ''; ?></em></li>
      <?php endforeach; ?>
    </ul>
  </details>
<?php endif; ?>
<?php if (current_user_can('edit_pages')) : ?>
  <p class="eap-ag-equipe"><a href="<?php echo esc_url(admin_url('post-new.php?post_type=ea_curso')); ?>">+ Adicionar curso</a> · <a href="<?php echo esc_url(admin_url('edit.php?post_type=ea_curso')); ?>">Editar agenda</a></p>
<?php endif; ?>
</div></section>
<script>
(function(){
  var bs=document.querySelectorAll('[data-eap-ag-f]'),nada=document.querySelector('.eap-ag-nada');
  bs.forEach(function(b){b.addEventListener('click',function(){
    var f=b.getAttribute('data-eap-ag-f'),n=0;
    bs.forEach(function(x){x.classList.toggle('is-ativo',x===b);});
    document.querySelectorAll('.eap-ag-grade .eap-ag-card').forEach(function(c){var m=c.getAttribute('data-eap-ag-mod'),ok=!f||m===f||m==='hibrido';c.hidden=!ok;if(ok)n++;});
    if(nada)nada.hidden=n>0;
  });});
  document.addEventListener('click',function(e){var a=e.target.closest('[data-eap-ag-insc]');if(a&&window.eapEvento)window.eapEvento('agenda',a.getAttribute('data-eap-ag-insc'));});
})();
</script>
<?php get_footer();
