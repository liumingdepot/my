import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './server',
  routeRules: {
    '/api/**': { cors: true },
  },
  runtimeConfig: {
    mysqlHost: process.env.MYSQL_HOST || '192.168.0.233',
    mysqlPort: Number(process.env.MYSQL_PORT || 3306),
    mysqlUser: process.env.MYSQL_USER || 'root',
    mysqlPassword: process.env.MYSQL_PASSWORD || '123456',
    mysqlDatabase: process.env.MYSQL_DATABASE || 'liuming',
    agnesApiKey: process.env.AGNES_API_KEY || '',
  },
})
