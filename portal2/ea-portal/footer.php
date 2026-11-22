<?php if (!defined('ABSPATH')) exit; ?>
</main>
<?php if (!is_front_page()) : ?>
<footer class="eap-rodape">
  <div class="eap-wrap eap-rodape__in">
    <img src="<?php echo esc_url(EAPT_LOGO); ?>" alt="Esthetic Aligner">
    <p>© <?php echo esc_html(date('Y')); ?> Esthetic Aligner · Portal do Credenciado</p>
    <nav>
      <a href="https://www.instagram.com/estheticaligner/" target="_blank" rel="noopener">Instagram</a>
      <a href="https://www.facebook.com/estheticaligner/" target="_blank" rel="noopener">Facebook</a>
      <a href="https://www.youtube.com/user/EstheticAligner" target="_blank" rel="noopener">YouTube</a>
      <?php if (is_user_logged_in()) : ?><a href="#" data-eap-app-link>📱 Instalar no celular</a><?php endif; ?>
      <a href="<?php echo esc_url(home_url('/cookies-e-anuncios/')); ?>">Privacidade</a>
    </nav>
  </div>
</footer>
<?php endif; ?>
<?php wp_footer(); ?>
</body>
</html>
