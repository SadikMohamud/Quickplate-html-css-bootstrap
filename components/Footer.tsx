export default function Footer() {
  return (
    <footer
      className="pt-4 text-center text-xs text-brand-muted"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      Built by{" "}
      <a
        href="https://github.com/SadikMohamud"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-brand"
      >
        Snurm
      </a>
    </footer>
  );
}
