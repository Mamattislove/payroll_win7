import { Router } from "express";
import {
    getAllBanks,
    getBank,
    createBank,
    updateBank,
    deleteBank,
} from "../controllers/bankController.js";
import {
    validateBankInput,
    validateBankUpdateInput,
    validateBankParamId,
} from "../middlewares/modelMiddlewares/bankValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router
    .route("/")
    .get(getAllBanks)
    .post(
        authorizePermission(USER_ROLES.HR),
        validateBankInput,
        createBank,
    );

router
    .route("/:bankId")
    .all(validateBankParamId)
    .get(getBank)
    .patch(
        authorizePermission(USER_ROLES.HR),
        validateBankUpdateInput,
        updateBank,
    )
    .delete(authorizePermission(USER_ROLES.HR), deleteBank);

export default router;
