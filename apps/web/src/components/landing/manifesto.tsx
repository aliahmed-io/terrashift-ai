"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";

const WORDS: ReadonlyArray<{ w: string; accent?: boolean }> = [
  ..."Every spring the forest looks different. Every harvest the fields go bare. Satellites see all of it — and most software calls it all change. TerraShift learns the difference between a season and a"
    .split(" ")
    .map((w) => ({ w })),
  { w: "scar.", accent: true },
];

function Word({
  word,
  accent,
  progress,
  range,
}: {
  word: string;
  accent: boolean;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className={accent ? "text-signal-400 italic" : undefined}>
      {word}{" "}
    </motion.span>
  );
}

export function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.55"] });
  return (
    <section ref={ref} aria-labelledby="manifesto" className="px-6 py-32 lg:px-16 lg:py-48">
      <h2 id="manifesto" className="sr-only">
        Manifesto
      </h2>
      <p className="font-display mx-auto max-w-5xl text-[clamp(2rem,5vw,4.5rem)] leading-[1.1]">
        {WORDS.map((item, i) => (
          <Word
            key={`${item.w}-${i}`}
            word={item.w}
            accent={item.accent === true}
            progress={scrollYProgress}
            range={[i / WORDS.length, Math.min(1, (i + 4) / WORDS.length)]}
          />
        ))}
      </p>
    </section>
  );
}
