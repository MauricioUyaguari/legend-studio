/**
 * Copyright (c) 2020-present, Goldman Sachs
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

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export const setup = (outputDir) => {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
  }

  writeFileSync(
    resolve(outputDir, 'version.json'),
    JSON.stringify(
      {
        buildTime: new Date().toISOString(),
        version: '0.0.0-local',
        commitSHA: 'local',
      },
      null,
      2,
    ),
  );

  writeFileSync(
    resolve(outputDir, 'config.json'),
    JSON.stringify(
      {
        appName: 'studio',
        env: 'local',
        sdlc: {
          url: 'http://localhost:7070/api',
        },
        engine: {
          url: 'http://localhost:6060/api',
        },
        depot: {
          url: 'http://localhost:9090/depot/api',
        },
        documentation: {
          url: 'https://legend.finos.org',
          registry: [
            /**
             * NOTE: the end-point must enable CORS and allow origin from everywhere (ideally)
             * Or, we would need to use a CORS proxy. Note that we usually need to deploy these
             * `cors-anywhere` has a nice live deployment which requires temporarily access
             *
             * See https://github.com/Rob--W/cors-anywhere
             * See https://cors-anywhere.herokuapp.com/
             * See https://gist.github.com/jimmywarting/ac1be6ea0297c16c477e17f8fbe51347
             */
            // { url: 'https://cors-anywhere.herokuapp.com/https://raw.githubusercontent.com/finos/legend/master/website/static/resource/studio/documentation.json' },
            /**
             * Use this end-point when developing documentation locally
             */
            // { url: 'http://localhost:60001/studio/documentation.json' },
            {
              url: 'https://legend.finos.org/resource/studio/documentation.json',
              simple: true,
            },
          ],
        },
        extensions: {
          '@finos/legend-studio-plugin-external-language-morphir': {
            visualizer: { url: 'http://localhost:8092' },
            linterServer: { url: 'http://localhost:8091' },
            linterApp: { url: 'http://localhost:8090' },
          },
        },
      },
      undefined,
      2,
    ),
  );
};