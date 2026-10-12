import { createCollection } from '../../DB/collection';

export const Sale = createCollection('sales', { refs: { customer: 'customers' } });
