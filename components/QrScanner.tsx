"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef } from "react";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface QrScannerProps {
  onScan: (cardCode: string) => void;
  onError: (message: string) => void;
  // While paused, decoded codes are ignored (the till is showing a
  // result). The camera keeps running so scanning resumes instantly.
  paused?: boolean;
}

// A continuously running QR scanner. It calls onScan for each decoded
// card code, throttling repeats of the same code so one customer holding
// their phone still only stamps once.
export default function QrScanner({
  onScan,
  onError,
  paused = false,
}: QrScannerProps) {
  const pausedRef = useRef(paused);
  const last = useRef({ value: "", at: 0 });

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader", { verbose: false });
    let started = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10 },
        (text) => {
          if (pausedRef.current) return;
          const value = text.trim();
          if (!UUID_PATTERN.test(value)) return;
          const now = Date.now();
          if (value === last.current.value && now - last.current.at < 4000) {
            return;
          }
          last.current = { value, at: now };
          onScan(value);
        },
        undefined
      )
      .then(() => {
        started = true;
      })
      .catch(() => {
        onError(
          "Could not open the camera. Check permissions, or look the customer up by email instead."
        );
      });

    return () => {
      if (started) scanner.stop().catch(() => {});
    };
    // The scanner owns the camera for its whole lifetime; start once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
      <div
        id="qr-reader"
        className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
      />
      {/* Viewfinder overlay: corner brackets and a sweeping scan line. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-6 top-6 h-8 w-8 rounded-tl-xl border-l-2 border-t-2 border-brand-accent" />
        <div className="absolute right-6 top-6 h-8 w-8 rounded-tr-xl border-r-2 border-t-2 border-brand-accent" />
        <div className="absolute bottom-6 left-6 h-8 w-8 rounded-bl-xl border-b-2 border-l-2 border-brand-accent" />
        <div className="absolute bottom-6 right-6 h-8 w-8 rounded-br-xl border-b-2 border-r-2 border-brand-accent" />
        {!paused && <div className="scan-line" />}
      </div>
    </div>
  );
}
