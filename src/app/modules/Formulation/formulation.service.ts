import httpStatus from 'http-status';
import { Formulation } from './formulation.model';
import { IFormulation } from './formulation.interface';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';
import { Product } from '../Product/product.model';

const searchableFields = ['formulationName', 'formulationCode', 'group', 'manufacturer'];

const createFormulation = async (payload: IFormulation) => {
  const existing = await Formulation.findOne({ formulationCode: payload.formulationCode });
  if (existing) throw new AppError(httpStatus.CONFLICT, 'Formulation with this code already exists');
  return await Formulation.create(payload);
};

const getAllFormulations = async (query: Record<string, unknown>) => {
  const formulationQuery = new QueryBuilder(Formulation.find(), query)
    .search(searchableFields).filter().sort().paginate().fields();
  const result = await formulationQuery.modelQuery;
  const meta = await formulationQuery.countTotal();
  return { meta, data: result };
};

const updateFormulation = async (id: string, payload: Partial<IFormulation>) => {
  delete payload.formulationCode;
  delete payload.isDeleted;
  const previous = await Formulation.findById(id);
  if (!previous) throw new AppError(httpStatus.NOT_FOUND, 'Formulation not found');
  const formulation = await Formulation.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!formulation) throw new AppError(httpStatus.NOT_FOUND, 'Formulation not found');
  if (payload.formulationName && payload.formulationName !== previous.formulationName) {
    const products = await Product.find({ formulation: previous.formulationName });
    for (const product of products) {
      product.formulation = payload.formulationName;
      await product.save();
    }
  }
  return formulation;
};

const deleteFormulation = async (id: string) => {
  const formulation = await Formulation.findById(id);
  if (!formulation) throw new AppError(httpStatus.NOT_FOUND, 'Formulation not found');
  const used = await Product.findOne({ formulation: formulation.formulationName });
  if (used) throw new AppError(httpStatus.BAD_REQUEST, 'Formulation is still used by a product');
  formulation.isDeleted = true;
  await formulation.save();
};

export const FormulationService = { createFormulation, getAllFormulations, updateFormulation, deleteFormulation };
