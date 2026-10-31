import { SectionHead } from './section-head';

const PORTS = [
  { port: 80, proto: 'HTTP', title: 'Device API', body: 'The device signs up here and learns where everything else is.' },
  { port: 443, proto: 'TLS', title: 'MQTT broker', body: 'Devices that reach it switch over for instant commands.' },
  { port: 9000, proto: 'HTTPS', title: 'Media bucket', body: 'Photos and ~4 s video chunks land here, then get joined per visit.' },
  { port: 8443, proto: 'TLS', title: 'Dashboard & API', body: 'You, from a browser or the iOS app. Every request carries a token.', user: true },
];

/** The four servers the one process runs, and which side of the two planes each sits on. */
export function HowItWorksPorts() {
  return (
    <section className="lp-block" id="how-it-works">
      <div className="lp-wrap">
        <SectionHead eyebrow="How it works" title="One process. Four servers. Nothing in PetKit's cloud.">
          The device believes it is talking to the real cloud, so every answer is shaped like the cloud&apos;s. A wrong
          answer doesn&apos;t produce an error: the device reboots or retries forever. That&apos;s why the protocol core
          is pinned byte for byte.
        </SectionHead>
        <div className="lp-ports" data-lp-reveal="">
          {PORTS.map((p) => (
            <article className="lp-port" key={p.port}>
              <div className="lp-port-num">
                <span data-lp-count={p.port}>{p.port}</span>
                <small>{p.proto}</small>
              </div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <span className="lp-plane" data-user={p.user || undefined}>
                {p.user ? 'User plane' : 'Device plane'}
              </span>
            </article>
          ))}
        </div>
        <div className="lp-planes">
          <div>
            <b>Device plane</b> talks to firmware that has no credential yet. It stays on your LAN or a VPN, never on
            the internet.
          </div>
          <div>
            <b>User plane</b> is default-deny and TLS in every deploy mode. It&apos;s the only part you may expose.
          </div>
        </div>
      </div>
    </section>
  );
}
