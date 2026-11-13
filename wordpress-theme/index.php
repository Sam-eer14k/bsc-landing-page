<?php
/**
 * Fallback template. The landing page lives in front-page.php; set a static
 * front page under Settings > Reading so WordPress uses it.
 *
 * @package BCS
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require get_theme_file_path( 'front-page.php' );
