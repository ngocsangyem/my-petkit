# my-petkit on a VPS

Your devices stay on your home LAN and reach a VPS through a WireGuard tunnel
that ends on your home router. You reach the dashboard and the iOS app over
public HTTPS. The device plane never listens on the internet.

```
 device 192.168.1.x ──LAN──► home router ══WireGuard══► VPS wg0 10.66.0.1 ──► my-petkit (80, 443, 9000)
 phone / browser ──HTTPS──► VPS public IP :443 ──► Caddy ──► my-petkit user plane (8443)
 phone / browser ──WebRTC──► VPS public IP :8555 (tcp/udp)
```

The home router does no NAT into the tunnel, so the server sees each device's
real address. The server dials a device only at an address the device reported
from a private range (`utils/outbound_guard.py`), so NAT would break the camera,
talk and the patchers.

## What you need

- A VPS with a public IPv4 address, Docker Engine 23+ with the compose plugin,
  and `wireguard-tools`.
- A DNS name for the dashboard: an A record pointing at that address, and no
  AAAA record (nothing here listens on IPv6).
- On AWS, GCP, Azure or Oracle, where the public address is mapped by NAT and is
  on no interface: set `MY_PETKIT_PUBLIC_BIND` in `.env` to the instance's
  private address.
- A home router that runs WireGuard and is the devices' default gateway.

## 1. The tunnel

1. On the VPS and on the router, each generate a key pair
   (`umask 077; wg genkey | tee private.key | wg pubkey > public.key`).
2. VPS: copy `wireguard/wg0.conf.example` to `/etc/wireguard/wg0.conf` and fill
   in the keys and your home subnet. `systemctl enable --now wg-quick@wg0`.
3. Router: enter `wireguard/home-router.conf.example`, and apply the three
   router settings listed at its end (no masquerade, forwarding rules, MSS
   clamping).
4. Start Docker only after the tunnel, so the container's published ports have
   their address:

   ```sh
   sudo systemctl edit docker.service
   # add:
   # [Unit]
   # After=wg-quick@wg0.service
   # Requires=wg-quick@wg0.service
   ```

Check, from the VPS:

| Command | Expected |
|---|---|
| `wg show wg0 latest-handshakes` | a timestamp under two minutes old |
| `ping -c3 192.168.1.1` | replies from the router's LAN address |

The router's forwarding rules let only the ports the server dials through to a
device, so a device does not answer ping from the VPS. The patcher curl in
step 4 is the check that the VPS reaches a device.

## 2. The host firewall

`nftables.conf.example` drops everything the host itself answers except SSH,
WireGuard and ICMP, and drops anything for the tunnel address that did not
arrive on wg0. Install it as `/etc/nftables.conf`, keep a second SSH session
open, `nft -f /etc/nftables.conf`, then `systemctl enable nftables`.

Never `systemctl restart nftables`: the unit flushes every rule on stop,
Docker's included, and the containers stop answering until
`systemctl restart docker`. Reload with `nft -f /etc/nftables.conf`.

Docker bypasses this for published ports, which is why `docker-compose.yml`
binds each published port to a specific address. Never change one to a bare
`"80:80"`.

## 3. The containers

```sh
cp .env.example .env && $EDITOR .env
docker compose pull
docker compose up -d
docker compose logs my-petkit | grep -i "setup token"
```

The setup token is printed once, on the first start. Open
`https://<your domain>/`, enter it and set the admin password. Then point the
devices at `http://<MY_PETKIT_WG_ADDRESS>/6/` (BLE provisioning, see the
repository README). The iOS pairing QR code carries `https://<your domain>`.

**Login lockout.** Behind Caddy every login attempt comes from Caddy's address,
so the failed-login limit counts the whole internet as one client: five wrong
passwords from anyone lock everyone out of login, step-up and pairing for up
to 15 minutes, and someone repeating them keeps it locked. Sessions and paired
phones keep working. If that happens, wait it out, or restrict who reaches
Caddy (a VPN, or Cloudflare Access in front of the domain).

Before pulling an image, verify its signature: [docs/deploy.md](../../docs/deploy.md#verify-the-image).

## 4. Check it

From the VPS:

| Command | Expected |
|---|---|
| `docker compose ps` | both services `running`, my-petkit `healthy` |
| `curl -s -o /dev/null -w '%{http_code}\n' http://10.66.0.1/6/dev_signup` | `200` |
| `curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/api/info` | `401` |
| `curl -s http://<device IP>:8889/` (a device with a patcher applied) | the patcher's read-back, not a timeout |
| `docker compose logs my-petkit \| grep go2rtc` after opening a camera's live view | `main.flv` probed, stream up |
| upload a large clip: trigger a recording, then `ls -la` the media volume | the clip arrives complete (a hang here is the MTU/MSS problem) |

From a machine **outside** your network:

```sh
sudo nmap -sS -sU -p- <VPS public IP>
```

Expected open ports, and nothing else:

| Port | Why |
|---|---|
| 22/tcp | SSH |
| 80/tcp, 443/tcp | Caddy |
| 8555/tcp, 8555/udp | WebRTC media |
| 51820/udp | WireGuard (UDP scans may show it `open\|filtered`) |

Port 9000, 1883, 8443, 8099, 8554 or 1984 showing up is a misconfiguration;
stop the stack and compare the `ports:` lines with this directory's copy.

## Updating and rolling back

```sh
docker compose pull && docker compose up -d     # update to the tag in .env
```

To roll back, set `MY_PETKIT_TAG` in `.env` to the previous release (or an
exact digest, `ghcr.io/ngocsangyem/my-petkit@sha256:…`) and run
`docker compose up -d` again. Back up the `data` volume before every update:

```sh
docker run --rm -v my-petkit_data:/data:ro -v "$PWD":/backup alpine \
  tar czf /backup/my-petkit-data-$(date +%F).tgz -C /data .
```

The data volume holds the device identities, the TLS keys and the user
plane's secrets; treat the archive like a password.
