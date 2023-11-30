import * as ts from "typescript";
import { PartialArgs, generateSchema } from "@mark.probst/typescript-json-schema";

import { defined, JSONSchemaSourceData, messageError } from "@quicktype/core";
import * as path from 'path';

const settings: PartialArgs = {
    required: true,
    titles: true,
    topRef: true,
    noExtraProps: true
};

const compilerOptions: ts.CompilerOptions = {
    "module": ts.ModuleKind.CommonJS,
    "declaration": true,
    "allowImportingTsExtensions": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": ts.ScriptTarget.ES2020,
    "sourceMap": true,
    "outDir": "./dist",
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "esModuleInterop": true,
    "strict": true,
    "lib": ["lib.es2020.d.ts", "lib.es2020.bigint.d.ts"],
    "typeRoots": ["node_modules/@types"]
};

function getTsConfig() {

    const currentDirectory = process.cwd();

    const tsConfigPath = ts.findConfigFile(
        currentDirectory,
        ts.sys.fileExists,
        'tsconfig.json'
    );

    if (tsConfigPath) {
        console.log(`Found tsconfig.json at: ${tsConfigPath}`);

        // Read the tsconfig.json file
        const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);

        if (configFile.error) {
            console.error("Error reading tsconfig.json:", ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
            return;
        }

        // Parse the configuration
        const basePath = path.dirname(tsConfigPath); // Directory of tsconfig.json
        const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, basePath);

        if (config.errors && config.errors.length > 0) {
            console.error("Error parsing tsconfig.json:");
            config.errors.forEach(error => {
                console.error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
            });
            return;
        } else {
            return config;
        }

        console.log("Parsed tsconfig.json:", config);

    } else {
        console.log('No tsconfig.json found in the directory tree.');
    }
}

// FIXME: We're stringifying and then parsing this schema again.  Just pass around
// the schema directly.
export function schemaForTypeScriptSources(sourceFileNames: string[]): JSONSchemaSourceData {
    const config = getTsConfig()
    if (!config) {
        throw new Error('ts config file not found');
    }
    const program = ts.createProgram(sourceFileNames, config.options || compilerOptions);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const error = diagnostics.find(d => d.category === ts.DiagnosticCategory.Error);
    if (error !== undefined) {
        return messageError("TypeScriptCompilerError", {
            message: ts.flattenDiagnosticMessageText(error.messageText, "\n")
        });
    }

    const schema = generateSchema(program, "*", settings);
    const uris: string[] = [];
    let topLevelName: string | undefined = undefined;
    if (schema !== null && typeof schema === "object" && typeof schema.definitions === "object") {
        for (const name of Object.getOwnPropertyNames(schema.definitions)) {
            const definition = schema.definitions[name];
            if (
                definition === null ||
                Array.isArray(definition) ||
                typeof definition !== "object" ||
                typeof definition.description !== "string"
            ) {
                continue;
            }

            const description = definition.description as string;
            const matches = description.match(/#TopLevel/);
            if (matches === null) {
                continue;
            }

            const index = defined(matches.index);
            definition.description = description.slice(0, index) + description.slice(index + matches[0].length);

            uris.push(`#/definitions/${name}`);

            if (topLevelName === undefined) {
                if (typeof definition.title === "string") {
                    topLevelName = definition.title;
                } else {
                    topLevelName = name;
                }
            } else {
                topLevelName = "";
            }
        }
    }
    if (uris.length === 0) {
        uris.push("#/definitions/");
    }
    if (topLevelName === undefined) {
        topLevelName = "";
    }
    return { schema: JSON.stringify(schema), name: topLevelName, uris, isConverted: true };
}
