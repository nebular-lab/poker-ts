"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pokerAssert = void 0;
function pokerAssert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
exports.pokerAssert = pokerAssert;
//# sourceMappingURL=assert.js.map