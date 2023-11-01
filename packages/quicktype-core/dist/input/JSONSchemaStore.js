"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONSchemaStore = void 0;
const Support_1 = require("../support/Support");
class JSONSchemaStore {
    _schemas = new Map();
    add(address, schema) {
        (0, Support_1.assert)(!this._schemas.has(address), "Cannot set a schema for an address twice");
        this._schemas.set(address, schema);
    }
    async get(address, debugPrint) {
        let schema = this._schemas.get(address);
        if (schema !== undefined) {
            return schema;
        }
        if (debugPrint) {
            console.log(`trying to fetch ${address}`);
        }
        try {
            schema = await this.fetch(address);
        }
        catch { }
        if (schema === undefined) {
            if (debugPrint) {
                console.log(`couldn't fetch ${address}`);
            }
            return undefined;
        }
        if (debugPrint) {
            console.log(`successully fetched ${address}`);
        }
        this.add(address, schema);
        return schema;
    }
}
exports.JSONSchemaStore = JSONSchemaStore;
