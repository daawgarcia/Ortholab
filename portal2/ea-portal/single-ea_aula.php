<?php
if (!defined('ABSPATH')) exit;
wp_safe_redirect(add_query_arg('aula', get_queried_object_id(), home_url('/video-aulas/')));
exit;
