"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const config_1 = require("prisma/config");
exports.default = (0, config_1.defineConfig)({
    schema: './schema.prisma',
    migrations: {
        path: './migrations',
    },
    datasource: {
        url: (0, config_1.env)('DIRECT_DATABASE_URL'),
    },
});
//# sourceMappingURL=prisma.config.js.map