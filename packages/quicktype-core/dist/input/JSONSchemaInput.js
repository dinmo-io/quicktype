"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONSchemaInput = exports.schemaTypeDict = exports.Ref = exports.PathElementKind = void 0;
const urijs_1 = __importDefault(require("urijs"));
const collection_utils_1 = require("collection-utils");
const Type_1 = require("../Type");
const Support_1 = require("../support/Support");
const TypeNames_1 = require("../attributes/TypeNames");
const TypeNames_2 = require("../attributes/TypeNames");
const TypeAttributes_1 = require("../attributes/TypeAttributes");
const JSONSchemaStore_1 = require("./JSONSchemaStore");
const Messages_1 = require("../Messages");
const StringTypes_1 = require("../attributes/StringTypes");
// There's a cyclic import here. Ignoring now because it requires a large refactor.
// skipcq: JS-E1008
const Description_1 = require("../attributes/Description");
const AccessorNames_1 = require("../attributes/AccessorNames");
const EnumValues_1 = require("../attributes/EnumValues");
const Constraints_1 = require("../attributes/Constraints");
const Constraints_2 = require("../attributes/Constraints");
const Constraints_3 = require("../attributes/Constraints");
const URIAttributes_1 = require("../attributes/URIAttributes");
var PathElementKind;
(function (PathElementKind) {
    PathElementKind[PathElementKind["Root"] = 0] = "Root";
    PathElementKind[PathElementKind["KeyOrIndex"] = 1] = "KeyOrIndex";
    PathElementKind[PathElementKind["Type"] = 2] = "Type";
    PathElementKind[PathElementKind["Object"] = 3] = "Object";
})(PathElementKind || (exports.PathElementKind = PathElementKind = {}));
function keyOrIndex(pe) {
    if (pe.kind !== PathElementKind.KeyOrIndex)
        return undefined;
    return pe.key;
}
function pathElementEquals(a, b) {
    if (a.kind !== b.kind)
        return false;
    switch (a.kind) {
        case PathElementKind.Type:
            return a.index === b.index;
        case PathElementKind.KeyOrIndex:
            return a.key === b.key;
        default:
            return true;
    }
}
function withRef(refOrLoc, props) {
    const ref = typeof refOrLoc === "function" ? refOrLoc() : refOrLoc instanceof Ref ? refOrLoc : refOrLoc.canonicalRef;
    return Object.assign({ ref }, props === undefined ? {} : props);
}
function checkJSONSchemaObject(x, refOrLoc) {
    if (Array.isArray(x)) {
        return (0, Messages_1.messageError)("SchemaArrayIsInvalidSchema", withRef(refOrLoc));
    }
    if (x === null) {
        return (0, Messages_1.messageError)("SchemaNullIsInvalidSchema", withRef(refOrLoc));
    }
    if (typeof x !== "object") {
        return (0, Messages_1.messageError)("SchemaInvalidJSONSchemaType", withRef(refOrLoc, { type: typeof x }));
    }
    return x;
}
function checkJSONSchema(x, refOrLoc) {
    if (typeof x === "boolean")
        return x;
    return checkJSONSchemaObject(x, refOrLoc);
}
const numberRegexp = new RegExp("^[0-9]+$");
function normalizeURI(uri) {
    // FIXME: This is overly complicated and a bit shady.  The problem is
    // that `normalize` will URL-escape, with the result that if we want to
    // open the URL as a file, escaped character will thwart us.  I think the
    // JSONSchemaStore should take a URI, not a string, and if it reads from
    // a file it can decode by itself.
    if (typeof uri === "string") {
        uri = new urijs_1.default(uri);
    }
    return new urijs_1.default(urijs_1.default.decode(uri.clone().normalize().toString()));
}
class Ref {
    path;
    static root(address) {
        const uri = (0, collection_utils_1.definedMap)(address, a => new urijs_1.default(a));
        return new Ref(uri, []);
    }
    static parsePath(path) {
        const elements = [];
        if (path.startsWith("/")) {
            elements.push({ kind: PathElementKind.Root });
            path = path.slice(1);
        }
        if (path !== "") {
            const parts = path.split("/");
            for (let i = 0; i < parts.length; i++) {
                elements.push({ kind: PathElementKind.KeyOrIndex, key: parts[i] });
            }
        }
        return elements;
    }
    static parseURI(uri, destroyURI = false) {
        if (!destroyURI) {
            uri = uri.clone();
        }
        let path = uri.fragment();
        uri.fragment("");
        if ((uri.host() !== "" || uri.filename() !== "") && path === "") {
            path = "/";
        }
        const elements = Ref.parsePath(path);
        return new Ref(uri, elements);
    }
    static parse(ref) {
        return Ref.parseURI(new urijs_1.default(ref), true);
    }
    addressURI;
    constructor(addressURI, path) {
        this.path = path;
        if (addressURI !== undefined) {
            (0, Support_1.assert)(addressURI.fragment() === "", `Ref URI with fragment is not allowed: ${addressURI.toString()}`);
            this.addressURI = normalizeURI(addressURI);
        }
        else {
            this.addressURI = undefined;
        }
    }
    get hasAddress() {
        return this.addressURI !== undefined;
    }
    get address() {
        return (0, Support_1.defined)(this.addressURI).toString();
    }
    get isRoot() {
        return this.path.length === 1 && this.path[0].kind === PathElementKind.Root;
    }
    pushElement(pe) {
        const newPath = Array.from(this.path);
        newPath.push(pe);
        return new Ref(this.addressURI, newPath);
    }
    push(...keys) {
        let ref = this;
        for (const key of keys) {
            ref = ref.pushElement({ kind: PathElementKind.KeyOrIndex, key });
        }
        return ref;
    }
    pushObject() {
        return this.pushElement({ kind: PathElementKind.Object });
    }
    pushType(index) {
        return this.pushElement({ kind: PathElementKind.Type, index });
    }
    resolveAgainst(base) {
        let addressURI = this.addressURI;
        if (base !== undefined && base.addressURI !== undefined) {
            addressURI = addressURI === undefined ? base.addressURI : addressURI.absoluteTo(base.addressURI);
        }
        return new Ref(addressURI, this.path);
    }
    get name() {
        const path = Array.from(this.path);
        for (;;) {
            const e = path.pop();
            if (e === undefined || e.kind === PathElementKind.Root) {
                let name = this.addressURI !== undefined ? this.addressURI.filename() : "";
                const suffix = this.addressURI !== undefined ? this.addressURI.suffix() : "";
                if (name.length > suffix.length + 1) {
                    name = name.slice(0, name.length - suffix.length - 1);
                }
                if (name === "") {
                    return "Something";
                }
                return name;
            }
            switch (e.kind) {
                case PathElementKind.KeyOrIndex:
                    if (numberRegexp.test(e.key)) {
                        return e.key;
                    }
                    break;
                case PathElementKind.Type:
                case PathElementKind.Object:
                    return (0, Support_1.panic)("We shouldn't try to get the name of Type or Object refs");
                default:
                    return (0, Support_1.assertNever)(e);
            }
        }
    }
    get definitionName() {
        const pe = (0, collection_utils_1.arrayGetFromEnd)(this.path, 2);
        if (pe === undefined)
            return undefined;
        if (keyOrIndex(pe) === "definitions")
            return keyOrIndex((0, Support_1.defined)((0, collection_utils_1.arrayLast)(this.path)));
        return undefined;
    }
    toString() {
        function elementToString(e) {
            switch (e.kind) {
                case PathElementKind.Root:
                    return "";
                case PathElementKind.Type:
                    return `type/${e.index.toString()}`;
                case PathElementKind.Object:
                    return "object";
                case PathElementKind.KeyOrIndex:
                    return e.key;
                default:
                    return (0, Support_1.assertNever)(e);
            }
        }
        const address = this.addressURI === undefined ? "" : this.addressURI.toString();
        return address + "#" + this.path.map(elementToString).join("/");
    }
    lookup(local, path, root) {
        const refMaker = () => new Ref(this.addressURI, path);
        const first = path[0];
        if (first === undefined) {
            return checkJSONSchema(local, refMaker);
        }
        const rest = path.slice(1);
        switch (first.kind) {
            case PathElementKind.Root:
                return this.lookup(root, rest, root);
            case PathElementKind.KeyOrIndex:
                const key = first.key;
                if (Array.isArray(local)) {
                    if (!/^\d+$/.test(key)) {
                        return (0, Messages_1.messageError)("SchemaCannotIndexArrayWithNonNumber", withRef(refMaker, { actual: key }));
                    }
                    const index = parseInt(first.key, 10);
                    if (index >= local.length) {
                        return (0, Messages_1.messageError)("SchemaIndexNotInArray", withRef(refMaker, { index }));
                    }
                    return this.lookup(local[index], rest, root);
                }
                else {
                    if (!(0, collection_utils_1.hasOwnProperty)(local, key)) {
                        return (0, Messages_1.messageError)("SchemaKeyNotInObject", withRef(refMaker, { key }));
                    }
                    return this.lookup(checkJSONSchemaObject(local, refMaker)[first.key], rest, root);
                }
            case PathElementKind.Type:
                return (0, Support_1.panic)('Cannot look up path that indexes "type"');
            case PathElementKind.Object:
                return (0, Support_1.panic)('Cannot look up path that indexes "object"');
            default:
                return (0, Support_1.assertNever)(first);
        }
    }
    lookupRef(root) {
        return this.lookup(root, this.path, root);
    }
    equals(other) {
        if (!(other instanceof Ref))
            return false;
        if (this.addressURI !== undefined && other.addressURI !== undefined) {
            if (!this.addressURI.equals(other.addressURI))
                return false;
        }
        else {
            if ((this.addressURI === undefined) !== (other.addressURI === undefined))
                return false;
        }
        const l = this.path.length;
        if (l !== other.path.length)
            return false;
        for (let i = 0; i < l; i++) {
            if (!pathElementEquals(this.path[i], other.path[i]))
                return false;
        }
        return true;
    }
    hashCode() {
        let acc = (0, collection_utils_1.hashCodeOf)((0, collection_utils_1.definedMap)(this.addressURI, u => u.toString()));
        for (const pe of this.path) {
            acc = (0, collection_utils_1.addHashCode)(acc, pe.kind);
            switch (pe.kind) {
                case PathElementKind.Type:
                    acc = (0, collection_utils_1.addHashCode)(acc, pe.index);
                    break;
                case PathElementKind.KeyOrIndex:
                    acc = (0, collection_utils_1.addHashCode)(acc, (0, collection_utils_1.hashString)(pe.key));
                    break;
                default:
                    break;
            }
        }
        return acc;
    }
}
exports.Ref = Ref;
class Location {
    haveID;
    canonicalRef;
    virtualRef;
    constructor(canonicalRef, virtualRef, haveID = false) {
        this.haveID = haveID;
        this.canonicalRef = canonicalRef;
        this.virtualRef = virtualRef !== undefined ? virtualRef : canonicalRef;
    }
    updateWithID(id) {
        if (typeof id !== "string")
            return this;
        const parsed = Ref.parse(id);
        const virtual = this.haveID ? parsed.resolveAgainst(this.virtualRef) : parsed;
        if (!this.haveID) {
            (0, Messages_1.messageAssert)(virtual.hasAddress, "SchemaIDMustHaveAddress", withRef(this, { id }));
        }
        return new Location(this.canonicalRef, virtual, true);
    }
    push(...keys) {
        return new Location(this.canonicalRef.push(...keys), this.virtualRef.push(...keys), this.haveID);
    }
    pushObject() {
        return new Location(this.canonicalRef.pushObject(), this.virtualRef.pushObject(), this.haveID);
    }
    pushType(index) {
        return new Location(this.canonicalRef.pushType(index), this.virtualRef.pushType(index), this.haveID);
    }
    toString() {
        return `${this.virtualRef.toString()} (${this.canonicalRef.toString()})`;
    }
}
class Canonizer {
    _ctx;
    _map = new collection_utils_1.EqualityMap();
    _schemaAddressesAdded = new Set();
    constructor(_ctx) {
        this._ctx = _ctx;
    }
    addIDs(schema, loc) {
        if (schema === null)
            return;
        if (Array.isArray(schema)) {
            for (let i = 0; i < schema.length; i++) {
                this.addIDs(schema[i], loc.push(i.toString()));
            }
            return;
        }
        if (typeof schema !== "object") {
            return;
        }
        const locWithoutID = loc;
        const maybeID = schema["$id"];
        if (typeof maybeID === "string") {
            loc = loc.updateWithID(maybeID);
        }
        if (loc.haveID) {
            if (this._ctx.debugPrintSchemaResolving) {
                console.log(`adding mapping ${loc.toString()}`);
            }
            this._map.set(loc.virtualRef, locWithoutID);
        }
        for (const property of Object.getOwnPropertyNames(schema)) {
            this.addIDs(schema[property], loc.push(property));
        }
    }
    addSchema(schema, address) {
        if (this._schemaAddressesAdded.has(address))
            return false;
        this.addIDs(schema, new Location(Ref.root(address), Ref.root(undefined)));
        this._schemaAddressesAdded.add(address);
        return true;
    }
    // Returns: Canonical ref
    canonize(base, ref) {
        const virtual = ref.resolveAgainst(base.virtualRef);
        const loc = this._map.get(virtual);
        if (loc !== undefined) {
            return loc;
        }
        const canonicalRef = virtual.addressURI === undefined ? new Ref(base.canonicalRef.addressURI, virtual.path) : virtual;
        return new Location(canonicalRef, new Ref(undefined, virtual.path));
    }
}
function checkTypeList(typeOrTypes, loc) {
    let set;
    if (typeof typeOrTypes === "string") {
        set = new Set([typeOrTypes]);
    }
    else if (Array.isArray(typeOrTypes)) {
        const arr = [];
        for (const t of typeOrTypes) {
            if (typeof t !== "string") {
                return (0, Messages_1.messageError)("SchemaTypeElementMustBeString", withRef(loc, { element: t }));
            }
            arr.push(t);
        }
        set = new Set(arr);
    }
    else {
        return (0, Messages_1.messageError)("SchemaTypeMustBeStringOrStringArray", withRef(loc, { actual: typeOrTypes }));
    }
    (0, Messages_1.messageAssert)(set.size > 0, "SchemaNoTypeSpecified", withRef(loc));
    const validTypes = ["null", "boolean", "object", "array", "number", "string", "integer"];
    const maybeInvalid = (0, collection_utils_1.iterableFind)(set, s => validTypes.indexOf(s) < 0);
    if (maybeInvalid !== undefined) {
        return (0, Messages_1.messageError)("SchemaInvalidType", withRef(loc, { type: maybeInvalid }));
    }
    return set;
}
function checkRequiredArray(arr, loc) {
    if (!Array.isArray(arr)) {
        return (0, Messages_1.messageError)("SchemaRequiredMustBeStringOrStringArray", withRef(loc, { actual: arr }));
    }
    for (const e of arr) {
        if (typeof e !== "string") {
            return (0, Messages_1.messageError)("SchemaRequiredElementMustBeString", withRef(loc, { element: e }));
        }
    }
    return arr;
}
exports.schemaTypeDict = {
    null: true,
    boolean: true,
    string: true,
    integer: true,
    number: true,
    array: true,
    object: true
};
const schemaTypes = Object.getOwnPropertyNames(exports.schemaTypeDict);
function typeKindForJSONSchemaFormat(format) {
    const target = (0, collection_utils_1.iterableFind)(Type_1.transformedStringTypeTargetTypeKindsMap, ([_, { jsonSchema }]) => jsonSchema === format);
    if (target === undefined)
        return undefined;
    return target[0];
}
function schemaFetchError(base, address) {
    if (base === undefined) {
        return (0, Messages_1.messageError)("SchemaFetchErrorTopLevel", { address });
    }
    else {
        return (0, Messages_1.messageError)("SchemaFetchError", { address, base: base.canonicalRef });
    }
}
class Resolver {
    _ctx;
    _store;
    _canonizer;
    constructor(_ctx, _store, _canonizer) {
        this._ctx = _ctx;
        this._store = _store;
        this._canonizer = _canonizer;
    }
    async tryResolveVirtualRef(fetchBase, lookupBase, virtualRef) {
        let didAdd = false;
        // If we are resolving into a schema file that we haven't seen yet then
        // we don't know its $id mapping yet, which means we don't know where we
        // will end up.  What we do if we encounter a new schema is add all its
        // IDs first, and then try to canonize again.
        for (;;) {
            const loc = this._canonizer.canonize(fetchBase, virtualRef);
            const canonical = loc.canonicalRef;
            (0, Support_1.assert)(canonical.hasAddress, "Canonical ref can't be resolved without an address");
            const address = canonical.address;
            let schema = canonical.addressURI === undefined
                ? undefined
                : await this._store.get(address, this._ctx.debugPrintSchemaResolving);
            if (schema === undefined) {
                return [undefined, loc];
            }
            if (this._canonizer.addSchema(schema, address)) {
                (0, Support_1.assert)(!didAdd, "We can't add a schema twice");
                didAdd = true;
            }
            else {
                let lookupLoc = this._canonizer.canonize(lookupBase, virtualRef);
                if (fetchBase !== undefined) {
                    lookupLoc = new Location(new Ref(loc.canonicalRef.addressURI, lookupLoc.canonicalRef.path), lookupLoc.virtualRef, lookupLoc.haveID);
                }
                return [lookupLoc.canonicalRef.lookupRef(schema), lookupLoc];
            }
        }
    }
    async resolveVirtualRef(base, virtualRef) {
        if (this._ctx.debugPrintSchemaResolving) {
            console.log(`resolving ${virtualRef.toString()} relative to ${base.toString()}`);
        }
        // Try with the virtual base first.  If that doesn't work, use the
        // canonical ref's address with the virtual base's path.
        let result = await this.tryResolveVirtualRef(base, base, virtualRef);
        let schema = result[0];
        if (schema !== undefined) {
            if (this._ctx.debugPrintSchemaResolving) {
                console.log(`resolved to ${result[1].toString()}`);
            }
            return [schema, result[1]];
        }
        const altBase = new Location(base.canonicalRef, new Ref(base.canonicalRef.addressURI, base.virtualRef.path), base.haveID);
        result = await this.tryResolveVirtualRef(altBase, base, virtualRef);
        schema = result[0];
        if (schema !== undefined) {
            if (this._ctx.debugPrintSchemaResolving) {
                console.log(`resolved to ${result[1].toString()}`);
            }
            return [schema, result[1]];
        }
        return schemaFetchError(base, virtualRef.address);
    }
    async resolveTopLevelRef(ref) {
        return await this.resolveVirtualRef(new Location(new Ref(ref.addressURI, [])), new Ref(undefined, ref.path));
    }
}
async function addTypesInSchema(resolver, typeBuilder, references, attributeProducers) {
    let typeForCanonicalRef = new collection_utils_1.EqualityMap();
    function setTypeForLocation(loc, t) {
        const maybeRef = typeForCanonicalRef.get(loc.canonicalRef);
        if (maybeRef !== undefined) {
            (0, Support_1.assert)(maybeRef === t, "Trying to set path again to different type");
        }
        typeForCanonicalRef.set(loc.canonicalRef, t);
    }
    async function makeObject(loc, attributes, properties, requiredArray, additionalProperties, sortKey = (k) => k.toLowerCase()) {
        const required = new Set(requiredArray);
        const propertiesMap = (0, collection_utils_1.mapSortBy)((0, collection_utils_1.mapFromObject)(properties), (_, k) => sortKey(k));
        const props = await (0, collection_utils_1.mapMapSync)(propertiesMap, async (propSchema, propName) => {
            const propLoc = loc.push("properties", propName);
            const t = await toType(checkJSONSchema(propSchema, propLoc.canonicalRef), propLoc, (0, TypeNames_2.makeNamesTypeAttributes)(propName, true));
            const isOptional = !required.has(propName);
            return typeBuilder.makeClassProperty(t, isOptional);
        });
        let additionalPropertiesType;
        if (additionalProperties === undefined || additionalProperties === true) {
            additionalPropertiesType = typeBuilder.getPrimitiveType("any");
        }
        else if (additionalProperties === false) {
            additionalPropertiesType = undefined;
        }
        else {
            const additionalLoc = loc.push("additionalProperties");
            additionalPropertiesType = await toType(checkJSONSchema(additionalProperties, additionalLoc.canonicalRef), additionalLoc, (0, TypeNames_2.singularizeTypeNames)(attributes));
        }
        const additionalRequired = (0, collection_utils_1.setSubtract)(required, props.keys());
        if (additionalRequired.size > 0) {
            const t = additionalPropertiesType;
            if (t === undefined) {
                return (0, Messages_1.messageError)("SchemaAdditionalTypesForbidRequired", withRef(loc));
            }
            const additionalProps = (0, collection_utils_1.mapFromIterable)(additionalRequired, _name => typeBuilder.makeClassProperty(t, false));
            (0, collection_utils_1.mapMergeInto)(props, additionalProps);
        }
        return typeBuilder.getUniqueObjectType(attributes, props, additionalPropertiesType);
    }
    async function convertToType(schema, loc, typeAttributes) {
        const enumArray = Array.isArray(schema.enum) ? schema.enum : undefined;
        const isConst = schema.const !== undefined;
        const typeSet = (0, collection_utils_1.definedMap)(schema.type, t => checkTypeList(t, loc));
        function isTypeIncluded(name) {
            if (typeSet !== undefined && !typeSet.has(name)) {
                return false;
            }
            if (enumArray !== undefined) {
                let predicate;
                switch (name) {
                    case "null":
                        predicate = (x) => x === null;
                        break;
                    case "integer":
                        predicate = (x) => typeof x === "number" && x === Math.floor(x);
                        break;
                    default:
                        predicate = (x) => typeof x === name;
                        break;
                }
                return enumArray.find(predicate) !== undefined;
            }
            if (isConst) {
                return name === (schema.type ?? typeof schema.const);
            }
            return true;
        }
        const includedTypes = (0, collection_utils_1.setFilter)(schemaTypes, isTypeIncluded);
        let producedAttributesForNoCases = undefined;
        function forEachProducedAttribute(cases, f) {
            let attributes;
            if (cases === undefined && producedAttributesForNoCases !== undefined) {
                attributes = producedAttributesForNoCases;
            }
            else {
                attributes = [];
                for (const producer of attributeProducers) {
                    const newAttributes = producer(schema, loc.canonicalRef, includedTypes, cases);
                    if (newAttributes === undefined)
                        continue;
                    attributes.push(newAttributes);
                }
                if (cases === undefined) {
                    producedAttributesForNoCases = attributes;
                }
            }
            for (const a of attributes) {
                f(a);
            }
        }
        function combineProducedAttributes(f) {
            let result = TypeAttributes_1.emptyTypeAttributes;
            forEachProducedAttribute(undefined, attr => {
                const maybeAttributes = f(attr);
                if (maybeAttributes === undefined)
                    return;
                result = (0, TypeAttributes_1.combineTypeAttributes)("union", result, maybeAttributes);
            });
            return result;
        }
        function makeAttributes(attributes) {
            if (schema.oneOf === undefined) {
                attributes = (0, TypeAttributes_1.combineTypeAttributes)("union", attributes, combineProducedAttributes(({ forType, forUnion, forCases }) => {
                    (0, Support_1.assert)(forUnion === undefined && forCases === undefined, "We can't have attributes for unions and cases if we don't have a union");
                    return forType;
                }));
            }
            return (0, TypeNames_2.modifyTypeNames)(attributes, maybeTypeNames => {
                const typeNames = (0, Support_1.defined)(maybeTypeNames);
                if (!typeNames.areInferred) {
                    return typeNames;
                }
                let title = schema.title;
                if (typeof title !== "string") {
                    title = loc.canonicalRef.definitionName;
                }
                if (typeof title === "string") {
                    return TypeNames_1.TypeNames.make(new Set([title]), new Set(), schema.$ref !== undefined);
                }
                else {
                    return typeNames.makeInferred();
                }
            });
        }
        typeAttributes = makeAttributes(typeAttributes);
        const inferredAttributes = (0, TypeAttributes_1.makeTypeAttributesInferred)(typeAttributes);
        function makeStringType(attributes) {
            const kind = typeKindForJSONSchemaFormat(schema.format);
            if (kind === undefined) {
                return typeBuilder.getStringType(attributes, StringTypes_1.StringTypes.unrestricted);
            }
            else {
                return typeBuilder.getPrimitiveType(kind, attributes);
            }
        }
        async function makeArrayType() {
            const singularAttributes = (0, TypeNames_2.singularizeTypeNames)(typeAttributes);
            const items = schema.items;
            let itemType;
            if (Array.isArray(items)) {
                const itemsLoc = loc.push("items");
                const itemTypes = await (0, collection_utils_1.arrayMapSync)(items, async (item, i) => {
                    const itemLoc = itemsLoc.push(i.toString());
                    return await toType(checkJSONSchema(item, itemLoc.canonicalRef), itemLoc, singularAttributes);
                });
                itemType = typeBuilder.getUnionType(TypeAttributes_1.emptyTypeAttributes, new Set(itemTypes));
            }
            else if (typeof items === "object") {
                const itemsLoc = loc.push("items");
                itemType = await toType(checkJSONSchema(items, itemsLoc.canonicalRef), itemsLoc, singularAttributes);
            }
            else if (items !== undefined) {
                return (0, Messages_1.messageError)("SchemaArrayItemsMustBeStringOrArray", withRef(loc, { actual: items }));
            }
            else {
                itemType = typeBuilder.getPrimitiveType("any");
            }
            typeBuilder.addAttributes(itemType, singularAttributes);
            return typeBuilder.getArrayType(TypeAttributes_1.emptyTypeAttributes, itemType);
        }
        async function makeObjectType() {
            let required;
            if (schema.required === undefined || typeof schema.required === "boolean") {
                required = [];
            }
            else {
                required = Array.from(checkRequiredArray(schema.required, loc));
            }
            let properties;
            if (schema.properties === undefined) {
                properties = {};
            }
            else {
                properties = checkJSONSchemaObject(schema.properties, loc.canonicalRef);
            }
            // In Schema Draft 3, `required` is `true` on a property that's required.
            for (const p of Object.getOwnPropertyNames(properties)) {
                if (properties[p].required === true && required.indexOf(p) < 0) {
                    required.push(p);
                }
            }
            let additionalProperties = schema.additionalProperties;
            // This is an incorrect hack to fix an issue with a Go->Schema generator:
            // https://github.com/quicktype/quicktype/issues/976
            if (additionalProperties === undefined &&
                typeof schema.patternProperties === "object" &&
                (0, collection_utils_1.hasOwnProperty)(schema.patternProperties, ".*")) {
                additionalProperties = schema.patternProperties[".*"];
            }
            const objectAttributes = (0, TypeAttributes_1.combineTypeAttributes)("union", inferredAttributes, combineProducedAttributes(({ forObject }) => forObject));
            const order = schema.quicktypePropertyOrder ? schema.quicktypePropertyOrder : [];
            const orderKey = (propertyName) => {
                // use the index of the order array
                const index = order.indexOf(propertyName);
                // if no index then use the property name
                return index !== -1 ? index : propertyName.toLowerCase();
            };
            return await makeObject(loc, objectAttributes, properties, required, additionalProperties, orderKey);
        }
        async function makeTypesFromCases(cases, kind) {
            const kindLoc = loc.push(kind);
            if (!Array.isArray(cases)) {
                return (0, Messages_1.messageError)("SchemaSetOperationCasesIsNotArray", withRef(kindLoc, { operation: kind, cases }));
            }
            // FIXME: This cast shouldn't be necessary, but TypeScript forces our hand.
            return await (0, collection_utils_1.arrayMapSync)(cases, async (t, index) => {
                const caseLoc = kindLoc.push(index.toString());
                return await toType(checkJSONSchema(t, caseLoc.canonicalRef), caseLoc, (0, TypeAttributes_1.makeTypeAttributesInferred)(typeAttributes));
            });
        }
        const intersectionType = typeBuilder.getUniqueIntersectionType(typeAttributes, undefined);
        setTypeForLocation(loc, intersectionType);
        async function convertOneOrAnyOf(cases, kind) {
            const typeRefs = await makeTypesFromCases(cases, kind);
            let unionAttributes = (0, TypeAttributes_1.makeTypeAttributesInferred)(typeAttributes);
            if (kind === "oneOf") {
                forEachProducedAttribute(cases, ({ forType, forUnion, forCases }) => {
                    if (forType !== undefined) {
                        typeBuilder.addAttributes(intersectionType, forType);
                    }
                    if (forUnion !== undefined) {
                        unionAttributes = (0, TypeAttributes_1.combineTypeAttributes)("union", unionAttributes, forUnion);
                    }
                    if (forCases !== undefined) {
                        (0, Support_1.assert)(forCases.length === typeRefs.length, "Number of case attributes doesn't match number of cases");
                        for (let i = 0; i < typeRefs.length; i++) {
                            typeBuilder.addAttributes(typeRefs[i], forCases[i]);
                        }
                    }
                });
            }
            const unionType = typeBuilder.getUniqueUnionType(unionAttributes, undefined);
            typeBuilder.setSetOperationMembers(unionType, new Set(typeRefs));
            return unionType;
        }
        const includeObject = enumArray === undefined && !isConst && (typeSet === undefined || typeSet.has("object"));
        const includeArray = enumArray === undefined && !isConst && (typeSet === undefined || typeSet.has("array"));
        const needStringEnum = includedTypes.has("string") &&
            enumArray !== undefined &&
            enumArray.find((x) => typeof x === "string") !== undefined;
        const needUnion = typeSet !== undefined ||
            schema.properties !== undefined ||
            schema.additionalProperties !== undefined ||
            schema.items !== undefined ||
            schema.required !== undefined ||
            enumArray !== undefined ||
            isConst;
        const types = [];
        if (needUnion) {
            const unionTypes = [];
            const numberAttributes = combineProducedAttributes(({ forNumber }) => forNumber);
            for (const [name, kind] of [
                ["null", "null"],
                ["number", "double"],
                ["integer", "integer"],
                ["boolean", "bool"]
            ]) {
                if (!includedTypes.has(name))
                    continue;
                const attributes = (0, Type_1.isNumberTypeKind)(kind) ? numberAttributes : undefined;
                unionTypes.push(typeBuilder.getPrimitiveType(kind, attributes));
            }
            const stringAttributes = (0, TypeAttributes_1.combineTypeAttributes)("union", inferredAttributes, combineProducedAttributes(({ forString }) => forString));
            if (needStringEnum || isConst) {
                const cases = isConst
                    ? [schema.const]
                    : enumArray.filter(x => typeof x === "string");
                unionTypes.push(typeBuilder.getStringType(stringAttributes, StringTypes_1.StringTypes.fromCases(cases)));
            }
            else if (includedTypes.has("string")) {
                unionTypes.push(makeStringType(stringAttributes));
            }
            if (includeArray) {
                unionTypes.push(await makeArrayType());
            }
            if (includeObject) {
                unionTypes.push(await makeObjectType());
            }
            types.push(typeBuilder.getUniqueUnionType(inferredAttributes, new Set(unionTypes)));
        }
        if (schema.$ref !== undefined) {
            if (typeof schema.$ref !== "string") {
                return (0, Messages_1.messageError)("SchemaRefMustBeString", withRef(loc, { actual: typeof schema.$ref }));
            }
            const virtualRef = Ref.parse(schema.$ref);
            const [target, newLoc] = await resolver.resolveVirtualRef(loc, virtualRef);
            const attributes = (0, TypeNames_2.modifyTypeNames)(typeAttributes, tn => {
                if (!(0, Support_1.defined)(tn).areInferred)
                    return tn;
                return TypeNames_1.TypeNames.make(new Set([newLoc.canonicalRef.name]), new Set(), true);
            });
            types.push(await toType(target, newLoc, attributes));
        }
        if (schema.allOf !== undefined) {
            types.push(...(await makeTypesFromCases(schema.allOf, "allOf")));
        }
        if (schema.oneOf !== undefined) {
            types.push(await convertOneOrAnyOf(schema.oneOf, "oneOf"));
        }
        if (schema.anyOf !== undefined) {
            types.push(await convertOneOrAnyOf(schema.anyOf, "anyOf"));
        }
        typeBuilder.setSetOperationMembers(intersectionType, new Set(types));
        return intersectionType;
    }
    async function toType(schema, loc, typeAttributes) {
        const maybeType = typeForCanonicalRef.get(loc.canonicalRef);
        if (maybeType !== undefined) {
            return maybeType;
        }
        let result;
        if (typeof schema === "boolean") {
            // FIXME: Empty union.  We'd have to check that it's supported everywhere,
            // in particular in union flattening.
            (0, Messages_1.messageAssert)(schema === true, "SchemaFalseNotSupported", withRef(loc));
            result = typeBuilder.getPrimitiveType("any");
        }
        else {
            loc = loc.updateWithID(schema["$id"]);
            result = await convertToType(schema, loc, typeAttributes);
        }
        setTypeForLocation(loc, result);
        return result;
    }
    for (const [topLevelName, topLevelRef] of references) {
        const [target, loc] = await resolver.resolveTopLevelRef(topLevelRef);
        const t = await toType(target, loc, (0, TypeNames_2.makeNamesTypeAttributes)(topLevelName, false));
        typeBuilder.addTopLevel(topLevelName, t);
    }
}
function removeExtension(fn) {
    const lower = fn.toLowerCase();
    const extensions = [".json", ".schema"];
    for (const ext of extensions) {
        if (lower.endsWith(ext)) {
            const base = fn.slice(0, fn.length - ext.length);
            if (base.length > 0) {
                return base;
            }
        }
    }
    return fn;
}
function nameFromURI(uri) {
    const fragment = uri.fragment();
    if (fragment !== "") {
        const components = fragment.split("/");
        const len = components.length;
        if (components[len - 1] !== "") {
            return removeExtension(components[len - 1]);
        }
        if (len > 1 && components[len - 2] !== "") {
            return removeExtension(components[len - 2]);
        }
    }
    const filename = uri.filename();
    if (filename !== "") {
        return removeExtension(filename);
    }
    return (0, Messages_1.messageError)("DriverCannotInferNameForSchema", { uri: uri.toString() });
}
async function refsInSchemaForURI(resolver, uri, defaultName) {
    const fragment = uri.fragment();
    let propertiesAreTypes = fragment.endsWith("/");
    if (propertiesAreTypes) {
        uri = uri.clone().fragment(fragment.slice(0, -1));
    }
    const ref = Ref.parseURI(uri);
    if (ref.isRoot) {
        propertiesAreTypes = false;
    }
    const schema = (await resolver.resolveTopLevelRef(ref))[0];
    if (propertiesAreTypes) {
        if (typeof schema !== "object") {
            return (0, Messages_1.messageError)("SchemaCannotGetTypesFromBoolean", { ref: ref.toString() });
        }
        return (0, collection_utils_1.mapMap)((0, collection_utils_1.mapFromObject)(schema), (_, name) => ref.push(name));
    }
    else {
        let name;
        if (typeof schema === "object" && typeof schema.title === "string") {
            name = schema.title;
        }
        else {
            const maybeName = nameFromURI(uri);
            name = maybeName !== undefined ? maybeName : defaultName;
        }
        return [name, ref];
    }
}
class InputJSONSchemaStore extends JSONSchemaStore_1.JSONSchemaStore {
    _inputs;
    _delegate;
    constructor(_inputs, _delegate) {
        super();
        this._inputs = _inputs;
        this._delegate = _delegate;
    }
    async fetch(address) {
        const maybeInput = this._inputs.get(address);
        if (maybeInput !== undefined) {
            return checkJSONSchema((0, Support_1.parseJSON)(maybeInput, "JSON Schema", address), () => Ref.root(address));
        }
        if (this._delegate === undefined) {
            return (0, Support_1.panic)(`Schema URI ${address} requested, but no store given`);
        }
        return await this._delegate.fetch(address);
    }
}
class JSONSchemaInput {
    _schemaStore;
    _additionalSchemaAddresses;
    kind = "schema";
    needSchemaProcessing = true;
    _attributeProducers;
    _schemaInputs = new Map();
    _schemaSources = [];
    _topLevels = new Map();
    _needIR = false;
    constructor(_schemaStore, additionalAttributeProducers = [], _additionalSchemaAddresses = []) {
        this._schemaStore = _schemaStore;
        this._additionalSchemaAddresses = _additionalSchemaAddresses;
        this._attributeProducers = [
            Description_1.descriptionAttributeProducer,
            AccessorNames_1.accessorNamesAttributeProducer,
            EnumValues_1.enumValuesAttributeProducer,
            URIAttributes_1.uriSchemaAttributesProducer,
            Constraints_1.minMaxAttributeProducer,
            Constraints_2.minMaxLengthAttributeProducer,
            Constraints_3.patternAttributeProducer
        ].concat(additionalAttributeProducers);
    }
    get needIR() {
        return this._needIR;
    }
    addTopLevel(name, ref) {
        this._topLevels.set(name, ref);
    }
    async addTypes(ctx, typeBuilder) {
        if (this._schemaSources.length === 0)
            return;
        let maybeSchemaStore = this._schemaStore;
        if (this._schemaInputs.size === 0) {
            if (maybeSchemaStore === undefined) {
                return (0, Support_1.panic)("Must have a schema store to process JSON Schema");
            }
        }
        else {
            maybeSchemaStore = this._schemaStore = new InputJSONSchemaStore(this._schemaInputs, maybeSchemaStore);
        }
        const schemaStore = maybeSchemaStore;
        const canonizer = new Canonizer(ctx);
        for (const address of this._additionalSchemaAddresses) {
            const schema = await schemaStore.get(address, ctx.debugPrintSchemaResolving);
            if (schema === undefined) {
                return (0, Messages_1.messageError)("SchemaFetchErrorAdditional", { address });
            }
            canonizer.addSchema(schema, address);
        }
        const resolver = new Resolver(ctx, (0, Support_1.defined)(this._schemaStore), canonizer);
        for (const [normalizedURI, source] of this._schemaSources) {
            const givenName = source.name;
            const refs = await refsInSchemaForURI(resolver, normalizedURI, givenName);
            if (Array.isArray(refs)) {
                let name;
                if (this._schemaSources.length === 1 && givenName !== undefined) {
                    name = givenName;
                }
                else {
                    name = refs[0];
                }
                this.addTopLevel(name, refs[1]);
            }
            else {
                for (const [refName, ref] of refs) {
                    this.addTopLevel(refName, ref);
                }
            }
        }
        await addTypesInSchema(resolver, typeBuilder, this._topLevels, this._attributeProducers);
    }
    addTypesSync() {
        return (0, Support_1.panic)("addTypesSync not supported in JSONSchemaInput");
    }
    async addSource(schemaSource) {
        return this.addSourceSync(schemaSource);
    }
    addSourceSync(schemaSource) {
        const { name, uris, schema, isConverted } = schemaSource;
        if (isConverted !== true) {
            this._needIR = true;
        }
        let normalizedURIs;
        if (uris === undefined) {
            normalizedURIs = [new urijs_1.default(name)];
        }
        else {
            normalizedURIs = uris.map(uri => {
                const normalizedURI = normalizeURI(uri);
                if (normalizedURI.clone().hash("").toString() === "") {
                    normalizedURI.path(name);
                }
                return normalizedURI;
            });
        }
        if (schema === undefined) {
            (0, Support_1.assert)(uris !== undefined, "URIs must be given if schema source is not specified");
        }
        else {
            for (let i = 0; i < normalizedURIs.length; i++) {
                const normalizedURI = normalizedURIs[i];
                const uri = normalizedURI.clone().hash("");
                const path = uri.path();
                let suffix = 0;
                do {
                    if (suffix > 0) {
                        uri.path(`${path}-${suffix}`);
                    }
                    suffix++;
                } while (this._schemaInputs.has(uri.toString()));
                this._schemaInputs.set(uri.toString(), schema);
                normalizedURIs[i] = uri.hash(normalizedURI.hash());
            }
        }
        // FIXME: Why do we need both _schemaSources and _schemaInputs?
        for (const normalizedURI of normalizedURIs) {
            this._schemaSources.push([normalizedURI, schemaSource]);
        }
    }
    singleStringSchemaSource() {
        if (!this._schemaSources.every(([_, { schema }]) => typeof schema === "string")) {
            return undefined;
        }
        const set = new Set(this._schemaSources.map(([_, { schema }]) => schema));
        if (set.size === 1) {
            return (0, Support_1.defined)((0, collection_utils_1.iterableFirst)(set));
        }
        return undefined;
    }
}
exports.JSONSchemaInput = JSONSchemaInput;
