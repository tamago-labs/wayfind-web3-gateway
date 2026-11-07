'use client';

import Header from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import Features from '@/components/landing/Features';
import HowSection from '@/components/landing/HowSection';
import UseCases from '@/components/landing/UseCases';
import Connectors from '@/components/landing/Connectors';
import FinalCta from '@/components/landing/FinalCta';
import Footer from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="relative overflow-x-hidden bg-white text-navy min-h-screen">
      <Header />
      <Hero />
      <Features />
      <HowSection />
      <UseCases />
      <Connectors />
      <FinalCta />
      <Footer />
    </main>
  );
}
