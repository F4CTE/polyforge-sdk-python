import dynamic from "next/dynamic";
import { Nav } from "./components/nav";
import { Hero } from "./components/hero";
import { MetricsStrip } from "./components/metrics-strip";

const Tape = dynamic(() =>
  import("./components/tape").then((m) => ({ default: m.Tape })),
);
const TrustStrip = dynamic(() =>
  import("./components/trust-strip").then((m) => ({ default: m.TrustStrip })),
);
const BuilderSection = dynamic(() =>
  import("./components/builder-section").then((m) => ({
    default: m.BuilderSection,
  })),
);
const WhaleSection = dynamic(() =>
  import("./components/whale-section").then((m) => ({
    default: m.WhaleSection,
  })),
);
const BacktestSection = dynamic(() =>
  import("./components/backtest-section").then((m) => ({
    default: m.BacktestSection,
  })),
);
const SmartExecutionSection = dynamic(() =>
  import("./components/smart-execution-section").then((m) => ({
    default: m.SmartExecutionSection,
  })),
);
const Registry = dynamic(() =>
  import("./components/registry").then((m) => ({ default: m.Registry })),
);
const DeveloperSection = dynamic(() =>
  import("./components/developer-section").then((m) => ({
    default: m.DeveloperSection,
  })),
);
const FeatureMatrix = dynamic(() =>
  import("./components/feature-matrix").then((m) => ({
    default: m.FeatureMatrix,
  })),
);
const Testimonials = dynamic(() =>
  import("./components/testimonials").then((m) => ({
    default: m.Testimonials,
  })),
);
const CtaBanner = dynamic(() =>
  import("./components/cta-banner").then((m) => ({ default: m.CtaBanner })),
);
const Footer = dynamic(() =>
  import("./components/footer").then((m) => ({ default: m.Footer })),
);

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main id="main-content">
        <Hero />
        <MetricsStrip />
        <TrustStrip />
        <Tape />
        <BuilderSection />
        <WhaleSection />
        <BacktestSection />
        <SmartExecutionSection />
        <Registry />
        <DeveloperSection />
        <FeatureMatrix />
        <Testimonials />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
