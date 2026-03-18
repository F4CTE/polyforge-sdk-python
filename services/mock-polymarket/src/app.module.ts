import { Module } from "@nestjs/common";
import { ScenarioModule } from "./scenario/scenario.module";
import { GammaModule } from "./gamma/gamma.module";
import { DataModule } from "./data/data.module";
import { ClobModule } from "./clob/clob.module";
import { WsFeedModule } from "./ws-feed/ws-feed.module";

/** Root module for the CLOB REST server (port 3099) */
@Module({
  imports: [ScenarioModule, ClobModule, WsFeedModule],
})
export class ClobAppModule {}

/** Root module for the Gamma API server (port 3096) */
@Module({
  imports: [ScenarioModule, GammaModule],
})
export class GammaAppModule {}

/** Root module for the Data API server (port 3097) */
@Module({
  imports: [ScenarioModule, DataModule],
})
export class DataAppModule {}
