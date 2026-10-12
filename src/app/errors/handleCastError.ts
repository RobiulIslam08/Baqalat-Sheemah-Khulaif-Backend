import mongoose from 'mongoose';
import { TErrorSourses } from '../interface/error';

const handleCastError = (err: mongoose.Error.CastError) => {
  const errorSources: TErrorSourses = [
    {
      path: err.path,
      message: err.message,
    },
  ];
  const statusCode = 400;
  return {
    statusCode,
    message: 'Invalid Id',
    errorSources,
  };
};
export default handleCastError;
