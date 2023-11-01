"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputData = exports.jsonInputForTargetLanguage = exports.JSONInput = void 0;
const collection_utils_1 = require("collection-utils");
const CompressedJSON_1 = require("./CompressedJSON");
const Support_1 = require("../support/Support");
const Messages_1 = require("../Messages");
const TypeNames_1 = require("../attributes/TypeNames");
const Description_1 = require("../attributes/Description");
const Inference_1 = require("./Inference");
const All_1 = require("../language/All");
function messageParseError(name, description, e) {
    return (0, Messages_1.messageError)("MiscJSONParseError", {
        description: (0, collection_utils_1.withDefault)(description, "input"),
        address: name,
        message: (0, Support_1.errorMessage)(e)
    });
}
class JSONInput {
    _compressedJSON;
    kind = "json";
    needIR = true;
    needSchemaProcessing = false;
    _topLevels = new Map();
    /* tslint:disable:no-unused-variable */
    constructor(_compressedJSON) {
        this._compressedJSON = _compressedJSON;
    }
    addSample(topLevelName, sample) {
        let topLevel = this._topLevels.get(topLevelName);
        if (topLevel === undefined) {
            topLevel = { samples: [], description: undefined };
            this._topLevels.set(topLevelName, topLevel);
        }
        topLevel.samples.push(sample);
    }
    setDescription(topLevelName, description) {
        let topLevel = this._topLevels.get(topLevelName);
        if (topLevel === undefined) {
            return (0, Support_1.panic)("Trying to set description for a top-level that doesn't exist");
        }
        topLevel.description = description;
    }
    addSamples(name, values, description) {
        for (const value of values) {
            this.addSample(name, value);
            if (description !== undefined) {
                this.setDescription(name, description);
            }
        }
    }
    async addSource(source) {
        const { name, samples, description } = source;
        try {
            const values = await (0, collection_utils_1.arrayMapSync)(samples, async (s) => await this._compressedJSON.parse(s));
            this.addSamples(name, values, description);
        }
        catch (e) {
            return messageParseError(name, description, e);
        }
    }
    addSourceSync(source) {
        const { name, samples, description } = source;
        try {
            const values = samples.map(s => this._compressedJSON.parseSync(s));
            this.addSamples(name, values, description);
        }
        catch (e) {
            return messageParseError(name, description, e);
        }
    }
    singleStringSchemaSource() {
        return undefined;
    }
    async addTypes(ctx, typeBuilder, inferMaps, inferEnums, fixedTopLevels) {
        return this.addTypesSync(ctx, typeBuilder, inferMaps, inferEnums, fixedTopLevels);
    }
    addTypesSync(_ctx, typeBuilder, inferMaps, inferEnums, fixedTopLevels) {
        const inference = new Inference_1.TypeInference(this._compressedJSON, typeBuilder, inferMaps, inferEnums);
        for (const [name, { samples, description }] of this._topLevels) {
            const tref = inference.inferTopLevelType((0, TypeNames_1.makeNamesTypeAttributes)(name, false), samples, fixedTopLevels);
            typeBuilder.addTopLevel(name, tref);
            if (description !== undefined) {
                const attributes = Description_1.descriptionTypeAttributeKind.makeAttributes(new Set([description]));
                typeBuilder.addAttributes(tref, attributes);
            }
        }
    }
}
exports.JSONInput = JSONInput;
function jsonInputForTargetLanguage(targetLanguage, languages, handleJSONRefs = false) {
    if (typeof targetLanguage === "string") {
        targetLanguage = (0, Support_1.defined)((0, All_1.languageNamed)(targetLanguage, languages));
    }
    const compressedJSON = new CompressedJSON_1.CompressedJSONFromString(targetLanguage.dateTimeRecognizer, handleJSONRefs);
    return new JSONInput(compressedJSON);
}
exports.jsonInputForTargetLanguage = jsonInputForTargetLanguage;
class InputData {
    // FIXME: Make into a Map, indexed by kind.
    _inputs = new Set();
    addInput(input) {
        this._inputs = this._inputs.add(input);
    }
    getOrAddInput(kind, makeInput) {
        let input = (0, collection_utils_1.iterableFind)(this._inputs, i => i.kind === kind);
        if (input === undefined) {
            input = makeInput();
            this.addInput(input);
        }
        return input;
    }
    async addSource(kind, source, makeInput) {
        const input = this.getOrAddInput(kind, makeInput);
        await input.addSource(source);
    }
    addSourceSync(kind, source, makeInput) {
        const input = this.getOrAddInput(kind, makeInput);
        input.addSourceSync(source);
    }
    async addTypes(ctx, typeBuilder, inferMaps, inferEnums, fixedTopLevels) {
        for (const input of this._inputs) {
            await input.addTypes(ctx, typeBuilder, inferMaps, inferEnums, fixedTopLevels);
        }
    }
    addTypesSync(ctx, typeBuilder, inferMaps, inferEnums, fixedTopLevels) {
        for (const input of this._inputs) {
            input.addTypesSync(ctx, typeBuilder, inferMaps, inferEnums, fixedTopLevels);
        }
    }
    get needIR() {
        return (0, collection_utils_1.iterableSome)(this._inputs, i => i.needIR);
    }
    get needSchemaProcessing() {
        return (0, collection_utils_1.iterableSome)(this._inputs, i => i.needSchemaProcessing);
    }
    singleStringSchemaSource() {
        const schemaStrings = (0, collection_utils_1.setFilterMap)(this._inputs, i => i.singleStringSchemaSource());
        if (schemaStrings.size > 1) {
            return (0, Support_1.panic)("We have more than one input with a string schema source");
        }
        return (0, collection_utils_1.iterableFirst)(schemaStrings);
    }
}
exports.InputData = InputData;
