// Package imports
import fs from 'fs/promises';
import path from 'path';
import { createGenerator } from 'ts-json-schema-generator';
// Type imports
import type { Config } from 'ts-json-schema-generator';

const tsconfigFilePath = path.join(__dirname, 'tsconfig.json');
const jsonSchemaFilePathArguments = path.join(__dirname, 'src', 'arguments.schema.json');
const jsonSchemaFilePathCredentials = path.join(__dirname, 'src', 'credentials.schema.json');
const jsonSchemaFilePathArgumentsDist = path.join(__dirname, 'dist', 'arguments.schema.json');
const jsonSchemaFilePathCredentialsDist = path.join(__dirname, 'dist', 'credentials.schema.json');
const simulationConfigFilePath = path.join(
  __dirname,
  'src',
  'main.ts'
);

const createJsonSchema = async (typeName: string, outFilePath: string) => {
  const config: Config = {
    path: simulationConfigFilePath,
    tsconfig: tsconfigFilePath,
    type: typeName,
  };
  const schema = createGenerator(config).createSchema(config.type);
  await fs.writeFile(outFilePath, JSON.stringify(schema, null, 4));
};

async function main() {
  // Create JSON schema
  for (const [typeName, outFilePath, outFilePathDist] of [
    ['Arguments', jsonSchemaFilePathArguments, jsonSchemaFilePathArgumentsDist],
    ['Credentials', jsonSchemaFilePathCredentials, jsonSchemaFilePathCredentialsDist],
  ]) {
    await createJsonSchema(typeName, outFilePath);
    await fs.cp(outFilePath, outFilePathDist);
  }
}

main().catch(err => console.error(err));
