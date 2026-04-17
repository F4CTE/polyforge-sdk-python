import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  Matches,
} from "class-validator";

const BYTES32_REGEX = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

export class RedeemPositionDto {
  @IsUUID()
  userId!: string;

  /** CTF conditionId (bytes32) for the market. */
  @IsString()
  @IsNotEmpty()
  @Matches(BYTES32_REGEX, { message: "conditionId must be a 0x-prefixed 32-byte hex string" })
  conditionId!: string;

  /** Index sets identifying the winning outcome slots. Must be non-empty. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  indexSets!: string[];

  /** Collateral token address (defaults to USDC for the configured chain). */
  @IsOptional()
  @IsString()
  @Matches(ADDRESS_REGEX, { message: "collateralToken must be a valid Ethereum address" })
  collateralToken?: string;

  /** parentCollectionId (bytes32, defaults to zero bytes32). */
  @IsOptional()
  @IsString()
  @Matches(BYTES32_REGEX, { message: "parentCollectionId must be a 0x-prefixed 32-byte hex string" })
  parentCollectionId?: string;
}

export class SplitPositionDto {
  @IsUUID()
  userId!: string;

  /** CTF conditionId (bytes32). */
  @IsString()
  @IsNotEmpty()
  @Matches(BYTES32_REGEX, { message: "conditionId must be a 0x-prefixed 32-byte hex string" })
  conditionId!: string;

  /** Partition of outcome slots (e.g. [\"1\", \"2\"] for YES+NO binary market). */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  partition!: string[];

  /** Amount of collateral to split (in token base units). */
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsOptional()
  @IsString()
  @Matches(ADDRESS_REGEX, { message: "collateralToken must be a valid Ethereum address" })
  collateralToken?: string;

  @IsOptional()
  @IsString()
  @Matches(BYTES32_REGEX, { message: "parentCollectionId must be a 0x-prefixed 32-byte hex string" })
  parentCollectionId?: string;
}

export class MergePositionDto {
  @IsUUID()
  userId!: string;

  /** CTF conditionId (bytes32). */
  @IsString()
  @IsNotEmpty()
  @Matches(BYTES32_REGEX, { message: "conditionId must be a 0x-prefixed 32-byte hex string" })
  conditionId!: string;

  /** Partition of outcome slots to merge. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  partition!: string[];

  /** Amount of conditional tokens to merge (in token base units). */
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsOptional()
  @IsString()
  @Matches(ADDRESS_REGEX, { message: "collateralToken must be a valid Ethereum address" })
  collateralToken?: string;

  @IsOptional()
  @IsString()
  @Matches(BYTES32_REGEX, { message: "parentCollectionId must be a 0x-prefixed 32-byte hex string" })
  parentCollectionId?: string;
}
