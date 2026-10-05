import { Hero } from "@/components/landing/hero";
import { Manifesto } from "@/components/landing/manifesto";
import { Nav } from "@/components/landing/nav";
import { Story } from "@/components/landing/story";
import { Closing } from "@/components/landing/closing";
import { SmoothScroll } from "@/components/smooth-scroll";

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <Nav />
      <main>
        <Hero />
        <Manifesto />
        <Story />
        <Closing />
      </main>
    </>
  );
}
