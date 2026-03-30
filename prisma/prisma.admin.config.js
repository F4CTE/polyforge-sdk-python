"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const config_1 = require("prisma/config");
exports.default = (0, config_1.defineConfig)({
    schema: './schema.admin.prisma',
    migrations: {
        path: './migrations-admin',
    },
    datasource: {
        url: (0, config_1.env)('ADMIN_DIRECT_DATABASE_URL'),
    },
});
//# sourceMappingURL=prisma.admin.config.js.map