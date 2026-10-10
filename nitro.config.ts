import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'
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
  hooks: {
    /** 打包后把签名运行时放到 .output/hongguo-work，与 public、server 同级 */
    compiled(nitro) {
      const src = join(nitro.options.rootDir, 'hongguo-work')
      const dst = join(nitro.options.output.dir, 'hongguo-work')
      if (!existsSync(join(src, 'sign', 'unidbg-sign.jar'))) {
        nitro.logger.warn('hongguo-work/sign/unidbg-sign.jar 缺失，跳过复制签名运行时')
        return
      }
      cpSync(src, dst, { recursive: true })
      nitro.logger.success('Copied hongguo-work → .output/hongguo-work')
    },
  },
})
