
declare module '@mark.probst/typescript-json-schema' {
    export type Args = {
        ref: boolean;
        aliasRef: boolean;
        topRef: boolean;
        titles: boolean;
        defaultProps: boolean;
        noExtraProps: boolean;
        propOrder: boolean;
        typeOfKeyword: boolean;
        required: boolean;
        strictNullChecks: boolean;
        esModuleInterop: boolean;
        skipLibCheck: boolean;
        ignoreErrors: boolean;
        out: string;
        validationKeywords: string[];
        include: string[];
        excludePrivate: boolean;
        uniqueNames: boolean;
        rejectDateType: boolean;
        id: string;
        defaultNumberType: "number" | "integer";
        tsNodeRegister: boolean;
        constAsEnum: boolean;
    };

    export type PartialArgs = Partial<Args>;

    export function generateSchema(program: any, fullTypeName: any, args: any, onlyIncludeFiles?: any, externalGenerator?: any): any;
}
