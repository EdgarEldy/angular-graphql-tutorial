import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'schema/schema.graphqls',
  documents: ['src/**/*.graphql'],
  generates: {
    // Schema types only (enums, scalars, input types, output types).
    // Kept separate so typescript-operations can reference these types via
    // importSchemaTypesFrom instead of re-emitting them, which would cause
    // TS2300 duplicate identifier errors in a combined single-file output.
    'src/app/core/graphql/generated/graphql.ts': {
      plugins: ['typescript'],
      config: {
        scalars: { ID: 'string' },
        nonOptionalTypename: false,
      },
    },
    // Operation types and typed document nodes.
    // importSchemaTypesFrom tells typescript-operations to skip schema type
    // generation and emit import statements pointing to graphql.ts instead.
    'src/app/core/graphql/generated/graphql-operations.ts': {
      plugins: ['typescript-operations', 'typed-document-node'],
      config: {
        scalars: { ID: 'string' },
        nonOptionalTypename: false,
        dedupeFragments: true,
        // Path is relative to codegen.ts (project root); the plugin computes
        // the correct relative path from the output file to this target.
        importSchemaTypesFrom: './src/app/core/graphql/generated/graphql',
      },
    },
    // Barrel re-exporting both files so feature services need only one import path.
    'src/app/core/graphql/generated/index.ts': {
      plugins: [
        {
          add: {
            content:
              "export * from './graphql';\nexport * from './graphql-operations';\n",
          },
        },
      ],
    },
  },
  hooks: {
    afterAllFileWrite: ['prettier --write'],
  },
};

export default config;
