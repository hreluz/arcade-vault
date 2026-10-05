import type { Metadata } from "next";
import Link from "next/link";
import HallOfFameBoard from "@/components/hall-of-fame-board";

export const metadata: Metadata = {
  title: "Hall of Fame · Arcade Vault",
};

export default function HallOfFamePage() {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>HALL OF FAME</h1>
        <p className="pixel text-[10px]">THE NAMES THAT NEVER LEAVE THE SCREEN</p>
      </div>

      <HallOfFameBoard />

      <div className="mt-8 text-center">
        <Link href="/" className="btn lg">
          BACK TO LIBRARY
        </Link>
      </div>
    </div>
  );
}
