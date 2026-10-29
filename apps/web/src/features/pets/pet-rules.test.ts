import { describe, expect, it } from 'vitest';
import {
  clampView,
  coverView,
  drawRect,
  FACE_RULES,
  FACE_SIZE,
  MAX_ZOOM,
  panView,
  zoomPercent,
  zoomView,
} from './crop-geometry';
import { findingLine } from './components/pets-heading';
import { cacheVerdict, importSummary, parseIdList, petStatus, withAlias } from './pet-model';
import { deviceDetail, pet } from './pets-fixtures';

describe('crop geometry', () => {
  it('covers the frame and centres a landscape photo', () => {
    const v = coverView(720, 360, 360);
    expect(v.minScale).toBe(1);
    expect(v.x).toBe(-180);
    expect(v.y).toBe(0);
    expect(zoomPercent(v)).toBe(100);
  });

  it('never lets a pan expose the canvas behind the photo', () => {
    const v = coverView(720, 360, 360);
    expect(panView(v, 500, 50, 360)).toMatchObject({ x: 0, y: 0 });
    expect(panView(v, -500, 0, 360).x).toBe(-360);
  });

  it('caps the zoom between cover and eight times cover', () => {
    const v = coverView(400, 400, 360);
    expect(zoomView(v, v.scale / 4, 180, 180).scale).toBe(v.minScale);
    expect(zoomPercent(zoomView(v, v.scale * 100, 180, 180))).toBe(MAX_ZOOM * 100);
  });

  it('keeps the point under the cursor fixed while zooming', () => {
    const v = coverView(360, 360, 360);
    const z = zoomView(v, 2, 90, 90, 360);
    // The photo pixel under (90, 90) was 90; after a 2x zoom it is still there.
    expect((90 - z.x) / z.scale).toBeCloseTo(90);
    expect(clampView(z, 360)).toEqual(z);
  });

  it('maps the stage transform onto the 224 preview', () => {
    const v = coverView(720, 360, 360);
    expect(drawRect(v, FACE_SIZE, 360)).toEqual({
      x: (-180 * FACE_SIZE) / 360,
      y: 0,
      w: (720 * FACE_SIZE) / 360,
      h: FACE_SIZE,
    });
  });

  it('keeps the eight face rules, two of them positive', () => {
    expect(FACE_RULES).toHaveLength(8);
    expect(FACE_RULES.filter(r => r.ok)).toHaveLength(2);
  });
});

describe('pet model', () => {
  it('reads JSON id columns and tolerates garbage', () => {
    expect(parseIdList('[1, "2"]')).toEqual([1, 2]);
    expect(parseIdList('not json')).toEqual([]);
    expect(parseIdList('{"a":1}')).toEqual([]);
    expect(parseIdList(null)).toEqual([]);
  });

  it('adds an alias without dropping the existing ones or duplicating', () => {
    expect(withAlias('[88412]', 555)).toEqual([88412, 555]);
    expect(withAlias('[555]', 555)).toEqual([555]);
    expect(withAlias('broken', 555)).toEqual([555]);
  });

  it('treats an unset ai_enabled as recognising', () => {
    const d = deviceDetail({ aiInfo: null }, ['11', '12']);
    expect(petStatus(pet(), [d]).loaded).toBe(true);
  });

  it('reports why a pet is idle', () => {
    expect(petStatus(pet({ faces: [] }), []).label).toBe('No face photos yet');
    expect(petStatus(pet({ device_ids_json: '[]' }), []).label).toBe('No device assigned');
    expect(petStatus(pet(), [deviceDetail({}, [11, 12], false)]).label).toBe(
      'Recognition is off on its devices',
    );
  });

  it('judges a device cache against our face ids', () => {
    expect(cacheVerdict(deviceDetail(), [11]).kind).toBe('none');
    expect(cacheVerdict(deviceDetail({}, []), [11]).kind).toBe('empty');
    expect(cacheVerdict(deviceDetail({}, [11]), [11, 12]).kind).toBe('ours');
    expect(cacheVerdict(deviceDetail({}, [11, 7]), [11]).kind).toBe('foreign');
  });

  it('summarises an import that found nothing new', () => {
    expect(importSummary([{ pet_ref: 1, outcome: 'already yours' }])).toMatch(/^Nothing new/);
  });

  it('writes the finding line from loaded, waiting and unbound counts', () => {
    const mochi = pet({ id: 2, name: 'Mochi', faces: [{ id: 21, url: 'x' }] });
    const line = findingLine([pet(), mochi], [deviceDetail({}, [11, 12])], 2);
    expect(line).toBe(
      'Miso is recognised. Mochi is still waiting for the device to fetch the photos. 2 reported identities have no pet yet.',
    );
  });
});
