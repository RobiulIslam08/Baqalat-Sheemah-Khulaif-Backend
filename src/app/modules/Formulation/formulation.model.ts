import { createCollection } from '../../DB/collection';

export const Formulation = createCollection('formulations', { softDelete: true });
