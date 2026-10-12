import { createCollection } from '../../DB/collection';

export const Purchase = createCollection('purchases', { refs: { supplier: 'suppliers' } });
