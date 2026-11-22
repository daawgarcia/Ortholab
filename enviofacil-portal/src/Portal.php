<?php
declare(strict_types=1);

namespace EnvioFacil;

/**
 * Entrada pelo Portal do Credenciado (login único).
 * O portal manda ?portal=v1.<payload>.<assinatura> (HMAC-SHA256 com a chave 'sso_secret' do config.php),
 * válido por 90 s e de uso único. O dentista chega identificado: nome travado e WhatsApp preenchido.
 */
function portalSecret(): string
{
    global $config;
    return (string) ($config['sso_secret'] ?? '');
}

function b64urlDecode(string $s): string
{
    return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true);
}

function b64urlEncode(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function verifyPortalToken(string $token): ?array
{
    $secret = portalSecret();
    $parts = explode('.', $token);
    if (strlen($secret) < 32 || count($parts) !== 3 || $parts[0] !== 'v1') {
        return null;
    }
    $expected = b64urlEncode(hash_hmac('sha256', 'v1.' . $parts[1], $secret, true));
    if (!hash_equals($expected, $parts[2])) {
        return null;
    }
    $data = json_decode(b64urlDecode($parts[1]), true);
    $now = time();
    if (!is_array($data) || ($data['d'] ?? '') !== 'enviofacil' || (int) ($data['exp'] ?? 0) < $now || (int) ($data['iat'] ?? 0) > $now + 30) {
        return null;
    }
    $nonce = (string) ($data['n'] ?? '');
    if ($nonce === '') {
        return null;
    }
    $dir = privatePath('portal-nonces');
    if (!is_dir($dir) && !mkdir($dir, 0700) && !is_dir($dir)) {
        return null;
    }
    $file = $dir . '/' . hash('sha256', $nonce);
    $h = @fopen($file, 'x'); // falha se o link já foi usado
    if (!$h) {
        return null;
    }
    fclose($h);
    foreach (glob($dir . '/*') ?: [] as $old) { // limpeza simples
        if (filemtime($old) < $now - 3600) {
            @unlink($old);
        }
    }
    return $data;
}

/** Dados do dentista vindo do portal (vale 4 horas). */
function portalIdentity(): ?array
{
    $p = $_SESSION['portal'] ?? null;
    if (!is_array($p) || ($p['at'] ?? 0) < time() - 4 * 3600) {
        return null;
    }
    return $p;
}

function startPortalSession(array $data): void
{
    session_regenerate_id(true);
    $_SESSION['csrf'] = token();
    $_SESSION['portal'] = [
        'name' => mb_substr(trim((string) ($data['nm'] ?? '')), 0, 120),
        'whatsapp' => preg_replace('/[^\d+]/', '', (string) ($data['w'] ?? '')),
        'email' => mb_substr((string) ($data['e'] ?? ''), 0, 160),
        'cro' => preg_replace('/\D/', '', (string) ($data['cro'] ?? '')),
        'at' => time(),
    ];
}

/** Nome gravado no caso quando veio do portal (identificado). */
function portalDentistLabel(array $p): string
{
    $label = $p['name'] . ' · via Portal' . ($p['cro'] !== '' ? ' (CRO ' . $p['cro'] . ')' : '');
    return mb_substr($label, 0, 160);
}
