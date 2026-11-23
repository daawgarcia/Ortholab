<?php
/**
 * Primeiro acesso ao portal novo: o dentista confirma nome, e-mail, CPF, CRO/UF e WhatsApp.
 * Esses dados também são os usados pelo login único para reconhecer o mesmo dentista nos outros sistemas.
 */
if (!defined('ABSPATH')) exit;

function eap_cpf_valido($cpf) {
    $c = eap_digitos($cpf);
    if (strlen($c) !== 11 || preg_match('/^(\d)\1{10}$/', $c)) return false;
    for ($t = 9; $t < 11; $t++) {
        $s = 0;
        for ($i = 0; $i < $t; $i++) $s += $c[$i] * (($t + 1) - $i);
        if ((($s * 10) % 11) % 10 != $c[$t]) return false;
    }
    return true;
}

/* documentos aceitos no primeiro acesso (os mesmos do site antigo) */
const EAP_DOC_TERMOS = 'termos-e-condicoes-2';
const EAP_DOC_PRIVACIDADE = 'politica-de-privacidade';
function eap_doc($slug) { $p = get_page_by_path($slug); return $p && $p->post_status === 'publish' ? $p : null; }
/** Versão dos documentos = data da última alteração de cada um. Se mudar, o aceite é pedido de novo. */
function eap_aceite_versao() {
    $t = eap_doc(EAP_DOC_TERMOS); $pv = eap_doc(EAP_DOC_PRIVACIDADE);
    return 'Termos ' . ($t ? $t->post_modified : '—') . ' | Privacidade ' . ($pv ? $pv->post_modified : '—');
}
function eap_aceite_ok($uid) {
    $a = get_user_meta($uid, 'eap_aceite', true);
    return is_array($a) && ($a['versao'] ?? '') === eap_aceite_versao();
}
function eap_precisa_confirmar($uid = 0) {
    $uid = $uid ?: get_current_user_id();
    if (!$uid || user_can($uid, 'edit_pages')) return false;
    return !get_user_meta($uid, 'eap_dados_confirmados', true) || !eap_aceite_ok($uid);
}
function eap_registrar_aceite($uid) {
    $ip = sanitize_text_field($_SERVER['HTTP_CF_CONNECTING_IP'] ?? ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['REMOTE_ADDR'] ?? '')));
    $ip = trim(explode(',', $ip)[0]);
    $reg = ['quando' => current_time('mysql'), 'versao' => eap_aceite_versao(), 'ip' => $ip, 'navegador' => mb_substr(sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200)];
    update_user_meta($uid, 'eap_aceite', $reg);
    $hist = get_user_meta($uid, 'eap_aceite_historico', true); $hist = is_array($hist) ? $hist : [];
    $hist[] = $reg; update_user_meta($uid, 'eap_aceite_historico', array_slice($hist, -20));
}

// manda para a confirmação antes de qualquer página do portal
add_action('template_redirect', function () {
    if (!is_user_logged_in() || wp_doing_ajax() || is_admin()) return;
    $em = get_query_var('eap_confirmar') || (isset($_GET['eap_confirmar']));
    if ($em) return;
    if (!empty($_GET['eap_ir'])) return; // deixa o login único seguir (dados vão como estiverem)
    if (is_page([EAP_DOC_TERMOS, EAP_DOC_PRIVACIDADE])) return; // o dentista precisa conseguir ler os documentos antes de aceitar
    if (eap_precisa_confirmar()) {
        wp_safe_redirect(add_query_arg('eap_confirmar', '1', home_url('/')));
        exit;
    }
}, 2);

/** Valor atual de um campo: o confirmado; senão o primeiro campo antigo parecido. */
function eap_dado_atual($uid, $tipo) {
    $v = get_user_meta($uid, 'eap_' . $tipo, true);
    if ($v !== '' && $v !== false) return $v;
    if ($tipo === 'cpf' || $tipo === 'cro') return eap_sso_meta_digitos($uid, $tipo);
    if (strpos($tipo, 'end_') === 0) { // endereço: cadastro da loja (cobrança/entrega) ou do cadastro antigo
        $mapa = ['end_cep' => ['billing_postcode', 'shipping_postcode', 'rpr_cep'], 'end_rua' => ['billing_address_1', 'shipping_address_1', 'rpr_endereo_comercial'], 'end_numero' => ['billing_number', 'shipping_number'],
                 'end_compl' => ['billing_address_2', 'shipping_address_2', 'rpr_complemento'], 'end_bairro' => ['billing_neighborhood', 'shipping_neighborhood'], 'end_cidade' => ['billing_city', 'shipping_city', 'rpr_cidade'], 'end_uf' => ['billing_state', 'shipping_state', 'rpr_estado']];
        foreach ($mapa[$tipo] ?? [] as $k) { $x = get_user_meta($uid, $k, true); if ($x) return $x; }
        return '';
    }
    if ($tipo === 'whats') {
        foreach (['rpr_celular', 'billing_cellphone', 'ea_credenciamento_welcome_contact_phone', 'billing_phone', 'phone', 'telefone', 'celular', 'whatsapp', 'mobile_number', 'rpr_telefone_comercial'] as $k) { $x = get_user_meta($uid, $k, true); if ($x) return $x; }
    }
    return '';
}

function eap_confirmar_salvar($u) {
    $nome = sanitize_text_field(wp_unslash($_POST['nome'] ?? ''));
    $email = sanitize_email(wp_unslash($_POST['email'] ?? ''));
    $cpf = eap_digitos($_POST['cpf'] ?? '');
    $cro = eap_digitos($_POST['cro'] ?? '');
    $uf = strtoupper(substr(sanitize_text_field(wp_unslash($_POST['uf'] ?? '')), 0, 2));
    $whats = sanitize_text_field(wp_unslash($_POST['whats'] ?? ''));
    $erros = [];
    if (mb_strlen($nome) < 5 || strpos($nome, ' ') === false) $erros[] = 'Informe o nome completo.';
    if (!is_email($email)) $erros[] = 'E-mail inválido.';
    elseif (($o = get_user_by('email', $email)) && (int) $o->ID !== (int) $u->ID) $erros[] = 'Este e-mail já está em outro cadastro. Fale com o suporte.';
    if (!eap_cpf_valido($cpf)) $erros[] = 'CPF inválido. Confira os números.';
    if (strlen($cro) < 3) $erros[] = 'Informe o número do CRO.';
    if (!preg_match('/^[A-Z]{2}$/', $uf)) $erros[] = 'Escolha a UF do CRO.';
    if (strlen(eap_digitos($whats)) < 10) $erros[] = 'Informe o WhatsApp com DDD.';
    $end = [];
    foreach (['cep', 'rua', 'numero', 'compl', 'bairro', 'cidade', 'uf'] as $k) $end[$k] = mb_substr(sanitize_text_field(wp_unslash($_POST['end_' . $k] ?? '')), 0, 120);
    $end['cep'] = eap_digitos($end['cep']); $end['uf'] = strtoupper(substr($end['uf'], 0, 2));
    if (strlen($end['cep']) !== 8) $erros[] = 'Informe o CEP (8 números).';
    if (mb_strlen($end['rua']) < 3) $erros[] = 'Informe a rua do endereço.';
    if ($end['numero'] === '') $erros[] = 'Informe o número do endereço (ou "s/n").';
    if (mb_strlen($end['bairro']) < 2) $erros[] = 'Informe o bairro.';
    if (mb_strlen($end['cidade']) < 2) $erros[] = 'Informe a cidade.';
    if (!preg_match('/^[A-Z]{2}$/', $end['uf'])) $erros[] = 'Escolha o estado do endereço.';
    if (empty($_POST['aceite'])) $erros[] = 'Para continuar, marque que leu e concorda com os Termos e Condições e a Política de Privacidade.';
    if ($erros) return $erros;

    $partes = preg_split('/\s+/', trim($nome), 2);
    $dados = ['ID' => $u->ID, 'display_name' => $nome, 'first_name' => $partes[0], 'last_name' => $partes[1] ?? ''];
    if (strtolower($email) !== strtolower($u->user_email)) $dados['user_email'] = $email;
    $r = wp_update_user($dados);
    if (is_wp_error($r)) return [$r->get_error_message()];
    update_user_meta($u->ID, 'eap_cpf', $cpf);
    update_user_meta($u->ID, 'eap_cro', $cro);
    update_user_meta($u->ID, 'eap_cro_uf', $uf);
    update_user_meta($u->ID, 'eap_whats', $whats);
    foreach ($end as $k => $x) update_user_meta($u->ID, 'eap_end_' . $k, $x);
    // mantém o cadastro da loja em dia com o endereço confirmado
    foreach (['postcode' => 'cep', 'address_1' => 'rua', 'number' => 'numero', 'address_2' => 'compl', 'neighborhood' => 'bairro', 'city' => 'cidade', 'state' => 'uf'] as $wc => $k) update_user_meta($u->ID, 'billing_' . $wc, $end[$k]);
    update_user_meta($u->ID, 'eap_dados_confirmados', current_time('mysql'));
    eap_registrar_aceite($u->ID);
    return [];
}

// a tela em si (usa o cabeçalho/rodapé do tema)
add_action('template_redirect', function () {
    if (!isset($_GET['eap_confirmar']) || !is_user_logged_in()) return;
    $u = wp_get_current_user();
    $erros = [];
    $so_aceite = (bool) get_user_meta($u->ID, 'eap_dados_confirmados', true) && !eap_aceite_ok($u->ID);
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && check_admin_referer('eap_confirmar') && $so_aceite) {
        if (!empty($_POST['aceite'])) { eap_registrar_aceite($u->ID); wp_safe_redirect(home_url('/area-do-credenciado/')); exit; }
        $erros = ['Para continuar, marque que leu e concorda com os Termos e Condições e a Política de Privacidade.'];
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && check_admin_referer('eap_confirmar')) {
        $erros = eap_confirmar_salvar($u);
        if (!$erros) { wp_safe_redirect(home_url('/area-do-credenciado/?dados=ok')); exit; }
        $u = wp_get_current_user();
    }
    $v = fn($k, $padrao = '') => esc_attr(isset($_POST[$k]) ? wp_unslash($_POST[$k]) : $padrao);
    $ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
    $uf_atual = $_POST['uf'] ?? get_user_meta($u->ID, 'eap_cro_uf', true);
    status_header(200);
    add_filter('pre_get_document_title', fn() => 'Confirme seus dados · Portal do Credenciado', 100);
    get_header();
    $t = eap_doc(EAP_DOC_TERMOS); $pv = eap_doc(EAP_DOC_PRIVACIDADE);
    $caixa = '<label class="eap-col2 eap-aceite"><input type="checkbox" name="aceite" value="1" required' . (!empty($_POST['aceite']) ? ' checked' : '') . '> <span>Li e concordo com os <a href="' . esc_url($t ? get_permalink($t) : '#') . '" target="_blank" rel="noopener">Termos e Condições</a> e com a <a href="' . esc_url($pv ? get_permalink($pv) : '#') . '" target="_blank" rel="noopener">Política de Privacidade</a> da Esthetic Aligner.</span></label>';
    if (function_exists('eapt_faixa')) eapt_faixa($so_aceite ? 'Termos e privacidade' : 'Confirme seus dados', $so_aceite ? 'Para continuar usando o portal, confirme que leu e concorda com os nossos termos.' : 'Estamos atualizando o cadastro dos credenciados. Leva cerca de um minuto e só é pedido uma vez.');
    if ($so_aceite) { ?>
    <section class="eap-conteudo"><div class="eap-wrap eap-confirmar">
      <?php if ($erros) : ?><div class="eap-alerta"><?php echo implode('<br>', array_map('esc_html', $erros)); ?></div><?php endif; ?>
      <form method="post" class="eap-form eap-form--grade"><?php wp_nonce_field('eap_confirmar'); echo $caixa; ?>
        <div class="eap-col2"><button class="eap-btn eap-btn--cheio" type="submit">Concordo e continuar</button></div>
      </form>
    </div></section>
    <?php get_footer(); exit; }
    ?>
    <section class="eap-conteudo"><div class="eap-wrap eap-confirmar">
      <?php if ($erros) : ?><div class="eap-alerta"><?php echo implode('<br>', array_map('esc_html', $erros)); ?></div><?php endif; ?>
      <form method="post" class="eap-form eap-form--grade">
        <?php wp_nonce_field('eap_confirmar'); ?>
        <label class="eap-col2">Nome completo<input type="text" name="nome" required value="<?php echo $v('nome', trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name); ?>"></label>
        <label class="eap-col2">E-mail<input type="email" name="email" required value="<?php echo $v('email', $u->user_email); ?>"></label>
        <label>CPF<input type="text" name="cpf" inputmode="numeric" required placeholder="000.000.000-00" value="<?php echo $v('cpf', eap_dado_atual($u->ID, 'cpf')); ?>" data-eap-mascara="cpf"></label>
        <label>WhatsApp<input type="tel" name="whats" required placeholder="(11) 99999-9999" value="<?php echo $v('whats', eap_dado_atual($u->ID, 'whats')); ?>"></label>
        <label>CRO<input type="text" name="cro" inputmode="numeric" required value="<?php echo $v('cro', eap_dado_atual($u->ID, 'cro')); ?>"></label>
        <label>UF do CRO<select name="uf" required><option value="">Escolha</option><?php foreach ($ufs as $x) echo '<option' . selected($uf_atual, $x, false) . '>' . $x . '</option>'; ?></select></label>
        <h3 class="eap-col2 eap-confirmar__sub">Endereço do consultório</h3>
        <label>CEP<input type="text" name="end_cep" inputmode="numeric" required placeholder="00000-000" maxlength="9" value="<?php echo $v('end_cep', eap_dado_atual($u->ID, 'end_cep')); ?>" data-eap-cep></label>
        <label>Estado<select name="end_uf" required data-eap-end="uf"><option value="">Escolha</option><?php $euf = strtoupper($_POST['end_uf'] ?? eap_dado_atual($u->ID, 'end_uf')); foreach ($ufs as $x) echo '<option' . selected($euf, $x, false) . '>' . $x . '</option>'; ?></select></label>
        <label class="eap-col2">Rua / avenida<input type="text" name="end_rua" required value="<?php echo $v('end_rua', eap_dado_atual($u->ID, 'end_rua')); ?>" data-eap-end="rua"></label>
        <label>Número<input type="text" name="end_numero" required value="<?php echo $v('end_numero', eap_dado_atual($u->ID, 'end_numero')); ?>"></label>
        <label>Complemento <small>(opcional)</small><input type="text" name="end_compl" value="<?php echo $v('end_compl', eap_dado_atual($u->ID, 'end_compl')); ?>" placeholder="Sala, conjunto…"></label>
        <label>Bairro<input type="text" name="end_bairro" required value="<?php echo $v('end_bairro', eap_dado_atual($u->ID, 'end_bairro')); ?>" data-eap-end="bairro"></label>
        <label>Cidade<input type="text" name="end_cidade" required value="<?php echo $v('end_cidade', eap_dado_atual($u->ID, 'end_cidade')); ?>" data-eap-end="cidade"></label>
        <p class="eap-col2 eap-confirmar__nota">Usamos esses dados para identificar você no Ortholab, no Esthetic Rewards e no Envio Fácil (entrando direto, sem nova senha) e para manter o seu cadastro de credenciado atualizado. Tratamos seus dados conforme a LGPD.</p>
        <?php echo $caixa; ?>
        <div class="eap-col2"><button class="eap-btn eap-btn--cheio" type="submit">Confirmar e entrar</button></div>
      </form>
    </div></section>
    <script>(function(){var c=document.querySelector('[data-eap-cep]');if(!c)return;c.addEventListener('input',function(){var d=c.value.replace(/\D/g,'').slice(0,8);c.value=d.length>5?d.slice(0,5)+'-'+d.slice(5):d;
      if(d.length===8)fetch('https://viacep.com.br/ws/'+d+'/json/').then(function(r){return r.json();}).then(function(j){if(!j||j.erro)return;var f=function(k,v){var e=document.querySelector('[data-eap-end='+k+']');if(e&&v&&!e.value)e.value=v;};f('rua',j.logradouro);f('bairro',j.bairro);f('cidade',j.localidade);var u=document.querySelector('[data-eap-end=uf]');if(u&&j.uf)u.value=j.uf;var n=document.querySelector('[name=end_numero]');if(n&&!n.value)n.focus();}).catch(function(){});});})();</script>
    <script>document.querySelectorAll('[data-eap-mascara=cpf]').forEach(function(i){i.addEventListener('input',function(){var d=i.value.replace(/\D/g,'').slice(0,11);i.value=d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');});});</script>
    <?php
    get_footer();
    exit;
}, 3);

// mostra no admin quem já confirmou
add_filter('manage_users_columns', function ($c) { $c['eap_conf'] = 'Dados confirmados'; return $c; });
add_filter('manage_users_custom_column', function ($out, $col, $uid) {
    if ($col !== 'eap_conf') return $out;
    $d = get_user_meta($uid, 'eap_dados_confirmados', true);
    $a = get_user_meta($uid, 'eap_aceite', true);
    $ac = is_array($a) ? '<br><small>Aceite dos termos: ' . esc_html(mysql2date('d/m/Y H:i', $a['quando'])) . (eap_aceite_ok($uid) ? '' : ' (versão anterior)') . '</small>' : '<br><small>Termos: não aceitos</small>';
    return $d ? esc_html(mysql2date('d/m/Y H:i', $d)) . $ac . '<br><small>CPF ' . esc_html(get_user_meta($uid, 'eap_cpf', true)) . ' · CRO ' . esc_html(get_user_meta($uid, 'eap_cro', true) . '/' . get_user_meta($uid, 'eap_cro_uf', true)) . '</small>' : '—';
}, 10, 3);
