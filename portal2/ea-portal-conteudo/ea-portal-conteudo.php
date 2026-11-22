<?php
/**
 * Plugin Name: EA Portal – Conteúdo do Credenciado
 * Description: Vídeo aulas e materiais (downloads/marketing) do Portal do Credenciado, com cadastro simples para a equipe. Inclui importação do conteúdo das páginas antigas.
 * Version: 1.1.0
 * Author: Esthetic Aligner
 * Text Domain: ea-portal
 */

if (!defined('ABSPATH')) exit;

define('EAP_VERSION', '1.1.0');
require_once __DIR__ . '/sso.php';
require_once __DIR__ . '/clube-suporte.php';
require_once __DIR__ . '/confirmar-dados.php';
require_once __DIR__ . '/visibilidade.php';
require_once __DIR__ . '/temas.php';

/* ------------------------------------------------------------------ tipos de conteúdo */
add_action('init', function () {
    register_post_type('ea_aula', [
        'labels' => [
            'name' => 'Vídeo aulas', 'singular_name' => 'Vídeo aula', 'add_new' => 'Nova aula',
            'add_new_item' => 'Nova vídeo aula', 'edit_item' => 'Editar vídeo aula', 'all_items' => 'Vídeo aulas',
            'search_items' => 'Buscar aulas', 'not_found' => 'Nenhuma aula',
        ],
        'public' => true, 'publicly_queryable' => true, 'show_ui' => true, 'show_in_menu' => 'eap-portal',
        'exclude_from_search' => true, 'has_archive' => false, 'rewrite' => ['slug' => 'aula'],
        'supports' => ['title', 'excerpt', 'thumbnail', 'page-attributes'], 'menu_icon' => 'dashicons-video-alt3',
        'show_in_rest' => true,
    ]);
    register_taxonomy('ea_trilha', ['ea_aula'], [
        'labels' => ['name' => 'Categorias de aula', 'singular_name' => 'Categoria', 'add_new_item' => 'Nova categoria'],
        'hierarchical' => true, 'show_ui' => true, 'show_admin_column' => true, 'public' => false, 'show_in_rest' => true,
    ]);
    register_post_type('ea_material', [
        'labels' => [
            'name' => 'Materiais e downloads', 'singular_name' => 'Material', 'add_new' => 'Novo material',
            'add_new_item' => 'Novo material', 'edit_item' => 'Editar material', 'all_items' => 'Materiais e downloads',
            'not_found' => 'Nenhum material',
        ],
        'public' => false, 'show_ui' => true, 'show_in_menu' => 'eap-portal',
        'supports' => ['title', 'excerpt', 'page-attributes'], 'show_in_rest' => true,
    ]);
    register_taxonomy('ea_secao', ['ea_material'], [
        'labels' => ['name' => 'Seções de materiais', 'singular_name' => 'Seção', 'add_new_item' => 'Nova seção'],
        'hierarchical' => true, 'show_ui' => true, 'show_admin_column' => true, 'public' => false, 'show_in_rest' => true,
    ]);
});

/* ------------------------------------------------------------------ menu simples para a equipe */
add_action('admin_menu', function () {
    add_menu_page('Portal do Credenciado', 'Portal do Credenciado', 'edit_pages', 'eap-portal', 'eap_pagina_inicio', 'dashicons-id-alt', 3);
    add_submenu_page('eap-portal', 'Início', 'Início', 'edit_pages', 'eap-portal', 'eap_pagina_inicio');
    add_submenu_page('eap-portal', 'Categorias de aula', 'Categorias de aula', 'edit_pages', 'edit-tags.php?taxonomy=ea_trilha&post_type=ea_aula');
    add_submenu_page('eap-portal', 'Seções e temas de materiais', 'Seções e temas', 'edit_pages', 'edit-tags.php?taxonomy=ea_secao&post_type=ea_material');
    add_submenu_page('eap-portal', 'Importar conteúdo antigo', 'Importar conteúdo antigo', 'manage_options', 'eap-importar', 'eap_pagina_importar');
});

// mantém o menu aberto quando se edita uma categoria/seção
add_filter('parent_file', function ($parent) {
    global $current_screen;
    if ($current_screen && in_array($current_screen->taxonomy, ['ea_trilha', 'ea_secao'], true)) return 'eap-portal';
    return $parent;
});

function eap_pagina_inicio() {
    $aulas = wp_count_posts('ea_aula')->publish ?? 0;
    $mat = wp_count_posts('ea_material')->publish ?? 0;
    ?>
    <div class="wrap eap-admin">
        <h1>Portal do Credenciado</h1>
        <p class="eap-sub">Tudo o que você cadastrar aqui aparece no portal na hora, já com o layout novo.</p>
        <div class="eap-cards">
            <a class="eap-card" href="<?php echo esc_url(admin_url('post-new.php?post_type=ea_aula')); ?>">
                <span class="dashicons dashicons-video-alt3"></span><strong>Nova vídeo aula</strong>
                <em>Título + link do Vimeo/YouTube (ou arquivo MP4) + categoria</em></a>
            <a class="eap-card" href="<?php echo esc_url(admin_url('edit.php?post_type=ea_aula')); ?>">
                <span class="dashicons dashicons-playlist-video"></span><strong><?php echo (int) $aulas; ?> vídeo aulas</strong>
                <em>Ver, editar, reordenar ou esconder</em></a>
            <a class="eap-card" href="<?php echo esc_url(admin_url('post-new.php?post_type=ea_material')); ?>">
                <span class="dashicons dashicons-media-document"></span><strong>Novo material</strong>
                <em>Título + arquivo (PDF, ZIP, imagem) + seção</em></a>
            <a class="eap-card" href="<?php echo esc_url(admin_url('edit.php?post_type=ea_material')); ?>">
                <span class="dashicons dashicons-download"></span><strong><?php echo (int) $mat; ?> materiais</strong>
                <em>Downloads e marketing</em></a>
            <a class="eap-card" href="<?php echo esc_url(home_url('/area-do-credenciado/')); ?>" target="_blank">
                <span class="dashicons dashicons-external"></span><strong>Ver o portal</strong>
                <em>Abre a Área do Credenciado</em></a>
        </div>
        <h2>Como funciona</h2>
        <ol class="eap-help">
            <li><b>Ordem:</b> no campo "Ordem" (lateral direita da aula/material), números menores aparecem primeiro.</li>
            <li><b>Esconder sem apagar:</b> mude o status para "Rascunho".</li>
            <li><b>Capa da aula:</b> opcional. Sem capa, o portal usa a do Vimeo/YouTube automaticamente.</li>
        </ol>
    </div>
    <?php
}

add_action('admin_head', function () {
    echo '<style>
    .eap-admin .eap-sub{font-size:14px;color:#50575e;margin:4px 0 20px}
    .eap-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;max-width:1100px}
    .eap-card{display:flex;flex-direction:column;gap:6px;padding:18px;border-radius:12px;background:#fff;border:1px solid #dcdcde;text-decoration:none;color:#1d2327;transition:.15s}
    .eap-card:hover{border-color:#2f6fe4;box-shadow:0 6px 18px rgba(47,111,228,.12);color:#1d2327}
    .eap-card .dashicons{font-size:28px;width:28px;height:28px;color:#2f6fe4}
    .eap-card strong{font-size:15px}.eap-card em{font-style:normal;color:#646970;font-size:12.5px}
    .eap-help{font-size:13.5px;max-width:800px}
    #eap_aula_box input[type=url],#eap_mat_box input[type=url]{width:100%}
    </style>';
});

/* ------------------------------------------------------------------ campos */
add_action('add_meta_boxes', function () {
    add_meta_box('eap_aula_box', 'Vídeo da aula', 'eap_box_aula', 'ea_aula', 'normal', 'high');
    add_meta_box('eap_mat_box', 'Arquivo do material', 'eap_box_material', 'ea_material', 'normal', 'high');
});

function eap_box_aula($post) {
    wp_nonce_field('eap_salvar', 'eap_nonce');
    $v = get_post_meta($post->ID, '_eap_video', true);
    $d = get_post_meta($post->ID, '_eap_duracao', true);
    echo '<p><label><b>Link do vídeo</b> (Vimeo, YouTube ou MP4)</label><br><input type="url" name="eap_video" value="' . esc_attr($v) . '" placeholder="https://vimeo.com/123456789"></p>';
    echo '<p><button type="button" class="button" id="eap_mp4">Enviar/escolher arquivo MP4</button></p>';
    echo '<p><label><b>Duração</b> (opcional, ex.: 12 min)</label><br><input type="text" name="eap_duracao" value="' . esc_attr($d) . '" style="width:140px"></p>';
    echo '<p class="description">O resumo (campo "Resumo") aparece abaixo do vídeo no portal.</p>';
    eap_script_midia('eap_mp4', 'eap_video', 'video');
}

function eap_box_material($post) {
    wp_nonce_field('eap_salvar', 'eap_nonce');
    $f = get_post_meta($post->ID, '_eap_arquivo', true);
    echo '<p><label><b>Arquivo ou link</b></label><br><input type="url" name="eap_arquivo" value="' . esc_attr($f) . '" placeholder="https://..."></p>';
    echo '<p><button type="button" class="button" id="eap_arq">Enviar/escolher arquivo</button></p>';
    eap_script_midia('eap_arq', 'eap_arquivo', '');
}

function eap_script_midia($botao, $campo, $tipo) {
    wp_enqueue_media();
    ?>
    <script>
    jQuery(function ($) {
        $('#<?php echo esc_js($botao); ?>').on('click', function (e) {
            e.preventDefault();
            const f = wp.media({ title: 'Escolher arquivo', button: { text: 'Usar este arquivo' }, multiple: false<?php echo $tipo ? ", library: { type: '" . esc_js($tipo) . "' }" : ''; ?> });
            f.on('select', function () { $('input[name=<?php echo esc_js($campo); ?>]').val(f.state().get('selection').first().toJSON().url); });
            f.open();
        });
    });
    </script>
    <?php
}

add_action('save_post', function ($id) {
    if (!isset($_POST['eap_nonce']) || !wp_verify_nonce($_POST['eap_nonce'], 'eap_salvar')) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (!current_user_can('edit_post', $id)) return;
    foreach (['eap_video' => '_eap_video', 'eap_arquivo' => '_eap_arquivo'] as $campo => $meta) {
        if (isset($_POST[$campo])) update_post_meta($id, $meta, esc_url_raw(trim(wp_unslash($_POST[$campo]))));
    }
    if (isset($_POST['eap_duracao'])) update_post_meta($id, '_eap_duracao', sanitize_text_field(wp_unslash($_POST['eap_duracao'])));
});

// colunas úteis na lista
add_filter('manage_ea_aula_posts_columns', function ($c) {
    $c['eap_ordem'] = 'Ordem';
    return $c;
});
add_action('manage_ea_aula_posts_custom_column', function ($col, $id) {
    if ($col === 'eap_ordem') echo (int) get_post_field('menu_order', $id);
}, 10, 2);
add_filter('manage_ea_material_posts_columns', function ($c) {
    $c['eap_ordem'] = 'Ordem';
    $c['eap_arquivo'] = 'Arquivo';
    return $c;
});
add_action('manage_ea_material_posts_custom_column', function ($col, $id) {
    if ($col === 'eap_ordem') echo (int) get_post_field('menu_order', $id);
    if ($col === 'eap_arquivo') { $f = get_post_meta($id, '_eap_arquivo', true); if ($f) echo '<a href="' . esc_url($f) . '" target="_blank">' . esc_html(basename(parse_url($f, PHP_URL_PATH))) . '</a>'; }
}, 10, 2);
add_action('pre_get_posts', function ($q) {
    if (is_admin() && $q->is_main_query() && in_array($q->get('post_type'), ['ea_aula', 'ea_material'], true) && !$q->get('orderby')) {
        $q->set('orderby', ['menu_order' => 'ASC', 'date' => 'DESC']);
    }
});

/* ------------------------------------------------------------------ ajudas para o tema */
function eap_video_embed($url, $autoplay = false) {
    $url = trim((string) $url);
    if (!$url) return '';
    if (preg_match('~vimeo\.com/(?:video/)?(\d+)~', $url, $m)) {
        return '<iframe src="https://player.vimeo.com/video/' . $m[1] . '?dnt=1&title=0&byline=0&portrait=0' . ($autoplay ? '&autoplay=1' : '') . '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
    }
    if (preg_match('~(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([\w-]{6,})~', $url, $m)) {
        return '<iframe src="https://www.youtube-nocookie.com/embed/' . $m[1] . '?rel=0' . ($autoplay ? '&autoplay=1' : '') . '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
    }
    return '<video src="' . esc_url($url) . '" controls preload="metadata" playsinline></video>';
}

/** Capa: imagem destacada > capa do Vimeo/YouTube (guardada em cache) > vazio. */
function eap_video_capa($post_id) {
    if (has_post_thumbnail($post_id)) return function_exists('eapt_thumb_url') ? eapt_thumb_url($post_id, 'medium_large') : get_the_post_thumbnail_url($post_id, 'medium_large');
    $url = get_post_meta($post_id, '_eap_video', true);
    $cache = get_post_meta($post_id, '_eap_capa_auto', true);
    if ($cache && strpos($cache, '|') !== false) { [$fonte, $img] = explode('|', $cache, 2); if ($fonte === md5($url)) return $img; }
    $img = '';
    if (preg_match('~(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([\w-]{6,})~', $url, $m)) {
        $img = 'https://i.ytimg.com/vi/' . $m[1] . '/hqdefault.jpg';
    } elseif (preg_match('~vimeo\.com/(?:video/)?(\d+)~', $url, $m)) {
        $r = wp_remote_get('https://vimeo.com/api/oembed.json?url=' . rawurlencode('https://vimeo.com/' . $m[1]) . '&width=640', ['timeout' => 6]);
        if (!is_wp_error($r)) { $j = json_decode(wp_remote_retrieve_body($r), true); $img = $j['thumbnail_url'] ?? ''; }
    }
    update_post_meta($post_id, '_eap_capa_auto', md5($url) . '|' . $img);
    return $img;
}

function eap_aulas_por_trilha() {
    $trilhas = get_terms(['taxonomy' => 'ea_trilha', 'hide_empty' => true, 'orderby' => 'term_order']);
    if (is_wp_error($trilhas)) $trilhas = [];
    usort($trilhas, fn($a, $b) => ((int) get_term_meta($a->term_id, 'eap_ordem', true)) <=> ((int) get_term_meta($b->term_id, 'eap_ordem', true)));
    $out = [];
    foreach ($trilhas as $t) {
        $q = get_posts(['post_type' => 'ea_aula', 'numberposts' => -1, 'tax_query' => [['taxonomy' => 'ea_trilha', 'terms' => $t->term_id]], 'orderby' => ['menu_order' => 'ASC', 'date' => 'DESC']]);
        if ($q) $out[] = ['trilha' => $t, 'aulas' => $q];
    }
    return $out;
}

function eap_tamanho_arquivo($url) {
    $up = wp_get_upload_dir();
    if (strpos($url, $up['baseurl']) === 0) {
        $p = $up['basedir'] . substr(parse_url($url, PHP_URL_PATH), strlen(parse_url($up['baseurl'], PHP_URL_PATH)));
        if (file_exists($p)) return size_format(filesize($p), 0);
    }
    return '';
}

/* ------------------------------------------------------------------ importação do conteúdo antigo */
function eap_pagina_importar() {
    $res = null;
    if (isset($_POST['eap_importar']) && check_admin_referer('eap_importar')) $res = eap_importar();
    ?>
    <div class="wrap">
        <h1>Importar conteúdo das páginas antigas</h1>
        <p>Lê as páginas atuais (Vídeo aulas do curso, Webinars/Mentorias, Dicas clínicas, Podcast, Downloads e Marketing) e cria as aulas e materiais no novo cadastro. Pode rodar mais de uma vez: o que já foi importado não é duplicado. As páginas antigas não são alteradas.</p>
        <?php if ($res) : ?>
            <div class="notice notice-success"><p><?php echo esc_html($res); ?></p></div>
        <?php endif; ?>
        <form method="post"><?php wp_nonce_field('eap_importar'); ?>
            <p><button class="button button-primary" name="eap_importar" value="1">Importar agora</button></p>
        </form>
    </div>
    <?php
}

function eap_termo($tax, $nome, $ordem) {
    $t = term_exists($nome, $tax);
    if (!$t) $t = wp_insert_term($nome, $tax);
    $id = is_array($t) ? (int) $t['term_id'] : (int) $t;
    if ($id && get_term_meta($id, 'eap_ordem', true) === '') update_term_meta($id, 'eap_ordem', $ordem);
    return $id;
}

function eap_video_do_conteudo($content) {
    if (preg_match('~\[vc_video[^\]]*\blink="([^"]+)"~', $content, $m)) return $m[1];
    if (preg_match('~\[vc_video[^\]]*\bmp4="([^"]+)"~', $content, $m)) return $m[1];
    if (preg_match('~<iframe[^>]+src="([^"]*(?:vimeo|youtube|youtu\.be)[^"]*)"~i', $content, $m)) return $m[1];
    if (preg_match('~https?://(?:www\.)?(?:vimeo\.com/\d+|youtu\.be/[\w-]+|youtube\.com/watch\?v=[\w-]+)~', $content, $m)) return $m[0];
    if (preg_match('~(?:src|mp4)="([^"]+\.mp4)"~i', $content, $m)) return $m[1];
    return '';
}

function eap_capa_do_conteudo($content) {
    if (preg_match('~thumbnail_image="(\d+)"~', $content, $m)) return (int) $m[1];
    return 0;
}

/** Links de páginas internas de uma página "índice", na ordem em que aparecem. */
function eap_links_internos($content) {
    // pega URLs tanto do HTML renderizado quanto dos atributos dos shortcodes (url="", link="", href="")
    // títulos das seções do acordeão (vc_tta_section) para cada botão de dentro delas
    $tit_secao = [];
    if (preg_match_all('~\[vc_tta_section[^\]]*title="([^"]*)"[^\]]*\](.*?)\[/vc_tta_section\]~is', $content, $secs, PREG_SET_ORDER)) {
        foreach ($secs as $sec) {
            if (preg_match_all('~link="url:([^|"]+)~', $sec[2], $bl)) foreach ($bl[1] as $u) $tit_secao[rawurldecode($u)] = html_entity_decode($sec[1]);
        }
    }
    // links do WPBakery vêm codificados: link="url:https%3A%2F%2F...|title:..."
    $content = preg_replace_callback('~link="url:([^|"]+)[^"]*"~', fn($m) => 'link="' . rawurldecode($m[1]) . '"', $content);
    $fontes = $content . "\n" . do_shortcode($content);
    preg_match_all('~(?:href|url|link)\s*=\s*["\']([^"\'#\s]+)["\']~i', $fontes, $mm);
    preg_match_all('~(?:href|url|link)\s*=\s*["\']([^"\'#\s]+)["\'][^>\]]*[>\]]([^<\[]{0,140})~i', $fontes, $tx, PREG_SET_ORDER);
    $textos = [];
    foreach ($tx as $t) { $k = $t[1]; if (!isset($textos[$k]) && trim(wp_strip_all_tags($t[2])) !== '') $textos[$k] = trim(wp_strip_all_tags($t[2])); }
    $vistos = [];
    $out = [];
    foreach ($mm[1] as $url) {
        $url = html_entity_decode($url);
        if (strpos($url, 'http') !== 0 && strpos($url, '/') === 0) $url = home_url($url);
        // links antigos com o domínio do portal oficial
        $url = preg_replace('~^https?://(www\.)?portal\.estheticaligner\.com\.br~', untrailingslashit(home_url()), $url);
        $texto = $tit_secao[$url] ?? ($textos[$url] ?? '');
        // link direto para um vídeo (MP4, mídia protegida, Vimeo, YouTube)
        if (preg_match('~\.(mp4|mov|webm)(\?|$)|/secure-media/\d+|vimeo\.com/\d+|youtu\.?be~i', $url)) {
            if (isset($vistos[$url])) continue;
            $vistos[$url] = true;
            $out[] = ['id' => 0, 'video' => $url, 'texto' => $texto];
            continue;
        }
        $id = url_to_postid($url);
        if (!$id) { $p = get_page_by_path(trim((string) parse_url($url, PHP_URL_PATH), '/')); if ($p) $id = $p->ID; }
        if (!$id) { $p = get_page_by_path(basename(trim((string) parse_url($url, PHP_URL_PATH), '/'))); if ($p) $id = $p->ID; }
        if (!$id || isset($vistos[$id])) continue;
        $vistos[$id] = true;
        $out[] = ['id' => $id, 'texto' => $texto];
    }
    return $out;
}

function eap_criar_aula($legado, $titulo, $video, $trilha_id, $ordem, $capa = 0, $resumo = '') {
    $existe = get_posts(['post_type' => 'ea_aula', 'meta_key' => '_eap_legado', 'meta_value' => $legado, 'numberposts' => 1, 'post_status' => 'any', 'fields' => 'ids']);
    if ($existe) return 0;
    $id = wp_insert_post(['post_type' => 'ea_aula', 'post_status' => 'publish', 'post_title' => $titulo, 'menu_order' => $ordem, 'post_excerpt' => $resumo]);
    if (!$id || is_wp_error($id)) return 0;
    update_post_meta($id, '_eap_video', $video);
    update_post_meta($id, '_eap_legado', $legado);
    if ($capa) set_post_thumbnail($id, $capa);
    wp_set_object_terms($id, [$trilha_id], 'ea_trilha');
    return 1;
}

function eap_importar() {
    $n_aulas = 0;
    $n_mat = 0;

    // 1) Curso (as 13 aulas da página Vídeo Aulas), na ordem do curso
    $curso = eap_termo('ea_trilha', 'Curso do Credenciado', 1);
    $aulas_curso = ['apresentacao-do-sistema', 'casos-clinicos-2', 'como-precificar', 'app-esthetic-aligner', 'iniciando-um-caso',
        'a-chegada-dos-alinhadores', 'instalando-os-alinhadores', 'compreendendo-os-alinhadores', 'procedimentos-clinicos',
        'hands-on', 'duvidas-frequentes', 'marketing-2', 'finalizacao'];
    foreach ($aulas_curso as $i => $slug) {
        $p = get_page_by_path($slug);
        if (!$p) continue;
        $v = eap_video_do_conteudo($p->post_content);
        if ($v) $n_aulas += eap_criar_aula('page-' . $p->ID, sprintf('Aula %02d – %s', $i + 1, get_the_title($p)), $v, $curso, $i + 1, eap_capa_do_conteudo($p->post_content));
    }

    // 2) Índices: cada link interno com vídeo vira uma aula da categoria
    $indices = [
        ['video-aula', 'Webinars e Mentorias', 2],
        ['dicas-clinicas', 'Dicas Clínicas', 3],
        ['podcast-esthetic-aligner', 'Podcast Esthetic Aligner', 4],
        ['webinar', 'Webinars e Mentorias', 2],
    ];
    foreach ($indices as [$slug, $nome, $ord]) {
        $idx = get_page_by_path($slug);
        if (!$idx) continue;
        $tid = eap_termo('ea_trilha', $nome, $ord);
        $pos = 0;
        foreach (eap_links_internos($idx->post_content) as $lk) {
            if (!empty($lk['video'])) {
                $pos++;
                $tit = $lk['texto'] ?: ucfirst(str_replace(['-', '_'], ' ', preg_replace('~^dc-|\.mp4$~i', '', basename(parse_url($lk['video'], PHP_URL_PATH)))));
                $n_aulas += eap_criar_aula('vid-' . md5($lk['video']), html_entity_decode($tit), $lk['video'], $tid, $pos * 10);
                continue;
            }
            $p = get_post($lk['id']);
            if (!$p || $p->post_type !== 'page') continue;
            $v = eap_video_do_conteudo($p->post_content);
            if (!$v) continue;
            $pos++;
            $titulo = $lk['texto'] && stripos($lk['texto'], 'assista') === false ? $lk['texto'] : get_the_title($p);
            $n_aulas += eap_criar_aula('page-' . $p->ID, html_entity_decode($titulo), $v, $tid, $pos * 10, eap_capa_do_conteudo($p->post_content));
        }
    }

    // 3) Materiais: links para arquivos em Downloads e Marketing
    foreach ([['downloads', 'Downloads', 1], ['marketing', 'Marketing', 2]] as [$slug, $nome, $ord]) {
        $idx = get_page_by_path($slug);
        if (!$idx) continue;
        $sid = eap_termo('ea_secao', $nome, $ord);
        $bruto = preg_replace_callback('~link="url:([^|"]+)[^"]*"~', fn($m) => 'link="' . rawurldecode($m[1]) . '"', $idx->post_content);
        $html = do_shortcode($idx->post_content) . "\n" . $bruto;
        preg_match_all('~(?:href|url|link)\s*=\s*["\']([^"\']+\.(?:pdf|zip|rar|jpg|jpeg|png|mp4|pptx?|docx?|xlsx?))["\'][^>\]]*[>\]]([^<\[]{0,160})~is', $html, $mm, PREG_SET_ORDER);
        $pos = 0;
        foreach ($mm as $m) {
            $url = preg_replace('~^https?://(www\.)?portal\.estheticaligner\.com\.br~', untrailingslashit(home_url()), html_entity_decode($m[1]));
            $titulo = trim(preg_replace('~\s*\((?:\d+[\.,]?\d*\s*(?:kb|mb|gb|k))\)\s*$~i', '', wp_strip_all_tags($m[2])));
            if ($titulo === '' || strlen($titulo) < 3) $titulo = basename(parse_url($url, PHP_URL_PATH));
            $legado = 'arq-' . md5($url);
            if (get_posts(['post_type' => 'ea_material', 'meta_key' => '_eap_legado', 'meta_value' => $legado, 'numberposts' => 1, 'post_status' => 'any', 'fields' => 'ids'])) continue;
            $pos++;
            $id = wp_insert_post(['post_type' => 'ea_material', 'post_status' => 'publish', 'post_title' => html_entity_decode($titulo), 'menu_order' => $pos * 10]);
            if (!$id || is_wp_error($id)) continue;
            update_post_meta($id, '_eap_arquivo', $url);
            update_post_meta($id, '_eap_legado', $legado);
            wp_set_object_terms($id, [$sid], 'ea_secao');
            $n_mat++;
        }
    }
    return sprintf('Importação concluída: %d aula(s) e %d material(is) novos.', $n_aulas, $n_mat);
}
