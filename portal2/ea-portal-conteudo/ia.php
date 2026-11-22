<?php
/**
 * Assistente EA: IA que responde SÓ com o conteúdo do portal (perguntas frequentes, PDFs dos materiais e catálogo de aulas),
 * sempre com a fonte. Sem fonte encontrada, não responde e oferece o suporte. Não faz diagnóstico.
 * Fornecedor: OpenAI (Responses API + busca em arquivos). Tudo fica registrado para a equipe revisar.
 */
if (!defined('ABSPATH')) exit;

/* ------------------------------------------------------------------ configuração */
function eap_ia_cfg() {
    $c = get_option('eap_ia');
    return array_merge(['fornecedor' => 'openai', 'modelo' => 'gpt-5.4-mini', 'acesso' => 'equipe', 'limite' => 20, 'ativo' => 0], is_array($c) ? $c : []);
}
function eap_ia_chave() { return (string) get_option('eap_ia_chave', ''); }
function eap_ia_base() { $b = get_option('eap_ia_base'); return is_array($b) ? $b : ['vs' => '', 'itens' => []]; }
function eap_ia_pode($uid = 0) {
    $uid = $uid ?: get_current_user_id();
    $c = eap_ia_cfg();
    if (!$uid || !$c['ativo'] || !eap_ia_chave() || !eap_ia_base()['vs']) return false;
    if (function_exists('eap_visivel') && !eap_visivel('assistente')) return false;
    return $c['acesso'] === 'todos' || user_can($uid, 'edit_pages');
}

/* ------------------------------------------------------------------ chamadas à OpenAI */
function eap_ia_api($metodo, $caminho, $corpo = null, $multipart = null, $timeout = 60) {
    $h = ['Authorization' => 'Bearer ' . eap_ia_chave()];
    $args = ['method' => $metodo, 'timeout' => $timeout, 'headers' => $h];
    if ($multipart) {
        $b = wp_generate_password(24, false);
        $args['headers']['Content-Type'] = 'multipart/form-data; boundary=' . $b;
        $campos = $multipart['campos'] ?? ['purpose' => 'assistants']; $corpo_mp = '';
        foreach ($campos as $ck => $cv) $corpo_mp .= "--$b\r\nContent-Disposition: form-data; name=\"$ck\"\r\n\r\n$cv\r\n";
        $args['body'] = $corpo_mp
            . "--$b\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" . str_replace('"', '', $multipart['nome']) . "\"\r\nContent-Type: application/octet-stream\r\n\r\n"
            . $multipart['dados'] . "\r\n--$b--\r\n";
    } elseif ($corpo !== null) {
        $args['headers']['Content-Type'] = 'application/json';
        $args['body'] = wp_json_encode($corpo);
    }
    $r = wp_remote_request('https://api.openai.com/v1/' . $caminho, $args);
    if (is_wp_error($r)) return ['erro' => $r->get_error_message()];
    $j = json_decode(wp_remote_retrieve_body($r), true);
    $cod = wp_remote_retrieve_response_code($r);
    if ($cod >= 300) return ['erro' => ($j['error']['message'] ?? ('HTTP ' . $cod))];
    return is_array($j) ? $j : ['erro' => 'resposta inválida'];
}

/* ------------------------------------------------------------------ nomes da marca sempre certos */
function eap_ia_nomes($t) {
    $t = (string) $t;
    // "Estética Aligner", "Aesthetic Aligner", "Esthetic Aliner", "Estetic Align", "Esthetic Line", "Est Aligner"…
    $t = preg_replace('/\b(?:a?e?st?h?[eé]tic[ao]?|est)\s*-?\s*(?:a?l[iy]n?e?g?n?(?:er|ner|ar|or|e)s?|line|align)\b/iu', 'Esthetic Aligner', $t);
    $t = preg_replace('/\bEsthetic Aligner\s+Aligner\b/u', 'Esthetic Aligner', $t);
    $t = preg_replace('/\b(?:orto|ortho)\s*-?\s*lab(?:e|i)?\b/iu', 'Ortholab', $t);
    $t = preg_replace('/\b(?:esthetic|estética|estetic)\s+rewards?\b/iu', 'Esthetic Rewards', $t);
    $t = preg_replace('/\bEsthetic Aligner\s+(kids|air|club|day|store|advanced)\b/iu', 'Esthetic Aligner $1', $t);
    $t = preg_replace_callback('/\bEsthetic Aligner (kids|air|club|day|store|advanced)\b/iu', fn($m) => 'Esthetic Aligner ' . (strtolower($m[1]) === 'air' ? 'AIR' : (strtolower($m[1]) === 'kids' ? 'KIDS' : ucfirst(strtolower($m[1])))), $t);
    return $t;
}

/* ------------------------------------------------------------------ o que entra na base */
function eap_ia_texto($html) {
    $t = wp_strip_all_tags(preg_replace('#<(br|/p|/li|/h\d)[^>]*>#i', "\n", do_shortcode((string) $html)));
    return trim(preg_replace("/\n{3,}/", "\n\n", html_entity_decode($t, ENT_QUOTES, 'UTF-8')));
}
function eap_ia_conteudo() {
    $itens = [];
    $oculto = fn($id) => (bool) get_post_meta($id, '_eap_oculto', true);
    // perguntas frequentes (uma por arquivo, para a fonte apontar a pergunta certa)
    if (post_type_exists('faq')) foreach (get_posts(['post_type' => 'faq', 'numberposts' => 300, 'post_status' => 'publish', 'suppress_filters' => true]) as $f) {
        if ($oculto($f->ID)) continue;
        $txt = "# Pergunta frequente: " . get_the_title($f) . "\n\n" . eap_ia_texto($f->post_content) . "\n\nFonte: Perguntas frequentes do Portal do Credenciado Esthetic Aligner.";
        $itens['faq-' . $f->ID] = ['tipo' => 'Pergunta frequente', 'titulo' => get_the_title($f), 'url' => home_url('/suporte/#faq-' . $f->ID), 'nome' => 'faq-' . $f->ID . '.md', 'dados' => $txt];
    }
    // vídeo aulas (por enquanto título, categoria e resumo; transcrições na fase 2)
    foreach (get_posts(['post_type' => 'ea_aula', 'numberposts' => 500, 'post_status' => 'publish', 'suppress_filters' => true]) as $a) {
        if ($oculto($a->ID)) continue;
        $tt = get_the_terms($a, 'ea_trilha'); $cat = ($tt && !is_wp_error($tt)) ? $tt[0]->name : 'Vídeo aulas';
        $tr = (string) get_post_meta($a->ID, '_eap_transcricao', true);
        $txt = "# Vídeo aula: " . get_the_title($a) . "\nCategoria: $cat\n\n" . ($a->post_excerpt ? $a->post_excerpt . "\n\n" : '') . ($tr ? "Transcrição da aula:\n" . $tr . "\n\n" : '') . "Esta aula está disponível em Vídeo aulas, no Portal do Credenciado.";
        $itens['aula-' . $a->ID] = ['tipo' => 'Vídeo aula', 'titulo' => get_the_title($a), 'url' => add_query_arg('aula', $a->ID, home_url('/video-aulas/')), 'nome' => 'aula-' . $a->ID . '.md', 'dados' => $txt];
    }
    // materiais em PDF/Word/PowerPoint guardados no próprio site
    $up = wp_get_upload_dir();
    foreach (get_posts(['post_type' => 'ea_material', 'numberposts' => 500, 'post_status' => 'publish', 'suppress_filters' => true]) as $m) {
        if ($oculto($m->ID)) continue;
        $url = (string) get_post_meta($m->ID, '_eap_arquivo', true);
        if (!preg_match('~\.(pdf|docx|pptx)$~i', parse_url($url, PHP_URL_PATH) ?: '', $ext)) continue;
        $cam = str_replace(set_url_scheme($up['baseurl'], 'https'), $up['basedir'], set_url_scheme($url, 'https'));
        if (!is_file($cam) || filesize($cam) > 40 * MB_IN_BYTES) continue;
        $sec = wp_get_post_terms($m->ID, 'ea_secao', ['fields' => 'names']);
        $itens['mat-' . $m->ID] = ['tipo' => 'Material' . ($sec ? ' – ' . implode(', ', $sec) : ''), 'titulo' => get_the_title($m), 'url' => $url, 'nome' => sanitize_file_name(get_the_title($m)) . '.' . strtolower($ext[1]), 'arquivo' => $cam, 'hash' => md5($cam . filesize($cam) . filemtime($cam))];
    }
    foreach ($itens as &$i) if (isset($i['dados'])) $i['dados'] = eap_ia_nomes($i['dados']);
    unset($i);
    foreach ($itens as &$i) if (!isset($i['hash'])) $i['hash'] = md5($i['dados']);
    return $itens;
}

/* ------------------------------------------------------------------ sincronização em etapas (o painel chama até terminar) */
add_action('wp_ajax_eap_ia_sync', function () {
    if (!current_user_can('edit_pages') || !check_ajax_referer('eap_ia_sync', '_n', false)) wp_send_json_error('permissao', 403);
    if (!eap_ia_chave()) wp_send_json_error('Cadastre a chave da API primeiro.');
    @set_time_limit(120);
    $base = eap_ia_base();
    if (!$base['vs']) {
        $vs = eap_ia_api('POST', 'vector_stores', ['name' => 'Portal do Credenciado – ' . parse_url(home_url(), PHP_URL_HOST)]);
        if (!empty($vs['erro'])) wp_send_json_error('Não consegui criar a base na OpenAI: ' . $vs['erro']);
        $base = ['vs' => $vs['id'], 'itens' => []];
        update_option('eap_ia_base', $base, false);
    }
    $quero = eap_ia_conteudo();
    $remover = array_diff_key($base['itens'], $quero);
    $enviar = array_filter($quero, fn($i, $k) => !isset($base['itens'][$k]) || $base['itens'][$k]['hash'] !== $i['hash'], ARRAY_FILTER_USE_BOTH);
    $feitos = 0; $erros = [];
    foreach ($remover as $k => $i) {
        if ($feitos >= 6) break;
        eap_ia_api('DELETE', 'vector_stores/' . $base['vs'] . '/files/' . $i['file_id']); eap_ia_api('DELETE', 'files/' . $i['file_id']);
        unset($base['itens'][$k]); $feitos++;
    }
    foreach ($enviar as $k => $i) {
        if ($feitos >= 6) break;
        $dados = isset($i['arquivo']) ? file_get_contents($i['arquivo']) : $i['dados'];
        $f = eap_ia_api('POST', 'files', null, ['nome' => $i['nome'], 'dados' => $dados], 120);
        $feitos++;
        if (!empty($f['erro'])) { $erros[] = $i['titulo'] . ': ' . $f['erro']; $base['itens'][$k] = ['file_id' => '', 'hash' => $i['hash'], 'titulo' => $i['titulo'], 'url' => $i['url'], 'tipo' => $i['tipo'], 'erro' => 1]; continue; }
        $v = eap_ia_api('POST', 'vector_stores/' . $base['vs'] . '/files', ['file_id' => $f['id']]);
        if (!empty($v['erro'])) { $erros[] = $i['titulo'] . ': ' . $v['erro']; eap_ia_api('DELETE', 'files/' . $f['id']); $base['itens'][$k] = ['file_id' => '', 'hash' => $i['hash'], 'titulo' => $i['titulo'], 'url' => $i['url'], 'tipo' => $i['tipo'], 'erro' => 1]; continue; }
        if (!empty($base['itens'][$k]['file_id'])) { eap_ia_api('DELETE', 'vector_stores/' . $base['vs'] . '/files/' . $base['itens'][$k]['file_id']); eap_ia_api('DELETE', 'files/' . $base['itens'][$k]['file_id']); }
        $base['itens'][$k] = ['file_id' => $f['id'], 'hash' => $i['hash'], 'titulo' => $i['titulo'], 'url' => $i['url'], 'tipo' => $i['tipo']];
    }
    update_option('eap_ia_base', $base, false);
    $faltam = count(array_diff_key($base['itens'], $quero)) + count(array_filter($quero, fn($i, $k) => !isset($base['itens'][$k]) || $base['itens'][$k]['hash'] !== $i['hash'], ARRAY_FILTER_USE_BOTH));
    if (!$faltam) update_option('eap_ia_sync_em', time(), false);
    wp_send_json_success(['feitos' => $feitos, 'faltam' => $faltam, 'total' => count($quero), 'erros' => $erros]);
});

/* ------------------------------------------------------------------ legendas do Vimeo -> transcrição das aulas */
function eap_vtt_texto($vtt) {
    $linhas = preg_split('/\r?\n/', (string) $vtt); $out = []; $ult = ''; $bloco_nota = false;
    foreach ($linhas as $l) {
        $l = trim($l);
        if ($l === '') { $bloco_nota = false; continue; }
        if ($bloco_nota || stripos($l, 'WEBVTT') === 0 || strpos($l, '-->') !== false || ctype_digit($l) || strpos($l, 'Kind:') === 0 || strpos($l, 'Language:') === 0) continue;
        if (strpos($l, 'NOTE') === 0 || strpos($l, 'STYLE') === 0) { $bloco_nota = true; continue; }
        $l = trim(html_entity_decode(wp_strip_all_tags($l), ENT_QUOTES, 'UTF-8'));
        if ($l === '' || $l === $ult) continue;
        $out[] = $l; $ult = $l;
    }
    $txt = ''; foreach (array_chunk($out, 10) as $c) $txt .= implode(' ', $c) . "\n\n";
    return trim($txt);
}
function eap_video_local($url) {
    $up = wp_get_upload_dir();
    if (!preg_match('~\.(mp4|m4v|mov|webm|mp3|m4a)$~i', parse_url((string) $url, PHP_URL_PATH) ?: '')) return '';
    $cam = str_replace(set_url_scheme($up['baseurl'], 'https'), $up['basedir'], set_url_scheme((string) $url, 'https'));
    return is_file($cam) ? $cam : '';
}
function eap_vimeo_id($url) { return preg_match('~vimeo\.com/(?:video/)?(\d+)~', (string) $url, $m) ? $m[1] : ''; }
add_action('wp_ajax_eap_ia_vimeo', function () {
    if (!current_user_can('edit_pages') || !check_ajax_referer('eap_ia_sync', '_n', false)) wp_send_json_error('permissao', 403);
    $tok = (string) get_option('eap_ia_vimeo', '');
    if (!$tok) wp_send_json_error('Cadastre o token do Vimeo primeiro.');
    @set_time_limit(120);
    $refazer = !empty($_POST['refazer']);
    $aulas = get_posts(['post_type' => 'ea_aula', 'numberposts' => -1, 'post_status' => 'publish', 'fields' => 'ids', 'suppress_filters' => true]);
    $pend = array_values(array_filter($aulas, fn($id) => eap_vimeo_id(get_post_meta($id, '_eap_video', true)) && ($refazer ? (int) get_post_meta($id, '_eap_transc_rodada', true) !== (int) ($_POST['rodada'] ?? 0) : !get_post_meta($id, '_eap_transc_status', true))));
    $feitos = 0; $log = [];
    foreach (array_slice($pend, 0, 4) as $id) {
        $vid = eap_vimeo_id(get_post_meta($id, '_eap_video', true));
        $h = ['Authorization' => 'bearer ' . $tok, 'Accept' => 'application/vnd.vimeo.*+json;version=3.4'];
        $r = wp_remote_get('https://api.vimeo.com/videos/' . $vid . '/texttracks', ['headers' => $h, 'timeout' => 30]);
        $st = 'erro'; $txt = '';
        if (is_wp_error($r)) $msg = $r->get_error_message();
        else {
            $j = json_decode(wp_remote_retrieve_body($r), true); $cod = wp_remote_retrieve_response_code($r);
            if ($cod >= 300) $msg = 'HTTP ' . $cod . ' – ' . ($j['developer_message'] ?? $j['error'] ?? '') . (isset($j['error_code']) ? ' (código ' . $j['error_code'] . ')' : '');
            else {
                $tracks = (array) ($j['data'] ?? []);
                usort($tracks, function ($a, $b) { $p = fn($t) => (stripos($t['language'] ?? '', 'pt') === 0 ? 10 : 0) + (strpos($t['language'] ?? '', 'autogen') === false ? 2 : 0) + (!empty($t['active']) ? 1 : 0); return $p($b) <=> $p($a); });
                $t = $tracks[0] ?? null;
                if (!$t || empty($t['link'])) { $st = 'sem_legenda'; $msg = 'sem legenda'; }
                else {
                    $v = wp_remote_get($t['link'], ['timeout' => 30]);
                    $txt = is_wp_error($v) ? '' : eap_vtt_texto(wp_remote_retrieve_body($v));
                    if (mb_strlen($txt) > 50) { $st = 'ok'; $msg = ($t['language'] ?? '') . ', ' . number_format_i18n(str_word_count(remove_accents($txt))) . ' palavras'; }
                    else { $st = 'sem_legenda'; $msg = 'legenda vazia'; }
                }
            }
        }
        if ($st === 'ok') { update_post_meta($id, '_eap_transcricao', $txt); update_post_meta($id, '_eap_transcricao_fonte', 'vimeo'); }
        update_post_meta($id, '_eap_transc_status', $st);
        update_post_meta($id, '_eap_transc_rodada', (int) ($_POST['rodada'] ?? 0));
        $log[] = get_the_title($id) . ': ' . ($st === 'ok' ? '✓ ' : '✗ ') . $msg;
        $feitos++;
    }
    wp_send_json_success(['feitos' => $feitos, 'faltam' => max(0, count($pend) - $feitos), 'log' => $log]);
});

add_action('wp_ajax_eap_ia_transcrever', function () {
    if (!current_user_can('edit_pages') || !check_ajax_referer('eap_ia_sync', '_n', false)) wp_send_json_error('permissao', 403);
    if (!eap_ia_chave()) wp_send_json_error('Cadastre a chave da OpenAI primeiro.');
    @set_time_limit(300);
    $aulas = get_posts(['post_type' => 'ea_aula', 'numberposts' => -1, 'post_status' => 'publish', 'fields' => 'ids', 'suppress_filters' => true]);
    $pend = array_values(array_filter($aulas, fn($id) => eap_video_local(get_post_meta($id, '_eap_video', true)) && !get_post_meta($id, '_eap_transc_status', true)));
    $log = []; $feitos = 0;
    foreach (array_slice($pend, 0, 2) as $id) {
        $cam = eap_video_local(get_post_meta($id, '_eap_video', true)); $feitos++;
        if (filesize($cam) > 25 * MB_IN_BYTES) { update_post_meta($id, '_eap_transc_status', 'grande'); $log[] = get_the_title($id) . ': ✗ arquivo acima de 25 MB (limite da OpenAI)'; continue; }
        $r = eap_ia_api('POST', 'audio/transcriptions', null, ['nome' => basename($cam), 'dados' => file_get_contents($cam), 'campos' => ['model' => 'gpt-4o-mini-transcribe', 'language' => 'pt', 'response_format' => 'json']], 240);
        if (!empty($r['erro']) || empty($r['text'])) { update_post_meta($id, '_eap_transc_status', 'erro'); $log[] = get_the_title($id) . ': ✗ ' . ($r['erro'] ?? 'sem texto'); continue; }
        update_post_meta($id, '_eap_transcricao', trim($r['text'])); update_post_meta($id, '_eap_transcricao_fonte', 'openai'); update_post_meta($id, '_eap_transc_status', 'ok');
        $log[] = get_the_title($id) . ': ✓ ' . number_format_i18n(str_word_count(remove_accents($r['text']))) . ' palavras';
    }
    wp_send_json_success(['feitos' => $feitos, 'faltam' => max(0, count($pend) - $feitos), 'log' => $log]);
});

/* vídeos grandes: o navegador extrai o áudio em partes de ~10 min e manda uma a uma */
add_action('wp_ajax_eap_ia_grandes', function () {
    if (!current_user_can('edit_pages') || !check_ajax_referer('eap_ia_sync', '_n', false)) wp_send_json_error('permissao', 403);
    $out = [];
    foreach (get_posts(['post_type' => 'ea_aula', 'numberposts' => -1, 'post_status' => 'publish', 'fields' => 'ids', 'suppress_filters' => true]) as $id) {
        if (!in_array(get_post_meta($id, '_eap_transc_status', true), ['grande', 'parcial'], true)) continue;
        $url = (string) get_post_meta($id, '_eap_video', true);
        if (eap_video_local($url)) $out[] = ['id' => $id, 'titulo' => html_entity_decode(get_the_title($id)), 'url' => $url];
    }
    wp_send_json_success($out);
});
add_action('wp_ajax_eap_ia_transc_parte', function () {
    if (!current_user_can('edit_pages') || !check_ajax_referer('eap_ia_sync', '_n', false)) wp_send_json_error('permissao', 403);
    @set_time_limit(300);
    $id = (int) ($_POST['id'] ?? 0); $parte = (int) ($_POST['parte'] ?? 0); $total = max(1, (int) ($_POST['total'] ?? 1));
    if (get_post_type($id) !== 'ea_aula' || empty($_FILES['audio']['tmp_name']) || !is_uploaded_file($_FILES['audio']['tmp_name'])) wp_send_json_error('arquivo', 400);
    if (filesize($_FILES['audio']['tmp_name']) > 25 * MB_IN_BYTES) wp_send_json_error('parte grande demais', 400);
    $r = eap_ia_api('POST', 'audio/transcriptions', null, ['nome' => 'parte-' . $parte . '.wav', 'dados' => file_get_contents($_FILES['audio']['tmp_name']), 'campos' => ['model' => 'gpt-4o-mini-transcribe', 'language' => 'pt', 'response_format' => 'json']], 280);
    if (!empty($r['erro'])) wp_send_json_error($r['erro']);
    $partes = (array) get_post_meta($id, '_eap_transc_partes', true);
    if ($parte === 0) $partes = [];
    $partes[$parte] = trim((string) ($r['text'] ?? ''));
    update_post_meta($id, '_eap_transc_partes', $partes);
    if (count(array_filter($partes, 'strlen')) >= $total || $parte === $total - 1) {
        ksort($partes); $txt = trim(implode("\n\n", $partes));
        update_post_meta($id, '_eap_transcricao', $txt); update_post_meta($id, '_eap_transcricao_fonte', 'openai'); update_post_meta($id, '_eap_transc_status', 'ok'); delete_post_meta($id, '_eap_transc_partes');
        wp_send_json_success(['fim' => true, 'palavras' => str_word_count(remove_accents($txt))]);
    }
    update_post_meta($id, '_eap_transc_status', 'parcial');
    wp_send_json_success(['fim' => false]);
});

/* ------------------------------------------------------------------ registro das perguntas */
add_action('init', function () {
    register_post_type('ea_ia_log', ['labels' => ['name' => 'Perguntas ao Assistente', 'singular_name' => 'Pergunta'], 'public' => false, 'show_ui' => true, 'show_in_menu' => 'eap-portal',
        'capabilities' => ['create_posts' => 'do_not_allow'], 'map_meta_cap' => true, 'supports' => ['title']]);
});
add_filter('manage_ea_ia_log_posts_columns', fn($c) => ['cb' => $c['cb'], 'title' => 'Pergunta', 'eap_r' => 'Resposta', 'eap_st' => 'Situação', 'eap_av' => 'Avaliação', 'author' => 'Quem perguntou', 'date' => 'Data']);
add_action('manage_ea_ia_log_posts_custom_column', function ($col, $id) {
    if ($col === 'eap_r') { $t = get_post_field('post_content', $id); echo esc_html(mb_strimwidth(wp_strip_all_tags($t), 0, 220, '…')); $f = json_decode((string) get_post_meta($id, '_fontes', true), true); if ($f) echo '<br><small style="color:#5b6576">Fontes: ' . esc_html(implode(' · ', array_column($f, 'titulo'))) . '</small>'; }
    if ($col === 'eap_st') echo esc_html(['ok' => '✓ Respondida', 'sem' => 'Sem resposta no portal', 'clinico' => 'Caso clínico (encaminhada)', 'erro' => 'Erro'][get_post_meta($id, '_status', true)] ?? '—');
    if ($col === 'eap_av') { $a = (int) get_post_meta($id, '_aval', true); echo $a > 0 ? '👍' : ($a < 0 ? '👎' : '—'); }
}, 10, 2);

/* ------------------------------------------------------------------ perguntar */
function eap_ia_instrucoes() {
    return "Você é o Assistente EA do Portal do Credenciado da Esthetic Aligner (alinhadores ortodônticos). Quem pergunta são dentistas credenciados.\n"
        . "REGRAS OBRIGATÓRIAS:\n"
        . "1. Use SOMENTE as informações que aparecem nos documentos retornados pela busca em arquivos (file_search). Nunca use conhecimento próprio, da internet ou suposições.\n"
        . "2. Se os documentos não trouxerem a resposta de forma clara e direta, responda exatamente: [SEM_RESPOSTA]\n"
        . "3. Não faça diagnóstico, plano de tratamento, indicação clínica nem opinião sobre um paciente ou caso específico. Nesse caso responda exatamente: [CLINICO]\n"
        . "4. Não invente números, prazos, preços, quantidades, protocolos ou nomes que não estejam escritos nos documentos.\n"
        . "5. Responda em português do Brasil, de forma objetiva: até 6 frases ou uma lista curta de passos. Quando houver uma vídeo aula ou material relacionado, diga o nome dele para o dentista abrir.\n"
        . "6. Não mencione 'documentos', 'arquivos' ou 'busca'; fale naturalmente, como o suporte da Esthetic Aligner.\n"
        . "7. Escreva os nomes sempre assim, exatamente: Esthetic Aligner (a empresa e os alinhadores), Ortholab, Esthetic Rewards, Envio Fácil, Esthetic Aligner KIDS, EA AIR. Algumas transcrições de vídeo trazem esses nomes escritos errado; corrija sempre.";
}
add_action('wp_ajax_eap_ia_perguntar', function () {
    if (!check_ajax_referer('eap_ia', '_n', false)) wp_send_json_error('sessao', 403);
    $uid = get_current_user_id();
    if (!eap_ia_pode($uid)) wp_send_json_error('indisponivel', 403);
    $cfg = eap_ia_cfg();
    $k = 'eap_ia_dia_' . $uid . '_' . current_time('Ymd'); $n = (int) get_transient($k);
    if ($n >= max(1, (int) $cfg['limite'])) wp_send_json_error('limite', 429);
    set_transient($k, $n + 1, DAY_IN_SECONDS);
    $perg = mb_substr(trim(sanitize_textarea_field(wp_unslash($_POST['pergunta'] ?? ''))), 0, 600);
    if (mb_strlen($perg) < 3) wp_send_json_error('vazia', 400);
    // histórico curto da conversa (para perguntas de continuação)
    $hist = json_decode(wp_unslash($_POST['historico'] ?? '[]'), true);
    $input = [];
    foreach (array_slice(is_array($hist) ? $hist : [], -6) as $h) {
        if (!in_array($h['papel'] ?? '', ['user', 'assistant'], true)) continue;
        $input[] = ['role' => $h['papel'], 'content' => mb_substr(sanitize_textarea_field($h['texto'] ?? ''), 0, 1200)];
    }
    $input[] = ['role' => 'user', 'content' => $perg];
    $base = eap_ia_base();
    $r = eap_ia_api('POST', 'responses', [
        'model' => $cfg['modelo'], 'instructions' => eap_ia_instrucoes(), 'input' => $input, 'store' => false,
        'tools' => [['type' => 'file_search', 'vector_store_ids' => [$base['vs']], 'max_num_results' => 6]],
        'tool_choice' => 'required',
    ], null, 90);
    $status = 'ok'; $texto = ''; $fontes = [];
    if (!empty($r['erro'])) { $status = 'erro'; $texto = ''; }
    else {
        $porArquivo = [];
        foreach ($base['itens'] as $it) if (!empty($it['file_id'])) $porArquivo[$it['file_id']] = $it;
        foreach ((array) ($r['output'] ?? []) as $o) {
            if (($o['type'] ?? '') !== 'message') continue;
            foreach ((array) ($o['content'] ?? []) as $c) {
                if (($c['type'] ?? '') !== 'output_text') continue;
                $texto .= $c['text'];
                foreach ((array) ($c['annotations'] ?? []) as $an) {
                    if (($an['type'] ?? '') === 'file_citation' && isset($porArquivo[$an['file_id']])) { $it = $porArquivo[$an['file_id']]; $fontes[$an['file_id']] = ['titulo' => $it['titulo'], 'url' => $it['url'], 'tipo' => $it['tipo']]; }
                }
            }
        }
        $texto = eap_ia_nomes(trim(preg_replace('/【[^】]*】/u', '', $texto))); // tira marcadores de citação e corrige o nome da marca
        if (strpos($texto, '[CLINICO]') !== false) $status = 'clinico';
        elseif (strpos($texto, '[SEM_RESPOSTA]') !== false || !$fontes || $texto === '') $status = 'sem'; // sem fonte = não responde
    }
    if ($status !== 'ok') { $texto = ''; $fontes = []; }
    $id = wp_insert_post(['post_type' => 'ea_ia_log', 'post_status' => 'private', 'post_author' => $uid, 'post_title' => mb_substr($perg, 0, 180), 'post_content' => $texto ?: ($status === 'erro' ? 'Erro: ' . ($r['erro'] ?? '') : '')]);
    if ($id && !is_wp_error($id)) { update_post_meta($id, '_status', $status); update_post_meta($id, '_fontes', wp_json_encode(array_values($fontes))); update_post_meta($id, '_equipe', user_can($uid, 'edit_pages') ? 1 : 0); }
    if (function_exists('eap_evento')) eap_evento('ia', (int) $id, $status);
    wp_send_json_success(['status' => $status, 'texto' => $texto, 'fontes' => array_values($fontes), 'id' => (int) $id]);
});
add_action('wp_ajax_eap_ia_avaliar', function () {
    if (!check_ajax_referer('eap_ia', '_n', false)) wp_send_json_error('', 403);
    $id = (int) ($_POST['id'] ?? 0);
    if (get_post_type($id) !== 'ea_ia_log' || (int) get_post_field('post_author', $id) !== get_current_user_id()) wp_send_json_error('', 403);
    update_post_meta($id, '_aval', ((int) ($_POST['v'] ?? 0)) > 0 ? 1 : -1);
    wp_send_json_success();
});

/* ------------------------------------------------------------------ tela de configuração */
add_action('admin_menu', function () {
    add_submenu_page('eap-portal', 'Assistente EA (IA)', '✨ Assistente EA', 'edit_pages', 'eap-ia', 'eap_ia_pagina', 2);
}, 22);
function eap_ia_pagina() {
    $msg = '';
    if (isset($_POST['eap_ia_salvar']) && check_admin_referer('eap_ia_cfg')) {
        $c = eap_ia_cfg();
        $c['ativo'] = empty($_POST['ativo']) ? 0 : 1;
        $c['acesso'] = ($_POST['acesso'] ?? '') === 'todos' ? 'todos' : 'equipe';
        $c['limite'] = max(1, min(200, (int) ($_POST['limite'] ?? 20)));
        $c['modelo'] = sanitize_text_field(wp_unslash($_POST['modelo'] ?? '')) ?: 'gpt-5.4-mini';
        update_option('eap_ia', $c, false);
        $vim = trim((string) wp_unslash($_POST['vimeo'] ?? ''));
        if ($vim !== '') update_option('eap_ia_vimeo', $vim, false);
        $nova = trim((string) wp_unslash($_POST['chave'] ?? ''));
        if ($nova !== '') update_option('eap_ia_chave', $nova, false);
        $msg = 'Configurações salvas.';
        if ($vim !== '') { $vr = wp_remote_get('https://api.vimeo.com/me', ['headers' => ['Authorization' => 'bearer ' . $vim, 'Accept' => 'application/vnd.vimeo.*+json;version=3.4'], 'timeout' => 15]); $vj = is_wp_error($vr) ? [] : json_decode(wp_remote_retrieve_body($vr), true); $msg .= !empty($vj['name']) ? ' Vimeo conectado: conta “' . $vj['name'] . '” ✓' : ' Atenção: o Vimeo não aceitou o token.'; }
        if ($nova !== '') { $t = eap_ia_api('GET', 'models/' . rawurlencode($c['modelo'])); $msg .= !empty($t['erro']) ? ' Atenção: a OpenAI respondeu “' . $t['erro'] . '”. Confira a chave e o nome do modelo.' : ' Chave conferida com a OpenAI ✓'; }
    }
    $c = eap_ia_cfg(); $ch = eap_ia_chave(); $base = eap_ia_base();
    $ok = count(array_filter($base['itens'], fn($i) => !empty($i['file_id']))); $er = count(array_filter($base['itens'], fn($i) => !empty($i['erro'])));
    $sync = (int) get_option('eap_ia_sync_em');
    global $wpdb;
    $tot = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'ea_ia_log'");
    $sem = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} pm JOIN {$wpdb->posts} p ON p.ID = pm.post_id WHERE p.post_type = 'ea_ia_log' AND pm.meta_key = '_status' AND pm.meta_value = 'sem'");
    ?>
    <div class="wrap" style="max-width:900px">
      <h1>✨ Assistente EA</h1>
      <?php if ($msg) echo '<div class="notice notice-info"><p>' . esc_html($msg) . '</p></div>'; ?>
      <p>O assistente responde <b>somente</b> com o conteúdo do portal (perguntas frequentes, materiais em PDF e catálogo de vídeo aulas) e mostra a fonte de cada resposta. Quando não encontra a resposta no portal, ele diz que não encontrou e oferece o suporte. Perguntas sobre casos clínicos específicos são encaminhadas ao laboratório. Todas as perguntas ficam registradas em <a href="<?php echo esc_url(admin_url('edit.php?post_type=ea_ia_log')); ?>">Perguntas ao Assistente</a> para a equipe revisar.</p>
      <form method="post" style="background:#fff;border:1px solid #e4e8f0;border-radius:12px;padding:16px 18px;margin:16px 0"><?php wp_nonce_field('eap_ia_cfg'); ?>
        <table class="form-table" style="margin:0"><tbody>
          <tr><th>Assistente</th><td><label><input type="checkbox" name="ativo" value="1" <?php checked($c['ativo']); ?>> Ligado</label></td></tr>
          <tr><th>Quem pode usar</th><td><label><input type="radio" name="acesso" value="equipe" <?php checked($c['acesso'], 'equipe'); ?>> Só a equipe (fase de testes)</label> &nbsp; <label><input type="radio" name="acesso" value="todos" <?php checked($c['acesso'], 'todos'); ?>> Todos os credenciados</label></td></tr>
          <tr><th>Fornecedor</th><td>OpenAI <span class="description">(Claude pode ser adicionado depois sem mudar nada para o dentista)</span></td></tr>
          <tr><th>Chave da API</th><td><input type="password" name="chave" class="regular-text" autocomplete="off" placeholder="<?php echo $ch ? esc_attr('Cadastrada: ••••' . substr($ch, -4) . ' (deixe em branco para manter)') : 'Cole aqui a chave (sk-...)'; ?>"><p class="description">Gerada em platform.openai.com → API keys. Fica guardada só no servidor e nunca aparece de novo na tela.</p></td></tr>
          <tr><th>Modelo</th><td><input type="text" name="modelo" value="<?php echo esc_attr($c['modelo']); ?>" class="regular-text"><p class="description">Padrão: gpt-5.4-mini (rápido e barato). Se a equipe clínica achar as respostas fracas, troque por um modelo maior.</p></td></tr>
          <tr><th>Token do Vimeo</th><td><input type="password" name="vimeo" class="regular-text" autocomplete="off" placeholder="<?php echo get_option('eap_ia_vimeo') ? esc_attr('Cadastrado (deixe em branco para manter)') : 'Cole aqui o token de acesso do Vimeo'; ?>"><p class="description">Para importar as legendas das aulas. Gerado em developer.vimeo.com → My Apps → (seu app) → Generate access token, com os acessos <b>Public</b> e <b>Private</b>.</p></td></tr>
          <tr><th>Perguntas por dia</th><td><input type="number" name="limite" min="1" max="200" value="<?php echo (int) $c['limite']; ?>" style="width:80px"> <span class="description">por dentista (controla o custo)</span></td></tr>
        </tbody></table>
        <p style="margin:12px 0 0"><button class="button button-primary" name="eap_ia_salvar" value="1">Salvar</button></p>
      </form>
      <div style="background:#fff;border:1px solid #e4e8f0;border-radius:12px;padding:16px 18px">
        <h2 style="margin-top:0">Base de conhecimento</h2>
        <p><?php echo $base['vs'] ? 'Itens na base: <b>' . (int) $ok . '</b>' . ($er ? ' · com erro: <b>' . (int) $er . '</b>' : '') . ' · última atualização: <b>' . ($sync ? esc_html(wp_date('d/m/Y H:i', $sync)) : '—') . '</b>' : 'A base ainda não foi criada.'; ?></p>
        <p class="description">Atualize sempre que cadastrar ou mudar perguntas frequentes, materiais ou aulas. Só o que mudou é enviado.</p>
        <p><button type="button" class="button button-primary" id="eapIaSync" <?php disabled(!$ch); ?>>Atualizar base agora</button> <span id="eapIaSyncMsg"></span></p>
        <div id="eapIaSyncErros" style="color:#b32d2e"></div>
        <hr><h3 style="margin:10px 0 6px">Transcrições das vídeo aulas</h3>
        <?php $aulas = get_posts(['post_type' => 'ea_aula', 'numberposts' => -1, 'post_status' => 'publish', 'fields' => 'ids', 'suppress_filters' => true]); $tr_ok = count(array_filter($aulas, fn($id) => get_post_meta($id, '_eap_transc_status', true) === 'ok')); ?>
        <?php $n_vim = count(array_filter($aulas, fn($id) => eap_vimeo_id(get_post_meta($id, '_eap_video', true)))); $n_loc = count(array_filter($aulas, fn($id) => eap_video_local(get_post_meta($id, '_eap_video', true)))); ?>
        <p>Vídeos das aulas: <b><?php echo (int) $n_vim; ?></b> no Vimeo · <b><?php echo (int) $n_loc; ?></b> guardados no próprio site<?php $n_out = count($aulas) - $n_vim - $n_loc; echo $n_out > 0 ? ' · <b>' . (int) $n_out . '</b> em outro lugar (YouTube/links)' : ''; ?>.</p>
        <p>Aulas com transcrição: <b><?php echo (int) $tr_ok; ?></b> de <?php echo count($aulas); ?>. As legendas automáticas do Vimeo viram texto e entram na base na próxima atualização.</p>
        <p><button type="button" class="button" id="eapIaVimeo" <?php disabled(!get_option('eap_ia_vimeo')); ?>>Importar legendas do Vimeo</button> <label style="margin-left:8px"><input type="checkbox" id="eapIaVimeoRefazer"> refazer todas</label> <span id="eapIaVimeoMsg"></span></p>
        <p><button type="button" class="button" id="eapIaLocal" <?php disabled(!$ch || !$n_loc); ?>>Transcrever os vídeos guardados no site (OpenAI)</button> <span class="description">custo aproximado: centavos por minuto de vídeo</span> <span id="eapIaLocalMsg"></span></p>
        <p><button type="button" class="button" id="eapIaGrandes" <?php disabled(!$ch); ?>>Transcrever os vídeos grandes (acima de 25 MB)</button> <span class="description">o seu navegador separa o áudio em partes; deixe esta aba aberta até terminar</span> <span id="eapIaGrandesMsg"></span></p>
        <div id="eapIaVimeoLog" style="max-height:180px;overflow:auto;font-size:12px;color:#5b6576"></div>
        <script>(function(){
          var b=document.getElementById('eapIaGrandes'),m=document.getElementById('eapIaGrandesMsg'),lg=document.getElementById('eapIaVimeoLog'),N='<?php echo esc_js(wp_create_nonce('eap_ia_sync')); ?>';if(!b)return;
          function log(t){var d=document.createElement('div');d.textContent=t;lg.appendChild(d);lg.scrollTop=lg.scrollHeight;}
          function wav(f32,sr){var n=f32.length,buf=new ArrayBuffer(44+n*2),v=new DataView(buf),p=0;function s(t){for(var i=0;i<t.length;i++)v.setUint8(p++,t.charCodeAt(i));}
            s('RIFF');v.setUint32(p,36+n*2,true);p+=4;s('WAVEfmt ');v.setUint32(p,16,true);p+=4;v.setUint16(p,1,true);p+=2;v.setUint16(p,1,true);p+=2;v.setUint32(p,sr,true);p+=4;v.setUint32(p,sr*2,true);p+=4;v.setUint16(p,2,true);p+=2;v.setUint16(p,16,true);p+=2;s('data');v.setUint32(p,n*2,true);p+=4;
            for(var i=0;i<n;i++){var x=Math.max(-1,Math.min(1,f32[i]));v.setInt16(p,x<0?x*0x8000:x*0x7FFF,true);p+=2;}return new Blob([buf],{type:'audio/wav'});}
          function post(d){var f=new FormData();f.append('_n',N);Object.keys(d).forEach(function(k){f.append(k,d[k]);});return fetch(ajaxurl,{method:'POST',body:f,credentials:'same-origin'}).then(function(r){return r.json();});}
          async function uma(a){
            m.textContent='Baixando “'+a.titulo+'”…';
            var buf=await (await fetch(a.url,{credentials:'same-origin'})).arrayBuffer();
            m.textContent='Separando o áudio de “'+a.titulo+'”…';
            var SR=16000,ctx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:SR}),au=await ctx.decodeAudioData(buf);buf=null;
            var n=au.length,mono=new Float32Array(n);for(var c=0;c<au.numberOfChannels;c++){var d=au.getChannelData(c);for(var i=0;i<n;i++)mono[i]+=d[i]/au.numberOfChannels;}ctx.close();
            var passo=SR*600,total=Math.ceil(n/passo);
            for(var k=0;k<total;k++){m.textContent='Transcrevendo “'+a.titulo+'”: parte '+(k+1)+' de '+total+'…';
              var pedaco=wav(mono.subarray(k*passo,Math.min(n,(k+1)*passo)),SR),j=null;
              for(var t=0;t<3;t++){try{j=await post({action:'eap_ia_transc_parte',id:a.id,parte:k,total:total,audio:pedaco});}catch(e){j={success:false,data:'conexão'};}if(j.success)break;await new Promise(function(r){setTimeout(r,4000);});}
              if(!j.success)throw new Error(j.data);if(j.data.fim)log(a.titulo+': ✓ '+j.data.palavras+' palavras ('+total+' partes)');}
          }
          b.addEventListener('click',async function(){b.disabled=true;try{var l=await post({action:'eap_ia_grandes'});if(!l.success)throw new Error(l.data);
            for(var i=0;i<l.data.length;i++){try{await uma(l.data[i]);}catch(e){log(l.data[i].titulo+': ✗ '+(e.message||e));}}
            m.textContent='✓ Pronto. Agora clique em “Atualizar base agora”.';}catch(e){m.textContent='Erro: '+(e.message||e);}b.disabled=false;});
        })();</script>
        <script>(function(){var b=document.getElementById('eapIaLocal'),m=document.getElementById('eapIaLocalMsg'),lg=document.getElementById('eapIaVimeoLog');if(!b)return;
          b.addEventListener('click',function(){b.disabled=true;
            (function passo(){var f=new FormData();f.append('action','eap_ia_transcrever');f.append('_n','<?php echo esc_js(wp_create_nonce('eap_ia_sync')); ?>');
              fetch(ajaxurl,{method:'POST',body:f,credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){
                if(!j.success){m.textContent='Erro: '+j.data;b.disabled=false;return;}
                (j.data.log||[]).forEach(function(x){var d=document.createElement('div');d.textContent=x;lg.appendChild(d);});m.textContent='Transcrevendo… faltam '+j.data.faltam;
                if(j.data.faltam>0&&j.data.feitos>0)return passo();
                m.textContent='✓ Pronto. Agora clique em “Atualizar base agora”.';b.disabled=false;
              }).catch(function(){m.textContent='Demorou demais ou caiu a conexão. Clique de novo para continuar.';b.disabled=false;});})();});})();</script>
        <script>(function(){var b=document.getElementById('eapIaVimeo'),m=document.getElementById('eapIaVimeoMsg'),lg=document.getElementById('eapIaVimeoLog'),rf=document.getElementById('eapIaVimeoRefazer');if(!b)return;
          b.addEventListener('click',function(){b.disabled=true;lg.innerHTML='';var rod=Date.now()%1000000;
            (function passo(){var f=new FormData();f.append('action','eap_ia_vimeo');f.append('_n','<?php echo esc_js(wp_create_nonce('eap_ia_sync')); ?>');f.append('rodada',rod);if(rf.checked)f.append('refazer','1');
              fetch(ajaxurl,{method:'POST',body:f,credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){
                if(!j.success){m.textContent='Erro: '+j.data;b.disabled=false;return;}
                (j.data.log||[]).forEach(function(x){var d=document.createElement('div');d.textContent=x;lg.appendChild(d);});m.textContent='Importando… faltam '+j.data.faltam;
                if(j.data.faltam>0&&j.data.feitos>0)return passo();
                m.textContent='✓ Pronto. Agora clique em “Atualizar base agora” para a IA aprender as aulas.';b.disabled=false;
              }).catch(function(){m.textContent='Falha de conexão. Clique de novo para continuar.';b.disabled=false;});})();});})();</script>
        <p style="margin-bottom:0">Perguntas registradas: <b><?php echo (int) $tot; ?></b> · sem resposta no portal: <b><?php echo (int) $sem; ?></b> <span class="description">(as sem resposta mostram o que falta de conteúdo)</span></p>
      </div>
      <script>(function(){var b=document.getElementById('eapIaSync'),m=document.getElementById('eapIaSyncMsg'),e=document.getElementById('eapIaSyncErros');if(!b)return;
        b.addEventListener('click',function(){b.disabled=true;e.innerHTML='';var err=[];
          (function passo(){var f=new FormData();f.append('action','eap_ia_sync');f.append('_n','<?php echo esc_js(wp_create_nonce('eap_ia_sync')); ?>');
            fetch(ajaxurl,{method:'POST',body:f,credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){
              if(!j.success){m.textContent='Erro: '+j.data;b.disabled=false;return;}
              err=err.concat(j.data.erros||[]);m.textContent='Enviando… faltam '+j.data.faltam+' de '+j.data.total;
              if(j.data.faltam>0&&j.data.feitos>0)return passo();
              m.textContent='✓ Base atualizada ('+j.data.total+' itens).';b.disabled=false;if(err.length)e.innerHTML='Itens com erro:<br>'+err.map(function(x){return x.replace(/</g,'&lt;');}).join('<br>');
            }).catch(function(){m.textContent='Falha de conexão. Clique de novo para continuar de onde parou.';b.disabled=false;});})();});})();</script>
    </div>
    <?php
}
