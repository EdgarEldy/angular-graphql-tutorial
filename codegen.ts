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
        strictScalars: true,
        scalars: {
          ID: 'string',
        },
        avoidOptionals: true,
        nonOptionalTypename: false,
        dedupeFragments: true,
      },
    },
  },
  hooks: {
    afterAllFileWrite: ['prettier --write'],
  },
};

export default config;
