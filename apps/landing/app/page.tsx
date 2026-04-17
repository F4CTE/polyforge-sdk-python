import dynamic from "next/dynamic";
import { Nav } from "./components/nav";
import { Hero } from "./components/hero";
import { MetricsStrip } from "./components/metrics-strip";
import { ProductShowcase } from "./components/product-showcase";
import { DeveloperSection } from "./components/developer-section";

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
        <ProductShowcase />
        <DeveloperSection />
        <Testimonials />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
