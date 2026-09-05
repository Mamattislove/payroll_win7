import { Router } from "express";
import { getAllClients, getClient, createClient, updateClient, deleteClient } from "../controllers/clientController.js";
import { validateClientInput, validateClientUpdateInput, validateClientParamId } from "../middlewares/modelMiddlewares/clientValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getAllClients).post(authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR), validateClientInput, createClient);
router.route("/:clientId").all(validateClientParamId).get(getClient).patch(authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR), validateClientUpdateInput, updateClient).delete(authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR), deleteClient);
export default router;
