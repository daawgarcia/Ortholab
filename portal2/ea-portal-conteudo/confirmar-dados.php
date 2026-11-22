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

function eap_precisa_confirmar($uid = 0) {
    $uid = $uid ?: get_current_user_id();
    if (!$uid || user_can($uid, 'edit_pages')) return false;
    return !get_user_meta($uid, 'eap_dados_confirmados', true);
}

// manda para a confirmação antes de qualquer página do portal
add_action('template_redirect', function () {
    if (!is_user_logged_in() || wp_doing_ajax() || is_admin()) return;
    $em = get_query_var('eap_confirmar') || (isset($_GET['eap_confirmar']));
    if ($em) return;
    if (!empty($_GET['eap_ir'])) return; // deixa o login único seguir (dados vão como estiverem)
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
    update_user_meta($u->ID, 'eap_dados_confirmados', current_time('mysql'));
    return [];
}

// a tela em si (usa o cabeçalho/rodapé do tema)
add_action('template_redirect', function () {
    if (!isset($_GET['eap_confirmar']) || !is_user_logged_in()) return;
    $u = wp_get_current_user();
    $erros = [];
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && check_admin_referer('eap_confirmar')) {
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
    if (function_exists('eapt_faixa')) eapt_faixa('Confirme seus dados', 'Estamos atualizando o cadastro dos credenciados. Leva menos de um minuto e só é pedido uma vez.');
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
        <p class="eap-col2 eap-confirmar__nota">Usamos esses dados para identificar você no Ortholab e no Esthetic Rewards e entrar direto, sem nova senha. Tratamos seus dados conforme a LGPD.</p>
        <div class="eap-col2"><button class="eap-btn eap-btn--cheio" type="submit">Confirmar e entrar</button></div>
      </form>
    </div></section>
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
    return $d ? esc_html(mysql2date('d/m/Y H:i', $d)) . '<br><small>CPF ' . esc_html(get_user_meta($uid, 'eap_cpf', true)) . ' · CRO ' . esc_html(get_user_meta($uid, 'eap_cro', true) . '/' . get_user_meta($uid, 'eap_cro_uf', true)) . '</small>' : '—';
}, 10, 3);
