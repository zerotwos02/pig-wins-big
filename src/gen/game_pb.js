// protos/game.proto
import { enumDesc, fileDesc, messageDesc } from "@bufbuild/protobuf/codegenv2";
/**
 * Describes the file game.proto.
 */
export const file_game = fileDesc("CgpnYW1lLnByb3RvEgpwaWd3aW5zLnYxIjEKC1NwaW5SZXF1ZXN0Eg0KBXN0YWtlGAEgASgBEhMKC2NsaWVudF9zZWVkGAIgASgEIikKBEdyaWQSIQoFY2VsbHMYASADKA4yEi5waWd3aW5zLnYxLlN5bWJvbCJrCgdCYXNlV2luEiIKBnN5bWJvbBgBIAEoDjISLnBpZ3dpbnMudjEuU3ltYm9sEg0KBXJlZWxzGAIgASgFEgwKBHdheXMYAyABKAUSDgoGYW1vdW50GAQgASgBEg8KB2luZGljZXMYBSADKAUi+gMKDEZlYXR1cmVFdmVudBI0Cghsb2NrX3BpZxgBIAEoCzIgLnBpZ3dpbnMudjEuRmVhdHVyZUV2ZW50LkxvY2tQaWdIABI4Cgp3aWxkX2Jvb3N0GAIgASgLMiIucGlnd2lucy52MS5GZWF0dXJlRXZlbnQuV2lsZEJvb3N0SAASPAoMaGFtbWVyX3NtYXNoGAMgASgLMiQucGlnd2lucy52MS5GZWF0dXJlRXZlbnQuSGFtbWVyU21hc2hIABI6CgtzcGluc19yZXNldBgEIAEoCzIjLnBpZ3dpbnMudjEuRmVhdHVyZUV2ZW50LlNwaW5zUmVzZXRIABonCgdMb2NrUGlnEg0KBWluZGV4GAEgASgFEg0KBXZhbHVlGAIgASgBGl0KCVdpbGRCb29zdBISCgp3aWxkX2luZGV4GAEgASgFEhMKC3BpZ19pbmRpY2VzGAIgAygFEhIKCm5ld192YWx1ZXMYAyADKAESEwoLc3BpbnNfYWRkZWQYBCABKAUaSwoLSGFtbWVyU21hc2gSEgoKZnJvbV9pbmRleBgBIAEoBRIQCgh0b19pbmRleBgCIAEoBRIWCg5hYnNvcmJlZF90b3RhbBgDIAEoARolCgpTcGluc1Jlc2V0EhcKD3NwaW5zX3JlbWFpbmluZxgBIAEoBUIECgJldiKiAQoKUGlnRmVhdHVyZRIRCgl0cmlnZ2VyZWQYASABKAgSEgoKcGlnc190b3RhbBgCIAEoBRITCgtwaWdfaW5kaWNlcxgDIAMoBRIoCgZldmVudHMYBCADKAsyGC5waWd3aW5zLnYxLkZlYXR1cmVFdmVudBIZChFmdWxsX2JvYXJkX2RvdWJsZRgFIAEoCBITCgtmZWF0dXJlX3dpbhgGIAEoASK/AQoMU3BpblJlc3BvbnNlEh4KBGdyaWQYASABKAsyEC5waWd3aW5zLnYxLkdyaWQSFgoOYmFzZV93aW5fdG90YWwYAiABKAESJgoJYmFzZV93aW5zGAMgAygLMhMucGlnd2lucy52MS5CYXNlV2luEicKB2ZlYXR1cmUYCiABKAsyFi5waWd3aW5zLnYxLlBpZ0ZlYXR1cmUSEwoLd2luX2luZGljZXMYFCADKAUSEQoJdG90YWxfd2luGB4gASgBKpYBCgZTeW1ib2wSDwoLU1lNX1VOS05PV04QABILCgdTWU1fUElHEAESEAoMU1lNX1BJR19HT0xEEAISDAoIU1lNX1dJTEQQAxIOCgpTWU1fSEFNTUVSEAQSDwoLU1lNX0RJQU1PTkQQChIRCg1TWU1fR09MRF9CQVJTEAsSDAoIU1lNX0NBU0gQDBIMCghTWU1fQ09JThANYgZwcm90bzM");
/**
 * Describes the message pigwins.v1.SpinRequest.
 * Use `create(SpinRequestSchema)` to create a new message.
 */
export const SpinRequestSchema = messageDesc(file_game, 0);
/**
 * Describes the message pigwins.v1.Grid.
 * Use `create(GridSchema)` to create a new message.
 */
export const GridSchema = messageDesc(file_game, 1);
/**
 * Describes the message pigwins.v1.BaseWin.
 * Use `create(BaseWinSchema)` to create a new message.
 */
export const BaseWinSchema = messageDesc(file_game, 2);
/**
 * Describes the message pigwins.v1.FeatureEvent.
 * Use `create(FeatureEventSchema)` to create a new message.
 */
export const FeatureEventSchema = messageDesc(file_game, 3);
/**
 * Describes the message pigwins.v1.FeatureEvent.LockPig.
 * Use `create(FeatureEvent_LockPigSchema)` to create a new message.
 */
export const FeatureEvent_LockPigSchema = messageDesc(file_game, 3, 0);
/**
 * Describes the message pigwins.v1.FeatureEvent.WildBoost.
 * Use `create(FeatureEvent_WildBoostSchema)` to create a new message.
 */
export const FeatureEvent_WildBoostSchema = messageDesc(file_game, 3, 1);
/**
 * Describes the message pigwins.v1.FeatureEvent.HammerSmash.
 * Use `create(FeatureEvent_HammerSmashSchema)` to create a new message.
 */
export const FeatureEvent_HammerSmashSchema = messageDesc(file_game, 3, 2);
/**
 * Describes the message pigwins.v1.FeatureEvent.SpinsReset.
 * Use `create(FeatureEvent_SpinsResetSchema)` to create a new message.
 */
export const FeatureEvent_SpinsResetSchema = messageDesc(file_game, 3, 3);
/**
 * Describes the message pigwins.v1.PigFeature.
 * Use `create(PigFeatureSchema)` to create a new message.
 */
export const PigFeatureSchema = messageDesc(file_game, 4);
/**
 * Describes the message pigwins.v1.SpinResponse.
 * Use `create(SpinResponseSchema)` to create a new message.
 */
export const SpinResponseSchema = messageDesc(file_game, 5);
/**
 * @generated from enum pigwins.v1.Symbol
 */
export var Symbol;
(function (Symbol) {
    /**
     * @generated from enum value: SYM_UNKNOWN = 0;
     */
    Symbol[Symbol["SYM_UNKNOWN"] = 0] = "SYM_UNKNOWN";
    /**
     * @generated from enum value: SYM_PIG = 1;
     */
    Symbol[Symbol["SYM_PIG"] = 1] = "SYM_PIG";
    /**
     * @generated from enum value: SYM_PIG_GOLD = 2;
     */
    Symbol[Symbol["SYM_PIG_GOLD"] = 2] = "SYM_PIG_GOLD";
    /**
     * @generated from enum value: SYM_WILD = 3;
     */
    Symbol[Symbol["SYM_WILD"] = 3] = "SYM_WILD";
    /**
     * @generated from enum value: SYM_HAMMER = 4;
     */
    Symbol[Symbol["SYM_HAMMER"] = 4] = "SYM_HAMMER";
    /**
     * @generated from enum value: SYM_DIAMOND = 10;
     */
    Symbol[Symbol["SYM_DIAMOND"] = 10] = "SYM_DIAMOND";
    /**
     * @generated from enum value: SYM_GOLD_BARS = 11;
     */
    Symbol[Symbol["SYM_GOLD_BARS"] = 11] = "SYM_GOLD_BARS";
    /**
     * @generated from enum value: SYM_CASH = 12;
     */
    Symbol[Symbol["SYM_CASH"] = 12] = "SYM_CASH";
    /**
     * @generated from enum value: SYM_COIN = 13;
     */
    Symbol[Symbol["SYM_COIN"] = 13] = "SYM_COIN";
})(Symbol || (Symbol = {}));
/**
 * Describes the enum pigwins.v1.Symbol.
 */
export const SymbolSchema = enumDesc(file_game, 0);
