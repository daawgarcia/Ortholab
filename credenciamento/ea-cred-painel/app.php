<?php
/** Casca do site de credenciamento: login, abas (Credenciamento, Agenda de cursos, Clube de vantagens). */
if (!defined('ABSPATH')) exit;
$aba = sanitize_key($_GET['aba'] ?? '');
if (!in_array($aba, ['agenda', 'clube'], true)) $aba = '';
$ok = isset($_GET['ok']) ? sanitize_text_field(wp_unslash($_GET['ok'])) : '';
$erro = isset($_GET['erro']) ? sanitize_text_field(wp_unslash($_GET['erro'])) : '';
$editar = sanitize_text_field($_GET['editar'] ?? '');
$u = wp_get_current_user();
$e = 'esc_html';
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?php echo $aba === 'agenda' ? 'Agenda de cursos · ' : ($aba === 'clube' ? 'Clube de vantagens · ' : ''); ?>Credenciamento Esthetic Aligner</title>
<?php wp_head(); ?>
</head>
<body <?php body_class('eacp'); ?>>
<header class="eacp-topo">
  <div class="eacp-wrap eacp-topo__in">
    <a class="eacp-logo" href="<?php echo esc_url(home_url('/')); ?>"><img src="<?php echo esc_url(EACP_LOGO); ?>" alt="Esthetic Aligner"><span>Credenciamento</span></a>
    <?php if (eacp_pode()) : ?>
    <nav class="eacp-nav">
      <a href="<?php echo esc_url(home_url('/')); ?>" class="<?php echo $aba === '' ? 'is-ativo' : ''; ?>">Novo credenciamento</a>
      <a href="<?php echo esc_url(add_query_arg('aba', 'agenda', home_url('/'))); ?>" class="<?php echo $aba === 'agenda' ? 'is-ativo' : ''; ?>">Agenda de cursos</a>
      <a href="<?php echo esc_url(add_query_arg('aba', 'clube', home_url('/'))); ?>" class="<?php echo $aba === 'clube' ? 'is-ativo' : ''; ?>">Clube de vantagens</a>
    </nav>
    <div class="eacp-user"><span><?php echo $e($u->first_name ?: $u->display_name); ?></span><a href="<?php echo esc_url(wp_logout_url(home_url('/'))); ?>">Sair</a></div>
    <?php endif; ?>
  </div>
</header>

<main class="eacp-main">
<?php if (!is_user_logged_in()) : ?>
  <section class="eacp-login">
    <div class="eacp-card eacp-login__card">
      <h1>Entrar</h1>
      <p>Área do time Esthetic Aligner para credenciar parceiros e atualizar a agenda e o clube.</p>
      <?php wp_login_form(['redirect' => home_url('/'), 'label_username' => 'E-mail ou usuário', 'label_password' => 'Senha', 'label_remember' => 'Manter conectado', 'label_log_in' => 'Entrar']); ?>
      <a class="eacp-esqueci" href="<?php echo esc_url(wp_lostpassword_url(home_url('/'))); ?>">Esqueci minha senha</a>
    </div>
  </section>

<?php elseif (!eacp_pode()) : ?>
  <section class="eacp-wrap eacp-vazio"><h1>Acesso restrito</h1><p>Seu usuário não tem permissão para esta área. Fale com o administrador.</p></section>

<?php elseif ($aba === '') : ?>
  <section class="eacp-faixa"><div class="eacp-wrap"><h1>Novo credenciamento</h1><p>Cadastre dentistas, dentistas estrangeiros e estudantes. O dentista recebe o acesso ao Portal do Credenciado por e-mail.</p></div></section>
  <div class="eacp-wrap eacp-cred">
    <?php while (have_posts()) { the_post(); $c = get_the_content(); echo has_shortcode($c, 'ea_partner_registration') ? do_shortcode('[ea_partner_registration]') : apply_filters('the_content', $c); } ?>
  </div>

<?php else :
  $curso = $aba === 'agenda';
  $lista = eacp_api('GET', $curso ? '/cursos' : '/parceiros');
  $opc = eacp_api('GET', '/opcoes');
  $opc = is_wp_error($opc) ? ['formatos' => ['presencial' => 'Presencial', 'online' => 'Online', 'hibrido' => 'Presencial e online'], 'situacoes' => ['abertas' => 'Inscrições abertas', 'ultimas' => 'Últimas vagas', 'breve' => 'Inscrições em breve', 'esgotado' => 'Vagas esgotadas'], 'categorias_clube' => [], 'pagina_agenda' => '', 'pagina_clube' => ''] : $opc;
  $item = [];
  if ($editar && $editar !== 'novo' && is_array($lista)) foreach ($lista as $x) if ((string) $x['id'] === $editar) $item = $x;
  $v = fn($k, $d = '') => esc_attr($item[$k] ?? $d);
  $hoje = wp_date('Y-m-d');
?>
  <section class="eacp-faixa"><div class="eacp-wrap eacp-faixa__flex">
    <div><h1><?php echo $curso ? 'Agenda de cursos' : 'Clube de vantagens'; ?></h1>
    <p><?php echo $curso ? 'O que for publicado aqui aparece na hora na Agenda de cursos do Portal do Credenciado e do site da Esthetic Aligner.' : 'Os parceiros publicados aqui aparecem na hora no Clube de vantagens do Portal do Credenciado.'; ?></p></div>
    <?php if (!$editar) : ?><a class="eacp-btn eacp-btn--branco" href="<?php echo esc_url(add_query_arg(['aba' => $aba, 'editar' => 'novo'], home_url('/'))); ?>">+ <?php echo $curso ? 'Novo curso' : 'Novo parceiro'; ?></a><?php endif; ?>
  </div></section>

  <div class="eacp-wrap">
    <?php if ($ok) : ?><div class="eacp-msg eacp-msg--ok">✓ <?php echo $e($ok); ?></div><?php endif; ?>
    <?php if ($erro) : ?><div class="eacp-msg eacp-msg--erro"><?php echo $e($erro); ?></div><?php endif; ?>
    <?php if (is_wp_error($lista)) : ?><div class="eacp-msg eacp-msg--erro"><?php echo $e($lista->get_error_message()); ?></div><?php endif; ?>

    <?php if ($editar) : ?>
      <form class="eacp-card eacp-form" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" enctype="multipart/form-data">
        <input type="hidden" name="action" value="<?php echo $curso ? 'eacp_curso' : 'eacp_parceiro'; ?>">
        <input type="hidden" name="id" value="<?php echo (int) ($item['id'] ?? 0); ?>">
        <?php wp_nonce_field($curso ? 'eacp_curso' : 'eacp_parceiro'); ?>
        <h2><?php echo $item ? 'Editar ' . ($curso ? 'curso' : 'parceiro') : ($curso ? 'Novo curso' : 'Novo parceiro'); ?></h2>
        <?php if ($curso) : ?>
          <label class="eacp-f eacp-f--full"><span>Nome do curso *</span><input type="text" name="titulo" value="<?php echo $v('titulo'); ?>" required placeholder="Ex.: Masterclass Esthetic Aligner – São Paulo"></label>
          <label class="eacp-f"><span>Data *</span><input type="date" name="data" value="<?php echo $v('data'); ?>" required></label>
          <label class="eacp-f"><span>Até (se tiver mais de um dia)</span><input type="date" name="fim" value="<?php echo $v('fim'); ?>"></label>
          <label class="eacp-f"><span>Começa às</span><input type="time" name="hora_inicio" value="<?php echo $v('hora_inicio'); ?>"></label>
          <label class="eacp-f"><span>Termina às</span><input type="time" name="hora_fim" value="<?php echo $v('hora_fim'); ?>"></label>
          <label class="eacp-f"><span>Formato</span><select name="formato"><?php foreach ($opc['formatos'] as $k => $n) echo '<option value="' . esc_attr($k) . '"' . selected($item['formato'] ?? 'presencial', $k, false) . '>' . $e($n) . '</option>'; ?></select></label>
          <label class="eacp-f"><span>Situação</span><select name="situacao"><?php foreach ($opc['situacoes'] as $k => $n) echo '<option value="' . esc_attr($k) . '"' . selected($item['situacao'] ?? 'abertas', $k, false) . '>' . $e($n) . '</option>'; ?></select></label>
          <label class="eacp-f"><span>Cidade</span><input type="text" name="cidade" value="<?php echo $v('cidade'); ?>" placeholder="Ex.: São Paulo – SP"></label>
          <label class="eacp-f"><span>Local</span><input type="text" name="local" value="<?php echo $v('local'); ?>" placeholder="Ex.: Hotel, endereço ou Zoom"></label>
          <label class="eacp-f eacp-f--full"><span>Ministrado por</span><input type="text" name="ministrado_por" value="<?php echo $v('ministrado_por'); ?>" placeholder="Ex.: Dra. Fulana de Tal"></label>
          <label class="eacp-f"><span>Link de inscrição</span><input type="text" name="link" value="<?php echo $v('link'); ?>" placeholder="Link (Zoom, formulário) ou WhatsApp"><small>Se colocar só o número do WhatsApp, o botão já abre a conversa com o nome do curso.</small></label>
          <label class="eacp-f"><span>Texto do botão</span><input type="text" name="texto_botao" value="<?php echo $v('texto_botao', 'Inscreva-se'); ?>"></label>
          <label class="eacp-f eacp-f--full"><span>Descrição (opcional)</span><textarea name="descricao" rows="4" placeholder="Conteúdo do curso, público, o que levar…"><?php echo esc_textarea($item['descricao'] ?? ''); ?></textarea></label>
        <?php else : ?>
          <label class="eacp-f eacp-f--full"><span>Nome do parceiro *</span><input type="text" name="nome" value="<?php echo $v('nome'); ?>" required></label>
          <label class="eacp-f"><span>Benefício em destaque</span><input type="text" name="beneficio" value="<?php echo $v('beneficio'); ?>" placeholder="Ex.: 15% OFF"></label>
          <label class="eacp-f"><span>Cupom (opcional)</span><input type="text" name="cupom" value="<?php echo $v('cupom'); ?>"></label>
          <label class="eacp-f"><span>Categoria</span><input type="text" name="categoria" value="<?php echo $v('categoria'); ?>" list="eacp-cats" placeholder="Ex.: Equipamentos"><datalist id="eacp-cats"><?php foreach ($opc['categorias_clube'] as $c) echo '<option value="' . esc_attr($c) . '">'; ?></datalist></label>
          <label class="eacp-f"><span>Link do botão</span><input type="url" name="link" value="<?php echo $v('link'); ?>" placeholder="https://… (site, WhatsApp ou formulário)"></label>
          <label class="eacp-f"><span>Texto do botão</span><input type="text" name="texto_botao" value="<?php echo $v('texto_botao', 'Ir para o site'); ?>"></label>
          <label class="eacp-f eacp-f--full"><span>Como funciona o benefício</span><textarea name="descricao" rows="4"><?php echo esc_textarea($item['descricao'] ?? ''); ?></textarea></label>
        <?php endif; ?>
        <div class="eacp-f eacp-f--full eacp-img">
          <span><?php echo $curso ? 'Imagem do curso' : 'Logo do parceiro'; ?></span>
          <div class="eacp-img__box">
            <img data-eacp-prev src="<?php echo esc_url($item['imagem'] ?? ''); ?>" alt=""<?php echo empty($item['imagem']) ? ' hidden' : ''; ?>>
            <label class="eacp-btn eacp-btn--linha">Escolher imagem<input type="file" name="imagem" accept="image/jpeg,image/png,image/webp" hidden data-eacp-img></label>
            <small><?php echo $curso ? 'De preferência quadrada (como um post de Instagram). JPG ou PNG até 5 MB.' : 'PNG ou JPG até 5 MB.'; ?><?php echo !empty($item['imagem']) ? ' Para manter a imagem atual, não escolha outra.' : ''; ?></small>
          </div>
        </div>
        <div class="eacp-f eacp-f--full eacp-checks">
          <?php if ($curso) : ?><label><input type="checkbox" name="destaque" value="1" <?php checked(!empty($item['destaque'])); ?>> Destacar no topo da agenda</label><?php endif; ?>
          <label><input type="checkbox" name="rascunho" value="1" <?php checked($item && empty($item['publicado'])); ?>> Salvar sem publicar (rascunho)</label>
        </div>
        <div class="eacp-acoes">
          <button class="eacp-btn eacp-btn--cheio" type="submit"><?php echo $item ? 'Salvar alterações' : 'Publicar'; ?></button>
          <a class="eacp-btn eacp-btn--linha" href="<?php echo esc_url(add_query_arg('aba', $aba, home_url('/'))); ?>">Cancelar</a>
          <?php if ($item) : ?><button class="eacp-excluir" type="submit" name="excluir" value="1" formnovalidate onclick="return confirm('Remover <?php echo $curso ? 'este curso da agenda' : 'este parceiro do clube'; ?>?')">Remover</button><?php endif; ?>
        </div>
      </form>
      <script>(function(){var i=document.querySelector('[data-eacp-img]'),p=document.querySelector('[data-eacp-prev]');if(i)i.addEventListener('change',function(){var f=i.files[0];if(!f)return;if(f.size>5242880){alert('A imagem pode ter no máximo 5 MB.');i.value='';return;}p.src=URL.createObjectURL(f);p.hidden=false;});document.querySelector('.eacp-form').addEventListener('submit',function(e){var b=e.submitter;if(b&&b.classList.contains('eacp-btn--cheio')){b.disabled=true;b.textContent='Enviando…';}});})();</script>

    <?php elseif (is_array($lista)) : ?>
      <?php if (!$lista) : ?>
        <div class="eacp-card eacp-vazio"><p><?php echo $curso ? 'Nenhum curso cadastrado ainda.' : 'Nenhum parceiro cadastrado ainda.'; ?></p></div>
      <?php else : ?>
        <div class="eacp-lista">
        <?php foreach ($lista as $x) :
          $passou = $curso && ($x['fim'] ?: $x['data']) < $hoje;
          $url = add_query_arg(['aba' => $aba, 'editar' => $x['id']], home_url('/')); ?>
          <a class="eacp-item<?php echo $passou ? ' is-passado' : ''; ?>" href="<?php echo esc_url($url); ?>">
            <span class="eacp-item__img"><?php if ($x['imagem']) : ?><img src="<?php echo esc_url($x['imagem']); ?>" alt=""><?php endif; ?></span>
            <span class="eacp-item__txt">
              <strong><?php echo $e($curso ? $x['titulo'] : $x['nome']); ?></strong>
              <?php if ($curso) : ?>
                <em><?php echo $e(($x['data'] ? date('d/m/Y', strtotime($x['data'])) : '') . ($x['hora_inicio'] ? ' · ' . $x['hora_inicio'] : '') . ' · ' . ($opc['formatos'][$x['formato']] ?? '') . ($x['cidade'] ? ' · ' . $x['cidade'] : '')); ?></em>
              <?php else : ?>
                <em><?php echo $e(trim(($x['beneficio'] ?: '') . ($x['categoria'] ? ' · ' . $x['categoria'] : ''), ' ·')); ?></em>
              <?php endif; ?>
            </span>
            <span class="eacp-item__tags">
              <?php if (empty($x['publicado'])) : ?><i class="eacp-tag eacp-tag--cinza">Rascunho</i><?php endif; ?>
              <?php if ($passou) : ?><i class="eacp-tag eacp-tag--cinza">Já aconteceu</i>
              <?php elseif ($curso) : ?><i class="eacp-tag eacp-tag--<?php echo esc_attr($x['situacao']); ?>"><?php echo $e($opc['situacoes'][$x['situacao']] ?? ''); ?></i><?php endif; ?>
              <?php if ($curso && !empty($x['destaque'])) : ?><i class="eacp-tag eacp-tag--dest">★ Destaque</i><?php endif; ?>
            </span>
            <span class="eacp-item__ed">Editar</span>
          </a>
        <?php endforeach; ?>
        </div>
      <?php endif; ?>
      <?php $pg = $curso ? ($opc['pagina_agenda'] ?? '') : ($opc['pagina_clube'] ?? ''); if ($pg) : ?><p class="eacp-ver">Ver como os dentistas veem: <a href="<?php echo esc_url($pg); ?>" target="_blank" rel="noopener"><?php echo $e(preg_replace('~^https?://~', '', $pg)); ?></a></p><?php endif; ?>
    <?php endif; ?>
  </div>
<?php endif; ?>
</main>
<footer class="eacp-rodape"><div class="eacp-wrap">© <?php echo esc_html(wp_date('Y')); ?> Esthetic Aligner · Credenciamento de parceiros</div></footer>
<?php wp_footer(); ?>
</body>
</html>
