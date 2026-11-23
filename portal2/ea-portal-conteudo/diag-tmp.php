<?php
if (!defined('ABSPATH')) exit;
add_action('wp_ajax_eap_diag_tmp', function () {
    if (!current_user_can('manage_options')) wp_die('', 403);
    global $wpdb;
    $k = $wpdb->get_results("SELECT meta_key, COUNT(*) n, SUM(meta_value<>'') cheios FROM {$wpdb->usermeta} WHERE meta_key REGEXP 'cep|endere|address|bairro|cidade|city|state|postcode|numero|number|complement|logradouro|rua|estado|neighborhood|uf' AND meta_key NOT LIKE 'um_email%' GROUP BY meta_key ORDER BY cheios DESC LIMIT 40");
    $pg = $wpdb->get_results("SELECT ID, post_title, post_name, post_status, post_modified FROM {$wpdb->posts} WHERE post_type='page' AND (post_title LIKE '%ermo%' OR post_title LIKE '%rivacidade%' OR post_title LIKE '%ookie%' OR post_name LIKE '%privac%' OR post_name LIKE '%termo%')");
    wp_send_json(['meta' => $k, 'paginas' => $pg, 'pdf' => get_option('eap_arquivos_publicos')]);
});
