import { createCollection } from '../../DB/collection';

export const Customer = createCollection('customers', { softDelete: true });
