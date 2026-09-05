import { StatusCodes } from "http-status-codes";

const errorHandlerMiddleware = (err, req, res, next) => {
    const statusCodes = err.statusCodes || StatusCodes.INTERNAL_SERVER_ERROR;
    const msg = err.message || "something went wrong, try again later";
    res.status(statusCodes).json({ msg });
};

export default errorHandlerMiddleware;
