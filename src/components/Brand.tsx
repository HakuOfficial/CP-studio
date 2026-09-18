import logoSquare from "@/assets/branding/logo-square.png";

export function Brand({ showText = true }: { showText?: boolean }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <img
        src={logoSquare}
        alt="CP Studio"
        className="h-8 w-8 rounded-xl object-cover shadow-md"
        draggable={false}
      />

      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold text-white">CP Studio</span>
          <span className="text-[10px] tracking-[0.25em] text-white/45 uppercase">
            Competitive Programming IDE
          </span>
        </div>
      )}
    </div>
  );
}