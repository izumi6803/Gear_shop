// Đọc payload JWT ở client. Token là nguồn sự thật về danh tính:
// nếu storage bị lệch (user cũ + token mới), ta luôn tin token.
export interface TokenIdentity {
  username: string;
  name: string;
  role: string;
  expiresAt: number;
}

interface RawClaims {
  sub?: string;
  unique_name?: string;
  name?: string;
  role?: string;
  exp?: number;
  [key: string]: unknown;
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function decodeToken(token: string | null): TokenIdentity | null {
  if (!token) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const claims = JSON.parse(base64UrlDecode(parts[1])) as RawClaims;
    const expiresAt = typeof claims.exp === 'number' ? claims.exp * 1000 : 0;

    // .NET ghi ClaimTypes.Name/Role thành các URI dài; đọc cả hai dạng.
    const nameClaim =
      (claims.name as string | undefined) ??
      (claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] as string | undefined) ??
      '';
    const roleClaim =
      (claims.role as string | undefined) ??
      (claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] as string | undefined) ??
      '';
    const username =
      (claims.sub as string | undefined) ??
      (claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] as string | undefined) ??
      '';

    if (!roleClaim) {
      return null;
    }

    return { username, name: nameClaim || username, role: roleClaim, expiresAt };
  } catch {
    return null;
  }
}

export function isExpired(identity: TokenIdentity | null): boolean {
  return !identity || (identity.expiresAt > 0 && identity.expiresAt <= Date.now());
}
