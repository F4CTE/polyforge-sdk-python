import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
    schema: './schema.admin.prisma',
    migrations: {
        path: './migrations-admin',
    },
    datasource: {
        url: env('ADMIN_DIRECT_DATABASE_URL'),
    },
});