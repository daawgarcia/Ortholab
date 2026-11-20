<?php
/** Vídeo aulas: player + lista por categoria (estilo plataforma de curso). */
if (!defined('ABSPATH')) exit;
get_header();
$grupos = function_exists('eap_aulas_por_trilha') ? eap_aulas_por_trilha() : [];
$todas = [];
foreach ($grupos as $g) foreach ($g['aulas'] as $a) $todas[] = $a;
$atual = null;
if (!empty($_GET['aula'])) { $p = get_post((int) $_GET['aula']); if ($p && $p->post_type === 'ea_aula' && $p->post_status === 'publish') $atual = $p; }
if (!$atual && $todas) $atual = $todas[0];
$trilha_atual = $atual ? (wp_get_post_terms($atual->ID, 'ea_trilha', ['fields' => 'ids'])[0] ?? 0) : 0;
$idx = $atual ? array_search($atual->ID, array_map(fn($a) => $a->ID, $todas), true) : false;
$ant = ($idx !== false && $idx > 0) ? $todas[$idx - 1] : null;
$prox = ($idx !== false && $idx < count($todas) - 1) ? $todas[$idx + 1] : null;
$link = fn($a) => add_query_arg('aula', $a->ID, get_permalink());
?>
<section class="eap-faixa eap-faixa--fina"><div class="eap-wrap"><h1>Vídeo aulas</h1><p>Curso do credenciado, webinars, mentorias, dicas clínicas e podcast.</p></div></section>

<?php if (!$atual) : ?>
  <section class="eap-conteudo"><div class="eap-wrap"><div class="eap-vazio">Ainda não há aulas cadastradas.<?php if (current_user_can('edit_pages')) echo ' <a href="' . esc_url(admin_url('admin.php?page=eap-importar')) . '">Importar as aulas do portal antigo</a>.'; ?></div></div></section>
<?php else : ?>
<section class="eap-wrap eap-curso" data-eap-curso>
  <div class="eap-curso__player">
    <div class="eap-video"><?php echo eap_video_embed(get_post_meta($atual->ID, '_eap_video', true)); ?></div>
    <div class="eap-curso__info">
      <div>
        <?php $tt = get_the_terms($atual, 'ea_trilha'); if ($tt && !is_wp_error($tt)) echo '<span class="eap-chip">' . esc_html($tt[0]->name) . '</span>'; ?>
        <h2><?php echo esc_html(get_the_title($atual)); ?></h2>
        <?php if ($atual->post_excerpt) echo '<p>' . esc_html($atual->post_excerpt) . '</p>'; ?>
      </div>
      <label class="eap-check eap-feito"><input type="checkbox" data-eap-feito="<?php echo (int) $atual->ID; ?>"> Marcar como assistida</label>
    </div>
    <div class="eap-curso__nav">
      <?php if ($ant) : ?><a class="eap-btn eap-btn--linha" href="<?php echo esc_url($link($ant)); ?>">← Anterior</a><?php else : ?><span></span><?php endif; ?>
      <?php if ($prox) : ?><a class="eap-btn eap-btn--cheio" href="<?php echo esc_url($link($prox)); ?>">Próxima aula →</a><?php endif; ?>
    </div>
  </div>
  <aside class="eap-curso__lista">
    <input class="eap-busca" type="search" placeholder="Buscar aula…" data-eap-busca>
    <?php foreach ($grupos as $g) : $aberta = (int) $g['trilha']->term_id === (int) $trilha_atual; ?>
      <details class="eap-trilha"<?php echo $aberta ? ' open' : ''; ?>>
        <summary><span><?php echo esc_html($g['trilha']->name); ?></span><small data-eap-prog="<?php echo esc_attr(implode(',', array_map(fn($a) => $a->ID, $g['aulas']))); ?>"><?php echo count($g['aulas']); ?> aulas</small></summary>
        <ol>
          <?php foreach ($g['aulas'] as $a) : $dur = get_post_meta($a->ID, '_eap_duracao', true); ?>
            <li class="<?php echo $a->ID === $atual->ID ? 'is-atual' : ''; ?>" data-eap-item="<?php echo (int) $a->ID; ?>">
              <a href="<?php echo esc_url($link($a)); ?>"><i class="eap-ok"></i><span><?php echo esc_html(get_the_title($a)); ?></span><?php echo $dur ? '<small>' . esc_html($dur) . '</small>' : ''; ?></a>
            </li>
          <?php endforeach; ?>
        </ol>
      </details>
    <?php endforeach; ?>
  </aside>
</section>
<?php endif; ?>
<?php get_footer();
