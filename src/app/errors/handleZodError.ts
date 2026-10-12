import { ZodError } from "zod";
import { TErrorSourses, TGenericErrorResponse } from "../interface/error";

  const handleZodError = (err:ZodError):TGenericErrorResponse=>{
	const errorSources:TErrorSourses = err.issues.map(issue => {
	 return {
	  path: issue?.path[issue.path.length - 1] as string | number,
	  message:issue.message
	 }
	})
	const statusCode = 400;

	return {
	  statusCode,
	  message: 'Zod Validation Error',
	  errorSources,
	};
  }

  export default handleZodError