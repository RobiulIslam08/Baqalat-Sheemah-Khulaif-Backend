export interface IFormulation {
  formulationCode: string;
  formulationName: string;
  group?: string;
  strength?: string;
  manufacturer?: string;
  notes?: string;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
