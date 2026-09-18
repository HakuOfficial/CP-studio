import logoSquare from "@/assets/branding/logo-square.png";
import logoWide from "@/assets/branding/logo-wide.png";

type LoadingWelcomeProps = {
  title?: string;
  subtitle?: string;
  message?: string;
};

export function LoadingWelcome({
  title = "CP Studio",
  subtitle = "Competitive Programming IDE",
  message = "Loading code editor..."
}: LoadingWelcomeProps) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#05070b]">
      <div className="flex w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
        <img
          src={logoSquare}
          alt="CP Studio Logo"
          className="h-24 w-24 rounded-[28px] object-cover shadow-2xl"
          draggable={false}
        />

        <img
          src={logoWide}
          alt="CP Studio"
          className="h-auto w-full max-w-[620px] object-contain"
          draggable={false}
        />

        <div className="space-y-2">
          <div className="text-2xl font-semibold text-white">{title}</div>
          <div className="text-sm uppercase tracking-[0.35em] text-white/40">
            {subtitle}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-xl">
          <div className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
          <span className="text-sm text-white/75">{message}</span>
        </div>
      </div>
    </div>
  );
}