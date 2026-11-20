<?php
/** Suporte ao credenciado: canais de WhatsApp, perguntas frequentes e formulário. */
if (!defined('ABSPATH')) exit;
get_header();
$cfg = function_exists('eap_suporte_cfg') ? eap_suporte_cfg() : ['canais' => [], 'form' => '1952', 'faq_cat' => 'duvidas-doutores'];
eapt_faixa('Suporte ao credenciado', 'Fale com a equipe certa pelo WhatsApp ou envie sua dúvida. Nossa equipe de ortodontistas terá prazer em ajudar.');
$ics = ['suporte', 'lab', 'fin', 'play', 'dica', 'mkt'];
?>
<section class="eap-wrap eap-canais">
  <?php foreach ($cfg['canais'] as $i => $c) : $wa = eap_whats_link($c['whats']); ?>
    <div class="eap-canal">
      <span class="eap-atalho__ic"><?php echo eapt_icone($ics[$i % count($ics)]); ?></span>
      <strong><?php echo esc_html($c['titulo']); ?></strong>
      <em><?php echo esc_html($c['texto']); ?></em>
      <?php if ($wa) : ?>
        <a class="eap-btn eap-btn--whats" href="<?php echo esc_url($wa); ?>" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg>
          <?php echo esc_html($c['whats']); ?>
        </a>
      <?php endif; ?>
    </div>
  <?php endforeach; ?>
</section>

<section class="eap-wrap eap-suporte">
  <div class="eap-suporte__faq">
    <h2>Perguntas frequentes</h2>
    <input class="eap-busca" type="search" placeholder="Buscar pergunta…" data-eap-busca-faq>
    <?php
    $args = ['post_type' => 'faq', 'numberposts' => 60, 'orderby' => 'title', 'order' => 'ASC'];
    if (!empty($cfg['faq_cat']) && taxonomy_exists('faq_category')) $args['tax_query'] = [['taxonomy' => 'faq_category', 'field' => 'slug', 'terms' => $cfg['faq_cat']]];
    $faqs = post_type_exists('faq') ? get_posts($args) : [];
    if ($faqs) :
      foreach ($faqs as $f) : ?>
        <details class="eap-faq" data-eap-faq>
          <summary><?php echo esc_html(get_the_title($f)); ?></summary>
          <div class="eap-faq__r"><?php echo wp_kses_post(wpautop(do_shortcode($f->post_content))); ?></div>
        </details>
      <?php endforeach;
    else : ?>
      <p class="eap-vazio">Nenhuma pergunta cadastrada ainda.</p>
    <?php endif; ?>
  </div>
  <aside class="eap-suporte__form">
    <h2>Envie sua dúvida</h2>
    <p>Responderemos pelo e-mail informado.</p>
    <?php echo do_shortcode('[contact-form-7 id="' . esc_attr($cfg['form']) . '"]'); ?>
  </aside>
</section>
<?php get_footer();
