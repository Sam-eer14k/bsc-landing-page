<?php
/**
 * Blue Computer Services theme functions.
 *
 * @package BCS
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BCS_VERSION', '1.0.0' );

/**
 * Where contact form messages go. Change it under Settings > General > "BCS contact email".
 * Falls back to info@bluecomputerservices.com until it is set.
 */
function bcs_lead_email() {
	$email = get_option( 'bcs_lead_email' );
	return is_email( $email ) ? $email : 'info@bluecomputerservices.com';
}

/**
 * URL of a file inside the theme.
 */
function bcs_asset( $path ) {
	return esc_url( get_theme_file_uri( $path ) );
}

/* ------------------------------------------------------------------
 * Theme setup
 * ------------------------------------------------------------------ */
function bcs_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
}
add_action( 'after_setup_theme', 'bcs_setup' );

function bcs_document_title( $title ) {
	if ( is_front_page() ) {
		$title['title']   = 'Blue Computer Services';
		$title['tagline'] = "We Manage Your Network So You Don't Have To";
		unset( $title['site'] );
	}
	return $title;
}
add_filter( 'document_title_parts', 'bcs_document_title' );

function bcs_title_separator() {
	return '|';
}
add_filter( 'document_title_separator', 'bcs_title_separator' );

/* ------------------------------------------------------------------
 * Styles and scripts
 * ------------------------------------------------------------------ */
function bcs_enqueue() {
	wp_enqueue_style(
		'bcs-fonts',
		'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600&family=Rajdhani:wght@600;700&display=swap',
		array(),
		null
	);
	// Version by file date so browsers never keep an old copy after an update.
	$css_ver = (string) filemtime( get_stylesheet_directory() . '/style.css' );
	$js_ver  = (string) filemtime( get_theme_file_path( 'assets/js/main.js' ) );
	wp_enqueue_style( 'bcs-style', get_stylesheet_uri(), array( 'bcs-fonts' ), $css_ver );
	wp_enqueue_script( 'bcs-main', get_theme_file_uri( 'assets/js/main.js' ), array(), $js_ver, array( 'in_footer' => true, 'strategy' => 'defer' ) );
}
add_action( 'wp_enqueue_scripts', 'bcs_enqueue' );

function bcs_resource_hints( $urls, $relation ) {
	if ( 'preconnect' === $relation ) {
		$urls[] = 'https://fonts.googleapis.com';
		$urls[] = array(
			'href'        => 'https://fonts.gstatic.com',
			'crossorigin' => 'anonymous',
		);
	}
	return $urls;
}
add_filter( 'wp_resource_hints', 'bcs_resource_hints', 10, 2 );

/* ------------------------------------------------------------------
 * Head: favicons, meta, structured data
 * ------------------------------------------------------------------ */
function bcs_head_meta() {
	// Theme favicons are used until a Site Icon is set in the Customizer.
	if ( ! has_site_icon() ) {
		?>
		<link rel="icon" href="<?php echo bcs_asset( 'assets/images/favicon.ico' ); ?>" sizes="any">
		<link rel="icon" type="image/png" sizes="32x32" href="<?php echo bcs_asset( 'assets/images/favicon-32x32.png' ); ?>">
		<link rel="icon" type="image/png" sizes="16x16" href="<?php echo bcs_asset( 'assets/images/favicon-16x16.png' ); ?>">
		<link rel="apple-touch-icon" sizes="180x180" href="<?php echo bcs_asset( 'assets/images/apple-touch-icon.png' ); ?>">
		<?php
	}
	?>
	<meta name="theme-color" content="#061629">
	<?php
	if ( ! is_front_page() ) {
		return;
	}
	?>
	<meta name="description" content="Managed IT and security for small and medium-sized businesses, from Livermore, California. Remote or onsite support since 2002. Request a network audit.">
	<meta property="og:site_name" content="Blue Computer Services">
	<meta property="og:title" content="Blue Computer Services | We manage your network so you don't have to">
	<meta property="og:description" content="Managed IT and security for small and medium-sized businesses, from Livermore, California. Remote or onsite support since 2002.">
	<meta property="og:type" content="website">
	<meta property="og:image" content="<?php echo bcs_asset( 'assets/images/og-image.jpg' ); ?>">
	<meta name="twitter:card" content="summary_large_image">
	<script type="application/ld+json">
	<?php
	echo wp_json_encode(
		array(
			'@context'  => 'https://schema.org',
			'@type'     => 'ProfessionalService',
			'name'      => 'Blue Computer Services',
			'url'       => home_url( '/' ),
			'email'     => 'info@bluecomputerservices.com',
			'telephone' => '+1-925-605-5605',
			'founder'   => array(
				'@type' => 'Person',
				'name'  => 'Randall Nerison',
			),
			'address'   => array(
				'@type'           => 'PostalAddress',
				'addressLocality' => 'Livermore',
				'addressRegion'   => 'CA',
				'postalCode'      => '94551',
				'addressCountry'  => 'US',
			),
		),
		JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
	);
	?>
	</script>
	<?php
}
add_action( 'wp_head', 'bcs_head_meta', 2 );

/* ------------------------------------------------------------------
 * Settings: contact email field under Settings > General
 * ------------------------------------------------------------------ */
function bcs_register_settings() {
	register_setting(
		'general',
		'bcs_lead_email',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_email',
			'default'           => '',
		)
	);
	add_settings_field(
		'bcs_lead_email',
		'BCS contact email',
		function () {
			printf(
				'<input type="email" name="bcs_lead_email" id="bcs_lead_email" class="regular-text" value="%s"><p class="description">Messages from the front page contact form go to this address. Leave blank to use info@bluecomputerservices.com.</p>',
				esc_attr( get_option( 'bcs_lead_email' ) )
			);
		},
		'general'
	);
}
add_action( 'admin_init', 'bcs_register_settings' );

/* ------------------------------------------------------------------
 * Form handler (admin-post.php)
 * ------------------------------------------------------------------ */
function bcs_redirect_back( $status ) {
	$url = wp_get_referer() ? wp_get_referer() : home_url( '/' );
	$url = remove_query_arg( 'bcs', $url );
	$url = preg_replace( '/#.*$/', '', $url );
	wp_safe_redirect( add_query_arg( 'bcs', $status, $url ) . '#contact' );
	exit;
}

function bcs_handle_contact() {
	if ( ! isset( $_POST['bcs_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['bcs_nonce'] ) ), 'bcs_contact' ) ) {
		bcs_redirect_back( 'error' );
	}
	// Honeypot: real visitors never see this field.
	if ( ! empty( $_POST['website'] ) ) {
		bcs_redirect_back( 'sent' );
	}

	$field = function ( $key ) {
		return isset( $_POST[ $key ] ) ? sanitize_text_field( wp_unslash( $_POST[ $key ] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce checked above.
	};
	$name    = $field( 'name' );
	$email   = isset( $_POST['email'] ) ? sanitize_email( wp_unslash( $_POST['email'] ) ) : '';
	$phone   = $field( 'phone' );
	$company = $field( 'company' );
	$service = $field( 'service' );
	$message = isset( $_POST['message'] ) ? sanitize_textarea_field( wp_unslash( $_POST['message'] ) ) : '';

	if ( strlen( $name ) < 2 || ! is_email( $email ) || strlen( $message ) < 10 ) {
		bcs_redirect_back( 'invalid' );
	}

	$body = implode(
		"\n",
		array(
			'Name: ' . $name,
			'Email: ' . $email,
			'Phone: ' . ( $phone ? $phone : 'Not given' ),
			'Company: ' . ( $company ? $company : 'Not given' ),
			'Topic: ' . ( $service ? $service : 'Not given' ),
			'',
			$message,
		)
	);

	$sent = wp_mail(
		bcs_lead_email(),
		sprintf( 'Website enquiry from %s%s', $name, $service ? ' (' . $service . ')' : '' ),
		$body,
		array( 'Reply-To: ' . $name . ' <' . $email . '>' )
	);

	bcs_redirect_back( $sent ? 'sent' : 'error' );
}
add_action( 'admin_post_nopriv_bcs_contact', 'bcs_handle_contact' );
add_action( 'admin_post_bcs_contact', 'bcs_handle_contact' );

/**
 * Status message for the form after the redirect.
 *
 * @return array{0:string,1:string} [css class, message]
 */
function bcs_form_status() {
	$status = isset( $_GET['bcs'] ) ? sanitize_key( wp_unslash( $_GET['bcs'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- display only.
	switch ( $status ) {
		case 'sent':
			return array( 'is-ok', 'Thanks. Your message is with Blue Computer Services, and we will get back to you by phone or email.' );
		case 'invalid':
			return array( '', 'Some details were missing. Add your name, a valid email and a line about what you need, then send again.' );
		case 'error':
			return array( '', 'That did not go through. Email info@bluecomputerservices.com or call (925) 605-5605 instead.' );
	}
	return array( '', '' );
}
