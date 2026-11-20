<?php
/** Clube de vantagens: parceiros cadastrados no admin (Portal do Credenciado › Clube de vantagens). */
if (!defined('ABSPATH')) exit;
get_header();
eapt_faixa('Clube de vantagens', 'Condições exclusivas para credenciados Esthetic Aligner com empresas parceiras.');
$parc = post_type_exists('ea_parceiro') ? get_posts(['post_type' => 'ea_parceiro', 'numberposts' => -1, 'orderby' => ['menu_order' => 'ASC', 'title' => 'ASC']]) : [];
$cats = taxonomy_exists('ea_parc_cat') ? get_terms(['taxonomy' => 'ea_parc_cat', 'hide_empty' => true]) : [];
?>
<section class="eap-conteudo eap-conteudo--app"><div class="eap-wrap">
<?php if (!$parc) : ?>
  <div class="eap-vazio">Os parceiros do clube serão publicados em breve.</div>
<?php else : ?>
  <div class="eap-clube-topo">
    <input class="eap-busca eap-busca--larga" type="search" placeholder="Buscar parceiro ou benefício…" data-eap-busca-clube>
    <?php if ($cats && !is_wp_error($cats)) : ?>
      <div class="eap-filtros" data-eap-filtros>
        <button type="button" class="is-ativo" data-cat="">Todos</button>
        <?php foreach ($cats as $c) : ?><button type="button" data-cat="<?php echo esc_attr($c->slug); ?>"><?php echo esc_html($c->name); ?></button><?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
  <div class="eap-clube">
    <?php foreach ($parc as $p) :
      $logo = eap_parceiro_logo($p->ID);
      $link = get_post_meta($p->ID, '_eap_link', true);
      $bot = get_post_meta($p->ID, '_eap_botao', true) ?: 'Ir para o site';
      $dest = get_post_meta($p->ID, '_eap_destaque', true);
      $cupom = get_post_meta($p->ID, '_eap_cupom', true);
      $tc = wp_get_post_terms($p->ID, 'ea_parc_cat', ['fields' => 'slugs']);
      ?>
      <article class="eap-parceiro" data-eap-parc data-cats="<?php echo esc_attr(is_array($tc) ? implode(' ', $tc) : ''); ?>">
        <div class="eap-parceiro__logo"><?php if ($logo) : ?><img src="<?php echo esc_url($logo); ?>" alt="<?php echo esc_attr(get_the_title($p)); ?>" loading="lazy"><?php else : ?><span><?php echo esc_html(get_the_title($p)); ?></span><?php endif; ?>
          <?php if ($dest) : ?><b class="eap-parceiro__selo"><?php echo esc_html($dest); ?></b><?php endif; ?>
        </div>
        <div class="eap-parceiro__txt">
          <strong><?php echo esc_html(get_the_title($p)); ?></strong>
          <?php if ($p->post_excerpt) echo '<p>' . esc_html($p->post_excerpt) . '</p>'; ?>
          <?php if ($cupom) : ?><button type="button" class="eap-cupom" data-eap-copiar="<?php echo esc_attr($cupom); ?>">Cupom <b><?php echo esc_html($cupom); ?></b> <small>copiar</small></button><?php endif; ?>
        </div>
        <?php if ($link) : ?><a class="eap-btn eap-btn--linha" href="<?php echo esc_url($link); ?>" target="_blank" rel="noopener"><?php echo esc_html($bot); ?> →</a><?php endif; ?>
      </article>
    <?php endforeach; ?>
  </div>
  <p class="eap-clube-nota">Quer indicar uma empresa para o clube? Fale com o <a href="<?php echo esc_url(home_url('/suporte/')); ?>">suporte</a>.</p>
<?php endif; ?>
</div></section>
<?php get_footer();
