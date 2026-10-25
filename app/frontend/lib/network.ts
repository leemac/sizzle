// Tailscale gives devices addresses in 100.64.0.0/10 and MagicDNS names under ts.net.
export function isTailscaleHost(hostname: string): boolean {
  if (hostname.endsWith('.ts.net')) return true

  const octets = hostname.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false
  return octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127
}
