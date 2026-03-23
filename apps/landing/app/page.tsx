import { Nav } from './components/nav';
import { Hero } from './components/hero';
import { ProductPreview } from './components/product-preview';
import { ProofStrip } from './components/proof-strip';
import { Features } from './components/features';
import { Testimonials } from './components/testimonials';
import { HowItWorks } from './components/how-it-works';
import { CtaBanner } from './components/cta-banner';
import { Footer } from './components/footer';

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProductPreview />
        <ProofStrip />
        <Features />
        <Testimonials />
        <HowItWorks />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
