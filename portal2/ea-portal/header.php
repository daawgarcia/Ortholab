<?php if (!defined('ABSPATH')) exit; ?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class('eap'); ?>>
<?php wp_body_open(); ?>
<?php if (is_user_logged_in() && !is_front_page()) : $u = wp_get_current_user(); ?>
<header class="eap-topo">
  <div class="eap-wrap eap-topo__in">
    <a class="eap-logo" href="<?php echo esc_url(home_url('/area-do-credenciado/')); ?>" aria-label="Área do Credenciado">
      <img src="<?php echo esc_url(EAPT_LOGO); ?>" alt="Esthetic Aligner">
      <span>Portal do Credenciado</span>
    </a>
    <button class="eap-burger" aria-label="Abrir menu" data-eap-menu><span></span><span></span><span></span></button>
    <nav class="eap-nav" data-eap-nav>
      <?php foreach (eapt_menu() as [$rot, $url, $slug]) : ?>
        <a href="<?php echo esc_url($url); ?>"<?php echo eapt_ativo($slug) ? ' class="is-ativo"' : ''; ?><?php echo $slug === '' ? ' target="_blank" rel="noopener"' : ''; ?>><?php echo esc_html($rot); ?></a>
      <?php endforeach; ?>
      <span class="eap-nav__sep"></span>
      <a class="eap-nav__pac" href="<?php echo esc_url(EAPT_SITE_PACIENTE); ?>"><?php echo eapt_icone('paciente'); ?>Sou paciente</a>
      <a class="eap-nav__sair" href="<?php echo esc_url(wp_logout_url(home_url('/'))); ?>" title="Sair"><?php echo eapt_icone('sair'); ?><span>Sair</span></a>
    </nav>
  </div>
</header>
<?php endif; ?>
<main class="eap-main">
