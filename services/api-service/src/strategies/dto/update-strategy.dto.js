"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateStrategyDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_strategy_dto_1 = require("./create-strategy.dto");
class UpdateStrategyDto extends (0, mapped_types_1.PartialType)(create_strategy_dto_1.CreateStrategyDto) {
}
exports.UpdateStrategyDto = UpdateStrategyDto;
//# sourceMappingURL=update-strategy.dto.js.map