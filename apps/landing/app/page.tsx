import dynamic from 'next/dynamic';
import { Nav } from './components/nav';
import { Hero } from './components/hero';
import { ProductPreview } from './components/product-preview';
import { ProofStrip } from './components/proof-strip';
import { Features } from './components/features';

// Lazy load below-fold sections to reduce initial JS bundle
const Testimonials = dynamic(() => import('./components/testimonials').then(m => ({ default: m.Testimonials })));
const HowItWorks = dynamic(() => import('./components/how-it-works').then(m => ({ default: m.HowItWorks })));
const CtaBanner = dynamic(() => import('./components/cta-banner').then(m => ({ default: m.CtaBanner })));
const Footer = dynamic(() => import('./components/footer').then(m => ({ default: m.Footer })));

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
