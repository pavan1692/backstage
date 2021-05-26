/*
 * Copyright 2021 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import createConnection, { Knex } from 'knex';
import { GenericContainer } from 'testcontainers';
import { v4 as uuid } from 'uuid';

async function waitForMysqlReady(
  connection: Knex.MySqlConnectionConfig,
): Promise<void> {
  const startTime = Date.now();
  const db = createConnection({ client: 'mysql2', connection });

  try {
    for (;;) {
      try {
        const result = await db.select(db.raw('version() AS version'));
        if (result[0]?.version) {
          return;
        }
      } catch (e) {
        if (Date.now() - startTime > 30_000) {
          throw new Error(
            `Timed out waiting for the database to be ready for connections, ${e}`,
          );
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } finally {
    db.destroy();
  }
}

export async function startMysqlContainer(image: string) {
  const user = 'root';
  const password = uuid();

  const container = await new GenericContainer(image)
    .withExposedPorts(3306)
    .withEnv('MYSQL_ROOT_PASSWORD', password)
    .withTmpFs({ '/var/lib/mysql': 'rw' })
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(3306);
  const stop = async () => {
    await container.stop({ timeout: 10_000 });
  };

  await waitForMysqlReady({ host, port, user, password });

  return { host, port, user, password, stop };
}
