# Reaching the dashboard and the iOS app from outside

The device plane (ports 80, 443, 9000) never goes on the internet, in any of
these setups. Only the user plane does: the dashboard and the iOS app on
`user_port` (8443 by default), which requires the admin password or a paired
client token on every request.

How the iOS app trusts the server decides what works:

- An **IP address** or a **`.local`/single-label name**: the app pins the
  self-signed certificate from the pairing QR code.
- **Any other name** (`*.ts.net`, your own domain): iOS demands a certificate
  the system trusts before the app can check anything, so that name must serve
  a publicly trusted certificate. (`apps/ios/SPIKE.md` has the measurements.)

Whichever name or address the browser uses must also be accepted by the server:
IP addresses and `localhost` always are; add a host name to `user_hosts`
(add-on option, or `--user-hosts`).

## Tailscale (recommended)

Install Tailscale on the machine running my-petkit (for the add-on, the
Tailscale add-on) and on your phone or laptop. Two ways in:

**By Tailscale IP.** Pair the iOS app with `https://100.x.y.z:8443`. It is an IP
literal, so the app pins the self-signed certificate exactly as on the LAN.
Nothing else to configure. Browsers show a certificate warning, as they do on
the LAN.

**By MagicDNS name, with a trusted certificate.** Enable HTTPS certificates in
the Tailscale admin console, then put Tailscale's HTTPS proxy in front of the
user plane:

```sh
tailscale serve --bg --https=443 https+insecure://127.0.0.1:8443
```

`tailscale serve` gets the `<machine>.<tailnet>.ts.net` certificate (the one
`tailscale cert` issues) and forwards to the user plane on this machine; the
`https+insecure` hop is local and the user plane's certificate is self-signed.
Add `<machine>.<tailnet>.ts.net` to `user_hosts` and set `user_url` to
`https://<machine>.<tailnet>.ts.net` (add-on option, or `--user-url`), so the
pairing QR code sends the phone there; then use that address in the browser
too. Use
`tailscale serve` rather than `tailscale funnel`: funnel publishes the
dashboard to the whole internet.

With the add-on, the Tailscale add-on runs in its own container, so forward to
the host's LAN address and the mapped `user_port` instead of `127.0.0.1`.

## Cloudflare Tunnel

`cloudflared` makes an outbound connection to Cloudflare, which serves your
domain with its own certificate and forwards to the user plane:

```yaml
# ~/.cloudflared/config.yml
tunnel: <tunnel id>
credentials-file: /etc/cloudflared/<tunnel id>.json
ingress:
  - hostname: petkit.example.com
    service: https://127.0.0.1:8443
    originRequest:
      noTLSVerify: true   # the user plane's certificate is self-signed
  - service: http_status:404
```

Add `petkit.example.com` to `user_hosts`, and set `user_url` to
`https://petkit.example.com` for the pairing QR code.

**The trade-off:** Cloudflare terminates TLS, so it sees everything that
passes, including your password, session tokens, camera recordings and live
video. Use Cloudflare Access in front of it if you want a second login. Live
video over WebRTC does not go through the tunnel (it needs a direct UDP/TCP
path); MSE and HLS do.

## Behind any proxy: the login limit

The failed-login limit counts attempts per client address, and behind a proxy
every attempt comes from the proxy. Five wrong passwords from anyone who can
reach the proxy then lock everyone out of login and pairing for up to 15
minutes; sessions and paired phones keep working. `tailscale serve` only admits
your tailnet, so this matters for a public domain: Cloudflare Tunnel or the VPS.

## A VPS with your own domain

[`deploy/cloud/`](../deploy/cloud/README.md) runs the whole server on a VPS,
with Caddy serving your domain and a WireGuard tunnel back to the devices.
