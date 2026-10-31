import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const revalidate = false;

// One index for both languages, filtered by locale on the client. Orama has no Vietnamese
// stemmer, so the default `multilingual` tokenizer (Unicode word segmentation, no stemming)
// is used for every locale rather than an English stemmer that would mangle Vietnamese.
export const { staticGET: GET } = createFromSource(source);
