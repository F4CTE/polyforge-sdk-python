import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Nav } from "../components/nav";
import { PricingContent } from "./pricing-content";

const Footer = dynamic(() =>
  import("../components/footer").then((m) => ({ default: m.Footer })),
);

export const metadata: Metadata = {
  title: "Pricing — Polyforge",
  description:
    "Simple, transparent pricing for algorithmic trading on prediction markets. Free tier, Pro for serious traders, and Enterprise for institutions.",
  alternates: { canonical: "/pricing" },
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main id="main-content">
        <PricingContent />
      </main>
      <Footer />
    </>
  );
}
