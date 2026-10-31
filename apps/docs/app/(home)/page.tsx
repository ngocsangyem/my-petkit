import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/logo';

const sections = [
  {
    href: '/docs/install',
    title: 'Install',
    body: 'Home Assistant add-on, a container on your LAN, or a VPS behind WireGuard.',
  },
  {
    href: '/docs/guides/add-a-device',
    title: 'Add a device',
    body: 'Hand a litter box, feeder or fountain its Wi-Fi and the address of your server.',
  },
  {
    href: '/docs/configuration',
    title: 'Configure',
    body: 'Every option, every port, and what breaks if you remap one.',
  },
  {
    href: '/docs/firmware',
    title: 'Firmware and patchers',
    body: 'What each on-device patch changes, how it is applied and how to undo it.',
  },
  {
    href: '/docs/devices',
    title: 'Device reference',
    body: 'Pairing buttons, indicator lights and safety limits, taken from the PetKit manuals.',
  },
  {
    href: '/docs/contributing',
    title: 'Contribute',
    body: 'Run the tests, the checks CI runs, and the rules the protocol code lives by.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-16">
      <section className="flex flex-col items-start gap-5">
        <Logo className="size-10" />
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Your PetKit devices, talking to your own server.
        </h1>
        <p className="max-w-2xl text-lg text-fd-muted-foreground">
          MyPetKit stands in for the PetKit cloud. A litter box, feeder or fountain connects to it
          instead of PetKit&apos;s servers and keeps working, while its visits, photos and video stay on
          a machine you own. It runs with the internet unplugged and publishes everything to Home
          Assistant over MQTT.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/docs"
            className="rounded-full bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground"
          >
            Read the docs
          </Link>
          <Link
            href="/docs/install/home-assistant-add-on"
            className="rounded-full border border-fd-border bg-fd-card px-5 py-2.5 text-sm font-medium"
          >
            Install the add-on
          </Link>
        </div>
      </section>

      <Image
        src="/screenshots/web-home.webp"
        alt="The MyPetKit dashboard home screen listing a litter box, a feeder and a fountain"
        width={1600}
        height={1000}
        className="w-full rounded-2xl border border-fd-border"
        priority
        unoptimized
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-2xl border border-fd-border bg-fd-card p-5 transition-colors hover:bg-fd-accent"
          >
            <h2 className="mb-1.5 font-semibold">{s.title}</h2>
            <p className="text-sm text-fd-muted-foreground">{s.body}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
