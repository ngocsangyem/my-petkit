import { useState } from 'react';
import { cn } from 'cn';
import { Button } from '@/shared/ui';
import { Textarea } from '@/shared/ui/shadcn/textarea';
import { type DeviceDetail, deviceKeys } from '../api';
import { sendRaw, setEntity } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import type { DeviceEntity } from '../lib/entity-sections';
import { dirtyClass, FeedbackLine } from './panel-parts';

/**
 * Worked examples for the raw-command box. A placeholder would vanish the moment
 * you type, which is exactly when the envelope shape is needed. Each is a shape
 * this server really sends (ha/commands.py).
 */
const RAW_EXAMPLES: readonly { label: string; body: unknown }[] = [
  {
    label: 'Change a setting',
    body: {
      suffix: 'property/set',
      payload: {
        method: 'thing.service.property.set',
        id: '1',
        version: '1.0.0',
        params: { autoWork: 1 },
      },
    },
  },
  {
    label: 'Start an action',
    body: {
      suffix: 'start',
      payload: {
        method: 'thing.service.start',
        id: '1',
        version: '1.0.0',
        params: { start_action: 0 },
      },
    },
  },
  {
    label: 'Reset the N60 deodorant',
    body: {
      suffix: 'start',
      payload: {
        method: 'thing.service.start',
        id: '1',
        version: '1.0.0',
        params: { start_action: 10 },
      },
    },
  },
];

/**
 * The raw `{suffix, payload}` escape hatch. Published VERBATIM: the firmware
 * dispatches on `method`, so an envelope without one does nothing. The server
 * asks for step-up before it runs.
 */
export function RawCommand({ deviceId }: { deviceId: number }) {
  const call = useDeviceCall();
  const [text, setText] = useState('');
  const send = () => {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      call.say({ text: 'Invalid JSON — not sent', tone: 'error' });
      return;
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      call.say({ text: 'Send an object with suffix and payload', tone: 'error' });
      return;
    }
    void call.run(
      () => sendRaw(deviceId, body as Record<string, unknown>),
      [deviceKeys.detail(deviceId)],
    );
  };
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <p className="text-sm text-muted-foreground">
        Publishes verbatim; nothing is added. Sent over MQTT if the device has a session, else
        queued for its heartbeat. Needs step-up.
      </p>
      <Textarea
        className="field-sizing-fixed resize-y p-2 font-mono text-xs"
        rows={6}
        spellCheck={false}
        aria-label="Raw command JSON"
        value={text}
        onChange={e => {
          setText(e.target.value);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={send} disabled={call.busy}>
          Send raw
        </Button>
        <span className="text-muted-foreground">Load an example:</span>
        {RAW_EXAMPLES.map(x => (
          <Button
            key={x.label}
            variant="text"
            size="small"
            onClick={() => {
              setText(JSON.stringify(x.body, null, 2));
            }}
          >
            {x.label}
          </Button>
        ))}
      </div>
      <FeedbackLine feedback={call.feedback} />
    </div>
  );
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value ?? '', null, 2);
}

function ScheduleJson({ device, entity }: { device: DeviceDetail; entity: DeviceEntity }) {
  const call = useDeviceCall();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? textOf(entity.value);
  const save = () => {
    try {
      JSON.parse(shown);
    } catch {
      call.say({ text: 'Invalid JSON — not sent', tone: 'error' });
      return;
    }
    void call
      .run(() => setEntity(device.id, entity.key, shown), [deviceKeys.detail(device.id)])
      .then(ok => {
        if (ok) setDraft(null);
      });
  };
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Textarea
        className={cn(
          'field-sizing-fixed resize-y p-2 font-mono text-xs',
          dirtyClass(draft !== null),
        )}
        rows={4}
        spellCheck={false}
        aria-label={`${entity.name} JSON`}
        value={shown}
        onChange={e => {
          setDraft(e.target.value);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="small" onClick={save} disabled={call.busy}>
          Save {entity.name}
        </Button>
        {draft !== null && <span className="text-muted-foreground">Not sent yet</span>}
      </div>
      <FeedbackLine feedback={call.feedback} />
    </div>
  );
}

/**
 * What the device is actually served for each schedule, as JSON. Also the only
 * way to edit a shape the editors do not know: nothing here rewrites a field it
 * does not understand.
 */
export function ScheduleRawJson({
  device,
  entities,
}: {
  device: DeviceDetail;
  entities: readonly DeviceEntity[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {entities.map(e => (
        <div key={e.key} className="flex min-w-0 flex-col gap-2.5">
          <span className="text-sm font-medium">{e.name}</span>
          <ScheduleJson device={device} entity={e} />
        </div>
      ))}
    </div>
  );
}
