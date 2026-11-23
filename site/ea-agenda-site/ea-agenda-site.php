<?php
/**
 * Plugin Name: EA Agenda de Cursos (site)
 * Description: Mostra a Agenda de cursos do Portal do Credenciado no site. Use o shortcode [ea_agenda] na página Agenda de Cursos. Os cursos são cadastrados pelo time de vendas no site de credenciamento.
 * Version: 1.0.0
 * Author: Esthetic Aligner
 */
if (!defined('ABSPATH')) exit;

function eaag_fonte() { return (string) get_option('eaag_url', 'https://portal2.estheticaligner.com.br/wp-json/ea-portal/v1/agenda-publica'); }

function eaag_cursos() {
    $c = get_transient('eaag_cursos');
    if (is_array($c)) return $c;
    $r = wp_remote_get(eaag_fonte(), ['timeout' => 12]);
    $lista = is_wp_error($r) || wp_remote_retrieve_response_code($r) !== 200 ? null : json_decode(wp_remote_retrieve_body($r), true);
    if (!is_array($lista)) { $velho = get_option('eaag_ultimo', []); return is_array($velho) ? $velho : []; } // portal fora do ar: mostra a última lista boa
    set_transient('eaag_cursos', $lista, 5 * MINUTE_IN_SECONDS);
    update_option('eaag_ultimo', $lista, false);
    return $lista;
}

add_shortcode('ea_agenda', function () {
    $lista = eaag_cursos();
    $hoje = wp_date('Y-m-d');
    $lista = array_values(array_filter($lista, fn($c) => (($c['fim'] ?? '') ?: ($c['data'] ?? '')) >= $hoje));
    $wa = 'https://wa.me/5511951461804?text=' . rawurlencode('Olá! Quero saber dos próximos cursos da Esthetic Aligner.');
    $ic = [
        'cal' => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7Zm-2 7h14v10H5V9Z"/></svg>',
        'hora' => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1 3v6l5 3 1-1.6-4-2.4V7h-2Z"/></svg>',
        'pin' => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>',
        'quem' => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5Z"/></svg>',
    ];
    ob_start(); ?>
    <div class="eaag">
    <?php if (!$lista) : ?>
      <div class="eaag-vazio"><h3>Novas datas em breve</h3><p>Estamos preparando os próximos cursos. Fale com a gente e seja avisado.</p><a class="eaag-btn" href="<?php echo esc_url($wa); ?>" target="_blank" rel="noopener">Falar no WhatsApp</a></div>
    <?php else : foreach ($lista as $i => $c) :
        $esg = ($c['situacao'] ?? '') === 'esgotado'; $breve = ($c['situacao'] ?? '') === 'breve' || empty($c['link']);
        $onde = ($c['formato'] ?? '') === 'online' ? trim('Online' . (!empty($c['local']) ? ' · ' . $c['local'] : '')) : trim(($c['local'] ?? '') . (!empty($c['local']) && !empty($c['cidade']) ? ' · ' : '') . ($c['cidade'] ?? '')); ?>
      <article class="eaag-card<?php echo $i === 0 ? ' eaag-card--dest' : ''; ?>">
        <div class="eaag-img"><?php if (!empty($c['imagem'])) : ?><img src="<?php echo esc_url($c['imagem']); ?>" alt="<?php echo esc_attr($c['titulo']); ?>" loading="lazy"><?php endif; ?>
          <?php if (!empty($c['dia'])) : ?><span class="eaag-data"><b><?php echo (int) $c['dia']; ?></b><i><?php echo esc_html($c['mes']); ?></i></span><?php endif; ?></div>
        <div class="eaag-corpo">
          <div class="eaag-tags"><span class="eaag-tag eaag-tag--<?php echo esc_attr($c['formato']); ?>"><?php echo esc_html($c['formato_texto']); ?></span><span class="eaag-tag eaag-tag--<?php echo esc_attr($c['situacao']); ?>"><?php echo esc_html($c['situacao_texto']); ?></span></div>
          <h3><?php echo esc_html($c['titulo']); ?></h3>
          <ul class="eaag-info">
            <?php if (!empty($c['data_texto'])) : ?><li><?php echo $ic['cal']; ?><span><?php echo esc_html($c['data_texto']); ?></span></li><?php endif; ?>
            <?php if (!empty($c['horario'])) : ?><li><?php echo $ic['hora']; ?><span><?php echo esc_html($c['horario']); ?></span></li><?php endif; ?>
            <?php if ($onde) : ?><li><?php echo $ic['pin']; ?><span><?php echo esc_html($onde); ?></span></li><?php endif; ?>
            <?php if (!empty($c['ministrado_por'])) : ?><li><?php echo $ic['quem']; ?><span><?php echo esc_html($c['ministrado_por']); ?></span></li><?php endif; ?>
          </ul>
          <?php if (!empty($c['descricao'])) : ?><p class="eaag-desc"><?php echo esc_html(wp_trim_words($c['descricao'], $i === 0 ? 50 : 24)); ?></p><?php endif; ?>
          <div class="eaag-acoes">
            <?php if ($esg) : ?><span class="eaag-btn is-off">Vagas esgotadas</span>
            <?php elseif ($breve) : ?><span class="eaag-btn is-off">Inscrições em breve</span>
            <?php else : ?><a class="eaag-btn" href="<?php echo esc_url($c['link']); ?>" target="_blank" rel="noopener"><?php echo esc_html($c['texto_botao']); ?></a><?php endif; ?>
            <?php if (!empty($c['google_agenda'])) : ?><a class="eaag-agenda" href="<?php echo esc_url($c['google_agenda']); ?>" target="_blank" rel="noopener">+ Adicionar à minha agenda</a><?php endif; ?>
          </div>
        </div>
      </article>
    <?php endforeach; endif; ?>
      <div class="eaag-cta"><div><strong>Quer saber mais sobre os cursos ou se credenciar?</strong><span>Fale com a equipe da Esthetic Aligner.</span></div><a class="eaag-btn eaag-btn--branco" href="<?php echo esc_url($wa); ?>" target="_blank" rel="noopener">Falar no WhatsApp</a></div>
    </div>
    <style>
    .eaag{--a:#2f6fe4;--n:#0d1f42;--t:#1b2433;--t2:#5b6576;--l:#e4e8f0;display:grid;gap:22px;font-family:inherit;color:var(--t);margin:10px 0 30px}
    .eaag *{box-sizing:border-box}
    .eaag-card{display:flex;background:#fff;border:1px solid var(--l);border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(17,38,84,.08)}
    .eaag-img{position:relative;flex:0 0 260px;aspect-ratio:1/1;background:#eef3fc}
    .eaag-img img{width:100%!important;height:100%!important;object-fit:cover;display:block;max-width:none}
    .eaag-card--dest .eaag-img{flex-basis:40%}
    .eaag-data{position:absolute;top:14px;left:14px;background:#fff;border-radius:14px;padding:8px 12px 7px;text-align:center;box-shadow:0 6px 18px rgba(13,31,66,.2);line-height:1;min-width:58px}
    .eaag-data b{display:block;font-size:26px;font-weight:800;color:var(--n)}
    .eaag-data i{display:block;font-style:normal;font-size:12px;font-weight:800;letter-spacing:.1em;color:var(--a);margin-top:4px}
    .eaag-corpo{flex:1;padding:26px 30px;display:flex;flex-direction:column;gap:12px;justify-content:center}
    .eaag-corpo h3{margin:0;font-size:22px;line-height:1.3;color:var(--n)}
    .eaag-card--dest h3{font-size:28px}
    .eaag-tags{display:flex;gap:6px;flex-wrap:wrap}
    .eaag-tag{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:#e8f0fe;color:var(--a)}
    .eaag-tag--online,.eaag-tag--hibrido{background:#efe9ff;color:#6a42d6}.eaag-tag--abertas{background:#e3f6ec;color:#1d7f55}.eaag-tag--ultimas{background:#fff1dc;color:#b86a00}.eaag-tag--breve{background:#eef1f6;color:#5b6576}.eaag-tag--esgotado{background:#fde8e8;color:#c0392b}
    .eaag-info{list-style:none!important;margin:0!important;padding:0!important;display:grid;gap:8px}
    .eaag-info li{display:flex;gap:10px;align-items:flex-start;margin:0!important;padding:0!important;list-style:none!important}
    .eaag-info li:before{display:none!important}
    .eaag-info svg{width:18px;height:18px;flex:none;fill:var(--a);margin-top:3px}
    .eaag-desc{margin:0;color:var(--t2)}
    .eaag-acoes{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin-top:4px}
    .eaag-btn{display:inline-flex;align-items:center;background:linear-gradient(120deg,#2f6fe4,#3fa2f2);color:#fff!important;text-decoration:none!important;font-weight:700;padding:13px 26px;border-radius:999px;box-shadow:0 8px 20px rgba(47,111,228,.28)}
    .eaag-btn.is-off{opacity:.6;background:#eef1f6;color:var(--t2)!important;box-shadow:none}
    .eaag-btn--branco{background:#fff;color:var(--n)!important;box-shadow:none}
    .eaag-agenda{color:var(--a)!important;font-weight:600;text-decoration:none!important}
    .eaag-cta{background:linear-gradient(120deg,#0d1f42,#16305f);color:#fff;border-radius:20px;padding:26px 30px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
    .eaag-cta strong{display:block;font-size:18px;color:#fff}.eaag-cta span{display:block;color:rgba(255,255,255,.8)}
    .eaag-vazio{text-align:center;border:1px dashed #cfd9ea;border-radius:20px;padding:40px 20px;background:#fff}
    @media(max-width:760px){.eaag-card{flex-direction:column}.eaag-img,.eaag-card--dest .eaag-img{flex:none}.eaag-corpo{padding:20px}.eaag-card--dest h3{font-size:22px}}
    </style>
    <?php return ob_get_clean();
});
