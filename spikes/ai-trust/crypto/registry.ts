/** Server-controlled test registry. Callers cannot supply a notice header key. */

export type TrustedPublicKey = {
  status: "FOUND";
  issuerId: string;
  kid: string;
  publicKey: CryptoKey;
};

export type RegistryResolution =
  | TrustedPublicKey
  | { status: "UNKNOWN_KEY" }
  | { status: "UNAVAILABLE" };

export type TrustedIssuerRegistry = {
  resolve(kid: string): RegistryResolution | Promise<RegistryResolution>;
};

export function memoryIssuerRegistry(
  keys: Array<{ issuerId: string; kid: string; publicKey: CryptoKey }>,
  options?: { unavailable?: boolean },
): TrustedIssuerRegistry {
  return {
    resolve(kid: string): RegistryResolution {
      if (options?.unavailable) return { status: "UNAVAILABLE" };
      const found = keys.find((key) => key.kid === kid);
      if (!found) return { status: "UNKNOWN_KEY" };
      return { status: "FOUND", issuerId: found.issuerId, kid: found.kid, publicKey: found.publicKey };
    },
  };
}
