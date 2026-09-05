import { StatusCodes } from "http-status-codes";
export class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotFoundError";
        this.statusCodes = StatusCodes.NOT_FOUND;
    }
}

export class BadRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = "BadRequestError";
        this.statusCodes = StatusCodes.BAD_REQUEST;
    }
}

export class UnathenticatedError extends Error {
    constructor(message) {
        super(message);
        this.name = "UnathenticatedError";
        this.statusCodes = StatusCodes.UNAUTHORIZED;
    }
}

export class UnauthorizedError extends Error {
    constructor(message) {
        super(message);
        this.name = "UnauthorizedError";
        this.statusCodes = StatusCodes.FORBIDDEN;
    }
}
