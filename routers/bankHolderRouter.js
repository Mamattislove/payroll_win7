import { Router } from "express";
import {
    getAllBankHolders,
    getBankHolder,
    createBankHolder,
    updateBankHolder,
    deleteBankHolder,
} from "../controllers/bankHolderController.js";
import {
    validateBankHolderInput,
    validateBankHolderUpdateInput,
    validateBankHolderParamId,
} from "../middlewares/modelMiddlewares/bankHolderValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router
    .route("/")
    .get(getAllBankHolders)
    .post(
        authorizePermission(USER_ROLES.HR),
        validateBankHolderInput,
        createBankHolder,
    );

router
    .route("/:bankHolderId")
    .all(validateBankHolderParamId)
    .get(getBankHolder)
    .patch(
        authorizePermission(USER_ROLES.HR),
        validateBankHolderUpdateInput,
        updateBankHolder,
    )
    .delete(authorizePermission(USER_ROLES.HR), deleteBankHolder);

export default router;
