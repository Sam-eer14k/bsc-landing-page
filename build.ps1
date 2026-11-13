# Builds index.html (single file, CSS and JS inline) at the repo root and the
# WordPress theme from the sources in src/. Run:
#
#   powershell -ExecutionPolicy Bypass -File build.ps1
#
# Edit src/_head.html, src/_body.html, src/css/theme.css or src/js/main.js.
# Never edit index.html or the theme's style.css, front-page.php or main.js:
# they are generated and will be overwritten. functions.php and index.php in
# wordpress-theme/ are hand-written and safe to edit.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$src = Join-Path $root 'src'
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Inbox for the static site's form (it opens the visitor's email app).
# bluecomputerservices.com lists info@ as its contact address.
# The WordPress theme sends with wp_mail instead (see functions.php).
$LeadEmail = 'info@bluecomputerservices.com'

function Read-Src($name) { [IO.File]::ReadAllText((Join-Path $src $name), $utf8) }
function Write-Out($path, $text) {
  $dir = Split-Path $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  [IO.File]::WriteAllText($path, $text.Replace("`r`n", "`n"), $utf8)
}

$head = Read-Src '_head.html'
$body = Read-Src '_body.html'
$css  = Read-Src 'css\theme.css'
$js   = Read-Src 'js\main.js'

# Conservative minifiers for the copy inlined into index.html (src/ stays readable).
function Minify-Css($s) {
  $s = [regex]::Replace($s, '(?s)/\*.*?\*/', '')
  $s = [regex]::Replace($s, '\s+', ' ')
  $s = [regex]::Replace($s, '\s*([{};,>])\s*', '$1')
  $s = [regex]::Replace($s, '([^\s(]):\s+', '$1:')
  $s = $s.Replace(';}', '}')
  return $s.Trim()
}
# JS: drop block comments, whole-line // comments, indentation and blank lines.
# Line breaks are kept so automatic semicolon insertion can't change behaviour.
function Minify-Js($s) {
  $s = [regex]::Replace($s, '(?s)/\*.*?\*/', '')
  $lines = $s -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('//') }
  return ($lines -join "`n")
}

# Sanity checks.
if ((([regex]::Matches($css, '"')).Count % 2) -ne 0) { throw 'theme.css has an odd number of double quotes' }
if ((([regex]::Matches($css, "'")).Count % 2) -ne 0) { throw 'theme.css has an odd number of single quotes' }
$dashes = '[' + [char]0x2014 + [char]0x2013 + ']'
if ($body -match $dashes -or $head -match $dashes) { throw 'An em or en dash is in the page copy (house style: none)' }
# Every asset the page points at must exist, with exact filename case (Linux hosts are case-sensitive, Windows is not).
$refs = @()
$refs += [regex]::Matches($body, '\{\{A\}\}([A-Za-z0-9_./-]+)') | ForEach-Object { 'assets/' + $_.Groups[1].Value }
$refs += [regex]::Matches($head, '(?:href|content)="((?:assets/)?[A-Za-z0-9_./-]+\.(?:png|ico|jpg|webp|webmanifest))') | ForEach-Object { $_.Groups[1].Value }
$refs += [regex]::Matches([IO.File]::ReadAllText((Join-Path $root 'site.webmanifest'), $utf8), '"src":\s*"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
foreach ($ref in ($refs | Sort-Object -Unique)) {
  $dir = $root; $ok = $true
  foreach ($seg in $ref.Split('/')) {
    $hit = Get-ChildItem -LiteralPath $dir -Force | Where-Object { $_.Name -ceq $seg }
    if (-not $hit) { $ok = $false; break }
    $dir = $hit.FullName
  }
  if (-not $ok) { throw "Missing (or wrong case) asset: $ref" }
}

# ==[CONFIRM: ...]== placeholders become visible marks until the client supplies the fact.
$confirmRe = '==\[CONFIRM(?:: [^\]]*)?\]=='
if ($body -match ('="[^"]*' + $confirmRe)) { throw 'CONFIRM placeholder inside an HTML attribute: it would not render' }
$confirmCount = ([regex]::Matches($body, $confirmRe)).Count
$body = [regex]::Replace($body, $confirmRe, '<mark class="cf">$0</mark>')

# Tokens only: colour literals are allowed inside the :root block and nowhere else.
$cssOutsideRoot = [regex]::Replace($css, '(?s):root \{.*?\n\}', '', 1)
$cssBare = [regex]::Replace($cssOutsideRoot, '(?s)/\*.*?\*/', '')
$hexHit = [regex]::Match($cssBare, '(?<![\w-])#[0-9a-fA-F]{3,8}\b')
if ($hexHit.Success) { throw "Hardcoded colour in theme.css: $($hexHit.Value)" }
if ($cssBare -match 'rgba?\(\s*\d') { throw 'Hardcoded rgb() in theme.css' }
if ($body -match '(fill|stroke|color)\s*[=:]\s*"?#[0-9a-fA-F]') { throw 'Hardcoded colour in _body.html' }

$cssMin = Minify-Css $css
$jsMin  = Minify-Js $js

# ---------------- static HTML ----------------
$htmlBody = $body.Replace('{{A}}', 'assets/').Replace('{{FORM_ACTION}}', "mailto:$LeadEmail").Replace('{{FORM_MODE}}', 'mailto')
$htmlBody = [regex]::Replace($htmlBody, '<!--WP:[a-z-]+-->', '')
if ($htmlBody -match '\{\{') { throw 'Unreplaced {{ }} placeholder in the body' }
$html = "<!doctype html>`n<html lang=""en"">`n<head>`n$head<style>$cssMin</style>`n</head>`n<body>`n$htmlBody`n<script>`n$jsMin`n</script>`n</body>`n</html>`n"
Write-Out (Join-Path $root 'index.html') $html
"index.html  $([math]::Round($html.Length / 1KB)) KB, $confirmCount CONFIRM marks"

# ---------------- WordPress theme ----------------
$theme = Join-Path $root 'wordpress-theme'

$styleHeader = @'
/*
Theme Name: Blue Computer Services
Author: Zaphyre
Description: One-page landing theme for Blue Computer Services, a Livermore, California business IT company (interactive one-page site). Set a static front page under Settings > Reading.
Version: 1.0.0
Requires at least: 6.0
Requires PHP: 7.4
License: GNU General Public License v2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: bcs
*/

/* WordPress admin bar offset for the sticky header. */
body.admin-bar .hd { top: 32px; }
@media screen and (max-width: 782px) { body.admin-bar .hd { top: 46px; } }
@media screen and (max-width: 600px) { body.admin-bar .hd { top: 0; } }

'@
Write-Out (Join-Path $theme 'style.css') ($styleHeader + $css)
Write-Out (Join-Path $theme 'assets\js\main.js') $js

$wp = $body.Replace('{{A}}', '<?php echo esc_url( $bcs_a ); ?>')
$wp = $wp.Replace('action="{{FORM_ACTION}}"', 'action="<?php echo esc_url( admin_url( ''admin-post.php'' ) ); ?>"')
$wp = $wp.Replace('data-mode="{{FORM_MODE}}"', 'data-mode="wp"')
$wp = $wp.Replace('<!--WP:contact-fields-->', '<input type="hidden" name="action" value="bcs_contact"><?php wp_nonce_field( ''bcs_contact'', ''bcs_nonce'' ); ?>')
$wp = $wp.Replace('<!--WP:contact-status-->', '<?php echo esc_html( $bcs_status[1] ); ?>')
$wp = $wp.Replace('class="form__status" id="form-status"', 'class="form__status <?php echo esc_attr( $bcs_status[0] ); ?>" id="form-status"')
$wp = $wp.Replace('<span data-year>2026</span>', '<span data-year><?php echo esc_html( wp_date( ''Y'' ) ); ?></span>')
if ($wp -match '<!--WP:') { throw 'Unreplaced WP marker in body' }
if ($wp -match '\{\{') { throw 'Unreplaced {{ }} placeholder in body' }

$frontPage = @'
<?php
/**
 * Front page. Generated by build.ps1 from src/_body.html: edit the source, not this file.
 *
 * @package BCS
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$bcs_a      = trailingslashit( get_theme_file_uri( 'assets' ) );
$bcs_status = bcs_form_status();
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

'@ + $wp + @'

<?php wp_footer(); ?>
</body>
</html>

'@
Write-Out (Join-Path $theme 'front-page.php') $frontPage

foreach ($sub in @('images')) {
  $from = Join-Path $root "assets\$sub"
  $dst = Join-Path $theme "assets\$sub"
  # Mirror the folder so files removed from assets/ also leave the theme.
  if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
  Copy-Item $from $dst -Recurse -Force
}
"wordpress-theme regenerated"
