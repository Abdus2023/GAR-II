import { client } from './index'
import { runMigrations } from './migrations'
import { logger } from '../logger'

async function main() {
  const result = await runMigrations(client)
  logger.info(result, 'Database migrations complete')
  console.log(JSON.stringify(result, null, 2))
}

void main().catch((error: any) => {
  logger.error({ error: error.message }, 'Database migration failed')
  console.error(error.message)
  process.exitCode = 1
})
