import { SetMetadata } from "@nestjs/common";
import { AdminRole } from "@polyforge/shared-types";
import { ROLES_KEY } from "../guard/roles.guard";

/** Restrict access to admins with one of the specified roles. */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
