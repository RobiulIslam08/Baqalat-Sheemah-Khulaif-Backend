import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { FormulationService } from './formulation.service';

const createFormulation = catchAsync(async (req, res) => {
  const result = await FormulationService.createFormulation(req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Formulation created successfully', data: result });
});

const getAllFormulations = catchAsync(async (req, res) => {
  const result = await FormulationService.getAllFormulations(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Formulations retrieved successfully', meta: result.meta, data: result.data });
});

const updateFormulation = catchAsync(async (req, res) => {
  const result = await FormulationService.updateFormulation(req.params.id, req.body);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Formulation updated successfully', data: result });
});

const deleteFormulation = catchAsync(async (req, res) => {
  await FormulationService.deleteFormulation(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Formulation deleted successfully', data: null });
});

export const FormulationController = { createFormulation, getAllFormulations, updateFormulation, deleteFormulation };
