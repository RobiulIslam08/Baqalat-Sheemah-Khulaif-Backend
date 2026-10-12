import express from 'express';
import { FormulationController } from './formulation.controller';
import validateRequest from '../../middleware/validationRequest';
import { FormulationValidation } from './formulation.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post('/', auth('admin', 'manager'), validateRequest(FormulationValidation.createFormulationValidationSchema), FormulationController.createFormulation);
router.get('/', auth('admin', 'manager', 'cashier'), FormulationController.getAllFormulations);
router.patch('/:id', auth('admin', 'manager'), validateRequest(FormulationValidation.updateFormulationValidationSchema), FormulationController.updateFormulation);
router.delete('/:id', auth('admin'), FormulationController.deleteFormulation);

export const FormulationRoutes = router;
