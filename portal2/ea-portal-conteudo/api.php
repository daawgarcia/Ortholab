<?php
/**
 * API para o app de credenciamento cadastrar a Agenda de cursos e o Clube de vantagens.
 * Autenticação: a mesma chave de serviço já usada pelo app para criar credenciados
 * (opção ea_credenciamento_portal_settings → service_key), enviada como "Authorization: Bearer <chave>".
 *
 *  GET    /wp-json/ea-portal/v1/opcoes
 *  GET    /wp-json/ea-portal/v1/cursos            POST /cursos          (criar)
 *  POST   /wp-json/ea-portal/v1/cursos/<id>       DELETE /cursos/<id>   (editar / mandar para a lixeira)
 *  GET    /wp-json/ea-portal/v1/parceiros         POST /parceiros
 *  POST   /wp-json/ea-portal/v1/parceiros/<id>    DELETE /parceiros/<id>
 * Imagem: "imagem_base64" (data:image/...;base64,...) ou "imagem_url".
 */
if (!defined('ABSPATH')) exit;

function eap_api_auth($req) {
    if (!is_ssl()) return new WP_Error('https', 'A integração exige HTTPS.', ['status' => 403]);
    $s = get_option('ea_credenciamento_portal_settings', []);
    $esperado = (string) ($s['service_key'] ?? '');
    $h = (string) $req->get_header('authorization');
    $dado = strncmp($h, 'Bearer ', 7) === 0 ? substr($h, 7) : '';
    if ($esperado === '' || $dado === '' || !hash_equals($esperado, $dado)) return new WP_Error('nao_autorizado', 'Não autorizado.', ['status' => 401]);
    return true;
}

/** Salva a imagem enviada (base64 ou URL) como imagem destacada do post. */
function eap_api_imagem($post_id, $p, $titulo) {
    require_once ABSPATH . 'wp-admin/includes/media.php'; require_once ABSPATH . 'wp-admin/includes/file.php'; require_once ABSPATH . 'wp-admin/includes/image.php';
    if (!empty($p['imagem_base64']) && preg_match('~^data:image/(png|jpe?g|webp);base64,(.+)$~s', $p['imagem_base64'], $m)) {
        $bin = base64_decode($m[2], true);
        if (!$bin || strlen($bin) > 6 * 1024 * 1024) return new WP_Error('imagem', 'Imagem inválida ou maior que 6 MB.', ['status' => 400]);
        $tmp = wp_tempnam('eap-img'); file_put_contents($tmp, $bin);
        $arq = ['name' => sanitize_title($titulo) . '.' . ($m[1] === 'jpeg' ? 'jpg' : $m[1]), 'tmp_name' => $tmp];
        $id = media_handle_sideload($arq, $post_id, $titulo);
        if (is_wp_error($id)) { @unlink($tmp); return $id; }
        set_post_thumbnail($post_id, $id); return true;
    }
    if (!empty($p['imagem_url'])) {
        $id = media_sideload_image(esc_url_raw($p['imagem_url']), $post_id, $titulo, 'id');
        if (is_wp_error($id)) return $id;
        set_post_thumbnail($post_id, $id);
    }
    return true;
}

// ------------------------------------------------------------ formato de saída
function eap_api_curso_json($p) {
    $m = function_exists('eap_ag_meta') ? eap_ag_meta($p->ID) : [];
    return ['id' => $p->ID, 'titulo' => $p->post_title, 'descricao' => $p->post_content, 'publicado' => $p->post_status === 'publish',
        'data' => $m['data'] ?? '', 'fim' => $m['fim'] ?? '', 'hora_inicio' => $m['hi'] ?? '', 'hora_fim' => $m['hf'] ?? '',
        'formato' => $m['mod'] ?? '', 'cidade' => $m['cidade'] ?? '', 'local' => $m['local'] ?? '', 'ministrado_por' => $m['quem'] ?? '',
        'link' => $m['link'] ?? '', 'texto_botao' => $m['btn'] ?? '', 'situacao' => $m['status'] ?? '', 'destaque' => !empty($m['destaque']),
        'imagem' => get_the_post_thumbnail_url($p, 'medium_large') ?: ''];
}
function eap_api_parceiro_json($p) {
    $c = wp_get_post_terms($p->ID, 'ea_parc_cat', ['fields' => 'names']);
    return ['id' => $p->ID, 'nome' => $p->post_title, 'descricao' => $p->post_content, 'publicado' => $p->post_status === 'publish',
        'beneficio' => (string) get_post_meta($p->ID, '_eap_destaque', true), 'link' => (string) get_post_meta($p->ID, '_eap_link', true),
        'texto_botao' => (string) get_post_meta($p->ID, '_eap_botao', true), 'cupom' => (string) get_post_meta($p->ID, '_eap_cupom', true),
        'categoria' => is_wp_error($c) ? '' : (string) ($c[0] ?? ''), 'imagem' => get_the_post_thumbnail_url($p, 'medium') ?: ''];
}

// ------------------------------------------------------------ gravação
function eap_api_salvar_curso($p, $id = 0) {
    $t = fn($k) => isset($p[$k]) ? sanitize_text_field((string) $p[$k]) : null;
    if (!$id && (!$t('titulo') || !preg_match('~^\d{4}-\d{2}-\d{2}$~', (string) $t('data')))) return new WP_Error('dados', 'Informe pelo menos o título e a data (AAAA-MM-DD).', ['status' => 400]);
    $post = ['post_type' => 'ea_curso'];
    if ($t('titulo') !== null) $post['post_title'] = $t('titulo');
    if (isset($p['descricao'])) $post['post_content'] = wp_kses_post((string) $p['descricao']);
    if (isset($p['publicado'])) $post['post_status'] = $p['publicado'] ? 'publish' : 'draft';
    elseif (!$id) $post['post_status'] = 'publish';
    if ($id) { $post['ID'] = $id; $r = wp_update_post($post, true); } else $r = wp_insert_post($post, true);
    if (is_wp_error($r)) return $r;
    $id = (int) $r;
    $mapa = ['data' => 'data', 'fim' => 'fim', 'hora_inicio' => 'hi', 'hora_fim' => 'hf', 'cidade' => 'cidade', 'local' => 'local', 'ministrado_por' => 'quem', 'texto_botao' => 'btn'];
    foreach ($mapa as $k => $meta) {
        if ($t($k) === null) continue; $v = $t($k);
        if (in_array($k, ['data', 'fim'], true) && $v !== '' && !preg_match('~^\d{4}-\d{2}-\d{2}$~', $v)) continue;
        if (in_array($k, ['hora_inicio', 'hora_fim'], true) && $v !== '' && !preg_match('~^\d{2}:\d{2}$~', $v)) continue;
        update_post_meta($id, '_eap_ag_' . $meta, mb_substr($v, 0, 160));
    }
    if ($t('formato') !== null && isset(EAP_AG_MOD[$t('formato')])) update_post_meta($id, '_eap_ag_mod', $t('formato'));
    if ($t('situacao') !== null && isset(EAP_AG_STATUS[$t('situacao')])) update_post_meta($id, '_eap_ag_status', $t('situacao'));
    if (isset($p['destaque'])) update_post_meta($id, '_eap_ag_destaque', $p['destaque'] ? '1' : '');
    if ($t('link') !== null) { $l = trim($t('link')); update_post_meta($id, '_eap_ag_link', preg_match('~^[\d\s()+-]{10,}$~', $l) ? $l : esc_url_raw($l)); }
    if (!get_post_meta($id, '_eap_ag_status', true)) update_post_meta($id, '_eap_ag_status', 'abertas');
    if (!get_post_meta($id, '_eap_ag_mod', true)) update_post_meta($id, '_eap_ag_mod', 'presencial');
    $img = eap_api_imagem($id, $p, get_the_title($id));
    if (is_wp_error($img)) return $img;
    return eap_api_curso_json(get_post($id));
}
function eap_api_salvar_parceiro($p, $id = 0) {
    $t = fn($k) => isset($p[$k]) ? sanitize_text_field((string) $p[$k]) : null;
    if (!$id && !$t('nome')) return new WP_Error('dados', 'Informe o nome do parceiro.', ['status' => 400]);
    $post = ['post_type' => 'ea_parceiro'];
    if ($t('nome') !== null) $post['post_title'] = $t('nome');
    if (isset($p['descricao'])) $post['post_content'] = wp_kses_post((string) $p['descricao']);
    if (isset($p['publicado'])) $post['post_status'] = $p['publicado'] ? 'publish' : 'draft';
    elseif (!$id) $post['post_status'] = 'publish';
    if ($id) { $post['ID'] = $id; $r = wp_update_post($post, true); } else $r = wp_insert_post($post, true);
    if (is_wp_error($r)) return $r;
    $id = (int) $r;
    foreach (['beneficio' => '_eap_destaque', 'texto_botao' => '_eap_botao', 'cupom' => '_eap_cupom'] as $k => $meta) if ($t($k) !== null) update_post_meta($id, $meta, $t($k));
    if ($t('link') !== null) update_post_meta($id, '_eap_link', esc_url_raw($t('link')));
    if ($t('categoria') !== null) wp_set_object_terms($id, $t('categoria') !== '' ? [$t('categoria')] : [], 'ea_parc_cat');
    $img = eap_api_imagem($id, $p, get_the_title($id));
    if (is_wp_error($img)) return $img;
    return eap_api_parceiro_json(get_post($id));
}

// ------------------------------------------------------------ rotas
add_action('rest_api_init', function () {
    $ns = 'ea-portal/v1';
    $auth = 'eap_api_auth';
    register_rest_route($ns, '/opcoes', ['methods' => 'GET', 'permission_callback' => $auth, 'callback' => fn() => [
        'formatos' => EAP_AG_MOD, 'situacoes' => EAP_AG_STATUS,
        'categorias_clube' => array_values(array_map(fn($t) => $t->name, get_terms(['taxonomy' => 'ea_parc_cat', 'hide_empty' => false]) ?: [])),
        'pagina_agenda' => home_url('/agenda-de-cursos/'), 'pagina_clube' => home_url('/eaclub/'),
    ]]);
    foreach (['cursos' => ['ea_curso', 'eap_api_curso_json', 'eap_api_salvar_curso'], 'parceiros' => ['ea_parceiro', 'eap_api_parceiro_json', 'eap_api_salvar_parceiro']] as $rota => [$tipo, $json, $salvar]) {
        register_rest_route($ns, '/' . $rota, [
            ['methods' => 'GET', 'permission_callback' => $auth, 'callback' => function () use ($tipo, $json) {
                $args = ['post_type' => $tipo, 'post_status' => ['publish', 'draft'], 'numberposts' => 300];
                if ($tipo === 'ea_curso') $args += ['meta_key' => '_eap_ag_data', 'orderby' => 'meta_value', 'order' => 'DESC']; else $args += ['orderby' => 'title', 'order' => 'ASC'];
                return array_map($json, get_posts($args));
            }],
            ['methods' => 'POST', 'permission_callback' => $auth, 'callback' => fn($r) => $salvar((array) $r->get_json_params())],
        ]);
        register_rest_route($ns, '/' . $rota . '/(?P<id>\d+)', [
            ['methods' => 'POST', 'permission_callback' => $auth, 'callback' => function ($r) use ($tipo, $salvar) {
                $id = (int) $r['id']; if (get_post_type($id) !== $tipo) return new WP_Error('nao_encontrado', 'Não encontrado.', ['status' => 404]);
                return $salvar((array) $r->get_json_params(), $id);
            }],
            ['methods' => 'DELETE', 'permission_callback' => $auth, 'callback' => function ($r) use ($tipo) {
                $id = (int) $r['id']; if (get_post_type($id) !== $tipo) return new WP_Error('nao_encontrado', 'Não encontrado.', ['status' => 404]);
                wp_trash_post($id); return ['ok' => true, 'id' => $id];
            }],
        ]);
    }
});
