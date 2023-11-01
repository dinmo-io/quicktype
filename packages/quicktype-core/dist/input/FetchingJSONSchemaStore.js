"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchingJSONSchemaStore = void 0;
const JSONSchemaStore_1 = require("./JSONSchemaStore");
const __1 = require("..");
const NodeIO_1 = require("./io/NodeIO");
class FetchingJSONSchemaStore extends JSONSchemaStore_1.JSONSchemaStore {
    _httpHeaders;
    constructor(_httpHeaders) {
        super();
        this._httpHeaders = _httpHeaders;
    }
    async fetch(address) {
        // console.log(`Fetching ${address}`);
        return (0, __1.parseJSON)(await (0, NodeIO_1.readFromFileOrURL)(address, this._httpHeaders), "JSON Schema", address);
    }
}
exports.FetchingJSONSchemaStore = FetchingJSONSchemaStore;
