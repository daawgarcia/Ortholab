<?php
/** Tela inicial = login do credenciado. */
if (!defined('ABSPATH')) exit;
get_header();
$erro = $_GET['login'] ?? '';
$redirect = isset($_GET['redirect_to']) ? esc_url_raw(wp_unslash($_GET['redirect_to'])) : home_url('/area-do-credenciado/');
?>
<div class="eap-login">
  <section class="eap-login__marca">
    <div class="eap-login__marca-in">
      <img class="eap-login__logo" src="<?php echo esc_url(EAPT_LOGO); ?>" alt="Esthetic Aligner">
      <h1>Portal do<br>Credenciado</h1>
      <p>Vídeo aulas, materiais, simuladores com inteligência artificial e o Ortholab, tudo em um só lugar.</p>
      <ul>
        <li><?php echo eapt_icone('play'); ?>Curso do credenciado e webinars</li>
        <li><?php echo eapt_icone('calc'); ?>Estimativa de tratamento com IA</li>
        <li><?php echo eapt_icone('download'); ?>Downloads e marketing</li>
      </ul>
    </div>
  </section>
  <section class="eap-login__form">
    <div class="eap-login__caixa">
      <img class="eap-login__logo-m" src="<?php echo esc_url(EAPT_LOGO); ?>" alt="Esthetic Aligner">
      <h2>Entrar</h2>
      <p class="eap-login__sub">Use o mesmo e-mail e senha de sempre.</p>
      <?php if ($erro === 'erro') : ?><div class="eap-alerta">E-mail ou senha incorretos. Tente de novo.</div><?php endif; ?>
      <?php if ($erro === 'bloqueado') : ?><div class="eap-alerta">Muitas tentativas com senha errada. Por segurança, o acesso foi pausado por 15 minutos. Se esqueceu a senha, use “Esqueci minha senha”.</div><?php endif; ?>
      <?php if ($erro === 'link-enviado') : ?><div class="eap-alerta eap-alerta--ok">Se o e-mail estiver cadastrado, você vai receber em instantes um link para criar uma nova senha. Confira também a caixa de spam.</div><?php endif; ?>
      <?php if ($erro === 'vazio') : ?><div class="eap-alerta">Preencha o e-mail e a senha.</div><?php endif; ?>
      <?php if ($erro === 'sso-expirado') : ?><div class="eap-alerta">O link de acesso expirou. Entre com seu e-mail e senha.</div><?php endif; ?>
      <?php if ($erro === 'sso-nao-encontrado') : ?><div class="eap-alerta">Não encontramos seu cadastro no portal pelo e-mail, CPF ou CRO. Entre com seu e-mail e senha ou fale com o suporte.</div><?php endif; ?>
      <form method="post" action="<?php echo esc_url(site_url('wp-login.php', 'login_post')); ?>" class="eap-form">
        <input type="hidden" name="eapt_login" value="1">
        <input type="hidden" name="redirect_to" value="<?php echo esc_attr($redirect); ?>">
        <label>E-mail ou usuário<input type="text" name="log" autocomplete="username" required autofocus></label>
        <label>Senha
          <span class="eap-senha"><input type="password" name="pwd" autocomplete="current-password" required><button type="button" data-eap-ver aria-label="Mostrar senha">ver</button></span>
        </label>
        <div class="eap-form__linha">
          <label class="eap-check"><input type="checkbox" name="rememberme" value="forever" checked> Manter conectado</label>
          <a href="<?php echo esc_url(wp_lostpassword_url()); ?>">Esqueci minha senha</a>
        </div>
        <button class="eap-btn eap-btn--cheio" type="submit">Entrar no portal</button>
      </form>
      <a class="eap-btn eap-btn--linha eap-login__pac" href="<?php echo esc_url(EAPT_SITE_PACIENTE); ?>"><?php echo eapt_icone('paciente'); ?>Sou paciente</a>
    </div>
    <p class="eap-login__rodape">© <?php echo esc_html(date('Y')); ?> Esthetic Aligner</p>
  </section>
</div>
<?php get_footer();
