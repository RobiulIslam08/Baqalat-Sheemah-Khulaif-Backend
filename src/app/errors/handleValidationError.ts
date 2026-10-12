import mongoose from "mongoose";
import { TErrorSourses, TGenericErrorResponse } from "../interface/error";

const handleValidationError = (err:mongoose.Error.ValidationError):TGenericErrorResponse => {
	const errorSources:TErrorSourses = Object.values(err.errors).map((val:mongoose.Error.ValidatorError |mongoose.Error.CastError) => {
	
		return {
			path:val?.path,
			message:val?.message
		}
	})
	const statusCode = 400;
	return {
	  statusCode,
	  message: 'Mongoose Validation Error',
	  errorSources,
	};
}
export default handleValidationError