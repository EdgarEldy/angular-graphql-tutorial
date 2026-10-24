import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'schema/schema.graphqls',
  documents: ['src/**/*.graphql'],
  generates: {
    'src/app/core/graphql/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typed-document-node',
      ],
      config: {
        scalars: {
          ID: 'string',
        },
        nonOptionalTypename: false,
        dedupeFragments: true,
      },
    },
  },
  // Suppresses the warning when no .graphql document files exist yet.
  // Feature branches add operation files; this branch only scaffolds the config.
  ignoreNoDocuments: true,
  hooks: {
    afterAllFileWrite: ['prettier --write'],
  },
};

export default config;
