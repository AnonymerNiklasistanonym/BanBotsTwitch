
// Package imports
import Ajv from 'ajv';

export const validateJsonSchemaObject = <T>(name: string, jsonSchema: any, jsonObject: any): jsonObject is T => {
    const ajv = new Ajv();
    const validate = ajv.compile(jsonSchema);

    if (validate(jsonObject)) {
        return true;
    }
    throw Error(
        `Validation of ${name} had error: ${JSON.stringify(
        validate.errors
        )}`
    );
}
