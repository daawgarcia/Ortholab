<?php
/**
 * Clube de vantagens (parceiros), Posts para redes sociais (Marketing) e Contatos do suporte.
 * Tudo com cadastro simples no menu "Portal do Credenciado".
 */
if (!defined('ABSPATH')) exit;

add_action('init', function () {
    register_post_type('ea_parceiro', [
        'labels' => [
            'name' => 'Clube de vantagens', 'singular_name' => 'Parceiro', 'add_new' => 'Novo parceiro',
            'add_new_item' => 'Novo parceiro do Clube', 'edit_item' => 'Editar parceiro', 'all_items' => 'Clube de vantagens',
            'featured_image' => 'Logo do parceiro', 'set_featured_image' => 'Escolher logo', 'remove_featured_image' => 'Remover logo',
            'not_found' => 'Nenhum parceiro',
        ],
        'public' => false, 'show_ui' => true, 'show_in_menu' => 'eap-portal', 'show_in_rest' => true,
        'supports' => ['title', 'excerpt', 'thumbnail', 'page-attributes'],
    ]);
    register_taxonomy('ea_parc_cat', ['ea_parceiro'], [
        'labels' => ['name' => 'Categorias do Clube', 'singular_name' => 'Categoria', 'add_new_item' => 'Nova categoria'],
        'hierarchical' => true, 'show_ui' => true, 'show_admin_column' => true, 'public' => false, 'show_in_rest' => true,
    ]);
    register_post_type('ea_post', [
        'labels' => [
            'name' => 'Posts para redes sociais', 'singular_name' => 'Post', 'add_new' => 'Novo post',
            'add_new_item' => 'Novo post para redes sociais', 'edit_item' => 'Editar post', 'all_items' => 'Posts para redes',
            'featured_image' => 'Imagem do post', 'set_featured_image' => 'Escolher imagem', 'remove_featured_image' => 'Remover imagem',
            'not_found' => 'Nenhum post',
        ],
        'public' => false, 'show_ui' => true, 'show_in_menu' => 'eap-portal', 'show_in_rest' => true,
        'supports' => ['title', 'excerpt', 'thumbnail', 'page-attributes'],
    ]);
});

add_action('admin_menu', function () {
    add_submenu_page('eap-portal', 'Contatos do suporte', 'Contatos do suporte', 'edit_pages', 'eap-suporte', 'eap_suporte_pagina');
}, 20);

/* ------------------------------------------------------------------ campos do parceiro */
add_action('add_meta_boxes', function () {
    add_meta_box('eap_parc_box', 'Benefício e link', 'eap_box_parceiro', 'ea_parceiro', 'normal', 'high');
    add_meta_box('eap_post_box', 'Como usar', function () {
        echo '<p>1. Em <b>Imagem do post</b> (lateral direita), escolha a arte.</p><p>2. Em <b>Resumo</b>, coloque a legenda sugerida (opcional). O dentista vê a arte, copia a legenda e baixa a imagem.</p>';
    }, 'ea_post', 'normal', 'high');
});

function eap_box_parceiro($post) {
    wp_nonce_field('eap_parc', 'eap_parc_nonce');
    $f = fn($k) => esc_attr(get_post_meta($post->ID, $k, true));
    echo '<p><label><b>Benefício em destaque</b> (ex.: 15% OFF)</label><br><input type="text" name="eap_destaque" value="' . $f('_eap_destaque') . '" style="width:200px"></p>';
    echo '<p class="description">A descrição completa vai no campo <b>Resumo</b> logo abaixo (ex.: "15% de desconto em todo o site").</p>';
    echo '<p><label><b>Link do botão</b> (site, WhatsApp ou formulário)</label><br><input type="url" name="eap_link" value="' . $f('_eap_link') . '" style="width:100%"></p>';
    echo '<p><label><b>Texto do botão</b></label><br><input type="text" name="eap_botao" value="' . ($f('_eap_botao') ?: 'Ir para o site') . '" style="width:260px"></p>';
    echo '<p><label><b>Cupom</b> (opcional)</label><br><input type="text" name="eap_cupom" value="' . $f('_eap_cupom') . '" style="width:200px"></p>';
}

add_action('save_post_ea_parceiro', function ($id) {
    if (!isset($_POST['eap_parc_nonce']) || !wp_verify_nonce($_POST['eap_parc_nonce'], 'eap_parc') || !current_user_can('edit_post', $id)) return;
    update_post_meta($id, '_eap_destaque', sanitize_text_field(wp_unslash($_POST['eap_destaque'] ?? '')));
    update_post_meta($id, '_eap_link', esc_url_raw(wp_unslash($_POST['eap_link'] ?? '')));
    update_post_meta($id, '_eap_botao', sanitize_text_field(wp_unslash($_POST['eap_botao'] ?? '')));
    update_post_meta($id, '_eap_cupom', sanitize_text_field(wp_unslash($_POST['eap_cupom'] ?? '')));
});

/* ------------------------------------------------------------------ contatos do suporte */
function eap_suporte_padrao() {
    return [
        'canais' => [
            ['titulo' => 'Suporte', 'texto' => 'Dúvidas sobre o tratamento com os alinhadores Esthetic Aligner.', 'whats' => '11 99155-1104'],
            ['titulo' => 'Laboratório', 'texto' => 'Envio de documentação, início de casos e condução dos casos.', 'whats' => '11 97965-4825'],
            ['titulo' => 'Financeiro', 'texto' => 'Pagamentos, boletos e faturamento dos casos em andamento.', 'whats' => '11 95170-6432'],
            ['titulo' => 'Cursos', 'texto' => 'Credenciamento presencial e cursos de extensão.', 'whats' => '11 94947-5450'],
        ],
        'form' => '1952',
        'faq_cat' => 'duvidas-doutores',
    ];
}
function eap_suporte_cfg() {
    $c = get_option('eap_suporte');
    return is_array($c) ? array_merge(eap_suporte_padrao(), $c) : eap_suporte_padrao();
}
function eap_whats_link($num) {
    $d = eap_digitos($num);
    if ($d === '') return '';
    if (strlen($d) <= 11) $d = '55' . $d;
    return 'https://wa.me/' . $d;
}

function eap_suporte_pagina() {
    if (isset($_POST['eap_sup_salvar']) && check_admin_referer('eap_sup')) {
        $canais = [];
        foreach ((array) ($_POST['canal'] ?? []) as $c) {
            $c = array_map(fn($v) => sanitize_text_field(wp_unslash($v)), (array) $c);
            if (trim($c['titulo'] ?? '') !== '') $canais[] = ['titulo' => $c['titulo'], 'texto' => $c['texto'] ?? '', 'whats' => $c['whats'] ?? ''];
        }
        update_option('eap_suporte', ['canais' => $canais, 'form' => sanitize_text_field(wp_unslash($_POST['form'] ?? '')), 'faq_cat' => sanitize_title(wp_unslash($_POST['faq_cat'] ?? ''))]);
        echo '<div class="notice notice-success"><p>Contatos salvos.</p></div>';
    }
    $cfg = eap_suporte_cfg();
    $canais = $cfg['canais'];
    $canais[] = ['titulo' => '', 'texto' => '', 'whats' => ''];
    ?>
    <div class="wrap"><h1>Contatos do suporte</h1>
    <p>Esses canais aparecem no topo da página Suporte, cada um com botão de WhatsApp. Para remover um canal, apague o título. A última linha em branco serve para adicionar um novo.</p>
    <form method="post"><?php wp_nonce_field('eap_sup'); ?>
    <table class="widefat striped" style="max-width:1000px"><thead><tr><th>Título</th><th>Para que serve</th><th>WhatsApp</th></tr></thead><tbody>
    <?php foreach ($canais as $i => $c) : ?>
      <tr>
        <td><input type="text" name="canal[<?php echo $i; ?>][titulo]" value="<?php echo esc_attr($c['titulo']); ?>" style="width:100%"></td>
        <td><input type="text" name="canal[<?php echo $i; ?>][texto]" value="<?php echo esc_attr($c['texto']); ?>" style="width:100%"></td>
        <td><input type="text" name="canal[<?php echo $i; ?>][whats]" value="<?php echo esc_attr($c['whats']); ?>" placeholder="11 99999-9999" style="width:100%"></td>
      </tr>
    <?php endforeach; ?>
    </tbody></table>
    <h2>Perguntas frequentes e formulário</h2>
    <p>As perguntas vêm do menu <b>FAQ</b> do WordPress (categoria abaixo). Para incluir ou editar uma pergunta, use <a href="<?php echo esc_url(admin_url('edit.php?post_type=faq')); ?>">FAQ</a>.</p>
    <p><label>Categoria das perguntas: <input type="text" name="faq_cat" value="<?php echo esc_attr($cfg['faq_cat']); ?>"></label></p>
    <p><label>Formulário (Contact Form 7), número: <input type="text" name="form" value="<?php echo esc_attr($cfg['form']); ?>" style="width:90px"></label></p>
    <p><button class="button button-primary" name="eap_sup_salvar" value="1">Salvar</button></p>
    </form></div>
    <?php
}

/* ------------------------------------------------------------------ importação: Clube e posts */
add_action('admin_post_eap_importar_clube', function () {
    if (!current_user_can('manage_options') || !check_admin_referer('eap_importar_clube')) wp_die('Sem permissão');
    $n = eap_importar_clube();
    $m = eap_importar_posts_marketing();
    wp_safe_redirect(add_query_arg(['page' => 'eap-importar', 'clube' => $n, 'posts' => $m], admin_url('admin.php')));
    exit;
});

add_action('admin_notices', function () {
    if (($_GET['page'] ?? '') !== 'eap-importar') return;
    if (isset($_GET['clube'])) echo '<div class="notice notice-success"><p>Clube: ' . (int) $_GET['clube'] . ' parceiro(s) novo(s). Posts: ' . (int) ($_GET['posts'] ?? 0) . ' novo(s).</p></div>';
    echo '<div class="notice notice-info"><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" style="padding:8px 0">'
        . wp_nonce_field('eap_importar_clube', '_wpnonce', true, false)
        . '<input type="hidden" name="action" value="eap_importar_clube">'
        . 'Importar também os parceiros do Clube de vantagens e as artes da página Marketing: <button class="button">Importar Clube e posts</button></form></div>';
});

function eap_nome_por_link($url, $logo) {
    $h = parse_url($url, PHP_URL_HOST) ?: '';
    $h = preg_replace('/^www\./', '', $h);
    if ($h && !preg_match('/whatsapp|wa\.me|forms|google|instagram|bit\.ly|linktr/', $h)) {
        $base = explode('.', $h)[0];
        return ucwords(str_replace('-', ' ', $base));
    }
    $f = pathinfo(parse_url($logo, PHP_URL_PATH) ?: '', PATHINFO_FILENAME);
    $f = preg_replace('/(logo|png|transparente|scaled|horiz|pos|af_|whatsapp-image.*|-\d+)/i', ' ', $f);
    $f = trim(preg_replace('/[\s_-]+/', ' ', $f));
    return $f ? ucwords($f) : 'Parceiro';
}

function eap_frase($t) {
    $t = trim(preg_replace('/\s+/', ' ', $t));
    $t = preg_replace('/^credenciado esthetic aligner (tem|têm|possui)\s+/i', '', $t);
    if ($t !== '' && mb_strtoupper($t) === $t) $t = mb_strtoupper(mb_substr(mb_strtolower($t), 0, 1)) . mb_substr(mb_strtolower($t), 1);
    return $t;
}

function eap_importar_clube() {
    $pg = get_page_by_path('eaclub');
    if (!$pg) return 0;
    $c = $pg->post_content;
    $pos = stripos($c, 'EMPRESAS PARCEIRAS');
    if ($pos !== false) $c = substr($c, $pos);
    $partes = preg_split('~(?=\[mk_image\b)~', $c);
    $n = 0;
    $ordem = 0;
    foreach ($partes as $seg) {
        if (!preg_match('~\[mk_image[^\]]*\bsrc="([^"]+)"~', $seg, $mi)) continue;
        $logo = html_entity_decode($mi[1]);
        $url = '';
        $botao = '';
        if (preg_match('~\[mk_button[^\]]*\burl="([^"]*)"[^\]]*\](.*?)\[/mk_button\]~s', $seg, $mb)) { $url = html_entity_decode($mb[1]); $botao = trim(wp_strip_all_tags($mb[2])); }
        $txt = preg_replace('~\[mk_button.*?\[/mk_button\]~s', ' ', $seg);
        $txt = trim(wp_strip_all_tags(preg_replace('~\[[^\]]*\]~', ' ', $txt)));
        if ($txt === '' && !$url) continue;
        $legado = 'parc-' . md5($logo . '|' . $url);
        if (get_posts(['post_type' => 'ea_parceiro', 'meta_key' => '_eap_legado', 'meta_value' => $legado, 'numberposts' => 1, 'post_status' => 'any', 'fields' => 'ids'])) continue;
        $ordem += 10;
        $destaque = preg_match('/(\d+\s?%)/', $txt, $pc) ? str_replace(' ', '', $pc[1]) . ' OFF' : '';
        $id = wp_insert_post(['post_type' => 'ea_parceiro', 'post_status' => 'publish', 'post_title' => eap_nome_por_link($url, $logo), 'post_excerpt' => eap_frase($txt), 'menu_order' => $ordem]);
        if (!$id || is_wp_error($id)) continue;
        $att = attachment_url_to_postid($logo);
        if ($att) set_post_thumbnail($id, $att); else update_post_meta($id, '_eap_logo_url', esc_url_raw($logo));
        update_post_meta($id, '_eap_link', esc_url_raw($url));
        update_post_meta($id, '_eap_botao', $botao ? eap_frase($botao) : 'Ir para o site');
        update_post_meta($id, '_eap_destaque', $destaque);
        update_post_meta($id, '_eap_legado', $legado);
        $n++;
    }
    return $n;
}

function eap_importar_posts_marketing() {
    $pg = get_page_by_path('marketing');
    if (!$pg || !preg_match_all('~\[mk_gallery[^\]]*images="([^"]+)"~', $pg->post_content, $mm)) return 0;
    $n = 0;
    $ordem = 0;
    foreach ($mm[1] as $lista) {
        foreach (array_filter(array_map('intval', explode(',', $lista))) as $att) {
            $legado = 'post-' . $att;
            if (get_posts(['post_type' => 'ea_post', 'meta_key' => '_eap_legado', 'meta_value' => $legado, 'numberposts' => 1, 'post_status' => 'any', 'fields' => 'ids'])) continue;
            $ordem += 10;
            $tit = get_the_title($att) ?: 'Post Esthetic Aligner';
            $id = wp_insert_post(['post_type' => 'ea_post', 'post_status' => 'publish', 'post_title' => $tit, 'menu_order' => $ordem]);
            if (!$id || is_wp_error($id)) continue;
            set_post_thumbnail($id, $att);
            update_post_meta($id, '_eap_legado', $legado);
            $n++;
        }
    }
    return $n;
}

/** Logo do parceiro (imagem destacada ou URL guardada na importação). */
function eap_parceiro_logo($id) {
    if (has_post_thumbnail($id)) return get_the_post_thumbnail_url($id, 'medium');
    return get_post_meta($id, '_eap_logo_url', true);
}
