import { TErrorSourses } from "../interface/error";

const handleDuplicateError = (err:any) => {
	const statusCode = 400;
	const match = err.message.match(/"([^"]*)"/);

	// The extracted value will be in the first capturing group
	const extractedMessage = match && match[1];
	const errorSources:TErrorSourses = [
		{
			path:'',
			message:`${extractedMessage} is already exists`
		}
	]

	return {
	  statusCode,
	  message: 'Invalid Id',
	  errorSources,
	};
}
export default handleDuplicateError