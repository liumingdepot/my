import { defineEventHandler } from 'nitro/h3'
import { getAppEnv } from '../../utils/env'
import { dispatchApi } from '../../utils/dispatch'

export default defineEventHandler(async (event) => {
  const env = getAppEnv()
  return dispatchApi(event.req, env)
})
